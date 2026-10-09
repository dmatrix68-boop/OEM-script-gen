/* Importer für UniGetUI-Bundles, winget-Exporte, SetupComplete.cmd und ODT-Configuration.xml */
(function (global) {
  'use strict';

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
    throw new Error('Unbekanntes Bundle-Format');
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
      if (m) { res.officeConfigName = m[1].replace(/.*[\\/]/, ''); res.notes.push('Office-Installation (ODT) erkannt: ' + m[1]); continue; }

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
      if (m) { res.scripts.push(m[1]); res.notes.push('PowerShell-Aufruf erkannt: ' + m[1]); continue; }

      // DISM / AppX-Entfernung
      if (/Remove-AppxPackage|Remove-AppxProvisionedPackage/i.test(line)) {
        res.notes.push('AppX-Entfernung erkannt – bitte im Modul „Bloatware“ nachpflegen.');
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
    if (doc.querySelector('parsererror')) throw new Error('XML nicht lesbar');
    const root = doc.documentElement;
    if (!root || root.nodeName !== 'Configuration') throw new Error('Kein <Configuration>-Element');

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
    if (doc.querySelector('parsererror')) throw new Error('XML nicht lesbar');
    const root = doc.documentElement;
    if (!root || root.localName !== 'unattend') throw new Error('Kein <unattend>-Element');

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
  function patchUnattend(text, commands) {
    const doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('XML nicht lesbar');
    const root = doc.documentElement;
    if (!root || root.localName !== 'unattend') throw new Error('Kein <unattend>-Element');

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
    if (t.startsWith('<')) {
      if (/<Configuration[\s>]/i.test(t)) return 'officexml';
      if (/<Package[\s>]/i.test(t)) return 'bundle';
      if (/<unattend[\s>]/i.test(t)) return 'unattend';
      return 'xml';
    }
    if (t.startsWith('{') || t.startsWith('[')) {
      if (/"packages"\s*:|"Sources"\s*:|"export_version"/.test(t)) return 'bundle';
      return 'json';
    }
    if (/\.ya?ml$/.test(n)) return 'bundle';
    return 'text';
  }

  global.Importers = {
    parseBundle, parseSetupComplete, parseOfficeConfig, parseUnattend, patchUnattend,
    ensureSilentDisplay, detectType, normManager, mkPkg, dedupe
  };
})(window);
