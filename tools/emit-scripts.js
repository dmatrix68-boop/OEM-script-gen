#!/usr/bin/env node
/*  Erzeugt die Skripte des Generators ohne Browser - fuer die PowerShell-Tests
    in GitHub Actions (tools/test-powershell.ps1).

      node tools/emit-scripts.js <Zielordner>

    Je Profil ein Unterordner mit der Struktur wie im ZIP (nur Textdateien):
      voll     - alle Module aktiv, alle Tweaks/Bloatware/Komponenten, mehrere
                 Paketmanager, Office mit lokaler Quelle, Treiber mit
                 Modellfilter, eigene Dateien und Befehle, .reg-Werte
      phase1   - Anwendungen, Office und Komponenten in Phase 1, nur
                 SetupComplete.cmd, RunOnce, Neustart am Ende
      standard - Voreinstellungen der Oberflaeche
      regtest  - nur die .reg-Werte aus samples/Beispiel.reg (Funktionstest)

    Der Zustand entspricht defaultState() aus js/app.js; dort neue Felder
    hier nachziehen. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const out = process.argv[2];
if (!out) { console.error('Aufruf: node tools/emit-scripts.js <Zielordner>'); process.exit(2); }

const ctx = { console, TextDecoder, TextEncoder, BigInt, Blob };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['i18n.js', 'catalog.js', 'importers.js', 'templates.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, 'js', f), 'utf8'), ctx, { filename: f });
}
const { Importers, Catalog, Templates } = ctx;

const OFFICE = [
  '<Configuration ID="test">',
  '  <Add OfficeClientEdition="64" Channel="Current">',
  '    <Product ID="O365ProPlusRetail"><Language ID="de-de" /></Product>',
  '  </Add>',
  '  <Display Level="None" AcceptEULA="TRUE" />',
  '</Configuration>'
].join('\n');

function base() {
  return {
    formatVersion: 1,
    meta: { name: 'Test' },
    paths: { installRoot: 'C:\\Install', zipRoot: 'both' },
    options: { transcript: true, selfDelete: false, cleanupInstall: false, toastOnFinish: false,
      phase2Runner: 'task', finish: 'none', trigger: 'both', configSet: true, configSetMode: 'new' },
    unattend: { xml: null, name: '', info: null },
    apps: { enabled: true, phase: 'firstlogon', method: 'individual', retries: 2, packageTimeoutMin: 15,
      waitNetwork: true, sourceUpdate: true, bootstrap: true, pinVersions: false, machineScope: false, items: [] },
    office: { enabled: false, phase: 'firstlogon', setupSource: 'bundled', source: 'online', localFolder: 'Quelle',
      odtUrl: 'https://officecdn.microsoft.com/pr/wsus/setup.exe', xml: OFFICE, checkInstalled: true },
    tweaks: { enabled: true, phase: 'setup', allUsers: true,
      selected: ['fileExt', 'hiddenFiles', 'launchToThisPC', 'longPaths', 'taskbarSearch', 'clockSeconds'], regFiles: [] },
    bloat: { enabled: false, phase: 'setup', provisioned: true, selected: [] },
    features: { enabled: false, phase: 'firstlogon', timeoutMin: 20, selected: [] },
    drivers: { enabled: false, phase: 'setup', timeoutMin: 10, items: [] },
    files: { items: [] },
    custom: { cmdEnabled: true, cmd: '', psEnabled: true, psPhase: 'setup', ps: '' },
    iso: { noPrompt: false },
    answer: { enabled: false }
  };
}

function regFile() {
  const text = Importers.decodeRegBytes(fs.readFileSync(path.join(root, 'samples', 'Beispiel.reg')));
  const r = Importers.parseReg(text, 'Beispiel.reg');
  return { name: 'Beispiel.reg', enabled: true, entries: r.entries, warnings: r.warnings };
}

const pkgs = [
  { id: '7zip.7zip', name: '7-Zip', manager: 'winget' },
  { id: 'Mozilla.Firefox', name: 'Firefox', manager: 'winget', version: '120.0' },
  { id: 'notepadplusplus', name: 'Notepad++', manager: 'chocolatey' },
  { id: 'git', name: 'Git', manager: 'scoop' },
  { id: 'requests', name: 'requests', manager: 'pip' }
];

const profiles = {
  standard: base(),
  voll: (() => {
    const s = base();
    s.apps.items = pkgs.map((p) => Importers.mkPkg(p));
    s.office.enabled = true; s.office.source = 'local';
    s.tweaks.selected = Catalog.TWEAKS.map((t) => t.id);
    s.tweaks.regFiles = [regFile()];
    s.bloat.enabled = true; s.bloat.selected = Catalog.BLOAT.map((b) => b.id);
    s.features.enabled = true; s.features.selected = Catalog.FEATURES.map((f) => f.id);
    s.drivers.enabled = true;
    s.drivers.items = [
      { name: 'Chipsatz', dest: 'pnp', models: 'ThinkPad*;20XW', enabled: true, files: [] },
      { name: 'NVMe', dest: 'winpe', models: '', enabled: true, files: [] }
    ];
    s.files.items = [
      { name: 'setup.exe', target: 'setup.exe', run: '/S', phase: 'firstlogon', dest: 'files', enabled: true, blob: new Blob(['MZ']), blobPresent: true },
      { name: 'paket.msi', target: 'paket.msi', run: '/qn', phase: 'setup', dest: 'files', enabled: true, blob: new Blob(['x']), blobPresent: true }
    ];
    s.custom.cmd = 'echo Hallo';
    s.custom.ps = "Write-Host 'Eigener Code mit Umlauten: äöü'";
    s.options.toastOnFinish = true; s.options.selfDelete = true;
    return s;
  })(),
  phase1: (() => {
    const s = base();
    s.apps.items = pkgs.slice(0, 2).map((p) => Importers.mkPkg(p));
    s.apps.phase = 'setup';
    s.office.enabled = true; s.office.phase = 'setup';
    s.features.enabled = true; s.features.phase = 'setup'; s.features.selected = ['NetFx3', 'OpenSSH.Server~~~~0.0.1.0'];
    s.options.trigger = 'setupcomplete'; s.options.phase2Runner = 'runonce'; s.options.finish = 'reboot';
    return s;
  })(),
  regtest: (() => {
    const s = base();
    s.apps.enabled = false;
    s.tweaks.selected = [];
    s.tweaks.allUsers = false;
    s.tweaks.regFiles = [regFile()];
    return s;
  })()
};

let count = 0;
for (const [name, st] of Object.entries(profiles)) {
  const files = Templates.build(st);
  for (const f of files) {
    if (f.binary || typeof f.data !== 'string') continue;
    const p = path.join(out, name, ...f.path.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, f.data, 'utf8');
    count++;
  }
}
console.log('emit-scripts: ' + count + ' Dateien in ' + Object.keys(profiles).length + ' Profilen nach ' + out);
