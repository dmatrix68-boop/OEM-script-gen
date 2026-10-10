/*  Zweisprachige Oberfläche (Deutsch / Englisch).

    Die Vorlage in index.html trägt die deutschen Texte; Elemente mit
    data-i18n (Inhalt), data-i18n-ph (placeholder) und data-i18n-title (title)
    werden beim Sprachwechsel ersetzt. Dynamisch erzeugte Texte holen sich ihre
    Fassung über t('schlüssel'). Fehlt eine Übersetzung, bleibt der deutsche
    Text stehen - sichtbar, aber nie leer.  */
(function (global) {
  'use strict';

  const EN = {
    'th-name': 'Name',
    'th-paket-id': 'Package ID',
    'th-manager': 'Manager',
    'th-version': 'Version',
    'th-zusatzargumente': 'Extra arguments',
    'th-datei': 'File',
    'th-zielordner': 'Target folder',
    'th-zielpfad-relativ': 'Target path (relative)',
    'th-ausfuehren-mit': 'Run with',
    'th-phase': 'Phase',
    'dateien-hierher-ziehen-oder': '<b>Drag files here</b> or ',
    'hinweis-oem-sperre': 'Windows Setup does <b>not</b> run <code>SetupComplete.cmd</code> when the '
      + 'installation uses a product key from the OEM channel \u2013 for instance the key stored in the '
      + 'BIOS/UEFI of a branded device. This affects Home and Pro; Enterprise and Windows Server are '
      + 'exempt. <code>autounattend.xml</code> is unaffected and starts phase 1 in the '
      + '<code>specialize</code> pass and phase 2 via <code>FirstLogonCommands</code>.',
    /* Kopfzeile und Navigation */
    'oem-script-generator': 'OEM Script Generator',
    'installationsskripte-fuer-den-oem-ordner':
      'Installation scripts for the <code>$OEM$</code> folder on Windows 11 installation media',
    'projekt-laden': 'Load project',
    'projekt-speichern': 'Save project',
    'zip-erzeugen': 'Create ZIP',
    'projektname': 'Project name',
    'projektdatei-oemproj-json-laden': 'Load project file (.oemproj.json)',
    'projektdatei-speichern': 'Save project file',
    'komplette-oem-struktur-als-zip': 'Download the complete OEM structure as a ZIP',
    'nav-uebersicht': 'Overview',
    'nav-import': 'Import',
    'nav-anwendungen': 'Applications',
    'nav-office-odt': 'Office / ODT',
    'nav-tweaks': 'Tweaks',
    'nav-bloatware': 'Bloatware',
    'nav-eigene-dateien': 'Own files',
    'nav-eigene-befehle': 'Own commands',
    'nav-einstellungen': 'Settings',
    'nav-vorschau': 'Preview',
    'dateien-irgendwo-ablegen-zum-importieren':
      'Drop files anywhere to import<br><small>.ubundle · .cmd · .ps1 · .xml · .json</small>',

    /* Übersicht */
    'uebersicht-2': 'Overview',
    'dieser-generator-erzeugt-eine-fertige':
      'This generator produces a ready-made <code>$OEM$</code> folder structure that is copied to ' +
      '<code>sources\\$OEM$</code> on Windows 11 installation media. Windows Setup transfers its contents to the ' +
      'target disk automatically; <code>SetupComplete.cmd</code> then runs as <b>SYSTEM</b> at the end of setup and ' +
      'starts the installation chain.',
    'ablaufkette': 'Sequence',
    'zielstruktur-auf-dem-medium': 'Resulting structure on the medium',

    /* Import */
    'import-2': 'Import',
    'bestehende-skripte-und-paketlisten-einlesen':
      'Read in existing scripts and package lists. Recognised are UniGetUI bundles, winget exports, ' +
      '<code>SetupComplete.cmd</code>, ODT <code>Configuration.xml</code>, PowerShell scripts and saved projects.',
    'auswaehlen': 'select',
    'ubundle-json-cmd-bat-ps1': '.ubundle · .json · .cmd/.bat · .ps1 · autounattend.xml · .exe/.msi',
    'unigetui-bundle-importieren': 'Import a UniGetUI bundle',
    'in-unigetui-pakete-buendel-buendel':
      'In UniGetUI: <i>Package bundles → Export bundle</i>. Supported are JSON ' +
      '(<code>.ubundle</code>/<code>.json</code>), XML and YAML as well as winget <code>import</code> files.',
    'bundle-datei-waehlen': 'Choose bundle file',
    'vorhandene-liste-ersetzen': 'replace the existing list',
    'bundle-inhalt-einfuegen-copy-amp': 'Paste bundle contents (copy &amp; paste)',
    'einlesen': 'Read',
    'importprotokoll': 'Import log',
    'noch-nichts-importiert': 'Nothing imported yet.',
    'protokoll-leeren': 'Clear log',

    /* Anwendungen */
    'anwendungen': 'Applications',
    'modul-aktiv': 'Module active',
    'ausfuehrungsphase': 'Execution phase',
    'phase-2-nach-erster-anmeldung': 'Phase 2 – after first sign-in (recommended)',
    'phase-1-direkt-in-setupcomplete': 'Phase 1 – directly in SetupComplete (SYSTEM)',
    'installationsmethode': 'Installation method',
    'einzelbefehle-je-paket-robust-fehler': 'One command per package (robust, failures stay local)',
    'winget-import-packages-json': 'winget import (packages.json)',
    'wiederholversuche': 'Retries',
    'zeitlimit-je-paket-minuten': 'Time limit per package (minutes)',
    'auf-netzwerkverbindung-warten': 'Wait for a network connection',
    'winget-source-update': 'winget source update',
    'vorab': 'beforehand',
    'winget-app-installer-bei-bedarf': 'Install winget/App Installer if missing',
    'exakte-versionen-aus-dem-bundle': 'pin the exact versions from the bundle',
    'scope-machine': '--scope machine',
    'bevorzugen': 'preferred',
    'alle': 'All',
    'keine': 'None',
    'paket-hinzufuegen': 'Add package',
    'liste-leeren': 'Clear list',
    'filtern-name-id-manager': 'Filter (name, ID, manager)…',

    /* Office */
    'microsoft-office-odt': 'Microsoft Office (ODT)',
    'phase-1-setupcomplete-system': 'Phase 1 – SetupComplete (SYSTEM)',
    'phase-2-nach-erster-anmeldung-2': 'Phase 2 – after first sign-in',
    'odt-setup-setup-exe': 'ODT setup (setup.exe)',
    'liegt-im-oem-ordner-mitliefern': 'ships in the OEM folder',
    'zur-laufzeit-von-microsoft-laden': 'download from Microsoft at run time',
    'download-url-nur-bei-laden': 'Download URL (only when downloading)',
    'installationsquelle': 'Installation source',
    'online-von-microsoft-laden': 'download from Microsoft',
    'lokal-mitgelieferte-quelle-offline': 'locally supplied source (offline)',
    'ordner-der-quelle-unter-office': 'Source folder (below Office\\)',
    'ueberspringen-wenn-office-bereits-installiert': 'Skip if Office is already installed',
    'bei-mitliefern-muss-setup-exe-1':
      'When shipping it along, <code>setup.exe</code> (Office Deployment Tool) has to be placed at ',
    'bei-mitliefern-muss-setup-exe-2':
      ' – the generator leaves a placeholder note there.',
    'configuration-xml': 'Configuration.xml',
    'xml-importieren': 'Import XML',
    'vorlage-einfuegen': 'Insert template',
    'erkannte-konfiguration': 'Detected configuration',
    'keine-gueltige-configuration-xml': 'No valid Configuration.xml.',

    /* Tweaks und Bloatware */
    'system-tweaks': 'System tweaks',
    'benutzer-einstellungen-auch-auf-default':
      'Apply user settings to the default profile &amp; existing profiles as well',
    'in-phase-1-existiert-noch':
      'In phase 1 no user profile exists yet. User-scoped registry values are therefore written to ' +
      '<code>C:\\Users\\Default\\NTUSER.DAT</code> and apply to every newly created account.',
    'tweaks-filtern': 'Filter tweaks…',
    'auswahl-leeren': 'Clear selection',
    'bloatware-entfernen': 'Remove bloatware',
    'auch-aus-dem-provisioning-entfernen': 'Also remove from provisioning (applies to new users)',
    'appx-pakete-filtern': 'Filter AppX packages…',
    'empfehlung-waehlen': 'Choose recommended',
    'eigenes-paket': 'Own package',

    /* Eigene Dateien */
    'eigene-dateien-amp-installer': 'Own files &amp; installers',
    'beliebige-dateien-in-die-oem-1':
      'Include arbitrary files in the OEM structure: setup files (.exe/.msi) with silent switches, scripts, ' +
      'configurations, drivers. The default target folder is ',
    'dateien-hinzufuegen': 'Add files',
    'binaerdateien-werden-nur-im-zip':
      'Binary files are only shipped inside the ZIP, never stored in the project file.',

    /* Eigene Befehle */
    'eigene-befehle-2': 'Own commands',
    'freie-zeilen-die-unveraendert-uebernommen':
      'Free-form lines that are carried over unchanged – for example from an imported ' +
      '<code>SetupComplete.cmd</code>. They run after the modules.',
    'cmd-zeilen-in-setupcomplete-cmd': 'CMD lines (in SetupComplete.cmd)',
    'aktiv': 'active',
    'laufen-als-system-im-kontext': 'Run as SYSTEM from <code>%WINDIR%\\Setup\\Scripts</code>.',
    'powershell-zeilen-in-install-ps1': 'PowerShell lines (in Install.ps1)',
    'rem-eigene-batch-befehle': 'REM your own batch commands',
    'eigener-powershell-code': '# your own PowerShell code',

    /* Einstellungen */
    'einstellungen-2': 'Settings',
    'pfade': 'Paths',
    'installationsordner-auf-dem-zielsystem': 'Installation folder on the target system',
    'ablage-von': 'Location of',
    'oem': '$OEM$',
    'auf-dem-medium': 'on the medium',
    'beide-orte-sicherste-variante-empfohlen': 'both locations – safest choice (recommended)',
    'sources-oem-ohne-konfigurationssatz': 'sources\\$OEM$\\… – without a configuration set',
    'oem-im-wurzelverzeichnis-bei-useconfigurationset': '$OEM$\\… in the root – with UseConfigurationSet',
    'ausloeser': 'Trigger',
    'wodurch-wird-install-ps1-gestartet': 'What starts Install.ps1?',
    'setupcomplete-cmd-und-autounattend-xml': 'SetupComplete.cmd and autounattend.xml (recommended)',
    'nur-setupcomplete-cmd': 'SetupComplete.cmd only',
    'nur-autounattend-xml': 'autounattend.xml only',
    'vorhandene-autounattend-xml-importieren': 'Import an existing autounattend.xml',
    'importierte-datei-verwerfen': 'Discard the imported file',
    'ablauf': 'Sequence',
    'phase-2-wird-gestartet-ueber': 'Phase 2 is started by',
    'geplante-aufgabe-als-system-zuverlaessig': 'Scheduled task as SYSTEM (reliable)',
    'runonce-im-kontext-des-ersten': 'RunOnce in the first user\'s context',
    'abschluss-von-phase-2': 'When phase 2 finishes',
    'nichts-tun': 'do nothing',
    'neustart': 'Restart',
    'herunterfahren': 'Shut down',
    'powershell-transcript-mitschreiben': 'Record a PowerShell transcript',
    'windir-setup-scripts': '%WINDIR%\\Setup\\Scripts',
    'nach-abschluss-loeschen': 'delete when finished',
    'erschwert-die-fehlersuche': '(makes troubleshooting harder)',
    'c-install': 'C:\\Install',
    'abschlussmeldung-im-explorer-anzeigen': 'Show a completion message in Explorer',
    'projekt': 'Project',
    'projekt-zuruecksetzen': 'Reset project',

    /* Vorschau */
    'vorschau-2': 'Preview',
    'kopieren': 'Copy',
    'einzeln-laden': 'Download single file'
  };


  /*  Begriffe aus dem Katalog und aus dynamisch erzeugten Texten. Schlüssel ist
      hier die deutsche Fassung selbst - der Katalog bleibt dadurch unverändert
      lesbar, und ein fehlender Eintrag fällt sofort auf.  */
  const TERMS_EN = {
    /* Hinweise, Protokoll- und Statusmeldungen */
    'Scoop läuft nur im Benutzerkontext – Phase 2 mit RunOnce wählen.':
      'Scoop only runs in the user context – choose phase 2 with RunOnce.',
    'Chocolatey wird bei Bedarf automatisch nachinstalliert (Internetzugang nötig).':
      'Chocolatey is installed automatically when needed (internet access required).',
    'npm-/pip-Pakete setzen eine vorhandene Laufzeitumgebung voraus.':
      'npm and pip packages require an existing runtime.',
    'Install\\Files: wird vom Modul "Eigene Installer" ausgefuehrt.\nSetup\\Scripts: liegt neben SetupComplete.cmd und ist ueber %~dp0 erreichbar.':
      'Install\\Files: executed by the "Custom installers" module.\nSetup\\Scripts: sits next to SetupComplete.cmd and is reachable via %~dp0.',
    ' Bit': '-bit',
    ' – ohne: ': ' – excluding: ',
    'ja': 'yes',
    'nein': 'no',
    'Standard': 'default',
    '{0} Einträge': '{0} entries',
    'Kein <code>&lt;Display Level="None" AcceptEULA="TRUE" /&gt;</code> – die Installation würde eine Oberfläche anzeigen. ':
      'No <code>&lt;Display Level="None" AcceptEULA="TRUE" /&gt;</code> – the installation would show a user interface. ',
    '<b>UseConfigurationSet=true:</b> Windows Setup sucht den <code>$OEM$</code>-Ordner neben der Antwortdatei, also im <b>Wurzelverzeichnis</b> des Mediums – nicht unter <code>sources\\</code>. Die Ablage steht deshalb auf „beide Orte“.':
      '<b>UseConfigurationSet=true:</b> Windows Setup looks for the <code>$OEM$</code> folder next to the answer file, i.e. in the <b>root directory</b> of the medium – not under <code>sources\\</code>. The location has therefore been set to "both places".',
    '  ├─ setup.exe                   (ODT – selbst ablegen)':
      '  ├─ setup.exe                   (ODT – add it yourself)',
    '  ├─ Download-Quelle.ps1         erzeugt die Quelle auf diesem Rechner':
      '  ├─ Download-Quelle.ps1         creates the source on this machine',
    '\\                      hierhin kommt Office\\Data\\…':
      '\\                      this is where Office\\Data\\… goes',
    'Datei übernommen: {0} ({1} KB)': 'File taken over: {0} ({1} KB)',
    'Keine Pakete gefunden in {0}': 'No packages found in {0}',
    'Bundle {0}: {1} Pakete übernommen': 'Bundle {0}: {1} packages taken over',
    ', {0} Duplikate übersprungen': ', {0} duplicates skipped',
    '{0} Pakete importiert.': '{0} packages imported.',
    'Office-Konfiguration übernommen: {0}': 'Office configuration taken over: {0}',
    '{0}: {1} winget-Aufrufe erkannt ({2} neu': '{0}: {1} winget calls recognised ({2} new',
    ', {0} bereits vorhanden': ', {0} already present',
    '{0}: Office-Aufruf erkannt – Configuration.xml separat importieren':
      '{0}: Office call recognised – import Configuration.xml separately',
    '{0}: {1} eigene Befehlszeilen übernommen': '{0}: {1} custom command lines taken over',
    '{0}: nichts Verwertbares gefunden': '{0}: nothing usable found',
    '# Importiertes Skript ausführen': '# run the imported script',
    'PowerShell-Skript übernommen und Aufruf ergänzt: {0}':
      'PowerShell script taken over and its call added: {0}',
    'autounattend.xml übernommen: {0} – {1} vorhandene Befehle, UseConfigurationSet={2}':
      'autounattend.xml taken over: {0} – {1} existing commands, UseConfigurationSet={2}',
    'UseConfigurationSet=true erkannt: $OEM$ gehört ins Wurzelverzeichnis des Mediums – Ablage auf „beide Orte“ gestellt.':
      'UseConfigurationSet=true detected: $OEM$ belongs in the root directory of the medium – location set to "both places".',
    'Als Datei übernommen: {0}': 'Taken over as a file: {0}',
    'Erzeuge …': 'Generating …',
    'ZIP mit {0} Dateien erstellt.': 'ZIP with {0} files created.',
    'Export fehlgeschlagen: {0}': 'Export failed: {0}',
    'ZIP erzeugen': 'Generate ZIP',
    'Eingefügtes Bundle: {0} Pakete übernommen': 'Pasted bundle: {0} packages taken over',
    'Konnte nicht gelesen werden: {0}': 'Could not be read: {0}',
    'Noch nichts importiert.': 'Nothing imported yet.',
    '{0} Pakete zum Entfernen ausgewählt.': '{0} packages selected for removal.',
    /* Meldungen aus den Importern */
    'Unbekanntes Bundle-Format': 'Unknown bundle format',
    'Office-Installation (ODT) erkannt: {0}': 'Office installation (ODT) recognised: {0}',
    'PowerShell-Aufruf erkannt: {0}': 'PowerShell call recognised: {0}',
    'AppX-Entfernung erkannt – bitte im Modul „Bloatware“ nachpflegen.':
      'AppX removal recognised – please add it in the "Bloatware" module.',
    'XML nicht lesbar': 'XML not readable',
    'Kein <Configuration>-Element': 'No <Configuration> element',
    'Kein <unattend>-Element': 'No <unattend> element',
    /* Modultitel aus Templates.moduleList() */
    'System-Tweaks': 'System tweaks',
    'Tweaks mit Netzwerkbedarf': 'Tweaks that require the network',
    'Bloatware entfernen': 'Remove bloatware',
    'Microsoft Office (ODT)': 'Microsoft Office (ODT)',
    'Eigene Installer': 'Custom installers',
    'Eigene PowerShell-Befehle': 'Custom PowerShell commands',
    /* Kategorien */
    'Explorer': 'Explorer',
    'Taskleiste': 'Taskbar',
    'Datenschutz': 'Privacy',
    'System': 'System',
    'Netzwerk': 'Network',

    /* Tweaks */
    'Dateinamenerweiterungen anzeigen': 'Show file name extensions',
    'Versteckte Dateien anzeigen': 'Show hidden files',
    'Geschützte Systemdateien anzeigen': 'Show protected operating system files',
    'Explorer startet mit „Dieser PC“': 'Open File Explorer to This PC',
    'Vollständigen Pfad in der Titelleiste anzeigen': 'Show the full path in the title bar',
    'Klassisches Kontextmenü (Windows 10-Stil)': 'Classic context menu (Windows 10 style)',
    'Blendet „Weitere Optionen anzeigen“ aus': 'Removes "Show more options"',
    'Zuletzt verwendete Dateien/Apps nicht anzeigen': 'Do not show recently opened files or apps',
    'Desktopsymbole „Dieser PC“ und Benutzerordner einblenden': 'Show the This PC and user folder desktop icons',
    'Taskleiste linksbündig ausrichten': 'Align the taskbar to the left',
    'Suchfeld ausblenden (nur Symbol)': 'Hide the search box (icon only)',
    'Widgets ausblenden': 'Hide widgets',
    'Chat-/Teams-Symbol ausblenden': 'Hide the Chat/Teams button',
    'Copilot-Schaltfläche ausblenden': 'Hide the Copilot button',
    '„Task beenden“ im Rechtsklick aktivieren': 'Enable "End task" in the right-click menu',
    'Sekunden in der Uhr anzeigen': 'Show seconds in the clock',
    'Telemetrie auf Minimum setzen': 'Set telemetry to the minimum',
    'AllowTelemetry = 0 (Security)': 'AllowTelemetry = 0 (Security)',
    'Werbe-ID deaktivieren': 'Disable the advertising ID',
    'Vorgeschlagene Apps / Consumer Features aus': 'Turn off suggested apps and consumer features',
    'Automatische App-Vorschläge im Startmenü aus': 'Turn off automatic app suggestions in the Start menu',
    'Bing-/Websuche im Startmenü deaktivieren': 'Disable Bing and web search in the Start menu',
    'Cortana deaktivieren': 'Disable Cortana',
    'Windows Copilot per Richtlinie abschalten': 'Turn off Windows Copilot by policy',
    'Recall (KI-Rückblick) deaktivieren': 'Disable Recall',
    'Sperrbildschirm-Tipps und Spotlight aus': 'Turn off lock screen tips and Spotlight',
    'Lange Pfade (>260 Zeichen) aktivieren': 'Enable long paths (over 260 characters)',
    'Schnellstart deaktivieren': 'Disable fast startup',
    'Ruhezustand abschalten (hiberfil.sys entfernen)': 'Turn off hibernation (removes hiberfil.sys)',
    'Energieplan „Höchstleistung“ aktivieren, Standby aus': 'Activate the High performance power plan, no standby',
    'NumLock beim Anmelden aktivieren': 'Enable NumLock at sign-in',
    'Dunkles Design für Apps und System': 'Dark theme for apps and system',
    'Systemwiederherstellung für C: aktivieren': 'Enable System Restore for C:',
    'Zeitzone auf „W. Europe Standard Time“ setzen': 'Set the time zone to W. Europe Standard Time',
    'PowerShell-Ausführungsrichtlinie auf RemoteSigned': 'Set the PowerShell execution policy to RemoteSigned',
    'UAC ohne abgedunkelten Desktop': 'UAC without the dimmed desktop',
    'Schutzstufe bleibt aktiv, nur der sichere Desktop entfällt':
      'The protection level stays on, only the secure desktop is skipped',
    'Keine Treiber über Windows Update': 'No drivers through Windows Update',
    'Edge: Erststart-Assistent und Startup-Boost aus': 'Edge: turn off the first-run experience and startup boost',
    'Anzeigename des Benutzerkontos berichtigen': 'Correct the display name of the user account',
    'Setzt den vollständigen Namen auf den Kontonamen, wenn dort ein Platzhalter wie „USER“ steht. Windows holt das meist von selbst nach – nur für Fälle, in denen der Platzhalter bleibt.':
      'Sets the full name to the account name where a placeholder such as "USER" is left. Windows usually corrects this by itself – this is for the cases where the placeholder stays.',
    'OneDrive-Autostart entfernen': 'Remove OneDrive from startup',
    'Remotedesktop aktivieren (inkl. Firewallregel)': 'Enable Remote Desktop (including the firewall rule)',
    'Ping (ICMPv4) zulassen': 'Allow ping (ICMPv4)',
    'Netzwerkprofil auf „Privat“ setzen': 'Set the network profile to Private',
    'SMBv1 sicher deaktiviert lassen': 'Keep SMBv1 safely disabled',

    /* Bloatware mit deutschem Anzeigenamen */
    'Nachrichten': 'News',
    'Wetter': 'Weather',
    'Websuche (Bing)': 'Web search (Bing)',
    'Hilfe anfordern': 'Get Help',
    'Tipps / Erste Schritte': 'Tips / Get Started',
    'Kurznotizen': 'Sticky Notes',
    'Kontakte': 'People',
    'Uhr / Wecker': 'Clock / Alarms',
    'Kamera': 'Camera',
    'Mail und Kalender': 'Mail and Calendar',
    'Karten': 'Maps',
    'Sprachrekorder': 'Sound Recorder',
    'Smartphone-Link': 'Phone Link',
    'Filme & TV': 'Movies & TV',
    'Teams (persönlich, Chat)': 'Teams (personal, Chat)',
    'Neues Outlook': 'New Outlook',
    'Schnellhilfe': 'Quick Assist',
    'Family Safety': 'Family Safety',
    'Family (neu)': 'Family (new)',
    /* Meldungen und Hinweise der Oberfläche */
    'Projekt geladen.': 'Project loaded.',
    'Projekt zurückgesetzt.': 'Project reset.',
    'Projektdatei gespeichert.': 'Project file saved.',
    'Projekt auf Werkseinstellungen zurücksetzen?': 'Reset the project to its defaults?',
    'Paketliste wirklich leeren?': 'Really clear the package list?',
    'Paket-ID (z. B. 7zip.7zip):': 'Package ID (for example 7zip.7zip):',
    'AppX-Paketname (z. B. Microsoft.BingNews):': 'AppX package name (for example Microsoft.BingNews):',
    'Keine Pakete gefunden.': 'No packages found.',
    'Configuration.xml importiert.': 'Configuration.xml imported.',
    'Display-Element ergänzt.': 'Display element added.',
    'SetupComplete.cmd analysiert.': 'SetupComplete.cmd analysed.',
    'PowerShell-Skript importiert.': 'PowerShell script imported.',
    'autounattend.xml wird ergänzt statt ersetzt.': 'autounattend.xml will be extended, not replaced.',
    'autounattend.xml nicht lesbar.': 'autounattend.xml could not be read.',
    'Importierte autounattend.xml verworfen.': 'Imported autounattend.xml discarded.',
    'In die Zwischenablage kopiert.': 'Copied to the clipboard.',
    'Kopieren nicht möglich.': 'Copying is not possible.',
    'Hinweis: Binärdateien sind nicht Teil der Projektdatei und müssen erneut hinzugefügt werden.':
      'Note: binary files are not part of the project file and have to be added again.',
    'Noch nichts importiert.': 'Nothing imported yet.',
    'Keine Dateien hinzugefügt.': 'No files added.',
    'Keine Treffer.': 'No matches.',
    'Noch keine Pakete – UniGetUI-Bundle importieren oder Paket hinzufügen.':
      'No packages yet – import a UniGetUI bundle or add one.',
    'Keine Configuration.xml hinterlegt.': 'No Configuration.xml stored.',
    'Nicht lesbar: ': 'Not readable: ',
    'Unbeaufsichtigte Installation ist konfiguriert (Display Level="None").':
      'Unattended installation is configured (Display Level="None").',
    'Automatisch ergänzen': 'Add automatically',
    'Entfernen': 'Remove',
    'nicht im Archiv (nur Platzhalter)': 'not in the archive (placeholder only)',
    '/S  bzw.  /qn /norestart  – leer = nur kopieren': '/S or /qn /norestart – empty means copy only',
    'Aufruf über eigene CMD-Zeilen (%~dp0)': 'Invoked from your own CMD lines (%~dp0)',
    'Phase 1': 'Phase 1',
    'Phase 2': 'Phase 2',
    ' · läuft in Phase 2': ' · runs in phase 2',
    'Anwendungen': 'Applications',
    'Office (ODT)': 'Office (ODT)',
    'Tweaks': 'Tweaks',
    'Bloatware': 'Bloatware',
    'Eigene Dateien': 'Own files',
    'aktiv': 'on',
    'aus': 'off',
    'im Archiv': 'in the archive',
    'AppX-Pakete': 'AppX packages',
    'Architektur': 'Architecture',
    'Kanal': 'Channel',
    'Version': 'Version',
    'Produkte': 'Products',
    'MSI-Vorgänger entfernen': 'Remove earlier MSI versions',
    'Updates': 'Updates',
    'Standard': 'default',
    'Benutzereinstellungen': 'User settings',
    'ja': 'yes',
    'nein': 'no',
    'Importierte Datei': 'Imported file',
    'Vorhandene Befehle': 'Existing commands',
    'Passes': 'Passes',
    'UseConfigurationSet': 'UseConfigurationSet',
    'Produktschlüssel': 'Product key',
    'Install\\Files': 'Install\\Files',
    'Setup\\Scripts': 'Setup\\Scripts',
    '(eigenes Paket)': '(own package)',

    /* Längere Hinweise, die zur Laufzeit entstehen */
    'Achtung: winget läuft hier als SYSTEM. Der App-Execution-Alias existiert nur je Benutzer, und der direkte Aufruf aus WindowsApps bricht mit 0xC0000135 ab – in diesem Kontext schlägt jedes Paket fehl. Phase 2 über die autounattend.xml (FirstLogonCommands) oder RunOnce starten, damit die Installation im Benutzerkontext läuft.':
      'Careful: winget runs as SYSTEM here. The app execution alias exists per user only, and calling the executable directly from WindowsApps fails with 0xC0000135 – every package fails in this context. Start phase 2 through autounattend.xml (FirstLogonCommands) or RunOnce so the installation runs in the user context.',
    'In Phase 1 existiert noch kein Benutzerprofil; Pakete, die nur benutzerbezogen installieren, schlagen dort fehl.':
      'No user profile exists in phase 1; packages that only install per user will fail there.',
    'Empfohlen: Netzwerk und App Installer sind bei der ersten Anmeldung zuverlässig verfügbar.':
      'Recommended: network and App Installer are reliably available at first sign-in.',
    'Achtung: In Phase 1 (specialize) besteht noch keine Netzwerkverbindung. Das Office Deployment Tool lädt die Installationsdateien aber von Microsoft – auch mit mitgelieferter setup.exe. Entweder Phase 2 wählen oder in der Configuration.xml SourcePath auf eine lokale Quelle setzen.':
      'Careful: in phase 1 (specialize) there is no network connection yet. The Office Deployment Tool downloads the installation files from Microsoft, however – even when setup.exe ships along. Either choose phase 2 or point SourcePath in Configuration.xml at a local source.',
    'Die Configuration.xml verweist per SourcePath auf eine lokale Quelle – damit ist die Installation auch ohne Netzwerk in Phase 1 möglich.':
      'Configuration.xml points at a local source through SourcePath – that makes installation in phase 1 possible without a network.',
    'Es wird eine eigenständige autounattend.xml erzeugt, die nur die Skripte startet. Wenn Sie bereits eine Antwortdatei verwenden, importieren Sie diese hier – der Generator ergänzt sie, statt sie zu ersetzen.':
      'A standalone autounattend.xml is generated that only starts the scripts. If you already use an answer file, import it here – the generator extends it instead of replacing it.',
    'Die Aufrufe werden mit fortlaufender Order in die vorhandenen Blöcke eingefügt; bereits vorhandene Einträge des Generators werden dabei ersetzt.':
      'The calls are inserted into the existing blocks with a continuing Order; entries this generator added earlier are replaced.',
    'Der Generator trägt <code>SourcePath</code> automatisch in die Configuration.xml ein und legt den Ordner sowie das Hilfsskript an:':
      'The generator writes <code>SourcePath</code> into Configuration.xml and creates the folder plus the helper script:',
    'Die Quelle selbst wird <b>nicht</b> ins ZIP gepackt – mehrere Gigabyte durch den Browser zu schleusen ist nicht praktikabel. Nach dem Entpacken <code>Download-Quelle.ps1</code> im Office-Ordner ausführen, dann steht die Offline-Installation auch in Phase 1 zur Verfügung. Fehlt die Quelle, weicht das Modul auf den Online-Bezug aus.':
      'The source itself is <b>not</b> packed into the ZIP – pushing several gigabytes through the browser is not practical. After extracting, run <code>Download-Quelle.ps1</code> in the Office folder; offline installation is then available in phase 1 as well. Without the source the module falls back to the online path.',
    'braucht': 'requires',
    'brauchen': 'require',
    'setzt': 'requires',
    'setzen': 'require',
    ' einen laufenden Netzwerk- bzw. Dienststack; im <code>specialize</code>-Pass blockieren solche Cmdlets und halten das Setup an':
      ' a running network or service stack; in the <code>specialize</code> pass such cmdlets block and stall setup',
    ' ein angelegtes Benutzerkonto voraus, das es in Phase 1 noch nicht gibt':
      ' an existing user account, which does not exist yet in phase 1',
    '. Diese Einstellungen werden automatisch in Phase 2 nachgeholt, jeweils mit Zeitgrenze. Die Registry-Anteile bleiben in Phase 1.':
      '. These settings are applied in phase 2 instead, each with its own time limit. Their registry parts stay in phase 1.',
    'Referenziert, aber nicht im Archiv: ': 'Referenced but missing from the archive: ',
    ' – die Dateien unter „Eigene Dateien“ mit Zielordner „Setup\\Scripts“ hinzufügen.':
      ' – add those files under "Own files" with the target folder "Setup\\Scripts".',
    'Windows Setup kopiert <code>$OEM$\\$1</code> nach ': 'Windows Setup copies <code>$OEM$\\$1</code> to ',
    ' und <code>$OEM$\\$$</code> nach <code>%WINDIR%</code>': ' and <code>$OEM$\\$$</code> to <code>%WINDIR%</code>',
    '<code>SetupComplete.cmd</code> startet <code>Install.ps1 -Phase Setup</code> als SYSTEM':
      '<code>SetupComplete.cmd</code> starts <code>Install.ps1 -Phase Setup</code> as SYSTEM',
    'Eigene CMD-Befehle': 'Own CMD commands',
    'Geplante Aufgabe <code>OEM-Setup-Phase2</code> startet als SYSTEM bei der ersten Anmeldung':
      'Scheduled task <code>OEM-Setup-Phase2</code> starts as SYSTEM at first sign-in',
    '<code>RunOnce</code> startet <code>Install.ps1 -Phase FirstLogon</code>':
      '<code>RunOnce</code> starts <code>Install.ps1 -Phase FirstLogon</code>',
    'Neustart': 'Restart',
    'Herunterfahren': 'Shut down',
    '(leer)': '(empty)',
    'Zeilen': 'lines',
    'Bytes': 'bytes',
    '[Binärdatei – ': '[binary file – ',
    ' KB – wird unverändert ins Archiv übernommen]': ' KB – copied into the archive unchanged]'
  };

  const DICTS = { de: null, en: EN };
  let current = 'de';

  /* Platzhalter {0}, {1}, … in der übersetzten Fassung füllen. */
  function fmt(german) {
    const args = Array.prototype.slice.call(arguments, 1);
    const tpl = term(german);
    return tpl.replace(/\{(\d+)\}/g, (m, i) => (args[i] !== undefined ? args[i] : m));
  }

  function t(key, fallback) {
    const dict = DICTS[current];
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    return fallback !== undefined ? fallback : key;
  }

  /* Deutsche Vorlage einmalig sichern, damit der Rückweg verlustfrei ist. */
  function remember(el) {
    if (el.dataset.i18n && el.dataset.i18nDe === undefined) el.dataset.i18nDe = el.innerHTML;
    if (el.dataset.i18nPh && el.dataset.i18nPhDe === undefined) el.dataset.i18nPhDe = el.getAttribute('placeholder') || '';
    if (el.dataset.i18nTitle && el.dataset.i18nTitleDe === undefined) el.dataset.i18nTitleDe = el.getAttribute('title') || '';
  }

  function applyTo(el) {
    remember(el);
    if (el.dataset.i18n) {
      const v = current === 'de' ? el.dataset.i18nDe : t(el.dataset.i18n, el.dataset.i18nDe);
      if (el.innerHTML !== v) el.innerHTML = v;
    }
    if (el.dataset.i18nPh) {
      el.setAttribute('placeholder', current === 'de' ? el.dataset.i18nPhDe : t(el.dataset.i18nPh, el.dataset.i18nPhDe));
    }
    if (el.dataset.i18nTitle) {
      el.setAttribute('title', current === 'de' ? el.dataset.i18nTitleDe : t(el.dataset.i18nTitle, el.dataset.i18nTitleDe));
    }
  }

  function apply(root) {
    const scope = root || document;
    scope.querySelectorAll('[data-i18n],[data-i18n-ph],[data-i18n-title]').forEach(applyTo);
    document.documentElement.lang = current;
  }

  function setLanguage(lang) {
    current = DICTS[lang] !== undefined ? lang : 'de';
    try { localStorage.setItem('oemgen.lang', current); } catch (e) { /* privater Modus */ }
    apply();
    document.dispatchEvent(new CustomEvent('oemgen:language', { detail: { lang: current } }));
  }

  function detect() {
    let stored = null;
    try { stored = localStorage.getItem('oemgen.lang'); } catch (e) { /* privater Modus */ }
    if (stored && DICTS[stored] !== undefined) return stored;
    const nav = (navigator.language || 'de').toLowerCase();
    return nav.startsWith('de') ? 'de' : 'en';
  }

  /* Übersetzt einen Katalogbegriff; ohne Eintrag bleibt die deutsche Fassung. */
  function term(german) {
    if (current !== 'en' || !german) return german;
    return Object.prototype.hasOwnProperty.call(TERMS_EN, german) ? TERMS_EN[german] : german;
  }

  global.I18n = {
    t,
    term,
    fmt,
    apply,
    setLanguage,
    detect,
    get lang() { return current; },
    /* nur fuer tools/check-i18n.js */
    dict: (lang) => DICTS[lang]
  };
})(window);
