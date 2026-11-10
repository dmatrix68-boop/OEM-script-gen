/* Minimaler ZIP-Writer ohne externe Abhängigkeiten, mit ZIP64.
   Nutzt CompressionStream('deflate-raw') falls verfügbar, sonst "stored".

   ZIP64 (APPNOTE 4.5): Sobald eine Größe, ein Offset oder die Zahl der
   Einträge die 32- bzw. 16-Bit-Felder sprengt, stehen dort 0xFFFFFFFF bzw.
   0xFFFF und die echten Werte im Zusatzfeld 0x0001; am Ende folgen
   ZIP64-End-of-Central-Directory und -Locator. Kleine Archive bleiben
   klassisches ZIP und damit für jedes Werkzeug lesbar.

   Speicher: Binärdateien kommen als Blob/File, also als Verweis auf die Datei
   auf der Platte. Bis LARGE werden sie eingelesen und komprimiert; größere
   werden einmal für die CRC gelesen (als Datenstrom) und dann unkomprimiert als
   Verweis ins Ergebnis übernommen - ein Blob aus Blobs kopiert keine Daten.
   Treiber- und Installerdateien sind ohnehin meist schon komprimiert. */
(function (global) {
  'use strict';

  const LARGE = 128 * 1024 * 1024;
  const U32 = 0xFFFFFFFF;
  const U16 = 0xFFFF;

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  /* Laufende CRC: Startwert 0xFFFFFFFF, Ergebnis mit crcFinish abschließen. */
  function crcUpdate(c, bytes) {
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return c;
  }
  function crcFinish(c) { return (c ^ U32) >>> 0; }
  function crc32(bytes) { return crcFinish(crcUpdate(U32, bytes)); }

  async function crc32Stream(blob) {
    let c = U32;
    const reader = blob.stream().getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      c = crcUpdate(c, value);
    }
    return crcFinish(c);
  }

  const enc = new TextEncoder();
  const isBlob = (d) => typeof Blob !== 'undefined' && d instanceof Blob;

  async function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    if (isBlob(data)) return new Uint8Array(await data.arrayBuffer());
    return enc.encode(String(data));
  }

  /* Unter 128 Bytes lohnt Deflate nicht - und bei zehntausenden kleinen
     Treiberdateien kostet jeder Kompressor-Aufruf spuerbar Zeit. */
  async function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined' || bytes.length < 128) return null;
    try {
      const cs = new CompressionStream('deflate-raw');
      const stream = new Blob([bytes]).stream().pipeThrough(cs);
      const buf = await new Response(stream).arrayBuffer();
      const out = new Uint8Array(buf);
      return out.length < bytes.length ? out : null;
    } catch (e) {
      return null;
    }
  }

  /* DOS-Zeitstempel */
  function dosTime(d) {
    return ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() / 2)) & 0xFFFF;
  }
  function dosDate(d) {
    return (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xFFFF;
  }

  /* Sammelt Teile (Bytes oder Blobs) und zählt die Länge bis 2^53 genau. */
  class ByteWriter {
    constructor() { this.parts = []; this.length = 0; }
    push(part) { this.parts.push(part); this.length += isBlob(part) ? part.size : part.length; }
    blob(type) { return new Blob(this.parts, { type: type || 'application/zip' }); }
  }

  /*  Baut einen Datensatz in einem einzigen Puffer - statt je Feld ein eigenes
      Mini-Array, was bei zehntausenden Einträgen Millionen Objekte ergäbe. */
  class Rec {
    constructor(size) { this.b = new Uint8Array(size); this.dv = new DataView(this.b.buffer); this.p = 0; }
    u16(v) { this.dv.setUint16(this.p, v & 0xFFFF, true); this.p += 2; return this; }
    u32(v) { this.dv.setUint32(this.p, v >>> 0, true); this.p += 4; return this; }
    u64(v) { this.dv.setUint32(this.p, v % 0x100000000, true); this.dv.setUint32(this.p + 4, Math.floor(v / 0x100000000), true); this.p += 8; return this; }
    bytes(u8) { this.b.set(u8, this.p); this.p += u8.length; return this; }
    done() { if (this.p !== this.b.length) throw new Error('ZIP: Datensatzlaenge stimmt nicht'); return this.b; }
  }

  /* ZIP64-Zusatzfeld 0x0001 aus den angegebenen 64-Bit-Werten */
  function zip64Extra(values) {
    const r = new Rec(4 + 8 * values.length).u16(0x0001).u16(8 * values.length);
    values.forEach((v) => r.u64(v));
    return r.done();
  }

  /**
   * entries: [{ path:'a/b.txt', data:string|Uint8Array|ArrayBuffer|Blob, date?:Date }]
   * Ordner werden implizit über die Pfade erzeugt.
   * opts.forceZip64 (nur für Tests): ZIP64-Felder auch bei kleinen Archiven.
   */
  async function createZip(entries, opts) {
    const now = (opts && opts.date) || new Date();
    const force = !!(opts && opts.forceZip64);
    const w = new ByteWriter();
    const central = [];

    for (const entry of entries) {
      const nameBytes = enc.encode(entry.path.replace(/\\/g, '/'));
      const d = entry.date || now;
      let crc, method, payload, size;

      if (isBlob(entry.data) && entry.data.size > LARGE) {
        crc = await crc32Stream(entry.data);
        method = 0;
        payload = entry.data;
        size = entry.data.size;
      } else {
        const raw = await toBytes(entry.data);
        crc = crc32(raw);
        const packed = await deflateRaw(raw);
        method = packed ? 8 : 0;
        payload = packed || raw;
        size = raw.length;
      }
      const csize = isBlob(payload) ? payload.size : payload.length;
      const offset = w.length;
      /* Im lokalen Header stehen bei ZIP64 immer beide Größen im Zusatzfeld. */
      const big = force || size >= U32 || csize >= U32;
      const localExtra = big ? zip64Extra([size, csize]) : new Uint8Array(0);

      w.push(new Rec(30 + nameBytes.length + localExtra.length)
        .u32(0x04034b50)
        .u16(big ? 45 : (method ? 20 : 10))    // version needed
        .u16(0x0800)                           // UTF-8 flag
        .u16(method)
        .u16(dosTime(d))
        .u16(dosDate(d))
        .u32(crc)
        .u32(big ? U32 : csize)
        .u32(big ? U32 : size)
        .u16(nameBytes.length)
        .u16(localExtra.length)
        .bytes(nameBytes)
        .bytes(localExtra)
        .done());
      w.push(payload);

      central.push({ nameBytes, crc, method, csize, size, offset, date: d });
    }

    const cdStart = w.length;
    const cdParts = [];
    for (const c of central) {
      /* Im Zentralverzeichnis nur die Werte, deren 32-Bit-Feld überläuft -
         in dieser festen Reihenfolge. */
      const sz = force || c.size >= U32;
      const cs = force || c.csize >= U32;
      const of = force || c.offset >= U32;
      const vals = [];
      if (sz) vals.push(c.size);
      if (cs) vals.push(c.csize);
      if (of) vals.push(c.offset);
      const extra = vals.length ? zip64Extra(vals) : new Uint8Array(0);
      const ver = vals.length ? 45 : (c.method ? 20 : 10);

      cdParts.push(new Rec(46 + c.nameBytes.length + extra.length)
        .u32(0x02014b50)
        .u16(0x0300 | ver)                     // version made by (UNIX)
        .u16(ver)
        .u16(0x0800)
        .u16(c.method)
        .u16(dosTime(c.date))
        .u16(dosDate(c.date))
        .u32(c.crc)
        .u32(cs ? U32 : c.csize)
        .u32(sz ? U32 : c.size)
        .u16(c.nameBytes.length)
        .u16(extra.length)
        .u16(0).u16(0).u16(0)                  // comment, disk, internal attrs
        .u32(0)                                // external attrs
        .u32(of ? U32 : c.offset)
        .bytes(c.nameBytes)
        .bytes(extra)
        .done());
    }
    /* Zentralverzeichnis als ein zusammenhaengender Block */
    const cdSize = cdParts.reduce((a, x) => a + x.length, 0);
    const cd = new Uint8Array(cdSize);
    let pos = 0;
    for (const x of cdParts) { cd.set(x, pos); pos += x.length; }
    w.push(cd);
    const count = central.length;
    const need64 = force || count >= U16 || cdStart >= U32 || cdSize >= U32;

    if (need64) {
      const eocd64 = w.length;
      w.push(new Rec(56 + 20)
        .u32(0x06064b50)                       // ZIP64 end of central directory
        .u64(44)                               // Größe des restlichen Datensatzes
        .u16(0x032D).u16(45)                   // made by / needed
        .u32(0).u32(0)                         // Nummer dieses / des CD-Datenträgers
        .u64(count).u64(count)
        .u64(cdSize).u64(cdStart)
        .u32(0x07064b50)                       // ZIP64 end of central directory locator
        .u32(0)
        .u64(eocd64)
        .u32(1)                                // Gesamtzahl Datenträger
        .done());
    }

    w.push(new Rec(22)
      .u32(0x06054b50)                         // End of central directory
      .u16(0).u16(0)
      .u16(need64 ? U16 : count).u16(need64 ? U16 : count)
      .u32(need64 ? U32 : cdSize).u32(need64 ? U32 : cdStart)
      .u16(0)
      .done());

    return w.blob();
  }

  global.MiniZip = { createZip, crc32 };
})(window);
