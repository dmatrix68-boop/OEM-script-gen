/* OEM Script Generator – Oberfläche, Zustand, Import und Export */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  const OFFICE_TEMPLATE = [
    '<Configuration ID="oem-script-generator">',
    '  <Add OfficeClientEdition="64" Channel="Current">',
    '    <Product ID="O365ProPlusRetail">',
    '      <Language ID="de-de" />',
    '      <ExcludeApp ID="Groove" />',
    '      <ExcludeApp ID="Lync" />',
    '    </Product>',
    '  </Add>',
    '  <Updates Enabled="TRUE" />',
    '  <RemoveMSI />',
    '  <Display Level="None" AcceptEULA="TRUE" />',
    '  <Property Name="AUTOACTIVATE" Value="1" />',
    '</Configuration>'
  ].join('\n');

  function defaultState() {
    return {
      formatVersion: 1,
      meta: { name: 'MusterPC' },
      paths: { installRoot: 'C:\\Install', zipRoot: 'both' },
      options: {
        transcript: true, selfDelete: false, cleanupInstall: false,
        toastOnFinish: false, phase2Runner: 'task', finish: 'none', trigger: 'both'
      },
      unattend: { xml: null, name: '', info: null },
      apps: {
        enabled: true, phase: 'firstlogon', method: 'individual', retries: 2,
        waitNetwork: true, sourceUpdate: true, bootstrap: true,
        pinVersions: false, machineScope: false, items: []
      },
      office: {
        enabled: false, phase: 'setup', setupSource: 'bundled',
        odtUrl: 'https://officecdn.microsoft.com/pr/wsus/setup.exe',
        xml: OFFICE_TEMPLATE, checkInstalled: true
      },
      tweaks: {
        enabled: true, phase: 'setup', allUsers: true,
        selected: ['fileExt', 'hiddenFiles', 'launchToThisPC', 'longPaths', 'taskbarSearch', 'clockSeconds']
      },
      bloat: { enabled: false, phase: 'setup', provisioned: true, selected: [] },
      files: { items: [] },
      custom: { cmdEnabled: true, cmd: '', psEnabled: true, psPhase: 'setup', ps: '' }
    };
  }

  let state = defaultState();
  let previewFiles = [];
  let previewActive = null;

  /* ---------------- Infrastruktur ---------------- */

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast ' + (kind || '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 250); }, 4200);
  }

  function logImport(msg, kind) {
    const ul = $('#importLog');
    const first = ul.querySelector('.muted');
    if (first) first.remove();
    const li = document.createElement('li');
    li.className = kind || 'ok';
    li.textContent = msg;
    ul.insertBefore(li, ul.firstChild);
  }

  function get(path) { return path.split('.').reduce((o, k) => (o || {})[k], state); }
  function set(path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    parts.reduce((o, k) => o[k], state)[last] = value;
  }

  /* Zwei-Wege-Bindung für einfache Felder */
  const BINDINGS = [
    ['projectName', 'meta.name', 'text'],
    ['appsEnabled', 'apps.enabled', 'bool'],
    ['appsPhase', 'apps.phase', 'text'],
    ['appsMethod', 'apps.method', 'text'],
    ['appsRetries', 'apps.retries', 'num'],
    ['appsWaitNetwork', 'apps.waitNetwork', 'bool'],
    ['appsSourceUpdate', 'apps.sourceUpdate', 'bool'],
    ['appsBootstrap', 'apps.bootstrap', 'bool'],
    ['appsPinVersions', 'apps.pinVersions', 'bool'],
    ['appsMachineScope', 'apps.machineScope', 'bool'],
    ['officeEnabled', 'office.enabled', 'bool'],
    ['officePhase', 'office.phase', 'text'],
    ['officeSetupSource', 'office.setupSource', 'text'],
    ['officeOdtUrl', 'office.odtUrl', 'text'],
    ['officeCheckInstalled', 'office.checkInstalled', 'bool'],
    ['officeXml', 'office.xml', 'text'],
    ['tweaksEnabled', 'tweaks.enabled', 'bool'],
    ['tweaksPhase', 'tweaks.phase', 'text'],
    ['tweaksAllUsers', 'tweaks.allUsers', 'bool'],
    ['bloatEnabled', 'bloat.enabled', 'bool'],
    ['bloatPhase', 'bloat.phase', 'text'],
    ['bloatProvisioned', 'bloat.provisioned', 'bool'],
    ['customCmdEnabled', 'custom.cmdEnabled', 'bool'],
    ['customCmd', 'custom.cmd', 'text'],
    ['customPsEnabled', 'custom.psEnabled', 'bool'],
    ['customPsPhase', 'custom.psPhase', 'text'],
    ['customPs', 'custom.ps', 'text'],
    ['setInstallRoot', 'paths.installRoot', 'text'],
    ['setZipRoot', 'paths.zipRoot', 'text'],
    ['setTrigger', 'options.trigger', 'text'],
    ['setPhase2Runner', 'options.phase2Runner', 'text'],
    ['setFinish', 'options.finish', 'text'],
    ['setTranscript', 'options.transcript', 'bool'],
    ['setSelfDelete', 'options.selfDelete', 'bool'],
    ['setKeepInstall', 'options.cleanupInstall', 'bool'],
    ['setToastOnFinish', 'options.toastOnFinish', 'bool']
  ];

  function bindAll() {
    for (const [id, path, type] of BINDINGS) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener(type === 'bool' ? 'change' : 'input', () => {
        set(path, type === 'bool' ? el.checked : type === 'num' ? parseInt(el.value, 10) || 0 : el.value);
        if (id === 'officeXml') renderOfficeSummary();
        if (id === 'tweaksPhase') renderTweaks();
        refresh();
      });
    }
  }

  function syncInputs() {
    for (const [id, path, type] of BINDINGS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const v = get(path);
      if (type === 'bool') el.checked = !!v; else el.value = v === undefined || v === null ? '' : v;
    }
  }

  /* ---------------- Navigation ---------------- */

  function setView(name) {
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + name));
    if (name === 'preview') renderPreview();
    if (name === 'overview') renderOverview();
  }

  /* ---------------- Anwendungen ---------------- */

  function renderApps() {
    const tbody = $('#appsTable tbody');
    const filter = ($('#appsFilter').value || '').toLowerCase();
    tbody.innerHTML = '';

    const list = state.apps.items.filter((p) =>
      !filter || (p.name + ' ' + p.id + ' ' + p.manager).toLowerCase().includes(filter));

    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="muted" style="padding:18px;text-align:center">' +
        (state.apps.items.length ? 'Keine Treffer.' : 'Noch keine Pakete – UniGetUI-Bundle importieren oder Paket hinzufügen.') + '</td>';
      tbody.appendChild(tr);
    }

    for (const p of list) {
      const tr = document.createElement('tr');
      tr.className = p.enabled ? '' : 'off';

      const cbTd = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = p.enabled;
      cb.addEventListener('change', () => { p.enabled = cb.checked; tr.className = p.enabled ? '' : 'off'; refresh(); });
      cbTd.appendChild(cb);
      tr.appendChild(cbTd);

      const mkInput = (value, onChange, cls) => {
        const td = document.createElement('td');
        const inp = document.createElement('input');
        inp.type = 'text'; inp.value = value || ''; if (cls) inp.className = cls;
        inp.addEventListener('change', () => { onChange(inp.value); refresh(); });
        td.appendChild(inp);
        return td;
      };

      tr.appendChild(mkInput(p.name, (v) => { p.name = v; }));
      tr.appendChild(mkInput(p.id, (v) => { p.id = v; }, 'pid'));

      const mgrTd = document.createElement('td');
      const sel = document.createElement('select');
      sel.className = 'mgr';
      Object.keys(Catalog.MANAGERS).forEach((k) => {
        const o = document.createElement('option');
        o.value = k; o.textContent = Catalog.MANAGERS[k].label;
        if (k === p.manager) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', () => { p.manager = sel.value; refresh(); });
      mgrTd.appendChild(sel);
      tr.appendChild(mgrTd);

      tr.appendChild(mkInput(p.version, (v) => { p.version = v; }));
      tr.appendChild(mkInput(p.args, (v) => { p.args = v; }));

      const actTd = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'btn small icon danger'; del.textContent = '✕'; del.title = 'Entfernen';
      del.addEventListener('click', () => {
        state.apps.items = state.apps.items.filter((x) => x !== p);
        renderApps(); refresh();
      });
      actTd.appendChild(del);
      tr.appendChild(actTd);

      tbody.appendChild(tr);
    }

    const managers = Array.from(new Set(state.apps.items.filter((p) => p.enabled).map((p) => p.manager)));
    const hints = [];
    if (managers.includes('scoop')) hints.push('Scoop läuft nur im Benutzerkontext – Phase 2 mit RunOnce wählen.');
    if (managers.includes('chocolatey')) hints.push('Chocolatey wird bei Bedarf automatisch nachinstalliert (Internetzugang nötig).');
    if (managers.includes('npm') || managers.includes('pip')) hints.push('npm-/pip-Pakete setzen eine vorhandene Laufzeitumgebung voraus.');
    $('#appsManagerHint').textContent = hints.join(' ');
  }

  function addPackages(list, replace) {
    if (replace) state.apps.items = [];
    const existing = new Set(state.apps.items.map((p) => p.manager + '::' + p.id.toLowerCase()));
    let added = 0, skipped = 0;
    for (const p of list) {
      const key = p.manager + '::' + p.id.toLowerCase();
      if (existing.has(key)) { skipped++; continue; }
      existing.add(key);
      state.apps.items.push(p);
      added++;
    }
    return { added, skipped };
  }

  /* ---------------- Tweaks ---------------- */

  function renderTweaks() {
    const box = $('#tweaksList');
    const filter = ($('#tweaksFilter').value || '').toLowerCase();
    box.innerHTML = '';
    const cats = [];
    Catalog.TWEAKS.forEach((t) => { if (!cats.includes(t.cat)) cats.push(t.cat); });

    for (const t of Catalog.TWEAKS) {
      if (filter && !(t.label + ' ' + t.cat + ' ' + (t.desc || '')).toLowerCase().includes(filter)) continue;
      const on = state.tweaks.selected.includes(t.id);
      const lab = document.createElement('label');
      lab.className = 'tweak' + (on ? ' sel' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = on;
      cb.addEventListener('change', () => {
        if (cb.checked) { if (!state.tweaks.selected.includes(t.id)) state.tweaks.selected.push(t.id); }
        else state.tweaks.selected = state.tweaks.selected.filter((x) => x !== t.id);
        lab.classList.toggle('sel', cb.checked);
        refresh();
      });
      const div = document.createElement('div');
      const late = t.deferPs && t.ps && state.tweaks.phase === 'setup';
      div.innerHTML = '<div class="cat">' + t.cat + (late ? ' · läuft in Phase 2' : '') +
        '</div><div class="t"></div>' + (t.desc ? '<div class="d"></div>' : '');
      div.querySelector('.t').textContent = t.label;
      if (t.desc) div.querySelector('.d').textContent = t.desc;
      lab.appendChild(cb); lab.appendChild(div);
      box.appendChild(lab);
    }
    renderTweakDeferHint();
  }

  function renderTweakDeferHint() {
    const el = $('#tweaksDeferHint');
    if (!el) return;
    const late = Catalog.TWEAKS.filter((t) =>
      state.tweaks.selected.includes(t.id) && t.deferPs && t.ps);
    if (!late.length || state.tweaks.phase !== 'setup') { el.textContent = ''; return; }
    el.innerHTML = '<b>' + late.length + ' Einstellung' + (late.length === 1 ? '' : 'en') +
      '</b> brauchen einen laufenden Netzwerk- bzw. Dienststack (' +
      late.map((t) => t.label).join(', ') + '). Im <code>specialize</code>-Pass von Phase 1 ' +
      'blockieren diese Cmdlets und halten das Setup an – sie werden deshalb automatisch in Phase 2 ' +
      'nachgeholt, jeweils mit Zeitgrenze. Die Registry-Anteile bleiben in Phase 1.';
    el.style.color = 'var(--acc2)';
  }

  /* ---------------- Bloatware ---------------- */

  function renderBloat() {
    const box = $('#bloatList');
    const filter = ($('#bloatFilter').value || '').toLowerCase();
    box.innerHTML = '';
    const known = Catalog.BLOAT.slice();
    state.bloat.selected.forEach((id) => {
      if (!known.some((b) => b.id === id)) known.push({ id, name: '(eigenes Paket)' });
    });

    for (const b of known) {
      if (filter && !(b.id + ' ' + b.name).toLowerCase().includes(filter)) continue;
      const on = state.bloat.selected.includes(b.id);
      const lab = document.createElement('label');
      lab.className = on ? 'sel' : '';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = on;
      cb.addEventListener('change', () => {
        if (cb.checked) { if (!state.bloat.selected.includes(b.id)) state.bloat.selected.push(b.id); }
        else state.bloat.selected = state.bloat.selected.filter((x) => x !== b.id);
        lab.classList.toggle('sel', cb.checked);
        refresh();
      });
      const span = document.createElement('span');
      span.innerHTML = '<span class="id"></span>';
      span.insertBefore(document.createTextNode(b.name), span.firstChild);
      span.querySelector('.id').textContent = b.id;
      lab.appendChild(cb); lab.appendChild(span);
      box.appendChild(lab);
    }
  }

  /* ---------------- Eigene Dateien ---------------- */

  function renderFiles() {
    const tbody = $('#filesTable tbody');
    tbody.innerHTML = '';
    if (!state.files.items.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="padding:18px;text-align:center">Keine Dateien hinzugefügt.</td></tr>';
      return;
    }
    for (const f of state.files.items) {
      const tr = document.createElement('tr');
      tr.className = f.enabled ? '' : 'off';

      const cbTd = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = f.enabled;
      cb.addEventListener('change', () => { f.enabled = cb.checked; tr.className = f.enabled ? '' : 'off'; refresh(); });
      cbTd.appendChild(cb); tr.appendChild(cbTd);

      const nameTd = document.createElement('td');
      nameTd.innerHTML = '<span class="mono"></span><br><span class="muted" style="font-size:11px"></span>';
      nameTd.querySelector('.mono').textContent = f.name;
      nameTd.querySelector('.muted').textContent = f.blob
        ? (f.blob.length / 1024 > 1024 ? (f.blob.length / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(f.blob.length / 1024)) + ' KB')
        : 'nicht im Archiv (nur Platzhalter)';
      tr.appendChild(nameTd);

      const destTd = document.createElement('td');
      const ds = document.createElement('select');
      [['files', 'Install\\Files'], ['scripts', 'Setup\\Scripts']].forEach(([v, l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l;
        if ((f.dest || 'files') === v) o.selected = true; ds.appendChild(o);
      });
      ds.title = 'Install\\Files: wird vom Modul "Eigene Installer" ausgefuehrt.\nSetup\\Scripts: liegt neben SetupComplete.cmd und ist ueber %~dp0 erreichbar.';
      ds.addEventListener('change', () => { f.dest = ds.value; renderFiles(); refresh(); });
      destTd.appendChild(ds); tr.appendChild(destTd);

      const tgt = document.createElement('td');
      const ti = document.createElement('input');
      ti.type = 'text'; ti.value = f.target;
      ti.addEventListener('change', () => { f.target = ti.value.replace(/^[\\/]+/, ''); refresh(); });
      tgt.appendChild(ti); tr.appendChild(tgt);

      const runTd = document.createElement('td');
      const ri = document.createElement('input');
      ri.type = 'text'; ri.value = f.run; ri.placeholder = '/S  bzw.  /qn /norestart  – leer = nur kopieren';
      if (f.dest === 'scripts') { ri.disabled = true; ri.placeholder = 'Aufruf über eigene CMD-Zeilen (%~dp0)'; }
      ri.addEventListener('change', () => { f.run = ri.value; refresh(); });
      runTd.appendChild(ri); tr.appendChild(runTd);

      const phTd = document.createElement('td');
      const ps = document.createElement('select');
      [['setup', 'Phase 1'], ['firstlogon', 'Phase 2']].forEach(([v, l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l;
        if (f.phase === v) o.selected = true; ps.appendChild(o);
      });
      ps.addEventListener('change', () => { f.phase = ps.value; refresh(); });
      phTd.appendChild(ps); tr.appendChild(phTd);

      const actTd = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'btn small icon danger'; del.textContent = '✕';
      del.addEventListener('click', () => {
        state.files.items = state.files.items.filter((x) => x !== f);
        renderFiles(); refresh();
      });
      actTd.appendChild(del); tr.appendChild(actTd);
      tbody.appendChild(tr);
    }
  }

  /* ---------------- Office ---------------- */

  function renderOfficeSummary() {
    const box = $('#officeSummary');
    const xml = state.office.xml || '';
    if (!xml.trim()) { box.innerHTML = '<p class="muted">Keine Configuration.xml hinterlegt.</p>'; return; }
    let cfg;
    try { cfg = Importers.parseOfficeConfig(xml); }
    catch (e) { box.innerHTML = '<p class="muted">Nicht lesbar: ' + e.message + '</p>'; return; }

    const silent = /<Display\b[^>]*Level\s*=\s*"None"/i.test(xml);
    const dl = document.createElement('dl');
    const row = (k, v) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.appendChild(dt); dl.appendChild(dd);
    };
    row('Architektur', cfg.edition ? cfg.edition + " Bit" : '–');
    row('Kanal', cfg.channel || '–');
    if (cfg.version) row('Version', cfg.version);
    row('Produkte', cfg.products.length ? '' : '–');
    box.innerHTML = '';
    box.appendChild(dl);

    if (cfg.products.length) {
      const ul = document.createElement('ul');
      cfg.products.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p.id + (p.languages.length ? ' [' + p.languages.join(', ') + ']' : '') +
          (p.excluded.length ? ' – ohne: ' + p.excluded.join(', ') : '');
        ul.appendChild(li);
      });
      dl.lastChild.appendChild(ul);
    }
    row('MSI-Vorgänger entfernen', cfg.removeMSI ? 'ja' : 'nein');
    row('Updates', cfg.updatesEnabled === null ? 'Standard' : cfg.updatesEnabled);
    row('Benutzereinstellungen', cfg.appSettings + ' Einträge');

    const warn = document.createElement('p');
    warn.className = 'hint';
    if (silent) {
      warn.textContent = 'Unbeaufsichtigte Installation ist konfiguriert (Display Level="None").';
    } else {
      warn.innerHTML = 'Kein <code>&lt;Display Level="None" AcceptEULA="TRUE" /&gt;</code> – die Installation würde eine Oberfläche anzeigen. ';
      const b = document.createElement('button');
      b.className = 'btn small'; b.textContent = 'Automatisch ergänzen';
      b.addEventListener('click', () => {
        state.office.xml = Importers.ensureSilentDisplay(state.office.xml);
        $('#officeXml').value = state.office.xml;
        renderOfficeSummary(); refresh();
        toast('Display-Element ergänzt.', 'ok');
      });
      warn.appendChild(b);
    }
    box.appendChild(warn);
  }

  function renderUnattend() {
    const box = $('#unattendBox');
    const drop = $('#btnUnattendDrop');
    box.innerHTML = '';
    if (state.options.trigger === 'setupcomplete') { drop.hidden = true; return; }

    const u = state.unattend || {};
    if (!u.xml) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = 'Es wird eine eigenständige autounattend.xml erzeugt, die nur die Skripte startet. ' +
        'Wenn Sie bereits eine Antwortdatei verwenden, importieren Sie diese hier – der Generator ergänzt sie, ' +
        'statt sie zu ersetzen.';
      box.appendChild(p);
      drop.hidden = true;
      return;
    }

    drop.hidden = false;
    const dl = document.createElement('dl');
    const row = (k, v) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.appendChild(dt); dl.appendChild(dd);
    };
    row('Importierte Datei', u.name);
    row('Vorhandene Befehle', String(u.info.commandCount));
    row('Passes', u.info.passes.filter(Boolean).join(', ') || '–');
    row('UseConfigurationSet', u.info.useConfigurationSet ? 'true' : 'false');
    if (u.info.productKey) row('Produktschlüssel', u.info.productKey);
    box.appendChild(dl);

    const p = document.createElement('p');
    p.className = 'hint';
    if (u.info.useConfigurationSet) {
      p.innerHTML = '<b>UseConfigurationSet=true:</b> Windows Setup sucht den <code>$OEM$</code>-Ordner neben der ' +
        'Antwortdatei, also im <b>Wurzelverzeichnis</b> des Mediums – nicht unter <code>sources\\</code>. ' +
        'Die Ablage steht deshalb auf „beide Orte“.';
      p.style.color = 'var(--warn)';
    } else {
      p.textContent = 'Die Aufrufe werden mit fortlaufender Order in die vorhandenen Blöcke eingefügt; ' +
        'bereits vorhandene Einträge des Generators werden dabei ersetzt.';
    }
    box.appendChild(p);
  }

  /* ---------------- Übersicht ---------------- */

  function renderOverview() {
    const cards = $('#overviewCards');
    const activeApps = state.apps.items.filter((p) => p.enabled).length;
    const data = [
      { on: state.apps.enabled && activeApps > 0, k: 'Anwendungen', v: activeApps, d: state.apps.phase === 'setup' ? 'Phase 1' : 'Phase 2' },
      { on: state.office.enabled, k: 'Office (ODT)', v: state.office.enabled ? 'aktiv' : 'aus', d: state.office.enabled ? (state.office.phase === 'setup' ? 'Phase 1' : 'Phase 2') : '–' },
      { on: state.tweaks.enabled && state.tweaks.selected.length > 0, k: 'Tweaks', v: state.tweaks.selected.length, d: state.tweaks.phase === 'setup' ? 'Phase 1' : 'Phase 2' },
      { on: state.bloat.enabled && state.bloat.selected.length > 0, k: 'Bloatware', v: state.bloat.selected.length, d: 'AppX-Pakete' },
      { on: state.files.items.some((f) => f.enabled), k: 'Eigene Dateien', v: state.files.items.filter((f) => f.enabled).length, d: 'im Archiv' }
    ];
    cards.innerHTML = '';
    data.forEach((c) => {
      const div = document.createElement('div');
      div.className = 'card ' + (c.on ? 'on' : 'off');
      div.innerHTML = '<div class="k"></div><div class="v"></div><div class="d"></div>';
      div.querySelector('.k').textContent = c.k;
      div.querySelector('.v').textContent = c.v;
      div.querySelector('.d').textContent = c.d;
      cards.appendChild(div);
    });

    const flow = $('#flowList');
    flow.innerHTML = '';
    const steps = [];
    steps.push(['Setup', 'Windows Setup kopiert <code>$OEM$\\$1</code> nach ' + esc(state.paths.installRoot) + ' und <code>$OEM$\\$$</code> nach <code>%WINDIR%</code>']);
    steps.push(['P1', '<code>SetupComplete.cmd</code> startet <code>Install.ps1 -Phase Setup</code> als SYSTEM']);
    Templates.moduleList(state, 'setup').forEach((m) => steps.push(['P1', esc(m[1])]));
    if (state.custom.cmdEnabled && state.custom.cmd.trim()) steps.push(['P1', 'Eigene CMD-Befehle']);
    const logon = Templates.moduleList(state, 'firstlogon');
    if (logon.length) {
      steps.push(['P2', state.options.phase2Runner === 'task'
        ? 'Geplante Aufgabe <code>OEM-Setup-Phase2</code> startet als SYSTEM bei der ersten Anmeldung'
        : '<code>RunOnce</code> startet <code>Install.ps1 -Phase FirstLogon</code>']);
      logon.forEach((m) => steps.push(['P2', esc(m[1])]));
    }
    if (state.options.finish === 'reboot') steps.push(['P2', 'Neustart']);
    if (state.options.finish === 'shutdown') steps.push(['P2', 'Herunterfahren']);
    steps.forEach((s) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="ph">' + s[0] + '</span>' + s[1];
      flow.appendChild(li);
    });

    $('#overviewTree').textContent = treeFromPaths(previewFiles.map((f) => f.path));
  }

  function esc(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }

  function treeFromPaths(paths) {
    const root = {};
    paths.slice().sort().forEach((p) => {
      let node = root;
      p.split('/').forEach((part) => { node = node[part] = node[part] || {}; });
    });
    const out = [];
    (function walk(node, prefix) {
      const keys = Object.keys(node);
      keys.forEach((k, i) => {
        const last = i === keys.length - 1;
        out.push(prefix + (last ? '└─ ' : '├─ ') + k);
        walk(node[k], prefix + (last ? '   ' : '│  '));
      });
    })(root, '');
    return out.join('\n') || '(leer)';
  }

  /* ---------------- Vorschau ---------------- */

  function renderPreview() {
    const list = $('#fileList');
    list.innerHTML = '';
    previewFiles.forEach((f) => {
      const b = document.createElement('button');
      b.className = 'f' + (f.path === previewActive ? ' active' : '');
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = f.path;
      b.title = f.path;
      b.addEventListener('click', () => { previewActive = f.path; renderPreview(); });
      list.appendChild(b);
    });
    if (!previewFiles.some((f) => f.path === previewActive)) {
      previewActive = previewFiles.length ? previewFiles[0].path : null;
      if (previewActive) return renderPreview();
    }
    const cur = previewFiles.find((f) => f.path === previewActive);
    $('#previewPath').textContent = cur ? cur.path : '–';
    if (!cur) { $('#previewBody').textContent = ''; $('#previewSize').textContent = ''; return; }
    if (cur.binary) {
      $('#previewBody').textContent = '[Binärdatei – ' + (cur.data.length / 1024).toFixed(0) + ' KB – wird unverändert ins Archiv übernommen]';
      $('#previewSize').textContent = (cur.data.length / 1024).toFixed(0) + ' KB';
    } else {
      $('#previewBody').textContent = cur.data;
      $('#previewSize').textContent = new Blob([cur.data]).size + ' Bytes · ' + cur.data.split('\n').length + ' Zeilen';
    }
  }

  /* ---------------- Zentrale Aktualisierung ---------------- */

  let refreshTimer = null;
  function refresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      try {
        previewFiles = Templates.build(state);
      } catch (e) {
        console.error(e);
        toast('Fehler beim Erzeugen: ' + e.message, 'err');
        previewFiles = [];
      }
      $('#badgeApps').textContent = state.apps.items.filter((p) => p.enabled).length;
      $('#badgeTweaks').textContent = state.tweaks.selected.length;
      $('#badgeBloat').textContent = state.bloat.selected.length;
      $('#badgeFiles').textContent = state.files.items.filter((f) => f.enabled).length;
      const rel = Templates.relFromRoot(state.paths.installRoot);
      $('#officeSetupPath').textContent = '$OEM$\\$1\\' + rel + '\\Office\\setup.exe';
      $('#filesTargetPath').textContent = state.paths.installRoot.replace(/\\+$/, '') + '\\Files';
      $('#setKeepInstallLabel').textContent = state.paths.installRoot.replace(/\\+$/, '');
      $('#appsPhaseHint').textContent = state.apps.phase === 'setup'
        ? 'Achtung: In Phase 1 läuft winget als SYSTEM, bevor ein Benutzerprofil existiert. Pakete, die nur benutzerbezogen installieren, schlagen dort häufig fehl.'
        : 'Empfohlen: Netzwerk und App Installer sind bei der ersten Anmeldung zuverlässig verfügbar.';
      const refs = [];
      const re = /%~dp0"?([A-Za-z0-9_.\\-]+)/g;
      let m;
      while ((m = re.exec(state.custom.cmd || '')) !== null) if (!refs.includes(m[1])) refs.push(m[1]);
      const inScripts = state.files.items
        .filter((f) => f.enabled && f.dest === 'scripts')
        .map((f) => f.target.toLowerCase());
      const missing = refs.filter((r) => !inScripts.includes(r.toLowerCase()));
      $('#customCmdRefHint').textContent = missing.length
        ? 'Referenziert, aber nicht im Archiv: ' + missing.join(', ') +
          ' – die Dateien unter „Eigene Dateien“ mit Zielordner „Setup\\Scripts“ hinzufügen.'
        : '';
      $('#customCmdRefHint').style.color = missing.length ? 'var(--warn)' : '';
      if ($('#view-preview').classList.contains('active')) renderPreview();
      if ($('#view-overview').classList.contains('active')) renderOverview();
    }, 60);
  }

  function renderAll() {
    syncInputs();
    renderApps(); renderTweaks(); renderBloat(); renderFiles(); renderOfficeSummary(); renderUnattend();
    refresh();
  }

  /* ---------------- Import ---------------- */

  function readText(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsText(file, 'utf-8');
    });
  }
  function readBytes(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(new Uint8Array(r.result));
      r.onerror = () => rej(r.error);
      r.readAsArrayBuffer(file);
    });
  }

  const BINARY_EXT = /\.(exe|msi|msix|msixbundle|appx|appxbundle|zip|7z|cab|msu|dll|sys|inf|reg|ico|png|jpg|bmp)$/i;

  async function importFile(file, opts) {
    opts = opts || {};
    const name = file.name;

    if (BINARY_EXT.test(name) && !/\.reg$/i.test(name)) {
      const bytes = await readBytes(file);
      state.files.items.push({
        name, target: name, run: /\.msi$/i.test(name) ? '/qn /norestart' : '',
        phase: 'firstlogon', enabled: true, dest: 'files', blob: bytes, blobPresent: true
      });
      logImport('Datei übernommen: ' + name + ' (' + Math.round(bytes.length / 1024) + ' KB)');
      renderFiles(); refresh();
      return;
    }

    const text = await readText(file);
    const type = opts.forceType || Importers.detectType(name, text);

    switch (type) {
      case 'project': {
        loadProject(JSON.parse(text));
        logImport('Projekt geladen: ' + name);
        toast('Projekt geladen.', 'ok');
        return;
      }
      case 'bundle': {
        const pkgs = Importers.parseBundle(text, name);
        if (!pkgs.length) { logImport('Keine Pakete gefunden in ' + name, 'warnl'); toast('Keine Pakete gefunden.', 'warn'); return; }
        const r = addPackages(pkgs, !!opts.replace);
        state.apps.enabled = true;
        logImport('Bundle ' + name + ': ' + r.added + ' Pakete übernommen' + (r.skipped ? ', ' + r.skipped + ' Duplikate übersprungen' : ''));
        toast(r.added + ' Pakete importiert.', 'ok');
        renderAll();
        return;
      }
      case 'officexml': {
        state.office.xml = text.trim();
        state.office.enabled = true;
        let info = '';
        try {
          const cfg = Importers.parseOfficeConfig(text);
          info = ' (' + cfg.products.map((p) => p.id).join(', ') + ')';
        } catch (e) { /* Zusammenfassung optional */ }
        logImport('Office-Konfiguration übernommen: ' + name + info);
        toast('Configuration.xml importiert.', 'ok');
        renderAll();
        return;
      }
      case 'cmd': {
        const res = Importers.parseSetupComplete(text);
        if (res.packages.length) {
          const r = addPackages(res.packages, false);
          logImport(name + ': ' + res.packages.length + ' winget-Aufrufe erkannt (' + r.added +
            ' neu' + (r.skipped ? ', ' + r.skipped + ' bereits vorhanden' : '') + ')');
        }
        if (res.officeConfigName) {
          state.office.enabled = true;
          logImport(name + ': Office-Aufruf erkannt – Configuration.xml separat importieren', 'warnl');
        }
        if (res.custom.length) {
          state.custom.cmd = (state.custom.cmd ? state.custom.cmd + '\n' : '') + res.custom.join('\n');
          state.custom.cmdEnabled = true;
          logImport(name + ': ' + res.custom.length + ' eigene Befehlszeilen übernommen');
        }
        res.notes.forEach((n) => logImport(name + ': ' + n, 'warnl'));
        if (!res.packages.length && !res.custom.length && !res.officeConfigName) {
          logImport(name + ': nichts Verwertbares gefunden', 'warnl');
        }
        toast('SetupComplete.cmd analysiert.', 'ok');
        renderAll();
        return;
      }
      case 'ps1': {
        const bytes = new TextEncoder().encode(text);
        state.files.items.push({
          name, target: name, run: '', phase: 'setup', enabled: true, dest: 'files', blob: bytes, blobPresent: true
        });
        state.custom.ps = (state.custom.ps ? state.custom.ps + '\n' : '') +
          '# Importiertes Skript ausführen\n' +
          '& (Join-Path $Global:OemRoot ' + "'Files\\" + name + "')";
        state.custom.psEnabled = true;
        logImport('PowerShell-Skript übernommen und Aufruf ergänzt: ' + name);
        toast('PowerShell-Skript importiert.', 'ok');
        renderAll();
        return;
      }
      case 'unattend': {
        let info;
        try { info = Importers.parseUnattend(text); }
        catch (e) { logImport(name + ': ' + e.message, 'err'); toast('autounattend.xml nicht lesbar.', 'err'); return; }
        state.unattend = { xml: text, name: name, info: info };
        if (state.options.trigger === 'setupcomplete') state.options.trigger = 'both';
        if (info.useConfigurationSet && state.paths.zipRoot === 'sources') state.paths.zipRoot = 'both';
        logImport('autounattend.xml übernommen: ' + name + ' – ' + info.commandCount +
          ' vorhandene Befehle, UseConfigurationSet=' + (info.useConfigurationSet ? 'true' : 'false'));
        if (info.useConfigurationSet) {
          logImport('UseConfigurationSet=true erkannt: $OEM$ gehört ins Wurzelverzeichnis des Mediums – Ablage auf „beide Orte“ gestellt.', 'warnl');
        }
        toast('autounattend.xml wird ergänzt statt ersetzt.', 'ok');
        renderAll();
        return;
      }
      default: {
        const bytes = new TextEncoder().encode(text);
        state.files.items.push({ name, target: name, run: '', phase: 'firstlogon', enabled: true, dest: 'files', blob: bytes, blobPresent: true });
        logImport('Als Datei übernommen: ' + name, 'warnl');
        renderFiles(); refresh();
      }
    }
  }

  async function importFiles(fileList, opts) {
    for (const f of Array.from(fileList)) {
      try { await importFile(f, opts); }
      catch (e) { console.error(e); logImport('Fehler bei ' + f.name + ': ' + e.message, 'err'); toast('Import fehlgeschlagen: ' + f.name, 'err'); }
    }
  }

  /* ---------------- Projekt speichern / laden ---------------- */

  function projectJson() {
    const clone = JSON.parse(JSON.stringify(state, (k, v) => (k === 'blob' ? undefined : v)));
    clone.files.items.forEach((f) => { f.blobPresent = false; });
    clone.savedAt = new Date().toISOString();
    return JSON.stringify(clone, null, 2);
  }

  function loadProject(obj) {
    const base = defaultState();
    const merge = (dst, src) => {
      for (const k of Object.keys(src || {})) {
        if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k]) merge(dst[k], src[k]);
        else dst[k] = src[k];
      }
      return dst;
    };
    state = merge(base, obj);
    state.apps.items = (state.apps.items || []).map((p) => Importers.mkPkg(p));
    if (!state.unattend) state.unattend = { xml: null, name: '', info: null };
    state.files.items = (state.files.items || []).map((f) => ({
      name: f.name, target: f.target || f.name, run: f.run || '',
      phase: f.phase || 'firstlogon', dest: f.dest || 'files',
      enabled: f.enabled !== false, blob: null, blobPresent: false
    }));
    renderAll();
    if (state.files.items.length) {
      toast('Hinweis: Binärdateien sind nicht Teil der Projektdatei und müssen erneut hinzugefügt werden.', 'warn');
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function exportZip() {
    if (!previewFiles.length) previewFiles = Templates.build(state);
    const btn = $('#btnExport');
    btn.disabled = true; btn.textContent = 'Erzeuge …';
    try {
      const entries = previewFiles.map((f) => ({ path: f.path, data: f.data }));
      entries.push({ path: (state.meta.name || 'Projekt').replace(/[^\w.-]+/g, '_') + '.oemproj.json', data: projectJson() });
      const blob = await MiniZip.createZip(entries);
      download(blob, (state.meta.name || 'OEM').replace(/[^\w.-]+/g, '_') + '-OEM.zip');
      toast('ZIP mit ' + entries.length + ' Dateien erstellt.', 'ok');
    } catch (e) {
      console.error(e);
      toast('Export fehlgeschlagen: ' + e.message, 'err');
    } finally {
      btn.disabled = false; btn.textContent = 'ZIP erzeugen';
    }
  }

  /* ---------------- Ereignisse ---------------- */

  function wire() {
    $$('.nav-item').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

    $('#btnExport').addEventListener('click', exportZip);
    $('#btnSaveProject').addEventListener('click', () => {
      download(new Blob([projectJson()], { type: 'application/json' }),
        (state.meta.name || 'Projekt').replace(/[^\w.-]+/g, '_') + '.oemproj.json');
      toast('Projektdatei gespeichert.', 'ok');
    });
    $('#btnLoadProject').addEventListener('click', () => $('#projectInput').click());
    $('#projectInput').addEventListener('change', (e) => {
      if (e.target.files[0]) importFile(e.target.files[0], { forceType: 'project' });
      e.target.value = '';
    });

    /* Import */
    $('#btnPickFiles').addEventListener('click', () => $('#fileInput').click());
    $('#dropzone').addEventListener('click', (e) => { if (!e.target.closest('button')) $('#fileInput').click(); });
    $('#fileInput').addEventListener('change', async (e) => { await importFiles(e.target.files); e.target.value = ''; });
    $('#btnPickBundle').addEventListener('click', () => $('#bundleInput').click());
    $('#bundleInput').addEventListener('change', async (e) => {
      await importFiles(e.target.files, { forceType: 'bundle', replace: $('#bundleReplace').checked });
      e.target.value = '';
    });
    $('#btnParsePaste').addEventListener('click', () => {
      const txt = $('#bundlePaste').value.trim();
      if (!txt) return;
      try {
        const pkgs = Importers.parseBundle(txt, 'einfuegen.json');
        const r = addPackages(pkgs, $('#bundleReplace').checked);
        state.apps.enabled = true;
        logImport('Eingefügtes Bundle: ' + r.added + ' Pakete übernommen');
        toast(r.added + ' Pakete importiert.', 'ok');
        renderAll();
      } catch (e) { toast('Konnte nicht gelesen werden: ' + e.message, 'err'); }
    });
    $('#btnClearLog').addEventListener('click', () => {
      $('#importLog').innerHTML = '<li class="muted">Noch nichts importiert.</li>';
    });

    /* Drag & Drop global */
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); $('#dropzone').classList.add('hot'); });
    window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { document.body.classList.remove('dragging'); $('#dropzone').classList.remove('hot'); } });
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragDepth = 0;
      document.body.classList.remove('dragging'); $('#dropzone').classList.remove('hot');
      if (e.dataTransfer && e.dataTransfer.files.length) {
        setView('import');
        await importFiles(e.dataTransfer.files);
      }
    });

    /* Anwendungen */
    $('#appsFilter').addEventListener('input', renderApps);
    $('#btnAppsAll').addEventListener('click', () => { state.apps.items.forEach((p) => { p.enabled = true; }); renderApps(); refresh(); });
    $('#btnAppsNone').addEventListener('click', () => { state.apps.items.forEach((p) => { p.enabled = false; }); renderApps(); refresh(); });
    $('#btnAppsClear').addEventListener('click', () => {
      if (!state.apps.items.length || confirm('Paketliste wirklich leeren?')) { state.apps.items = []; renderApps(); refresh(); }
    });
    $('#btnAppsAdd').addEventListener('click', () => {
      const id = prompt('Paket-ID (z. B. 7zip.7zip):');
      if (!id) return;
      state.apps.items.push(Importers.mkPkg({ id: id.trim(), name: id.trim(), manager: 'winget', source: 'winget' }));
      $('#appsFilter').value = '';
      renderApps(); refresh();
    });

    /* Office */
    $('#btnOfficeImport').addEventListener('click', () => $('#officeInput').click());
    $('#officeInput').addEventListener('change', async (e) => {
      if (e.target.files[0]) await importFile(e.target.files[0], { forceType: 'officexml' });
      e.target.value = '';
    });
    $('#btnOfficeTemplate').addEventListener('click', () => {
      state.office.xml = OFFICE_TEMPLATE;
      $('#officeXml').value = OFFICE_TEMPLATE;
      renderOfficeSummary(); refresh();
    });

    /* Tweaks / Bloatware */
    $('#tweaksFilter').addEventListener('input', renderTweaks);
    $('#btnTweaksNone').addEventListener('click', () => { state.tweaks.selected = []; renderTweaks(); refresh(); });
    $('#bloatFilter').addEventListener('input', renderBloat);
    $('#btnBloatNone').addEventListener('click', () => { state.bloat.selected = []; renderBloat(); refresh(); });
    $('#btnBloatRec').addEventListener('click', () => {
      Catalog.BLOAT.filter((b) => b.rec).forEach((b) => {
        if (!state.bloat.selected.includes(b.id)) state.bloat.selected.push(b.id);
      });
      state.bloat.enabled = true;
      renderAll();
      toast(state.bloat.selected.length + ' Pakete zum Entfernen ausgewählt.', 'ok');
    });
    $('#btnBloatAdd').addEventListener('click', () => {
      const id = prompt('AppX-Paketname (z. B. Microsoft.BingNews):');
      if (!id) return;
      if (!state.bloat.selected.includes(id.trim())) state.bloat.selected.push(id.trim());
      state.bloat.enabled = true;
      renderAll();
    });

    /* Dateien */
    $('#btnFilesAdd').addEventListener('click', () => $('#filesInput').click());
    $('#filesInput').addEventListener('change', async (e) => {
      for (const f of Array.from(e.target.files)) {
        const bytes = await readBytes(f);
        state.files.items.push({
          name: f.name, target: f.name,
          run: /\.msi$/i.test(f.name) ? '/qn /norestart' : '',
          phase: 'firstlogon', enabled: true, dest: 'files', blob: bytes, blobPresent: true
        });
      }
      e.target.value = '';
      renderFiles(); refresh();
    });

    /* Vorschau */
    $('#btnCopyFile').addEventListener('click', async () => {
      const cur = previewFiles.find((f) => f.path === previewActive);
      if (!cur || cur.binary) return;
      try { await navigator.clipboard.writeText(cur.data); toast('In die Zwischenablage kopiert.', 'ok'); }
      catch (e) { toast('Kopieren nicht möglich.', 'err'); }
    });
    $('#btnDownloadFile').addEventListener('click', () => {
      const cur = previewFiles.find((f) => f.path === previewActive);
      if (!cur) return;
      download(new Blob([cur.data]), cur.path.split('/').pop());
    });

    /* Auslöser */
    $('#setTrigger').addEventListener('change', renderUnattend);
    $('#btnUnattendImport').addEventListener('click', () => $('#unattendInput').click());
    $('#unattendInput').addEventListener('change', async (e) => {
      if (e.target.files[0]) await importFile(e.target.files[0], { forceType: 'unattend' });
      e.target.value = '';
    });
    $('#btnUnattendDrop').addEventListener('click', () => {
      state.unattend = { xml: null, name: '', info: null };
      renderUnattend(); refresh();
      toast('Importierte autounattend.xml verworfen.', 'ok');
    });

    /* Einstellungen */
    $('#btnReset').addEventListener('click', () => {
      if (!confirm('Projekt auf Werkseinstellungen zurücksetzen?')) return;
      state = defaultState();
      renderAll();
      toast('Projekt zurückgesetzt.', 'ok');
    });

    window.addEventListener('beforeunload', (e) => {
      if (state.apps.items.length || state.tweaks.selected.length || state.office.enabled) {
        e.preventDefault(); e.returnValue = '';
      }
    });
  }

  /* ---------------- Start ---------------- */

  function init() {
    bindAll();
    wire();
    renderAll();
    setView('overview');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
