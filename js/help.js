/*  Hilfetexte je Seite, auf Deutsch und Englisch.

    Jede Seite (section.view) bekommt einen Hilfe-Knopf; app.js zeigt den
    passenden Eintrag in einem Dialog an. Die Texte sind HTML. Verweise auf
    andere Themen schreibt man als <a data-help="settings">…</a> - ein Klick
    blaettert im Dialog dorthin, ohne die Seite zu wechseln.

    Die Texte gehoeren bewusst nicht in i18n.js: das Woerterbuch uebersetzt
    kurze Oberflaechentexte, hier stehen ganze Kapitel. */
(function (global) {
  'use strict';

  const DE = {
    overview: {
      title: 'Übersicht – so funktioniert der Generator',
      html: `
<p>Der Generator erzeugt ein ZIP mit einer fertigen <code>$OEM$</code>-Ordnerstruktur und einer
<code>autounattend.xml</code>. Kopiert auf ein Windows-11-Installationsmedium, richtet es jeden damit
installierten Rechner automatisch ein: Treiber, Einstellungen, Bloatware, Windows-Komponenten, Office und
Anwendungen.</p>

<h3>In fünf Schritten zum Medium</h3>
<ol>
  <li><b>Importieren</b> – vorhandene <code>SetupComplete.cmd</code>, UniGetUI-Bundle, Office-<code>Configuration.xml</code>
    oder eine bestehende <code>autounattend.xml</code> einlesen (<a data-help="import">Import</a>).</li>
  <li><b>Module einstellen</b> – jede Seite in der linken Leiste ist ein Modul mit eigenem Schalter
    „Modul aktiv“. Die Zahl neben dem Eintrag zeigt, wie viele Elemente gewählt sind.</li>
  <li><b>Ablauf festlegen</b> – Auslöser, Ablage von <code>$OEM$</code> und was am Ende passiert
    (<a data-help="settings">Einstellungen</a>).</li>
  <li><b>Prüfen</b> – in der <a data-help="preview">Vorschau</a> jede erzeugte Datei ansehen.</li>
  <li><b>ZIP erzeugen</b> und den Inhalt in das <b>Wurzelverzeichnis</b> des Mediums kopieren – oder in Chrome und Edge
    <b>In Ordner exportieren</b> und gleich das Wurzelverzeichnis des USB-Sticks wählen. Die <code>LIESMICH.txt</code>
    listet auf, was noch von Hand ergänzt werden muss.</li>
</ol>

<h3>ZIP oder Ordner?</h3>
<p><b>ZIP erzeugen</b> funktioniert in jedem Browser. Ab 4 GB oder 65535 Dateien schreibt der Generator automatisch
ZIP64 – das entpackt der Windows-Explorer ab Windows 10 ebenso wie 7-Zip; sehr alte Werkzeuge kennen es unter Umständen
nicht. Installer und Treiber über 128 MB kommen unkomprimiert ins ZIP (sie sind meist ohnehin schon gepackt), dafür ohne
den Arbeitsspeicher zu belasten. <b>In Ordner exportieren</b> (Chrome, Edge) schreibt die Dateien direkt in einen Ordner
und spart das Entpacken. Liegen im Ziel schon
<code>$OEM$</code>, <code>sources\$OEM$</code> oder <code>$WinPEDriver$</code>, werden genau diese Ordner nach Rückfrage
geleert, damit keine alten Dateien (etwa entfernte Treiber) mit eingespielt werden; alles andere, etwa
<code>sources\install.wim</code>, bleibt unberührt. Eine vorhandene, nicht importierte <code>autounattend.xml</code>
würde ersetzt – auch darauf weist die Rückfrage hin.</p>
<p>Bestimmte Dateitypen – vor allem <code>.dll</code>, dazu <code>.ini</code>, <code>.cfg</code>, <code>.manifest</code>
und Verknüpfungen – schreibt Chrome aus Sicherheitsgründen nicht unter ihrem Namen in Ordner. Der Export legt sie mit der
Zusatzendung <code>.oemrename</code> ab und listet sie in <code>Umbenennen.txt</code> neben <code>Install.ps1</code>;
<code>Install.ps1</code> gibt ihnen bei der Installation vor allen Modulen den Namen zurück. Für Treiber unter
<code>$WinPEDriver$</code> geht das nicht, weil dort kein Skript läuft – solche Pakete per ZIP ausliefern.</p>

<h3>Das Zwei-Phasen-Modell</h3>
<table>
  <tr><th>Phase</th><th>Wann</th><th>Kontext</th><th>Geeignet für</th></tr>
  <tr><td>Phase 1</td><td>am Ende von Windows Setup, vor der ersten Anmeldung</td><td>SYSTEM, oft noch ohne Netzwerk</td>
      <td>Treiber, Registry-Tweaks, Bloatware</td></tr>
  <tr><td>Phase 2</td><td>bei der ersten Anmeldung</td><td>SYSTEM (geplante Aufgabe) oder erster Benutzer</td>
      <td>alles mit Netzwerkbedarf: Anwendungen, Office, Features on Demand</td></tr>
</table>
<p>Jedes Modul hat eine eigene Phasenwahl; die Voreinstellung ist jeweils die sichere Variante.
<code>Install.ps1</code> merkt sich abgeschlossene Phasen unter <code>HKLM\\SOFTWARE\\OEM-Setup</code> –
startet ein zweiter Auslöser dieselbe Phase, wird sie übersprungen.</p>

<h3>Was die Übersicht zeigt</h3>
<ul>
  <li><b>Kacheln</b> – grün umrandet sind aktive Module mit Inhalt, darunter die Phase.</li>
  <li><b>Ablaufkette</b> – die tatsächliche Reihenfolge auf dem Zielrechner. <code>Setup</code> = Windows Setup selbst,
    <code>P1</code>/<code>P2</code> = Phase 1/2.</li>
  <li><b>Zielstruktur</b> – der Inhalt des ZIPs als Baum. Treiberpakete erscheinen als eine Zeile je Paket.</li>
</ul>

<h3>Projekt speichern</h3>
<p><b>Projekt speichern</b> legt eine <code>.oemproj.json</code> mit allen Einstellungen ab; jedes ZIP enthält sie
zusätzlich. In Chrome und Edge öffnet sich dafür – wie bei <b>ZIP erzeugen</b> – ein „Speichern unter“-Dialog. Er öffnet im
zuletzt gewählten Ordner – auch nach einem Neuladen der Seite –, ebenso <b>Projekt laden</b>; Firefox und Safari laden die Datei wie gewohnt in den Download-Ordner (dort hilft
die Browser-Einstellung „Jedes Mal nachfragen, wo eine Datei gespeichert werden soll“). Binärdateien (Installer, Treiber) stehen nicht darin und müssen nach dem Laden erneut hinzugefügt
werden – die Einträge bleiben als Platzhalter erhalten.</p>

<p class="muted">Tipp: <kbd>F1</kbd> öffnet die Hilfe zur aktuellen Seite.</p>`
    },

    import: {
      title: 'Import',
      html: `
<p>Hier werden vorhandene Skripte und Listen eingelesen, damit man nicht bei null anfängt. Dateien lassen sich
auf die Fläche ziehen oder auswählen – auch mehrere auf einmal, auch irgendwo auf der Seite abgelegt.</p>

<h3>Was erkannt wird</h3>
<table>
  <tr><th>Datei</th><th>Was passiert</th></tr>
  <tr><td><code>.ubundle</code>, winget-Export (<code>.json</code>), XML/YAML-Bundle</td>
      <td>Pakete landen unter <a data-help="apps">Anwendungen</a>, inklusive Manager (winget, Chocolatey, Scoop, npm, pip,
      Cargo, .NET Tool) und Version. Doppelte Einträge werden zusammengeführt.</td></tr>
  <tr><td><code>SetupComplete.cmd</code> / <code>.bat</code></td>
      <td>Wird analysiert: <code>winget install</code>-Zeilen werden zu Paketen, ein Office-Aufruf wird erkannt,
      alle übrigen Zeilen landen unverändert unter <a data-help="custom">Eigene Befehle</a>.</td></tr>
  <tr><td>ODT-<code>Configuration.xml</code></td><td>Wird ins <a data-help="office">Office</a>-Modul übernommen und aktiviert es.</td></tr>
  <tr><td><code>autounattend.xml</code></td>
      <td>Wird <b>ergänzt statt ersetzt</b> (siehe <a data-help="settings">Einstellungen → Auslöser</a>). Bei
      <code>UseConfigurationSet=true</code> stellt der Generator die Ablage auf „beide Orte“.</td></tr>
  <tr><td><code>.ps1</code></td><td>Wird als Datei mitgeliefert, der Aufruf wird unter Eigene Befehle → PowerShell ergänzt.</td></tr>
  <tr><td><code>.exe</code>, <code>.msi</code> und andere Binärdateien</td><td>Landen unter <a data-help="files">Eigene Dateien</a>.</td></tr>
  <tr><td><code>.oemproj.json</code></td><td>Lädt ein gespeichertes Projekt komplett.</td></tr>
</table>

<h3>UniGetUI-Bundle</h3>
<p>In UniGetUI: <i>Pakete-Bündel → Bündel exportieren</i>. Mit <b>vorhandene Liste ersetzen</b> wird die
Anwendungsliste vorher geleert, sonst werden neue Pakete angehängt. Unter <i>Bundle-Inhalt einfügen</i> lässt sich
der Inhalt auch per Zwischenablage übernehmen.</p>

<h3>Importprotokoll</h3>
<p>Jeder Import schreibt eine Zeile: was übernommen wurde, was nicht erkannt wurde, und Warnungen – etwa wenn eine
<code>SetupComplete.cmd</code> eine Office-Installation enthält, deren <code>Configuration.xml</code> noch fehlt.</p>`
    },

    apps: {
      title: 'Anwendungen',
      html: `
<p>Installiert Programme über Paketmanager – in erster Linie <b>winget</b>, daneben Chocolatey, Scoop, npm, pip,
Cargo, .NET Tool und PowerShell Gallery. Chocolatey wird bei Bedarf automatisch nachinstalliert.</p>

<h3>Einstellungen</h3>
<dl>
  <dt>Ausführungsphase</dt>
  <dd><b>Phase 2</b> ist die Empfehlung. winget ist ein MSIX-Paket, dessen Aufruf-Alias nur je Benutzer existiert;
  als SYSTEM scheitern viele Pakete, und in Phase 1 fehlt oft noch das Netzwerk. Der Hinweis unter den Optionen
  warnt, wenn die gewählte Kombination winget im SYSTEM-Kontext laufen ließe.</dd>
  <dt>Installationsmethode</dt>
  <dd><b>Einzelbefehle je Paket</b> – jedes Paket mit eigenem Aufruf, Wiederholversuchen, Zeitlimit und eigener
  Fehlermeldung. <b>winget import</b> – eine <code>packages.json</code> in einem Rutsch; schneller, aber ein Fehler
  ist schwerer einem Paket zuzuordnen. Nicht-winget-Pakete laufen immer einzeln.</dd>
  <dt>Wiederholversuche / Zeitlimit je Paket</dt>
  <dd>Ein Paket, das scheitert oder hängt, wird nach Ablauf abgebrochen und erneut versucht. Ein einzelnes hängendes
  Paket hält damit nie den ganzen Lauf auf.</dd>
  <dt>Auf Netzwerkverbindung warten</dt><dd>Wartet vor dem ersten Paket, bis das Internet erreichbar ist.</dd>
  <dt><code>winget source update</code> vorab</dt><dd>Aktualisiert die Paketquelle – frisch installierte Systeme haben oft einen veralteten Index.</dd>
  <dt>winget/App Installer nachinstallieren</dt><dd>Fehlt winget, wird der App Installer geladen und registriert.</dd>
  <dt>exakte Versionen erzwingen</dt><dd>Installiert die im Bundle stehende Version statt der neuesten.</dd>
  <dt><code>--scope machine</code> bevorzugen</dt><dd>Installiert für alle Benutzer, sofern das Paket es anbietet.</dd>
</dl>

<h3>Die Paketliste</h3>
<ul>
  <li>Häkchen links: Paket wird installiert bzw. übersprungen. <b>Alle</b>/<b>Keine</b> setzen alle Häkchen.</li>
  <li>Name, Paket-ID, Version und Zusatzargumente lassen sich direkt in der Tabelle bearbeiten; der Manager per Auswahl.</li>
  <li><b>Spaltenkopf anklicken</b> sortiert auf, ab und wieder aus. Sortiert wird nur die Anzeige – installiert wird
  in der Reihenfolge der Liste.</li>
  <li>Das Filterfeld sucht in Name, ID und Manager.</li>
</ul>

<h3>Erfolg und Fehler</h3>
<p>Als Erfolg gelten <code>0</code>, die Neustart-Codes <code>3010</code>/<code>1641</code> sowie „bereits installiert“
und „kein Upgrade anwendbar“. „Paket nicht gefunden“ zählt ausdrücklich als Fehler – sonst gälte eine Tippfehler-ID
als installiert. Fehlgeschlagene Pakete stehen im Protokoll und in <code>apps-fehlgeschlagen.txt</code>.</p>`
    },

    office: {
      title: 'Microsoft Office (ODT)',
      html: `
<p>Installiert Microsoft 365 Apps, Project, Visio und andere Click-to-Run-Produkte über das <b>Office Deployment
Tool</b> (ODT, <code>setup.exe</code>) und eine <code>Configuration.xml</code>.</p>

<h3>Einstellungen</h3>
<dl>
  <dt>Ausführungsphase</dt>
  <dd><b>Phase 2</b>, weil das ODT die Installationsdateien aus dem Netz lädt und in Phase 1 meist noch kein
  Netzwerk besteht. Phase 1 ergibt nur mit lokaler Quelle Sinn.</dd>
  <dt>ODT-Setup (setup.exe)</dt>
  <dd><b>mitliefern</b> – <code>setup.exe</code> muss von Hand in den angezeigten Ordner gelegt werden; der Generator
  legt dort einen Hinweis ab. <b>zur Laufzeit laden</b> – wird von der Download-URL geholt.</dd>
  <dt>Installationsquelle</dt>
  <dd><b>online</b> – Office kommt direkt von Microsoft. <b>lokal mitgeliefert</b> – der Generator trägt
  <code>SourcePath</code> in die Configuration.xml ein und legt <code>Download-Quelle.ps1</code> bei. Dieses Skript
  einmal auf dem Vorbereitungsrechner ausführen; es lädt genau die konfigurierten Produkte und Sprachen in den
  Quellordner (mehrere Gigabyte). Ohne gefüllten Ordner weicht die Installation auf online aus.</dd>
  <dt>Überspringen, wenn Office bereits installiert ist</dt>
  <dd>Prüft vorab den Click-to-Run-Eintrag in der Registry.</dd>
</dl>

<h3>Configuration.xml</h3>
<p>Importieren, eine Vorlage einfügen oder direkt bearbeiten. Rechts zeigt <b>Erkannte Konfiguration</b> Produkte,
Sprachen, Kanal und Architektur und warnt, wenn die Datei nicht unbeaufsichtigt läuft – etwa ohne
<code>&lt;Display Level="None"/&gt;</code>. Eigene Konfigurationen lassen sich bequem unter
<code>config.office.com</code> zusammenstellen.</p>

<h3>Erfolg prüfen</h3>
<p>Der Exitcode des ODT allein entscheidet nicht: das Modul prüft nach der Installation, ob Office tatsächlich
vorhanden ist. Fehlt es, meldet die Zusammenfassung einen Fehler.</p>`
    },

    tweaks: {
      title: 'System-Tweaks',
      html: `
<p>Rund 35 Einstellungen zu Explorer, Taskleiste, Datenschutz, System und Netzwerk – per Klick an- und abwählbar.
Jede Kachel zeigt Kategorie, Beschreibung und Besonderheiten.</p>

<h3>Einstellungen</h3>
<dl>
  <dt>Ausführungsphase</dt>
  <dd><b>Phase 1</b> ist die Voreinstellung: so gelten die Werte schon bei der ersten Anmeldung.</dd>
  <dt>Benutzer-Einstellungen auch auf Default-Profil &amp; bestehende Profile anwenden</dt>
  <dd>In Phase 1 gibt es noch kein Benutzerprofil. Benutzerbezogene Werte werden deshalb in
  <code>C:\\Users\\Default\\NTUSER.DAT</code> geschrieben und gelten für jedes neu angelegte Konto; vorhandene Profile
  werden zusätzlich angepasst.</dd>
</dl>

<h3>Warum manche Tweaks in Phase 2 nachgeholt werden</h3>
<p>Einige Einstellungen brauchen einen laufenden Netzwerk- oder Dienststack (Firewall-Regeln, Netzwerkprofil,
optionale Features) oder ein angelegtes Benutzerkonto. Solche Cmdlets können in Phase 1 endlos warten – und Windows
Setup wartet mit. Der Generator legt diese Anteile deshalb automatisch in ein zweites Modul
<code>Set-Tweaks-Spaet.ps1</code>, das in Phase 2 läuft; der Hinweis oben nennt die betroffenen Tweaks. Jeder dieser
Aufrufe hat eine eigene Zeitgrenze.</p>

<h3>Tipps</h3>
<ul>
  <li>Das Filterfeld durchsucht Name, Kategorie und Beschreibung.</li>
  <li>„Keine Treiber über Windows Update“ passt gut zum <a data-help="drivers">Treiber</a>-Modul, wenn nur
  geprüfte Treiber auf die Geräte sollen.</li>
</ul>`
    },

    bloat: {
      title: 'Bloatware entfernen',
      html: `
<p>Entfernt vorinstallierte Store-Apps (AppX-Pakete) wie Spiele, Nachrichten oder Werbe-Apps.</p>

<h3>Einstellungen</h3>
<dl>
  <dt>Ausführungsphase</dt><dd><b>Phase 1</b> – dann sieht der erste Benutzer die Apps gar nicht erst.</dd>
  <dt>Auch aus dem Provisioning entfernen</dt>
  <dd>Entfernt das Paket zusätzlich aus dem Abbild, sodass es für <b>neue</b> Benutzer nicht wieder installiert wird.
  Ohne diese Option verschwindet es nur bei vorhandenen Konten.</dd>
</dl>

<h3>Auswahl</h3>
<ul>
  <li><b>Empfehlung wählen</b> markiert Apps, die sich gefahrlos entfernen lassen.</li>
  <li><b>Eigenes Paket</b> nimmt einen beliebigen Paketnamen auf, etwa <code>Microsoft.BingWeather</code>. Die Namen
  zeigt <code>Get-AppxPackage | Select Name</code> auf einem Referenzrechner.</li>
</ul>

<h3>Vorsicht</h3>
<p>Systemnahe Pakete wie Store, App Installer oder Laufzeitbibliotheken nicht entfernen – ohne den
<b>App Installer</b> gibt es kein winget mehr, und das <a data-help="apps">Anwendungs</a>-Modul scheitert.</p>`
    },

    features: {
      title: 'Windows-Komponenten',
      html: `
<p>Schaltet optionale Windows-Features und Features on Demand zu – Windows Sandbox, Hyper-V, WSL, .NET 3.5,
OpenSSH, RSAT und weitere. Das <b>?</b> an jeder Komponente öffnet die passende Microsoft-Dokumentation.</p>

<h3>Zwei Arten</h3>
<table>
  <tr><th>Art</th><th>Befehl</th><th>Netzwerk</th></tr>
  <tr><td>Optionales Feature</td><td><code>Enable-WindowsOptionalFeature</code></td><td>nein – steckt im Abbild</td></tr>
  <tr><td>Feature on Demand</td><td><code>Add-WindowsCapability</code></td><td>ja – kommt von Windows Update</td></tr>
</table>

<h3>Einstellungen</h3>
<dl>
  <dt>Ausführungsphase</dt>
  <dd><b>Phase 2</b>: DISM läuft dann ohne Zeitdruck, und Features on Demand haben Netzwerk. In Phase 1 wartet
  Windows Setup auf jeden Aufruf.</dd>
  <dt>Zeitgrenze je Komponente</dt><dd>Ein hängender DISM-Aufruf wird danach abgebrochen.</dd>
</dl>

<h3>Kennzeichnungen an den Kacheln</h3>
<ul>
  <li><b>nur Pro/Enterprise</b> – auf Home übersprungen.</li>
  <li><b>VT im BIOS</b> – braucht eingeschaltete Virtualisierung. Fehlt sie, wird die Komponente
  <b>übersprungen</b>, weil sonst der Neustart hängen bliebe. Erkannt werden echte Hardware, eine VM mit
  verschachtelter Virtualisierung und ein schon laufender Windows-Hypervisor; die Rohwerte stehen im Protokoll.</li>
  <li><b>Netzwerk</b> – Feature on Demand; ohne Verbindung übersprungen.</li>
  <li><b>Quelle nötig</b> – .NET 3.5 liegt nicht im Abbild; das Modul sucht <code>sources\\sxs</code> auf allen
  Laufwerken und nutzt sonst Windows Update.</li>
  <li><b>Neustart nötig</b> – erst nach einem Neustart nutzbar. Unter <a data-help="settings">Einstellungen →
  Abschluss</a> „Neustart“ wählen.</li>
</ul>
<p>Für eine VM mit verschachtelter Virtualisierung auf einem Hyper-V-Host:
<code>Set-VMProcessor -VMName &lt;Name&gt; -ExposeVirtualizationExtensions $true</code> (bei ausgeschalteter VM).</p>`
    },

    drivers: {
      title: 'Treiber',
      html: `
<p>Liefert entpackte Treiber (<code>.inf</code>, <code>.sys</code>, <code>.cat</code> …) mit und spielt sie ein. Jedes
Paket ist ein eigener Ordner. Treiber-Installer als <code>.exe</code> gehören stattdessen unter
<a data-help="files">Eigene Dateien</a>.</p>

<h3>Pakete hinzufügen</h3>
<ul>
  <li><b>Treiberordner hinzufügen</b> – einen Ordner wählen; sein Name wird der Paketname, Unterordner bleiben erhalten.</li>
  <li><b>Einzelne Dateien</b> – werden zu einem Paket zusammengefasst, benannt nach der ersten INF-Datei.</li>
  <li><b>Leeres Paket</b> – nur der Ordner mit einer Hinweisdatei; die Treiber kopiert man nach dem Entpacken selbst
  hinein. Ideal für große Treibersammlungen, die man nicht durch den Browser schieben will.</li>
</ul>
<p>Herstellerpakete sind oft <code>.exe</code>- oder <code>.zip</code>-Archive. Entpacken lassen sie sich meist mit
7-Zip oder einem Schalter wie <code>/extract</code>; viele Hersteller bieten zusätzlich „SCCM-“ oder
„Driver-Pack“-Archive an, die schon INF-Dateien enthalten.</p>

<h3>Ziel</h3>
<table>
  <tr><th>Ziel</th><th>Ablage</th><th>Wann</th><th>Für</th></tr>
  <tr><td><b>pnputil</b></td><td><code>Install\\Drivers\\&lt;Paket&gt;</code></td><td>in der gewählten Phase</td>
      <td>Chipsatz, Grafik, Audio, WLAN, Kartenleser …</td></tr>
  <tr><td><b>Windows Setup</b></td><td><code>$WinPEDriver$\\&lt;Paket&gt;</code> im Wurzelverzeichnis des Mediums</td>
      <td>Setup lädt sie selbst, schon vor der Installation</td>
      <td>Treiber, ohne die Setup die Festplatte oder das Netz nicht sieht: NVMe, RAID/VMD, Netzwerk</td></tr>
</table>
<p>Erscheint im Setup keine Festplatte, fehlt fast immer der Speicher-Treiber (bei Intel häufig „RST/VMD“) – genau
der gehört nach <code>$WinPEDriver$</code>.</p>

<h3>Modellfilter</h3>
<p>Beschränkt ein pnputil-Paket auf bestimmte Geräte, damit ein Medium mehrere Modelle bedient. Mehrere Muster mit
<code>;</code> trennen; <code>*</code> und <code>?</code> sind erlaubt, ein Muster ohne Platzhalter gilt als Teilstring.
Verglichen wird mit Modell, Hersteller + Modell, SKU und dem Produktnamen. Bei Lenovo steht im Feld <i>Model</i> nur
der Maschinentyp (z. B. <code>21AH…</code>); der lesbare Name kommt aus dem Produktnamen. Anzeigen auf dem Zielgerät:</p>
<pre>Get-CimInstance Win32_ComputerSystem | Select Manufacturer, Model, SystemSKUNumber
(Get-CimInstance Win32_ComputerSystemProduct).Version</pre>
<p>Leer = alle Geräte. Die erkannten Werte stehen im Protokoll in der Zeile <code>Geraet: …</code>.</p>

<h3>Ablauf und Ergebnis</h3>
<p><code>Install-Drivers.ps1</code> läuft als erstes Modul und ruft je Paket
<code>pnputil /add-driver &lt;Paket&gt;\\*.inf /subdirs /install</code> auf, mit eigener Zeitgrenze.</p>
<table>
  <tr><th>Exitcode</th><th>Bedeutung</th></tr>
  <tr><td><code>0</code></td><td>eingespielt</td></tr>
  <tr><td><code>3010</code></td><td>eingespielt, Neustart nötig – wird vermerkt</td></tr>
  <tr><td><code>259</code></td><td>im Treiberspeicher, aber kein Gerät hat ihn übernommen (kein passendes Gerät oder schon ein besserer Treiber)</td></tr>
  <tr><td>andere</td><td>Fehler – erscheint in der Zusammenfassung</td></tr>
</table>

<h3>Gut zu wissen</h3>
<ul>
  <li>Treiberdateien stehen nur im ZIP, nicht in der Projektdatei. Nach dem Laden sind die Pakete wieder da, aber leer;
  angezeigt wird der Ordner, aus dem sie zuletzt kamen. Automatisch einbinden wie bei
  <a data-help="files">Eigenen Dateien</a> geht hier nicht: Liest eine Webseite einen gemerkten Ordner, lässt Chrome
  alle „gefährlichen“ Dateitypen weg – also gerade die DLLs. Den Ordner deshalb neu wählen.</li>
  <li>Mit der ZIP-Wurzel „beide Orte“ liegen pnputil-Pakete doppelt im Archiv.</li>
  <li><b>Große Pakete</b> (Grafiktreiber haben entpackt oft 1–2 GB) sind kein Problem: Über 4 GB schreibt der Generator
  ZIP64, und große Dateien werden direkt von der Platte übernommen statt im Arbeitsspeicher gesammelt. Bequemer ist
  bei solchen Mengen <b>In Ordner exportieren</b> (Chrome, Edge) – das schreibt direkt auf den Stick, das Entpacken
  entfällt; DLLs heißen dort bis zur Installation <code>*.dll.oemrename</code> (siehe Übersicht). Für Pakete unter
  <code>$WinPEDriver$</code> das ZIP nehmen. Alternativ das Paket als <b>Leeres Paket</b> anlegen und den Inhalt selbst kopieren.</li>
  <li>Damit Windows Update die Treiber nicht wieder ersetzt: Tweak „Keine Treiber über Windows Update“.</li>
</ul>`
    },

    files: {
      title: 'Eigene Dateien & Installer',
      html: `
<p>Nimmt beliebige Dateien in das Paket auf: Installer (<code>.exe</code>, <code>.msi</code>), Skripte, Konfigurationen,
Lizenzdateien. Auf Wunsch werden Installer mit Silent-Parametern ausgeführt.</p>

<h3>Spalten</h3>
<dl>
  <dt>Zielordner</dt>
  <dd><b>Install\\Files</b> – landet unter dem Installationsordner und wird vom Modul „Eigene Installer“ ausgeführt.
  <b>Setup\\Scripts</b> – liegt neben <code>SetupComplete.cmd</code> und ist dort über <code>%~dp0</code> erreichbar;
  wird nicht automatisch ausgeführt, sondern aus <a data-help="custom">eigenen CMD-Zeilen</a> aufgerufen.
  <b>Install\\Office</b> – für die <code>setup.exe</code> des Office Deployment Tools; das
  <a data-help="office">Office-Modul</a> startet sie selbst. Eine <code>setup.exe</code> landet automatisch dort, wenn das
  Office-Modul mit „liegt im OEM-Ordner (mitliefern)“ aktiv ist.</dd>
  <dt>Zielpfad (relativ)</dt><dd>Dateiname bzw. Unterordner innerhalb des Zielordners.</dd>
  <dt>Ausführen mit</dt>
  <dd>Parameter für die unbeaufsichtigte Installation. <b>Leer = nur kopieren.</b> <code>.msi</code> wird über
  <code>msiexec /i</code> gestartet (Vorgabe <code>/qn /norestart</code>). Übliche Schalter für <code>.exe</code>:
  <code>/S</code> (NSIS), <code>/VERYSILENT /NORESTART</code> (Inno Setup), <code>/quiet /norestart</code>
  (WiX/Burn), <code>/s /v"/qn"</code> (InstallShield). Im Zweifel hilft <code>setup.exe /?</code>.</dd>
  <dt>Phase</dt><dd>Phase 1 (SYSTEM, vor der Anmeldung) oder Phase 2 (nach der ersten Anmeldung).</dd>
</dl>
<p>Als Erfolg gelten die Exitcodes <code>0</code>, <code>3010</code> und <code>1641</code>.</p>

<h3>Gut zu wissen</h3>
<ul>
  <li>Binärdateien werden nur ins ZIP gepackt, nicht in die Projektdatei. Nach dem Laden eines Projekts bleiben die
  Einträge als Platzhalter stehen; die <code>LIESMICH.txt</code> nennt, was von Hand nachzulegen ist.</li>
  <li><b>Quellen merken (Chrome, Edge):</b> Der Browser merkt sich, aus welcher Datei ein Eintrag stammt. Beim Laden
  des Projekts werden diese Quellen geprüft und direkt wieder eingebunden. Braucht Chrome dafür
  erneut deine Freigabe, erscheint oben die Leiste <b>Quellen einbinden</b>; ein Klick genügt. Wählst du in der
  Abfrage „Bei jedem Besuch zulassen“, entfällt auch das. Das gilt nur im selben Browser und Profil; auf einem anderen
  PC bleibt es bei Platzhaltern. Eine gelöschte Quelle wird als „nicht mehr vorhanden“ markiert.</li>
  <li>Entpackte Treiber (INF) gehören ins <a data-help="drivers">Treiber</a>-Modul.</li>
</ul>`
    },

    custom: {
      title: 'Eigene Befehle',
      html: `
<p>Freie Befehle, die unverändert übernommen werden – etwa aus einer importierten <code>SetupComplete.cmd</code>.
Sie laufen <b>nach</b> den Modulen.</p>

<h3>CMD-Zeilen</h3>
<p>Werden in <code>SetupComplete.cmd</code> nach dem Aufruf von <code>Install.ps1</code> eingefügt und laufen als
SYSTEM mit <code>%WINDIR%\\Setup\\Scripts</code> als Arbeitsverzeichnis. Dateien daneben erreicht man über
<code>%~dp0</code> – sie müssen unter <a data-help="files">Eigene Dateien</a> mit Zielordner
<b>Setup\\Scripts</b> hinzugefügt werden. Der Hinweis unter dem Feld warnt, wenn eine Zeile auf eine Datei verweist,
die nicht im Paket liegt.</p>
<p>Wichtig: Diese Zeilen laufen nur, wenn <code>SetupComplete.cmd</code> überhaupt ausgeführt wird – siehe
<a data-help="settings">Einstellungen → Auslöser</a>. Ein <code>exit</code> oder <code>goto :eof</code> in den
eigenen Zeilen beendet das Skript vorzeitig.</p>

<h3>PowerShell-Zeilen</h3>
<p>Werden zu einem eigenen Modul <code>Invoke-Custom.ps1</code> in der gewählten Phase. Dort stehen die Hilfsfunktionen
des Generators zur Verfügung, etwa <code>Write-Log 'Text'</code> für das Protokoll; <code>$Global:OemRoot</code> zeigt
auf den Installationsordner. Ein Fehler (<code>throw</code>) erscheint in der Zusammenfassung als FEHLER, ohne die
übrigen Module aufzuhalten.</p>

<h3>Beispiele</h3>
<pre>REM CMD: Datei aus Setup\\Scripts kopieren
copy /y "%~dp0hintergrund.jpg" "%WINDIR%\\Web\\Wallpaper\\Firma.jpg"

# PowerShell: Energiesparplan Höchstleistung
powercfg /setactive SCHEME_MIN
Write-Log 'Energiesparplan gesetzt'</pre>`
    },

    settings: {
      title: 'Einstellungen',
      html: `
<h3>Pfade</h3>
<dl>
  <dt>Installationsordner auf dem Zielsystem</dt>
  <dd>Wohin <code>$OEM$\\$1</code> kopiert wird, Standard <code>C:\\Install</code>. Dort liegen Skripte, Module,
  Installer und die Protokolle unter <code>Logs</code>.</dd>
  <dt>Ablage von <code>$OEM$</code> auf dem Medium</dt>
  <dd>Die häufigste Ursache dafür, dass gar nichts passiert.
    <table>
      <tr><th>Antwortdatei</th><th>Ort</th></tr>
      <tr><td><code>UseConfigurationSet=true</code> (setzt der Generator)</td><td><code>&lt;Medium&gt;\\$OEM$</code> (Wurzelverzeichnis)</td></tr>
      <tr><td>keine Antwortdatei</td><td><code>&lt;Medium&gt;\\sources\\$OEM$</code></td></tr>
      <tr><td>Antwortdatei mit <code>UseConfigurationSet=false</code></td><td>auf aktuellen Windows-11-Builds unter Umständen <b>gar nicht</b> kopiert</td></tr>
    </table>
    <b>beide Orte</b> bestückt beides; Setup nutzt den passenden und ignoriert den anderen.</dd>
</dl>

<h3>Auslöser</h3>
<p>Windows Setup führt <code>SetupComplete.cmd</code> <b>nicht</b> aus, wenn ein Produktschlüssel aus dem OEM-Kanal
verwendet wird – etwa der im BIOS/UEFI hinterlegte Schlüssel eines Markengeräts (Home und Pro). Die
<code>autounattend.xml</code> ist davon unabhängig: Phase 1 läuft im <code>specialize</code>-Pass, Phase 2 über
<code>FirstLogonCommands</code>. Deshalb ist <b>beides</b> voreingestellt; doppelte Läufe werden erkannt.</p>
<p><b><code>UseConfigurationSet=true</code> schreiben</b> – ohne diesen Wert hat Windows Setup (Windows 11, Build 26300)
<code>$OEM$</code> im Test gar nicht kopiert: kein Installationsordner, keine Phase 2. Der Generator setzt ihn deshalb in der
erzeugten und in einer importierten Antwortdatei. Setup kopiert dann den Ordner der Antwortdatei nach
<code>C:\\Windows\\ConfigSetRoot</code> – auf einem normalen Medium unkritisch, auf Multiboot-Sticks wie Ventoy kann das
sehr groß werden.</p>
<p><b>Vorhandene autounattend.xml importieren</b> – etwa aus dem Generator von schneegans.de. Sie wird
<b>ergänzt statt ersetzt</b>: die Aufrufe kommen mit fortlaufender <code>&lt;Order&gt;</code> in die vorhandenen
Blöcke, frühere Einträge des Generators werden ersetzt. Die Übersicht darunter zeigt Passes, Befehle,
<code>UseConfigurationSet</code> und einen eingetragenen Produktschlüssel.</p>

<h3>Ablauf</h3>
<dl>
  <dt>Phase 2 wird gestartet über</dt>
  <dd><b>Geplante Aufgabe als SYSTEM</b> – zuverlässig, unabhängig davon, wer sich anmeldet. Startet die
  autounattend.xml Phase 2 bereits, läuft die Aufgabe 15 Minuten verzögert nur als Rückfall.
  <b>RunOnce</b> – im Kontext des ersten Benutzers; nötig für Paketmanager, die nur je Benutzer funktionieren (Scoop).</dd>
  <dt>Abschluss von Phase 2</dt>
  <dd>nichts tun, <b>Neustart</b> (30 Sekunden Vorlauf) oder Herunterfahren. Neustart empfiehlt sich, wenn Treiber
  oder Windows-Komponenten einen Neustart brauchen.</dd>
  <dt>PowerShell-Transcript mitschreiben</dt><dd>Komplette Konsolenausgabe je Phase unter <code>Logs</code> – sehr hilfreich bei Fehlern.</dd>
  <dt><code>%WINDIR%\\Setup\\Scripts</code> nach Abschluss löschen</dt><dd>Räumt auf, erschwert aber die Fehlersuche.</dd>
  <dt>Installationsordner nach Abschluss löschen</dt><dd>Entfernt Skripte, Installer und <code>Diagnose.ps1</code>; der Ordner <code>Logs</code> bleibt erhalten.</dd>
  <dt>Abschlussmeldung anzeigen</dt><dd>Zeigt am Ende ein Meldungsfenster mit dem Pfad der Protokolle. Sichtbar nur, wenn Phase 2 im Benutzerkontext läuft (RunOnce oder FirstLogonCommands) – als SYSTEM kann Windows kein Fenster auf den Desktop bringen.</dd>
</dl>

<h3>Fehlersuche auf dem Zielrechner</h3>
<pre>powershell -ExecutionPolicy Bypass -File C:\\Install\\Diagnose.ps1
powershell -ExecutionPolicy Bypass -File C:\\Install\\Diagnose.ps1 -Export</pre>
<p><code>Diagnose.ps1</code> prüft Dateien, Ausführungsmarker, geplante Aufgabe und die Setup-Protokolle und meldet
ausdrücklich, wenn Setup <code>SetupComplete.cmd</code> wegen des OEM-Kanals verweigert hat oder <code>$OEM$</code> am
falschen Ort lag. <code>-Export</code> packt alles Relevante in ein kleines ZIP. Wichtig: <code>$OEM$</code> und
autounattend.xml wirken nur, wenn vom Medium <b>gebootet</b> wird – nicht beim Start von <code>setup.exe</code> aus
einem laufenden Windows.</p>

<h3>Projekt zurücksetzen</h3>
<p>Setzt alle Einstellungen auf den Auslieferungszustand. Vorher am besten <b>Projekt speichern</b>.</p>`
    },

    preview: {
      title: 'Vorschau',
      html: `
<p>Zeigt jede Datei, die ins ZIP kommt – genau so, wie sie erzeugt wird. Links die Dateiliste, rechts der Inhalt.</p>
<ul>
  <li><b>Kopieren</b> legt den Inhalt der gewählten Datei in die Zwischenablage, <b>Einzeln laden</b> speichert nur
  diese Datei – praktisch, um ein geändertes Modul auf einen Testrechner zu bringen.</li>
  <li>Binärdateien werden mit ihrer Größe angezeigt; Treiberpakete als eine Zeile je Paket mit der Liste der Dateien.</li>
  <li>Bei der Ablage „beide Orte“ erscheint jede Datei unter <code>sources/$OEM$</code> und <code>$OEM$</code>.</li>
</ul>

<h3>Ohne Neuinstallation testen</h3>
<p>Auf einem Testrechner das ZIP entpacken und <code>$OEM$\\$1\\Install</code> nach <code>C:\\Install</code> kopieren,
dann in einer administrativen PowerShell:</p>
<pre>powershell -ExecutionPolicy Bypass -File C:\\Install\\Install.ps1 -Phase Manual
powershell -ExecutionPolicy Bypass -File C:\\Install\\Install.ps1 -Phase Manual -Only Install-Drivers.ps1
powershell -ExecutionPolicy Bypass -File C:\\Install\\Install.ps1 -Phase Setup -Force</pre>
<p><code>-Only</code> startet einzelne Module, <code>-Force</code> wiederholt eine bereits abgeschlossene Phase.</p>`
    }
  };

  const EN = {
    overview: {
      title: 'Overview – how the generator works',
      html: `
<p>The generator builds a ZIP with a ready-made <code>$OEM$</code> folder structure and an
<code>autounattend.xml</code>. Copied onto a Windows 11 installation medium, it sets up every machine installed from it
automatically: drivers, settings, bloatware, Windows components, Office and applications.</p>

<h3>Five steps to the medium</h3>
<ol>
  <li><b>Import</b> – read an existing <code>SetupComplete.cmd</code>, a UniGetUI bundle, an Office
    <code>Configuration.xml</code> or an existing <code>autounattend.xml</code> (<a data-help="import">Import</a>).</li>
  <li><b>Configure the modules</b> – every page in the left bar is a module with its own "Module active" switch.
    The number next to the entry shows how many items are selected.</li>
  <li><b>Set the sequence</b> – trigger, location of <code>$OEM$</code> and what happens at the end
    (<a data-help="settings">Settings</a>).</li>
  <li><b>Check</b> – look at every generated file in the <a data-help="preview">Preview</a>.</li>
  <li><b>Create ZIP</b> and copy its contents into the <b>root</b> of the medium – or, in Chrome and Edge, use
    <b>Export to folder</b> and pick the root of the USB stick straight away. The <code>README.txt</code> lists what
    still has to be added by hand.</li>
</ol>

<h3>ZIP or folder?</h3>
<p><b>Create ZIP</b> works in every browser. From 4 GB or 65535 files on the generator writes ZIP64 automatically –
Windows Explorer unpacks that from Windows 10 on, as does 7-Zip; very old tools may not know it. Installers and drivers
over 128 MB go into the ZIP uncompressed (they are usually compressed already), but without weighing on memory.
<b>Export to folder</b> (Chrome, Edge) writes the files straight into a folder and saves the unpacking. If the target already holds <code>$OEM$</code>, <code>sources\$OEM$</code> or
<code>$WinPEDriver$</code>, exactly these folders are emptied after a confirmation so no old files (such as removed
drivers) get installed; everything else, such as <code>sources\install.wim</code>, stays untouched. An existing
<code>autounattend.xml</code> that was not imported would be replaced – the confirmation points that out too.</p>
<p>Certain file types – above all <code>.dll</code>, plus <code>.ini</code>, <code>.cfg</code>, <code>.manifest</code>
and shortcuts – Chrome does not write to folders under their own name for security reasons. The export stores them with
the extra extension <code>.oemrename</code> and lists them in <code>Umbenennen.txt</code> next to <code>Install.ps1</code>;
<code>Install.ps1</code> gives them their names back during installation, before any module. That is not possible for
drivers under <code>$WinPEDriver$</code> because no script runs there – deliver such packages as ZIP.</p>

<h3>The two-phase model</h3>
<table>
  <tr><th>Phase</th><th>When</th><th>Context</th><th>Suited for</th></tr>
  <tr><td>Phase 1</td><td>at the end of Windows Setup, before the first sign-in</td><td>SYSTEM, often without network yet</td>
      <td>drivers, registry tweaks, bloatware</td></tr>
  <tr><td>Phase 2</td><td>at the first sign-in</td><td>SYSTEM (scheduled task) or the first user</td>
      <td>anything that needs a network: applications, Office, features on demand</td></tr>
</table>
<p>Every module has its own phase setting; the default is always the safe choice. <code>Install.ps1</code> records
completed phases under <code>HKLM\\SOFTWARE\\OEM-Setup</code> – if a second trigger starts the same phase, it is
skipped.</p>

<h3>What the overview shows</h3>
<ul>
  <li><b>Cards</b> – active modules with content are outlined in green, the phase below.</li>
  <li><b>Run sequence</b> – the actual order on the target machine. <code>Setup</code> = Windows Setup itself,
    <code>P1</code>/<code>P2</code> = phase 1/2.</li>
  <li><b>Target layout</b> – the content of the ZIP as a tree. Driver packages appear as one line per package.</li>
</ul>

<h3>Saving the project</h3>
<p><b>Save project</b> writes an <code>.oemproj.json</code> with every setting; each ZIP contains it as well. In Chrome
and Edge a "Save as" dialog opens for it – just like for <b>Create ZIP</b>. It opens in the folder chosen last – even after
reloading the page –, and so does <b>Load project</b>;
Firefox and Safari download the file to the downloads folder as usual (the browser setting "Always ask where to save
files" helps there). Binary
files (installers, drivers) are not part of it and have to be added again after loading – the entries stay as
placeholders.</p>

<p class="muted">Tip: <kbd>F1</kbd> opens the help for the current page.</p>`
    },

    import: {
      title: 'Import',
      html: `
<p>Read existing scripts and lists here so you do not start from scratch. Drop files onto the area or pick them –
several at once, and dropping anywhere on the page works too.</p>

<h3>What is recognised</h3>
<table>
  <tr><th>File</th><th>What happens</th></tr>
  <tr><td><code>.ubundle</code>, winget export (<code>.json</code>), XML/YAML bundle</td>
      <td>Packages go to <a data-help="apps">Applications</a>, including the manager (winget, Chocolatey, Scoop, npm, pip,
      Cargo, .NET tool) and version. Duplicates are merged.</td></tr>
  <tr><td><code>SetupComplete.cmd</code> / <code>.bat</code></td>
      <td>Analysed: <code>winget install</code> lines become packages, an Office call is detected, every other line goes
      unchanged to <a data-help="custom">Own commands</a>.</td></tr>
  <tr><td>ODT <code>Configuration.xml</code></td><td>Taken over by the <a data-help="office">Office</a> module, which is switched on.</td></tr>
  <tr><td><code>autounattend.xml</code></td>
      <td>Is <b>extended rather than replaced</b> (see <a data-help="settings">Settings → Trigger</a>). With
      <code>UseConfigurationSet=true</code> the generator sets the location to "both places".</td></tr>
  <tr><td><code>.ps1</code></td><td>Shipped as a file; the call is added under Own commands → PowerShell.</td></tr>
  <tr><td><code>.exe</code>, <code>.msi</code> and other binaries</td><td>Go to <a data-help="files">Own files</a>.</td></tr>
  <tr><td><code>.oemproj.json</code></td><td>Loads a saved project completely.</td></tr>
</table>

<h3>UniGetUI bundle</h3>
<p>In UniGetUI: <i>Package bundles → Export bundle</i>. With <b>replace existing list</b> the application list is
cleared first, otherwise new packages are appended. <i>Paste bundle content</i> takes the content from the clipboard.</p>

<h3>Import log</h3>
<p>Every import writes a line: what was taken over, what was not recognised, and warnings – for example when a
<code>SetupComplete.cmd</code> contains an Office installation whose <code>Configuration.xml</code> is still missing.</p>`
    },

    apps: {
      title: 'Applications',
      html: `
<p>Installs programs through package managers – mainly <b>winget</b>, plus Chocolatey, Scoop, npm, pip, Cargo,
.NET tool and the PowerShell Gallery. Chocolatey is installed on demand.</p>

<h3>Settings</h3>
<dl>
  <dt>Execution phase</dt>
  <dd><b>Phase 2</b> is recommended. winget is an MSIX package whose command alias only exists per user; as SYSTEM
  many packages fail, and phase 1 often has no network yet. The note below the options warns when the chosen
  combination would run winget in the SYSTEM context.</dd>
  <dt>Installation method</dt>
  <dd><b>One command per package</b> – each package with its own call, retries, time limit and error message.
  <b>winget import</b> – one <code>packages.json</code> in one go; faster, but an error is harder to pin to a package.
  Non-winget packages always run one by one.</dd>
  <dt>Retries / time limit per package</dt>
  <dd>A package that fails or hangs is cancelled after the limit and tried again. A single hanging package never holds
  up the whole run.</dd>
  <dt>Wait for a network connection</dt><dd>Waits until the internet is reachable before the first package.</dd>
  <dt><code>winget source update</code> first</dt><dd>Refreshes the package source – freshly installed systems often have a stale index.</dd>
  <dt>Install winget/App Installer if needed</dt><dd>If winget is missing, the App Installer is downloaded and registered.</dd>
  <dt>Enforce exact versions</dt><dd>Installs the version listed in the bundle instead of the latest one.</dd>
  <dt>Prefer <code>--scope machine</code></dt><dd>Installs for all users where the package offers it.</dd>
</dl>

<h3>The package list</h3>
<ul>
  <li>Checkbox on the left: the package is installed or skipped. <b>All</b>/<b>None</b> set every checkbox.</li>
  <li>Name, package ID, version and extra arguments can be edited right in the table; the manager by selection.</li>
  <li><b>Click a column header</b> to sort ascending, descending and off again. Only the display is sorted – the
  installation follows the order of the list.</li>
  <li>The filter field searches name, ID and manager.</li>
</ul>

<h3>Success and failure</h3>
<p>Success means <code>0</code>, the restart codes <code>3010</code>/<code>1641</code>, "already installed" and "no
applicable upgrade". "No package found" explicitly counts as a failure – otherwise a mistyped ID would count as
installed. Failed packages are listed in the log and in <code>apps-fehlgeschlagen.txt</code>.</p>`
    },

    office: {
      title: 'Microsoft Office (ODT)',
      html: `
<p>Installs Microsoft 365 Apps, Project, Visio and other Click-to-Run products through the <b>Office Deployment
Tool</b> (ODT, <code>setup.exe</code>) and a <code>Configuration.xml</code>.</p>

<h3>Settings</h3>
<dl>
  <dt>Execution phase</dt>
  <dd><b>Phase 2</b>, because the ODT downloads the installation files and phase 1 usually has no network yet. Phase 1
  only makes sense with a local source.</dd>
  <dt>ODT setup (setup.exe)</dt>
  <dd><b>ship it</b> – put <code>setup.exe</code> into the folder shown by hand; the generator leaves a note there.
  <b>download at run time</b> – fetched from the download URL.</dd>
  <dt>Installation source</dt>
  <dd><b>online</b> – Office comes straight from Microsoft. <b>local</b> – the generator writes <code>SourcePath</code>
  into the Configuration.xml and adds <code>Download-Quelle.ps1</code>. Run this script once on the staging machine; it
  downloads exactly the configured products and languages into the source folder (several gigabytes). Without a filled
  folder the installation falls back to online.</dd>
  <dt>Skip if Office is already installed</dt>
  <dd>Checks the Click-to-Run registry entry first.</dd>
</dl>

<h3>Configuration.xml</h3>
<p>Import it, insert the template or edit it directly. <b>Detected configuration</b> on the right shows products,
languages, channel and architecture and warns when the file would not run unattended – for instance without
<code>&lt;Display Level="None"/&gt;</code>. Your own configurations are easy to put together at
<code>config.office.com</code>.</p>

<h3>Checking success</h3>
<p>The exit code of the ODT alone does not decide: after the installation the module checks whether Office is really
present. If it is missing, the summary reports an error.</p>`
    },

    tweaks: {
      title: 'System tweaks',
      html: `
<p>About 35 settings for Explorer, taskbar, privacy, system and network – switched on and off with a click. Each card
shows category, description and particulars.</p>

<h3>Settings</h3>
<dl>
  <dt>Execution phase</dt>
  <dd><b>Phase 1</b> is the default: the values then apply from the very first sign-in.</dd>
  <dt>Apply user settings to the default profile &amp; existing profiles too</dt>
  <dd>In phase 1 there is no user profile yet. User-related values are therefore written to
  <code>C:\\Users\\Default\\NTUSER.DAT</code> and apply to every newly created account; existing profiles are adjusted
  as well.</dd>
</dl>

<h3>Why some tweaks are deferred to phase 2</h3>
<p>Some settings need a running network or service stack (firewall rules, network profile, optional features) or an
existing user account. Such cmdlets can wait forever in phase 1 – and Windows Setup waits with them. The generator
therefore moves these parts into a second module <code>Set-Tweaks-Spaet.ps1</code> that runs in phase 2; the note above
names the tweaks concerned. Each of these calls has its own time limit.</p>

<h3>Tips</h3>
<ul>
  <li>The filter field searches name, category and description.</li>
  <li>"No drivers through Windows Update" goes well with the <a data-help="drivers">Drivers</a> module when only
  tested drivers should reach the devices.</li>
</ul>`
    },

    bloat: {
      title: 'Remove bloatware',
      html: `
<p>Removes pre-installed Store apps (AppX packages) such as games, news or advertising apps.</p>

<h3>Settings</h3>
<dl>
  <dt>Execution phase</dt><dd><b>Phase 1</b> – the first user then never sees the apps.</dd>
  <dt>Remove from provisioning too</dt>
  <dd>Also removes the package from the image so it is not reinstalled for <b>new</b> users. Without this option it only
  disappears for existing accounts.</dd>
</dl>

<h3>Selection</h3>
<ul>
  <li><b>Select recommended</b> marks apps that can be removed safely.</li>
  <li><b>Custom package</b> takes any package name, for example <code>Microsoft.BingWeather</code>. The names are shown
  by <code>Get-AppxPackage | Select Name</code> on a reference machine.</li>
</ul>

<h3>Careful</h3>
<p>Do not remove system packages such as the Store, App Installer or runtime libraries – without the
<b>App Installer</b> there is no winget, and the <a data-help="apps">Applications</a> module fails.</p>`
    },

    features: {
      title: 'Windows components',
      html: `
<p>Turns on optional Windows features and features on demand – Windows Sandbox, Hyper-V, WSL, .NET 3.5, OpenSSH, RSAT
and more. The <b>?</b> on every component opens the matching Microsoft documentation.</p>

<h3>Two kinds</h3>
<table>
  <tr><th>Kind</th><th>Command</th><th>Network</th></tr>
  <tr><td>Optional feature</td><td><code>Enable-WindowsOptionalFeature</code></td><td>no – part of the image</td></tr>
  <tr><td>Feature on demand</td><td><code>Add-WindowsCapability</code></td><td>yes – comes from Windows Update</td></tr>
</table>

<h3>Settings</h3>
<dl>
  <dt>Execution phase</dt>
  <dd><b>Phase 2</b>: DISM then runs without time pressure and features on demand have a network. In phase 1 Windows
  Setup waits for every call.</dd>
  <dt>Time limit per component</dt><dd>A hanging DISM call is cancelled afterwards.</dd>
</dl>

<h3>Labels on the cards</h3>
<ul>
  <li><b>Pro/Enterprise only</b> – skipped on Home.</li>
  <li><b>VT in the firmware</b> – needs virtualisation turned on. Without it the component is <b>skipped</b>, because the
  restart would hang otherwise. Real hardware, a VM with nested virtualisation and an already running Windows
  hypervisor are recognised; the raw values go to the log.</li>
  <li><b>Network</b> – feature on demand; skipped without a connection.</li>
  <li><b>Needs a source</b> – .NET 3.5 is not in the image; the module looks for <code>sources\\sxs</code> on every drive
  and uses Windows Update otherwise.</li>
  <li><b>Needs a restart</b> – usable only after a restart. Choose "Restart" under <a data-help="settings">Settings →
  Completion</a>.</li>
</ul>
<p>For a VM with nested virtualisation on a Hyper-V host:
<code>Set-VMProcessor -VMName &lt;name&gt; -ExposeVirtualizationExtensions $true</code> (with the VM turned off).</p>`
    },

    drivers: {
      title: 'Drivers',
      html: `
<p>Ships unpacked drivers (<code>.inf</code>, <code>.sys</code>, <code>.cat</code> …) and installs them. Every package is a
folder of its own. Driver installers as <code>.exe</code> belong under <a data-help="files">Own files</a> instead.</p>

<h3>Adding packages</h3>
<ul>
  <li><b>Add driver folder</b> – pick a folder; its name becomes the package name, subfolders are kept.</li>
  <li><b>Single files</b> – combined into one package named after the first INF file.</li>
  <li><b>Empty package</b> – only the folder with a note; copy the drivers into it yourself after unpacking. Ideal for
  large driver collections you would rather not push through the browser.</li>
</ul>
<p>Vendor packages are often <code>.exe</code> or <code>.zip</code> archives. They can usually be unpacked with 7-Zip or a
switch such as <code>/extract</code>; many vendors also offer "SCCM" or "driver pack" archives that already contain INF
files.</p>

<h3>Target</h3>
<table>
  <tr><th>Target</th><th>Location</th><th>When</th><th>For</th></tr>
  <tr><td><b>pnputil</b></td><td><code>Install\\Drivers\\&lt;package&gt;</code></td><td>in the selected phase</td>
      <td>chipset, graphics, audio, Wi-Fi, card reader …</td></tr>
  <tr><td><b>Windows Setup</b></td><td><code>$WinPEDriver$\\&lt;package&gt;</code> in the root of the medium</td>
      <td>Setup loads them itself, before the installation</td>
      <td>drivers without which Setup cannot see the disk or the network: NVMe, RAID/VMD, network</td></tr>
</table>
<p>If Setup shows no disk, the storage driver is almost always missing (with Intel often "RST/VMD") – exactly that one
belongs in <code>$WinPEDriver$</code>.</p>

<h3>Model filter</h3>
<p>Limits a pnputil package to certain devices so one medium serves several models. Separate several patterns with
<code>;</code>; <code>*</code> and <code>?</code> are allowed, a pattern without wildcards counts as a substring. It is compared
with the model, manufacturer + model, SKU and the product name. On Lenovo the <i>Model</i> field only holds the machine
type (e.g. <code>21AH…</code>); the readable name comes from the product name. To show them on the target device:</p>
<pre>Get-CimInstance Win32_ComputerSystem | Select Manufacturer, Model, SystemSKUNumber
(Get-CimInstance Win32_ComputerSystemProduct).Version</pre>
<p>Empty = every device. The detected values are in the log, line <code>Geraet: …</code>.</p>

<h3>Sequence and result</h3>
<p><code>Install-Drivers.ps1</code> runs as the first module and calls
<code>pnputil /add-driver &lt;package&gt;\\*.inf /subdirs /install</code> per package, with its own time limit.</p>
<table>
  <tr><th>Exit code</th><th>Meaning</th></tr>
  <tr><td><code>0</code></td><td>installed</td></tr>
  <tr><td><code>3010</code></td><td>installed, restart needed – recorded</td></tr>
  <tr><td><code>259</code></td><td>in the driver store, but no device took it (no matching device or a better driver already present)</td></tr>
  <tr><td>other</td><td>failure – shows up in the summary</td></tr>
</table>

<h3>Good to know</h3>
<ul>
  <li>Driver files are only in the ZIP, not in the project file. After loading, the packages are back but empty; the
  folder they last came from is shown. Attaching them automatically as with <a data-help="files">Own files</a> is not
  possible: when a web page reads a remembered folder, Chrome leaves out every "dangerous" file type – the DLLs, of
  all things. So choose the folder again.</li>
  <li>With the ZIP root "both places" pnputil packages are in the archive twice.</li>
  <li><b>Large packages</b> (graphics drivers are often 1–2 GB unpacked) are no problem: above 4 GB the generator writes
  ZIP64, and large files are taken straight from disk instead of being collected in memory. With such amounts
  <b>Export to folder</b> (Chrome, Edge) is more convenient – it writes straight to the stick, no unpacking needed; DLLs are
  named <code>*.dll.oemrename</code> there until installation (see overview). Use the ZIP for packages under
  <code>$WinPEDriver$</code>. Alternatively create the package as an <b>Empty package</b> and copy the content yourself.</li>
  <li>To keep Windows Update from replacing the drivers: tweak "No drivers through Windows Update".</li>
</ul>`
    },

    files: {
      title: 'Own files & installers',
      html: `
<p>Adds any files to the package: installers (<code>.exe</code>, <code>.msi</code>), scripts, configurations, licence files.
Installers can be run with silent parameters.</p>

<h3>Columns</h3>
<dl>
  <dt>Target folder</dt>
  <dd><b>Install\\Files</b> – goes below the installation folder and is run by the "own installers" module.
  <b>Setup\\Scripts</b> – sits next to <code>SetupComplete.cmd</code> and is reachable there via <code>%~dp0</code>; it is
  not run automatically but called from <a data-help="custom">own CMD lines</a>.
  <b>Install\\Office</b> – for <code>setup.exe</code> of the Office Deployment Tool; the
  <a data-help="office">Office module</a> starts it itself. A <code>setup.exe</code> goes there automatically when the
  Office module is active with "ships in the OEM folder".</dd>
  <dt>Target path (relative)</dt><dd>File name or subfolder inside the target folder.</dd>
  <dt>Run with</dt>
  <dd>Parameters for the unattended installation. <b>Empty = copy only.</b> <code>.msi</code> is started through
  <code>msiexec /i</code> (default <code>/qn /norestart</code>). Common switches for <code>.exe</code>: <code>/S</code> (NSIS),
  <code>/VERYSILENT /NORESTART</code> (Inno Setup), <code>/quiet /norestart</code> (WiX/Burn), <code>/s /v"/qn"</code>
  (InstallShield). When in doubt, <code>setup.exe /?</code> helps.</dd>
  <dt>Phase</dt><dd>Phase 1 (SYSTEM, before sign-in) or phase 2 (after the first sign-in).</dd>
</dl>
<p>Exit codes <code>0</code>, <code>3010</code> and <code>1641</code> count as success.</p>

<h3>Good to know</h3>
<ul>
  <li>Binary files only go into the ZIP, not into the project file. After loading a project the entries stay as
  placeholders; the <code>README.txt</code> names what has to be added by hand.</li>
  <li><b>Remembered sources (Chrome, Edge):</b> the browser remembers which file an entry came from. When the
  project is loaded, these sources are checked and attached again right away. If Chrome needs your permission
  again, the bar <b>Attach sources</b> appears at the top; one click is enough. Choosing "Allow on every visit" in the
  prompt removes that step too. This only works in the same browser and profile; on another PC the entries stay
  placeholders. A deleted source is marked as "no longer available".</li>
  <li>Unpacked drivers (INF) belong in the <a data-help="drivers">Drivers</a> module.</li>
</ul>`
    },

    custom: {
      title: 'Own commands',
      html: `
<p>Free commands taken over unchanged – for example from an imported <code>SetupComplete.cmd</code>. They run
<b>after</b> the modules.</p>

<h3>CMD lines</h3>
<p>Inserted into <code>SetupComplete.cmd</code> after the call to <code>Install.ps1</code>; they run as SYSTEM with
<code>%WINDIR%\\Setup\\Scripts</code> as the working folder. Files next to it are reachable via <code>%~dp0</code> – add
them under <a data-help="files">Own files</a> with target folder <b>Setup\\Scripts</b>. The note below the field warns
when a line refers to a file that is not in the package.</p>
<p>Important: these lines only run if <code>SetupComplete.cmd</code> runs at all – see
<a data-help="settings">Settings → Trigger</a>. An <code>exit</code> or <code>goto :eof</code> in your own lines ends the
script early.</p>

<h3>PowerShell lines</h3>
<p>Become a module of their own, <code>Invoke-Custom.ps1</code>, in the selected phase. The generator's helper functions
are available there, for example <code>Write-Log 'text'</code> for the log; <code>$Global:OemRoot</code> points to the
installation folder. An error (<code>throw</code>) shows up as FEHLER in the summary without stopping the other modules.</p>

<h3>Examples</h3>
<pre>REM CMD: copy a file from Setup\\Scripts
copy /y "%~dp0wallpaper.jpg" "%WINDIR%\\Web\\Wallpaper\\Company.jpg"

# PowerShell: high performance power plan
powercfg /setactive SCHEME_MIN
Write-Log 'Power plan set'</pre>`
    },

    settings: {
      title: 'Settings',
      html: `
<h3>Paths</h3>
<dl>
  <dt>Installation folder on the target system</dt>
  <dd>Where <code>$OEM$\\$1</code> is copied to, <code>C:\\Install</code> by default. Scripts, modules, installers and the
  logs (under <code>Logs</code>) live there.</dd>
  <dt>Location of <code>$OEM$</code> on the medium</dt>
  <dd>The most common reason nothing happens at all.
    <table>
      <tr><th>Answer file</th><th>Location</th></tr>
      <tr><td><code>UseConfigurationSet=true</code> (set by the generator)</td><td><code>&lt;medium&gt;\\$OEM$</code> (root)</td></tr>
      <tr><td>no answer file</td><td><code>&lt;medium&gt;\\sources\\$OEM$</code></td></tr>
      <tr><td>answer file with <code>UseConfigurationSet=false</code></td><td>on current Windows 11 builds possibly <b>not copied at all</b></td></tr>
    </table>
    <b>both places</b> fills both; Setup uses the right one and ignores the other.</dd>
</dl>

<h3>Trigger</h3>
<p>Windows Setup does <b>not</b> run <code>SetupComplete.cmd</code> when the installation uses a product key from the OEM
channel – such as the key stored in the BIOS/UEFI of a branded device (Home and Pro). The <code>autounattend.xml</code>
does not depend on that: phase 1 runs in the <code>specialize</code> pass, phase 2 through
<code>FirstLogonCommands</code>. That is why <b>both</b> is the default; duplicate runs are detected.</p>
<p><b>Write <code>UseConfigurationSet=true</code></b> – without this value Windows Setup (Windows 11, build 26300) did not
copy <code>$OEM$</code> at all in a test: no installation folder, no phase 2. The generator therefore sets it in the generated
and in an imported answer file. Setup then copies the folder of the answer file to <code>C:\\Windows\\ConfigSetRoot</code> –
harmless on a normal medium, but on multi-boot sticks such as Ventoy that can get very large.</p>
<p><b>Import existing autounattend.xml</b> – for instance from the schneegans.de generator. It is <b>extended rather than
replaced</b>: the calls go into the existing blocks with a continuing <code>&lt;Order&gt;</code>, earlier entries of the
generator are replaced. The summary below shows passes, commands, <code>UseConfigurationSet</code> and an entered
product key.</p>

<h3>Sequence</h3>
<dl>
  <dt>Phase 2 is started through</dt>
  <dd><b>Scheduled task as SYSTEM</b> – reliable, whoever signs in. If the autounattend.xml already starts phase 2, the
  task runs 15 minutes later as a fallback only. <b>RunOnce</b> – in the context of the first user; needed for package
  managers that only work per user (Scoop).</dd>
  <dt>Completion of phase 2</dt>
  <dd>do nothing, <b>restart</b> (30 seconds of notice) or shut down. Restart is recommended when drivers or Windows
  components need one.</dd>
  <dt>Record a PowerShell transcript</dt><dd>The complete console output per phase under <code>Logs</code> – very helpful with errors.</dd>
  <dt>Delete <code>%WINDIR%\\Setup\\Scripts</code> when done</dt><dd>Tidies up, but makes troubleshooting harder.</dd>
  <dt>Delete the installation folder when done</dt><dd>Removes scripts, installers and <code>Diagnose.ps1</code>; the <code>Logs</code> folder is kept.</dd>
  <dt>Show a completion message</dt><dd>Shows a message box with the log path at the end. Only visible when phase 2 runs in the user context (RunOnce or FirstLogonCommands) – as SYSTEM Windows cannot put a window on the desktop.</dd>
</dl>

<h3>Troubleshooting on the target machine</h3>
<pre>powershell -ExecutionPolicy Bypass -File C:\\Install\\Diagnose.ps1
powershell -ExecutionPolicy Bypass -File C:\\Install\\Diagnose.ps1 -Export</pre>
<p><code>Diagnose.ps1</code> checks files, run markers, the scheduled task and the setup logs, and says explicitly when Setup
refused <code>SetupComplete.cmd</code> because of the OEM channel or <code>$OEM$</code> was in the wrong place.
<code>-Export</code> packs everything relevant into a small ZIP. Important: <code>$OEM$</code> and the autounattend.xml only
take effect when the machine <b>boots</b> from the medium – not when <code>setup.exe</code> is started from a running
Windows.</p>

<h3>Reset project</h3>
<p>Puts every setting back to the factory state. Better <b>save the project</b> first.</p>`
    },

    preview: {
      title: 'Preview',
      html: `
<p>Shows every file that goes into the ZIP – exactly as it is generated. File list on the left, content on the right.</p>
<ul>
  <li><b>Copy</b> puts the content of the selected file on the clipboard, <b>Download single file</b> saves just that
  file – handy to bring a changed module to a test machine.</li>
  <li>Binary files are shown with their size; driver packages as one line per package with the list of files.</li>
  <li>With the location "both places" every file appears under <code>sources/$OEM$</code> and <code>$OEM$</code>.</li>
</ul>

<h3>Testing without reinstalling</h3>
<p>On a test machine, unpack the ZIP and copy <code>$OEM$\\$1\\Install</code> to <code>C:\\Install</code>, then in an
elevated PowerShell:</p>
<pre>powershell -ExecutionPolicy Bypass -File C:\\Install\\Install.ps1 -Phase Manual
powershell -ExecutionPolicy Bypass -File C:\\Install\\Install.ps1 -Phase Manual -Only Install-Drivers.ps1
powershell -ExecutionPolicy Bypass -File C:\\Install\\Install.ps1 -Phase Setup -Force</pre>
<p><code>-Only</code> starts single modules, <code>-Force</code> repeats a phase that has already completed.</p>`
    }
  };

  global.Help = {
    get(view, lang) {
      const dict = lang === 'en' ? EN : DE;
      return dict[view] || DE[view] || null;
    },
    topics: () => Object.keys(DE)
  };
})(window);
