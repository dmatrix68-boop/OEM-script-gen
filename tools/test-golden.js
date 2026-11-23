#!/usr/bin/env node
/*  Golden-Test: Port (js/ug) gegen das C#-Original von
    cschneegans/unattend-generator.

      node tools/test-golden.js --upstream <Klon> [--out <Ordner>] [--strict]

    1. Fuer jeden Fall aus tools/golden/cases.json erzeugt der Port in Chromium
       (Playwright) die autounattend.xml; die vollstaendige Konfiguration
       (Standardwerte + Fall) landet in <Ordner>/resolved.json.
    2. tools/golden (C#) uebersetzt dieselbe Konfiguration in die
       Configuration des Originals und erzeugt dessen Ergebnis - mit den
       UNVERAENDERTEN Quellen aus <Klon>.
    3. Vergleich Byte fuer Byte. Ausgeblendet wird nur <Build>: das Original
       traegt dort seinen eigenen Build-Hash ein, der Port den Port-Stand.
       Bei Fehlerfaellen muessen beide scheitern, mit gleicher Meldung.

    Ohne Playwright oder dotnet: "uebersprungen" (Exitcode 0), mit --strict
    ein Fehler. Laeuft im Workflow "Tests" gegen den Port-Stand und im
    Workflow "Schneegans beobachten" gegen den neuesten Stand des Originals. */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null);
const strict = args.includes('--strict');
const upstream = opt('--upstream');
const out = path.resolve(opt('--out') || path.join(require('os').tmpdir(), 'oem-golden'));

function skip(msg) {
  console.log('test-golden: uebersprungen (' + msg + ').');
  process.exit(strict ? 1 : 0);
}
if (!upstream || !fs.existsSync(path.join(upstream, 'Main.cs'))) skip('--upstream <Klon> fehlt');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { skip('Playwright nicht installiert'); }
if (spawnSync('dotnet', ['--version'], { encoding: 'utf8' }).status !== 0) skip('dotnet nicht installiert');

const cases = JSON.parse(fs.readFileSync(path.join(__dirname, 'golden', 'cases.json'), 'utf8'));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });

(async () => {
  /* 1. Port */
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const f of ['resources.js', 'core.js', 'modifiers.js']) await page.addScriptTag({ path: path.join(root, 'js', 'ug', f) });
  const results = await page.evaluate((list) => list.map((c) => {
    const config = Object.assign(UG.defaultConfig(), c.config);
    try { return { name: c.name, config, xml: UG.serialize(UG.generate(config)) }; }
    catch (e) { return { name: c.name, config, error: e.message }; }
  }), cases);
  await browser.close();
  for (const r of results) {
    if (r.error !== undefined) fs.writeFileSync(path.join(out, 'js', r.name + '.error'), r.error);
    else fs.writeFileSync(path.join(out, 'js', r.name + '.xml'), r.xml);
  }
  fs.writeFileSync(path.join(out, 'resolved.json'), JSON.stringify(results.map((r) => ({ name: r.name, config: r.config })), null, 2));

  /* 2. Original */
  const run = spawnSync('dotnet', ['run', '--project', path.join(__dirname, 'golden'), '-c', 'Release',
    '-p:UGDIR=' + path.resolve(upstream), '--', path.join(out, 'resolved.json'), path.join(out, 'cs')],
  { stdio: 'inherit' });
  if (run.status !== 0) { console.error('test-golden: Harness fehlgeschlagen (Exitcode ' + run.status + ').'); process.exit(1); }

  /* 3. Vergleich */
  const norm = (x) => x.replace(/\r\n\t*<Build>[\s\S]*?<\/Build>/, '');
  const read = (dir, name) => {
    const xml = path.join(out, dir, name + '.xml'), err = path.join(out, dir, name + '.error');
    if (fs.existsSync(xml)) return { xml: fs.readFileSync(xml, 'utf8') };
    if (fs.existsSync(err)) return { error: fs.readFileSync(err, 'utf8') };
    return {};
  };
  const problems = [];
  for (const c of cases) {
    const js = read('js', c.name), cs = read('cs', c.name);
    if (cs.xml === undefined && cs.error === undefined) { problems.push(c.name + ': Original hat nichts erzeugt'); continue; }
    if (cs.error !== undefined || js.error !== undefined) {
      if (cs.error === undefined) problems.push(c.name + ': Port scheitert ("' + js.error + '"), Original nicht');
      else if (js.error === undefined) problems.push(c.name + ': Original scheitert ("' + cs.error + '"), Port nicht');
      else if (c.errorPrefix) {
        /* Schema-Fehler: Der Port prueft ohne .NET-Validator, die Meldungen
           nach dem Praefix lauten anders - verglichen wird nur das Praefix. */
        if (!cs.error.startsWith(c.errorPrefix) || !js.error.startsWith(c.errorPrefix)) {
          problems.push(c.name + ': Praefix weicht ab\n    Original: ' + cs.error + '\n    Port:     ' + js.error);
        } else console.log('ok    ' + c.name + ' (Fehler, Praefix: ' + cs.error + ' | Port: ' + js.error.slice(c.errorPrefix.length) + ')');
      }
      else if (cs.error !== js.error) problems.push(c.name + ': Meldung weicht ab\n    Original: ' + cs.error + '\n    Port:     ' + js.error);
      else console.log('ok    ' + c.name + ' (Fehler: ' + cs.error + ')');
      continue;
    }
    const a = norm(cs.xml), b = norm(js.xml);
    if (a === b) { console.log('ok    ' + c.name); continue; }
    const la = a.split('\r\n'), lb = b.split('\r\n');
    let i = 0;
    while (i < la.length && i < lb.length && la[i] === lb[i]) i++;
    const ctx = (lines) => lines.slice(Math.max(0, i - 3), i + 4).map((l, k) => '      ' + (Math.max(0, i - 3) + k + 1) + ': ' + l).join('\n');
    problems.push(c.name + ': weicht ab ab Zeile ' + (i + 1) + '\n    Original:\n' + ctx(la) + '\n    Port:\n' + ctx(lb));
  }
  if (problems.length) {
    problems.forEach((p) => console.error('FEHLER ' + p));
    console.error('test-golden: ' + problems.length + ' von ' + cases.length + ' Faellen weichen ab. Ergebnisse: ' + out);
    process.exit(1);
  }
  console.log('test-golden: ' + cases.length + ' Faelle identisch mit dem Original.');
})().catch((e) => { console.error(e); process.exit(1); });
