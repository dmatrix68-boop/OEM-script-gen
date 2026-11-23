#!/usr/bin/env node
/*  Prueft js/iso.js ohne Browser:

      node tools/test-iso.js [Arbeitsordner]

    1. Baut eine synthetische "Windows-ISO" mit BIOS- und UEFI-Bootabbild,
       verschachtelten Ordnern, Umlauten, leeren und versteckten Dateien und
       einer Datei, die ueber mehrere Extents verteilt ist.
    2. Liest sie mit IsoImage.readIso zurueck und vergleicht Inhalt, Boot-
       eintraege und Metadaten.
    3. Baut daraus eine zweite ISO wie die Oberflaeche (Quelle + neue Dateien,
       $OEM$ ersetzt) und prueft auch diese.
    4. Wenn vorhanden: Gegenprobe mit 7-Zip (Liste + Pruefsummen) und udfinfo
       - beides unabhaengige UDF-Implementierungen.

    Ohne Arbeitsordner wird ein temporaerer Ordner verwendet und geloescht. */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

require(path.join(__dirname, '..', 'js', 'iso.js'));
const Iso = globalThis.IsoImage;

const keep = !!process.argv[2];
const work = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'oem-iso-'));
fs.mkdirSync(work, { recursive: true });
const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function rnd(n, seed) {
  const out = Buffer.alloc(n);
  let x = seed >>> 0 || 1;
  for (let i = 0; i < n; i++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out[i] = x & 0xFF; }
  return out;
}

/* FAT12-Bootsektor fuer ein 1,44-MB-Abbild - genug fuer die Groessenerkennung */
function fakeEfiImage() {
  const img = Buffer.alloc(1474560);
  img[0] = 0xEB; img[1] = 0x3C; img[2] = 0x90;
  img.write('MSDOS5.0', 3, 'ascii');
  img.writeUInt16LE(512, 11); img[13] = 1; img.writeUInt16LE(1, 14); img[16] = 2;
  img.writeUInt16LE(224, 17); img.writeUInt16LE(2880, 19); img[21] = 0xF0;
  img[510] = 0x55; img[511] = 0xAA;
  rnd(4000, 7).copy(img, 2048);
  return img;
}

async function writeBlob(blob, file) {
  const fd = fs.openSync(file, 'w');
  try {
    for (const part of blob.isoParts) {
      if (part instanceof Uint8Array) { fs.writeSync(fd, part); continue; }
      const reader = part.stream().getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        fs.writeSync(fd, value);
      }
    }
  } finally { fs.closeSync(fd); }
}

async function blobBytes(b) { return Buffer.from(await b.arrayBuffer()); }

async function main() {
  const bios = rnd(4096, 3);
  const efi = fakeEfiImage();
  const big = rnd(3 * 65536 + 1234, 11);
  const srcFiles = [
    { path: 'bootmgr', data: rnd(400000, 1) },
    { path: 'boot/etfsboot.com', data: bios },
    { path: 'boot/bootfix.bin', data: rnd(1024, 2) },
    { path: 'efi/microsoft/boot/efisys.bin', data: efi },
    { path: 'efi/microsoft/boot/efisys_noprompt.bin', data: fakeEfiImage() },
    { path: 'sources/install.wim', data: big },
    { path: 'sources/boot.wim', data: rnd(70000, 5) },
    { path: 'sources/de-de/setup.exe.mui', data: rnd(5000, 6) },
    { path: 'sources/$OEM$/$1/alt.txt', data: 'alte Datei - muss verschwinden' },
    { path: 'support/leer.txt', data: '' },
    { path: 'Größe/Übung ä ö ü.txt', data: 'Umlaute im Namen' },
    { path: 'unicode/日本語.txt', data: 'UTF-16 im Namen' },
    { path: 'versteckt.dat', data: 'hidden', hidden: true },
    { path: 'autorun.inf', data: '[AutoRun.Amd64]\r\nopen=setup.exe\r\n' }
  ];
  /* Viele Eintraege mit wechselnder Namenslaenge: Verzeichnis ueber mehrere Bloecke */
  for (let i = 0; i < 300; i++) {
    srcFiles.push({ path: 'sources/viele/' + 'datei-' + i + '-' + 'x'.repeat(i % 37) + (i % 5 ? '.dll' : '.mui'), data: 'Nr. ' + i });
  }
  const opts1 = {
    label: 'CCCOMA_X64FRE_DE-DE_DV9', isoLabel: 'CCCOMA_X64FRE_DE-DE_DV9',
    files: srcFiles.map((f) => ({ path: f.path, data: new Uint8Array(f.data.buffer ? f.data : Buffer.from(f.data)), hidden: f.hidden })),
    dirs: [{ path: 'leerer-ordner' }],
    boot: [
      { platform: 0, bootable: true, media: 0, loadSeg: 0, sysType: 0, count: 8, data: bios },
      { platform: 0xEF, bootable: true, media: 0, loadSeg: 0, sysType: 0, count: 1, data: efi }
    ],
    maxExtent: 65536
  };
  const iso1 = Iso.buildIso(opts1);
  const f1 = path.join(work, 'quelle.iso');
  await writeBlob(iso1, f1);
  console.log('Quelle: ' + f1 + ' (' + iso1.size + ' Bytes, ' + iso1.isoStats.files + ' Dateien)');

  /* ---- Zuruecklesen ---- */
  const src = await Iso.readIso(await fs.openAsBlob(f1));
  check(src.label === opts1.label, 'Label: ' + src.label);
  check(src.isoLabel === opts1.isoLabel, 'ISO-Label: ' + src.isoLabel);
  check(src.files.length === srcFiles.length, 'Dateianzahl ' + src.files.length + ' statt ' + srcFiles.length);
  check(src.dirs.some((d) => d.path === 'leerer-ordner'), 'leerer Ordner fehlt');
  check(src.windows.image === 'sources/install.wim', 'install.wim nicht erkannt');
  check(src.windows.bootWim, 'boot.wim nicht erkannt');
  check(src.windows.efiNoPrompt, 'efisys_noprompt.bin nicht erkannt');
  for (const f of srcFiles) {
    const got = src.files.find((x) => x.path === f.path);
    if (!got) { problems.push('fehlt: ' + f.path); continue; }
    const want = Buffer.from(f.data);
    const have = await blobBytes(got.data);
    check(have.equals(want), 'Inhalt falsch: ' + f.path);
    check(!!got.hidden === !!f.hidden, 'Versteckt-Kennzeichen falsch: ' + f.path);
  }
  const wim = src.files.find((x) => x.path === 'sources/install.wim');
  check(wim.extents.length === Math.ceil(big.length / 65536), 'install.wim: ' + wim.extents.length + ' Extents');
  check(src.boot.length === 2, 'Booteintraege: ' + src.boot.length);
  check(src.boot[0] && Buffer.from(src.boot[0].data).equals(bios) && src.boot[0].count === 8, 'BIOS-Bootabbild falsch');
  check(src.boot[1] && src.boot[1].platform === 0xEF && src.boot[1].data.length === efi.length &&
    Buffer.from(src.boot[1].data).equals(efi) && src.boot[1].count === 1, 'UEFI-Bootabbild falsch (Groesse aus FAT-Bootsektor)');

  /* ---- Zweite ISO wie die Oberflaeche ---- */
  const drop = /^(\$oem\$|sources\/\$oem\$|\$winpedriver\$)(\/|$)|^autounattend\.xml$/i;
  const added = [
    { path: 'autounattend.xml', data: '<?xml version="1.0"?><unattend/>' },
    { path: 'sources/$OEM$/$1/Install/Install.ps1', data: '﻿Write-Host "Hallo"' },
    { path: '$OEM$/$1/Install/Install.ps1', data: '﻿Write-Host "Hallo"' },
    { path: '$WinPEDriver$/nvme/nvme.inf', data: rnd(3000, 9) },
    { path: '$WinPEDriver$/nvme/nvme.dll', data: new Blob([rnd(5000, 10)]) }
  ];
  const keepFiles = src.files.filter((f) => !drop.test(f.path));
  const opts2 = {
    label: src.label, isoLabel: src.isoLabel, volId: src.volId, fileSetId: src.fileSetId,
    root: src.root, dirs: src.dirs.filter((d) => !drop.test(d.path)),
    files: keepFiles.concat(added.map((a) => ({ path: a.path, data: a.data }))),
    boot: src.boot
  };
  const iso2 = Iso.buildIso(opts2);
  const f2 = path.join(work, 'neu.iso');
  await writeBlob(iso2, f2);
  console.log('Neu:    ' + f2 + ' (' + iso2.size + ' Bytes, ' + iso2.isoStats.files + ' Dateien)');

  const res = await Iso.readIso(await fs.openAsBlob(f2));
  check(!res.files.some((f) => f.path === 'sources/$OEM$/$1/alt.txt'), 'alter $OEM$-Inhalt noch vorhanden');
  check(res.files.length === keepFiles.length + added.length, 'Dateianzahl neu: ' + res.files.length);
  for (const a of added) {
    const got = res.files.find((x) => x.path === a.path);
    if (!got) { problems.push('neu fehlt: ' + a.path); continue; }
    const want = a.data instanceof Blob ? await blobBytes(a.data) : Buffer.from(a.data instanceof Uint8Array ? a.data : Buffer.from(String(a.data), 'utf8'));
    check((await blobBytes(got.data)).equals(want), 'neu, Inhalt falsch: ' + a.path);
  }
  const wim2 = res.files.find((x) => x.path === 'sources/install.wim');
  check(wim2 && (await blobBytes(wim2.data)).equals(big), 'install.wim nach dem Neuschreiben falsch');
  check(res.boot.length === 2 && Buffer.from(res.boot[1].data).equals(efi), 'Bootabbilder nach dem Neuschreiben falsch');
  /* Jede Datei beginnt auf 4 KB */
  for (const f of res.files) {
    if (f.extents.length && f.extents[0].pos % 4096) problems.push('nicht auf 4 KB ausgerichtet: ' + f.path);
  }

  /* Kein Verzeichniseintrag ueber eine Blockgrenze (der Bootmanager liest blockweise) */
  {
    const raw = fs.readFileSync(f2);
    let fids = 0;
    for (let o = 0; o + 38 <= raw.length; o += 4) {
      if (raw.readUInt16LE(o) !== 257 || raw.readUInt16LE(o + 2) !== 2) continue;
      let sum = 0;
      for (let i = 0; i < 16; i++) if (i !== 4) sum += raw[o + i];
      if ((sum & 0xFF) !== raw[o + 4]) continue;
      const len = (38 + raw.readUInt16LE(o + 36) + raw[o + 19] + 3) & ~3;
      fids++;
      if ((o % 2048) + len > 2048) problems.push('Verzeichniseintrag ueber Blockgrenze bei Byte ' + o);
      if (raw.readUInt16LE(o + 8) !== Iso.crc16(raw, o + 16, len - 16)) problems.push('CRC falsch: Verzeichniseintrag bei Byte ' + o);
    }
    check(fids > res.files.length, 'zu wenige Verzeichniseintraege gefunden: ' + fids);
  }

  /* ---- Gegenprobe mit unabhaengigen Werkzeugen ---- */
  const have = (cmd) => { try { execFileSync('sh', ['-c', 'command -v ' + cmd], { stdio: 'ignore' }); return true; } catch (e) { return false; } };
  if (have('udfinfo')) {
    const out = execFileSync('udfinfo', [f2], { encoding: 'utf8' });
    check(/label=CCCOMA_X64FRE_DE-DE_DV9/.test(out), 'udfinfo: Label fehlt');
    check(/udfrev=1\.02/.test(out), 'udfinfo: UDF-Revision nicht 1.02');
    console.log('udfinfo: ok');
  } else console.log('udfinfo: nicht installiert, uebersprungen');
  if (have('7z')) {
    const out = path.join(work, 'x7z');
    fs.rmSync(out, { recursive: true, force: true });
    execFileSync('7z', ['x', '-y', '-o' + out, f2], { stdio: 'ignore' });
    for (const f of res.files) {
      const p = path.join(out, ...f.path.split('/'));
      if (!fs.existsSync(p)) { problems.push('7-Zip: fehlt ' + f.path); continue; }
      const want = await blobBytes(f.data);
      check(sha(fs.readFileSync(p)) === sha(want), '7-Zip: Inhalt weicht ab: ' + f.path);
    }
    check(!fs.existsSync(path.join(out, 'README.TXT')), '7-Zip liest ISO 9660 statt UDF');
    console.log('7-Zip: ' + res.files.length + ' Dateien verglichen');
  } else console.log('7-Zip: nicht installiert, uebersprungen');

  if (!keep) fs.rmSync(work, { recursive: true, force: true });
  if (problems.length) {
    problems.forEach((p) => console.error('  ' + p));
    console.error('test-iso: ' + problems.length + ' Fehler.');
    process.exit(1);
  }
  console.log('test-iso: alles in Ordnung.');
}

main().catch((e) => { console.error(e); process.exit(1); });
