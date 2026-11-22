/*  Antwortdatei-Generator - Kern.

    Port von https://github.com/cschneegans/unattend-generator (Main.cs,
    Util.cs, Extensions.cs, Validation.cs, modifier/Pretty.cs).
    Copyright (c) Christoph Schneegans, MIT-Lizenz (vendor/schneegans/LICENSE.txt).
    Port-Stand: siehe vendor/schneegans/UPSTREAM.json.

    Die Struktur folgt dem Original, damit sich Aenderungen dort Datei fuer
    Datei nachziehen lassen: eine XML-Vorlage (resource/autounattend.xml), die
    nacheinander von "Modifiern" bearbeitet wird (js/ug/modifiers.js).
    Abweichungen vom Original sind mit "PORT:" markiert.

    Laeuft im Browser (DOMParser, XPath, XMLSerializer gibt es dort). */
(function (global) {
  'use strict';

  const NS = {
    u: 'urn:schemas-microsoft-com:unattend',
    wcm: 'http://schemas.microsoft.com/WMIConfig/2002/State',
    s: 'https://schneegans.de/windows/unattend-generator/'
  };
  const CRLF = '\r\n';

  class ConfigurationException extends Error {
    constructor(message) { super(message); this.name = 'ConfigurationException'; }
  }

  /* ---------------- Ressourcen und Nachschlagen ---------------- */

  function res(name) {
    const r = global.UGResources && global.UGResources[name];
    if (r === undefined) throw new Error('Ressource ' + name + ' fehlt (js/ug/resources.js).');
    return r;
  }

  /* Main.cs: UnattendGenerator - Tabellen nach Id, Schluessel ohne Gross-/Kleinschreibung */
  const tables = {};
  function table(name) {
    if (!tables[name]) {
      const map = new Map();
      res(name + '.json').forEach((e) => map.set(String(e.Id).toLowerCase(), e));
      tables[name] = map;
    }
    return tables[name];
  }
  function lookup(name, id) {
    const e = table(name).get(String(id).toLowerCase());
    if (!e) throw new ConfigurationException("Could not find an element of type '" + name + "' with key '" + id + "'.");
    return e;
  }
  function list(name) { return Array.from(table(name).values()); }

  /* ---------------- Validation.cs ---------------- */

  function inRange(value, min, max, field) {
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
      throw new ConfigurationException("Parameter '" + field + "' must be set.");
    }
    const v = Number(value);
    if (v < min) throw new ConfigurationException("Value of parameter '" + field + "' must not be less than " + min + ', but was ' + v + '.');
    if (v > max) throw new ConfigurationException("Value of parameter '" + field + "' must not be greater than " + max + ', but was ' + v + '.');
    return v;
  }

  /* ---------------- XML-Hilfen (Util.cs, Extensions.cs) ---------------- */

  function resolver(prefix) { return NS[prefix] || null; }

  function selectSingle(node, xpath) {
    const doc = node.ownerDocument || node;
    return doc.evaluate(xpath, node, resolver, 9 /* FIRST_ORDERED_NODE_TYPE */, null).singleNodeValue;
  }
  function selectSingleOrThrow(node, xpath) {
    const n = selectSingle(node, xpath);
    if (!n) throw new Error("No node matches XPath '" + xpath + "'.");
    return n;
  }
  function selectAll(node, xpath) {
    const doc = node.ownerDocument || node;
    const r = doc.evaluate(xpath, node, resolver, 7 /* ORDERED_NODE_SNAPSHOT_TYPE */, null);
    const out = [];
    for (let i = 0; i < r.snapshotLength; i++) out.push(r.snapshotItem(i));
    return out;
  }
  function removeSelf(node) { node.parentNode.removeChild(node); }

  function getOrCreateComponent(doc, pass, component) {
    const setting = selectSingleOrThrow(doc, "/u:unattend/u:settings[@pass='" + pass + "']");
    let elem = selectSingle(setting, "u:component[@name='" + component + "']");
    if (!elem) {
      elem = doc.createElementNS(NS.u, 'component');
      elem.setAttribute('name', component);
      elem.setAttribute('processorArchitecture', 'x86');
      elem.setAttribute('publicKeyToken', '31bf3856ad364e35');
      elem.setAttribute('language', 'neutral');
      elem.setAttribute('versionScope', 'nonSxS');
      setting.appendChild(elem);
    }
    return elem;
  }
  function getOrCreateElement(doc, pass, component, element) {
    const comp = getOrCreateComponent(doc, pass, component);
    if (!element) return comp;
    let elem = selectSingle(comp, 'u:' + element);
    if (!elem) {
      elem = doc.createElementNS(NS.u, element);
      comp.appendChild(elem);
    }
    return elem;
  }
  function newElement(doc, name, parent) {
    const e = doc.createElementNS(NS.u, name);
    parent.appendChild(e);
    return e;
  }
  function newSimpleElement(doc, name, parent, text) {
    const e = newElement(doc, name, parent);
    e.textContent = text;
    return e;
  }
  /* Extensions.cs: InsertTextWithIndentation */
  function insertTextWithIndentation(element, text) {
    let level = 0;
    for (let p = element.parentNode; p && p.nodeType === 1; p = p.parentNode) level++;
    element.appendChild(element.ownerDocument.createTextNode(CRLF + text.trim() + CRLF + '\t'.repeat(level)));
  }

  function splitLines(s) { return String(s).split(/\r\n|\r|\n/); }

  /* ---------------- Befehle (Main.cs: CommandConfig, CommandBuilder) ---------------- */

  const CommandConfig = {
    windowsPE: (doc) => {
      const container = getOrCreateElement(doc, 'windowsPE', 'Microsoft-Windows-Setup', 'RunSynchronous');
      return newElement(doc, 'Path', newElement(doc, 'RunSynchronousCommand', container));
    },
    specialize: (doc) => {
      const container = getOrCreateElement(doc, 'specialize', 'Microsoft-Windows-Deployment', 'RunSynchronous');
      return newElement(doc, 'Path', newElement(doc, 'RunSynchronousCommand', container));
    },
    oobe: (doc) => {
      const container = getOrCreateElement(doc, 'oobeSystem', 'Microsoft-Windows-Shell-Setup', 'FirstLogonCommands');
      return newElement(doc, 'CommandLine', newElement(doc, 'SynchronousCommand', container));
    }
  };

  function appender(doc, config) {
    const one = (value) => { config(doc).textContent = value; };
    return { append: (v) => (Array.isArray(v) ? v.forEach(one) : one(v)) };
  }

  /* Main.cs: EchoProcessor - Zeilen sicher als echo-Befehle fuer eine .cmd-Datei */
  const RESERVED = new Set(['^', '&', '<', '>', '|', '%', ')', '"']);
  function echoProcess(lines, escape) {
    return lines.map((l) => l.trim()).filter((l) => l.length > 0)
      .map((l) => (escape === false ? l : Array.from(l).map((ch) => (RESERVED.has(ch) ? '^' : '') + ch).join('')))
      .map((l) => 'echo:' + l);
  }

  /* Wie StringReader.ReadLine: \r\n, \n oder \r; ein abschliessender Umbruch ergibt keine leere Zeile. */
  function csSplitLines(text) {
    const lines = String(text).split(/\r\n|\n|\r/);
    if (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  function commandBuilder(hidePowerShellWindows) {
    const style = hidePowerShellWindows ? 'Hidden' : 'Normal';
    return {
      raw: (c) => c,
      shellCommand: (c) => 'cmd.exe /c "' + c + '"',
      registryCommand: (v) => 'reg.exe ' + v,
      powerShellCommand(value) {
        if (value.includes('"')) throw new Error("PowerShell command '" + value + "' must not contain '\"'.");
        if (!value.endsWith(';') && !value.endsWith('}')) throw new Error("PowerShell command '" + value + "' must end with either ';' or '}'.");
        return 'powershell.exe -WindowStyle "' + style + '" -NoProfile -Command "' + value + '"';
      },
      invokePowerShellScript: (f) => 'powershell.exe -WindowStyle "' + style + '" -ExecutionPolicy "Unrestricted" -NoProfile -File "' + f + '"',
      invokeVBScript: (f) => 'cscript.exe //E:vbscript "' + f + '"',
      /* Main.cs: WriteToFilePE - Befehle zu je hoechstens 255 Zeichen, die die
         Datei Zeile fuer Zeile anhaengen. */
      writeToFilePE(path, lines) {
        if (/\s/.test(path)) throw new Error("Path '" + path + "' must not contain whitespace characters.");
        const maxLineLength = 255;
        const segments = echoProcess(lines);
        const result = [];
        while (segments.length > 0) {
          let prev = null, current = null;
          for (let take = 1; take <= segments.length; take++) {
            current = 'cmd.exe /c >>' + path + ' (' + segments.slice(0, take).join('&') + ')';
            if (current.length > maxLineLength) {
              if (prev === null) {
                throw new ConfigurationException("Line '" + current + "' is too long. You need to add line breaks to your input to make it shorter.");
              }
              result.push(prev);
              segments.splice(0, take - 1);
              current = null;
              break;
            }
            prev = current;
          }
          if (current !== null) { result.push(current); break; }
        }
        return result;
      }
    };
  }

  /* ---------------- PowerShellSequence ---------------- */

  class PowerShellSequence {
    constructor(activity, logFile) {
      this.activity = activity; this.logFile = logFile;
      this.commands = []; this.needsExplorerRestart = false;
    }
    append(command) { this.commands.push(command); }
    invokeFile(file) { this.append("& '" + file + "';"); }
    restartExplorer() { this.needsExplorerRestart = true; }
    get isEmpty() { return this.commands.length === 0; }
    getScript() {
      const lines = [];
      const block = (command) => {
        lines.push('\t{');
        splitLines(command).forEach((l) => lines.push('\t\t' + l));
        lines.push('\t};');
      };
      lines.push('$scripts = @(');
      this.commands.forEach(block);
      if (this.needsExplorerRestart) block(res('RestartExplorer.ps1'));
      lines.push(');');
      lines.push('');
      lines.push(
        '& {',
        '  [float] $complete = 0;',
        '  [float] $increment = 100 / $scripts.Count;',
        '  foreach( $script in $scripts ) {',
        "    Write-Progress -Id 0 -Activity '" + this.activity + " Do not close this window.' -PercentComplete $complete;",
        "    '*** Will now execute command «{0}».' -f $(",
        "      $script.ToString().Trim() -replace '\\s+', ' ' -replace '^(.{99})(.+)$', '$1…';",
        '    );',
        '    $start = [datetime]::Now;',
        '    & $script;',
        "    '*** Finished executing command after {0:0} ms.' -f [datetime]::Now.Subtract( $start ).TotalMilliseconds;",
        '    "`r`n" * 3;',
        '    $complete += $increment;',
        '  }',
        '} *>&1 | Out-String -Width 1KB -Stream >> "' + this.logFile + '";');
      return lines.join(CRLF) + CRLF;
    }
  }
  const sequences = {
    specialize: () => new PowerShellSequence('Running scripts to customize your Windows installation.', 'C:\\Windows\\Setup\\Scripts\\Specialize.log'),
    firstLogon: () => new PowerShellSequence('Running scripts to finalize your Windows installation.', 'C:\\Windows\\Setup\\Scripts\\FirstLogon.log'),
    userOnce: () => new PowerShellSequence('Running scripts to configure this user account.', '$env:TEMP\\UserOnce.log'),
    defaultUser: () => new PowerShellSequence('Running scripts to modify the default user\u2019\u2019s registry hive.', 'C:\\Windows\\Setup\\Scripts\\DefaultUser.log')
  };

  /* ---------------- Kontext der Modifier (Main.cs: ModifierContext, Modifier) ---------------- */

  function makeContext(config, doc) {
    const ctx = {
      config, doc,
      cb: commandBuilder(!!config.hidePowerShellWindows),
      specializeScript: sequences.specialize(),
      firstLogonScript: sequences.firstLogon(),
      userOnceScript: sequences.userOnce(),
      defaultUserScript: sequences.defaultUser(),
      sel: (xpath, node) => selectSingleOrThrow(node || doc, xpath),
      selOpt: (xpath, node) => selectSingle(node || doc, xpath),
      selAll: (xpath, node) => selectAll(node || doc, xpath),
      newElement: (name, parent) => newElement(doc, name, parent),
      newSimpleElement: (name, parent, text) => newSimpleElement(doc, name, parent, text),
      getOrCreateElement: (pass, component, element) => getOrCreateElement(doc, pass, component, element),
      appender: (which) => appender(doc, CommandConfig[which]),
      insertTextWithIndentation
    };

    /* Main.cs: EmbedFile - Dateien in <Extensions> ablegen; ExtractScripts.ps1
       schreibt sie im specialize-Pass auf die Platte. */
    function embedFile(name, content) {
      const path = name.includes('\\') ? name : 'C:\\Windows\\Setup\\Scripts\\' + name;
      const extensions = ctx.sel('/u:unattend/s:Extensions');
      let extract = ctx.selOpt('s:ExtractScript', extensions);
      if (!extract) {
        extract = doc.createElementNS(NS.s, 'ExtractScript');
        extensions.appendChild(extract);
        insertTextWithIndentation(extract, res('ExtractScripts.ps1'));
        ctx.appender('specialize').append(ctx.cb.powerShellCommand(
          "$xml = [xml]::new(); $xml.Load('C:\\Windows\\Panther\\unattend.xml'); $sb = [scriptblock]::Create( $xml.unattend.Extensions.ExtractScript ); Invoke-Command -ScriptBlock $sb -ArgumentList $xml;"));
      }
      const file = doc.createElementNS(NS.s, 'File');
      file.setAttribute('path', path);
      extensions.appendChild(file);
      insertTextWithIndentation(file, content);
      return path;
    }
    ctx.embedTextFile = (name, content, before, after) =>
      embedFile(name, (before || '') + content + CRLF + (after || ''));
    ctx.embedTextFileFromResource = (name) => ctx.embedTextFile(name, res(name));
    return ctx;
  }

  /* ---------------- Vorlage laden, Modifier ausfuehren ---------------- */

  /* Wie XmlDocument ohne PreserveWhitespace: reine Leerraum-Textknoten fallen weg. */
  function stripWhitespace(node) {
    for (let c = node.firstChild; c;) {
      const next = c.nextSibling;
      if (c.nodeType === 3 && !/\S/.test(c.nodeValue)) node.removeChild(c);
      else if (c.nodeType === 1) stripWhitespace(c);
      c = next;
    }
  }

  function loadTemplate() {
    const doc = new DOMParser().parseFromString(res('autounattend.xml'), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Vorlage autounattend.xml nicht lesbar.');
    stripWhitespace(doc.documentElement);
    return doc;
  }

  /*  Main.cs: GenerateXml. "modifiers" ist die Liste aus js/ug/modifiers.js in
      der Reihenfolge des Originals. PORT: keine Pruefung gegen autounattend.xsd. */
  function generate(config) {
    const doc = loadTemplate();
    const ctx = makeContext(config, doc);
    for (const m of global.UG.modifiers) m.process(ctx);
    return doc;
  }

  /* ---------------- Serialisieren (UnattendGenerator.Serialize, PrettyModifier) ----------------
     Wie XmlWriter mit Indent=true, IndentChars="\t", NewLineChars="\r\n",
     Encoding=ASCII: Elemente ohne Textinhalt werden eingerueckt, Elemente mit
     Text (gemischter Inhalt) nicht; leere Elemente als <a></a> (IsEmpty=false);
     alles ausserhalb von ASCII als Zeichenreferenz - Windows Setup erwartet
     utf-8 im Kopf, verarbeitet aber nur ASCII zuverlaessig. */
  function escText(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/[^\x00-\x7F]/gu, (c) => '&#x' + c.codePointAt(0).toString(16).toUpperCase() + ';');
  }
  function escAttr(s) { return escText(s).replace(/"/g, '&quot;'); }

  function serialize(doc) {
    const out = ['<?xml version="1.0" encoding="utf-8"?>' + CRLF];
    function nsDecls(el) {
      let s = '';
      const parent = el.parentNode && el.parentNode.nodeType === 1 ? el.parentNode : null;
      if (!parent || parent.namespaceURI !== el.namespaceURI) s += ' xmlns="' + el.namespaceURI + '"';
      if (!parent) s += ' xmlns:wcm="' + NS.wcm + '"';
      return s;
    }
    function attrs(el) {
      let s = '';
      for (const a of Array.from(el.attributes)) {
        if (a.name === 'xmlns' || a.name.startsWith('xmlns:')) continue;
        const name = a.namespaceURI === NS.wcm ? 'wcm:' + a.localName : a.name;
        s += ' ' + name + '="' + escAttr(a.value) + '"';
      }
      return s;
    }
    function write(el, depth, mixed) {
      const indent = mixed ? '' : CRLF + '\t'.repeat(depth);
      const open = '<' + el.localName + nsDecls(el) + attrs(el) + '>';
      out.push((depth === 0 ? '' : indent) + open);
      const kids = Array.from(el.childNodes).filter((c) => c.nodeType === 1 || c.nodeType === 3);
      const hasText = kids.some((c) => c.nodeType === 3);
      for (const c of kids) {
        /* NewLineHandling.Replace: Zeilenumbrueche im Text werden zu \r\n */
        if (c.nodeType === 3) out.push(escText(c.nodeValue.replace(/\r\n|\r|\n/g, CRLF)));
        else write(c, depth + 1, mixed || hasText);
      }
      const closeIndent = !mixed && !hasText && kids.length ? CRLF + '\t'.repeat(depth) : '';
      out.push(closeIndent + '</' + el.localName + '>');
    }
    write(doc.documentElement, 0, false);
    return out.join('');
  }

  global.UG = {
    NS, ConfigurationException, res, lookup, list, inRange, generate, serialize,
    selectSingle, selectAll, splitLines, csSplitLines, echoProcess, modifiers: [],
    portCommit: global.UGPort ? global.UGPort.commit : null
  };
})(typeof window !== 'undefined' ? window : globalThis);
