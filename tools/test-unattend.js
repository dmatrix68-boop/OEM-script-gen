#!/usr/bin/env node
/*  Prueft den Antwortdatei-Designer (js/ug, Port des Schneegans-Generators).

      node tools/test-unattend.js

    Der Port braucht DOMParser und XPath, also einen Browser. Ist Playwright
    installiert (npm i -g playwright bzw. vorinstalliert), laufen die Faelle
    in Chromium; sonst meldet das Werkzeug "uebersprungen" und endet mit 0.

    Geprueft wird gegen das Verhalten des Originals, abgeleitet aus dessen
    Quelltext: Aufbau der Standarddatei, Sprache/Tastatur, Konten mit
    Autologon und Verschleierung, Computername, Edition, Reihenfolge der
    Befehle, mehrere Architekturen und die Pruefregeln. */
'use strict';
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { console.log('test-unattend: uebersprungen (Playwright nicht installiert).'); process.exit(0); }

const root = path.join(__dirname, '..');

const CASES = [
  {
    name: 'Standardwerte',
    config: {},
    expect: [
      /<settings pass="offlineServicing"><\/settings>/,
      /<Key>00000-00000-00000-00000-00000<\/Key>\s*<WillShowUI>Always<\/WillShowUI>/,
      /<UseConfigurationSet>false<\/UseConfigurationSet>/,
      /BypassTPMCheck[\s\S]*BypassSecureBootCheck[\s\S]*BypassRAMCheck/,
      /<ProtectYourPC>3<\/ProtectYourPC>/,
      /<HideWirelessSetupInOOBE>false<\/HideWirelessSetupInOOBE>/,
      /<File path="C:\\Windows\\Setup\\Scripts\\FirstLogon\.ps1">/,
      /'C:\\Windows\\Panther\\unattend\.xml';/,
      /<Hash>[0-9a-f]{40}<\/Hash>/
    ],
    reject: [/International-Core/, /<UserAccounts>/, /<AutoLogon>/, /PEScriptCopy/, /<ComputerName>/]
  },
  {
    name: 'Vollstaendig vorgegeben',
    config: {
      language: { mode: 'unattended', image: 'de-DE', locales: [{ locale: 'de-DE', keyboard: '00000407' }, { locale: 'en-US', keyboard: '00000409' }], geo: '244' },
      account: { mode: 'unattended', accounts: [{ name: 'Jörg', displayName: 'Jörg Müller', password: 'geheim', group: 'Administrators' }, { name: 'Kind', displayName: '', password: '', group: 'Users' }], autoLogon: 'own', obscure: true },
      computerName: { mode: 'custom', name: 'BUERO-PC' },
      timeZone: { mode: 'explicit', id: 'W. Europe Standard Time' },
      edition: { mode: 'edition', edition: 'pro' },
      bypassNetwork: true, useConfigurationSet: true, wifi: { mode: 'skip' }, expressSettings: 'interactive',
      lockout: { mode: 'custom', threshold: 5, duration: 30, window: 15 },
      passwordExpiration: { mode: 'unlimited' }
    },
    expect: [
      /<InputLocale>0407:00000407;0409:00000409<\/InputLocale>/,
      /<SystemLocale>de-DE<\/SystemLocale>/,
      /Set-WinHomeLocation -GeoId 244;/,                                 // Standort weicht vom Gebietsschema ab
      /HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce/,
      /<Name>J&#xF6;rg<\/Name>\s*<DisplayName>J&#xF6;rg M&#xFC;ller<\/DisplayName>/,
      /<Value>ZwBlAGgAZQBpAG0AUABhAHMAcwB3AG8AcgBkAA==<\/Value>\s*<PlainText>false<\/PlainText>/,
      /<Username>J&#xF6;rg<\/Username>\s*<Enabled>true<\/Enabled>\s*<LogonCount>1<\/LogonCount>/,
      /<ComputerName>BUERO-PC<\/ComputerName>\s*<TimeZone>W\. Europe Standard Time<\/TimeZone>/,
      /<Key>VK7JG-NPHTM-C97JM-9MPGT-3V66T<\/Key>\s*<WillShowUI>OnError<\/WillShowUI>/,
      /<UseConfigurationSet>true<\/UseConfigurationSet>/,
      /BypassNRO/, /net\.exe accounts \/lockoutthreshold:5 \/lockoutduration:30 \/lockoutwindow:15;/,
      /net\.exe accounts \/maxpwage:UNLIMITED;/,
      /<HideWirelessSetupInOOBE>true<\/HideWirelessSetupInOOBE>/,
      /AutoLogonCount/,
      /<LocalAccount wcm:action="add">/
    ],
    reject: [/<ProtectYourPC>/, /J\u00f6rg/]
  },
  {
    name: 'Reihenfolge specialize',
    config: { bypassNetwork: true, computerName: { mode: 'prompt' } },
    order: ['ExtractScript', 'Specialize.ps1'],
    expect: [/<ComputerName>TEMPNAME<\/ComputerName>/, /GetComputerName\.ps1/, /SetComputerName\.ps1/]
  },
  {
    name: 'Zwei Architekturen',
    config: { architectures: ['amd64', 'arm64'] },
    count: { 'processorArchitecture="arm64"': 3, 'processorArchitecture="amd64"': 3 }
  },
  {
    name: 'Firmware-Schluessel, lokales Konto interaktiv',
    config: { edition: { mode: 'firmware' }, account: { mode: 'interactive-local' } },
    expect: [/<ProductKey>\s*<WillShowUI>Never<\/WillShowUI>\s*<\/ProductKey>/, /<HideOnlineAccountScreens>true<\/HideOnlineAccountScreens>/]
  },
  { name: 'Fehler: kein Administrator', config: { account: { mode: 'unattended', accounts: [{ name: 'a', password: '', group: 'Users' }], autoLogon: 'none' } }, error: /at least one administrator/ },
  { name: 'Fehler: Loeschen ohne Autologon', config: { account: { mode: 'unattended', accounts: [{ name: 'a', password: '', group: 'Administrators' }], autoLogon: 'none' } }, error: /must let Windows log on/ },
  { name: 'Fehler: Computername', config: { computerName: { mode: 'custom', name: '12345' } }, error: /Computer name '12345' is invalid/ },
  {
    /* Erwartung aus dem Golden-Lauf gegen das Original (StartFolder.json hat kein Id-Feld) */
    name: 'Ordner im Startmenue',
    config: { startFolders: { mode: 'custom', show: ['Settings', 'FileExplorer'] } },
    expect: [/FromBase64String\('vCSKFAzWiUKggG7Zu6JIgoYIc1KqUUNCn3sndlhGWdQ='\)/]
  },
  { name: 'Fehler: reservierter Kontoname', config: { account: { mode: 'unattended', accounts: [{ name: 'Administrator', password: '', group: 'Administrators' }], autoLogon: 'own' } }, error: /Username 'Administrator' is invalid/ },
  { name: 'Fehler: Konto = Computername', config: { computerName: { mode: 'custom', name: 'PC1' }, account: { mode: 'unattended', accounts: [{ name: 'pc1', password: '', group: 'Administrators' }], autoLogon: 'own' } }, error: /must not be the same as the computer name/ },
  { name: 'Fehler: Produktschluessel', config: { edition: { mode: 'key', key: 'ABC' } }, error: /ill-formed/ },
  { name: 'Fehler: Sperrfenster', config: { lockout: { mode: 'custom', threshold: 5, duration: 10, window: 20 } }, error: /LockoutWindow/ }
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('about:blank');
  for (const f of ['resources.js', 'core.js', 'modifiers.js']) await page.addScriptTag({ path: path.join(root, 'js', 'ug', f) });
  const problems = [];
  for (const c of CASES) {
    const r = await page.evaluate((cfg) => {
      try {
        const conf = Object.assign(UG.defaultConfig(), cfg);
        return { xml: UG.serialize(UG.generate(conf)) };
      } catch (e) { return { error: e.message, name: e.name }; }
    }, c.config);
    const fail = (m) => problems.push(c.name + ': ' + m);
    if (c.error) {
      if (!r.error) fail('Fehler erwartet, aber Datei erzeugt');
      else if (!c.error.test(r.error)) fail('falscher Fehler: ' + r.error);
      else if (r.name !== 'ConfigurationException') fail('kein ConfigurationException: ' + r.name);
      continue;
    }
    if (r.error) { fail('Fehler: ' + r.error); continue; }
    const xml = r.xml;
    if (!xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\r\n<unattend xmlns="urn:schemas-microsoft-com:unattend" xmlns:wcm=')) fail('Kopf falsch');
    if (/[^\x00-\x7F]/.test(xml)) fail('enthaelt Nicht-ASCII');
    if (/[^\r]\n/.test(xml)) fail('Zeilenende ohne CR');
    (c.expect || []).forEach((re) => { if (!re.test(xml)) fail('fehlt ' + re); });
    (c.reject || []).forEach((re) => { if (re.test(xml)) fail('unerwartet ' + re); });
    for (const [needle, n] of Object.entries(c.count || {})) {
      const got = xml.split(needle).length - 1;
      if (got !== n) fail(needle + ': ' + got + ' statt ' + n);
    }
    if (c.order) {
      let last = -1;
      for (const needle of c.order) {
        const i = xml.indexOf(needle, xml.indexOf('<settings pass="specialize">'));
        if (i < last) fail('Reihenfolge: ' + needle);
        last = i;
      }
    }
    /* Wohlgeformt? */
    const ok = await page.evaluate((x) => !new DOMParser().parseFromString(x, 'application/xml').getElementsByTagName('parsererror').length, xml);
    if (!ok) fail('nicht wohlgeformt');
  }
  await browser.close();
  if (problems.length) {
    problems.forEach((p) => console.error('  ' + p));
    console.error('test-unattend: ' + problems.length + ' Fehler.');
    process.exit(1);
  }
  console.log('test-unattend: ' + CASES.length + ' Faelle in Ordnung.');
})().catch((e) => { console.error(e); process.exit(1); });
