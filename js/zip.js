/* Minimaler ZIP-Writer ohne externe Abhängigkeiten.
   Nutzt CompressionStream('deflate-raw') falls verfügbar, sonst "stored". */
(function (global) {
  'use strict';

  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();

  function toBytes(data) {
    if (data instanceof Uint8Array) return data;
    if (data instanceof ArrayBuffer) return new Uint8Array(data);
    return enc.encode(String(data));
  }

  async function deflateRaw(bytes) {
    if (typeof CompressionStream === 'undefined' || bytes.length === 0) return null;
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

  class ByteWriter {
    constructor() { this.parts = []; this.length = 0; }
    push(u8) { this.parts.push(u8); this.length += u8.length; }
    u16(v) { const b = new Uint8Array(2); new DataView(b.buffer).setUint16(0, v & 0xFFFF, true); this.push(b); }
    u32(v) { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, v >>> 0, true); this.push(b); }
    blob(type) { return new Blob(this.parts, { type: type || 'application/zip' }); }
  }

  /**
   * entries: [{ path:'a/b.txt', data:string|Uint8Array|ArrayBuffer, date?:Date }]
   * Ordner werden implizit über die Pfade erzeugt.
   */
  async function createZip(entries, opts) {
    const now = (opts && opts.date) || new Date();
    const w = new ByteWriter();
    const central = [];

    for (const entry of entries) {
      const nameBytes = enc.encode(entry.path.replace(/\\/g, '/'));
      const raw = toBytes(entry.data);
      const crc = crc32(raw);
      const packed = await deflateRaw(raw);
      const method = packed ? 8 : 0;
      const payload = packed || raw;
      const offset = w.length;
      const d = entry.date || now;

      // Local file header
      w.u32(0x04034b50);
      w.u16(method ? 20 : 10);      // version needed
      w.u16(0x0800);                 // UTF-8 flag
      w.u16(method);
      w.u16(dosTime(d));
      w.u16(dosDate(d));
      w.u32(crc);
      w.u32(payload.length);
      w.u32(raw.length);
      w.u16(nameBytes.length);
      w.u16(0);
      w.push(nameBytes);
      w.push(payload);

      central.push({ nameBytes, crc, method, csize: payload.length, size: raw.length, offset, date: d });
    }

    const cdStart = w.length;
    for (const c of central) {
      w.u32(0x02014b50);
      w.u16(0x031E);                 // version made by (UNIX/3.0)
      w.u16(c.method ? 20 : 10);
      w.u16(0x0800);
      w.u16(c.method);
      w.u16(dosTime(c.date));
      w.u16(dosDate(c.date));
      w.u32(c.crc);
      w.u32(c.csize);
      w.u32(c.size);
      w.u16(c.nameBytes.length);
      w.u16(0); w.u16(0); w.u16(0); w.u16(0);
      w.u32(0);                      // external attrs
      w.u32(c.offset);
      w.push(c.nameBytes);
    }
    const cdSize = w.length - cdStart;

    // End of central directory
    w.u32(0x06054b50);
    w.u16(0); w.u16(0);
    w.u16(central.length); w.u16(central.length);
    w.u32(cdSize); w.u32(cdStart);
    w.u16(0);

    return w.blob();
  }

  global.MiniZip = { createZip, crc32 };
})(window);
