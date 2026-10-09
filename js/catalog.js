/* Katalog: System-Tweaks und AppX-Bloatware.
   reg[].scope: 'machine' -> HKLM, 'user' -> HKCU bzw. Default-User-Hive in Phase 1
   type: DWord | String | ExpandString | QWord */
(function (global) {
  'use strict';

  const TWEAKS = [
    /* ---------- Explorer ---------- */
    { id: 'fileExt', cat: 'Explorer', label: 'Dateinamenerweiterungen anzeigen',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'HideFileExt', type: 'DWord', value: 0 }] },
    { id: 'hiddenFiles', cat: 'Explorer', label: 'Versteckte Dateien anzeigen',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'Hidden', type: 'DWord', value: 1 }] },
    { id: 'superHidden', cat: 'Explorer', label: 'Geschützte Systemdateien anzeigen', desc: 'ShowSuperHidden = 1',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'ShowSuperHidden', type: 'DWord', value: 1 }] },
    { id: 'launchToThisPC', cat: 'Explorer', label: 'Explorer startet mit „Dieser PC“',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'LaunchTo', type: 'DWord', value: 1 }] },
    { id: 'fullPathTitle', cat: 'Explorer', label: 'Vollständigen Pfad in der Titelleiste anzeigen',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\CabinetState', name: 'FullPath', type: 'DWord', value: 1 }] },
    { id: 'classicContext', cat: 'Explorer', label: 'Klassisches Kontextmenü (Windows 10-Stil)',
      desc: 'Blendet „Weitere Optionen anzeigen“ aus',
      reg: [{ scope: 'user', path: 'Software\\Classes\\CLSID\\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\\InprocServer32', name: '(Default)', type: 'String', value: '' }] },
    { id: 'noRecentFiles', cat: 'Explorer', label: 'Zuletzt verwendete Dateien/Apps nicht anzeigen',
      reg: [
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'Start_TrackDocs', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'Start_TrackProgs', type: 'DWord', value: 0 }] },
    { id: 'desktopIcons', cat: 'Explorer', label: 'Desktopsymbole „Dieser PC“ und Benutzerordner einblenden',
      reg: [
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\HideDesktopIcons\\NewStartPanel', name: '{20D04FE0-3AEA-1069-A2D8-08002B30309D}', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\HideDesktopIcons\\NewStartPanel', name: '{59031a47-3f72-44a7-89c5-5595fe6b30ee}', type: 'DWord', value: 0 }] },

    /* ---------- Taskleiste ---------- */
    { id: 'taskbarLeft', cat: 'Taskleiste', label: 'Taskleiste linksbündig ausrichten',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'TaskbarAl', type: 'DWord', value: 0 }] },
    { id: 'taskbarSearch', cat: 'Taskleiste', label: 'Suchfeld ausblenden (nur Symbol)',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Search', name: 'SearchboxTaskbarMode', type: 'DWord', value: 0 }] },
    { id: 'taskbarWidgets', cat: 'Taskleiste', label: 'Widgets ausblenden',
      reg: [
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'TaskbarDa', type: 'DWord', value: 0 },
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Dsh', name: 'AllowNewsAndInterests', type: 'DWord', value: 0 }] },
    { id: 'taskbarChat', cat: 'Taskleiste', label: 'Chat-/Teams-Symbol ausblenden',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'TaskbarMn', type: 'DWord', value: 0 }] },
    { id: 'taskbarCopilot', cat: 'Taskleiste', label: 'Copilot-Schaltfläche ausblenden',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'ShowCopilotButton', type: 'DWord', value: 0 }] },
    { id: 'taskbarEndTask', cat: 'Taskleiste', label: '„Task beenden“ im Rechtsklick aktivieren',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced\\TaskbarDeveloperSettings', name: 'TaskbarEndTask', type: 'DWord', value: 1 }] },
    { id: 'clockSeconds', cat: 'Taskleiste', label: 'Sekunden in der Uhr anzeigen',
      reg: [{ scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced', name: 'ShowSecondsInSystemClock', type: 'DWord', value: 1 }] },

    /* ---------- Datenschutz ---------- */
    { id: 'telemetry', cat: 'Datenschutz', label: 'Telemetrie auf Minimum setzen', desc: 'AllowTelemetry = 0 (Security)',
      reg: [
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\DataCollection', name: 'AllowTelemetry', type: 'DWord', value: 0 },
        { scope: 'machine', path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\DataCollection', name: 'AllowTelemetry', type: 'DWord', value: 0 }] },
    { id: 'adId', cat: 'Datenschutz', label: 'Werbe-ID deaktivieren',
      reg: [{ scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\AdvertisingInfo', name: 'DisabledByGroupPolicy', type: 'DWord', value: 1 }] },
    { id: 'consumerFeatures', cat: 'Datenschutz', label: 'Vorgeschlagene Apps / Consumer Features aus',
      reg: [{ scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\CloudContent', name: 'DisableWindowsConsumerFeatures', type: 'DWord', value: 1 }] },
    { id: 'contentDelivery', cat: 'Datenschutz', label: 'Automatische App-Vorschläge im Startmenü aus',
      reg: [
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SilentInstalledAppsEnabled', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SystemPaneSuggestionsEnabled', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'PreInstalledAppsEnabled', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SubscribedContent-338388Enabled', type: 'DWord', value: 0 }] },
    { id: 'bingSearch', cat: 'Datenschutz', label: 'Bing-/Websuche im Startmenü deaktivieren',
      reg: [
        { scope: 'user', path: 'Software\\Policies\\Microsoft\\Windows\\Explorer', name: 'DisableSearchBoxSuggestions', type: 'DWord', value: 1 },
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search', name: 'DisableWebSearch', type: 'DWord', value: 1 }] },
    { id: 'cortana', cat: 'Datenschutz', label: 'Cortana deaktivieren',
      reg: [{ scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\Windows Search', name: 'AllowCortana', type: 'DWord', value: 0 }] },
    { id: 'copilotOff', cat: 'Datenschutz', label: 'Windows Copilot per Richtlinie abschalten',
      reg: [{ scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsCopilot', name: 'TurnOffWindowsCopilot', type: 'DWord', value: 1 }] },
    { id: 'recall', cat: 'Datenschutz', label: 'Recall (KI-Rückblick) deaktivieren',
      reg: [{ scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsAI', name: 'DisableAIDataAnalysis', type: 'DWord', value: 1 }] },
    { id: 'lockscreenTips', cat: 'Datenschutz', label: 'Sperrbildschirm-Tipps und Spotlight aus',
      reg: [
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'RotatingLockScreenOverlayEnabled', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager', name: 'SubscribedContent-338387Enabled', type: 'DWord', value: 0 }] },

    /* ---------- System ---------- */
    { id: 'longPaths', cat: 'System', label: 'Lange Pfade (>260 Zeichen) aktivieren',
      reg: [{ scope: 'machine', path: 'SYSTEM\\CurrentControlSet\\Control\\FileSystem', name: 'LongPathsEnabled', type: 'DWord', value: 1 }] },
    { id: 'fastStartup', cat: 'System', label: 'Schnellstart deaktivieren',
      reg: [{ scope: 'machine', path: 'SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Power', name: 'HiberbootEnabled', type: 'DWord', value: 0 }] },
    { id: 'hibernateOff', cat: 'System', label: 'Ruhezustand abschalten (hiberfil.sys entfernen)',
      ps: 'powercfg.exe /hibernate off' },
    { id: 'powerHigh', cat: 'System', label: 'Energieplan „Höchstleistung“ aktivieren, Standby aus',
      ps: [
        'powercfg.exe -duplicatescheme 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null | Out-Null',
        'powercfg.exe /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c 2>$null',
        'powercfg.exe /change standby-timeout-ac 0',
        'powercfg.exe /change hibernate-timeout-ac 0',
        'powercfg.exe /change monitor-timeout-ac 20'].join('\n') },
    { id: 'numlock', cat: 'System', label: 'NumLock beim Anmelden aktivieren',
      reg: [{ scope: 'user', path: 'Control Panel\\Keyboard', name: 'InitialKeyboardIndicators', type: 'String', value: '2' }] },
    { id: 'darkMode', cat: 'System', label: 'Dunkles Design für Apps und System',
      reg: [
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'AppsUseLightTheme', type: 'DWord', value: 0 },
        { scope: 'user', path: 'Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize', name: 'SystemUsesLightTheme', type: 'DWord', value: 0 }] },
    { id: 'restoreOn', cat: 'System', label: 'Systemwiederherstellung für C: aktivieren',
      ps: [
        'Enable-ComputerRestore -Drive "C:\\" -ErrorAction Stop',
        'vssadmin.exe Resize ShadowStorage /For=C: /On=C: /MaxSize=10% | Out-Null'].join('\n') },
    { id: 'timezone', cat: 'System', label: 'Zeitzone auf „W. Europe Standard Time“ setzen',
      ps: 'tzutil.exe /s "W. Europe Standard Time"' },
    { id: 'execPolicy', cat: 'System', label: 'PowerShell-Ausführungsrichtlinie auf RemoteSigned',
      ps: 'Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine -Force' },
    { id: 'uacSecureDesktop', cat: 'System', label: 'UAC ohne abgedunkelten Desktop',
      desc: 'Schutzstufe bleibt aktiv, nur der sichere Desktop entfällt',
      reg: [{ scope: 'machine', path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Policies\\System', name: 'PromptOnSecureDesktop', type: 'DWord', value: 0 }] },
    { id: 'noDriversWU', cat: 'System', label: 'Keine Treiber über Windows Update',
      reg: [
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Windows\\WindowsUpdate', name: 'ExcludeWUDriversInQualityUpdate', type: 'DWord', value: 1 },
        { scope: 'machine', path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\DriverSearching', name: 'SearchOrderConfig', type: 'DWord', value: 0 }] },
    { id: 'edgePolicies', cat: 'System', label: 'Edge: Erststart-Assistent und Startup-Boost aus',
      reg: [
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Edge', name: 'HideFirstRunExperience', type: 'DWord', value: 1 },
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Edge', name: 'StartupBoostEnabled', type: 'DWord', value: 0 },
        { scope: 'machine', path: 'SOFTWARE\\Policies\\Microsoft\\Edge', name: 'PersonalizationReportingEnabled', type: 'DWord', value: 0 }] },
    { id: 'onedriveOff', cat: 'System', label: 'OneDrive-Autostart entfernen',
      ps: [
        'Remove-ItemProperty -Path "HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run" -Name "OneDriveSetup" -ErrorAction SilentlyContinue',
        'Set-RegValue -Scope Machine -Path "SOFTWARE\\Policies\\Microsoft\\OneDrive" -Name "DisableFileSyncNGSC" -Type DWord -Value 1'].join('\n') },

    /* ---------- Netzwerk / Remote ---------- */
    { id: 'rdpOn', cat: 'Netzwerk', label: 'Remotedesktop aktivieren (inkl. Firewallregel)',
      reg: [
        { scope: 'machine', path: 'SYSTEM\\CurrentControlSet\\Control\\Terminal Server', name: 'fDenyTSConnections', type: 'DWord', value: 0 },
        { scope: 'machine', path: 'SYSTEM\\CurrentControlSet\\Control\\Terminal Server\\WinStations\\RDP-Tcp', name: 'UserAuthentication', type: 'DWord', value: 1 }],
      ps: 'Enable-NetFirewallRule -DisplayGroup "Remotedesktop" -ErrorAction SilentlyContinue\nEnable-NetFirewallRule -DisplayGroup "Remote Desktop" -ErrorAction SilentlyContinue' },
    { id: 'icmpOn', cat: 'Netzwerk', label: 'Ping (ICMPv4) zulassen',
      ps: [
        'if (-not (Get-NetFirewallRule -Name "OEM-ICMPv4-In" -ErrorAction SilentlyContinue)) {',
        '    New-NetFirewallRule -Name "OEM-ICMPv4-In" -DisplayName "ICMPv4 eingehend zulassen" -Protocol ICMPv4 -IcmpType 8 -Direction Inbound -Action Allow | Out-Null',
        '}'].join('\n') },
    { id: 'netPrivate', cat: 'Netzwerk', label: 'Netzwerkprofil auf „Privat“ setzen',
      ps: 'Get-NetConnectionProfile -ErrorAction SilentlyContinue | Set-NetConnectionProfile -NetworkCategory Private -ErrorAction SilentlyContinue' },
    { id: 'smb1Off', cat: 'Netzwerk', label: 'SMBv1 sicher deaktiviert lassen',
      ps: 'Disable-WindowsOptionalFeature -Online -FeatureName SMB1Protocol -NoRestart -ErrorAction SilentlyContinue | Out-Null' }
  ];

  const BLOAT = [
    { id: 'Microsoft.BingNews', name: 'Nachrichten', rec: true },
    { id: 'Microsoft.BingWeather', name: 'Wetter', rec: true },
    { id: 'Microsoft.BingSearch', name: 'Websuche (Bing)', rec: false },
    { id: 'Microsoft.GamingApp', name: 'Xbox App', rec: true },
    { id: 'Microsoft.GetHelp', name: 'Hilfe anfordern', rec: true },
    { id: 'Microsoft.Getstarted', name: 'Tipps / Erste Schritte', rec: true },
    { id: 'Microsoft.MicrosoftOfficeHub', name: 'Office Hub', rec: true },
    { id: 'Microsoft.MicrosoftSolitaireCollection', name: 'Solitaire Collection', rec: true },
    { id: 'Microsoft.MicrosoftStickyNotes', name: 'Kurznotizen', rec: false },
    { id: 'Microsoft.People', name: 'Kontakte', rec: true },
    { id: 'Microsoft.PowerAutomateDesktop', name: 'Power Automate', rec: true },
    { id: 'Microsoft.Todos', name: 'To Do', rec: true },
    { id: 'Microsoft.WindowsAlarms', name: 'Uhr / Wecker', rec: false },
    { id: 'Microsoft.WindowsCamera', name: 'Kamera', rec: false },
    { id: 'microsoft.windowscommunicationsapps', name: 'Mail und Kalender', rec: true },
    { id: 'Microsoft.WindowsFeedbackHub', name: 'Feedback-Hub', rec: true },
    { id: 'Microsoft.WindowsMaps', name: 'Karten', rec: true },
    { id: 'Microsoft.WindowsSoundRecorder', name: 'Sprachrekorder', rec: true },
    { id: 'Microsoft.Xbox.TCUI', name: 'Xbox TCUI', rec: false },
    { id: 'Microsoft.XboxGameOverlay', name: 'Xbox Game Overlay', rec: true },
    { id: 'Microsoft.XboxGamingOverlay', name: 'Xbox Gaming Overlay', rec: true },
    { id: 'Microsoft.XboxIdentityProvider', name: 'Xbox Identity Provider', rec: false },
    { id: 'Microsoft.XboxSpeechToTextOverlay', name: 'Xbox Speech-to-Text', rec: true },
    { id: 'Microsoft.YourPhone', name: 'Smartphone-Link', rec: true },
    { id: 'Microsoft.ZuneMusic', name: 'Media Player', rec: false },
    { id: 'Microsoft.ZuneVideo', name: 'Filme & TV', rec: true },
    { id: 'Microsoft.549981C3F5F10', name: 'Cortana', rec: true },
    { id: 'MicrosoftTeams', name: 'Teams (persönlich, Chat)', rec: true },
    { id: 'MSTeams', name: 'Microsoft Teams (Store-Version)', rec: false },
    { id: 'Clipchamp.Clipchamp', name: 'Clipchamp', rec: true },
    { id: 'Microsoft.OutlookForWindows', name: 'Neues Outlook', rec: false },
    { id: 'Microsoft.Copilot', name: 'Copilot App', rec: true },
    { id: 'Microsoft.QuickAssist', name: 'Schnellhilfe', rec: false },
    { id: 'Microsoft.MixedReality.Portal', name: 'Mixed Reality Portal', rec: true },
    { id: 'Microsoft.SkypeApp', name: 'Skype', rec: true },
    { id: 'Microsoft.Windows.DevHome', name: 'Dev Home', rec: true },
    { id: 'Microsoft.OneDriveSync', name: 'OneDrive Sync (Store)', rec: false },
    { id: 'Microsoft.Family', name: 'Family Safety', rec: true },
    { id: 'Microsoft.WindowsFamilySafety', name: 'Family (neu)', rec: true }
  ];

  /* Paketmanager, die aus UniGetUI-Bundles kommen können */
  const MANAGERS = {
    winget: {
      label: 'WinGet',
      cmd: 'winget',
      install: (p, o) => {
        const a = ['install', '--id', p.id, '--exact', '--silent',
          '--accept-package-agreements', '--accept-source-agreements', '--disable-interactivity'];
        if (p.source) a.push('--source', p.source);
        if (o.pinVersions && p.version && /^[0-9]/.test(p.version)) a.push('--version', p.version);
        if (o.machineScope) a.push('--scope', 'machine');
        if (p.args) a.push(p.args);
        return a.join(' ');
      }
    },
    chocolatey: { label: 'Chocolatey', cmd: 'choco', install: (p) => 'install ' + p.id + ' -y --no-progress' + (p.args ? ' ' + p.args : '') },
    scoop: { label: 'Scoop', cmd: 'scoop', install: (p) => 'install ' + p.id + (p.args ? ' ' + p.args : '') },
    npm: { label: 'npm', cmd: 'npm', install: (p) => 'install -g ' + p.id + (p.args ? ' ' + p.args : '') },
    pip: { label: 'pip', cmd: 'pip', install: (p) => 'install ' + p.id + (p.args ? ' ' + p.args : '') },
    cargo: { label: 'Cargo', cmd: 'cargo', install: (p) => 'install ' + p.id + (p.args ? ' ' + p.args : '') },
    dotnet: { label: '.NET Tool', cmd: 'dotnet', install: (p) => 'tool install --global ' + p.id + (p.args ? ' ' + p.args : '') },
    powershell: { label: 'PowerShell Gallery', cmd: 'powershell', install: (p) => p.id }
  };

  global.Catalog = { TWEAKS, BLOAT, MANAGERS };
})(window);
