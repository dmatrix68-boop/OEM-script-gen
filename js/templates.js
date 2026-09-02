/* Erzeugt sämtliche Dateien der $OEM$-Struktur. */
(function (global) {
  'use strict';

  const NL = '\r\n';

  /* ---------- Hilfsfunktionen ---------- */

  function psq(s) { return "'" + String(s === null || s === undefined ? '' : s).replace(/'/g, "''") + "'"; }

  function psArray(items, indent) {
    const pad = ' '.repeat(indent || 0);
    return items.map((i) => pad + psq(i)).join(',' + NL);
  }

  function toCRLF(s) { return s.replace(/\r?\n/g, NL); }

  function banner(title, project) {
    return toCRLF([
      '#requires -Version 5.1',
      '<#',
      '    ' + title,
      '    Projekt : ' + (project || '-'),
      '    Erzeugt : ' + new Date().toISOString().slice(0, 19).replace('T', ' '),
      '    Quelle  : OEM Script Generator',
      '',
      '    Automatisch erzeugt - Aenderungen gehen beim naechsten Export verloren.',
      '#>',
      ''
    ].join('\n'));
  }

  function relFromRoot(installRoot) {
    // 'C:\Install' -> 'Install'  (Ablage unter $OEM$\$1\)
    return String(installRoot).replace(/^[A-Za-z]:\\?/, '').replace(/\\+$/, '') || 'Install';
  }

  /* ---------- Lib/OEM-Common.ps1 ---------- */

  function libCommon(st) {
    return banner('Gemeinsame Funktionen fuer alle Installationsschritte.', st.meta.name) + toCRLF(`
$Global:OemRoot = Split-Path -Parent $PSScriptRoot
$Global:OemLogDir = Join-Path $Global:OemRoot 'Logs'
$script:LogFile = Join-Path $Global:OemLogDir 'oem-setup.log'
$script:MountedHives = @()
$script:UserRegRoots = $null

function Initialize-OemLog {
    param([string]$Name = 'oem-setup')
    if (-not (Test-Path -LiteralPath $Global:OemLogDir)) {
        New-Item -Path $Global:OemLogDir -ItemType Directory -Force | Out-Null
    }
    $script:LogFile = Join-Path $Global:OemLogDir ($Name + '.log')
}

function Write-Log {
    param(
        [Parameter(Mandatory)][string]$Message,
        [ValidateSet('Info','Warn','Error','Step','Debug')][string]$Level = 'Info'
    )
    $line = '[{0}] [{1}] {2}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Level.ToUpper().PadRight(5), $Message
    switch ($Level) {
        'Error' { Write-Host $line -ForegroundColor Red }
        'Warn'  { Write-Host $line -ForegroundColor Yellow }
        'Step'  { Write-Host $line -ForegroundColor Cyan }
        'Debug' { Write-Verbose $line }
        default { Write-Host $line }
    }
    try { Add-Content -LiteralPath $script:LogFile -Value $line -Encoding UTF8 -ErrorAction Stop } catch { }
}

function Test-OemAdmin {
    try {
        $id = [Security.Principal.WindowsIdentity]::GetCurrent()
        return ([Security.Principal.WindowsPrincipal]$id).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    } catch { return $false }
}

function Test-OemSystem {
    try { return [Security.Principal.WindowsIdentity]::GetCurrent().IsSystem } catch { return $false }
}

<#  Benutzer-Registry: laeuft das Skript als SYSTEM, existiert kein sinnvolles HKCU.
    Dann werden das Default-Profil und optional alle vorhandenen Profile eingebunden. #>
function Open-UserHives {
    param([switch]$IncludeExistingProfiles)

    $roots = @()
    $script:MountedHives = @()

    if (-not (Test-OemSystem)) {
        $roots += 'Registry::HKEY_CURRENT_USER'
        if (-not $IncludeExistingProfiles) {
            $script:UserRegRoots = $roots
            return $roots
        }
    }

    $defaultHive = Join-Path $env:SystemDrive 'Users\\Default\\NTUSER.DAT'
    if (Test-Path -LiteralPath $defaultHive) {
        $key = 'OEM_DEFAULTUSER'
        & reg.exe load "HKLM\\$key" "$defaultHive" > $null 2>&1
        if ($LASTEXITCODE -eq 0) {
            $script:MountedHives += $key
            $roots += "Registry::HKEY_LOCAL_MACHINE\\$key"
            Write-Log 'Default-Benutzerprofil (NTUSER.DAT) eingebunden.' -Level Debug
        } else {
            Write-Log 'Default-Benutzerprofil konnte nicht eingebunden werden.' -Level Warn
        }
    }

    if ($IncludeExistingProfiles) {
        $profileList = 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\ProfileList'
        Get-ChildItem -Path $profileList -ErrorAction SilentlyContinue |
            Where-Object { $_.PSChildName -match '^S-1-5-21-' } | ForEach-Object {
                $sid = $_.PSChildName
                $path = (Get-ItemProperty -Path $_.PSPath -Name ProfileImagePath -ErrorAction SilentlyContinue).ProfileImagePath
                if (Test-Path -LiteralPath "Registry::HKEY_USERS\\$sid") {
                    $roots += "Registry::HKEY_USERS\\$sid"
                } elseif ($path -and (Test-Path -LiteralPath (Join-Path $path 'NTUSER.DAT'))) {
                    $key = 'OEM_' + $sid
                    & reg.exe load "HKLM\\$key" (Join-Path $path 'NTUSER.DAT') > $null 2>&1
                    if ($LASTEXITCODE -eq 0) {
                        $script:MountedHives += $key
                        $roots += "Registry::HKEY_LOCAL_MACHINE\\$key"
                    }
                }
            }
    }

    if ($roots.Count -eq 0) { $roots = @('Registry::HKEY_CURRENT_USER') }
    $script:UserRegRoots = $roots
    return $roots
}

function Close-UserHives {
    if (-not $script:MountedHives -or $script:MountedHives.Count -eq 0) { return }
    [gc]::Collect()
    [gc]::WaitForPendingFinalizers()
    foreach ($key in $script:MountedHives) {
        & reg.exe unload "HKLM\\$key" > $null 2>&1
        if ($LASTEXITCODE -ne 0) {
            Start-Sleep -Milliseconds 500
            [gc]::Collect()
            & reg.exe unload "HKLM\\$key" > $null 2>&1
        }
    }
    $script:MountedHives = @()
    $script:UserRegRoots = $null
}

function Get-UserRegRoots {
    if ($script:UserRegRoots) { return $script:UserRegRoots }
    return @('Registry::HKEY_CURRENT_USER')
}

function Set-RegValue {
    param(
        [ValidateSet('Machine','User')][string]$Scope = 'Machine',
        [Parameter(Mandatory)][string]$Path,
        [Parameter(Mandatory)][string]$Name,
        [ValidateSet('DWord','QWord','String','ExpandString','MultiString','Binary')][string]$Type = 'DWord',
        $Value
    )
    $roots = if ($Scope -eq 'Machine') { @('Registry::HKEY_LOCAL_MACHINE') } else { Get-UserRegRoots }
    $propName = if ($Name -eq '(Default)') { '(default)' } else { $Name }
    foreach ($root in $roots) {
        $full = $root.TrimEnd('\\') + '\\' + $Path.TrimStart('\\')
        try {
            if (-not (Test-Path -LiteralPath $full)) { New-Item -Path $full -Force -ErrorAction Stop | Out-Null }
            New-ItemProperty -LiteralPath $full -Name $propName -PropertyType $Type -Value $Value -Force -ErrorAction Stop | Out-Null
        } catch {
            Write-Log ('Registry nicht gesetzt: {0} -> {1} ({2})' -f $full, $propName, $_.Exception.Message) -Level Warn
        }
    }
}

function Invoke-Step {
    param([Parameter(Mandatory)][string]$Name, [Parameter(Mandatory)][scriptblock]$Body)
    Write-Log ('--- ' + $Name) -Level Step
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        & $Body
        Write-Log ('{0} abgeschlossen ({1:n1} s)' -f $Name, $sw.Elapsed.TotalSeconds)
        return $true
    } catch {
        Write-Log ('{0} fehlgeschlagen: {1}' -f $Name, $_.Exception.Message) -Level Error
        return $false
    }
}

function Wait-OemNetwork {
    param([int]$TimeoutSeconds = 300)
    Write-Log 'Warte auf Netzwerkverbindung ...'
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        try {
            $ok = Test-NetConnection -ComputerName 'www.msftconnecttest.com' -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
            if ($ok) { Write-Log ('Netzwerk verfuegbar nach {0:n0} s.' -f $sw.Elapsed.TotalSeconds); return $true }
        } catch { }
        Start-Sleep -Seconds 5
    }
    Write-Log 'Kein Netzwerk innerhalb des Zeitlimits.' -Level Warn
    return $false
}

function Resolve-Winget {
    $cmd = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }

    # Unter SYSTEM steht winget nicht im PATH - direkt in WindowsApps suchen.
    $base = Join-Path $env:ProgramFiles 'WindowsApps'
    $dirs = Get-ChildItem -Path $base -Directory -Filter 'Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe' -ErrorAction SilentlyContinue
    if (-not $dirs) {
        $dirs = Get-ChildItem -Path $base -Directory -Filter 'Microsoft.DesktopAppInstaller_*' -ErrorAction SilentlyContinue
    }
    $best = $dirs | Sort-Object -Property Name -Descending | ForEach-Object { Join-Path $_.FullName 'winget.exe' } |
            Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    return $best
}

function Install-WingetBootstrap {
    Write-Log 'winget nicht gefunden - versuche App Installer bereitzustellen.' -Level Warn
    $tmp = Join-Path $env:TEMP 'oem-winget'
    New-Item -Path $tmp -ItemType Directory -Force | Out-Null
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $downloads = @(
        @{ Url = 'https://aka.ms/Microsoft.VCLibs.x64.14.00.Desktop.appx'; File = 'VCLibs.appx' },
        @{ Url = 'https://aka.ms/getwinget'; File = 'AppInstaller.msixbundle' }
    )
    foreach ($d in $downloads) {
        $target = Join-Path $tmp $d.File
        try {
            Invoke-WebRequest -Uri $d.Url -OutFile $target -UseBasicParsing -ErrorAction Stop
            Add-AppxProvisionedPackage -Online -PackagePath $target -SkipLicense -ErrorAction Stop | Out-Null
            Write-Log ('Bereitgestellt: ' + $d.File)
        } catch {
            Write-Log ('Bereitstellung fehlgeschlagen ({0}): {1}' -f $d.File, $_.Exception.Message) -Level Warn
        }
    }
    Start-Sleep -Seconds 5
    return (Resolve-Winget)
}

function Invoke-OemProcess {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [int[]]$SuccessCodes = @(0),
        [int]$TimeoutSeconds = 3600
    )
    Write-Log ('Starte: "{0}" {1}' -f $FilePath, ($Arguments -join ' ')) -Level Debug
    $startArgs = @{ FilePath = $FilePath; PassThru = $true; WindowStyle = 'Hidden'; ErrorAction = 'Stop' }
    if ($Arguments -and $Arguments.Count -gt 0) { $startArgs['ArgumentList'] = $Arguments }
    $p = Start-Process @startArgs
    if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
        Write-Log ('Zeitueberschreitung nach {0} s - Prozess wird beendet.' -f $TimeoutSeconds) -Level Error
        try { $p.Kill() } catch { }
        return [pscustomobject]@{ ExitCode = -1; Success = $false }
    }
    $code = $p.ExitCode
    $ok = $SuccessCodes -contains $code
    if (-not $ok) { Write-Log ('Exitcode {0} von {1}' -f $code, (Split-Path -Leaf $FilePath)) -Level Warn }
    return [pscustomobject]@{ ExitCode = $code; Success = $ok }
}
`);
  }

  /* ---------- SetupComplete.cmd ---------- */

  function setupComplete(st) {
    const root = st.paths.installRoot.replace(/\\+$/, '');
    const lines = [
      '@echo off',
      'REM ===================================================================',
      'REM  SetupComplete.cmd - erzeugt vom OEM Script Generator',
      'REM  Projekt: ' + st.meta.name,
      'REM  Wird von Windows Setup am Ende der Installation als SYSTEM ausgefuehrt.',
      'REM ===================================================================',
      'setlocal EnableExtensions',
      '',
      'set "OEMROOT=' + root + '"',
      'set "LOGDIR=%OEMROOT%\\Logs"',
      'if not exist "%LOGDIR%" mkdir "%LOGDIR%" >nul 2>&1',
      'set "LOG=%LOGDIR%\\SetupComplete.log"',
      '',
      'echo [%date% %time%] SetupComplete gestartet>> "%LOG%"',
      '',
      'if not exist "%OEMROOT%\\Install.ps1" (',
      '    echo [%date% %time%] FEHLER: %OEMROOT%\\Install.ps1 nicht gefunden.>> "%LOG%"',
      '    goto :cleanup',
      ')',
      '',
      'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%OEMROOT%\\Install.ps1" -Phase Setup >> "%LOG%" 2>&1',
      'echo [%date% %time%] Install.ps1 beendet mit Exitcode %errorlevel%>> "%LOG%"'
    ];

    if (st.custom.cmdEnabled && st.custom.cmd.trim()) {
      lines.push('', 'REM --- Eigene Befehle ------------------------------------------------');
      lines.push('cd /d "%~dp0"');
      st.custom.cmd.split(/\r?\n/).forEach((l) => lines.push(l));
      lines.push('cd /d "%SystemDrive%\\"');
    }

    lines.push('', ':cleanup', 'echo [%date% %time%] SetupComplete beendet>> "%LOG%"');

    if (st.options.selfDelete) {
      lines.push(
        'REM Skriptordner nach Abschluss entfernen (loescht sich selbst)',
        'cd /d "%SystemDrive%\\"',
        '(goto) 2>nul & (if /i "%~dp0"=="%SystemRoot%\\Setup\\Scripts\\" rd /s /q "%SystemRoot%\\Setup\\Scripts")'
      );
    }
    lines.push('exit /b 0', '');
    return toCRLF(lines.join('\n'));
  }

  /* ---------- Install.ps1 ---------- */

  function moduleList(st, phase) {
    const mods = [];
    if (st.tweaks.enabled && st.tweaks.phase === phase && st.tweaks.selected.length) mods.push(['Set-Tweaks.ps1', 'System-Tweaks']);
    if (st.bloat.enabled && st.bloat.phase === phase && st.bloat.selected.length) mods.push(['Remove-Bloatware.ps1', 'Bloatware entfernen']);
    if (st.office.enabled && st.office.phase === phase) mods.push(['Install-Office.ps1', 'Microsoft Office (ODT)']);
    if (st.apps.enabled && st.apps.phase === phase && st.apps.items.some((p) => p.enabled)) mods.push(['Install-Apps.ps1', 'Anwendungen']);
    if (st.files.items.some((f) => f.enabled && f.dest !== 'scripts' && f.phase === phase && f.run)) {
      mods.push([phase === 'setup' ? 'Install-Files-P1.ps1' : 'Install-Files-P2.ps1', 'Eigene Installer']);
    }
    if (st.custom.psEnabled && st.custom.psPhase === phase && st.custom.ps.trim()) mods.push(['Invoke-Custom.ps1', 'Eigene PowerShell-Befehle']);
    return mods;
  }

  function installMain(st) {
    const setupMods = moduleList(st, 'setup');
    const logonMods = moduleList(st, 'firstlogon');
    const needPhase2 = logonMods.length > 0;
    const taskName = 'OEM-Setup-Phase2';
    const root = st.paths.installRoot.replace(/\\+$/, '');

    const fmt = (mods) => mods.length
      ? mods.map((m) => '        @{ Script = ' + psq(m[0]) + '; Title = ' + psq(m[1]) + ' }').join(NL)
      : '';

    let s = banner('Steuerskript - ruft die einzelnen Module phasenabhaengig auf.', st.meta.name);
    s += toCRLF(`
[CmdletBinding()]
param(
    [ValidateSet('Setup','FirstLogon','Manual')]
    [string]$Phase = 'Manual',
    [string[]]$Only,
    [switch]$Force
)

$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
. (Join-Path $scriptRoot 'Lib\\OEM-Common.ps1')
Initialize-OemLog -Name ('Install-' + $Phase)
`);

    if (st.options.transcript) {
      s += toCRLF(`
$transcript = Join-Path $Global:OemLogDir ('Transcript-' + $Phase + '.log')
try { Start-Transcript -Path $transcript -Append -Force | Out-Null } catch { }
`);
    }

    s += toCRLF(`
Write-Log ('==================================================================')
Write-Log ('OEM Setup - Projekt ' + ${psq(st.meta.name)})
Write-Log ('Phase       : ' + $Phase)
Write-Log ('Computer    : ' + $env:COMPUTERNAME)
Write-Log ('Kontext     : ' + [Security.Principal.WindowsIdentity]::GetCurrent().Name)
Write-Log ('Administrator: ' + (Test-OemAdmin))
Write-Log ('==================================================================')

<#  Mehrfachausfuehrung verhindern: die Phasen koennen ueber mehrere Ausloeser
    angestossen werden (SetupComplete.cmd, autounattend.xml, geplante Aufgabe).
    Der Mutex serialisiert parallele Starts, die Registry-Markierung verhindert
    die inhaltliche Wiederholung. #>
$markerKey = 'HKLM:\\SOFTWARE\\OEM-Setup'
$markerName = 'Phase_' + $Phase

$mutex = $null
$hasLock = $false
try {
    $mutex = New-Object System.Threading.Mutex($false, 'Global\\OEM-Setup-Install')
    Write-Log 'Warte auf exklusiven Zugriff ...' -Level Debug
    $hasLock = $mutex.WaitOne([TimeSpan]::FromMinutes(120))
    if (-not $hasLock) { Write-Log 'Zeitueberschreitung beim Warten auf einen parallelen Lauf.' -Level Warn }
} catch [System.Threading.AbandonedMutexException] {
    $hasLock = $true
    Write-Log 'Vorheriger Lauf wurde abgebrochen - uebernehme die Sperre.' -Level Warn
} catch {
    Write-Log ('Sperre nicht verfuegbar: ' + $_.Exception.Message) -Level Warn
}

if ($Phase -ne 'Manual' -and -not $Force) {
    $done = $null
    try { $done = (Get-ItemProperty -Path $markerKey -Name $markerName -ErrorAction Stop).$markerName } catch { }
    if ($done) {
        Write-Log ('Phase ' + $Phase + ' lief bereits am ' + $done + ' - wird uebersprungen (-Force erzwingt die Wiederholung).') -Level Warn
        if ($hasLock -and $mutex) { $mutex.ReleaseMutex() }
        exit 0
    }
}

$setupSteps = @(
${fmt(setupMods)}
)
$logonSteps = @(
${fmt(logonMods)}
)

$steps = switch ($Phase) {
    'Setup'      { $setupSteps }
    'FirstLogon' { $logonSteps }
    default      { @($setupSteps) + @($logonSteps) }
}
if ($Only) { $steps = $steps | Where-Object { $Only -contains $_.Script } }

$results = @()
foreach ($step in $steps) {
    if (-not $step) { continue }
    $path = Join-Path $scriptRoot ('Modules\\' + $step.Script)
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Log ('Modul fehlt: ' + $step.Script) -Level Warn
        continue
    }
    $ok = Invoke-Step -Name $step.Title -Body { & $path }
    $results += [pscustomobject]@{ Modul = $step.Title; Erfolg = $ok }
}

Write-Log '--- Zusammenfassung'
foreach ($r in $results) {
    Write-Log ('{0,-32} {1}' -f $r.Modul, $(if ($r.Erfolg) { 'OK' } else { 'FEHLER' }))
}

try {
    if (-not (Test-Path -LiteralPath $markerKey)) { New-Item -Path $markerKey -Force | Out-Null }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    New-ItemProperty -Path $markerKey -Name $markerName -PropertyType String -Force -Value $stamp | Out-Null
    New-ItemProperty -Path $markerKey -Name 'Projekt' -PropertyType String -Force -Value ${psq(st.meta.name)} | Out-Null
} catch {
    Write-Log ('Statusmarkierung nicht gesetzt: ' + $_.Exception.Message) -Level Warn
}
`);

    if (needPhase2) {
      const args = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + root + '\\Install.ps1" -Phase FirstLogon';
      if (st.options.phase2Runner === 'task') {
        s += toCRLF(`
if ($Phase -eq 'Setup') {
    Invoke-Step -Name 'Phase 2 einplanen (geplante Aufgabe)' -Body {
        $action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ${psq(args)}
        $trigger   = New-ScheduledTaskTrigger -AtLogOn
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)
        Register-ScheduledTask -TaskName ${psq(taskName)} -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
    } | Out-Null
}

if ($Phase -eq 'FirstLogon') {
    Unregister-ScheduledTask -TaskName ${psq(taskName)} -Confirm:$false -ErrorAction SilentlyContinue
}
`);
      } else {
        s += toCRLF(`
if ($Phase -eq 'Setup') {
    Invoke-Step -Name 'Phase 2 einplanen (RunOnce)' -Body {
        $runOnce = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'
        Set-ItemProperty -Path $runOnce -Name 'OEMSetupPhase2' -Value ('powershell.exe ' + ${psq(args)}) -Force
    } | Out-Null
}
`);
      }
    }

    s += toCRLF(`
if ($Phase -eq 'FirstLogon' -or $Phase -eq 'Manual') {
`);
    if (st.options.toastOnFinish) {
      s += toCRLF(`    try {
        $msg = 'Die automatische Einrichtung ist abgeschlossen. Protokolle: ' + $Global:OemLogDir
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show($msg, 'OEM Setup', 'OK', 'Information') | Out-Null
    } catch { }
`);
    }
    if (!st.options.cleanupInstall) {
      s += toCRLF(`    Write-Log 'Installationsordner bleibt erhalten.'
`);
    } else {
      s += toCRLF(`    Write-Log 'Raeume Installationsdateien auf (Protokolle bleiben erhalten).'
    Get-ChildItem -LiteralPath $Global:OemRoot -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -ne 'Logs' } |
        Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
`);
    }
    if (st.options.finish === 'reboot') {
      s += toCRLF(`    Write-Log 'Neustart in 30 Sekunden.'
    Start-Process shutdown.exe -ArgumentList '/r','/t','30','/c','"OEM Setup abgeschlossen"' -WindowStyle Hidden
`);
    } else if (st.options.finish === 'shutdown') {
      s += toCRLF(`    Write-Log 'Herunterfahren in 30 Sekunden.'
    Start-Process shutdown.exe -ArgumentList '/s','/t','30','/c','"OEM Setup abgeschlossen"' -WindowStyle Hidden
`);
    }
    s += toCRLF(`}

if ($hasLock -and $mutex) {
    try { $mutex.ReleaseMutex() } catch { }
}

Write-Log ('OEM Setup Phase ' + $Phase + ' beendet.')
`);
    if (st.options.transcript) s += toCRLF(`try { Stop-Transcript | Out-Null } catch { }` + '\n');
    s += toCRLF(`exit 0
`);
    return s;
  }

  /* ---------- Modules/Install-Apps.ps1 ---------- */

  function bootstrapHeader(name) {
    return toCRLF(`
if (-not (Get-Command Write-Log -ErrorAction SilentlyContinue)) {
    . (Join-Path (Split-Path -Parent $PSScriptRoot) 'Lib\\OEM-Common.ps1')
    Initialize-OemLog -Name ${psq(name)}
}
`);
  }

  function appsModule(st) {
    const opts = st.apps;
    const pkgs = opts.items.filter((p) => p.enabled && p.id);
    const managers = Array.from(new Set(pkgs.map((p) => p.manager)));

    let s = banner('Installiert die Anwendungen ueber die jeweiligen Paketmanager.', st.meta.name);
    s += bootstrapHeader('Install-Apps');

    s += toCRLF(`
$SuccessCodes = @(0, 3010, 1641, -1978335135, -1978335189, -1978335212)
$MaxRetries   = ${opts.retries}
`);

    if (opts.waitNetwork) s += toCRLF(`
if (-not (Wait-OemNetwork -TimeoutSeconds 600)) {
    Write-Log 'Ohne Netzwerk koennen keine Pakete installiert werden.' -Level Error
    return
}
`);

    if (managers.includes('winget')) {
      s += toCRLF(`
$winget = Resolve-Winget
`);
      if (opts.bootstrap) s += toCRLF(`if (-not $winget) { $winget = Install-WingetBootstrap }
`);
      s += toCRLF(`if (-not $winget) {
    Write-Log 'winget.exe wurde nicht gefunden - WinGet-Pakete werden uebersprungen.' -Level Error
} else {
    Write-Log ('winget: ' + $winget)
}
`);
      if (opts.sourceUpdate) s += toCRLF(`
if ($winget) {
    try { & $winget source update --disable-interactivity | Out-Null } catch { Write-Log 'winget source update fehlgeschlagen.' -Level Warn }
}
`);
    }

    if (managers.includes('chocolatey')) {
      s += toCRLF(`
if (-not (Get-Command choco.exe -ErrorAction SilentlyContinue)) {
    Write-Log 'Chocolatey wird installiert ...'
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Set-ExecutionPolicy Bypass -Scope Process -Force
        Invoke-Expression ((New-Object Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
        $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
    } catch { Write-Log ('Chocolatey-Installation fehlgeschlagen: ' + $_.Exception.Message) -Level Error }
}
`);
    }

    if (opts.method === 'import' && managers.includes('winget')) {
      s += toCRLF(`
$importFile = Join-Path $Global:OemRoot 'Apps\\packages.json'
if ($winget -and (Test-Path -LiteralPath $importFile)) {
    Write-Log 'Starte winget import ...'
    & $winget import --import-file "$importFile" --accept-package-agreements --accept-source-agreements --disable-interactivity --ignore-unavailable
    Write-Log ('winget import beendet mit Exitcode ' + $LASTEXITCODE)
}
`);
    }

    /* Einzelbefehle */
    const rows = pkgs
      .filter((p) => !(opts.method === 'import' && p.manager === 'winget'))
      .map((p) => {
        const mgr = Catalog.MANAGERS[p.manager] || Catalog.MANAGERS.winget;
        const argStr = mgr.install(p, opts);
        const argArr = argStr.match(/"[^"]*"|\S+/g) || [];
        return '    [pscustomobject]@{ Name = ' + psq(p.name || p.id) + '; Id = ' + psq(p.id) +
          '; Manager = ' + psq(p.manager) + '; Arguments = @(' + argArr.map((a) => psq(a.replace(/^"|"$/g, ''))).join(', ') + ') }';
      });

    if (rows.length) {
      s += toCRLF(`
$packages = @(
${rows.join(NL)}
)

Write-Log ('Zu installierende Pakete: ' + $packages.Count)
$failed = @()
$index  = 0

foreach ($pkg in $packages) {
    $index++
    $exe = switch ($pkg.Manager) {
        'winget'     { $winget }
        'chocolatey' { 'choco.exe' }
        'scoop'      { 'scoop.cmd' }
        'npm'        { 'npm.cmd' }
        'pip'        { 'pip.exe' }
        'cargo'      { 'cargo.exe' }
        'dotnet'     { 'dotnet.exe' }
        default      { $null }
    }
    if (-not $exe) {
        Write-Log ('Kein Paketmanager fuer {0} ({1}) - uebersprungen.' -f $pkg.Name, $pkg.Manager) -Level Warn
        $failed += $pkg.Name
        continue
    }

    Write-Log ('[{0}/{1}] {2} ({3})' -f $index, $packages.Count, $pkg.Name, $pkg.Id) -Level Step
    $ok = $false
    for ($try = 0; $try -le $MaxRetries -and -not $ok; $try++) {
        if ($try -gt 0) {
            Write-Log ('Wiederholung {0} fuer {1}' -f $try, $pkg.Name) -Level Warn
            Start-Sleep -Seconds (5 * $try)
        }
        try {
            $output = & $exe $pkg.Arguments 2>&1
            $code = $LASTEXITCODE
            if ($null -eq $code) { $code = 0 }
            $ok = $SuccessCodes -contains $code
            if (-not $ok) {
                Write-Log ('Exitcode {0}: {1}' -f $code, (($output | Select-Object -Last 3) -join ' | ')) -Level Warn
            }
        } catch {
            Write-Log ('Fehler bei {0}: {1}' -f $pkg.Name, $_.Exception.Message) -Level Warn
        }
    }
    if ($ok) { Write-Log ('OK: ' + $pkg.Name) } else { Write-Log ('FEHLGESCHLAGEN: ' + $pkg.Name) -Level Error; $failed += $pkg.Name }
}

if ($failed.Count -gt 0) {
    Write-Log ('Nicht installiert: ' + ($failed -join ', ')) -Level Error
    $failed | Set-Content -LiteralPath (Join-Path $Global:OemLogDir 'apps-fehlgeschlagen.txt') -Encoding UTF8
} else {
    Write-Log 'Alle Pakete erfolgreich verarbeitet.'
}
`);
    }
    return s;
  }

  /* ---------- Modules/Install-Office.ps1 ---------- */

  function officeModule(st) {
    let s = banner('Installiert Microsoft Office ueber das Office Deployment Tool.', st.meta.name);
    s += bootstrapHeader('Install-Office');
    s += toCRLF(`
$officeDir = Join-Path $Global:OemRoot 'Office'
$setupExe  = Join-Path $officeDir 'setup.exe'
$configXml = Join-Path $officeDir 'Configuration.xml'

if (-not (Test-Path -LiteralPath $configXml)) {
    Write-Log 'Configuration.xml fehlt - Office wird uebersprungen.' -Level Error
    return
}
`);
    if (st.office.setupSource === 'download') {
      s += toCRLF(`
if (-not (Test-Path -LiteralPath $setupExe)) {
    if (-not (Wait-OemNetwork -TimeoutSeconds 600)) { Write-Log 'Kein Netzwerk fuer ODT-Download.' -Level Error; return }
    Write-Log 'Lade Office Deployment Tool ...'
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        New-Item -Path $officeDir -ItemType Directory -Force | Out-Null
        Invoke-WebRequest -Uri ${psq(st.office.odtUrl)} -OutFile $setupExe -UseBasicParsing -ErrorAction Stop
    } catch {
        Write-Log ('Download fehlgeschlagen: ' + $_.Exception.Message) -Level Error
        return
    }
}
`);
    }
    s += toCRLF(`
if (-not (Test-Path -LiteralPath $setupExe)) {
    Write-Log ('setup.exe (ODT) fehlt unter ' + $setupExe) -Level Error
    return
}
`);
    if (st.office.checkInstalled) {
      s += toCRLF(`
$installed = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Office\\ClickToRun\\Configuration' -ErrorAction SilentlyContinue
if ($installed -and $installed.ProductReleaseIds) {
    Write-Log ('Office ist bereits vorhanden: ' + $installed.ProductReleaseIds)
    return
}
`);
    }
    s += toCRLF(`
Write-Log 'Starte Office-Installation (kann einige Minuten dauern) ...'
$res = Invoke-OemProcess -FilePath $setupExe -Arguments @('/configure', $configXml) -SuccessCodes @(0, 3010, 1641) -TimeoutSeconds 7200
if ($res.Success) {
    Write-Log 'Office-Installation abgeschlossen.'
} else {
    Write-Log ('Office-Installation meldete Exitcode ' + $res.ExitCode) -Level Error
}
`);
    return s;
  }

  /* ---------- Modules/Set-Tweaks.ps1 ---------- */

  function tweaksModule(st) {
    const sel = Catalog.TWEAKS.filter((t) => st.tweaks.selected.includes(t.id));
    let s = banner('Setzt die ausgewaehlten System- und Benutzereinstellungen.', st.meta.name);
    s += bootstrapHeader('Set-Tweaks');

    const needsUser = sel.some((t) => (t.reg || []).some((r) => r.scope === 'user'));
    if (needsUser) {
      s += toCRLF(`
$roots = Open-UserHives${st.tweaks.allUsers ? ' -IncludeExistingProfiles' : ''}
Write-Log ('Benutzer-Registry-Ziele: ' + ($roots -join ', '))

try {
`);
    }

    const pad = needsUser ? '    ' : '';
    const cats = [];
    sel.forEach((t) => { if (!cats.includes(t.cat)) cats.push(t.cat); });

    for (const cat of cats) {
      s += NL + pad + '# ---------- ' + cat + ' ----------' + NL;
      for (const t of sel.filter((x) => x.cat === cat)) {
        s += pad + 'Write-Log ' + psq(t.label) + NL;
        for (const r of (t.reg || [])) {
          s += pad + 'Set-RegValue -Scope ' + (r.scope === 'user' ? 'User' : 'Machine') +
            ' -Path ' + psq(r.path) + ' -Name ' + psq(r.name) +
            ' -Type ' + r.type + ' -Value ' + (typeof r.value === 'number' ? r.value : psq(r.value)) + NL;
        }
        if (t.ps) {
          s += pad + 'try {' + NL;
          s += toCRLF(t.ps).split(NL).map((l) => pad + '    ' + l).join(NL) + NL;
          s += pad + '} catch { Write-Log (' + psq(t.label + ' fehlgeschlagen: ') + ' + $_.Exception.Message) -Level Warn }' + NL;
        }
      }
    }

    if (needsUser) {
      s += toCRLF(`
} finally {
    Close-UserHives
}
`);
    }
    s += toCRLF(`
Write-Log 'Tweaks angewendet.'
`);
    return s;
  }

  /* ---------- Modules/Remove-Bloatware.ps1 ---------- */

  function bloatModule(st) {
    let s = banner('Entfernt vorinstallierte Store-Apps (AppX).', st.meta.name);
    s += bootstrapHeader('Remove-Bloatware');
    s += toCRLF(`
$apps = @(
${psArray(st.bloat.selected, 4)}
)

Write-Log ('Zu entfernende Pakete: ' + $apps.Count)
foreach ($app in $apps) {
    try {
        $installed = Get-AppxPackage -AllUsers -Name $app -ErrorAction SilentlyContinue
        if ($installed) {
            $installed | Remove-AppxPackage -AllUsers -ErrorAction SilentlyContinue
            Write-Log ('Entfernt: ' + $app)
        }
    } catch { Write-Log ('Entfernen fehlgeschlagen: {0} ({1})' -f $app, $_.Exception.Message) -Level Warn }
`);
    if (st.bloat.provisioned) {
      s += toCRLF(`
    try {
        Get-AppxProvisionedPackage -Online -ErrorAction SilentlyContinue |
            Where-Object { $_.DisplayName -eq $app } |
            ForEach-Object {
                Remove-AppxProvisionedPackage -Online -PackageName $_.PackageName -ErrorAction SilentlyContinue | Out-Null
                Write-Log ('Provisioning entfernt: ' + $app)
            }
    } catch { Write-Log ('Provisioning nicht entfernt: ' + $app) -Level Warn }
`);
    }
    s += toCRLF(`}

Write-Log 'Bloatware-Bereinigung abgeschlossen.'
`);
    return s;
  }

  /* ---------- Modules/Install-Files.ps1 ---------- */

  function filesModule(st, phase) {
    const items = st.files.items.filter((f) => f.enabled && f.dest !== 'scripts' && f.run && f.phase === phase);
    let s = banner('Fuehrt mitgelieferte Setup-Dateien aus.', st.meta.name);
    s += bootstrapHeader('Install-Files');
    s += toCRLF(`
$fileDir = Join-Path $Global:OemRoot 'Files'
$items = @(
${items.map((f) => '    [pscustomobject]@{ Name = ' + psq(f.name) + '; Path = ' + psq(f.target) + '; Args = ' + psq(f.run) + ' }').join(NL)}
)

foreach ($item in $items) {
    $full = Join-Path $fileDir $item.Path
    if (-not (Test-Path -LiteralPath $full)) {
        Write-Log ('Datei fehlt: ' + $full) -Level Warn
        continue
    }
    Write-Log ('Installiere ' + $item.Name) -Level Step
    try {
        if ([IO.Path]::GetExtension($full).ToLower() -eq '.msi') {
            $argList = @('/i', ('"' + $full + '"')) + ($item.Args -split ' +' | Where-Object { $_ })
            $res = Invoke-OemProcess -FilePath 'msiexec.exe' -Arguments $argList -SuccessCodes @(0, 3010, 1641)
        } else {
            $argList = @($item.Args -split ' +' | Where-Object { $_ })
            $res = Invoke-OemProcess -FilePath $full -Arguments $argList -SuccessCodes @(0, 3010, 1641)
        }
        if ($res.Success) { Write-Log ('OK: ' + $item.Name) } else { Write-Log ('Exitcode {0}: {1}' -f $res.ExitCode, $item.Name) -Level Error }
    } catch {
        Write-Log ('Fehler bei {0}: {1}' -f $item.Name, $_.Exception.Message) -Level Error
    }
}
`);
    return s;
  }

  /* ---------- Modules/Invoke-Custom.ps1 ---------- */

  function customModule(st) {
    let s = banner('Eigene PowerShell-Befehle.', st.meta.name);
    s += bootstrapHeader('Invoke-Custom');
    s += NL + toCRLF(st.custom.ps.trim()) + NL;
    return s;
  }

  /* ---------- autounattend.xml (Ausloeser unabhaengig von SetupComplete.cmd) ---------- */

  function unattendCommands(st) {
    const root = st.paths.installRoot.replace(/\\+$/, '');
    const ps = (phase) => 'powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' +
      root + '\\Install.ps1" -Phase ' + phase;
    return {
      setup: moduleList(st, 'setup').length ? ps('Setup') : null,
      logon: moduleList(st, 'firstlogon').length ? ps('FirstLogon') : null
    };
  }

  function unattendBlocks(st, indent) {
    const pad = ' '.repeat(indent);
    const cmd = unattendCommands(st);
    const out = [];

    if (cmd.setup) {
      out.push([
        '<settings pass="specialize">',
        '  <component name="Microsoft-Windows-Deployment" processorArchitecture="amd64"',
        '             publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS"',
        '             xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">',
        '    <RunSynchronous>',
        '      <RunSynchronousCommand wcm:action="add">',
        '        <Order>1</Order>',
        '        <Description>OEM Setup Phase 1</Description>',
        '        <Path>' + xmlEsc(cmd.setup) + '</Path>',
        '      </RunSynchronousCommand>',
        '    </RunSynchronous>',
        '  </component>',
        '</settings>'
      ].map((l) => pad + l).join('\n'));
    }

    if (cmd.logon) {
      out.push([
        '<settings pass="oobeSystem">',
        '  <component name="Microsoft-Windows-Shell-Setup" processorArchitecture="amd64"',
        '             publicKeyToken="31bf3856ad364e35" language="neutral" versionScope="nonSxS"',
        '             xmlns:wcm="http://schemas.microsoft.com/WMIConfig/2002/State">',
        '    <FirstLogonCommands>',
        '      <SynchronousCommand wcm:action="add">',
        '        <Order>1</Order>',
        '        <Description>OEM Setup Phase 2</Description>',
        '        <CommandLine>' + xmlEsc(cmd.logon) + '</CommandLine>',
        '        <RequiresUserInput>false</RequiresUserInput>',
        '      </SynchronousCommand>',
        '    </FirstLogonCommands>',
        '  </component>',
        '</settings>'
      ].map((l) => pad + l).join('\n'));
    }
    return out;
  }

  function xmlEsc(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function unattendXml(st) {
    const blocks = unattendBlocks(st, 2);
    return toCRLF([
      '<?xml version="1.0" encoding="utf-8"?>',
      '<!--',
      '    autounattend.xml - erzeugt vom OEM Script Generator, Projekt ' + st.meta.name,
      '',
      '    Diese Datei startet ausschliesslich die Installationsskripte. Sie',
      '    automatisiert das Setup NICHT (keine Partitionierung, kein Ueberspringen',
      '    von OOBE) und kann deshalb gefahrlos zusaetzlich verwendet werden.',
      '',
      '    Ablage: im Wurzelverzeichnis des Installationsmediums als autounattend.xml',
      '',
      '    Hintergrund: Windows Setup fuehrt SetupComplete.cmd NICHT aus, wenn die',
      '    Installation einen Produktschluessel aus dem OEM-Kanal verwendet - etwa den',
      '    im BIOS/UEFI hinterlegten Schluessel eines Markengeraets. Betroffen sind',
      '    Home und Pro; Enterprise und Server sind ausgenommen. Die hier verwendeten',
      '    Ausloeser (specialize und FirstLogonCommands) sind davon unabhaengig.',
      '-->',
      '<unattend xmlns="urn:schemas-microsoft-com:unattend">',
      blocks.join('\n'),
      '</unattend>'
    ].join('\n') + '\n');
  }

  function unattendSnippet(st) {
    return toCRLF([
      'Zum Einfuegen in eine bereits vorhandene autounattend.xml.',
      '',
      'Die folgenden <settings>-Bloecke direkt unterhalb von <unattend ...> einfuegen.',
      'Existiert der jeweilige Pass bereits, nur den <component>-Teil uebernehmen bzw.',
      'die Befehle mit fortlaufender <Order> in den vorhandenen Block ergaenzen.',
      '',
      '--------------------------------------------------------------------------',
      ''
    ].join('\n') + unattendBlocks(st, 0).join('\n\n') + '\n');
  }

  /* ---------- Diagnose.ps1 ---------- */

  function diagnoseScript(st) {
    const root = st.paths.installRoot.replace(/\\+$/, '');
    return banner('Prueft nach der Installation, warum die Skripte nicht gelaufen sind.', st.meta.name) + toCRLF(`
$ErrorActionPreference = 'SilentlyContinue'

function Show-Head { param([string]$Text) Write-Host ''; Write-Host ('=== ' + $Text) -ForegroundColor Cyan }
function Join-OemPath {
    # providerunabhaengig: scheitert nicht, wenn das Laufwerk nicht existiert
    param([string]$Base, [string]$Leaf)
    return [IO.Path]::Combine($Base, $Leaf)
}

function Show-Item {
    param([string]$Label, $Ok, [string]$Info)
    $Ok = [bool]$Ok
    $mark = if ($Ok) { '[ ok ]' } else { '[fehlt]' }
    $color = if ($Ok) { 'Green' } else { 'Red' }
    Write-Host ($mark.PadRight(8)) -ForegroundColor $color -NoNewline
    Write-Host ($Label.PadRight(46)) -NoNewline
    Write-Host $Info -ForegroundColor DarkGray
}

$root = ${psq(root)}
Write-Host ('OEM Setup - Diagnose   (' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ')') -ForegroundColor White

Show-Head 'Dateien auf dem Zielsystem'
Show-Item 'Installationsordner' (Test-Path $root) $root
Show-Item 'Install.ps1' (Test-Path (Join-OemPath $root 'Install.ps1')) (Join-OemPath $root 'Install.ps1')
$modCount = @(Get-ChildItem (Join-OemPath $root 'Modules') -Filter *.ps1 -ErrorAction SilentlyContinue).Count
Show-Item 'Modules-Ordner' (Test-Path (Join-OemPath $root 'Modules')) ("$modCount Module")
$sc = Join-OemPath $env:SystemRoot 'Setup\\Scripts\\SetupComplete.cmd'
Show-Item 'SetupComplete.cmd' (Test-Path $sc) $sc
if (-not (Test-Path $sc)) {
    Write-Host '         Hinweis: die Datei loescht sich nach erfolgreichem Lauf selbst,' -ForegroundColor DarkGray
    Write-Host '         sofern diese Option aktiv war.' -ForegroundColor DarkGray
}

Show-Head 'Ausfuehrungsstatus (Registry-Marker)'
$marker = Get-ItemProperty 'HKLM:\\SOFTWARE\\OEM-Setup' -ErrorAction SilentlyContinue
if ($marker) {
    foreach ($n in @('Phase_Setup','Phase_FirstLogon','Phase_Manual','Projekt')) {
        if ($marker.PSObject.Properties.Name -contains $n) {
            Show-Item $n $true $marker.$n
        } else {
            Show-Item $n $false 'nie gelaufen'
        }
    }
} else {
    Write-Host '  Kein Marker vorhanden - Install.ps1 wurde noch nie ausgefuehrt.' -ForegroundColor Yellow
}

Show-Head 'Protokolle'
$logDir = Join-OemPath $root 'Logs'
if (Test-Path $logDir) {
    Get-ChildItem $logDir -File | Sort-Object LastWriteTime -Descending |
        ForEach-Object { Write-Host ('  {0,-34} {1,9:n0} Bytes   {2}' -f $_.Name, $_.Length, $_.LastWriteTime) }
} else {
    Write-Host '  Kein Logverzeichnis - es lief nichts.' -ForegroundColor Yellow
}

Show-Head 'Phase 2 (geplante Aufgabe / RunOnce)'
$task = Get-ScheduledTask -TaskName 'OEM-Setup-Phase2' -ErrorAction SilentlyContinue
if ($task) {
    $info = Get-ScheduledTaskInfo -TaskName 'OEM-Setup-Phase2' -ErrorAction SilentlyContinue
    Show-Item 'Geplante Aufgabe' $true ($task.State.ToString() + ', letzter Lauf: ' + $info.LastRunTime + ', Ergebnis: ' + $info.LastTaskResult)
} else {
    Show-Item 'Geplante Aufgabe' $false 'nicht registriert'
}
$ro = Get-ItemProperty 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce' -Name 'OEMSetupPhase2' -ErrorAction SilentlyContinue
Show-Item 'RunOnce-Eintrag' ($null -ne $ro) $(if ($ro) { $ro.OEMSetupPhase2 } else { 'nicht vorhanden (nach dem Lauf normal)' })

Show-Head 'Wurde SetupComplete.cmd von Windows Setup blockiert?'
$panther = @(
    (Join-OemPath $env:SystemRoot 'Panther\\setupact.log'),
    (Join-OemPath $env:SystemRoot 'Panther\\UnattendGC\\setupact.log')
)
$hits = @()
foreach ($log in $panther) {
    if (Test-Path $log) {
        $hits += Select-String -Path $log -Pattern 'SetupComplete' -SimpleMatch -ErrorAction SilentlyContinue
    }
}
if ($hits.Count -eq 0) {
    Write-Host '  Keine Eintraege zu SetupComplete in den Setup-Protokollen gefunden.' -ForegroundColor Yellow
} else {
    $hits | Select-Object -Last 12 | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) -ForegroundColor DarkGray }
    if ($hits | Where-Object { $_.Line -match 'will not run SetupComplete' }) {
        Write-Host ''
        Write-Host '  >>> Windows Setup hat SetupComplete.cmd bewusst uebersprungen.' -ForegroundColor Red
        Write-Host '      Ursache: Produktschluessel aus dem OEM-Kanal bei einer Client-Edition.' -ForegroundColor Red
        Write-Host '      Loesung: die mitgelieferte autounattend.xml als Ausloeser verwenden.' -ForegroundColor Yellow
    }
}

Show-Head 'Konfigurationssatz / $OEM$'
$panth = Join-OemPath $env:SystemRoot 'Panther\\unattend.xml'
if (Test-Path $panth) {
    $ua = Get-Content $panth -Raw
    $ucs = $ua -match '<UseConfigurationSet>\\s*true\\s*</UseConfigurationSet>'
    Show-Item 'Antwortdatei verwendet' $true $panth
    Show-Item 'UseConfigurationSet = true' $ucs $(if ($ucs) { '$OEM$ gehoert ins WURZELVERZEICHNIS des Mediums' } else { '$OEM$ gehoert nach sources\\' })
} else {
    Write-Host '  C:\\Windows\\Panther\\unattend.xml nicht vorhanden.' -ForegroundColor DarkGray
    Write-Host '  (Manche Antwortdateien loeschen sie am Ende selbst.)' -ForegroundColor DarkGray
}
$oemHits = @()
foreach ($log in $panther) {
    if (Test-Path $log) { $oemHits += Select-String -Path $log -Pattern 'OEM\\$|configuration set' -ErrorAction SilentlyContinue }
}
if ($oemHits.Count -gt 0) {
    $oemHits | Select-Object -Last 6 | ForEach-Object { Write-Host ('  ' + $_.Line.Trim()) -ForegroundColor DarkGray }
}

Show-Head 'Lizenzkanal (entscheidet ueber die Sperre)'
Write-Host ('  Edition: ' + (Get-CimInstance Win32_OperatingSystem).Caption)
Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like 'Windows*' } |
    ForEach-Object {
        $channel = $_.ProductKeyChannel
        if (-not $channel) { $channel = $_.Description }
        Write-Host ('  Kanal  : ' + $channel)
        if ($channel -match 'OEM') {
            Write-Host '  >>> OEM-Kanal erkannt: SetupComplete.cmd wird bei Home/Pro nicht ausgefuehrt.' -ForegroundColor Red
        }
    }

Show-Head 'Naechster Schritt'
Write-Host ('  Manuell nachholen:  powershell -ExecutionPolicy Bypass -File "' + (Join-OemPath $root 'Install.ps1') + '" -Phase Manual -Force')
Write-Host ('  Nur Phase 1:        powershell -ExecutionPolicy Bypass -File "' + (Join-OemPath $root 'Install.ps1') + '" -Phase Setup -Force')
Write-Host ''
`);
  }

  /* ---------- Paketlisten ---------- */

  function wingetImportJson(st) {
    const pkgs = st.apps.items.filter((p) => p.enabled && p.manager === 'winget' && p.id);
    const obj = {
      '$schema': 'https://aka.ms/winget-packages.schema.2.0.json',
      CreationDate: new Date().toISOString(),
      Sources: [{
        Packages: pkgs.map((p) => {
          const e = { PackageIdentifier: p.id };
          if (st.apps.pinVersions && p.version && /^[0-9]/.test(p.version)) e.Version = p.version;
          return e;
        }),
        SourceDetails: {
          Argument: 'https://cdn.winget.microsoft.com/cache',
          Identifier: 'Microsoft.Winget.Source_8wekyb3d8bbwe',
          Name: 'winget',
          Type: 'Microsoft.PreIndexed.Package'
        }
      }],
      WinGetVersion: '1.9.0'
    };
    return JSON.stringify(obj, null, 2);
  }

  function ubundleJson(st) {
    return JSON.stringify({
      export_version: 3,
      packages: st.apps.items.filter((p) => p.enabled && p.id).map((p) => ({
        Id: p.id,
        Name: p.name || p.id,
        Version: p.version || '',
        Source: p.source || (p.manager === 'winget' ? 'winget' : p.manager),
        ManagerName: p.manager === 'winget' ? 'Winget' : p.manager
      })),
      incompatible_packages_info: 'Erzeugt vom OEM Script Generator.',
      incompatible_packages: []
    }, null, 2);
  }

  function appsCsv(st) {
    const head = 'Aktiv;Name;Id;Manager;Version;Quelle;Zusatzargumente';
    const rows = st.apps.items.map((p) => [
      p.enabled ? 'ja' : 'nein', p.name, p.id, p.manager, p.version, p.source, p.args
    ].map((v) => String(v || '').replace(/;/g, ',')).join(';'));
    return toCRLF([head].concat(rows).join('\n'));
  }

  /* ---------- LIESMICH ---------- */

  function readme(st, files) {
    const zipRoot = st.paths.zipRoot === 'oem' ? '$OEM$'
      : st.paths.zipRoot === 'both' ? 'sources\\$OEM$ UND $OEM$' : 'sources\\$OEM$';
    const setupMods = moduleList(st, 'setup').map((m) => m[1]);
    const logonMods = moduleList(st, 'firstlogon').map((m) => m[1]);
    const lines = [
      '===================================================================',
      ' OEM Script Generator - Projekt: ' + st.meta.name,
      ' Erzeugt am ' + new Date().toLocaleString('de-DE'),
      '===================================================================',
      '',
      'VERWENDUNG',
      '----------',
      '1. Windows-11-ISO entpacken bzw. USB-Stick mit dem Installationsmedium erstellen.',
      (st.options.trigger !== 'setupcomplete'
        ? '2. autounattend.xml aus diesem Archiv in das WURZELVERZEICHNIS des Mediums legen\n' +
          '   (neben sources\\ und boot\\). Existiert dort bereits eine autounattend.xml,\n' +
          '   die Bloecke aus autounattend-Einfuegen.txt in die vorhandene Datei uebernehmen.\n' +
          '2b. Den Ordner "' + zipRoot + '" ebenfalls in das Wurzelverzeichnis kopieren,'
        : '2. Den Ordner "' + zipRoot + '" aus diesem Archiv in das Wurzelverzeichnis des'),
      '   Mediums kopieren, so dass folgender Pfad existiert:',
      '      <Medium>\\sources\\$OEM$\\$$\\Setup\\Scripts\\SetupComplete.cmd',
      '      <Medium>\\sources\\$OEM$\\$1\\' + relFromRoot(st.paths.installRoot) + '\\Install.ps1',
      '3. Fehlende Binaerdateien ergaenzen (siehe Abschnitt "Noch zu ergaenzen").',
      '4. Installation wie gewohnt starten. Windows kopiert $1 nach ' +
      st.paths.installRoot.replace(/\\+$/, '') + ' und $$ nach %WINDIR%.',
      '',
      'WO GEHOERT $OEM$ HIN?',
      '---------------------',
      'Das haengt von der Antwortdatei ab:',
      '',
      ' * ohne autounattend.xml oder mit UseConfigurationSet = false:',
      '     <Medium>\\sources\\$OEM$\\...',
      ' * mit <UseConfigurationSet>true</UseConfigurationSet> in der autounattend.xml:',
      '     Setup sucht den Konfigurationssatz NEBEN der Antwortdatei, also',
      '     <Medium>\\$OEM$\\...   (Wurzelverzeichnis, nicht sources\\)',
      '',
      'Wer beides bestueckt, ist auf der sicheren Seite - Setup wertet nur den',
      'passenden Ort aus, der andere Ordner wird ignoriert. Genau dafuer gibt es im',
      'Generator die ZIP-Wurzel-Einstellung "beide Orte".',
      '',
      'In jedem Fall gilt: $OEM$ wird nur ausgewertet, wenn die Installation von',
      'diesem Medium gestartet wird.',
      '',
      'AUSLOESER',
      '---------',
      (st.options.trigger === 'setupcomplete'
        ? 'Nur SetupComplete.cmd.'
        : st.options.trigger === 'unattend'
          ? 'Nur autounattend.xml (specialize und FirstLogonCommands).'
          : 'SetupComplete.cmd UND autounattend.xml - doppelt abgesichert.'),
      '',
      'Wichtig: Windows Setup fuehrt SetupComplete.cmd NICHT aus, wenn die Installation',
      'einen Produktschluessel aus dem OEM-Kanal verwendet - zum Beispiel den im',
      'BIOS/UEFI hinterlegten Schluessel eines Markengeraets. Betroffen sind die',
      'Client-Editionen (Home, Pro); Enterprise und Windows Server sind ausgenommen.',
      'Auf solchen Geraeten laeuft nur die autounattend.xml zuverlaessig.',
      '',
      'Mehrfachausfuehrung ist unschaedlich: Install.ps1 vermerkt jede abgeschlossene',
      'Phase unter HKLM\\SOFTWARE\\OEM-Setup und ueberspringt sie beim naechsten Aufruf.',
      'Mit -Force laesst sich eine Phase erneut ausfuehren.',
      '',
      'ABLAUF',
      '------',
      'Phase 1 (' + (st.options.trigger === 'unattend' ? 'autounattend.xml, specialize-Pass' : 'SetupComplete.cmd') + ', Kontext SYSTEM, vor der ersten Anmeldung):',
      setupMods.length ? setupMods.map((m) => '   - ' + m).join('\n') : '   - keine Module',
      '',
      'Phase 2 (' + (st.options.phase2Runner === 'task' ? 'geplante Aufgabe als SYSTEM' : 'RunOnce im Benutzerkontext') + ', nach der ersten Anmeldung):',
      logonMods.length ? logonMods.map((m) => '   - ' + m).join('\n') : '   - keine Module',
      '',
      'Protokolle: ' + st.paths.installRoot.replace(/\\+$/, '') + '\\Logs',
      '',
      'FEHLERSUCHE',
      '-----------',
      'Auf dem installierten System in einer administrativen PowerShell:',
      '   powershell -ExecutionPolicy Bypass -File ' + st.paths.installRoot + '\\Diagnose.ps1',
      'Das Skript prueft die Dateien, den Ausfuehrungsstatus, die geplante Aufgabe und',
      'wertet die Windows-Setup-Protokolle aus - inklusive der Frage, ob Setup die',
      'Ausfuehrung von SetupComplete.cmd wegen des OEM-Lizenzkanals verweigert hat.',
      '',
      'MANUELLER TEST',
      '--------------',
      'Auf einem Testsystem in einer administrativen PowerShell:',
      '   powershell -ExecutionPolicy Bypass -File ' + st.paths.installRoot + '\\Install.ps1 -Phase Manual',
      'Einzelnes Modul:',
      '   powershell -ExecutionPolicy Bypass -File ' + st.paths.installRoot + '\\Install.ps1 -Phase Manual -Only Set-Tweaks.ps1',
      'Bereits gelaufene Phase wiederholen:  ... -Phase Setup -Force',
      '',
      'NOCH ZU ERGAENZEN',
      '-----------------'
    ];

    const todo = [];
    if (st.office.enabled && st.office.setupSource === 'bundled') {
      todo.push('setup.exe des Office Deployment Tools nach ' + zipRoot + '\\$1\\' +
        relFromRoot(st.paths.installRoot) + '\\Office\\setup.exe kopieren.');
    }
    st.files.items.filter((f) => f.enabled && !f.blobPresent).forEach((f) => {
      todo.push('Datei "' + f.name + '" fehlt im Archiv und muss manuell nach ' +
        (f.dest === 'scripts' ? '$OEM$\\$$\\Setup\\Scripts\\' : 'Files\\') + f.target + ' kopiert werden.');
    });
    if (!todo.length) todo.push('Nichts - das Archiv ist vollstaendig.');
    lines.push(todo.map((t) => ' * ' + t).join('\n'));

    lines.push('', 'ENTHALTENE DATEIEN', '------------------');
    files.forEach((f) => lines.push(' ' + f.path));
    lines.push('');
    return toCRLF(lines.join('\n'));
  }

  /* ---------- Gesamtaufbau ---------- */

  function build(st) {
    const rel = relFromRoot(st.paths.installRoot);
    const base = st.paths.zipRoot === 'oem' ? '$OEM$' : 'sources/$OEM$';
    const mirror = st.paths.zipRoot === 'both' ? '$OEM$' : null;
    const inst = base + '/$1/' + rel;
    const files = [];
    const add = (path, data, binary) => {
      if (!binary && /\.ps1$/i.test(path) && data.charCodeAt(0) !== 0xFEFF) data = '\uFEFF' + data;
      files.push({ path, data, binary: !!binary });
    };

    const trigger = st.options.trigger || 'both';
    if (trigger !== 'unattend') add(base + '/$$/Setup/Scripts/SetupComplete.cmd', setupComplete(st));
    if (trigger !== 'setupcomplete') {
      const imported = st.unattend && st.unattend.xml;
      if (imported) {
        try {
          const res = Importers.patchUnattend(imported, unattendCommands(st));
          add('autounattend.xml', res.xml);
        } catch (e) {
          add('autounattend-FEHLER.txt', toCRLF(
            'Die importierte autounattend.xml konnte nicht ergaenzt werden:\n' + e.message +
            '\n\nBitte die Bloecke aus autounattend-Einfuegen.txt von Hand uebernehmen.\n'));
        }
      } else {
        add('autounattend.xml', unattendXml(st));
      }
      add('autounattend-Einfuegen.txt', unattendSnippet(st));
    }
    add(inst + '/Install.ps1', installMain(st));
    add(inst + '/Lib/OEM-Common.ps1', libCommon(st));
    add(inst + '/Diagnose.ps1', diagnoseScript(st));

    const setupMods = moduleList(st, 'setup').map((m) => m[0]);
    const logonMods = moduleList(st, 'firstlogon').map((m) => m[0]);
    const all = new Set(setupMods.concat(logonMods));

    if (all.has('Set-Tweaks.ps1')) add(inst + '/Modules/Set-Tweaks.ps1', tweaksModule(st));
    if (all.has('Remove-Bloatware.ps1')) add(inst + '/Modules/Remove-Bloatware.ps1', bloatModule(st));
    if (all.has('Install-Office.ps1')) add(inst + '/Modules/Install-Office.ps1', officeModule(st));
    if (all.has('Install-Apps.ps1')) add(inst + '/Modules/Install-Apps.ps1', appsModule(st));
    if (all.has('Install-Files-P1.ps1')) add(inst + '/Modules/Install-Files-P1.ps1', filesModule(st, 'setup'));
    if (all.has('Install-Files-P2.ps1')) add(inst + '/Modules/Install-Files-P2.ps1', filesModule(st, 'firstlogon'));
    if (all.has('Invoke-Custom.ps1')) add(inst + '/Modules/Invoke-Custom.ps1', customModule(st));

    if (st.office.enabled) {
      add(inst + '/Office/Configuration.xml', toCRLF(st.office.xml.trim() + '\n'));
      if (st.office.setupSource === 'bundled') {
        add(inst + '/Office/HIER-setup.exe-ABLEGEN.txt', toCRLF([
          'Das Office Deployment Tool (setup.exe) muss in diesem Ordner liegen.',
          '',
          'Download: https://www.microsoft.com/download/details.aspx?id=49117',
          'Nach dem Entpacken die Datei setup.exe hierher kopieren und diese',
          'Hinweisdatei loeschen.'
        ].join('\n')));
      }
    }

    if (st.apps.enabled && st.apps.items.some((p) => p.enabled)) {
      if (st.apps.method === 'import') add(inst + '/Apps/packages.json', wingetImportJson(st));
      add(inst + '/Apps/Paketliste.csv', appsCsv(st));
      add(inst + '/Apps/' + (st.meta.name || 'Pakete').replace(/[^\w.-]+/g, '_') + '.ubundle', ubundleJson(st));
    }

    st.files.items.filter((f) => f.enabled).forEach((f) => {
      if (!f.blob) return;
      const dir = f.dest === 'scripts' ? base + '/$$/Setup/Scripts/' : inst + '/Files/';
      add(dir + f.target, f.blob, true);
    });

    if (mirror) {
      files.slice().forEach((f) => {
        if (f.path.indexOf(base + '/') === 0) {
          files.push({ path: mirror + f.path.slice(base.length), data: f.data, binary: f.binary });
        }
      });
    }

    files.push({ path: 'LIESMICH.txt', data: readme(st, files.slice()), binary: false });
    return files;
  }

  global.Templates = { build, relFromRoot, moduleList };
})(window);
