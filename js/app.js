/* OEM Script Generator – Oberfläche, Zustand, Import und Export */
(function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const T = (de) => I18n.term(de);
  const F = function () { return I18n.fmt.apply(null, arguments); };
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
        toastOnFinish: false, phase2Runner: 'task', finish: 'none', trigger: 'both', configSet: true
      },
      unattend: { xml: null, name: '', info: null },
      apps: {
        enabled: true, phase: 'firstlogon', method: 'individual', retries: 2, packageTimeoutMin: 15,
        waitNetwork: true, sourceUpdate: true, bootstrap: true,
        pinVersions: false, machineScope: false, items: []
      },
      office: {
        enabled: false, phase: 'firstlogon', setupSource: 'bundled',
        source: 'online', localFolder: 'Quelle',
        odtUrl: 'https://officecdn.microsoft.com/pr/wsus/setup.exe',
        xml: OFFICE_TEMPLATE, checkInstalled: true
      },
      tweaks: {
        enabled: true, phase: 'setup', allUsers: true,
        selected: ['fileExt', 'hiddenFiles', 'launchToThisPC', 'longPaths', 'taskbarSearch', 'clockSeconds']
      },
      bloat: { enabled: false, phase: 'setup', provisioned: true, selected: [] },
      features: { enabled: false, phase: 'firstlogon', timeoutMin: 20, selected: [] },
      drivers: { enabled: false, phase: 'setup', timeoutMin: 10, items: [] },
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
    ['appsPackageTimeout', 'apps.packageTimeoutMin', 'num'],
    ['appsWaitNetwork', 'apps.waitNetwork', 'bool'],
    ['appsSourceUpdate', 'apps.sourceUpdate', 'bool'],
    ['appsBootstrap', 'apps.bootstrap', 'bool'],
    ['appsPinVersions', 'apps.pinVersions', 'bool'],
    ['appsMachineScope', 'apps.machineScope', 'bool'],
    ['officeEnabled', 'office.enabled', 'bool'],
    ['officePhase', 'office.phase', 'text'],
    ['officeSetupSource', 'office.setupSource', 'text'],
    ['officeSource', 'office.source', 'text'],
    ['officeLocalFolder', 'office.localFolder', 'text'],
    ['officeOdtUrl', 'office.odtUrl', 'text'],
    ['officeCheckInstalled', 'office.checkInstalled', 'bool'],
    ['officeXml', 'office.xml', 'text'],
    ['tweaksEnabled', 'tweaks.enabled', 'bool'],
    ['tweaksPhase', 'tweaks.phase', 'text'],
    ['tweaksAllUsers', 'tweaks.allUsers', 'bool'],
    ['bloatEnabled', 'bloat.enabled', 'bool'],
    ['bloatPhase', 'bloat.phase', 'text'],
    ['bloatProvisioned', 'bloat.provisioned', 'bool'],
    ['featuresEnabled', 'features.enabled', 'bool'],
    ['featuresPhase', 'features.phase', 'text'],
    ['featuresTimeout', 'features.timeoutMin', 'num'],
    ['driversEnabled', 'drivers.enabled', 'bool'],
    ['driversPhase', 'drivers.phase', 'text'],
    ['driversTimeout', 'drivers.timeoutMin', 'num'],
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
    ['setToastOnFinish', 'options.toastOnFinish', 'bool'],
    ['setConfigSet', 'options.configSet', 'bool']
  ];

  function bindAll() {
    for (const [id, path, type] of BINDINGS) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.addEventListener(type === 'bool' ? 'change' : 'input', () => {
        set(path, type === 'bool' ? el.checked : type === 'num' ? parseInt(el.value, 10) || 0 : el.value);
        if (id === 'officeXml') renderOfficeSummary();
        if (id === 'tweaksPhase') renderTweaks();
        if (id === 'featuresPhase') renderFeatureHints();
        if ((id === 'setConfigSet' || id === 'setTrigger') && configSetActive() && state.paths.zipRoot === 'sources') {
          state.paths.zipRoot = 'both';
          syncInputs();
          toast(T('UseConfigurationSet=true: Setup sucht $OEM$ im Wurzelverzeichnis – Ablage auf „beide Orte“ gestellt.'), 'warn');
        }
        if (id === 'setConfigSet' || id === 'setTrigger' || id === 'setZipRoot') renderUnattend();
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

  /*  Spaltensortierung. Sie ordnet nur die Anzeige; state.apps.items behaelt
      seine Reihenfolge, denn in dieser Reihenfolge wird installiert. Ein
      dritter Klick auf dieselbe Spalte schaltet die Sortierung wieder aus. */
  let appsSort = { key: null, dir: 1 };
  const appsCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

  function appsSortValue(p, key) {
    if (key === 'manager') return (Catalog.MANAGERS[p.manager] || {}).label || p.manager || '';
    return p[key] || '';
  }

  function sortApps(list) {
    if (!appsSort.key) return list;
    const key = appsSort.key;
    return list.slice().sort((a, b) => {
      const va = appsSortValue(a, key), vb = appsSortValue(b, key);
      if (!va !== !vb) return va ? -1 : 1;          /* leere Werte immer ans Ende */
      return appsCollator.compare(va, vb) * appsSort.dir;
    });
  }

  function toggleAppsSort(key) {
    if (appsSort.key !== key) appsSort = { key, dir: 1 };
    else if (appsSort.dir === 1) appsSort.dir = -1;
    else appsSort = { key: null, dir: 1 };
    $$('#appsTable th.sortable').forEach((th) => {
      const on = th.dataset.sort === appsSort.key;
      th.classList.toggle('sort-asc', on && appsSort.dir === 1);
      th.classList.toggle('sort-desc', on && appsSort.dir === -1);
      th.setAttribute('aria-sort', on ? (appsSort.dir === 1 ? 'ascending' : 'descending') : 'none');
    });
    renderApps();
  }

  function renderApps() {
    const tbody = $('#appsTable tbody');
    const filter = ($('#appsFilter').value || '').toLowerCase();
    tbody.innerHTML = '';

    const list = sortApps(state.apps.items.filter((p) =>
      !filter || (p.name + ' ' + p.id + ' ' + p.manager).toLowerCase().includes(filter)));

    if (!list.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="7" class="muted" style="padding:18px;text-align:center">' +
        (state.apps.items.length ? T('Keine Treffer.') : T('Noch keine Pakete – UniGetUI-Bundle importieren oder Paket hinzufügen.')) + '</td>';
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
      del.className = 'btn small icon danger'; del.textContent = '✕'; del.title = T('Entfernen');
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
    if (managers.includes('scoop')) hints.push(T('Scoop läuft nur im Benutzerkontext – Phase 2 mit RunOnce wählen.'));
    if (managers.includes('chocolatey')) hints.push(T('Chocolatey wird bei Bedarf automatisch nachinstalliert (Internetzugang nötig).'));
    if (managers.includes('npm') || managers.includes('pip')) hints.push(T('npm-/pip-Pakete setzen eine vorhandene Laufzeitumgebung voraus.'));
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
      /* Sowohl die deutsche Vorlage als auch die angezeigte Fassung durchsuchen,
         damit der Filter in beiden Sprachen greift. */
      const haystack = [t.label, t.cat, t.desc || '', T(t.label), T(t.cat), T(t.desc || '')].join(' ').toLowerCase();
      if (filter && !haystack.includes(filter)) continue;
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
      div.innerHTML = '<div class="cat">' + T(t.cat) + (late ? T(' · läuft in Phase 2') : '') +
        '</div><div class="t"></div>' + (t.desc ? '<div class="d"></div>' : '');
      div.querySelector('.t').textContent = T(t.label);
      if (t.desc) div.querySelector('.d').textContent = T(t.desc);
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
    const net = late.filter((t) => t.deferReason !== 'account');
    const acc = late.filter((t) => t.deferReason === 'account');
    const teile = [];
    if (net.length) {
      teile.push('<b>' + net.map((t) => T(t.label)).join(', ') + '</b> ' +
        T(net.length === 1 ? 'braucht' : 'brauchen') +
        T(' einen laufenden Netzwerk- bzw. Dienststack; im <code>specialize</code>-Pass blockieren solche Cmdlets und halten das Setup an'));
    }
    if (acc.length) {
      teile.push('<b>' + acc.map((t) => T(t.label)).join(', ') + '</b> ' +
        T(acc.length === 1 ? 'setzt' : 'setzen') +
        T(' ein angelegtes Benutzerkonto voraus, das es in Phase 1 noch nicht gibt'));
    }
    el.innerHTML = teile.join('. ') +
      T('. Diese Einstellungen werden automatisch in Phase 2 nachgeholt, jeweils mit Zeitgrenze. Die Registry-Anteile bleiben in Phase 1.');
    el.style.color = 'var(--acc2)';
  }

  /* ---------------- Bloatware ---------------- */

  function renderBloat() {
    const box = $('#bloatList');
    const filter = ($('#bloatFilter').value || '').toLowerCase();
    box.innerHTML = '';
    const known = Catalog.BLOAT.slice();
    state.bloat.selected.forEach((id) => {
      if (!known.some((b) => b.id === id)) known.push({ id, name: T('(eigenes Paket)') });
    });

    for (const b of known) {
      if (filter && !(b.id + ' ' + b.name + ' ' + T(b.name)).toLowerCase().includes(filter)) continue;
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
      span.insertBefore(document.createTextNode(T(b.name)), span.firstChild);
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
      tbody.innerHTML = '<tr><td colspan="7" class="muted" style="padding:18px;text-align:center">' + T('Keine Dateien hinzugefügt.') + '</td></tr>';
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
        : T('fehlt – nicht im Archiv');
      if (!f.blob) {
        /* Nach dem Laden einer Projektdatei: Datei neu zuordnen, Einstellungen bleiben. */
        nameTd.querySelector('.muted').style.color = 'var(--warn)';
        const pick = document.createElement('button');
        pick.type = 'button'; pick.className = 'btn small mt-s';
        pick.textContent = T('Datei wählen …');
        pick.addEventListener('click', () => pickFileFor(f));
        nameTd.appendChild(document.createElement('br'));
        nameTd.appendChild(pick);
      }
      tr.appendChild(nameTd);

      const destTd = document.createElement('td');
      const ds = document.createElement('select');
      [['files', T('Install\\Files')], ['scripts', T('Setup\\Scripts')]].forEach(([v, l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l;
        if ((f.dest || 'files') === v) o.selected = true; ds.appendChild(o);
      });
      ds.title = T('Install\\Files: wird vom Modul "Eigene Installer" ausgefuehrt.\nSetup\\Scripts: liegt neben SetupComplete.cmd und ist ueber %~dp0 erreichbar.');
      ds.addEventListener('change', () => { f.dest = ds.value; renderFiles(); refresh(); });
      destTd.appendChild(ds); tr.appendChild(destTd);

      const tgt = document.createElement('td');
      const ti = document.createElement('input');
      ti.type = 'text'; ti.value = f.target;
      ti.addEventListener('change', () => { f.target = ti.value.replace(/^[\\/]+/, ''); refresh(); });
      tgt.appendChild(ti); tr.appendChild(tgt);

      const runTd = document.createElement('td');
      const ri = document.createElement('input');
      ri.type = 'text'; ri.value = f.run; ri.placeholder = T('/S  bzw.  /qn /norestart  – leer = nur kopieren');
      if (f.dest === 'scripts') { ri.disabled = true; ri.placeholder = T('Aufruf über eigene CMD-Zeilen (%~dp0)'); }
      ri.addEventListener('change', () => { f.run = ri.value; refresh(); });
      runTd.appendChild(ri); tr.appendChild(runTd);

      const phTd = document.createElement('td');
      const ps = document.createElement('select');
      [['setup', T('Phase 1')], ['firstlogon', T('Phase 2')]].forEach(([v, l]) => {
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

  /* ---------------- Treiber ---------------- */

  function fmtSize(n) {
    return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  }

  /* Ordnernamen muessen eindeutig sein - jedes Paket ist ein Verzeichnis. */
  function uniqueDriverName(name, self) {
    const base = Templates.driverFolder(name);
    const taken = new Set(state.drivers.items.filter((d) => d !== self).map((d) => Templates.driverFolder(d.name).toLowerCase()));
    let n = base, i = 2;
    while (taken.has(n.toLowerCase())) n = base + ' (' + (i++) + ')';
    return n;
  }

  function driverStats(d) {
    const files = (d.files || []).filter((f) => f.blob);
    return {
      count: files.length,
      inf: files.filter((f) => /\.inf$/i.test(f.rel)).length,
      size: files.reduce((a, f) => a + f.blob.length, 0)
    };
  }

  async function addDriverPackage(name, entries) {
    const d = { name: uniqueDriverName(name, null), dest: 'pnp', models: '', enabled: true, files: [] };
    state.drivers.items.push(d);
    for (const e of entries) d.files.push({ rel: e.rel, blob: await readBytes(e.file) });
    if (!state.drivers.enabled) state.drivers.enabled = true;
    return d;
  }

  let driverRefill = null;

  /* Datei fuer einen Platzhalter unter "Eigene Dateien" neu waehlen. */
  function pickFileFor(f) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.addEventListener('change', async () => {
      const file = inp.files[0];
      if (!file) return;
      f.blob = await readBytes(file);
      f.blobPresent = true;
      if (file.name !== f.name) toast(F('„{0}“ zugeordnet (Eintrag hieß „{1}“).', file.name, f.name), 'warn');
      else toast(F('„{0}“ zugeordnet.', file.name), 'ok');
      renderFiles(); refresh();
    });
    inp.click();
  }

  function renderDrivers() {
    const tbody = $('#driversTable tbody');
    tbody.innerHTML = '';
    const items = state.drivers.items;
    if (!items.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted" style="padding:18px;text-align:center">' +
        T('Noch keine Treiberpakete – Ordner hinzufügen oder leeres Paket anlegen.') + '</td></tr>';
    }
    for (const d of items) {
      const tr = document.createElement('tr');
      tr.className = d.enabled ? '' : 'off';

      const cbTd = document.createElement('td');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = d.enabled;
      cb.addEventListener('change', () => { d.enabled = cb.checked; tr.className = d.enabled ? '' : 'off'; refresh(); });
      cbTd.appendChild(cb); tr.appendChild(cbTd);

      const nameTd = document.createElement('td');
      const ni = document.createElement('input');
      ni.type = 'text'; ni.value = d.name;
      ni.addEventListener('change', () => { d.name = uniqueDriverName(ni.value, d); ni.value = d.name; refresh(); });
      nameTd.appendChild(ni); tr.appendChild(nameTd);

      const st = driverStats(d);
      const infoTd = document.createElement('td');
      infoTd.innerHTML = '<span></span><br><span class="muted" style="font-size:11px"></span>';
      if (st.count) {
        infoTd.firstChild.textContent = F(st.count === 1 ? '{0} Datei · {1} INF' : '{0} Dateien · {1} INF', st.count, st.inf);
        infoTd.lastChild.textContent = fmtSize(st.size);
        if (!st.inf) {
          infoTd.lastChild.textContent += ' – ' + T('keine INF-Datei: EXE-Installer gehören unter „Eigene Dateien“');
          infoTd.lastChild.style.color = 'var(--warn)';
        }
      } else if (d.missing) {
        infoTd.firstChild.textContent = F('fehlt – {0} Dateien nicht im Archiv', d.missing);
        infoTd.firstChild.style.color = 'var(--warn)';
        infoTd.lastChild.textContent = T('Projektdatei enthält keine Treiberdateien – Ordner neu wählen');
      } else {
        infoTd.firstChild.textContent = T('leer');
        infoTd.lastChild.textContent = T('Dateien später in den Ordner kopieren');
      }
      if (!st.count) {
        const pick = document.createElement('button');
        pick.type = 'button'; pick.className = 'btn small mt-s';
        pick.textContent = T('Ordner wählen …');
        pick.addEventListener('click', () => { driverRefill = d; $('#driversFolderInput').click(); });
        infoTd.appendChild(document.createElement('br'));
        infoTd.appendChild(pick);
      }
      tr.appendChild(infoTd);

      const destTd = document.createElement('td');
      const ds = document.createElement('select');
      [['pnp', T('pnputil (Phase-Installation)')], ['winpe', T('Windows Setup ($WinPEDriver$)')]].forEach(([v, l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l;
        if ((d.dest || 'pnp') === v) o.selected = true; ds.appendChild(o);
      });
      ds.addEventListener('change', () => { d.dest = ds.value; renderDrivers(); refresh(); });
      destTd.appendChild(ds); tr.appendChild(destTd);

      const modTd = document.createElement('td');
      const mi = document.createElement('input');
      mi.type = 'text'; mi.value = d.models || '';
      if (d.dest === 'winpe') {
        mi.disabled = true; mi.value = ''; mi.placeholder = T('Setup wählt selbst nach Hardware');
      } else {
        mi.placeholder = T('alle Geräte – z. B. Latitude 5440; ThinkPad T14 Gen 3');
      }
      mi.addEventListener('change', () => { d.models = mi.value; refresh(); });
      modTd.appendChild(mi); tr.appendChild(modTd);

      const actTd = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'btn small icon danger'; del.textContent = '✕'; del.title = T('Entfernen');
      del.addEventListener('click', () => {
        state.drivers.items = state.drivers.items.filter((x) => x !== d);
        renderDrivers(); refresh();
      });
      actTd.appendChild(del); tr.appendChild(actTd);
      tbody.appendChild(tr);
    }

    const hint = $('#driversHint');
    const active = items.filter((d) => d.enabled);
    const total = active.reduce((a, d) => a + driverStats(d).size, 0);
    const parts = [];
    if (total) parts.push(F('Zusammen {0} Treiberdateien im ZIP.', fmtSize(total)));
    if (total > 1024 * 1024 * 1024) {
      parts.push(T('Über 1 GB: Der Browser hält alles im Arbeitsspeicher, und ein ZIP fasst höchstens 4 GB. ' +
        'Große Pakete besser als „Leeres Paket“ anlegen und die Dateien direkt aufs Medium kopieren.'));
    }
    if (total && state.paths.zipRoot === 'both' && active.some((d) => d.dest !== 'winpe' && driverStats(d).count)) {
      parts.push(T('Mit der ZIP-Wurzel „beide Orte“ liegen die pnputil-Pakete doppelt im Archiv.'));
    }
    if (active.some((d) => d.dest === 'winpe')) {
      parts.push(T('$WinPEDriver$ liegt im Wurzelverzeichnis des ZIP und gehört ins Wurzelverzeichnis des Mediums.'));
    }
    hint.textContent = parts.join(' ');
  }

  /* ---------------- Office ---------------- */

  function renderOfficeSummary() {
    const box = $('#officeSummary');
    const xml = state.office.xml || '';
    if (!xml.trim()) { box.innerHTML = '<p class="muted">' + T('Keine Configuration.xml hinterlegt.') + '</p>'; return; }
    let cfg;
    try { cfg = Importers.parseOfficeConfig(xml); }
    catch (e) { box.innerHTML = '<p class="muted">' + T('Nicht lesbar: ') + e.message + '</p>'; return; }

    const silent = /<Display\b[^>]*Level\s*=\s*"None"/i.test(xml);
    const dl = document.createElement('dl');
    const row = (k, v) => {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.appendChild(dt); dl.appendChild(dd);
    };
    row(T('Architektur'), cfg.edition ? cfg.edition + T(' Bit') : '–');
    row(T('Kanal'), cfg.channel || '–');
    if (cfg.version) row(T('Version'), cfg.version);
    row(T('Produkte'), cfg.products.length ? '' : '–');
    box.innerHTML = '';
    box.appendChild(dl);

    if (cfg.products.length) {
      const ul = document.createElement('ul');
      cfg.products.forEach((p) => {
        const li = document.createElement('li');
        li.textContent = p.id + (p.languages.length ? ' [' + p.languages.join(', ') + ']' : '') +
          (p.excluded.length ? T(' – ohne: ') + p.excluded.join(', ') : '');
        ul.appendChild(li);
      });
      dl.lastChild.appendChild(ul);
    }
    row(T('MSI-Vorgänger entfernen'), cfg.removeMSI ? T('ja') : T('nein'));
    row(T('Updates'), cfg.updatesEnabled === null ? T('Standard') : cfg.updatesEnabled);
    row(T('Benutzereinstellungen'), F('{0} Einträge', cfg.appSettings));

    const warn = document.createElement('p');
    warn.className = 'hint';
    if (silent) {
      warn.textContent = T('Unbeaufsichtigte Installation ist konfiguriert (Display Level="None").');
    } else {
      warn.innerHTML = T('Kein <code>&lt;Display Level="None" AcceptEULA="TRUE" /&gt;</code> – die Installation würde eine Oberfläche anzeigen. ');
      const b = document.createElement('button');
      b.className = 'btn small'; b.textContent = T('Automatisch ergänzen');
      b.addEventListener('click', () => {
        state.office.xml = Importers.ensureSilentDisplay(state.office.xml);
        $('#officeXml').value = state.office.xml;
        renderOfficeSummary(); refresh();
        toast(T('Display-Element ergänzt.'), 'ok');
      });
      warn.appendChild(b);
    }
    box.appendChild(warn);
  }

  /* UseConfigurationSet wirkt nur, wenn eine autounattend.xml erzeugt wird. */
  function configSetActive() {
    return state.options.configSet !== false && state.options.trigger !== 'setupcomplete';
  }

  function renderConfigSetHint() {
    const h = $('#configSetHint');
    if (!h) return;
    let txt = '', warn = false;
    if (state.options.trigger === 'setupcomplete') {
      txt = T('Ohne autounattend.xml ohne Wirkung – $OEM$ gehört dann nach sources\\.');
    } else if (state.options.configSet === false) {
      txt = T('Achtung: Ohne UseConfigurationSet hat Windows Setup (Windows 11, Build 26300) $OEM$ im Test gar nicht kopiert – kein Installationsordner, keine Phase 2.');
      warn = true;
    } else if (state.paths.zipRoot === 'sources') {
      txt = T('Achtung: Mit UseConfigurationSet=true sucht Setup $OEM$ im Wurzelverzeichnis – die Ablage „sources“ allein wird ignoriert.');
      warn = true;
    } else {
      txt = T('Setup kopiert den Ordner der Antwortdatei nach C:\\Windows\\ConfigSetRoot. Auf einem normalen Installationsmedium unkritisch; auf Multiboot-Sticks (Ventoy) kann das sehr groß werden.');
    }
    h.textContent = txt;
    h.style.color = warn ? 'var(--warn)' : '';
  }

  function renderUnattend() {
    renderConfigSetHint();
    const box = $('#unattendBox');
    const drop = $('#btnUnattendDrop');
    box.innerHTML = '';
    if (state.options.trigger === 'setupcomplete') { drop.hidden = true; return; }

    const u = state.unattend || {};
    if (!u.xml) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = T('Es wird eine eigenständige autounattend.xml erzeugt, die nur die Skripte startet. ' +
        'Wenn Sie bereits eine Antwortdatei verwenden, importieren Sie diese hier – der Generator ergänzt sie, ' +
        'statt sie zu ersetzen.');
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
    row(T('Importierte Datei'), u.name);
    row(T('Vorhandene Befehle'), String(u.info.commandCount));
    row(T('Passes'), u.info.passes.filter(Boolean).join(', ') || '–');
    row(T('UseConfigurationSet'), (u.info.useConfigurationSet ? 'true' : 'false') +
      (configSetActive() && !u.info.useConfigurationSet ? ' → true' + T(' (setzt der Generator)') : ''));
    if (u.info.productKey) row(T('Produktschlüssel'), u.info.productKey);
    box.appendChild(dl);

    const p = document.createElement('p');
    p.className = 'hint';
    if (u.info.useConfigurationSet || configSetActive()) {
      p.innerHTML = T('<b>UseConfigurationSet=true:</b> Windows Setup sucht den <code>$OEM$</code>-Ordner neben der ' +
        'Antwortdatei, also im <b>Wurzelverzeichnis</b> des Mediums – nicht unter <code>sources\\</code>. ' +
        'Die Ablage steht deshalb auf „beide Orte“.');
      p.style.color = 'var(--warn)';
    } else {
      p.textContent = T('Die Aufrufe werden mit fortlaufender Order in die vorhandenen Blöcke eingefügt; ' +
        'bereits vorhandene Einträge des Generators werden dabei ersetzt.');
    }
    box.appendChild(p);
  }

  /* ---------------- Windows-Komponenten ---------------- */

  function renderFeatures() {
    const box = $('#featuresList');
    const filter = ($('#featuresFilter').value || '').toLowerCase();
    box.innerHTML = '';

    for (const f of Catalog.FEATURES) {
      const haystack = [f.id, f.label, f.cat, f.desc || '', T(f.label), T(f.cat), T(f.desc || '')]
        .join(' ').toLowerCase();
      if (filter && !haystack.includes(filter)) continue;
      const on = state.features.selected.includes(f.id);
      const lab = document.createElement('label');
      lab.className = 'tweak' + (on ? ' sel' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = on;
      cb.addEventListener('change', () => {
        if (cb.checked) { if (!state.features.selected.includes(f.id)) state.features.selected.push(f.id); }
        else state.features.selected = state.features.selected.filter((x) => x !== f.id);
        lab.classList.toggle('sel', cb.checked);
        renderFeatureHints();
        refresh();
      });
      const marks = [];
      if (f.pro) marks.push(T('nur Pro/Enterprise'));
      if (f.vt) marks.push(T('VT im BIOS'));
      if (f.net) marks.push(T('Netzwerk'));
      if (f.payload) marks.push(T('Quelle nötig'));
      if (f.reboot) marks.push(T('Neustart nötig'));
      const div = document.createElement('div');
      div.innerHTML = '<div class="cat"></div><div class="t"></div><div class="d"></div>';
      div.querySelector('.cat').textContent = T(f.cat) + (marks.length ? ' · ' + marks.join(' · ') : '');
      div.querySelector('.t').textContent = T(f.label);
      if (f.help) {
        /* Ein Link in einem <label> löst kein Umschalten der Checkbox aus. */
        const a = document.createElement('a');
        a.className = 'help-link';
        a.href = helpUrl(f.help);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = '?';
        a.title = T('Hilfe bei Microsoft');
        a.setAttribute('aria-label', T('Hilfe bei Microsoft') + ': ' + T(f.label));
        div.querySelector('.t').appendChild(a);
      }
      div.querySelector('.d').textContent = (f.desc ? T(f.desc) + ' ' : '') + f.id;
      lab.appendChild(cb); lab.appendChild(div);
      box.appendChild(lab);
    }
    renderFeatureHints();
  }

  /* Microsoft-Hilfeseiten in der Sprache der Oberfläche. */
  function helpUrl(url) {
    return url.replace('{loc}', I18n.lang === 'en' ? 'en-us' : 'de-de');
  }

  function renderFeatureHints() {
    const sel = Catalog.FEATURES.filter((f) => state.features.selected.includes(f.id));
    const phase = $('#featuresPhaseHint');
    if (phase) {
      const needNet = sel.filter((f) => f.net || f.payload);
      if (state.features.phase === 'setup') {
        phase.innerHTML = T('In Phase 1 wartet Windows Setup auf jeden DISM-Aufruf – das verlängert die Installation ' +
          'erheblich, und nachzuladende Komponenten scheitern dort mangels Netzwerk.') +
          (needNet.length ? ' <b>' + needNet.map((f) => T(f.label)).join(', ') + '</b>' +
            T(' braucht einen Download und gehört deshalb in Phase 2.') : '');
        phase.style.color = needNet.length ? 'var(--warn)' : 'var(--acc2)';
      } else {
        phase.textContent = T('Empfohlen: DISM läuft dann ohne Zeitdruck, und für Features on Demand steht das Netzwerk bereit.');
        phase.style.color = '';
      }
    }
    const vt = $('#featuresVtHint');
    if (vt) {
      const need = sel.filter((f) => f.vt);
      if (!need.length) vt.textContent = '';
      else {
        vt.innerHTML = '<b>' + need.map((f) => T(f.label)).join(', ') + '</b>' +
          T(' – brauchen eingeschaltete Virtualisierung. Fehlt sie (BIOS/UEFI, oder eine VM ohne verschachtelte ' +
            'Virtualisierung), überspringt das Modul diese Komponenten, sonst bliebe der Neustart hängen.');
        vt.style.color = 'var(--warn)';
      }
    }
    const reb = $('#featuresRebootHint');
    if (reb) {
      const need = sel.filter((f) => f.reboot);
      if (!need.length) { reb.textContent = ''; return; }
      reb.innerHTML = '<b>' + need.map((f) => T(f.label)).join(', ') + '</b>' +
        T(' – erst nach einem Neustart nutzbar. Unter Einstellungen → Abschluss lässt sich dafür „Neustart“ ' +
          'einstellen; andernfalls vermerkt das Modul nur HKLM\\SOFTWARE\\OEM-Setup\\RestartNeeded = 1.');
      reb.style.color = 'var(--acc2)';
    }
  }

  /* ---------------- Übersicht ---------------- */

  function renderOverview() {
    const cards = $('#overviewCards');
    const activeApps = state.apps.items.filter((p) => p.enabled).length;
    const data = [
      { on: state.apps.enabled && activeApps > 0, k: T('Anwendungen'), v: activeApps, d: T(state.apps.phase === 'setup' ? 'Phase 1' : 'Phase 2') },
      { on: state.office.enabled, k: T('Office (ODT)'), v: T(state.office.enabled ? 'aktiv' : 'aus'), d: state.office.enabled ? T(state.office.phase === 'setup' ? 'Phase 1' : 'Phase 2') : '–' },
      { on: state.tweaks.enabled && state.tweaks.selected.length > 0, k: T('Tweaks'), v: state.tweaks.selected.length, d: T(state.tweaks.phase === 'setup' ? 'Phase 1' : 'Phase 2') },
      { on: state.bloat.enabled && state.bloat.selected.length > 0, k: T('Bloatware'), v: state.bloat.selected.length, d: T('AppX-Pakete') },
      { on: state.features.enabled && state.features.selected.length > 0, k: T('Komponenten'), v: state.features.selected.length, d: T(state.features.phase === 'setup' ? 'Phase 1' : 'Phase 2') },
      { on: state.drivers.enabled && state.drivers.items.some((d) => d.enabled), k: T('Treiber'), v: state.drivers.items.filter((d) => d.enabled).length,
        d: state.drivers.items.some((d) => d.enabled && d.dest !== 'winpe') ? T(state.drivers.phase === 'setup' ? 'Phase 1' : 'Phase 2') : T('Windows Setup') },
      { on: state.files.items.some((f) => f.enabled), k: T('Eigene Dateien'), v: state.files.items.filter((f) => f.enabled).length, d: T('im Archiv') }
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
    steps.push(['Setup', T('Windows Setup kopiert <code>$OEM$\\$1</code> nach ') + esc(state.paths.installRoot) + T(' und <code>$OEM$\\$$</code> nach <code>%WINDIR%</code>')]);
    if (state.drivers.enabled && state.drivers.items.some((d) => d.enabled && d.dest === 'winpe')) {
      steps.push(['Setup', T('Windows Setup lädt die Treiber aus <code>$WinPEDriver$</code>')]);
    }
    steps.push(['P1', T('<code>SetupComplete.cmd</code> startet <code>Install.ps1 -Phase Setup</code> als SYSTEM')]);
    Templates.moduleList(state, 'setup').forEach((m) => steps.push(['P1', esc(T(m[1]))]));
    if (state.custom.cmdEnabled && state.custom.cmd.trim()) steps.push(['P1', T('Eigene CMD-Befehle')]);
    const logon = Templates.moduleList(state, 'firstlogon');
    if (logon.length) {
      steps.push(['P2', T(state.options.phase2Runner === 'task'
        ? 'Geplante Aufgabe <code>OEM-Setup-Phase2</code> startet als SYSTEM bei der ersten Anmeldung'
        : '<code>RunOnce</code> startet <code>Install.ps1 -Phase FirstLogon</code>')]);
      logon.forEach((m) => steps.push(['P2', esc(T(m[1]))]));
    }
    if (state.options.finish === 'reboot') steps.push(['P2', T('Neustart')]);
    if (state.options.finish === 'shutdown') steps.push(['P2', T('Herunterfahren')]);
    steps.forEach((s) => {
      const li = document.createElement('li');
      li.innerHTML = '<span class="ph">' + s[0] + '</span>' + s[1];
      flow.appendChild(li);
    });

    $('#overviewTree').textContent = treeFromPaths(Templates.collapseDriverFiles(previewFiles, I18n.lang === 'en').map((e) => e.path));
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
    return out.join('\n') || T('(leer)');
  }

  /* ---------------- Vorschau ---------------- */

  function renderPreview() {
    const list = $('#fileList');
    list.innerHTML = '';
    /* Treiberpakete erscheinen als eine Zeile je Paket statt tausender Dateien. */
    const entries = Templates.collapseDriverFiles(previewFiles, I18n.lang === 'en');
    entries.forEach((e) => {
      const b = document.createElement('button');
      b.className = 'f' + (e.path === previewActive ? ' active' : '');
      b.innerHTML = '<span></span>';
      b.querySelector('span').textContent = e.path;
      b.title = e.path;
      b.addEventListener('click', () => { previewActive = e.path; renderPreview(); });
      list.appendChild(b);
    });
    if (!entries.some((e) => e.path === previewActive)) {
      previewActive = entries.length ? entries[0].path : null;
      if (previewActive) return renderPreview();
    }
    const entry = entries.find((e) => e.path === previewActive);
    $('#previewPath').textContent = entry ? (entry.pkg || entry.path) : '–';
    if (entry && entry.pkg) {
      const size = entry.files.reduce((a, f) => a + f.data.length, 0);
      const rels = entry.files.map((f) => f.path.slice(entry.pkg.length + 1)).sort();
      $('#previewBody').textContent = F('{0} Dateien, zusammen {1} – werden unverändert ins Archiv übernommen:', rels.length, fmtSize(size)) +
        '\n\n' + rels.slice(0, 1000).join('\n') + (rels.length > 1000 ? '\n…' : '');
      $('#previewSize').textContent = fmtSize(size);
      return;
    }
    const cur = entry && entry.file;
    if (!cur) { $('#previewBody').textContent = ''; $('#previewSize').textContent = ''; return; }
    if (cur.binary) {
      $('#previewBody').textContent = T('[Binärdatei – ') + (cur.data.length / 1024).toFixed(0) + T(' KB – wird unverändert ins Archiv übernommen]');
      $('#previewSize').textContent = (cur.data.length / 1024).toFixed(0) + ' KB';
    } else {
      $('#previewBody').textContent = cur.data;
      $('#previewSize').textContent = new Blob([cur.data]).size + ' ' + T('Bytes') + ' · ' + cur.data.split('\n').length + ' ' + T('Zeilen');
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
      /* Erst uebersetzen, dann die dynamischen Werte setzen - apply() schreibt
         ganze Elementinhalte neu und wuerde sie sonst wieder ueberbuegeln. */
      I18n.apply();
      $('#badgeApps').textContent = state.apps.items.filter((p) => p.enabled).length;
      $('#badgeTweaks').textContent = state.tweaks.selected.length;
      $('#badgeBloat').textContent = state.bloat.selected.length;
      $('#badgeFeatures').textContent = state.features.selected.length;
      labelHelp();
      $('#badgeDrivers').textContent = state.drivers.items.filter((d) => d.enabled).length;
      $('#badgeFiles').textContent = state.files.items.filter((f) => f.enabled).length;
      const rel = Templates.relFromRoot(state.paths.installRoot);
      $('#officeSetupPath').textContent = '$OEM$\\$1\\' + rel + '\\Office\\setup.exe';
      $('#filesTargetPath').textContent = state.paths.installRoot.replace(/\\+$/, '') + '\\Files';
      $('#setKeepInstallLabel').textContent = state.paths.installRoot.replace(/\\+$/, '');
      const wingetApps = state.apps.enabled && state.apps.items.some((p) => p.enabled && p.manager === 'winget');
      const systemContext = state.apps.phase === 'setup' ||
        (state.options.trigger === 'setupcomplete' && state.options.phase2Runner === 'task');
      let hint;
      if (wingetApps && systemContext) {
        hint = T('Achtung: winget läuft hier als SYSTEM. Der App-Execution-Alias existiert nur je Benutzer, ' +
          'und der direkte Aufruf aus WindowsApps bricht mit 0xC0000135 ab – in diesem Kontext schlägt ' +
          'jedes Paket fehl. Phase 2 über die autounattend.xml (FirstLogonCommands) oder RunOnce starten, ' +
          'damit die Installation im Benutzerkontext läuft.');
      } else if (state.apps.phase === 'setup') {
        hint = T('In Phase 1 existiert noch kein Benutzerprofil; Pakete, die nur benutzerbezogen installieren, schlagen dort fehl.');
      } else {
        hint = T('Empfohlen: Netzwerk und App Installer sind bei der ersten Anmeldung zuverlässig verfügbar.');
      }
      $('#appsPhaseHint').textContent = hint;
      $('#appsPhaseHint').style.color = (wingetApps && systemContext) ? 'var(--warn)' : '';

      const sb = $('#officeSourceBox');
      if (sb) {
        if (state.office.enabled && state.office.source === 'local') {
          const rel = Templates.relFromRoot(state.paths.installRoot);
          const folder = (state.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
          sb.innerHTML = '<p class="hint">' + T('Der Generator trägt <code>SourcePath</code> automatisch in die Configuration.xml ein und legt den Ordner sowie das Hilfsskript an:') + '</p>' +
            '<pre class="tree">' + esc(
              '$OEM$\\$1\\' + rel + '\\Office\\\n' +
              T('  ├─ setup.exe                   (ODT – selbst ablegen)') + '\n' +
              '  ├─ Configuration.xml           SourcePath=' + state.paths.installRoot.replace(/\\+$/, '') + '\\Office\\' + folder + '\n' +
              T('  ├─ Download-Quelle.ps1         erzeugt die Quelle auf diesem Rechner') + '\n' +
              '  └─ ' + folder + T('\\                      hierhin kommt Office\\Data\\…')
            ) + '</pre>' +
            '<p class="hint">' + T('Die Quelle selbst wird <b>nicht</b> ins ZIP gepackt – mehrere Gigabyte ' +
            'durch den Browser zu schleusen ist nicht praktikabel. Nach dem Entpacken ' +
            '<code>Download-Quelle.ps1</code> im Office-Ordner ausführen, dann steht die Offline-Installation ' +
            'auch in Phase 1 zur Verfügung. Fehlt die Quelle, weicht das Modul auf den Online-Bezug aus.') + '</p>';
        } else {
          sb.innerHTML = '';
        }
      }

      const oh = $('#officePhaseHint');
      if (oh) {
        let localSource = state.office.source === 'local';
        if (!localSource) {
          try {
            localSource = !!Importers.parseOfficeConfig(state.office.xml || '').sourcePath;
          } catch (e) { /* ungültige XML meldet bereits die Zusammenfassung */ }
        }
        if (state.office.enabled && state.office.phase === 'setup' && !localSource) {
          oh.textContent = T('Achtung: In Phase 1 (specialize) besteht noch keine Netzwerkverbindung. ' +
            'Das Office Deployment Tool lädt die Installationsdateien aber von Microsoft – auch mit ' +
            'mitgelieferter setup.exe. Entweder Phase 2 wählen oder in der Configuration.xml ' +
            'SourcePath auf eine lokale Quelle setzen.');
          oh.style.color = 'var(--warn)';
        } else if (state.office.enabled && state.office.phase === 'setup' && localSource) {
          oh.textContent = T('Die Configuration.xml verweist per SourcePath auf eine lokale Quelle – ' +
            'damit ist die Installation auch ohne Netzwerk in Phase 1 möglich.');
          oh.style.color = '';
        } else {
          oh.textContent = '';
        }
      }
      const refs = [];
      const re = /%~dp0"?([A-Za-z0-9_.\\-]+)/g;
      let m;
      while ((m = re.exec(state.custom.cmd || '')) !== null) if (!refs.includes(m[1])) refs.push(m[1]);
      const inScripts = state.files.items
        .filter((f) => f.enabled && f.dest === 'scripts')
        .map((f) => f.target.toLowerCase());
      const missing = refs.filter((r) => !inScripts.includes(r.toLowerCase()));
      $('#customCmdRefHint').textContent = missing.length
        ? T('Referenziert, aber nicht im Archiv: ') + missing.join(', ') +
          T(' – die Dateien unter „Eigene Dateien“ mit Zielordner „Setup\\Scripts“ hinzufügen.')
        : '';
      $('#customCmdRefHint').style.color = missing.length ? 'var(--warn)' : '';
      if ($('#view-preview').classList.contains('active')) renderPreview();
      if ($('#view-overview').classList.contains('active')) renderOverview();
    }, 60);
  }

  function renderAll() {
    syncInputs();
    I18n.apply();
    renderApps(); renderTweaks(); renderBloat(); renderFeatures(); renderDrivers(); renderFiles(); renderOfficeSummary(); renderUnattend();
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
      logImport(F('Datei übernommen: {0} ({1} KB)', name, Math.round(bytes.length / 1024)));
      renderFiles(); refresh();
      return;
    }

    const text = await readText(file);
    const type = opts.forceType || Importers.detectType(name, text);

    switch (type) {
      case 'project': {
        loadProject(JSON.parse(text));
        logImport('Projekt geladen: ' + name);
        toast(T('Projekt geladen.'), 'ok');
        return;
      }
      case 'bundle': {
        const pkgs = Importers.parseBundle(text, name);
        if (!pkgs.length) { logImport(F('Keine Pakete gefunden in {0}', name), 'warnl'); toast(T('Keine Pakete gefunden.'), 'warn'); return; }
        const r = addPackages(pkgs, !!opts.replace);
        state.apps.enabled = true;
        logImport(F('Bundle {0}: {1} Pakete übernommen', name, r.added) +
          (r.skipped ? F(', {0} Duplikate übersprungen', r.skipped) : ''));
        toast(F('{0} Pakete importiert.', r.added), 'ok');
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
        logImport(F('Office-Konfiguration übernommen: {0}', name) + info);
        toast(T('Configuration.xml importiert.'), 'ok');
        renderAll();
        return;
      }
      case 'cmd': {
        const res = Importers.parseSetupComplete(text);
        if (res.packages.length) {
          const r = addPackages(res.packages, false);
          logImport(F('{0}: {1} winget-Aufrufe erkannt ({2} neu', name, res.packages.length, r.added) +
            (r.skipped ? F(', {0} bereits vorhanden', r.skipped) : '') + ')');
        }
        if (res.officeConfigName) {
          state.office.enabled = true;
          logImport(F('{0}: Office-Aufruf erkannt – Configuration.xml separat importieren', name), 'warnl');
        }
        if (res.custom.length) {
          state.custom.cmd = (state.custom.cmd ? state.custom.cmd + '\n' : '') + res.custom.join('\n');
          state.custom.cmdEnabled = true;
          logImport(F('{0}: {1} eigene Befehlszeilen übernommen', name, res.custom.length));
        }
        res.notes.forEach((n) => logImport(name + ': ' + n, 'warnl'));
        if (!res.packages.length && !res.custom.length && !res.officeConfigName) {
          logImport(F('{0}: nichts Verwertbares gefunden', name), 'warnl');
        }
        toast(T('SetupComplete.cmd analysiert.'), 'ok');
        renderAll();
        return;
      }
      case 'ps1': {
        const bytes = new TextEncoder().encode(text);
        state.files.items.push({
          name, target: name, run: '', phase: 'setup', enabled: true, dest: 'files', blob: bytes, blobPresent: true
        });
        state.custom.ps = (state.custom.ps ? state.custom.ps + '\n' : '') +
          T('# Importiertes Skript ausführen') + '\n' +
          '& (Join-Path $Global:OemRoot ' + "'Files\\" + name + "')";
        state.custom.psEnabled = true;
        logImport(F('PowerShell-Skript übernommen und Aufruf ergänzt: {0}', name));
        toast(T('PowerShell-Skript importiert.'), 'ok');
        renderAll();
        return;
      }
      case 'unattend': {
        let info;
        try { info = Importers.parseUnattend(text); }
        catch (e) { logImport(name + ': ' + e.message, 'err'); toast(T('autounattend.xml nicht lesbar.'), 'err'); return; }
        state.unattend = { xml: text, name: name, info: info };
        if (state.options.trigger === 'setupcomplete') state.options.trigger = 'both';
        if ((info.useConfigurationSet || state.options.configSet !== false) && state.paths.zipRoot === 'sources') state.paths.zipRoot = 'both';
        logImport(F('autounattend.xml übernommen: {0} – {1} vorhandene Befehle, UseConfigurationSet={2}',
          name, info.commandCount, info.useConfigurationSet ? 'true' : 'false'));
        if (!info.useConfigurationSet && state.options.configSet !== false) {
          logImport(T('UseConfigurationSet=false: Ohne true kopiert ein aktuelles Windows-11-Setup $OEM$ unter Umständen gar nicht – der Generator setzt den Wert beim Export auf true.'), 'warnl');
        }
        if (info.useConfigurationSet) {
          logImport(T('UseConfigurationSet=true erkannt: $OEM$ gehört ins Wurzelverzeichnis des Mediums – Ablage auf „beide Orte“ gestellt.'), 'warnl');
        }
        toast(T('autounattend.xml wird ergänzt statt ersetzt.'), 'ok');
        renderAll();
        return;
      }
      default: {
        const bytes = new TextEncoder().encode(text);
        state.files.items.push({ name, target: name, run: '', phase: 'firstlogon', enabled: true, dest: 'files', blob: bytes, blobPresent: true });
        logImport(F('Als Datei übernommen: {0}', name), 'warnl');
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
    /* Treiberdateien gehoeren nicht in die Projektdatei - auch nicht als Liste. */
    clone.drivers.items.forEach((d, i) => {
      const n = (state.drivers.items[i].files || []).filter((f) => f.blob).length || state.drivers.items[i].missing || 0;
      d.files = [];
      if (n) d.fileCount = n; else delete d.fileCount;
      delete d.missing;
    });
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
    state.drivers.items = (state.drivers.items || []).map((d) => ({
      name: d.name || 'Treiber', dest: d.dest === 'winpe' ? 'winpe' : 'pnp', models: d.models || '',
      enabled: d.enabled !== false, files: [], missing: d.fileCount > 0 ? d.fileCount : 0
    }));
    renderAll();
    const lost = missingBinaries();
    if (lost.length) {
      toast(F('Die Projektdatei enthält keine Binärdateien. Neu zuordnen: {0}', lost.join(', ')), 'warn');
    }
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  /*  "Speichern unter"-Dialog ueber die File System Access API (Chrome, Edge -
      auch per file://). Ergebnis: ein Datei-Handle, false bei Abbruch durch den
      Benutzer, null wenn der Browser den Dialog nicht kennt (Firefox, Safari)
      oder ihn verweigert - dann bleibt es beim gewohnten Download.
      Der Dialog muss direkt aus dem Klick heraus geoeffnet werden; Chrome
      verlangt dafuer eine frische Benutzeraktion. Deshalb erst waehlen lassen,
      dann den Inhalt erzeugen. Ueber "id" merkt sich Chrome den zuletzt
      gewaehlten Ordner getrennt fuer Projektdateien und ZIPs. */
  /*  Letzter Speicherort. Chrome merkt sich ueber "id" zwar selbst einen Ordner,
      bei per file:// geoeffneten Seiten aber nicht verlaesslich. Deshalb wird der
      zuletzt gewaehlte Datei-Handle in IndexedDB abgelegt (Handles lassen sich
      dort speichern) und beim naechsten Dialog als startIn uebergeben - der
      Dialog oeffnet dann im Ordner dieser Datei, auch nach einem Neuladen.
      Projektdatei und ZIP haben je einen eigenen Eintrag; fehlt einer, gilt der
      andere. Ohne IndexedDB (privates Fenster) bleibt es beim Verhalten des
      Browsers. */
  const lastPlace = (function () {
    let dbp = null;
    function db() {
      if (!dbp) {
        dbp = new Promise((resolve) => {
          try {
            const req = indexedDB.open('oemgen', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('handles');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          } catch (e) { resolve(null); }
        });
      }
      return dbp;
    }
    async function run(mode, fn) {
      const d = await db();
      if (!d) return null;
      return new Promise((resolve) => {
        try {
          const tx = d.transaction('handles', mode);
          const req = fn(tx.objectStore('handles'));
          tx.oncomplete = () => resolve(req ? req.result : null);
          tx.onerror = tx.onabort = () => resolve(null);
        } catch (e) { resolve(null); }
      });
    }
    return {
      get: (key) => run('readonly', (st) => st.get(key)),
      set: (key, handle) => run('readwrite', (st) => st.put(handle, key))
    };
  })();

  const PLACE_KEYS = ['oem-project', 'oem-zip'];

  async function startInFor(id) {
    const own = await lastPlace.get(id);
    if (own) return own;
    for (const k of PLACE_KEYS) {
      if (k === id) continue;
      const other = await lastPlace.get(k);
      if (other) return other;
    }
    return null;
  }

  async function pickSaveTarget(filename, opts) {
    if (typeof window.showSaveFilePicker !== 'function') return null;
    const startIn = await startInFor(opts.id);
    const base = { suggestedName: filename, id: opts.id, types: [{ description: opts.description, accept: opts.accept }] };
    let handle = null;
    try {
      handle = await window.showSaveFilePicker(startIn ? Object.assign({ startIn }, base) : base);
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      /* Ein veralteter Ort (Datei geloescht, Laufwerk weg) darf den Dialog nicht verhindern. */
      if (startIn) {
        try { handle = await window.showSaveFilePicker(base); }
        catch (e2) {
          if (e2 && e2.name === 'AbortError') return false;
          console.warn('Speichern-Dialog nicht verfuegbar, falle auf Download zurueck:', e2);
          return null;
        }
      } else {
        console.warn('Speichern-Dialog nicht verfuegbar, falle auf Download zurueck:', e);
        return null;
      }
    }
    await lastPlace.set(opts.id, handle);
    return handle;
  }

  /*  Projekt laden ueber den Oeffnen-Dialog, im Ordner der zuletzt gespeicherten
      bzw. geladenen Projektdatei. Ohne die Schnittstelle: das versteckte
      Datei-Feld wie bisher. */
  async function openProjectFile() {
    if (typeof window.showOpenFilePicker !== 'function') { $('#projectInput').click(); return; }
    const startIn = await startInFor('oem-project');
    const base = { id: 'oem-project', multiple: false,
      types: [{ description: T('OEM-Projektdatei'), accept: { 'application/json': ['.json'] } }] };
    let handles;
    try {
      handles = await window.showOpenFilePicker(startIn ? Object.assign({ startIn }, base) : base);
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      try { handles = await window.showOpenFilePicker(base); }
      catch (e2) { if (!e2 || e2.name !== 'AbortError') $('#projectInput').click(); return; }
    }
    const handle = handles && handles[0];
    if (!handle) return;
    await lastPlace.set('oem-project', handle);
    importFile(await handle.getFile(), { forceType: 'project' });
  }

  async function writeToHandle(handle, blob) {
    const w = await handle.createWritable();
    try { await w.write(blob); } finally { await w.close(); }
  }

  async function saveProject() {
    const name = (state.meta.name || 'Projekt').replace(/[^\w.-]+/g, '_') + '.oemproj.json';
    const handle = await pickSaveTarget(name, {
      id: 'oem-project', description: T('OEM-Projektdatei'), accept: { 'application/json': ['.json'] }
    });
    if (handle === false) return;
    const blob = new Blob([projectJson()], { type: 'application/json' });
    if (handle) {
      try {
        await writeToHandle(handle, blob);
        toast(F('Projekt gespeichert: {0}', handle.name), 'ok');
      } catch (e) {
        console.error(e);
        toast(F('Speichern fehlgeschlagen: {0}', e.message), 'err');
      }
      return;
    }
    download(blob, name);
    toast(T('Projektdatei gespeichert.'), 'ok');
  }

  /*  Was ins ZIP gehoert, aber nur als Platzhalter vorliegt - typisch nach dem
      Laden einer Projektdatei. Bewusst leer angelegte Treiberpakete zaehlen
      nicht dazu. */
  function missingBinaries() {
    const out = [];
    state.files.items.filter((f) => f.enabled && !f.blob).forEach((f) => out.push(f.name));
    if (state.drivers.enabled) {
      state.drivers.items.filter((d) => d.enabled && d.missing && !driverStats(d).count)
        .forEach((d) => out.push(F('Treiber „{0}“', d.name)));
    }
    return out;
  }

  /*  js/zip.js schreibt kein ZIP64: ueber 4 GB Gesamtgroesse oder 65535
      Eintraege entstuende ein defektes Archiv. Mit etwas Abstand abbrechen. */
  const ZIP_MAX_BYTES = 3.8 * 1024 * 1024 * 1024;
  const ZIP_MAX_ENTRIES = 65000;

  async function exportZip() {
    if (!previewFiles.length) previewFiles = Templates.build(state);
    const total = previewFiles.reduce((a, f) => a + (f.data ? f.data.length : 0), 0);
    if (total > ZIP_MAX_BYTES || previewFiles.length > ZIP_MAX_ENTRIES) {
      alert(F('Das ZIP würde {0} mit {1} Dateien groß – mehr, als ein ZIP ohne ZIP64 fassen kann (4 GB, 65535 Dateien).\n\n' +
        'Große Treiberpakete besser als „Leeres Paket“ anlegen und die Dateien nach dem Entpacken direkt aufs Medium kopieren. ' +
        'Die Ablage „beide Orte“ verdoppelt die pnputil-Treiber; „sources\\$OEM$“ allein halbiert die Größe.',
        fmtSize(total), previewFiles.length));
      return;
    }
    const lost = missingBinaries();
    if (lost.length && !confirm(F('Diese Dateien fehlen und kommen nur als Platzhalter ins ZIP:\n\n{0}\n\n' +
        'Die Projektdatei enthält keine Binärdateien – nach dem Laden müssen sie unter „Eigene Dateien“ bzw. „Treiber“ ' +
        'neu zugeordnet werden. Trotzdem erzeugen?', lost.map((x) => '• ' + x).join('\n')))) return;
    const zipName = (state.meta.name || 'OEM').replace(/[^\w.-]+/g, '_') + '-OEM.zip';
    const handle = await pickSaveTarget(zipName, {
      id: 'oem-zip', description: T('ZIP-Archiv'), accept: { 'application/zip': ['.zip'] }
    });
    if (handle === false) return;
    const btn = $('#btnExport');
    btn.disabled = true; btn.textContent = T('Erzeuge …');
    try {
      const entries = previewFiles.map((f) => ({ path: f.path, data: f.data }));
      entries.push({ path: (state.meta.name || 'Projekt').replace(/[^\w.-]+/g, '_') + '.oemproj.json', data: projectJson() });
      const blob = await MiniZip.createZip(entries);
      if (handle) {
        await writeToHandle(handle, blob);
        toast(F('ZIP mit {0} Dateien gespeichert: {1}', entries.length, handle.name), 'ok');
      } else {
        download(blob, zipName);
        toast(F('ZIP mit {0} Dateien erstellt.', entries.length), 'ok');
      }
    } catch (e) {
      console.error(e);
      toast(F('Export fehlgeschlagen: {0}', e.message), 'err');
    } finally {
      btn.disabled = false; btn.textContent = T('ZIP erzeugen');
    }
  }

  /* ---------------- Ereignisse ---------------- */

  function wire() {
    $$('.nav-item').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));

    $('#btnExport').addEventListener('click', exportZip);
    $('#btnSaveProject').addEventListener('click', saveProject);
    $('#btnLoadProject').addEventListener('click', openProjectFile);
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
        logImport(F('Eingefügtes Bundle: {0} Pakete übernommen', r.added));
        toast(F('{0} Pakete importiert.', r.added), 'ok');
        renderAll();
      } catch (e) { toast(F('Konnte nicht gelesen werden: {0}', e.message), 'err'); }
    });
    $('#btnClearLog').addEventListener('click', () => {
      $('#importLog').innerHTML = '<li class="muted">' + T('Noch nichts importiert.') + '</li>';
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
    $$('#appsTable th.sortable').forEach((th) => th.addEventListener('click', () => toggleAppsSort(th.dataset.sort)));
    $('#btnAppsAll').addEventListener('click', () => { state.apps.items.forEach((p) => { p.enabled = true; }); renderApps(); refresh(); });
    $('#btnAppsNone').addEventListener('click', () => { state.apps.items.forEach((p) => { p.enabled = false; }); renderApps(); refresh(); });
    $('#btnAppsClear').addEventListener('click', () => {
      if (!state.apps.items.length || confirm(T('Paketliste wirklich leeren?'))) { state.apps.items = []; renderApps(); refresh(); }
    });
    $('#btnAppsAdd').addEventListener('click', () => {
      const id = prompt(T('Paket-ID (z. B. 7zip.7zip):'));
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
    $('#featuresFilter').addEventListener('input', renderFeatures);
    $('#btnFeaturesNone').addEventListener('click', () => { state.features.selected = []; renderFeatures(); refresh(); });
    $('#bloatFilter').addEventListener('input', renderBloat);
    $('#btnBloatNone').addEventListener('click', () => { state.bloat.selected = []; renderBloat(); refresh(); });
    $('#btnBloatRec').addEventListener('click', () => {
      Catalog.BLOAT.filter((b) => b.rec).forEach((b) => {
        if (!state.bloat.selected.includes(b.id)) state.bloat.selected.push(b.id);
      });
      state.bloat.enabled = true;
      renderAll();
      toast(F('{0} Pakete zum Entfernen ausgewählt.', state.bloat.selected.length), 'ok');
    });
    $('#btnBloatAdd').addEventListener('click', () => {
      const id = prompt(T('AppX-Paketname (z. B. Microsoft.BingNews):'));
      if (!id) return;
      if (!state.bloat.selected.includes(id.trim())) state.bloat.selected.push(id.trim());
      state.bloat.enabled = true;
      renderAll();
    });

    /* Dateien */
    $('#btnFilesAdd').addEventListener('click', () => $('#filesInput').click());
    /* Treiber */
    $('#btnDriversFolder').addEventListener('click', () => $('#driversFolderInput').click());
    $('#btnDriversFiles').addEventListener('click', () => $('#driversFilesInput').click());
    $('#btnDriversEmpty').addEventListener('click', () => {
      state.drivers.items.push({ name: uniqueDriverName(T('Treiber'), null), dest: 'pnp', models: '', enabled: true, files: [] });
      state.drivers.enabled = true;
      syncInputs(); renderDrivers(); refresh();
    });
    $('#driversFolderInput').addEventListener('change', async (e) => {
      /* Ein gewaehlter Ordner wird ein Paket; der Ordnername wird der Paketname. */
      const groups = new Map();
      for (const f of Array.from(e.target.files)) {
        const parts = (f.webkitRelativePath || f.name).split('/');
        const top = parts.length > 1 ? parts[0] : 'Treiber';
        const rel = parts.length > 1 ? parts.slice(1).join('/') : f.name;
        if (!groups.has(top)) groups.set(top, []);
        groups.get(top).push({ rel, file: f });
      }
      e.target.value = '';
      if (driverRefill) {
        /* Vorhandenes Paket fuellen: Name, Ziel und Modellfilter bleiben. */
        const d = driverRefill;
        driverRefill = null;
        d.files = [];
        for (const list of groups.values()) for (const x of list) d.files.push({ rel: x.rel, blob: await readBytes(x.file) });
        d.missing = 0;
        const st = driverStats(d);
        toast(F(st.count === 1 ? 'Treiberpaket „{0}“: {1} Datei, {2} INF.' : 'Treiberpaket „{0}“: {1} Dateien, {2} INF.', d.name, st.count, st.inf), st.inf ? 'ok' : 'warn');
        renderDrivers(); refresh();
        return;
      }
      for (const [name, list] of groups) {
        const d = await addDriverPackage(name, list);
        const st = driverStats(d);
        toast(F(st.count === 1 ? 'Treiberpaket „{0}“: {1} Datei, {2} INF.' : 'Treiberpaket „{0}“: {1} Dateien, {2} INF.', d.name, st.count, st.inf), st.inf ? 'ok' : 'warn');
      }
      syncInputs(); renderDrivers(); refresh();
    });
    $('#driversFilesInput').addEventListener('change', async (e) => {
      const list = Array.from(e.target.files).map((f) => ({ rel: f.name, file: f }));
      e.target.value = '';
      if (!list.length) return;
      const inf = list.find((x) => /\.inf$/i.test(x.rel)) || list[0];
      await addDriverPackage(inf.rel.replace(/\.[^.]+$/, ''), list);
      syncInputs(); renderDrivers(); refresh();
    });

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
      try { await navigator.clipboard.writeText(cur.data); toast(T('In die Zwischenablage kopiert.'), 'ok'); }
      catch (e) { toast(T('Kopieren nicht möglich.'), 'err'); }
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
      toast(T('Importierte autounattend.xml verworfen.'), 'ok');
    });

    /* Einstellungen */
    $('#btnReset').addEventListener('click', () => {
      if (!confirm(T('Projekt auf Werkseinstellungen zurücksetzen?'))) return;
      state = defaultState();
      renderAll();
      toast(T('Projekt zurückgesetzt.'), 'ok');
    });

    /* Sprache */
    $$('.langswitch .lang').forEach((b) => {
      b.addEventListener('click', () => I18n.setLanguage(b.dataset.lang));
    });
    document.addEventListener('oemgen:language', () => {
      $$('.langswitch .lang').forEach((b) => b.classList.toggle('active', b.dataset.lang === I18n.lang));
      renderAll();
    });

    window.addEventListener('beforeunload', (e) => {
      if (state.apps.items.length || state.tweaks.selected.length || state.office.enabled) {
        e.preventDefault(); e.returnValue = '';
      }
    });
  }

  /* ---------------- Hilfe ---------------- */

  /*  Jede Seite bekommt im Kopf einen Hilfe-Knopf. Das h2 traegt data-i18n und
      wird bei jedem Sprachwechsel neu beschrieben - der Knopf darf deshalb
      nicht darin liegen, sondern daneben in einem eigenen Kopfbereich. */
  let helpTopic = null;

  function setupHelp() {
    $$('section.view').forEach((sec) => {
      const h2 = sec.querySelector(':scope > h2');
      if (!h2) return;
      const view = sec.id.replace(/^view-/, '');
      if (!Help.get(view, 'de')) return;
      const head = document.createElement('div');
      head.className = 'view-head';
      sec.insertBefore(head, h2);
      head.appendChild(h2);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn small help-btn';
      btn.dataset.helpView = view;
      btn.innerHTML = '<span class="q">?</span><span class="lbl"></span>';
      btn.addEventListener('click', () => openHelp(view));
      head.appendChild(btn);
    });
    $('#helpClose').addEventListener('click', () => $('#helpDialog').close());
    /* Klick auf den abgedunkelten Hintergrund schliesst ebenfalls. */
    $('#helpDialog').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#helpBody').addEventListener('click', (e) => {
      const a = e.target.closest('a[data-help]');
      if (!a) return;
      e.preventDefault();
      openHelp(a.dataset.help);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'F1') return;
      e.preventDefault();
      const active = document.querySelector('section.view.active');
      if (active) openHelp(active.id.replace(/^view-/, ''));
    });
  }

  function labelHelp() {
    $$('.help-btn').forEach((b) => {
      b.querySelector('.lbl').textContent = T('Hilfe');
      b.title = T('Hilfe zu dieser Seite (F1)');
    });
    $('#helpClose').title = T('Schließen');
    $('#helpClose').setAttribute('aria-label', T('Schließen'));
    const en = I18n.lang === 'en';
    $('#helpReadme').textContent = T('Vollständige Dokumentation im README');
    $('#helpReadme').href = 'https://github.com/dmatrix68-boop/OEM-script-gen/blob/main/' + (en ? 'README.en.md' : 'README.md');
    $('#helpKeys').textContent = T('F1 öffnet die Hilfe, Esc schließt sie');
    if (helpTopic && $('#helpDialog').open) renderHelp();
  }

  function renderHelp() {
    const doc = Help.get(helpTopic, I18n.lang);
    if (!doc) return;
    $('#helpTitle').textContent = doc.title;
    $('#helpBody').innerHTML = doc.html;
    $('#helpBody').scrollTop = 0;
  }

  function openHelp(view) {
    if (!Help.get(view, 'de')) return;
    helpTopic = view;
    renderHelp();
    const dlg = $('#helpDialog');
    if (!dlg.open) dlg.showModal();
  }

  /* ---------------- Start ---------------- */

  function init() {
    const ver = $('#appVersion');
    if (ver && window.APP_VERSION) ver.textContent = 'V' + window.APP_VERSION;
    bindAll();
    wire();
    setupHelp();
    I18n.setLanguage(I18n.detect());   /* löst renderAll über das Sprachereignis aus */
    setView('overview');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
