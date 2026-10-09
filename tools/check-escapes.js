#!/usr/bin/env node
/*  Sucht in den Template-Literalen von js/templates.js nach Backslash-Folgen,
    die JavaScript beim Auswerten verschluckt. '\s+' wird dort zu 's+', '\|' zu
    '|' - der erzeugte PowerShell-Code enthaelt dann ein stillschweigend anderes
    Muster. Genau so sind schon 'OfficeData' statt 'Office\Data' und ein
    wirkungsloses -split entstanden.  */
'use strict';
const fs = require('fs');
const path = require('path');

const VALID = new Set(['n', 't', 'r', 'b', 'f', 'v', '0', 'x', 'u', '\\', "'", '"', '`', '$', '\n']);
const file = path.join(__dirname, '..', 'js', 'templates.js');
const src = fs.readFileSync(file, 'utf8');

const findings = [];
let inTemplate = false;
let line = 1;

for (let i = 0; i < src.length; i++) {
  const c = src[i];
  if (c === '\n') { line++; continue; }
  if (c === '\\' && inTemplate) {
    const next = src[i + 1];
    if (!VALID.has(next)) {
      const start = src.lastIndexOf('\n', i) + 1;
      let end = src.indexOf('\n', i);
      if (end < 0) end = src.length;
      findings.push({ line, seq: '\\' + next, text: src.slice(start, end).trim() });
    }
    i++;   // Escape-Paar ueberspringen
    continue;
  }
  if (c === '`' && src[i - 1] !== '\\') inTemplate = !inTemplate;
}

if (findings.length === 0) {
  console.log('check-escapes: keine verschluckten Backslash-Folgen gefunden.');
  process.exit(0);
}
console.error('check-escapes: ' + findings.length + ' verdaechtige Stelle(n):\n');
for (const f of findings) {
  console.error('  js/templates.js:' + f.line + '  ' + f.seq + '  ->  ' + f.text.slice(0, 110));
}
console.error('\nIm Template-Literal verdoppeln: \\\\s statt \\s.');
process.exit(1);
