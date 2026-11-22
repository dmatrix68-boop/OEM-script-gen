/*  ISO-Abbild lesen und neu schreiben – ohne externe Werkzeuge.

    Zweck: Eine Windows-Installations-ISO einlesen, die erzeugten Dateien
    ($OEM$, autounattend.xml, $WinPEDriver$ ...) hinzufügen und eine neue,
    bootfähige ISO schreiben. Das ersetzt den Weg über oscdimg, AnyBurn & Co.

    Aufbau wie bei Microsoft (oscdimg -u2 -udfver102):
      * ISO 9660 nur als Hülle: Primary Volume Descriptor, El-Torito-Boot-Record
        und eine einzige Datei README.TXT. Windows-Medien legen den eigentlichen
        Inhalt nur in UDF ab - install.wim ist meist größer als 4 GB, das kann
        ISO 9660 nur mit Mehrfach-Extents, an denen viele Werkzeuge scheitern.
      * UDF 1.02 mit dem gesamten Verzeichnisbaum. Den lesen Windows, der
        Windows-Bootmanager (etfsboot.com/cdboot.efi), Rufus und Ventoy.
      * El Torito: die Einträge des Quell-Bootkatalogs (BIOS und UEFI) werden
        übernommen, mit denselben Werten für Ladesegment und Sektorzahl - nur
        die Lage der Bootabbilder ändert sich.

    Speicher: Dateiinhalte der Quell-ISO werden nie eingelesen, sondern als
    Blob-Ausschnitt (File.slice) ins Ergebnis übernommen - wie beim ZIP-Export.
    Eingelesen werden nur Verwaltungsdaten und die Bootabbilder (wenige MB).

    Ausrichtung: Jede Datei beginnt auf einer 4-KB-Grenze. Das kostet je Datei
    höchstens 2 KB und erlaubt später, große Dateien auf ReFS per Block
    Cloning in die ISO zu übernehmen statt sie zu kopieren.

    Nicht unterstützt (mit klarer Fehlermeldung): UDF mit Metadaten-, virtueller
    oder Sparable-Partition (UDF 2.x von Brennprogrammen), ICB-Strategie 4096,
    Festplatten-Emulation im Bootkatalog. Windows-ISOs von Microsoft nutzen
    nichts davon.  */
(function (global) {
  'use strict';

  const SECTOR = 2048;
  const MAX_EXTENT = 0x40000000 - SECTOR;   // short_ad: Länge in 30 Bit
  const ALIGN = 2;                            // Sektoren je Dateibeginn (4 KB)
  const IMPL_ID = '*OEM Script Generator';
  const FID_IU = 32;                          // Implementation Use je Verzeichniseintrag
  const enc = new TextEncoder();

  /* ---------------- Hilfsfunktionen ---------------- */

  function isoError(msg, code) {
    const e = new Error(msg);
    e.isoCode = code || 'invalid';
    return e;
  }

  /* CRC-16 nach ITU-T (Polynom 0x1021, Startwert 0) - ECMA-167 7.2.6 */
  const CRC16 = (function () {
    const t = new Uint16Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n << 8;
      for (let k = 0; k < 8; k++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1);
      t[n] = c & 0xFFFF;
    }
    return t;
  })();
  function crc16(bytes, start, len) {
    let c = 0;
    for (let i = start; i < start + len; i++) c = ((c << 8) ^ CRC16[((c >> 8) ^ bytes[i]) & 0xFF]) & 0xFFFF;
    return c;
  }

  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000; }
  function u64(b, o) { return u32(b, o) + u32(b, o + 4) * 0x100000000; }

  /* Schreibhilfe auf einem Uint8Array */
  function W(buf) {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    return {
      buf,
      u8(o, v) { buf[o] = v & 0xFF; },
      u16(o, v) { dv.setUint16(o, v & 0xFFFF, true); },
      u32(o, v) { dv.setUint32(o, v >>> 0, true); },
      u64(o, v) { dv.setUint32(o, v % 0x100000000, true); dv.setUint32(o + 4, Math.floor(v / 0x100000000), true); },
      be16(o, v) { dv.setUint16(o, v & 0xFFFF, false); },
      be32(o, v) { dv.setUint32(o, v >>> 0, false); },
      both16(o, v) { dv.setUint16(o, v, true); dv.setUint16(o + 2, v, false); },
      both32(o, v) { dv.setUint32(o, v >>> 0, true); dv.setUint32(o + 4, v >>> 0, false); },
      bytes(o, arr) { buf.set(arr, o); },
      ascii(o, s, len, pad) {
        for (let i = 0; i < len; i++) buf[o + i] = i < s.length ? (s.charCodeAt(i) & 0x7F) : (pad === undefined ? 0x20 : pad);
      }
    };
  }

  /* ---------------- UDF: Zeichensätze, Zeitstempel, Kennungen ---------------- */

  /* OSTA Compressed Unicode: 8 = ein Byte je Zeichen, 16 = UTF-16BE */
  function cs0Encode(s) {
    const wide = /[^\u0000-ÿ]/.test(s);
    const out = new Uint8Array(1 + s.length * (wide ? 2 : 1));
    out[0] = wide ? 16 : 8;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (wide) { out[1 + i * 2] = c >> 8; out[2 + i * 2] = c & 0xFF; } else out[1 + i] = c;
    }
    return out;
  }
  function cs0Decode(b, o, len) {
    if (len <= 0) return '';
    const id = b[o];
    let s = '';
    if (id === 8) for (let i = 1; i < len; i++) s += String.fromCharCode(b[o + i]);
    else if (id === 16) for (let i = 1; i + 1 < len; i += 2) s += String.fromCharCode((b[o + i] << 8) | b[o + i + 1]);
    else throw isoError('Unbekannte Zeichenkodierung ' + id + ' in einem UDF-Namen.');
    return s;
  }
  /* dstring: festes Feld, letztes Byte = benutzte Länge */
  function dstring(s, fieldLen) {
    const out = new Uint8Array(fieldLen);
    if (!s) return out;
    let b = cs0Encode(s);
    if (b.length > fieldLen - 1) {
      let n = fieldLen - 1;
      if (b[0] === 16 && (n - 1) % 2) n--;
      b = b.slice(0, n);
    }
    out.set(b, 0);
    out[fieldLen - 1] = b.length;
    return out;
  }
  function dstringDecode(b, o, fieldLen) {
    const len = b[o + fieldLen - 1];
    if (!len || len > fieldLen - 1) return '';
    try { return cs0Decode(b, o, len); } catch (e) { return ''; }
  }
  function charspec() {
    const out = new Uint8Array(64);
    out.set(enc.encode('OSTA Compressed Unicode'), 1);
    return out;
  }
  function regid(ident, suffix) {
    const out = new Uint8Array(32);
    out.set(enc.encode(ident).slice(0, 23), 1);
    if (suffix) out.set(suffix.slice(0, 8), 24);
    return out;
  }
  const DOMAIN_SUFFIX = [0x02, 0x01, 0x00];         // UDF 1.02, keine Schreibschutz-Flags
  const UDF_SUFFIX = [0x02, 0x01, 0x00, 0x00];      // UDF 1.02, OS-Klasse/-Kennung undefiniert

  function udfTime(d) {
    const out = new Uint8Array(12);
    const tz = -d.getTimezoneOffset();
    const w = W(out);
    w.u16(0, 0x1000 | (tz & 0x0FFF));
    w.u16(2, d.getFullYear());
    out[4] = d.getMonth() + 1; out[5] = d.getDate(); out[6] = d.getHours();
    out[7] = d.getMinutes(); out[8] = d.getSeconds();
    out[9] = Math.floor(d.getMilliseconds() / 10);
    out[10] = (d.getMilliseconds() % 10) * 10;
    return out;
  }

  /* Descriptor-Tag: Prüfsumme und CRC über den Rest des Deskriptors */
  function tag(buf, off, id, location, totalLen) {
    const w = W(buf);
    w.u16(off, id);
    w.u16(off + 2, 2);           // Descriptor Version (NSR02)
    w.u8(off + 5, 0);
    w.u16(off + 6, 1);           // Tag Serial Number
    const crcLen = totalLen - 16;
    w.u16(off + 8, crc16(buf, off + 16, crcLen));
    w.u16(off + 10, crcLen);
    w.u32(off + 12, location);
    let sum = 0;
    for (let i = 0; i < 16; i++) if (i !== 4) sum += buf[off + i];
    buf[off + 4] = sum & 0xFF;
  }
  function tagValid(b, o, id) {
    if (u16(b, o) !== id) return false;
    let sum = 0;
    for (let i = 0; i < 16; i++) if (i !== 4) sum += b[o + i];
    return (sum & 0xFF) === b[o + 4];
  }

  /* ---------------- Lesen ---------------- */

  async function readAt(file, offset, length) {
    const end = Math.min(file.size, offset + length);
    if (offset >= end) return new Uint8Array(length);
    const ab = await file.slice(offset, end).arrayBuffer();
    if (ab.byteLength === length) return new Uint8Array(ab);
    const out = new Uint8Array(length);
    out.set(new Uint8Array(ab), 0);
    return out;
  }
  const readSectors = (file, lba, count) => readAt(file, lba * SECTOR, count * SECTOR);

  /* Bootkatalog nach El Torito 1.0 */
  async function readBootCatalog(file) {
    let catalogLba = -1, pvd = null;
    for (let s = 16; s < 64; s++) {
      const vd = await readSectors(file, s, 1);
      const sig = String.fromCharCode.apply(null, vd.subarray(1, 6));
      if (sig !== 'CD001') break;
      if (vd[0] === 255) break;
      if (vd[0] === 1 && !pvd) pvd = vd;
      if (vd[0] === 0 && String.fromCharCode.apply(null, vd.subarray(7, 30)) === 'EL TORITO SPECIFICATION') catalogLba = u32(vd, 71);
    }
    const isoLabel = pvd ? String.fromCharCode.apply(null, pvd.subarray(40, 72)).replace(/[\s\u0000]+$/, '') : '';
    if (catalogLba < 0) return { isoLabel, entries: [] };

    const cat = await readSectors(file, catalogLba, 2);
    if (cat[0] !== 1 || cat[30] !== 0x55 || cat[31] !== 0xAA) throw isoError('Der Bootkatalog der ISO ist beschädigt.', 'boot');
    const entries = [];
    const entry = (o, platform) => ({
      platform, bootable: cat[o] === 0x88, media: cat[o + 1] & 0x0F,
      loadSeg: u16(cat, o + 2), sysType: cat[o + 4], count: u16(cat, o + 6), lba: u32(cat, o + 8)
    });
    entries.push(entry(32, cat[1]));
    let o = 64;
    while (o + 32 <= cat.length) {
      const h = cat[o];
      if (h !== 0x90 && h !== 0x91) break;
      const platform = cat[o + 1];
      let n = u16(cat, o + 2);
      o += 32;
      while (n-- > 0 && o + 32 <= cat.length) {
        if (cat[o] === 0x88 || cat[o] === 0x00) {
          const e = entry(o, platform);
          const ext = cat[o + 1] & 0x20;
          entries.push(e);
          o += 32;
          /* Erweiterungseinträge (0x44) überspringen */
          if (ext) while (o + 32 <= cat.length && cat[o] === 0x44) { const more = cat[o + 1] & 0x20; o += 32; if (!more) break; }
        } else { o += 32; }
      }
      if (h === 0x91) break;
    }
    for (const e of entries) {
      if (!e.lba) continue;
      e.size = await bootImageSize(file, e);
      e.data = await readAt(file, e.lba * SECTOR, e.size);
    }
    return { isoLabel, entries: entries.filter((e) => e.lba && e.data) };
  }

  /*  Größe eines Bootabbilds. Bei "keine Emulation" steht im Katalog die Zahl
      der 512-Byte-Sektoren - Microsoft trägt für UEFI aber nur 1 ein, die
      Firmware nimmt dann das FAT-Abbild als Ganzes. Deshalb: FAT-Bootsektor
      auswerten, sonst die Zahl aus dem Katalog. */
  async function bootImageSize(file, e) {
    if (e.media === 1) return 1228800;
    if (e.media === 2) return 1474560;
    if (e.media === 3) return 2949120;
    if (e.media === 4) throw isoError('Festplatten-Emulation im Bootkatalog wird nicht unterstützt.', 'boot');
    const first = await readAt(file, e.lba * SECTOR, 512);
    /*  Boot-Info-Tabelle (mkisofs -boot-info-table, z. B. GRUB, isolinux): der
        Lader holt sich den Rest selbst, die Katalogzahl deckt nur den Anfang
        ab. Erkennbar an PVD-Lage 16 und der eigenen Lage an Offset 8/12. */
    if (u32(first, 8) === 16 && u32(first, 12) === e.lba) {
      const len = u32(first, 16);
      if (len >= 512 && len <= 64 * 1024 * 1024) { e.infoTable = true; return len; }
    }
    if (first[510] === 0x55 && first[511] === 0xAA) {
      const bps = u16(first, 11);
      const total = u16(first, 19) || u32(first, 32);
      const size = bps * total;
      if ([512, 1024, 2048, 4096].includes(bps) && size >= 512 && size <= 256 * 1024 * 1024) return size;
    }
    return Math.max(1, e.count) * 512;
  }

  /*  UDF-Baum einlesen. Ergebnis: Liste aus Verzeichnissen und Dateien mit
      Pfad, Größe, Zeitstempel, Rechten und den Extents in der ISO. */
  async function readUdf(file) {
    let avdp = await readSectors(file, 256, 1);
    if (!tagValid(avdp, 0, 2)) {
      const last = Math.floor(file.size / SECTOR) - 1;
      avdp = last > 256 ? await readSectors(file, last, 1) : avdp;
      if (!tagValid(avdp, 0, 2)) {
        throw isoError('Die Datei enthält kein UDF-Dateisystem – das ist keine Windows-Installations-ISO.', 'noudf');
      }
    }
    const vdsLen = u32(avdp, 16), vdsLoc = u32(avdp, 20);
    const vds = await readSectors(file, vdsLoc, Math.min(64, Math.ceil(vdsLen / SECTOR)));
    let part = null, lvd = null, volId = '';
    for (let o = 0; o < vds.length; o += SECTOR) {
      const id = u16(vds, o);
      if (!tagValid(vds, o, id)) continue;
      if (id === 8) break;
      if (id === 1) volId = dstringDecode(vds, o + 24, 32);
      if (id === 5) part = { number: u16(vds, o + 22), start: u32(vds, o + 188), length: u32(vds, o + 192) };
      if (id === 6) lvd = vds.slice(o, o + SECTOR);
    }
    if (!part || !lvd) throw isoError('UDF ohne Partitions- oder Volume-Deskriptor.', 'noudf');
    if (u32(lvd, 212) !== SECTOR) throw isoError('UDF mit Blockgröße ' + u32(lvd, 212) + ' wird nicht unterstützt.', 'unsupported');
    const maps = u32(lvd, 268);
    let mo = 440;
    for (let i = 0; i < maps; i++) {
      if (lvd[mo] !== 1) throw isoError('Diese ISO nutzt UDF 2.x mit Metadaten- oder virtueller Partition (typisch für Brennprogramme). Das wird nicht unterstützt – bitte die Original-ISO von Microsoft verwenden.', 'unsupported');
      mo += lvd[mo + 1];
    }
    const label = dstringDecode(lvd, 84, 128);
    const fsdLbn = u32(lvd, 252);
    const fsd = await readSectors(file, part.start + fsdLbn, 1);
    if (!tagValid(fsd, 0, 256)) throw isoError('UDF: File Set Descriptor fehlt.', 'noudf');
    const fileSetId = dstringDecode(fsd, 304, 32);
    const rootLbn = u32(fsd, 404);

    const abs = (lbn) => part.start + lbn;
    const dirs = [], files = [];
    const seen = new Set();
    const warnings = [];

    async function readFe(lbn) {
      const b = await readSectors(file, abs(lbn), 1);
      const id = u16(b, 0);
      if (!(tagValid(b, 0, 261) || tagValid(b, 0, 266))) throw isoError('UDF: ungültiger File Entry in Block ' + lbn + '.', 'invalid');
      const ext = id === 266;
      if (u16(b, 20) !== 4) throw isoError('UDF: ICB-Strategie ' + u16(b, 20) + ' wird nicht unterstützt.', 'unsupported');
      const fe = {
        fileType: b[27], icbFlags: u16(b, 34),
        uid: u32(b, 36), gid: u32(b, 40), perms: u32(b, 44),
        size: u64(b, 56),
        atime: b.slice(72 + (ext ? 8 : 0), 84 + (ext ? 8 : 0)),
        mtime: b.slice(84 + (ext ? 8 : 0), 96 + (ext ? 8 : 0)),
        attrTime: b.slice(ext ? 116 : 96, ext ? 128 : 108),
        extents: [], inline: null
      };
      const lea = u32(b, ext ? 208 : 168), lad = u32(b, ext ? 212 : 172);
      const adStart = (ext ? 216 : 176) + lea;
      if (adStart + lad > SECTOR) throw isoError('UDF: File Entry in Block ' + lbn + ' ist zu lang.', 'invalid');
      await readAds(b, adStart, lad, fe.icbFlags & 7, fe);
      return fe;
    }

    async function readAds(b, start, len, type, fe) {
      if (type === 3) { fe.inline = b.slice(start, start + len); return; }
      if (type !== 0 && type !== 1) throw isoError('UDF: erweiterte Allocation Descriptors werden nicht unterstützt.', 'unsupported');
      const size = type === 0 ? 8 : 16;
      for (let o = start; o + size <= start + len; o += size) {
        const raw = u32(b, o);
        const length = raw % 0x40000000;
        const kind = Math.floor(raw / 0x40000000);
        const pos = u32(b, o + 4);
        if (type === 1 && u16(b, o + 8) !== 0) throw isoError('UDF: Verweis auf eine zweite Partition.', 'unsupported');
        if (!length) break;
        if (kind === 3) {
          /* Fortsetzung in einem Allocation Extent Descriptor */
          const aed = await readSectors(file, abs(pos), 1);
          if (!tagValid(aed, 0, 258)) throw isoError('UDF: Allocation Extent Descriptor fehlt.', 'invalid');
          await readAds(aed, 24, Math.min(u32(aed, 20), SECTOR - 24), type, fe);
          return;
        }
        fe.extents.push({ pos: kind === 0 ? abs(pos) * SECTOR : -1, len: length });
      }
    }

    async function feData(fe) {
      if (fe.inline) return fe.inline.slice(0, fe.size);
      const out = new Uint8Array(fe.size);
      let p = 0;
      for (const x of fe.extents) {
        const n = Math.min(x.len, fe.size - p);
        if (n <= 0) break;
        if (x.pos >= 0) out.set(await readAt(file, x.pos, n), p);
        p += n;
      }
      return out;
    }

    async function walk(lbn, path, depth) {
      if (depth > 64) throw isoError('UDF: Verzeichnisbaum zu tief.', 'invalid');
      if (seen.has(lbn)) return;
      seen.add(lbn);
      const fe = await readFe(lbn);
      if (fe.size > 64 * 1024 * 1024) throw isoError('UDF: Verzeichnis ' + (path || '\\') + ' ist unplausibel groß.', 'invalid');
      const data = await feData(fe);
      const subdirs = [];
      let o = 0;
      while (o + 38 <= data.length) {
        if (u16(data, o) !== 257) break;
        const chars = data[o + 18], lfi = data[o + 19];
        const icbLbn = u32(data, o + 24);
        const liu = u16(data, o + 36);
        const nameStart = o + 38 + liu;
        const recLen = (38 + liu + lfi + 3) & ~3;
        o += recLen;
        if (chars & 0x0C) continue;           // gelöscht oder Elternverweis
        const name = cs0Decode(data, nameStart, lfi);
        if (!name || /[\\/]/.test(name)) { warnings.push('Ungültiger Name übersprungen in ' + (path || '\\')); continue; }
        const child = await readFe(icbLbn);
        const childPath = path ? path + '/' + name : name;
        const meta = { path: childPath, hidden: !!(chars & 1), mtime: child.mtime, atime: child.atime, attrTime: child.attrTime,
          perms: child.perms, uid: child.uid, gid: child.gid };
        if (child.fileType === 4 || (chars & 2)) {
          dirs.push(meta);
          subdirs.push([icbLbn, childPath]);
        } else if (child.fileType === 5 || child.fileType === 0) {
          meta.size = child.size;
          meta.extents = child.extents;
          meta.inline = child.inline;
          files.push(meta);
        } else {
          warnings.push('Übersprungen (Dateityp ' + child.fileType + '): ' + childPath);
        }
      }
      for (const [l, p] of subdirs) await walk(l, p, depth + 1);
      return fe;
    }

    const rootFe = await walk(rootLbn, '', 0);
    return {
      label, volId, fileSetId, dirs, files, warnings,
      root: { mtime: rootFe.mtime, atime: rootFe.atime, attrTime: rootFe.attrTime, perms: rootFe.perms, uid: rootFe.uid, gid: rootFe.gid }
    };
  }

  /*  Datei als Blob: Extents der Quell-ISO als Ausschnitte, nicht
      aufgezeichnete Bereiche als Nullen. */
  function sourceBlob(file, f) {
    if (f.inline) return new Blob([f.inline.slice(0, f.size)]);
    const parts = [];
    let left = f.size;
    for (const x of f.extents) {
      const n = Math.min(x.len, left);
      if (n <= 0) break;
      parts.push(x.pos >= 0 ? file.slice(x.pos, x.pos + n) : new Uint8Array(n));
      left -= n;
    }
    if (left > 0) parts.push(new Uint8Array(left));
    return new Blob(parts);
  }

  /*  Beschreibung eines WIM/ESD lesen: Der Kopf (208 Byte) verweist auf die
      XML-Daten, die auch in ESD-Dateien unkomprimiert als UTF-16 vorliegen.
      Gelesen werden nur Kopf und XML - wenige Kilobyte, auch bei 6 GB.
      Verschluesselte ESDs und Fremdformate liefern null. */
  async function readWimInfo(blob) {
    try {
      const h = new Uint8Array(await blob.slice(0, 208).arrayBuffer());
      if (String.fromCharCode.apply(null, h.subarray(0, 8)) !== 'MSWIM\u0000\u0000\u0000') return null;
      const xmlOff = u64(h, 80), xmlLen = u64(h, 88);
      if (!xmlLen || xmlLen > 16 * 1024 * 1024 || xmlOff + xmlLen > blob.size) return null;
      const xb = new Uint8Array(await blob.slice(xmlOff, xmlOff + xmlLen).arrayBuffer());
      const xml = new TextDecoder('utf-16le').decode(xb[0] === 0xFF && xb[1] === 0xFE ? xb.subarray(2) : xb);
      const tag = (src, name) => { const m = src.match(new RegExp('<' + name + '>([^<]*)</' + name + '>', 'i')); return m ? m[1].trim() : ''; };
      const images = [];
      const re = /<IMAGE\s+INDEX="(\d+)"[^>]*>([\s\S]*?)<\/IMAGE>/gi;
      let m;
      while ((m = re.exec(xml)) !== null) {
        const b = m[2];
        const arch = { 0: 'x86', 5: 'ARM', 9: 'x64', 12: 'ARM64' }[tag(b, 'ARCH')] || tag(b, 'ARCH');
        const langs = (b.match(/<LANGUAGES>([\s\S]*?)<\/LANGUAGES>/i) || [])[1] || '';
        images.push({
          index: +m[1], name: tag(b, 'DISPLAYNAME') || tag(b, 'NAME'), edition: tag(b, 'EDITIONID'),
          build: +tag(b, 'BUILD') || 0, spbuild: +tag(b, 'SPBUILD') || 0, arch, lang: tag(langs, 'DEFAULT')
        });
      }
      if (!images.length) return null;
      return { images, build: Math.max.apply(null, images.map((i) => i.build)), minBuild: Math.min.apply(null, images.map((i) => i.build)) };
    } catch (e) { return null; }
  }

  async function readIso(file) {
    if (!file || file.size < 300 * SECTOR) throw isoError('Die Datei ist zu klein für eine ISO.', 'noudf');
    const udf = await readUdf(file);
    const boot = await readBootCatalog(file);
    udf.files.forEach((f) => { f.data = sourceBlob(file, f); });
    const find = (p) => udf.files.find((f) => f.path.toLowerCase() === p);
    const image = ['sources/install.wim', 'sources/install.esd', 'sources/install.swm'].map(find).find(Boolean);
    const wim = image ? await readWimInfo(image.data) : null;
    return {
      name: file.name, size: file.size,
      label: udf.label || udf.volId || boot.isoLabel,
      volId: udf.volId, fileSetId: udf.fileSetId, isoLabel: boot.isoLabel,
      root: udf.root, dirs: udf.dirs, files: udf.files, warnings: udf.warnings,
      boot: boot.entries,
      windows: {
        image: image ? image.path : null,
        imageSize: image ? image.size : 0,
        wim,
        bootWim: !!find('sources/boot.wim'),
        efiNoPrompt: find('efi/microsoft/boot/efisys_noprompt.bin') || null,
        bootfix: find('boot/bootfix.bin') || null
      }
    };
  }

  /* ---------------- Schreiben ---------------- */

  const README_TXT = 'This disc contains a "UDF" file system and requires an operating system\r\n' +
    'that supports the ISO-13346 "UDF" file system specification.\r\n';

  function isoDate17(d) {
    const p = (n, l) => String(n).padStart(l, '0');
    const s = p(d.getFullYear(), 4) + p(d.getMonth() + 1, 2) + p(d.getDate(), 2) +
      p(d.getHours(), 2) + p(d.getMinutes(), 2) + p(d.getSeconds(), 2) + p(Math.floor(d.getMilliseconds() / 10), 2);
    const out = new Uint8Array(17);
    for (let i = 0; i < 16; i++) out[i] = s.charCodeAt(i);
    out[16] = Math.round(-d.getTimezoneOffset() / 15) & 0xFF;
    return out;
  }
  function isoDate7(d) {
    return new Uint8Array([d.getFullYear() - 1900, d.getMonth() + 1, d.getDate(), d.getHours(),
      d.getMinutes(), d.getSeconds(), Math.round(-d.getTimezoneOffset() / 15) & 0xFF]);
  }
  function isoDirRecord(name, lba, size, isDir, d) {
    const nb = typeof name === 'number' ? new Uint8Array([name]) : enc.encode(name);
    const len = 33 + nb.length + ((33 + nb.length) % 2);
    const r = new Uint8Array(len);
    const w = W(r);
    r[0] = len;
    w.both32(2, lba); w.both32(10, size);
    r.set(isoDate7(d), 18);
    r[25] = isDir ? 2 : 0;
    w.both16(28, 1);
    r[32] = nb.length;
    r.set(nb, 33);
    return r;
  }
  function isoLabelChars(s) {
    return String(s || 'WINDOWS').toUpperCase().replace(/[^A-Z0-9_.-]/g, '_').slice(0, 32);
  }

  /* Boot-Info-Tabelle auf die neue Lage umschreiben (wie mkisofs/xorriso). */
  function patchInfoTable(img, lba, len) {
    const w = W(img);
    w.u32(8, 16); w.u32(12, lba); w.u32(16, len);
    let sum = 0;
    for (let i = 64; i + 4 <= len; i += 4) sum = (sum + u32(img, i)) >>> 0;
    w.u32(20, sum);
  }

  /*  Dateibaum aufbauen. entries: { path, data (Blob|Uint8Array|String),
      size?, hidden?, mtime?, perms? }; Verzeichnisse entstehen automatisch,
      dirs liefert optional ihre Metadaten. */
  function buildTree(entries, dirMeta, rootMeta) {
    const mk = (name, isDir, meta) => ({ name, isDir, meta: meta || {}, children: isDir ? new Map() : null });
    const root = mk('', true, rootMeta);
    const metaByPath = new Map((dirMeta || []).map((d) => [d.path.toLowerCase(), d]));
    const dirFor = (parts) => {
      let node = root, path = '';
      for (const p of parts) {
        path = path ? path + '/' + p : p;
        const key = p.toLowerCase();
        let next = node.children.get(key);
        if (!next) { next = mk(p, true, metaByPath.get(path.toLowerCase())); node.children.set(key, next); }
        if (!next.isDir) throw isoError('Pfad ist zugleich Datei und Ordner: ' + path, 'conflict');
        node = next;
      }
      return node;
    };
    (dirMeta || []).forEach((d) => dirFor(d.path.split('/')));
    for (const e of entries) {
      const parts = e.path.replace(/\\/g, '/').split('/').filter(Boolean);
      const name = parts.pop();
      const dir = dirFor(parts);
      const key = name.toLowerCase();
      const old = dir.children.get(key);
      if (old && old.isDir) throw isoError('Pfad ist zugleich Datei und Ordner: ' + e.path, 'conflict');
      const node = mk(name, false, e);
      node.data = e.data;
      dir.children.set(key, node);
    }
    return root;
  }

  function dataBytes(d) {
    if (typeof Blob !== 'undefined' && d instanceof Blob) return d;
    if (d instanceof Uint8Array) return d;
    if (d instanceof ArrayBuffer) return new Uint8Array(d);
    return enc.encode(String(d === undefined || d === null ? '' : d));
  }
  const sizeOf = (d) => (d instanceof Uint8Array ? d.length : d.size);

  /*  Neue ISO zusammensetzen.
      opts: { label, isoLabel, fileSetId, files, dirs, root, boot: [{platform,
      bootable, media, loadSeg, sysType, count, data}], date }
      Ergebnis: Blob mit .isoParts/.isoLabels zum stückweisen Schreiben. */
  function buildIso(opts) {
    const now = opts.date || new Date();
    const nowUdf = udfTime(now);
    const files = opts.files || [];
    const tree = buildTree(files, opts.dirs, opts.root);
    const defPerm = { file: opts.filePerms || 0x14A5, dir: opts.dirPerms || 0x14A5 };
    /* nur fuer tools/test-iso.js: kleine Extents, um die Aufteilung zu pruefen */
    const maxExtent = opts.maxExtent || MAX_EXTENT;

    /* Knoten in Breitensuche durchnummerieren */
    const dirsList = [], fileList = [];
    let uid = 16;
    const queue = [tree];
    tree.uid = 0;
    while (queue.length) {
      const d = queue.shift();
      dirsList.push(d);
      const kids = Array.from(d.children.values()).sort((a, b) => (a.name.toUpperCase() < b.name.toUpperCase() ? -1 : 1));
      d.sorted = kids;
      for (const k of kids) {
        k.uid = uid++;
        k.parent = d;
        if (k.isDir) queue.push(k);
        else { k.bytes = dataBytes(k.data); k.size = sizeOf(k.bytes); fileList.push(k); }
      }
    }

    /*  Verzeichnisinhalte (File Identifier Descriptors) vorab anordnen.
        Kein Eintrag soll über eine Blockgrenze reichen - die Norm erlaubt es,
        schlanke Leser wie der Bootmanager rechnen aber blockweise. Wie bei
        Microsoft trägt jeder Eintrag im Feld Implementation Use eine
        Kennung (32 Byte); passt der nächste nicht mehr in den Block, wird
        dieses Feld beim vorherigen um den Rest des Blocks verlängert. */
    const fidLen = (liu, nameBytes) => (38 + liu + nameBytes + 3) & ~3;
    for (const d of dirsList) {
      const list = [{ target: d.parent || d, chars: 0x0A, name: null, liu: FID_IU }];
      for (const k of d.sorted) {
        k.nameCs0 = cs0Encode(k.name);
        if (k.nameCs0.length > 255) throw isoError('Name zu lang: ' + k.name, 'name');
        list.push({ target: k, chars: (k.isDir ? 2 : 0) | ((k.meta && k.meta.hidden) ? 1 : 0), name: k.nameCs0, liu: FID_IU });
      }
      let pos = 0;
      list.forEach((x, i) => {
        const len = fidLen(x.liu, x.name ? x.name.length : 0);
        const room = SECTOR - (pos % SECTOR);
        if (len > room && i > 0) { list[i - 1].liu += room; pos += room; }
        x.pos = pos;
        pos += len;
      });
      d.fids = list;
      d.size = pos;
    }

    /* ---- Lage festlegen ---- */
    const bootImgs = (opts.boot || []).map((b) => Object.assign({}, b));
    let next = opts.bootStart || 258;            // bootStart nur fuer tools/test-iso.js
    for (const b of bootImgs) { b.lba = next; next += Math.ceil(b.data.length / SECTOR); next += next % 2; }
    const P = Math.ceil(Math.max(next, 272) / 16) * 16;     // Partitionsbeginn
    let lbn = 2;                                            // 0 = FSD, 1 = Terminator
    for (const d of dirsList) { d.fe = lbn++; d.dataLbn = lbn; lbn += Math.ceil(d.size / SECTOR); }
    for (const f of fileList) f.fe = lbn++;
    for (const f of fileList) {
      if (!f.size) { f.dataLbn = 0; continue; }
      while ((P + lbn) % ALIGN) lbn++;
      f.dataLbn = lbn;
      lbn += Math.ceil(f.size / SECTOR);
      const extents = Math.ceil(f.size / maxExtent);
      if (176 + extents * 8 > SECTOR) throw isoError('Datei zu groß für UDF 1.02: ' + f.name, 'size');
    }
    const L = lbn;                                          // Partitionslänge
    const N = P + L + 1;                                    // letzter Sektor: zweiter Anker

    /* ---- Systembereich und ISO 9660 (Sektoren 0-255) ---- */
    const head = new Uint8Array(256 * SECTOR);
    const hw = W(head);
    const isoLabel = isoLabelChars(opts.isoLabel || opts.label);
    /* Ohne Bootkatalog rückt die Sequenz nach - eine Lücke beendet die
       Volume Recognition Sequence vorzeitig. */
    const S_PVD = 16, S_BOOTREC = 17, S_TERM = bootImgs.length ? 18 : 17;
    const S_BEA = S_TERM + 1, S_NSR = S_TERM + 2, S_TEA = S_TERM + 3;
    const S_CAT = 22, S_ROOT = 23, S_LPT = 24, S_MPT = 25, S_README = 26;
    const S_VDS = 32, S_RVDS = 48, S_LVID = 64;

    let o = S_PVD * SECTOR;
    head[o] = 1; hw.ascii(o + 1, 'CD001', 5); head[o + 6] = 1;
    hw.ascii(o + 8, '', 32);
    hw.ascii(o + 40, isoLabel, 32);
    hw.both32(o + 80, N);
    hw.both16(o + 120, 1); hw.both16(o + 124, 1); hw.both16(o + 128, SECTOR);
    hw.both32(o + 132, 10);
    hw.u32(o + 140, S_LPT); hw.be32(o + 148, S_MPT);
    head.set(isoDirRecord(0, S_ROOT, SECTOR, true, now), o + 156);
    hw.ascii(o + 190, '', 128); hw.ascii(o + 318, '', 128); hw.ascii(o + 446, '', 128);
    hw.ascii(o + 574, 'OEM SCRIPT GENERATOR', 128);
    hw.ascii(o + 702, '', 37); hw.ascii(o + 739, '', 37); hw.ascii(o + 776, '', 37);
    head.set(isoDate17(now), o + 813); head.set(isoDate17(now), o + 830);
    hw.ascii(o + 847, '0000000000000000', 16, 0x30); hw.ascii(o + 864, '0000000000000000', 16, 0x30);
    head[o + 881] = 1;

    if (bootImgs.length) {
      o = S_BOOTREC * SECTOR;
      head[o] = 0; hw.ascii(o + 1, 'CD001', 5); head[o + 6] = 1;
      hw.ascii(o + 7, 'EL TORITO SPECIFICATION', 32, 0);
      hw.u32(o + 71, S_CAT);
    }
    o = S_TERM * SECTOR;
    head[o] = 255; hw.ascii(o + 1, 'CD001', 5); head[o + 6] = 1;
    for (const [s, id] of [[S_BEA, 'BEA01'], [S_NSR, 'NSR02'], [S_TEA, 'TEA01']]) {
      o = s * SECTOR; head[o] = 0; hw.ascii(o + 1, id, 5); head[o + 6] = 1;
    }

    /* Bootkatalog: erster Eintrag = Vorgabe, weitere in Abschnitten je Plattform */
    if (bootImgs.length) {
      o = S_CAT * SECTOR;
      head[o] = 1; head[o + 1] = bootImgs[0].platform;
      head[o + 30] = 0x55; head[o + 31] = 0xAA;
      let sum = 0;
      for (let i = 0; i < 32; i += 2) sum += u16(head, o + i);
      hw.u16(o + 28, (0x10000 - (sum & 0xFFFF)) & 0xFFFF);
      const putEntry = (at, b) => {
        head[at] = b.bootable === false ? 0 : 0x88; head[at + 1] = b.media || 0;
        hw.u16(at + 2, b.loadSeg || 0); head[at + 4] = b.sysType || 0;
        hw.u16(at + 6, b.count); hw.u32(at + 8, b.lba);
      };
      putEntry(o + 32, bootImgs[0]);
      let at = o + 64;
      const rest = bootImgs.slice(1);
      const groups = [];
      rest.forEach((b) => {
        const g = groups.find((x) => x.platform === b.platform);
        if (g) g.items.push(b); else groups.push({ platform: b.platform, items: [b] });
      });
      groups.forEach((g, gi) => {
        head[at] = gi === groups.length - 1 ? 0x91 : 0x90;
        head[at + 1] = g.platform;
        hw.u16(at + 2, g.items.length);
        at += 32;
        g.items.forEach((b) => { putEntry(at, b); at += 32; });
      });
      if (at > (S_CAT + 1) * SECTOR) throw isoError('Zu viele Booteinträge.', 'boot');
    }

    /* ISO-9660-Wurzel mit README.TXT, Pfadtabellen */
    const readme = enc.encode(README_TXT);
    o = S_ROOT * SECTOR;
    let r = isoDirRecord(0, S_ROOT, SECTOR, true, now); head.set(r, o); o += r.length;
    r = isoDirRecord(1, S_ROOT, SECTOR, true, now); head.set(r, o); o += r.length;
    r = isoDirRecord('README.TXT;1', S_README, readme.length, false, now); head.set(r, o);
    o = S_LPT * SECTOR; head[o] = 1; hw.u32(o + 2, S_ROOT); hw.u16(o + 6, 1);
    o = S_MPT * SECTOR; head[o] = 1; hw.be32(o + 2, S_ROOT); hw.be16(o + 6, 1);
    head.set(readme, S_README * SECTOR);

    /* ---- UDF: Volume Descriptor Sequence (Haupt- und Reservekopie) ---- */
    const label = opts.label || isoLabel;
    const volSetId = (now.getTime() >>> 0).toString(16).toUpperCase().padStart(8, '0') +
      Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0') + label;
    function writeVds(base) {
      let s = base;
      /* Primary Volume Descriptor */
      let p = s * SECTOR;
      hw.u32(p + 16, 0); hw.u32(p + 20, 0);
      head.set(dstring(opts.volId || label, 32), p + 24);
      hw.u16(p + 56, 1); hw.u16(p + 58, 1); hw.u16(p + 60, 2); hw.u16(p + 62, 2);
      hw.u32(p + 64, 1); hw.u32(p + 68, 1);
      head.set(dstring(volSetId, 128), p + 72);
      head.set(charspec(), p + 200); head.set(charspec(), p + 264);
      head.set(regid(IMPL_ID), p + 344);
      head.set(nowUdf, p + 376);
      head.set(regid(IMPL_ID), p + 388);
      tag(head, p, 1, s, 512); s++;
      /* Implementation Use Volume Descriptor */
      p = s * SECTOR;
      hw.u32(p + 16, 1);
      head.set(regid('*UDF LV Info', UDF_SUFFIX), p + 20);
      head.set(charspec(), p + 52);
      head.set(dstring(label, 128), p + 116);
      head.set(regid(IMPL_ID), p + 352);
      tag(head, p, 4, s, 512); s++;
      /* Partition Descriptor */
      p = s * SECTOR;
      hw.u32(p + 16, 2); hw.u16(p + 20, 1); hw.u16(p + 22, 0);
      head.set(regid('+NSR02'), p + 24);
      hw.u32(p + 184, 1);                 // nur lesen
      hw.u32(p + 188, P); hw.u32(p + 192, L);
      head.set(regid(IMPL_ID), p + 196);
      tag(head, p, 5, s, 512); s++;
      /* Logical Volume Descriptor */
      p = s * SECTOR;
      hw.u32(p + 16, 3);
      head.set(charspec(), p + 20);
      head.set(dstring(label, 128), p + 84);
      hw.u32(p + 212, SECTOR);
      head.set(regid('*OSTA UDF Compliant', DOMAIN_SUFFIX), p + 216);
      hw.u32(p + 248, SECTOR); hw.u32(p + 252, 0); hw.u16(p + 256, 0);   // FSD
      hw.u32(p + 264, 6); hw.u32(p + 268, 1);
      head.set(regid(IMPL_ID), p + 272);
      hw.u32(p + 432, 2 * SECTOR); hw.u32(p + 436, S_LVID);
      head[p + 440] = 1; head[p + 441] = 6; hw.u16(p + 442, 1); hw.u16(p + 444, 0);
      tag(head, p, 6, s, 446); s++;
      /* Unallocated Space Descriptor */
      p = s * SECTOR;
      hw.u32(p + 16, 4); hw.u32(p + 20, 0);
      tag(head, p, 7, s, 24); s++;
      /* Terminating Descriptor */
      p = s * SECTOR;
      tag(head, p, 8, s, 512);
    }
    writeVds(S_VDS);
    writeVds(S_RVDS);

    /* Logical Volume Integrity Descriptor */
    o = S_LVID * SECTOR;
    head.set(nowUdf, o + 16);
    hw.u32(o + 28, 1);                     // geschlossen
    hw.u64(o + 40, uid);                   // nächste Unique ID
    hw.u32(o + 72, 1); hw.u32(o + 76, 46);
    hw.u32(o + 80, 0); hw.u32(o + 84, L);
    head.set(regid(IMPL_ID), o + 88);
    hw.u32(o + 120, fileList.length); hw.u32(o + 124, dirsList.length);
    hw.u16(o + 128, 0x0102); hw.u16(o + 130, 0x0102); hw.u16(o + 132, 0x0102);
    tag(head, o, 9, S_LVID, 134);
    tag(head, o + SECTOR, 8, S_LVID + 1, 512);

    /* ---- Anker ---- */
    function anchor(loc) {
      const a = new Uint8Array(SECTOR);
      const w = W(a);
      w.u32(16, 16 * SECTOR); w.u32(20, S_VDS);
      w.u32(24, 16 * SECTOR); w.u32(28, S_RVDS);
      tag(a, 0, 2, loc, 512);
      return a;
    }

    /* ---- Partition: FSD, File Entries, Verzeichnisdaten ---- */
    const metaLen = (fileList.length ? fileList[fileList.length - 1].fe + 1 : L);
    const meta = new Uint8Array(metaLen * SECTOR);
    const mw = W(meta);
    o = 0;
    meta.set(nowUdf, o + 16);
    mw.u16(o + 28, 3); mw.u16(o + 30, 3); mw.u32(o + 32, 1); mw.u32(o + 36, 1);
    meta.set(charspec(), o + 48);
    meta.set(dstring(label, 128), o + 112);
    meta.set(charspec(), o + 240);
    meta.set(dstring(opts.fileSetId || label, 32), o + 304);
    mw.u32(o + 400, SECTOR); mw.u32(o + 404, tree.fe); mw.u16(o + 408, 0);
    meta.set(regid('*OSTA UDF Compliant', DOMAIN_SUFFIX), o + 416);
    tag(meta, 0, 256, 0, 512);
    tag(meta, SECTOR, 8, 1, 512);

    const tsOr = (x) => (x instanceof Uint8Array && x.length === 12 && u16(x, 2) ? x : null);
    function fileEntry(node, isDir, size, extents) {
      const p = node.fe * SECTOR;
      const m = node.meta || {};
      mw.u32(p + 16, 0); mw.u16(p + 20, 4); mw.u16(p + 24, 1);
      meta[p + 27] = isDir ? 4 : 5;
      mw.u16(p + 34, 0);                  // short_ad
      mw.u32(p + 36, m.uid === undefined ? 0xFFFFFFFF : m.uid);
      mw.u32(p + 40, m.gid === undefined ? 0xFFFFFFFF : m.gid);
      mw.u32(p + 44, m.perms || (isDir ? defPerm.dir : defPerm.file));
      mw.u16(p + 48, isDir ? 1 + node.sorted.filter((k) => k.isDir).length : 1);
      mw.u64(p + 56, size);
      mw.u64(p + 64, Math.ceil(size / SECTOR));
      const mt = tsOr(m.mtime) || (m.date instanceof Date ? udfTime(m.date) : nowUdf);
      meta.set(tsOr(m.atime) || mt, p + 72);
      meta.set(mt, p + 84);
      meta.set(tsOr(m.attrTime) || mt, p + 96);
      mw.u32(p + 108, 1);
      meta.set(regid(IMPL_ID), p + 128);
      mw.u64(p + 160, node.uid);
      mw.u32(p + 168, 0);
      mw.u32(p + 172, extents.length * 8);
      extents.forEach((x, i) => { mw.u32(p + 176 + i * 8, x.len); mw.u32(p + 180 + i * 8, x.pos); });
      tag(meta, p, 261, node.fe, 176 + extents.length * 8);
    }
    const splitExtents = (start, size) => {
      const out = [];
      let pos = start, left = size;
      while (left > 0) {
        const n = Math.min(left, maxExtent);
        out.push({ pos, len: n });
        pos += n / SECTOR; left -= n;
      }
      return out;
    };

    for (const d of dirsList) {
      fileEntry(d, true, d.size, splitExtents(d.dataLbn, d.size));
      const iu = regid(IMPL_ID);
      for (const x of d.fids) {
        const p = d.dataLbn * SECTOR + x.pos;
        const nlen = x.name ? x.name.length : 0;
        mw.u16(p + 16, 1);
        meta[p + 18] = x.chars;
        meta[p + 19] = nlen;
        mw.u32(p + 20, SECTOR); mw.u32(p + 24, x.target.fe); mw.u16(p + 28, 0);
        mw.u32(p + 32, x.target.uid);     // UDF Unique ID (untere 32 Bit)
        mw.u16(p + 36, x.liu);
        meta.set(iu, p + 38);
        if (x.name) meta.set(x.name, p + 38 + x.liu);
        tag(meta, p, 257, Math.floor(p / SECTOR), fidLen(x.liu, nlen));
      }
    }
    for (const f of fileList) fileEntry(f, false, f.size, f.size ? splitExtents(f.dataLbn, f.size) : []);

    /* ---- Teile in Schreibreihenfolge ---- */
    const parts = [], labels = [];
    const push = (x, label) => { parts.push(x); labels.push(label || ''); };
    let pos = 0;                                    // in Sektoren
    const pad = (toSector) => {
      if (toSector < pos) throw isoError('Interner Fehler beim Anordnen der ISO.', 'internal');
      if (toSector > pos) push(new Uint8Array((toSector - pos) * SECTOR));
      pos = toSector;
    };
    push(head); pos = 256;
    push(anchor(256)); pos = 257;
    for (const b of bootImgs) {
      pad(b.lba);
      const n = Math.ceil(b.data.length / SECTOR);
      const img = new Uint8Array(n * SECTOR); img.set(b.data);
      if (b.infoTable) patchInfoTable(img, b.lba, b.data.length);
      push(img, 'Bootabbild'); pos += n;
    }
    pad(P);
    push(meta, 'UDF-Verwaltungsdaten'); pos += metaLen;
    const relPath = (node) => { const a = []; for (let x = node; x && x.parent; x = x.parent) a.unshift(x.name); return a.join('/'); };
    for (const f of fileList) {
      if (!f.size) continue;
      pad(P + f.dataLbn);
      push(f.bytes, relPath(f));
      const n = Math.ceil(f.size / SECTOR);
      const tail = n * SECTOR - f.size;
      if (tail) push(new Uint8Array(tail));
      pos += n;
    }
    pad(P + L);
    push(anchor(N - 1)); pos++;

    const blob = new Blob(parts);
    if (blob.size !== N * SECTOR) throw isoError('Interner Fehler: ISO-Größe ' + blob.size + ' statt ' + N * SECTOR + '.', 'internal');
    blob.isoParts = parts;
    blob.isoLabels = labels;
    blob.isoStats = { sectors: N, files: fileList.length, dirs: dirsList.length, boot: bootImgs.length };
    return blob;
  }

  global.IsoImage = { readIso, buildIso, readWimInfo, crc16, SECTOR };
})(typeof window !== 'undefined' ? window : globalThis);
