#!/usr/bin/env node
/*  Win-ProfileKit-Profile im Generator:

    1. Import: profile.json aus einem echten .pkprofile (samples/Beispiel.pkprofile,
       erzeugt mit .NET ZipFile) sowie aus Archiven von MiniZip - einmal mit
       deflate, einmal unkomprimiert (ohne CompressionStream).
    2. Erzeugung: Module in den richtigen Phasen, Dateien unter Install\ProfileKit,
       Hinweisdateien fuer fehlende Binaerdateien, Aufrufe von profilekit.exe.

      node tools/test-profilekit.js  */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ok   ' + msg);
  else { console.error('  FAIL ' + msg); failures++; }
}

function context(withCompression) {
  const ctx = { console, TextDecoder, TextEncoder, BigInt, Blob, Response, DecompressionStream };
  if (withCompression) ctx.CompressionStream = CompressionStream;
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const f of ['i18n.js', 'catalog.js', 'importers.js', 'templates.js', 'zip.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

async function blobBytes(b) { return new Uint8Array(await b.arrayBuffer()); }

function state(ctx) {
  /* Zustand wie defaultState() in js/app.js */
  return {
    formatVersion: 1, meta: { name: 'Test' },
    paths: { installRoot: 'C:\\Install', zipRoot: 'oem' },
    options: { transcript: false, selfDelete: false, cleanupInstall: false, toastOnFinish: false,
      phase2Runner: 'task', finish: 'none', trigger: 'both', configSet: true, configSetMode: 'new' },
    unattend: { xml: null, name: '', info: null },
    apps: { enabled: false, phase: 'firstlogon', method: 'individual', retries: 2, packageTimeoutMin: 15,
      waitNetwork: true, sourceUpdate: true, bootstrap: true, pinVersions: false, machineScope: false, items: [] },
    office: { enabled: false, phase: 'firstlogon', setupSource: 'bundled', source: 'online', localFolder: 'Quelle', odtUrl: '', xml: '', checkInstalled: true },
    tweaks: { enabled: false, phase: 'setup', allUsers: true, selected: [], regFiles: [] },
    bloat: { enabled: false, phase: 'setup', provisioned: true, selected: [] },
    features: { enabled: false, phase: 'firstlogon', timeoutMin: 20, selected: [] },
    drivers: { enabled: false, phase: 'setup', timeoutMin: 10, items: [] },
    files: { items: [] },
    profiles: { enabled: true, phase1Windows: true, exe: null, exePresent: false, items: [] },
    custom: { cmdEnabled: false, cmd: '', psEnabled: false, psPhase: 'setup', ps: '' },
    iso: { noPrompt: false },
    answer: { enabled: false }
  };
}

(async () => {
  console.log('Import');
  const ctx = context(true);
  const sample = new Uint8Array(fs.readFileSync(path.join(root, 'samples', 'Beispiel.pkprofile')));
  const info = await ctx.Importers.parsePkProfile(sample);
  check(info.name === 'Beispiel', '.NET-Archiv: Name ' + info.name);
  check(info.sourceUser === 'max' && info.sourceMachine === 'REFERENZ-VM', 'Quelle ' + info.sourceUser + '@' + info.sourceMachine);
  check(info.modules.length === 4, info.modules.length + ' Module');
  check(info.modules.some((m) => m.id === '7zip' && m.wingetId === '7zip.7zip'), 'winget-ID von 7-Zip');
  check(info.modules.some((m) => m.id === 'windows.mouse' && !m.wingetId), 'Windows-Modul ohne winget-ID');

  for (const withCompression of [true, false]) {
    const c = context(withCompression);
    const manifest = '\uFEFF' + JSON.stringify({
      Name: 'Pascal', Source: { UserName: 'alt', Machine: 'PC1' },
      Modules: [{ Id: 'vlc', DisplayName: 'VLC', WingetId: 'VideoLAN.VLC', ContainsKeyfiles: true }]
    });
    const zip = await c.MiniZip.createZip([
      { path: 'modules/vlc/module.json', data: '{}' },
      { path: 'profile.json', data: manifest }
    ]);
    const parsed = await c.Importers.parsePkProfile(await blobBytes(zip));
    check(parsed.name === 'Pascal' && parsed.modules[0].wingetId === 'VideoLAN.VLC' && parsed.modules[0].keyfiles,
      'MiniZip ' + (withCompression ? 'deflate' : 'stored') + ': BOM und PascalCase gelesen');
  }

  let threw = false;
  try { await ctx.Importers.parsePkProfile(new TextEncoder().encode('kein zip')); } catch (e) { threw = true; }
  check(threw, 'kein ZIP wird abgewiesen');
  threw = false;
  try {
    const z = await ctx.MiniZip.createZip([{ path: 'andere.json', data: '{}' }]);
    await ctx.Importers.parsePkProfile(await blobBytes(z));
  } catch (e) { threw = /profile\.json/.test(e.message); }
  check(threw, 'ZIP ohne profile.json wird abgewiesen');

  console.log('Erzeugung');
  const st = state(ctx);
  st.profiles.exe = new Blob(['MZ']); st.profiles.exePresent = true;
  st.profiles.items = [
    { name: 'Beispiel', user: '', enabled: true, blob: new Blob([sample]), blobPresent: true, modules: info.modules },
    { name: 'Nur Apps', user: 'test2', enabled: true, blob: null, blobPresent: false, modules: [{ id: 'vlc', name: 'VLC', wingetId: 'VideoLAN.VLC' }] },
    { name: 'Aus', user: '', enabled: false, blob: null, blobPresent: false, modules: [{ id: 'windows.theme', name: 'Design', wingetId: '' }] }
  ];
  const files = ctx.Templates.build(st);
  const byPath = new Map(files.map((f) => [f.path, f]));
  const inst = '$OEM$/$1/Install/';

  check(byPath.has(inst + 'ProfileKit/profilekit.exe') && byPath.get(inst + 'ProfileKit/profilekit.exe').binary, 'profilekit.exe als Binaerdatei');
  check(byPath.has(inst + 'ProfileKit/Profiles/Beispiel.pkprofile'), 'Profil Beispiel.pkprofile');
  check(byPath.has(inst + 'ProfileKit/Profiles/Nur_Apps.pkprofile.FEHLT.txt'), 'Hinweisdatei fuer fehlendes Profil');
  check(![...byPath.keys()].some((p) => /Aus\.pkprofile/.test(p)), 'abgeschaltetes Profil fehlt im Paket');

  const install = byPath.get(inst + 'Install.ps1').data;
  const setupBlock = install.slice(install.indexOf('$setupSteps'), install.indexOf('$logonSteps'));
  const logonBlock = install.slice(install.indexOf('$logonSteps'), install.indexOf('$steps = '));
  check(/Restore-Profile-P1\.ps1/.test(setupBlock), 'Phase 1: Restore-Profile-P1.ps1');
  check(/Restore-Profile\.ps1/.test(logonBlock), 'Phase 2: Restore-Profile.ps1');

  const p1 = byPath.get(inst + 'Modules/Restore-Profile-P1.ps1').data;
  check(/'--default-user', '--only', 'windows\.\*'/.test(p1), 'Phase 1: Windows-Module ins Default-Profil');
  check(/File = 'Beispiel\.pkprofile'/.test(p1) && !/Nur_Apps/.test(p1), 'Phase 1: nur Profile mit Windows-Modulen');

  const p2 = byPath.get(inst + 'Modules/Restore-Profile.ps1').data;
  check(/File = 'Nur_Apps\.pkprofile'; User = 'test2'/.test(p2), 'Phase 2: fester Zielbenutzer');
  check(/File = 'Beispiel\.pkprofile'; User = ''/.test(p2), 'Phase 2: Benutzer der ersten Anmeldung');
  check(/Win32_ComputerSystem/.test(p2) && /-split '\\\\'/.test(p2), 'Phase 2: angemeldeten Benutzer ermitteln (Regex mit \\\\)');
  check(/'--no-backup'/.test(p2) && /\$code -eq 2/.test(p2), 'Phase 2: ohne Sicherung, Exitcode 2 = Warnung');

  st.profiles.phase1Windows = false;
  check(!ctx.Templates.moduleList(st, 'setup').some((m) => /Restore-Profile/.test(m[0])), 'ohne Option keine Phase 1');
  st.profiles.enabled = false;
  check(!ctx.Templates.build(st).some((f) => /ProfileKit|Restore-Profile/.test(f.path)), 'Modul aus: nichts im Paket');

  if (failures) { console.error('test-profilekit: ' + failures + ' Fehler'); process.exit(1); }
  console.log('test-profilekit: alle Pruefungen bestanden.');
})().catch((e) => { console.error(e); process.exit(1); });
