#!/usr/bin/env node
/*  Prueft den .reg-Import (Importers.parseReg) und die erzeugten
    PowerShell-Zeilen ohne Browser:

      node tools/test-reg.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const ctx = { console, TextDecoder, TextEncoder, BigInt };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['i18n.js', 'catalog.js', 'importers.js', 'templates.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const { Importers } = ctx;

const problems = [];
const eq = (a, b, msg) => { if (JSON.stringify(a) !== JSON.stringify(b)) problems.push(msg + ': ' + JSON.stringify(a) + ' statt ' + JSON.stringify(b)); };

const reg = [
  'Windows Registry Editor Version 5.00', '',
  '; Kommentar',
  '[HKEY_CURRENT_USER\\Software\\Test]',
  '"Null"=dword:00000000',
  '"Max"=dword:ffffffff',
  '@="Standard \\"mit\\" Zitat"',
  '"Pfad"="C:\\\\Program Files\\\\"',
  '"Expand"=hex(2):25,00,53,00,79,00,73,00,74,00,65,00,6d,00,52,00,6f,00,6f,00,\\',
  '  74,00,25,00,00,00',
  '"Multi"=hex(7):61,00,00,00,e4,00,00,00,00,00',
  '"Q"=hex(b):ff,ff,ff,ff,ff,ff,ff,ff',
  '"Bin"=hex:01,02,ab',
  '"None"=hex(0):',
  '"Weg"=-', '',
  '[-HKEY_LOCAL_MACHINE\\SOFTWARE\\Policies\\Alt]', '',
  '[-HKEY_LOCAL_MACHINE\\SOFTWARE]', '',
  '[HKEY_CLASSES_ROOT\\.txt]', '@="txtfile"', '',
  '[HKEY_USERS\\.DEFAULT\\Control Panel]', '"x"="y"', ''
].join('\r\n');

/* wie regedit: UTF-16LE mit BOM */
const bytes = new Uint8Array(Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(reg, 'utf16le')]));
const text = Importers.decodeRegBytes(bytes);
eq(Importers.detectType('x.reg', text), 'reg', 'detectType .reg');
eq(Importers.detectType('x.txt', 'REGEDIT4\r\n[HKEY_LOCAL_MACHINE\\A]'), 'reg', 'detectType ohne Endung');

const r = Importers.parseReg(text, 'test.reg');
const brief = r.entries.map((e) => [e.op, e.scope, e.path, e.name || '', e.type || '', e.value === undefined ? null : e.value]);
eq(brief, [
  ['set', 'user', 'Software\\Test', 'Null', 'DWord', 0],
  ['set', 'user', 'Software\\Test', 'Max', 'DWord', 4294967295],
  ['set', 'user', 'Software\\Test', '(Default)', 'String', 'Standard "mit" Zitat'],
  ['set', 'user', 'Software\\Test', 'Pfad', 'String', 'C:\\Program Files\\'],
  ['set', 'user', 'Software\\Test', 'Expand', 'ExpandString', '%SystemRoot%'],
  ['set', 'user', 'Software\\Test', 'Multi', 'MultiString', ['a', 'ä']],
  ['set', 'user', 'Software\\Test', 'Q', 'QWord', '18446744073709551615'],
  ['set', 'user', 'Software\\Test', 'Bin', 'Binary', [1, 2, 171]],
  ['set', 'user', 'Software\\Test', 'None', 'Binary', []],
  ['delvalue', 'user', 'Software\\Test', 'Weg', '', null],
  ['delkey', 'machine', 'SOFTWARE\\Policies\\Alt', '', '', null],
  ['set', 'machine', 'SOFTWARE\\Classes\\.txt', '(Default)', 'String', 'txtfile']
], 'Eintraege');
eq(r.warnings.length, 3, 'Warnungen (hex(0), Loeschen von SOFTWARE, HKU\\.DEFAULT)');
eq(r.warnings.some((w) => /Zeile 14: None/.test(w)), true, 'Zeilennummer nach Fortsetzungszeile');

/* REGEDIT4: Zeichenketten in hex(2)/hex(7) sind ANSI */
const r4 = Importers.parseReg('REGEDIT4\r\n\r\n[HKEY_LOCAL_MACHINE\\SOFTWARE\\A]\r\n"s"=hex(2):25,57,49,4e,44,49,52,25,00\r\n"m"=hex(7):61,00,e4,00,00\r\n', 'ansi.reg');
eq(r4.entries.map((e) => e.value), ['%WINDIR%', ['a', 'ä']], 'REGEDIT4 ANSI');

let threw = false;
try { Importers.parseReg('kein reg', 'x'); } catch (e) { threw = true; }
eq(threw, true, 'Datei ohne Kopfzeile wird abgelehnt');

/* Erzeugte Zeilen im Tweaks-Modul */
const st = {
  meta: { name: 'Test' }, paths: { installRoot: 'C:\\Install' },
  tweaks: { enabled: true, phase: 'setup', allUsers: true, selected: [],
    regFiles: [{ name: 'test.reg', enabled: true, entries: r.entries, warnings: [] }] }
};
const mod = vm.runInContext('Templates', ctx);
eq(mod.regEntries(st).length, 12, 'regEntries');
const mods = mod.moduleList(Object.assign({
  drivers: { enabled: false, items: [] }, bloat: { enabled: false, selected: [] }, features: { enabled: false, selected: [] },
  office: { enabled: false }, apps: { enabled: false, items: [] }, files: { items: [] }, custom: { psEnabled: false, ps: '' }
}, st), 'setup').map((m) => m[0]);
eq(mods.includes('Set-Tweaks.ps1'), true, 'Set-Tweaks.ps1 auch ohne Katalog-Tweaks');

if (problems.length) {
  problems.forEach((p) => console.error('  ' + p));
  console.error('test-reg: ' + problems.length + ' Fehler.');
  process.exit(1);
}
console.log('test-reg: alles in Ordnung (' + r.entries.length + ' Eintraege, ' + r.warnings.length + ' Hinweise).');
