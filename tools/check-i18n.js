#!/usr/bin/env node
/*  Prueft die Uebersetzungen gegen index.html:

    1. Jede Marke in der Oberflaeche braucht einen Eintrag im englischen
       Woerterbuch - und umgekehrt soll kein Eintrag verwaisen.
    2. Ein uebersetzter Bereich darf kein Element mit id enthalten. apply()
       schreibt den ganzen Inhalt neu; ein darin liegender Zaehler oder Pfad
       wuerde bei jedem Aufruf ueberbuegelt. Genau so standen die Zaehler in
       der Seitenleiste dauerhaft auf 0.  */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const ctx = { console };
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js', 'i18n.js'), 'utf8'), ctx, { filename: 'i18n.js' });
const EN = ctx.I18n.dict('en');

const problems = [];

/* Marken aus der Oberflaeche einsammeln. */
const used = new Set();
for (const attr of ['data-i18n', 'data-i18n-ph', 'data-i18n-title']) {
  const re = new RegExp(attr + '="([^"]+)"', 'g');
  let m;
  while ((m = re.exec(html)) !== null) used.add(m[1]);
}

for (const key of used) {
  if (!Object.prototype.hasOwnProperty.call(EN, key)) problems.push('ohne Uebersetzung: ' + key);
}
for (const key of Object.keys(EN)) {
  if (!used.has(key)) problems.push('verwaist im Woerterbuch: ' + key);
}

/* Ein uebersetzter Bereich darf keine id mitbringen. */
for (const [key, value] of Object.entries(EN)) {
  if (/\bid\s*=/.test(value)) problems.push('enthaelt eine id (wird bei jedem apply() neu geschrieben): ' + key);
}

/* Und in der Vorlage ebenso wenig: data-i18n bis zum zugehoerigen Endetag. */
const tagRe = /<(\w+)([^>]*\bdata-i18n="[^"]*"[^>]*)>/g;
let t;
while ((t = tagRe.exec(html)) !== null) {
  if (/\/>$/.test(t[0])) continue;
  const tag = t[1];
  const rest = html.slice(tagRe.lastIndex);
  const end = rest.indexOf('</' + tag + '>');
  if (end < 0) continue;
  const inner = rest.slice(0, end);
  const id = inner.match(/\bid="([^"]+)"/);
  if (id) {
    const key = t[2].match(/data-i18n="([^"]+)"/)[1];
    problems.push('Marke "' + key + '" umschliesst das Element #' + id[1]);
  }
}

if (problems.length) {
  problems.forEach((p) => console.error('  ' + p));
  console.error('check-i18n: ' + problems.length + ' Beanstandungen.');
  process.exit(1);
}
console.log('check-i18n: Woerterbuch und Oberflaeche passen zusammen.');
