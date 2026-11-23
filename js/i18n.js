/*  Zweisprachige Oberfläche (Deutsch / Englisch).

    Die Vorlage in index.html trägt die deutschen Texte; Elemente mit
    data-i18n (Inhalt), data-i18n-ph (placeholder) und data-i18n-title (title)
    werden beim Sprachwechsel ersetzt. Dynamisch erzeugte Texte holen sich ihre
    Fassung über t('schlüssel'). Fehlt eine Übersetzung, bleibt der deutsche
    Text stehen - sichtbar, aber nie leer.  */
(function (global) {
  'use strict';

  const EN = {
    'nav-komponenten': 'Windows components',
    'windows-komponenten': 'Windows components',
    'optionale-features-und-features-on-demand':
      'Turn on optional features (Windows Sandbox, Hyper-V, WSL, .NET&nbsp;3.5 …) and features on demand '
      + '(OpenSSH, RSAT …) along the way – via <code>Enable-WindowsOptionalFeature</code> and '
      + '<code>Add-WindowsCapability</code>.',
    'phase-2-nach-erster-anmeldung-3': 'Phase 2 – after first sign-in (recommended)',
    'phase-1-setupcomplete-system-2': 'Phase 1 – SetupComplete (SYSTEM)',
    'zeitgrenze-je-komponente-minuten': 'Time limit per component (minutes)',
    'auswahl-leeren-3': 'Clear selection',
    'komponenten-filtern': 'Filter components…',
    'th-name': 'Name',
    'th-paket-id': 'Package ID',
    'th-manager': 'Manager',
    'th-version': 'Version',
    'th-zusatzargumente': 'Extra arguments',
    'spalte-sortieren': 'Click to sort (ascending, descending, off). The installation order does not change.',
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
      'Drop files anywhere to import<br><small>.ubundle · .cmd · .ps1 · .reg · .xml · .json</small>',

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
      '<code>SetupComplete.cmd</code>, ODT <code>Configuration.xml</code>, PowerShell scripts, <code>.reg</code> files, ' +
      '<code>autounattend.xml</code>, AppLocker policies, Wi-Fi profiles and saved projects.',
    'auswaehlen': 'select',
    'ubundle-json-cmd-bat-ps1': '.ubundle · .json · .yaml · .cmd/.bat · .ps1 · .reg · autounattend.xml · Configuration.xml · AppLocker.xml · Wi-Fi profile.xml · .oemproj.json · .exe/.msi',
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
    'einzeln-laden': 'Download single file',
    'nav-treiber': 'Drivers',
    'treiber-titel': 'Drivers',
    'treiber-lead': 'Ship unpacked drivers (INF, SYS, CAT …) along. Every package goes into its own folder and is either installed by <code>Install-Drivers.ps1</code> with <code>pnputil</code> or loaded by Windows Setup itself via <code>$WinPEDriver$</code>. Driver installers as EXE belong under “Own files”.',
    'treiber-phase-1': 'Phase 1 – SetupComplete (SYSTEM, recommended)',
    'treiber-phase-2': 'Phase 2 – after first sign-in',
    'zeitgrenze-je-treiberpaket': 'Time limit per driver package (minutes)',
    'treiber-ziel-hilfe': '<b>pnputil</b> – for chipset, graphics, audio, Wi-Fi and so on; runs in the selected phase and honours the model filter. <b>Windows Setup ($WinPEDriver$)</b> – for drivers without which Setup cannot see the disk or the network (NVMe/RAID, network); the folder belongs in the root of the medium.',
    'treiber-modell-hilfe': 'Model filter: separate several patterns with <code>;</code>, <code>*</code> and <code>?</code> are allowed, a pattern without wildcards counts as a substring. It is compared with the model, manufacturer + model, SKU and – for Lenovo – the product name. To show them on the target device: <code>Get-CimInstance Win32_ComputerSystem | Select Manufacturer, Model</code>. Empty = every device.',
    'treiberordner-hinzufuegen': 'Add driver folder',
    'treiberdateien-hinzufuegen': 'Single files',
    'leeres-treiberpaket': 'Empty package (copy files later)',
    'treiber-nicht-in-projektdatei': 'Driver files go into the ZIP only, not into the project file.',
    'th-paket': 'Package',
    'th-inhalt': 'Contents',
    'th-ziel': 'Target',
    'th-modelle': 'Models',
    'registry-dateien': 'Registry files (.reg)',
    'registry-dateien-hinweis': 'Exported <code>.reg</code> files are taken over value by value and run with the tweaks in the same '
      + 'phase. <code>HKEY_CURRENT_USER</code> goes into the default profile like every user tweak (and to all users if '
      + 'selected) – a <code>reg import</code> as SYSTEM would write into the SYSTEM profile instead. '
      + '<code>HKEY_CLASSES_ROOT</code> becomes <code>HKLM\\SOFTWARE\\Classes</code>; <code>HKEY_USERS</code> is skipped.',
    'reg-datei-importieren': 'Import .reg file',
    'zielsystem-useconfigurationset': 'Target system – determines <code>UseConfigurationSet</code> in the autounattend.xml',
    'ziel-24h2': 'Windows 11 24H2 and later – UseConfigurationSet=true (recommended)',
    'ziel-23h2': 'Windows 10 / Windows 11 up to 23H2 – UseConfigurationSet=false',
    'ziel-beide': 'One medium for both generations – true, with a copy of the medium on old builds',
    /* Antwortdatei-Designer */
    'nav-antwortdatei': 'Answer file',
    'antwortdatei-2': 'Answer file',
    'antwortdatei-designer-aktiv': 'Create the answer file with the designer',
    'antwortdatei-lead': 'Creates a complete <code>autounattend.xml</code> – language, accounts, computer name, edition, OOBE – '
      + 'into which the generator then inserts its calls. The designer is a port of the generator by Christoph Schneegans '
      + '(<a href="https://github.com/cschneegans/unattend-generator" target="_blank" rel="noopener noreferrer">unattend-generator</a>, '
      + 'MIT licence). Not yet included: wallpaper, VM guest tools.',
    'sprache-und-region': 'Language &amp; region',
    'sprache-einstellung': 'Language and keyboard',
    'opt-interaktiv-setup-fragt': 'interactive – Setup asks',
    'opt-vorgeben': 'specify',
    'sprache-des-images': 'Language of the Windows image',
    'standort': 'Location (home location)',
    'zeitzone': 'Time zone',
    'opt-zeitzone-implizit': 'derive from language/region',
    'setup-und-edition': 'Setup &amp; edition',
    'edition-produktschluessel': 'Edition / product key',
    'opt-edition-interaktiv': 'interactive – Setup asks for the edition',
    'opt-edition-firmware': 'key from the firmware (BIOS/UEFI)',
    'opt-edition-generisch': 'edition with generic key',
    'opt-edition-schluessel': 'own product key',
    'edition': 'Edition',
    'produktschluessel': 'Product key',
    'aktivierungsschluessel': 'Key for activation (optional)',
    'hardwarepruefung-umgehen': 'Bypass hardware check (TPM, Secure Boot, RAM)',
    'netzwerkzwang-umgehen': 'Allow setup without internet connection (BypassNRO)',
    'sprachausgabe': 'Narrator during installation',
    'prozessorarchitekturen': 'Processor architectures:',
    'useconfigurationset-zielsystem-hinweis': '<code>UseConfigurationSet</code> follows the target system under Settings → Trigger.',
    'computername': 'Computer name',
    'opt-cn-zufaellig': 'random (Windows assigns it)',
    'opt-cn-fest': 'specify',
    'opt-cn-abfrage': 'ask during installation',
    'name': 'Name',
    'oobe-und-sicherheit': 'OOBE &amp; security',
    'datenschutz-einstellungen': 'Privacy settings',
    'opt-alle-aus': 'all off',
    'opt-alle-an': 'all on',
    'wlan': 'Wi-Fi',
    'opt-wlan-ueberspringen': 'skip',
    'kontosperrung': 'Account lockout',
    'opt-windows-standard': 'Windows default',
    'opt-aus': 'off',
    'opt-eigene-werte': 'own values',
    'fehlversuche': 'Failed attempts',
    'sperrdauer-min': 'Lockout duration (min)',
    'zaehler-zuruecksetzen-min': 'Reset counter after (min)',
    'kennwortablauf': 'Password expiration',
    'opt-pw-standard': 'Windows default (42 days)',
    'opt-pw-unbegrenzt': 'unlimited',
    'tage': 'Days',
    'powershell-fenster-verbergen': 'Hide PowerShell windows of the answer file',
    'sensible-dateien-behalten': 'Keep unattend.xml after the first sign-in (may contain passwords)',
    'personalisierung': 'Personalization',
    'personalisierung-hinweis': 'Applies to every new user account at its first sign-in (Explorer restarts once afterwards). '
      + 'Particularly useful when Windows is to run without activation – Windows then locks personalization in Settings. '
      + 'Partly overlaps with tweaks such as “Dark mode” or “Desktop icons”; choose only one of the two.',
    'farben': 'Colors',
    'opt-eigenes-farbschema': 'own color scheme',
    'taskleiste-und-start': 'Taskbar and Start',
    'opt-dunkel': 'dark',
    'opt-hell': 'light',
    'apps': 'Apps',
    'akzentfarbe': 'Accent color',
    'akzent-start-taskleiste': 'Accent color on Start and taskbar',
    'akzent-titelleisten': 'Accent color on title bars and window borders',
    'transparenz': 'Transparency effects',
    'sperrtasten': 'Lock keys (also applies to the sign-in screen)',
    'opt-festlegen': 'configure',
    'taste': 'Key',
    'beim-start': 'At startup',
    'beim-druecken': 'When pressed',
    'opt-an': 'on',
    'opt-umschalten': 'toggle',
    'opt-ignorieren': 'ignore',
    'visuelle-effekte': 'Visual effects',
    'opt-fx-darstellung': 'best appearance',
    'opt-fx-leistung': 'best performance',
    'opt-fx-eigene': 'custom selection',
    'desktopsymbole': 'Desktop icons',
    'opt-diese-anzeigen': 'show these',
    'edge-verknuepfung-loeschen': 'Delete the Edge shortcut on the desktop',
    'ordner-im-start': 'Folders on Start (next to the power button)',
    'applocker-hinweis': 'Applies an AppLocker policy in the <code>specialize</code> pass via <code>Set-AppLockerPolicy</code> and '
      + 'sets the Application Identity service (<code>AppIDSvc</code>) to automatic. The policy comes e.g. from a reference machine: '
      + '<code>Get-AppLockerPolicy -Local -Xml &gt; AppLocker.xml</code> or <code>secpol.msc</code> → Application Control Policies → '
      + 'AppLocker → Export Policy. <b>Careful:</b> enforced rules without the default rules can block programs, scripts and even '
      + 'sign-in – test new rules with “Audit only” (<code>AuditOnly</code>) first. Check in a VM whether the edition (e.g. Pro) '
      + 'enforces the rules.',
    'applocker': 'AppLocker policy',
    'opt-al-skip': 'do not change',
    'opt-al-configure': 'apply this policy',
    'al-beispiel': 'Insert example (default rules, audit only)',
    'al-laden': 'Load XML file …',
    'opt-wlan-einstellungen': 'connect with these settings',
    'opt-wlan-xml': 'Wi-Fi profile (XML)',
    'wlan-ssid': 'Network name (SSID)',
    'wlan-sicherheit': 'Security',
    'opt-wlan-offen': 'open (no password)',
    'wlan-kennwort': 'Password',
    'wlan-automatisch': 'connect automatically',
    'wlan-verborgen': 'hidden network (does not broadcast its name)',
    'wlan-xml-hinweis': 'Export the profile from a computer that is already connected: '
      + '<code>netsh wlan export profile name="NETWORK" key=clear folder=.</code> – load the file here or drop it onto the page.',
    'wlan-laden': 'Load XML file …',
    'wlan-kennwort-hinweis': 'The password is stored in plain text in the answer file on the medium. On the target computer '
      + '<code>Wifi.xml</code> is deleted after the first sign-in unless “Keep unattend.xml after the first sign-in” is on. In the '
      + 'specialize pass Setup waits up to one minute for the Wi-Fi service – without a Wi-Fi adapter it simply continues afterwards.',
    'benutzerkonten': 'User accounts',
    'opt-konto-ms': 'interactive – Microsoft account',
    'opt-konto-lokal': 'interactive – local account',
    'opt-konto-vorgeben': 'specify accounts',
    'konto-hinzufuegen': 'Add account',
    'automatische-anmeldung': 'Automatic sign-in',
    'opt-autologon-keine': 'none',
    'opt-autologon-erstes-admin': 'first administrator account (once)',
    'opt-autologon-builtin': 'built-in administrator account',
    'kennwort-administrator': 'Password for “Administrator”',
    'kennwoerter-verschleiern': 'Obscure passwords (Base64 like Windows SIM – no protection, just not readable in plain text)',
    'installation-und-partitionierung': 'Installation &amp; partitioning',
    'ablauf-der-installation': 'Installation procedure',
    'opt-pe-standard': 'Windows Setup – choose partitions in Setup (default)',
    'opt-pe-generate': 'pe.cmd – partition the disk automatically and apply Windows',
    'opt-pe-script': 'own pe.cmd',
    'pe-hinweis': 'Instead of Windows Setup, a script handles the windowsPE phase: determine the target disk, partition it with '
      + '<code>diskpart</code>, apply the image via <code>dism</code>, <code>bcdboot</code>, copy <code>$OEM$</code> via '
      + '<code>robocopy</code>, restart. Edition and hardware check from “Setup &amp; edition” do not apply then – the chosen image '
      + 'is applied directly.',
    'partitionierung': 'Partitioning',
    'opt-part-automatisch': 'automatic (the disk is wiped)',
    'opt-part-diskpart': 'own diskpart script',
    'opt-part-interaktiv': 'by hand (Shift+F10, diskpart)',
    'layout': 'Layout',
    'opt-layout-auto': 'by firmware (UEFI: GPT, BIOS: MBR)',
    'systempartition-mb': 'System partition (MB)',
    'wiederherstellung': 'Recovery',
    'opt-recovery-partition': 'own partition',
    'opt-recovery-keine': 'none (delete winre.wim)',
    'groesse-mb': 'Size (MB)',
    'zieldatentraeger': 'Target disk',
    'opt-ziel-kriterien': 'determine by criteria (aborts if not unique)',
    'opt-ziel-fest': 'fixed index',
    'opt-ziel-interaktiv': 'ask during installation',
    'opt-ziel-skript': 'own VBScript',
    'index': 'Index',
    'leer-beliebig': 'empty = any',
    'mindestgroesse-gib': 'Minimum size (GiB)',
    'hoechstgroesse-gib': 'Maximum size (GiB)',
    'ziel-ohne-partitionen': 'only disks without partitions',
    'ziel-ide-scsi': 'only IDE/SCSI (no USB disks)',
    'ziel-festplatte': 'only hard disks (“Fixed hard disk media”)',
    'vbscript-zieldatentraeger': 'VBScript – prints the index of the target disk',
    'diskpart-skript': 'diskpart script – must assign the letters W (Windows) and S (system)',
    'image-auswahl': 'Image',
    'opt-inst-edition': 'by edition',
    'opt-inst-index': 'by index',
    'opt-inst-name': 'by name',
    'opt-inst-interaktiv': 'ask during installation',
    'auslagerungsdatei': 'Paging file',
    'opt-paging-auto': 'managed by Windows',
    'opt-paging-keine': 'none',
    'anfang-mib': 'Initial (MiB)',
    'maximum-mib': 'Maximum (MiB)',
    'compact-os': 'Compact OS (compressed, saves space)',
    'integritaet-ueberspringen': 'Skip integrity check of the image (faster)',
    'namen-83-aus': 'Disable 8.3 file names',
    'defender-aus': 'Disable Windows Defender',
    'pause-vor-formatieren': 'pause before formatting',
    'pause-vor-neustart': 'pause before restarting',
    'eigenes-pe-skript': 'Own pe.cmd – replaces the windowsPE phase of Windows Setup',
    'iso-erzeugen': 'Create ISO',
    'iso-erzeugen-titel': 'Pick a Windows ISO – the generated files are added and a new bootable ISO (BIOS and UEFI) is written. No extra tools needed',
    'iso-abbild': 'ISO image',
    'iso-abbild-hinweis': '<b>Create ISO</b> (top) writes a new Windows ISO: the content of the source ISO plus the generated files – '
      + '<code>autounattend.xml</code>, <code>$OEM$</code>, <code>$WinPEDriver$</code>. Existing folders <code>$OEM$</code>, '
      + '<code>sources\\$OEM$</code> and <code>$WinPEDriver$</code> of the source are replaced. The ISO boots like the original via '
      + 'BIOS and UEFI; <code>install.wim</code> or <code>install.esd</code> stays unchanged. Meant for the original ISO from Microsoft.',
    'quell-iso-waehlen': 'Choose source ISO',
    'quell-iso-verwerfen': 'Clear selection',
    'iso-ohne-press-any-key': 'Start without “Press any key to boot from CD or DVD” (<code>efisys_noprompt.bin</code>, without '
      + '<code>bootfix.bin</code>) – for VMs and automation only',
    'iso-ohne-press-any-key-hinweis': 'Careful: without the prompt Windows Setup starts again on every restart as long as the ISO stays '
      + 'inserted – with an <code>autounattend.xml</code> that partitions disks, the machine is reinstalled over and over.',
    'in-ordner-exportieren': 'Export to folder',
    'in-ordner-exportieren-titel': 'Write the structure straight into a folder – e.g. the root of the USB stick. No ZIP, nothing to unpack (Chrome, Edge)',
  };


  /*  Begriffe aus dem Katalog und aus dynamisch erzeugten Texten. Schlüssel ist
      hier die deutsche Fassung selbst - der Katalog bleibt dadurch unverändert
      lesbar, und ein fehlender Eintrag fällt sofort auf.  */
  const TERMS_EN = {
    /* Windows-Komponenten */
    'Windows-Komponenten': 'Windows components',
    'Komponenten': 'Components',
    'Virtualisierung': 'Virtualisation',
    'Laufzeiten': 'Runtimes',
    'Entwicklung': 'Development',
    'Fernwartung': 'Remote access',
    'RSAT': 'RSAT',
    'Sonstiges': 'Other',
    'nur Pro/Enterprise': 'Pro/Enterprise only',
    'Quelle nötig': 'needs a source',
    'VT im BIOS': 'VT in the firmware',
    'Neustart nötig': 'needs a restart',
    'Hilfe bei Microsoft': 'Microsoft help',
    ' – brauchen eingeschaltete Virtualisierung. Fehlt sie (BIOS/UEFI, oder eine VM ohne verschachtelte Virtualisierung), überspringt das Modul diese Komponenten, sonst bliebe der Neustart hängen.':
      ' – need virtualisation turned on. If it is missing (firmware setting, or a VM without nested virtualisation), the module skips these components, otherwise the restart would hang.',
    'Windows Sandbox': 'Windows Sandbox',
    'Wegwerf-Desktop zum gefahrlosen Testen; beim Schließen verfällt alles.':
      'A throwaway desktop for safe testing; everything is discarded on close.',
    'Hyper-V (vollständig)': 'Hyper-V (complete)',
    'Hypervisor, Verwaltungswerkzeuge und PowerShell-Modul.':
      'Hypervisor, management tools and the PowerShell module.',
    'Plattform für virtuelle Computer': 'Virtual Machine Platform',
    'Voraussetzung für WSL 2 und das Windows-Subsystem für Android.':
      'Required for WSL 2 and the Windows Subsystem for Android.',
    'Windows-Hypervisor-Plattform': 'Windows Hypervisor Platform',
    'Lässt VirtualBox und VMware neben Hyper-V laufen.':
      'Lets VirtualBox and VMware run alongside Hyper-V.',
    'Windows-Subsystem für Linux (WSL)': 'Windows Subsystem for Linux (WSL)',
    'Nur der Unterbau. Eine Distribution kommt danach über „wsl --install“ oder winget dazu.':
      'The substrate only. A distribution is added afterwards via "wsl --install" or winget.',
    'Windows-Container': 'Windows containers',
    'Containerunterstützung für Docker Desktop im Windows-Modus.':
      'Container support for Docker Desktop in Windows mode.',
    '.NET Framework 3.5 (inkl. 2.0 und 3.0)': '.NET Framework 3.5 (including 2.0 and 3.0)',
    'Liegt nicht im Image. Der Generator sucht sources\\sxs auf allen Laufwerken und weicht sonst auf Windows Update aus.':
      'Not part of the image. The generator looks for sources\\sxs on every drive and falls back to Windows Update.',
    'Telnet-Client': 'Telnet client',
    'Erreichbarkeit einzelner Ports prüfen.': 'Check whether individual ports respond.',
    'TFTP-Client': 'TFTP client',
    'Einfache TCP/IP-Dienste': 'Simple TCP/IP services',
    'Arbeitsordner': 'Work Folders',
    'Internetinformationsdienste (IIS)': 'Internet Information Services (IIS)',
    'Webserverrolle mit den Standardkomponenten.': 'The web server role with its default components.',
    'Projiziertes Dateisystem (ProjFS)': 'Projected File System (ProjFS)',
    'Von VFS for Git und einigen Build-Werkzeugen vorausgesetzt.':
      'Required by VFS for Git and some build tools.',
    'DirectPlay (Legacykomponenten)': 'DirectPlay (legacy components)',
    'Für ältere Spiele.': 'For older games.',
    'XPS-Druckdienste': 'XPS printing services',
    'OpenSSH-Server': 'OpenSSH server',
    'Dienst wird auf „Automatisch“ gestellt und gestartet; Port 22 öffnet das Setup in der Firewall.':
      'The service is set to automatic and started; setup opens port 22 in the firewall.',
    'OpenSSH-Client': 'OpenSSH client',
    'In aktuellen Windows-Fassungen meist schon vorhanden.':
      'Usually already present in current Windows builds.',
    'RSAT: Server-Manager': 'RSAT: Server Manager',
    'RSAT: Active Directory': 'RSAT: Active Directory',
    'Benutzer und Computer, AD-Standorte, das PowerShell-Modul ActiveDirectory.':
      'Users and Computers, AD Sites, and the ActiveDirectory PowerShell module.',
    'RSAT: Gruppenrichtlinienverwaltung': 'RSAT: Group Policy Management',
    'RSAT: DNS': 'RSAT: DNS',
    'RSAT: DHCP': 'RSAT: DHCP',
    'RSAT: Dateidienste': 'RSAT: File Services',
    'RSAT: BitLocker-Wiederherstellung': 'RSAT: BitLocker recovery',
    'Druckverwaltung': 'Print Management',
    'Windows Media Player (alte Fassung)': 'Windows Media Player (legacy)',
    'XPS-Viewer': 'XPS Viewer',
    'In Phase 1 wartet Windows Setup auf jeden DISM-Aufruf – das verlängert die Installation erheblich, und nachzuladende Komponenten scheitern dort mangels Netzwerk.':
      'In phase 1 Windows Setup waits for every DISM call, which stretches the installation considerably, and components that have to be downloaded fail there for want of a network.',
    ' braucht einen Download und gehört deshalb in Phase 2.':
      ' needs a download and therefore belongs in phase 2.',
    'Empfohlen: DISM läuft dann ohne Zeitdruck, und für Features on Demand steht das Netzwerk bereit.':
      'Recommended: DISM then runs without holding anything up, and the network is available for features on demand.',
    ' – erst nach einem Neustart nutzbar. Unter Einstellungen → Abschluss lässt sich dafür „Neustart“ einstellen; andernfalls vermerkt das Modul nur HKLM\\SOFTWARE\\OEM-Setup\\RestartNeeded = 1.':
      ' – only usable after a restart. Settings → When phase 2 finishes offers "restart" for that; otherwise the module merely records HKLM\\SOFTWARE\\OEM-Setup\\RestartNeeded = 1.',
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
    'Edge: Erststart-Assistent ausblenden': 'Edge: hide the first-run experience',
    'Überspringt die Begrüßungs- und Einrichtungsdialoge beim ersten Start von Edge, samt der Frage nach personalisierter Werbung':
      'Skips the welcome and setup dialogs when Edge is started for the first time, including the question about personalized ads',
    'Edge: Startup-Boost und Hintergrundmodus aus': 'Edge: turn off startup boost and background mode',
    'Edge läuft nicht mehr ständig im Hintergrund. Als empfohlene Richtlinie gesetzt – in den Edge-Einstellungen wieder einschaltbar':
      'Edge no longer keeps running in the background. Set as a recommended policy – can be switched back on in the Edge settings',
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
    'Install\\Office': 'Install\\Office',
    'Install\\Office: für die setup.exe des Office Deployment Tools – das Office-Modul startet sie.': 'Install\\Office: for setup.exe of the Office Deployment Tool – the Office module starts it.',
    'wird vom Office-Modul gestartet': 'started by the Office module',
    'nach dem Schreiben {0} statt {1} Bytes': 'after writing {0} instead of {1} bytes',
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
    ' KB – wird unverändert ins Archiv übernommen]': ' KB – copied into the archive unchanged]',
    'Treiber': 'Drivers',
    'Windows Setup': 'Windows Setup',
    'Noch keine Treiberpakete – Ordner hinzufügen oder leeres Paket anlegen.': 'No driver packages yet – add a folder or create an empty package.',
    '{0} Dateien · {1} INF': '{0} files · {1} INF',
    '{0} Datei · {1} INF': '{0} file · {1} INF',
    'keine INF-Datei: EXE-Installer gehören unter „Eigene Dateien“': 'no INF file: EXE installers belong under “Own files”',
    'leer': 'empty',
    'Dateien später in den Ordner kopieren': 'copy the files into the folder later',
    'pnputil (Phase-Installation)': 'pnputil (phase install)',
    'Windows Setup ($WinPEDriver$)': 'Windows Setup ($WinPEDriver$)',
    'Setup wählt selbst nach Hardware': 'Setup picks by hardware itself',
    'alle Geräte – z. B. Latitude 5440; ThinkPad T14 Gen 3': 'every device – e.g. Latitude 5440; ThinkPad T14 Gen 3',
    'Zusammen {0} Treiberdateien im ZIP.': '{0} of driver files in the ZIP in total.',
    'Mit der ZIP-Wurzel „beide Orte“ liegen die pnputil-Pakete doppelt im Archiv.': 'With the ZIP root “both places” the pnputil packages are in the archive twice.',
    '$WinPEDriver$ liegt im Wurzelverzeichnis des ZIP und gehört ins Wurzelverzeichnis des Mediums.': '$WinPEDriver$ sits in the root of the ZIP and belongs in the root of the medium.',
    'Windows Setup lädt die Treiber aus <code>$WinPEDriver$</code>': 'Windows Setup loads the drivers from <code>$WinPEDriver$</code>',
    '{0} Dateien, zusammen {1} – werden unverändert ins Archiv übernommen:': '{0} files, {1} in total – copied into the archive unchanged:',
    'Treiberpaket „{0}“: {1} Dateien, {2} INF.': 'Driver package “{0}”: {1} files, {2} INF.',
    'Treiberpaket „{0}“: {1} Datei, {2} INF.': 'Driver package “{0}”: {1} file, {2} INF.',
    'Hilfe': 'Help',
    'Hilfe zu dieser Seite (F1)': 'Help for this page (F1)',
    'Schließen': 'Close',
    'Vollständige Dokumentation im README': 'Full documentation in the README',
    'F1 öffnet die Hilfe, Esc schließt sie': 'F1 opens the help, Esc closes it',
    'OEM-Projektdatei': 'OEM project file',
    'Projekt gespeichert: {0}': 'Project saved: {0}',
    'Speichern fehlgeschlagen: {0}': 'Saving failed: {0}',
    'ZIP-Archiv': 'ZIP archive',
    'ZIP mit {0} Dateien gespeichert: {1}': 'ZIP with {0} files saved: {1}',
    'fehlt – nicht im Archiv': 'missing – not in the archive',
    'Datei wählen …': 'Choose file …',
    'fehlt – {0} Dateien nicht im Archiv': 'missing – {0} files not in the archive',
    'Treiberdateien fehlen – Ordner neu wählen': 'driver files missing – choose the folder again',
    'Ordner wählen …': 'Choose folder …',
    'Die Projektdatei enthält keine Binärdateien. Neu zuordnen: {0}': 'The project file holds no binary files. Assign again: {0}',
    'Treiber „{0}“': 'Driver “{0}”',
    'Diese Dateien fehlen und kommen nur als Platzhalter ins ZIP:\n\n{0}\n\nDie Projektdatei enthält keine Binärdateien – nach dem Laden müssen sie unter „Eigene Dateien“ bzw. „Treiber“ neu zugeordnet werden. Trotzdem erzeugen?': 'These files are missing and only go into the ZIP as placeholders:\n\n{0}\n\nThe project file holds no binary files – after loading they have to be assigned again under “Own files” or “Drivers”. Create anyway?',
    '„{0}“ zugeordnet (Eintrag hieß „{1}“).': '“{0}” assigned (the entry was called “{1}”).',
    '„{0}“ zugeordnet.': '“{0}” assigned.',
    'UseConfigurationSet=true: Setup sucht $OEM$ im Wurzelverzeichnis – Ablage auf „beide Orte“ gestellt.': 'UseConfigurationSet=true: Setup looks for $OEM$ in the root – location set to “both places”.',
    ' (setzt der Generator)': ' (set by the generator)',
    'UseConfigurationSet=false: Ohne true kopiert ein aktuelles Windows-11-Setup $OEM$ unter Umständen gar nicht – der Generator setzt den Wert beim Export auf true.': 'UseConfigurationSet=false: without true a current Windows 11 setup may not copy $OEM$ at all – the generator sets the value to true on export.',
    'Ohne autounattend.xml ohne Wirkung – $OEM$ gehört dann nach sources\\.': 'No effect without autounattend.xml – $OEM$ then belongs in sources\\.',
    'Achtung: Mit UseConfigurationSet=true sucht Setup $OEM$ im Wurzelverzeichnis – die Ablage „sources“ allein wird ignoriert.': 'Careful: with UseConfigurationSet=true Setup looks for $OEM$ in the root – the location “sources” alone is ignored.',
    /* Antwortdatei-Designer */
    'Gebietsschema': 'Locale',
    'WLAN-Profil übernommen: {0}': 'Wi-Fi profile adopted: {0}',
    'WLAN-Profil übernommen – es wirkt, sobald die Antwortdatei mit dem Designer erzeugt wird.':
      'Wi-Fi profile adopted – it takes effect once the answer file is created with the designer.',
    'AppLocker-Richtlinie übernommen: {0}': 'AppLocker policy adopted: {0}',
    'AppLocker-Richtlinie übernommen – sie wirkt, sobald die Antwortdatei mit dem Designer erzeugt wird.':
      'AppLocker policy adopted – it takes effect once the answer file is created with the designer.',
    'Steuerelemente und Elemente innerhalb von Fenstern animieren': 'Animate controls and elements inside windows',
    'Animation beim Minimieren und Maximieren von Fenstern': 'Animate windows when minimizing and maximizing',
    'Animationen in der Taskleiste': 'Animations in the taskbar',
    'Aero Peek aktivieren': 'Enable Peek',
    'Menüs in Ansicht ein- oder ausblenden': 'Fade or slide menus into view',
    'QuickInfos in Ansicht ein- oder ausblenden': 'Fade or slide ToolTips into view',
    'Menüelemente nach Aufruf ausblenden': 'Fade out menu items after clicking',
    'Vorschauen von Miniaturansichten der Taskleiste speichern': 'Save taskbar thumbnail previews',
    'Schatten unter dem Mauszeiger anzeigen': 'Show shadows under mouse pointer',
    'Schatten für Symbolbeschriftungen auf dem Desktop': 'Use drop shadows for icon labels on the desktop',
    'Miniaturansichten anstelle von Symbolen anzeigen': 'Show thumbnails instead of icons',
    'Durchsichtiges Auswahlrechteck anzeigen': 'Show translucent selection rectangle',
    'Fensterinhalt beim Ziehen anzeigen': 'Show window contents while dragging',
    'Kombinationsfelder beim Öffnen einblenden': 'Slide open combo boxes',
    'Kanten der Bildschirmschriftarten verfeinern': 'Smooth edges of screen fonts',
    'Bildlauf in Listenfeldern': 'Smooth-scroll list boxes',
    'Fensterschatten anzeigen': 'Show shadows under windows',
    'Musik': 'Music',
    'Dieser PC': 'This PC',
    'Bilder': 'Pictures',
    'Systemsteuerung': 'Control Panel',
    'Benutzerdateien': 'User’s files',
    'Papierkorb': 'Recycle Bin',
    'Dokumente': 'Documents',
    'Katalog': 'Gallery',
    'Startseite': 'Home',
    'Einstellungen': 'Settings',
    'Persönlicher Ordner': 'Personal folder',
    'Gebietsschema {0} (optional)': 'Locale {0} (optional)',
    'Tastatur': 'Keyboard',
    'Tastatur {0}': 'Keyboard {0}',
    'Anzeigename': 'Display name',
    'Kennwort': 'Password',
    'Gruppe': 'Group',
    'Administratoren': 'Administrators',
    'Der Designer ist nicht geladen (js/ug fehlt).': 'The designer is not loaded (js/ug missing).',
    'Aus – es wird die eigenständige bzw. importierte Antwortdatei verwendet.': 'Off – the standalone or imported answer file is used.',
    'Konfiguration gültig – die Antwortdatei steht in der Vorschau.': 'Configuration valid – the answer file is in the preview.',
    'Nicht erzeugbar: {0}': 'Cannot be created: {0}',
    'Achtung: Unter Einstellungen → Auslöser ist „nur SetupComplete.cmd“ gewählt – dann entsteht keine autounattend.xml.': 'Careful: “SetupComplete.cmd only” is selected under Settings → Trigger – then no autounattend.xml is created.',
    'Die importierte autounattend.xml wird nicht verwendet, solange der Designer aktiv ist.': 'The imported autounattend.xml is not used while the designer is active.',
    'Achtung: pe.cmd kopiert nur <Medium>\\$OEM$ – die Ablage steht auf „sources“. Unter Einstellungen → Pfade „beide Orte“ wählen.': 'Careful: pe.cmd only copies <medium>\\$OEM$ – the location is set to “sources”. Choose “both places” under Settings → Paths.',
    'Achtung: pe.cmd löscht den Zieldatenträger ohne Rückfrage.': 'Careful: pe.cmd wipes the target disk without asking.',
    /* Zielsystem / UseConfigurationSet */
    'UseConfigurationSet=false: Setup kopiert sources\\$OEM$, eine Kopie des Mediums entsteht nicht. Achtung: Windows 11 ab 24H2 kopiert $OEM$ damit überhaupt nicht – kein Installationsordner, keine Phase 2.': 'UseConfigurationSet=false: Setup copies sources\\$OEM$, no copy of the medium is made. Careful: Windows 11 from 24H2 on does not copy $OEM$ at all with this – no installation folder, no phase 2.',
    'Die Ablage steht auf „Wurzelverzeichnis“ – ohne UseConfigurationSet braucht Setup aber sources\\$OEM$.': 'The location is set to “root” – without UseConfigurationSet, Setup needs sources\\$OEM$ though.',
    'UseConfigurationSet=true für beide Generationen. Auf Windows 10 und Windows 11 bis 23H2 kopiert Setup damit alles, was neben der Antwortdatei liegt, nach C:\\Windows\\ConfigSetRoot – das ganze Medium (mehrere GB), bei Ventoy die ganze Datenpartition. Ab 24H2 entsteht kein ConfigSetRoot.': 'UseConfigurationSet=true for both generations. On Windows 10 and Windows 11 up to 23H2, Setup then copies everything next to the answer file to C:\\Windows\\ConfigSetRoot – the whole medium (several GB), with Ventoy the whole data partition. From 24H2 on no ConfigSetRoot is created.',
    'UseConfigurationSet=true: Ab Windows 11 24H2 kopiert Setup $OEM$ nur mit diesem Wert; ein ConfigSetRoot entsteht dort nicht. Für ältere Builds „Windows 10 / Windows 11 bis 23H2“ wählen – dort würde das ganze Medium nach C:\\Windows\\ConfigSetRoot kopiert.': 'UseConfigurationSet=true: from Windows 11 24H2 on, Setup copies $OEM$ only with this value; no ConfigSetRoot is created there. For older builds choose “Windows 10 / Windows 11 up to 23H2” – there the whole medium would be copied to C:\\Windows\\ConfigSetRoot.',
    'Quell-ISO mit Build {0}: Zielsystem auf „{1}“ gestellt (UseConfigurationSet={2}).': 'Source ISO with build {0}: target system set to “{1}” (UseConfigurationSet={2}).',
    'Windows 11 24H2 und neuer': 'Windows 11 24H2 and later',
    'Windows 10 / Windows 11 bis 23H2': 'Windows 10 / Windows 11 up to 23H2',
    'beide Generationen': 'both generations',
    'Build {0}': 'Build {0}',
    '1 Edition': '1 edition',
    '{0} Editionen': '{0} editions',
    'Build nicht lesbar (verschlüsseltes ESD?)': 'Build not readable (encrypted ESD?)',
    'Wird bei der ersten Anmeldung jedes Benutzers gesetzt – der Explorer startet dabei einmal kurz neu': 'Set at the first sign-in of every user – Explorer restarts briefly once',
    /* Registry-Dateien */
    '{0} ist keine gültige .reg-Datei.': '{0} is not a valid .reg file.',
    'Registry-Datei übernommen: {0} – {1} Einträge': 'Registry file taken over: {0} – {1} entries',
    '… und {0} weitere Hinweise': '… and {0} more notes',
    '{0}: {1} Einträge übernommen, {2} – siehe Tweaks.': '{0}: {1} entries taken over, {2} – see Tweaks.',
    '1 Hinweis': '1 note',
    '{0}: {1} Einträge übernommen.': '{0}: {1} entries taken over.',
    'Schlüssel löschen': 'delete key',
    'Wert löschen': 'delete value',
    'Keine .reg-Datei importiert.': 'No .reg file imported.',
    '{0} von {1} Einträgen aktiv': '{0} of {1} entries active',
    '{0} Hinweise': '{0} notes',
    'Benutzer': 'User',
    'Rechner': 'Machine',
    'Ziel': 'Target',
    'Schlüssel': 'Key',
    'Name': 'Name',
    'Typ': 'Type',
    'Wert': 'Value',
    /* ISO-Abbild */
    '{0} statt {1} Bytes gelesen – die Datei wurde verändert': '{0} instead of {1} bytes read – the file was changed',
    'Die Datei enthält kein UDF-Dateisystem – das ist keine Windows-Installations-ISO.': 'The file holds no UDF file system – this is not a Windows installation ISO.',
    'Diese ISO nutzt einen Aufbau, den der Generator nicht schreiben kann (UDF 2.x oder Festplatten-Emulation, typisch für Brennprogramme). Bitte die Original-ISO von Microsoft verwenden.': 'This ISO uses a layout the generator cannot write (UDF 2.x or hard-disk emulation, typical of burning software). Please use the original ISO from Microsoft.',
    'Der Bootkatalog der ISO ist beschädigt.': 'The boot catalogue of the ISO is damaged.',
    'ISO-Abbild': 'ISO image',
    'Datei nicht verfügbar: {0}': 'File not available: {0}',
    'Lese {0} …': 'Reading {0} …',
    '({0} Einträge übersprungen)': '({0} entries skipped)',
    'Quell-ISO eingelesen: {0} – {1} Dateien.': 'Source ISO read: {0} – {1} files.',
    'In dieser ISO fehlt sources\\install.wim bzw. install.esd – ist das eine Windows-Installations-ISO?': 'This ISO lacks sources\\install.wim or install.esd – is it a Windows installation ISO?',
    'ISO nicht lesbar: {0}': 'ISO not readable: {0}',
    'Noch keine Quell-ISO gewählt.': 'No source ISO chosen yet.',
    'Datei': 'File',
    'Bezeichnung': 'Label',
    'Abbild': 'Image',
    'fehlt – keine Windows-Installations-ISO?': 'missing – not a Windows installation ISO?',
    'Booten': 'Boot',
    'kein Bootkatalog – die neue ISO startet nicht': 'no boot catalogue – the new ISO will not start',
    'Inhalt': 'Content',
    '{0} Dateien, {1} Ordner': '{0} files, {1} folders',
    'Wird ersetzt': 'Replaced',
    '1 Datei unter $OEM$, sources\\$OEM$ bzw. $WinPEDriver$ aus der Quelle': '1 file under $OEM$, sources\\$OEM$ or $WinPEDriver$ from the source',
    '{0} Dateien unter $OEM$, sources\\$OEM$ bzw. $WinPEDriver$ aus der Quelle': '{0} files under $OEM$, sources\\$OEM$ or $WinPEDriver$ from the source',
    'in der Quelle vorhanden – die importierte Antwortdatei ersetzt sie': 'present in the source – the imported answer file replaces it',
    'in der Quelle vorhanden – beim Erzeugen wird gefragt, ob sie übernommen und ergänzt wird': 'present in the source – when creating the ISO you are asked whether to adopt and extend it',
    'Die Quell-ISO enthält bereits eine autounattend.xml.\n\nOK: übernehmen und um die Aufrufe des Generators ergänzen (empfohlen)\nAbbrechen: durch die Antwortdatei des Generators ersetzen': 'The source ISO already holds an autounattend.xml.\n\nOK: adopt it and add the generator\'s calls (recommended)\nCancel: replace it with the generator\'s answer file',
    'Die Quell-ISO ist nicht mehr lesbar – bitte neu wählen.': 'The source ISO is no longer readable – please choose it again.',
    'In der Quell-ISO fehlt sources\\install.wim bzw. install.esd – sie ist vermutlich keine Windows-Installations-ISO.': 'The source ISO lacks sources\\install.wim or install.esd – it is probably not a Windows installation ISO.',
    'Die Quell-ISO hat keinen Bootkatalog – die neue ISO startet nicht von selbst.': 'The source ISO has no boot catalogue – the new ISO will not start by itself.',
    'Ohne „Press any key“: Die ISO startet Windows Setup sofort. Bleibt sie in einer VM eingelegt, beginnt die Installation nach dem ersten Neustart von vorn – mit einer autounattend.xml, die Datenträger löscht, ein echtes Risiko.': 'Without “Press any key”: the ISO starts Windows Setup right away. If it stays inserted in a VM, the installation starts over after the first restart – a real risk with an autounattend.xml that wipes disks.',
    '„Ohne Press any key“ ist gewählt, aber efi\\microsoft\\boot\\efisys_noprompt.bin fehlt in der Quelle – UEFI fragt weiterhin nach.': '“Without Press any key” is selected, but efi\\microsoft\\boot\\efisys_noprompt.bin is missing in the source – UEFI keeps asking.',
    'Diese Dateien fehlen und kommen nur als Platzhalter in die ISO: {0}': 'These files are missing and only go into the ISO as placeholders: {0}',
    'ISO erzeugen aus „{0}“:\n\n{1}\n\nFortfahren?': 'Create ISO from “{0}”:\n\n{1}\n\nContinue?',
    'Quell-ISO ist eingelesen – zum Speichern bitte noch einmal auf „ISO erzeugen“ klicken.': 'Source ISO has been read – please click “Create ISO” once more to save.',
    'ISO {0} %': 'ISO {0} %',
    '– Die ISO ist größer als 4 GB. Liegt das Ziel auf einem FAT32-Laufwerk (viele USB-Sticks)? FAT32 erlaubt höchstens 4 GB je Datei – die ISO auf die Festplatte oder ein NTFS-/exFAT-Laufwerk speichern.': '– The ISO is larger than 4 GB. Is the target on a FAT32 drive (many USB sticks)? FAT32 allows at most 4 GB per file – save the ISO to the hard disk or an NTFS/exFAT drive.',
    'ISO gespeichert: {0} ({1})': 'ISO saved: {0} ({1})',
    'ISO erstellt ({0}) – der Browser lädt sie herunter.': 'ISO created ({0}) – the browser downloads it.',
    'ISO nicht erzeugt: {0}': 'ISO not created: {0}',
    'Die Quell-ISO ist nicht mehr lesbar – sie wurde seit dem Einlesen geändert, verschoben oder gelöscht. Bitte neu wählen.': 'The source ISO is no longer readable – it was changed, moved or deleted since it was read. Please choose it again.',
    'Die Datei ist nicht mehr lesbar – sie wurde seit dem Hinzufügen geändert, verschoben oder gelöscht. Bitte neu zuordnen: {0}': 'The file is no longer readable – it was changed, moved or deleted since it was added. Please assign it again: {0}',
    '„In Ordner exportieren“ gibt es nur in Chrome und Edge – bitte „ZIP erzeugen“ verwenden.': '“Export to folder” is only available in Chrome and Edge – please use “Create ZIP”.',
    'Diese Dateien fehlen und kommen nur als Platzhalter in den Ordner:\n\n{0}\n\nDie Projektdatei enthält keine Binärdateien – nach dem Laden müssen sie unter „Eigene Dateien“ bzw. „Treiber“ neu zugeordnet werden. Trotzdem exportieren?': 'These files are missing and only go into the folder as placeholders:\n\n{0}\n\nThe project file holds no binary files – after loading they have to be assigned again under “Own files” or “Drivers”. Export anyway?',
    'Ordner nicht verfügbar: {0}': 'Folder not available: {0}',
    'Vorhandene Ordner werden vorher geleert: {0}': 'Existing folders are emptied first: {0}',
    'Im Ziel liegt bereits eine autounattend.xml, die nicht importiert wurde – sie wird durch die des Generators ersetzt. Wer sie behalten will: abbrechen und sie unter Einstellungen → Auslöser importieren.': 'The target already holds an autounattend.xml that was not imported – it will be replaced by the generator\'s. To keep it: cancel and import it under Settings → Trigger.',
    'Export nach „{0}“:\n\n{1}\n\nFortfahren?': 'Export to “{0}”:\n\n{1}\n\nContinue?',
    'Schreibe {0}/{1} …': 'Writing {0}/{1} …',
    '{0} Dateien nach „{1}“ geschrieben.': '{0} files written to “{1}”.',
    'Export fehlgeschlagen nach {0} Dateien: {1}': 'Export failed after {0} files: {1}',
    'Über 1 GB: Das ZIP wird dann sehr groß. „In Ordner exportieren“ (Chrome, Edge) schreibt direkt auf den Stick und spart das Entpacken.': 'Over 1 GB: the ZIP gets very large then. “Export to folder” (Chrome, Edge) writes straight to the stick and saves the unpacking.',
    'ungültiger Name': 'invalid name',
    'unzulässige Zeichen': 'invalid characters',
    'endet auf Punkt oder Leerzeichen': 'ends with a dot or space',
    'reservierter Gerätename': 'reserved device name',
    'Explorer-Hilfsdatei': 'Explorer helper file',
    '{0} Quellen wieder eingebunden: {1}': '{0} sources attached again: {1}',
    'Quelle nicht mehr vorhanden: {0} – bitte neu wählen.': 'Source no longer available: {0} – please choose again.',
    '{0} Quellen aus dem gespeicherten Projekt sind bekannt – Chrome braucht für den Zugriff einmal deine Freigabe.': '{0} sources of the saved project are known – Chrome needs your permission once to access them.',
    'Quellen einbinden': 'Attach sources',
    'Zuletzt aus Ordner „{0}“ – bitte neu wählen': 'Last from folder “{0}” – please choose again',
    'Quelle „{0}“ bekannt – oben „Quellen einbinden“': 'Source “{0}” known – “Attach sources” at the top',
    'Quelle „{0}“ nicht mehr vorhanden – Datei neu wählen': 'Source “{0}” no longer available – choose the file again',
    '{0} Quellen brauchen deine Freigabe – oben „Quellen einbinden“ klicken.': '{0} sources need your permission – click “Attach sources” at the top.',
    '$WinPEDriver$: {0} Dateien mit gesperrtem Dateityp (z. B. .dll) – Chrome schreibt sie nicht in Ordner, und Windows Setup liest diesen Ordner ohne Skript. Diese Treiber per „ZIP erzeugen“ ausliefern oder auf Phase „Setup“ (pnputil) umstellen. Erste Datei: {1}': '$WinPEDriver$: {0} files with a blocked file type (e.g. .dll) – Chrome does not write them to folders, and Windows Setup reads this folder without any script. Deliver these drivers via “Create ZIP” or switch them to phase “Setup” (pnputil). First file: {1}',
    '{0} Dateien (z. B. .dll) schreibt Chrome nicht unter ihrem Namen in Ordner – sie tragen die Endung {1}, Install.ps1 benennt sie bei der Installation zurück.': 'Chrome does not write {0} files (e.g. .dll) to folders under their own name – they carry the extension {1}, Install.ps1 renames them back during installation.',
    'Übersprungen, weil der Browser diese Namen nicht schreiben darf ({0}):': 'Skipped because the browser may not write these names ({0}):',
    'Nicht geschrieben ({0}):': 'Not written ({0}):',
    'Nicht mehr lesbar – seit dem Hinzufügen geändert, verschoben oder gelöscht. Bitte neu zuordnen: {0}': 'No longer readable – changed, moved or deleted since it was added. Please assign again: {0}',
    'Export unvollständig – Details im Hinweisfenster.': 'Export incomplete – details in the message box.',
    'Quelldatei nicht mehr lesbar': 'source file no longer readable',
    '{0} Dateien geschrieben, {1} übersprungen.': '{0} files written, {1} skipped.',
    '– Das ZIP ist größer als 4 GB. Liegt das Ziel auf einem FAT32-Laufwerk (viele USB-Sticks)? FAT32 erlaubt höchstens 4 GB je Datei – das ZIP auf die Festplatte speichern oder „In Ordner exportieren“ verwenden.': '– The ZIP is larger than 4 GB. Is the target on a FAT32 drive (many USB sticks)? FAT32 allows 4 GB per file at most – save the ZIP to the hard disk or use “Export to folder”.',
    'Das ZIP ist größer als 4 GB (ZIP64). Auf FAT32-Laufwerken lässt es sich nicht speichern – dort „In Ordner exportieren“ verwenden.': 'The ZIP is larger than 4 GB (ZIP64). It cannot be saved on FAT32 drives – use “Export to folder” there.',
    'Die Datei ist nicht mehr lesbar – sie wurde seit dem Hinzufügen geändert, verschoben oder gelöscht (etwa weil sie im Zielordner eines früheren Exports lag). Bitte neu zuordnen: {0}': 'The file is no longer readable – it was changed, moved or deleted since it was added (for example because it was in the target folder of an earlier export). Please assign it again: {0}',
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
