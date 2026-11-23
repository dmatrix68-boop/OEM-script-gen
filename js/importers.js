/* Importer für UniGetUI-Bundles, winget-Exporte, SetupComplete.cmd und ODT-Configuration.xml */
(function (global) {
  'use strict';

  /*  Meldungen fuer die Oberflaeche. Mit geladenem i18n-Modul uebersetzt F()
      die deutsche Vorlage und fuellt {0}, {1}, ...; ohne Modul bleibt es deutsch. */
  function F(german) {
    const args = Array.prototype.slice.call(arguments, 1);
    const tpl = global.I18n ? global.I18n.term(german) : german;
    return String(tpl).replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? args[i] : m));
  }

  const MGR_MAP = [
    [/winget|windows package manager|app installer/i, 'winget'],
    [/choco/i, 'chocolatey'],
    [/scoop/i, 'scoop'],
    [/\bnpm\b|node/i, 'npm'],
    [/pip|python/i, 'pip'],
    [/cargo|rust/i, 'cargo'],
    [/\.net|dotnet/i, 'dotnet'],
    [/powershell/i, 'powershell']
  ];

  function normManager(value) {
    const s = String(value || '').trim();
    if (!s) return 'winget';
    for (const [re, id] of MGR_MAP) if (re.test(s)) return id;
    return 'winget';
  }

  function mkPkg(o) {
    return {
      uid: 'p' + Math.random().toString(36).slice(2, 9),
      enabled: true,
      id: String(o.id || '').trim(),
      name: String(o.name || o.id || '').trim(),
      version: String(o.version || '').trim(),
      source: String(o.source || '').trim(),
      manager: normManager(o.manager),
      args: String(o.args || '').trim()
    };
  }

  function dedupe(list) {
    const seen = new Set(); const out = [];
    for (const p of list) {
      const key = p.manager + '::' + p.id.toLowerCase();
      if (!p.id || seen.has(key)) continue;
      seen.add(key); out.push(p);
    }
    return out;
  }

  /* ---------- UniGetUI / winget Bundles ---------- */

  function parseBundleJson(obj) {
    const out = [];

    // UniGetUI (.ubundle, export_version 2/3)
    if (Array.isArray(obj.packages)) {
      for (const p of obj.packages) {
        out.push(mkPkg({
          id: p.Id || p.id || p.PackageId,
          name: p.Name || p.name,
          version: p.Version || p.version,
          source: p.Source || p.source,
          manager: p.ManagerName || p.Manager || p.manager || p.Source
        }));
      }
    }

    // UniGetUI listet inkompatible Pakete separat – nur als Hinweis
    // winget export: { Sources: [ { Packages: [ { PackageIdentifier, Version } ], SourceDetails: { Name } } ] }
    if (Array.isArray(obj.Sources)) {
      for (const src of obj.Sources) {
        const srcName = (src.SourceDetails && src.SourceDetails.Name) || 'winget';
        for (const p of (src.Packages || [])) {
          out.push(mkPkg({
            id: p.PackageIdentifier || p.Id,
            name: p.PackageIdentifier || p.Id,
            version: p.Version,
            source: srcName,
            manager: 'winget'
          }));
        }
      }
    }
    return out;
  }

  function parseBundleXml(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) return [];
    const out = [];
    const nodes = doc.querySelectorAll('Package, package');
    for (const n of nodes) {
      const get = (tag) => {
        const el = n.querySelector(tag);
        return el ? el.textContent.trim() : '';
      };
      out.push(mkPkg({
        id: get('Id') || get('id') || n.getAttribute('Id') || '',
        name: get('Name') || get('name'),
        version: get('Version') || get('version'),
        source: get('Source') || get('source'),
        manager: get('ManagerName') || get('Manager') || get('Source')
      }));
    }
    return out;
  }

  function parseBundleYaml(text) {
    /* Bewusst simpel: erkennt Blöcke aus "- Id: x" / "Name:" / "Version:" / "ManagerName:" */
    const out = [];
    let cur = null;
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      const m = line.match(/^-?\s*(Id|Name|Version|Source|ManagerName|Manager|PackageIdentifier)\s*:\s*(.*)$/i);
      if (!m) continue;
      const key = m[1].toLowerCase();
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      const isStart = /^-/.test(line) || (key === 'id' || key === 'packageidentifier');
      if (isStart && (key === 'id' || key === 'packageidentifier')) {
        if (cur) out.push(mkPkg(cur));
        cur = { id: val };
      } else if (cur) {
        cur[key === 'managername' || key === 'manager' ? 'manager' : key] = val;
      }
    }
    if (cur) out.push(mkPkg(cur));
    return out;
  }

  function parseBundle(text, filename) {
    const trimmed = text.replace(/^﻿/, '').trim();
    const name = (filename || '').toLowerCase();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const obj = JSON.parse(trimmed);
      return dedupe(parseBundleJson(Array.isArray(obj) ? { packages: obj } : obj));
    }
    if (trimmed.startsWith('<')) return dedupe(parseBundleXml(trimmed));
    if (/\.ya?ml$/.test(name) || /^[-\s]*(id|packages)\s*:/im.test(trimmed)) return dedupe(parseBundleYaml(trimmed));
    throw new Error(F('Unbekanntes Bundle-Format'));
  }

  /* ---------- SetupComplete.cmd ---------- */

  const NOISE = [
    /^@?echo\s+(off|on)\s*$/i,
    /^setlocal/i, /^endlocal/i,
    /^rem\b/i, /^::/,
    /^echo\b/i,
    /^exit\s*\/b/i,
    /^fltmc\b/i,
    /^cd\s/i, /^cd\\?$/i,
    /^set\s+"?LOG/i,
    /^if\s+not\s+exist\s+.*mkdir/i,
    /^\(goto\)/i,
    /^pause\s*$/i,
    /^popd|^pushd/i
  ];

  function parseSetupComplete(text) {
    const res = { packages: [], custom: [], notes: [], officeConfigName: null, scripts: [] };
    const lines = text.split(/\r?\n/);

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (NOISE.some((re) => re.test(line))) continue;

      // Office Deployment Tool
      let m = line.match(/setup\.exe\s+\/configure\s+"?([^"\s]+\.xml)"?/i);
      if (m) { res.officeConfigName = m[1].replace(/.*[\\/]/, ''); res.notes.push(F('Office-Installation (ODT) erkannt: {0}', m[1])); continue; }

      // winget
      m = line.match(/winget(?:\.exe)?\s+install\s+(.*)$/i);
      if (m) {
        const idm = m[1].match(/(?:--id|-e\s+--id|--id=)\s*"?([A-Za-z0-9_.+-]+)"?/i) || m[1].match(/^\s*"?([A-Za-z0-9_]+(?:\.[A-Za-z0-9_+-]+)+)"?/);
        if (idm) {
          const vm = m[1].match(/--version\s+"?([^"\s]+)"?/i);
          res.packages.push(mkPkg({ id: idm[1], name: idm[1], version: vm ? vm[1] : '', manager: 'winget' }));
          continue;
        }
      }

      // PowerShell-Skriptaufrufe
      m = line.match(/-File\s+"?([^"]+\.ps1)"?/i);
      if (m) { res.scripts.push(m[1]); res.notes.push(F('PowerShell-Aufruf erkannt: {0}', m[1])); continue; }

      // DISM / AppX-Entfernung
      if (/Remove-AppxPackage|Remove-AppxProvisionedPackage/i.test(line)) {
        res.notes.push(F('AppX-Entfernung erkannt – bitte im Modul „Bloatware“ nachpflegen.'));
        res.custom.push(line); continue;
      }

      res.custom.push(line);
    }

    res.packages = dedupe(res.packages);
    return res;
  }

  /* ---------- ODT Configuration.xml ---------- */

  function parseOfficeConfig(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error(F('XML nicht lesbar'));
    const root = doc.documentElement;
    if (!root || root.nodeName !== 'Configuration') throw new Error(F('Kein <Configuration>-Element'));

    const add = root.querySelector('Add');
    const products = [];
    if (add) {
      for (const p of add.querySelectorAll('Product')) {
        products.push({
          id: p.getAttribute('ID') || '',
          languages: Array.from(p.querySelectorAll('Language')).map((l) => l.getAttribute('ID')).filter(Boolean),
          excluded: Array.from(p.querySelectorAll('ExcludeApp')).map((e) => e.getAttribute('ID')).filter(Boolean)
        });
      }
    }
    const display = root.querySelector('Display');
    return {
      id: root.getAttribute('ID') || '',
      edition: add ? (add.getAttribute('OfficeClientEdition') || '') : '',
      channel: add ? (add.getAttribute('Channel') || '') : '',
      version: add ? (add.getAttribute('Version') || '') : '',
      sourcePath: add ? (add.getAttribute('SourcePath') || '') : '',
      products,
      removeMSI: !!root.querySelector('RemoveMSI'),
      updatesEnabled: (() => { const u = root.querySelector('Updates'); return u ? u.getAttribute('Enabled') : null; })(),
      displayLevel: display ? display.getAttribute('Level') : null,
      acceptEula: display ? display.getAttribute('AcceptEULA') : null,
      appSettings: root.querySelectorAll('AppSettings User').length
    };
  }

  /* Ergänzt <Display Level="None" AcceptEULA="TRUE"/> für unbeaufsichtigte Installation */
  function ensureSilentDisplay(text) {
    if (/<Display\b/i.test(text)) {
      return text.replace(/<Display\b[^>]*\/?>/i, '<Display Level="None" AcceptEULA="TRUE" />');
    }
    return text.replace(/<\/Configuration>/i, '  <Display Level="None" AcceptEULA="TRUE" />\n</Configuration>');
  }

  /* ---------- autounattend.xml ---------- */

  const UNS = 'urn:schemas-microsoft-com:unattend';
  const WCM = 'http://schemas.microsoft.com/WMIConfig/2002/State';

  function parseUnattend(text) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error(F('XML nicht lesbar'));
    const root = doc.documentElement;
    if (!root || root.localName !== 'unattend') throw new Error(F('Kein <unattend>-Element'));

    const el = (sel) => root.getElementsByTagName(sel);
    const first = (sel) => (el(sel).length ? el(sel)[0] : null);
    const ucs = first('UseConfigurationSet');
    const passes = Array.from(root.children)
      .filter((e) => e.localName === 'settings')
      .map((e) => e.getAttribute('pass'));

    const key = first('Key');
    return {
      useConfigurationSet: !!(ucs && /true/i.test(ucs.textContent)),
      passes,
      productKey: key ? key.textContent.trim() : '',
      hasSpecializeRunSync: !!root.querySelector('settings[pass="specialize"] RunSynchronous'),
      hasFirstLogon: !!root.querySelector('settings[pass="oobeSystem"] FirstLogonCommands'),
      generator: (function () {
        const m = text.match(/schneegans\.de|unattend-generator|UnattendedWinstall/i);
        return m ? m[0] : '';
      })(),
      commandCount: root.getElementsByTagName('RunSynchronousCommand').length +
        root.getElementsByTagName('SynchronousCommand').length
    };
  }

  /* Fuegt die Aufrufe von Install.ps1 in eine bestehende autounattend.xml ein.
     Idempotent: eigene Eintraege werden zuvor entfernt, die Order neu vergeben. */
  function patchUnattend(text, commands, opts) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error(F('XML nicht lesbar'));
    const root = doc.documentElement;
    if (!root || root.localName !== 'unattend') throw new Error(F('Kein <unattend>-Element'));

    const MARK = 'OEM Setup Phase';

    const child = (parent, localName) =>
      Array.from(parent.children).find((e) => e.localName === localName) || null;

    const indentOf = (node) => {
      const prev = node.previousSibling;
      return prev && prev.nodeType === 3 && /\n[ \t]*$/.test(prev.nodeValue)
        ? prev.nodeValue.match(/\n([ \t]*)$/)[1] : '\t';
    };

    function make(localName, attrs) {
      const e = doc.createElementNS(UNS, localName);
      for (const k of Object.keys(attrs || {})) e.setAttribute(k, attrs[k]);
      return e;
    }

    function getSettings(pass) {
      let s = Array.from(root.children).find(
        (e) => e.localName === 'settings' && e.getAttribute('pass') === pass);
      if (!s) {
        s = make('settings', { pass: pass });
        root.appendChild(doc.createTextNode('\n\t'));
        root.appendChild(s);
      }
      return s;
    }

    function getComponent(settings, name) {
      let c = Array.from(settings.children).find(
        (e) => e.localName === 'component' && e.getAttribute('name') === name);
      if (!c) {
        c = make('component', {
          name: name, processorArchitecture: 'amd64',
          publicKeyToken: '31bf3856ad364e35', language: 'neutral', versionScope: 'nonSxS'
        });
        settings.appendChild(doc.createTextNode('\n\t\t'));
        settings.appendChild(c);
      }
      return c;
    }

    function getContainer(component, localName) {
      let c = child(component, localName);
      if (!c) {
        c = make(localName, {});
        component.appendChild(doc.createTextNode('\n\t\t\t'));
        component.appendChild(c);
      }
      return c;
    }

    /* eigene Alteintraege entfernen */
    function purge(container, itemName) {
      Array.from(container.children)
        .filter((e) => e.localName === itemName)
        .forEach((e) => {
          const d = child(e, 'Description');
          if (d && d.textContent.indexOf(MARK) === 0) {
            const prev = e.previousSibling;
            if (prev && prev.nodeType === 3 && !prev.nodeValue.trim()) prev.remove();
            e.remove();
          }
        });
    }

    function nextOrder(container, itemName) {
      let max = 0;
      Array.from(container.children).filter((e) => e.localName === itemName).forEach((e) => {
        const o = child(e, 'Order');
        const v = o ? parseInt(o.textContent, 10) : 0;
        if (v > max) max = v;
      });
      return max + 1;
    }

    function append(container, itemName, order, description, valueTag, value) {
      const pad = indentOf(container.firstElementChild || container);
      const item = make(itemName, {});
      item.setAttributeNS(WCM, 'wcm:action', 'add');
      const add = (tag, txt) => {
        const e = make(tag, {});
        e.textContent = txt;
        item.appendChild(doc.createTextNode('\n' + pad + '\t'));
        item.appendChild(e);
      };
      add('Order', String(order));
      add('Description', description);
      add(valueTag, value);
      if (itemName === 'SynchronousCommand') add('RequiresUserInput', 'false');
      item.appendChild(doc.createTextNode('\n' + pad));
      container.appendChild(doc.createTextNode('\n' + pad));
      container.appendChild(item);
      return item;
    }

    const applied = [];

    /*  windowsPE / Microsoft-Windows-Setup / UseConfigurationSet = true. Ohne
        diesen Wert hat ein aktuelles Windows-11-Setup $OEM$ nicht kopiert. */
    if (opts && opts.configSet) {
      const comp = getComponent(getSettings('windowsPE'), 'Microsoft-Windows-Setup');
      let ucs = child(comp, 'UseConfigurationSet');
      if (!ucs) {
        ucs = make('UseConfigurationSet', {});
        comp.appendChild(doc.createTextNode('\n' + indentOf(comp.firstElementChild || comp) + (comp.firstElementChild ? '' : '\t')));
        comp.appendChild(ucs);
      }
      if (ucs.textContent.trim().toLowerCase() !== 'true') {
        ucs.textContent = 'true';
        applied.push('windowsPE / UseConfigurationSet = true');
      }
    }
    /*  Zielsystem bis 23H2: true wuerde das ganze Medium nach ConfigSetRoot
        kopieren - einen vorhandenen Wert deshalb auf false setzen. */
    if (opts && opts.configSet === false) {
      const pe = Array.from(doc.getElementsByTagNameNS('*', 'settings')).find((x) => x.getAttribute('pass') === 'windowsPE');
      const comp = pe && Array.from(pe.getElementsByTagNameNS('*', 'component')).find((x) => x.getAttribute('name') === 'Microsoft-Windows-Setup');
      const ucs = comp && child(comp, 'UseConfigurationSet');
      if (ucs && ucs.textContent.trim().toLowerCase() === 'true') {
        ucs.textContent = 'false';
        applied.push('windowsPE / UseConfigurationSet = false');
      }
    }

    if (commands.setup) {
      const comp = getComponent(getSettings('specialize'), 'Microsoft-Windows-Deployment');
      const cont = getContainer(comp, 'RunSynchronous');
      purge(cont, 'RunSynchronousCommand');
      const order = nextOrder(cont, 'RunSynchronousCommand');
      append(cont, 'RunSynchronousCommand', order, MARK + ' 1', 'Path', commands.setup);
      applied.push('specialize / RunSynchronousCommand Order ' + order);
    }

    if (commands.logon) {
      const comp = getComponent(getSettings('oobeSystem'), 'Microsoft-Windows-Shell-Setup');
      const cont = getContainer(comp, 'FirstLogonCommands');
      purge(cont, 'SynchronousCommand');
      const order = nextOrder(cont, 'SynchronousCommand');
      append(cont, 'SynchronousCommand', order, MARK + ' 2', 'CommandLine', commands.logon);
      applied.push('oobeSystem / SynchronousCommand Order ' + order);
    }

    let out = new XMLSerializer().serializeToString(doc);
    if (!/^\s*<\?xml/.test(out)) out = '<?xml version="1.0" encoding="utf-8"?>\n' + out;
    /*  Windows Setup erwartet utf-8 im Kopf, verarbeitet aber nur ASCII
        zuverlaessig (so auch der Generator von Christoph Schneegans): alles
        andere als Zeichenreferenz. In CDATA-Abschnitten wirken Referenzen
        nicht - dort bleibt der Text unveraendert. */
    if (out.indexOf('<![CDATA[') < 0) {
      out = out.replace(/[^\x00-\x7F]/gu, (c) => '&#x' + c.codePointAt(0).toString(16).toUpperCase() + ';');
    }
    return { xml: out.replace(/\r?\n/g, '\r\n'), applied: applied };
  }

  /* ---------- Typerkennung ---------- */

  function detectType(filename, text) {
    const n = (filename || '').toLowerCase();
    const t = (text || '').replace(/^﻿/, '').trimStart();

    if (n.endsWith('.oemproj.json') || /"formatVersion"\s*:\s*\d/.test(t.slice(0, 400))) return 'project';
    if (n.endsWith('.ubundle')) return 'bundle';
    if (n.endsWith('.cmd') || n.endsWith('.bat')) return 'cmd';
    if (n.endsWith('.ps1')) return 'ps1';
    if (n.endsWith('.reg') || /^(Windows Registry Editor Version 5\.00|REGEDIT4)\s*$/im.test(t.slice(0, 80))) return 'reg';
    if (t.startsWith('<')) {
      if (/<Configuration[\s>]/i.test(t)) return 'officexml';
      if (/<Package[\s>]/i.test(t)) return 'bundle';
      if (/<unattend[\s>]/i.test(t)) return 'unattend';
      if (/<AppLockerPolicy[\s>/]/.test(t)) return 'applocker';
      if (/<WLANProfile[\s>/]/.test(t)) return 'wlan';
      return 'xml';
    }
    if (t.startsWith('{') || t.startsWith('[')) {
      if (/"packages"\s*:|"Sources"\s*:|"export_version"/.test(t)) return 'bundle';
      return 'json';
    }
    if (/\.ya?ml$/.test(n)) return 'bundle';
    return 'text';
  }


  /* ---------- .reg-Dateien (Registrierungs-Editor) ----------

     Unterstützt REGEDIT4 (ANSI) und "Windows Registry Editor Version 5.00"
     (UTF-16), Zeilenfortsetzung mit "\", Kommentare, den Standardwert "@",
     Löschungen von Werten ("Name"=-) und Schlüsseln ([-Schlüssel]) sowie die
     Typen REG_SZ, REG_EXPAND_SZ, REG_MULTI_SZ, REG_DWORD, REG_QWORD und
     REG_BINARY. Seltene Typen (REG_NONE, Big-Endian ...) werden als Binärwert
     übernommen - mit Warnung, weil sich der Typ dabei ändert.

     Ziel ist das Modell der Tweaks: scope 'machine' oder 'user' plus Pfad
     relativ zum Zweig. HKCU landet damit wie jeder Benutzer-Tweak im
     Default-Profil bzw. bei allen Benutzern - ein schlichtes "reg import" als
     SYSTEM schriebe dagegen in das Profil von SYSTEM.  */

  /* Bytes einer .reg-Datei in Text: BOM entscheidet, sonst UTF-8, notfalls ANSI. */
  function decodeRegBytes(bytes) {
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) return new TextDecoder('utf-8').decode(bytes.subarray(3));
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch (e) { return new TextDecoder('windows-1252').decode(bytes); }
  }

  const REG_HIVES = {
    HKEY_LOCAL_MACHINE: 'HKLM', HKLM: 'HKLM',
    HKEY_CURRENT_USER: 'HKCU', HKCU: 'HKCU',
    HKEY_CLASSES_ROOT: 'HKCR', HKCR: 'HKCR',
    HKEY_CURRENT_CONFIG: 'HKCC', HKCC: 'HKCC',
    HKEY_USERS: 'HKU', HKU: 'HKU'
  };

  /* Vollständigen Schlüssel auf scope + Pfad abbilden; null + Grund, wenn nicht übertragbar. */
  function mapRegKey(full) {
    const parts = full.split('\\').filter(Boolean);
    const hive = REG_HIVES[(parts.shift() || '').toUpperCase()];
    const rest = parts.join('\\');
    if (!hive) return { skip: 'unbekannter Zweig' };
    if (hive === 'HKLM') return rest ? { scope: 'machine', path: rest, hive } : { skip: 'Wurzel von HKLM' };
    if (hive === 'HKCU') return rest ? { scope: 'user', path: rest, hive } : { skip: 'Wurzel von HKCU' };
    if (hive === 'HKCR') return { scope: 'machine', path: 'SOFTWARE\\Classes' + (rest ? '\\' + rest : ''), hive };
    if (hive === 'HKCC') return { scope: 'machine', path: 'SYSTEM\\CurrentControlSet\\Hardware Profiles\\Current' + (rest ? '\\' + rest : ''), hive };
    if (parts[0] && parts[0].toUpperCase() === '.DEFAULT') return { skip: 'HKEY_USERS\\.DEFAULT ist das Profil des SYSTEM-Kontos' };
    return { skip: 'HKEY_USERS mit Benutzer-SID – auf einem neuen System nicht übertragbar' };
  }

  function regUnescape(s) { return s.replace(/\\(["\\])/g, '$1'); }

  /* Ab pos eine Zeichenkette in Anführungszeichen lesen: [Wert, Ende] */
  function regQuoted(line, pos) {
    let out = '', i = pos + 1;
    for (; i < line.length; i++) {
      const c = line[i];
      if (c === '\\' && i + 1 < line.length) { out += line[i + 1]; i++; continue; }
      if (c === '"') return [out, i + 1];
      out += c;
    }
    return null;
  }

  function hexBytes(s) {
    const t = s.replace(/[\s\\]/g, '');
    if (!t) return [];
    return t.split(',').filter((x) => x !== '').map((x) => {
      if (!/^[0-9a-f]{1,2}$/i.test(x)) throw new Error('ungültiges Byte "' + x + '"');
      return parseInt(x, 16);
    });
  }

  function bytesToString(bytes, unicode) {
    const u8 = new Uint8Array(bytes);
    const txt = unicode ? new TextDecoder('utf-16le').decode(u8) : new TextDecoder('windows-1252').decode(u8);
    return txt;
  }

  function parseReg(text, filename) {
    const src = String(text || '').replace(/^\uFEFF/, '');
    const raw = src.split(/\r\n|\r|\n/);
    let i = 0;
    while (i < raw.length && !raw[i].trim()) i++;
    const header = (raw[i] || '').trim();
    let unicode;
    if (/^Windows Registry Editor Version 5\.00$/i.test(header)) unicode = true;
    else if (/^REGEDIT4$/i.test(header)) unicode = false;
    else throw new Error('Keine .reg-Datei (Kopfzeile „Windows Registry Editor Version 5.00“ bzw. „REGEDIT4“ fehlt).');

    /* Logische Zeilen: Fortsetzung mit "\" am Zeilenende */
    const lines = [];
    let buf = null, start = 0;
    for (i = i + 1; i < raw.length; i++) {
      const l = raw[i];
      if (buf !== null) {
        const t = l.trim();
        if (/\\$/.test(t)) { buf += t.slice(0, -1); continue; }
        lines.push([buf + t, start]); buf = null; continue;
      }
      const t = l.replace(/^\s+/, '');
      if (/^[^;[].*\\$/.test(t.trimEnd()) && /=\s*hex/i.test(t)) { buf = t.trimEnd().slice(0, -1); start = i + 1; continue; }
      lines.push([l, i + 1]);
    }
    if (buf !== null) lines.push([buf, start]);

    const entries = [], warnings = [];
    let key = null;   // { full, map, del }
    const warn = (ln, msg) => warnings.push((filename ? filename + ', ' : '') + 'Zeile ' + ln + ': ' + msg);

    for (const [line, ln] of lines) {
      const t = line.trim();
      if (!t || t.startsWith(';')) continue;
      if (t.startsWith('[')) {
        const m = t.match(/^\[(-?)\s*([^\]]+?)\s*\]$/);
        if (!m) { warn(ln, 'ungültige Schlüsselzeile'); key = null; continue; }
        const map = mapRegKey(m[2]);
        key = { full: m[2], map, del: !!m[1] };
        if (map.skip) { warn(ln, m[2] + ' übersprungen – ' + map.skip); continue; }
        if (key.del) {
          if (map.path.split('\\').length < 2) { warn(ln, 'Löschen von ' + m[2] + ' verweigert – Schlüssel zu weit oben'); key.map = { skip: 'gesperrt' }; continue; }
          entries.push({ op: 'delkey', scope: map.scope, path: map.path, hive: map.hive, line: ln, enabled: true });
        }
        continue;
      }
      if (!key) { warn(ln, 'Wert ohne Schlüssel übersprungen'); continue; }
      if (key.map.skip) continue;
      if (key.del) { warn(ln, 'Wert unter einem zu löschenden Schlüssel ignoriert'); continue; }

      let name, pos;
      if (t.startsWith('@')) { name = '(Default)'; pos = 1; }
      else if (t.startsWith('"')) {
        const q = regQuoted(t, 0);
        if (!q) { warn(ln, 'Name ohne schließendes Anführungszeichen'); continue; }
        name = q[0]; pos = q[1];
      } else { warn(ln, 'unbekannte Zeile übersprungen'); continue; }
      const rest = t.slice(pos).replace(/^\s*=\s*/, '');
      if (rest === t.slice(pos)) { warn(ln, 'Gleichheitszeichen fehlt'); continue; }

      const base = { scope: key.map.scope, path: key.map.path, hive: key.map.hive, name, line: ln, enabled: true };
      try {
        if (rest === '-') { entries.push(Object.assign(base, { op: 'delvalue' })); continue; }
        if (rest.startsWith('"')) {
          const q = regQuoted(rest, 0);
          if (!q) throw new Error('Zeichenkette ohne schließendes Anführungszeichen');
          entries.push(Object.assign(base, { op: 'set', type: 'String', value: q[0] }));
          continue;
        }
        let m = rest.match(/^dword:([0-9a-f]{1,8})$/i);
        if (m) { entries.push(Object.assign(base, { op: 'set', type: 'DWord', value: parseInt(m[1], 16) })); continue; }
        m = rest.match(/^hex(?:\(([0-9a-f]+)\))?:(.*)$/i);
        if (!m) throw new Error('unbekanntes Datenformat');
        const kind = m[1] === undefined ? 3 : parseInt(m[1], 16);
        const bytes = hexBytes(m[2]);
        if (kind === 1 || kind === 2) {
          const sv = bytesToString(bytes, unicode).replace(/\u0000+$/, '');
          entries.push(Object.assign(base, { op: 'set', type: kind === 1 ? 'String' : 'ExpandString', value: sv }));
        } else if (kind === 7) {
          const parts = bytesToString(bytes, unicode).split('\u0000');
          while (parts.length && parts[parts.length - 1] === '') parts.pop();
          entries.push(Object.assign(base, { op: 'set', type: 'MultiString', value: parts }));
        } else if (kind === 4 && bytes.length === 4) {
          entries.push(Object.assign(base, { op: 'set', type: 'DWord', value: (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16)) + bytes[3] * 0x1000000 }));
        } else if (kind === 0xb && bytes.length === 8) {
          let v = 0n;
          for (let k = 7; k >= 0; k--) v = (v << 8n) | BigInt(bytes[k]);
          entries.push(Object.assign(base, { op: 'set', type: 'QWord', value: v.toString() }));
        } else {
          if (kind !== 3) warn(ln, name + ': Typ hex(' + m[1] + ') wird als REG_BINARY geschrieben');
          entries.push(Object.assign(base, { op: 'set', type: 'Binary', value: bytes }));
        }
      } catch (e) {
        warn(ln, name + ': ' + e.message);
      }
    }
    return { entries, warnings, unicode };
  }

  global.Importers = {
    parseBundle, parseSetupComplete, parseOfficeConfig, parseUnattend, patchUnattend,
    ensureSilentDisplay, detectType, normManager, mkPkg, dedupe, parseReg, decodeRegBytes
  };
})(window);
