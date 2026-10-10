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
$Global:OemLogFile = Join-Path $Global:OemLogDir 'oem-setup.log'
$script:MountedHives = @()
$script:UserRegRoots = $null

function Initialize-OemLog {
    param([string]$Name = 'oem-setup')
    if (-not (Test-Path -LiteralPath $Global:OemLogDir)) {
        New-Item -Path $Global:OemLogDir -ItemType Directory -Force | Out-Null
    }
    $Global:OemLogFile = Join-Path $Global:OemLogDir ($Name + '.log')
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
    <#  Global, nicht $script: - eine ueber mehrere Skript-Scopes dot-gesourcte
        Funktion sieht sonst je nach Aufrufweg eine leere Variable. #>
    if (-not $Global:OemLogFile) {
        $Global:OemLogFile = Join-Path $Global:OemLogDir 'oem-setup.log'
    }
    try { Add-Content -LiteralPath $Global:OemLogFile -Value $line -Encoding UTF8 -ErrorAction Stop } catch { }
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

<#  Fuehrt einen Block mit harter Zeitgrenze aus. Noetig fuer Netzwerk- und
    Dienst-Cmdlets: im specialize-Pass warten sie unter Umstaenden endlos auf
    einen Stack, der noch nicht bereit ist, und blockieren damit das gesamte
    Windows-Setup. Der Block laeuft in einem eigenen Runspace und kennt die
    Funktionen aus dieser Datei NICHT. #>
function Invoke-WithTimeout {
    param(
        [Parameter(Mandatory)][string]$Name,
        [Parameter(Mandatory)][scriptblock]$Body,
        [int]$TimeoutSeconds = 120
    )
    $job = $null
    try {
        $job = Start-Job -ScriptBlock $Body -ErrorAction Stop
    } catch {
        Write-Log ('{0}: Hintergrundauftrag nicht startbar ({1}) - uebersprungen.' -f $Name, $_.Exception.Message) -Level Warn
        return $false
    }
    if (Wait-Job -Job $job -Timeout $TimeoutSeconds) {
        $failed = ($job.State -eq 'Failed')
        $reason = $null
        if ($failed) {
            $reason = $job.ChildJobs[0].JobStateInfo.Reason.Message
            if (-not $reason) { $reason = ($job.ChildJobs[0].Error | Select-Object -First 1) }
        }
        $out = Receive-Job -Job $job -ErrorAction SilentlyContinue 2>&1
        $errs = @($out | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] })
        if ($failed -or $errs.Count -gt 0) {
            $msg = if ($reason) { $reason } elseif ($errs.Count -gt 0) { $errs[0].ToString() } else { 'unbekannter Fehler' }
            Write-Log ('{0}: {1}' -f $Name, $msg) -Level Warn
            Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
            return $false
        }
        if ($out) {
            Write-Log ('{0}: {1}' -f $Name, (($out | Select-Object -First 3) -join ' | ')) -Level Debug
        }
        Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
        return $true
    }
    Write-Log ('{0}: Zeitueberschreitung nach {1} s - abgebrochen.' -f $Name, $TimeoutSeconds) -Level Warn
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
    return $false
}

<#  Direkter TCP-Test statt Test-NetConnection: das Cmdlet stammt aus dem Modul
    NetTCPIP, ist nicht in jeder Umgebung vorhanden und antwortet traege. #>
function Test-OemInternet {
    param([string]$ComputerName = 'www.msftconnecttest.com', [int]$Port = 80, [int]$TimeoutMs = 3000)
    $client = $null
    try {
        $client = New-Object System.Net.Sockets.TcpClient
        $async = $client.BeginConnect($ComputerName, $Port, $null, $null)
        if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) { return $false }
        $client.EndConnect($async)
        return $true
    } catch {
        return $false
    } finally {
        if ($client) { $client.Close() }
    }
}

function Wait-OemNetwork {
    param([int]$TimeoutSeconds = 300)
    if (Test-OemInternet) { return $true }
    Write-Log 'Warte auf Netzwerkverbindung ...'
    $sw = [Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $TimeoutSeconds) {
        Start-Sleep -Seconds 5
        if (Test-OemInternet) {
            Write-Log ('Netzwerk verfuegbar nach {0:n0} s.' -f $sw.Elapsed.TotalSeconds)
            return $true
        }
    }
    Write-Log ('Kein Netzwerk innerhalb von {0} s.' -f $TimeoutSeconds) -Level Warn
    return $false
}

<#  Prueft, ob diese winget.exe wirklich startet. Der direkte Aufruf aus
    Program Files\\WindowsApps bricht mit 0xC0000135 (-1073741515) ab, weil die
    MSIX-Abhaengigkeiten nur ueber den App-Execution-Alias aufgeloest werden.
    Ohne diese Pruefung scheitert anschliessend jedes einzelne Paket. #>
function Test-WingetUsable {
    param([Parameter(Mandatory)][string]$Path)
    try {
        $null = & $Path --version 2>&1
        return ($LASTEXITCODE -eq 0)
    } catch {
        return $false
    }
}

function Resolve-Winget {
    $candidates = @()

    $cmd = Get-Command winget.exe -ErrorAction SilentlyContinue
    if ($cmd) { $candidates += $cmd.Source }

    # Unter SYSTEM steht der Alias nicht im PATH - direkt in WindowsApps suchen.
    $base = Join-Path $env:ProgramFiles 'WindowsApps'
    $dirs = Get-ChildItem -Path $base -Directory -Filter 'Microsoft.DesktopAppInstaller_*_x64__8wekyb3d8bbwe' -ErrorAction SilentlyContinue
    if (-not $dirs) {
        $dirs = Get-ChildItem -Path $base -Directory -Filter 'Microsoft.DesktopAppInstaller_*' -ErrorAction SilentlyContinue
    }
    $candidates += $dirs | Sort-Object -Property Name -Descending |
        ForEach-Object { Join-Path $_.FullName 'winget.exe' } |
        Where-Object { Test-Path -LiteralPath $_ }

    foreach ($candidate in ($candidates | Select-Object -Unique)) {
        if (Test-WingetUsable -Path $candidate) { return $candidate }
        Write-Log ('winget unter ' + $candidate + ' ist nicht lauffaehig.') -Level Warn
    }

    if ($candidates.Count -gt 0 -and (Test-OemSystem)) {
        Write-Log 'winget wurde gefunden, laesst sich als SYSTEM aber nicht starten.' -Level Error
        Write-Log 'Der App-Execution-Alias existiert nur je Benutzer. Phase 2 muss dafuer im' -Level Error
        Write-Log 'Benutzerkontext laufen: Einstellung "Phase 2 wird gestartet ueber" auf RunOnce' -Level Error
        Write-Log 'stellen oder die autounattend.xml als Ausloeser verwenden (FirstLogonCommands).' -Level Error
    }
    return $null
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

<#  Serialisierung ueber Kontextgrenzen hinweg.
    Der Mutex allein genuegt nicht: erstellt ihn SYSTEM mit Standardrechten,
    bekommt ein Lauf im Benutzerkontext beim Oeffnen "Zugriff verweigert" und
    liefe ungebremst parallel weiter. Deshalb zusaetzlich eine Markierung in der
    Registry, die jeder Kontext lesen kann, mit Prozesskennung gegen Leichen. #>
function New-OemMutex {
    param([Parameter(Mandatory)][string]$Name)
    try {
        $createdNew = $false
        $security = New-Object System.Security.AccessControl.MutexSecurity
        $everyone = New-Object System.Security.Principal.SecurityIdentifier(
            [System.Security.Principal.WellKnownSidType]::WorldSid, $null)
        $rule = New-Object System.Security.AccessControl.MutexAccessRule(
            $everyone,
            [System.Security.AccessControl.MutexRights]::FullControl,
            [System.Security.AccessControl.AccessControlType]::Allow)
        $security.AddAccessRule($rule)
        return (New-Object System.Threading.Mutex($false, $Name, [ref]$createdNew, $security))
    } catch {
        try { return (New-Object System.Threading.Mutex($false, $Name)) } catch { return $null }
    }
}

function Test-OemRunActive {
    param([Parameter(Mandatory)][string]$Key, [Parameter(Mandatory)][string]$Name)
    $val = $null
    try { $val = (Get-ItemProperty -Path $Key -Name $Name -ErrorAction Stop).$Name } catch { return $false }
    if (-not $val) { return $false }
    $otherPid = 0
    if (-not [int]::TryParse(($val -split '\\|')[0], [ref]$otherPid)) { return $false }
    if ($otherPid -eq $PID) { return $false }
    return [bool](Get-Process -Id $otherPid -ErrorAction SilentlyContinue)
}

function Set-OemRunning {
    param([Parameter(Mandatory)][string]$Key, [Parameter(Mandatory)][string]$Name)
    try {
        if (-not (Test-Path -LiteralPath $Key)) { New-Item -Path $Key -Force | Out-Null }
        $stamp = '{0}|{1}' -f $PID, (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
        New-ItemProperty -Path $Key -Name $Name -PropertyType String -Force -Value $stamp | Out-Null
    } catch { Write-Log ('Laufmarkierung nicht gesetzt: ' + $_.Exception.Message) -Level Warn }
}

function Clear-OemRunning {
    param([Parameter(Mandatory)][string]$Key, [Parameter(Mandatory)][string]$Name)
    try { Remove-ItemProperty -Path $Key -Name $Name -ErrorAction SilentlyContinue } catch { }
}

function Invoke-OemProcess {
    param(
        [Parameter(Mandatory)][string]$FilePath,
        [string[]]$Arguments = @(),
        [int[]]$SuccessCodes = @(0),
        [int]$TimeoutSeconds = 3600,
        # Schneidet stdout/stderr mit, damit eine Fehlermeldung ins Protokoll kann
        [switch]$CaptureOutput
    )
    Write-Log ('Starte: "{0}" {1}' -f $FilePath, ($Arguments -join ' ')) -Level Debug
    $startArgs = @{ FilePath = $FilePath; PassThru = $true; WindowStyle = 'Hidden'; ErrorAction = 'Stop' }
    if ($Arguments -and $Arguments.Count -gt 0) { $startArgs['ArgumentList'] = $Arguments }
    $outFile = $null
    $errFile = $null
    if ($CaptureOutput) {
        $outFile = [IO.Path]::GetTempFileName()
        $errFile = [IO.Path]::GetTempFileName()
        $startArgs['RedirectStandardOutput'] = $outFile
        $startArgs['RedirectStandardError'] = $errFile
    }
    $p = Start-Process @startArgs
    $readOutput = {
        $text = ''
        foreach ($f in @($outFile, $errFile)) {
            if ($f -and (Test-Path -LiteralPath $f)) {
                $text += (Get-Content -LiteralPath $f -Raw -ErrorAction SilentlyContinue)
                Remove-Item -LiteralPath $f -Force -ErrorAction SilentlyContinue
            }
        }
        return ($text -replace '\\s+', ' ').Trim()
    }

    if (-not $p) {
        Write-Log ('Prozess konnte nicht gestartet werden: ' + $FilePath) -Level Error
        return [pscustomobject]@{ ExitCode = -1; Success = $false; TimedOut = $false; Output = (& $readOutput) }
    }
    if (-not $p.WaitForExit($TimeoutSeconds * 1000)) {
        Write-Log ('Zeitueberschreitung nach {0} s - Prozess wird beendet.' -f $TimeoutSeconds) -Level Error
        try { $p.Kill() } catch { }
        try { $p.WaitForExit(5000) | Out-Null } catch { }
        return [pscustomobject]@{ ExitCode = -1; Success = $false; TimedOut = $true; Output = (& $readOutput) }
    }
    $code = $p.ExitCode
    $ok = $SuccessCodes -contains $code
    if (-not $ok) { Write-Log ('Exitcode {0} von {1}' -f $code, (Split-Path -Leaf $FilePath)) -Level Warn }
    return [pscustomobject]@{ ExitCode = $code; Success = $ok; TimedOut = $false; Output = (& $readOutput) }
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
    if (phase === 'firstlogon' && hasLateTweaks(st)) mods.push(['Set-Tweaks-Spaet.ps1', 'Tweaks mit Netzwerkbedarf']);
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

$runningName = $markerName + '_Running'
$mutex = $null
$hasLock = $false
try {
    $mutex = New-OemMutex -Name 'Global\\OEM-Setup-Install'
    if ($mutex) {
        Write-Log 'Warte auf exklusiven Zugriff ...' -Level Debug
        $hasLock = $mutex.WaitOne([TimeSpan]::FromSeconds(60))
        if (-not $hasLock) { Write-Log 'Ein anderer Lauf haelt die Sperre.' -Level Warn }
    }
} catch [System.Threading.AbandonedMutexException] {
    $hasLock = $true
    Write-Log 'Vorheriger Lauf wurde abgebrochen - uebernehme die Sperre.' -Level Warn
} catch {
    Write-Log ('Sperre nicht verfuegbar: ' + $_.Exception.Message) -Level Warn
}

<#  Zweite Absicherung, falls der Mutex ueber die Kontextgrenze hinweg nicht
    greift: die Laufmarkierung ist fuer SYSTEM und Benutzer gleichermassen lesbar.
    Laeuft dieselbe Phase bereits, ist dieser Lauf ueberfluessig - er weicht,
    statt auf ein Ende zu warten, das Stunden entfernt sein kann. #>
if ((Test-OemRunActive -Key $markerKey -Name $runningName) -and -not $Force) {
    Write-Log ('Phase ' + $Phase + ' laeuft bereits in einem anderen Prozess - dieser Lauf endet hier.') -Level Warn
    if ($hasLock -and $mutex) { $mutex.ReleaseMutex() }
    exit 0
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

Set-OemRunning -Key $markerKey -Name $runningName

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

Clear-OemRunning -Key $markerKey -Name $runningName

try {
    if (-not (Test-Path -LiteralPath $markerKey)) { New-Item -Path $markerKey -Force | Out-Null }
    $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    New-ItemProperty -Path $markerKey -Name $markerName -PropertyType String -Force -Value $stamp | Out-Null
    New-ItemProperty -Path $markerKey -Name 'Projekt' -PropertyType String -Force -Value ${psq(st.meta.name)} | Out-Null
} catch {
    Write-Log ('Statusmarkierung nicht gesetzt: ' + $_.Exception.Message) -Level Warn
}
`);

    /* Deckt die autounattend.xml Phase 2 bereits ueber FirstLogonCommands ab, waere
       eine gleichzeitig startende Aufgabe ein zweiter paralleler Lauf. Bei 'both'
       bleibt sie als verzoegerter Rueckfall, bei 'unattend' entfaellt sie ganz. */
    const unattendRunsPhase2 = st.options.trigger !== 'setupcomplete';
    if (needPhase2 && st.options.trigger !== 'unattend') {
      const args = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + root + '\\Install.ps1" -Phase FirstLogon';
      const delay = unattendRunsPhase2
        ? NL + '        $trigger.Delay = \'PT15M\'   # Rueckfall: erst, wenn die Antwortdatei Phase 2 nicht gestartet hat'
        : '';
      if (st.options.phase2Runner === 'task') {
        s += toCRLF(`
if ($Phase -eq 'Setup') {
    Invoke-Step -Name 'Phase 2 einplanen (geplante Aufgabe)' -Body {
        $action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ${psq(args)}
        $trigger   = New-ScheduledTaskTrigger -AtLogOn${delay}
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
<#  Erfolgscodes laut winget-cli/src/AppInstallerSharedLib/Public/AppInstallerErrors.h:
    0 Installation ok, 3010/1641 Neustart noetig bzw. eingeleitet,
    0x8A150061 Paket bereits installiert, 0x8A15002B kein Upgrade anwendbar.
    0x8A150014 (kein Paket gefunden) gehoert ausdruecklich NICHT hierher - sonst
    gilt eine falsch geschriebene Paket-ID als erfolgreich installiert. #>
$SuccessCodes   = @(0, 3010, 1641, -1978335135, -1978335189)
$MaxRetries     = ${opts.retries}
$PackageTimeout = ${Math.max(60, (opts.packageTimeoutMin || 15) * 60)}   # Sekunden je Paket
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

function Get-WingetFehlertext {
    param([int]$Code)
    switch ($Code) {
        -1978335215 { 'Pruefsumme des Installers weicht vom Manifest ab - der Hersteller hat die Datei ausgetauscht. Mit --ignore-security-hash als Zusatzargument liesse sich die Pruefung uebergehen.' }
        -1978335212 { 'Kein passendes Paket gefunden - Paket-ID und Quelle pruefen.' }
        -1978335189 { 'Kein Upgrade anwendbar.' }
        -1978335135 { 'Paket ist bereits installiert.' }
        default      { '' }
    }
}

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
    $timedOut = $false
    for ($try = 0; $try -le $MaxRetries -and -not $ok -and -not $timedOut; $try++) {
        if ($try -gt 0) {
            Write-Log ('Wiederholung {0} fuer {1}' -f $try, $pkg.Name) -Level Warn
            Start-Sleep -Seconds (5 * $try)
        }
        try {
            <#  Direkter Aufruf statt Start-Process: winget.exe ist ein
                App-Execution-Alias, der den eigentlichen Vorgang anstoesst und
                sich sofort beendet. Start-Process wartet dann nur auf diesen
                Stub, liefert einen leeren Exitcode und meldet ein laufendes
                Paket als gescheitert. Der Aufruf im Hintergrundauftrag behaelt
                $LASTEXITCODE und bekommt trotzdem eine Zeitgrenze. #>
            $jobExe  = $exe
            $jobArgs = $pkg.Arguments
            $started = Get-Date
            $job = Start-Job -ScriptBlock {
                $e = $using:jobExe
                $a = @($using:jobArgs)
                $text = & $e @a 2>&1 | Out-String
                [pscustomobject]@{ Code = $LASTEXITCODE; Output = $text }
            }

            if (Wait-Job -Job $job -Timeout $PackageTimeout) {
                $r = Receive-Job -Job $job -ErrorAction SilentlyContinue
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
                $code = 0
                if ($null -ne $r -and $null -ne $r.Code) { $code = [int]$r.Code }
                $ok = $SuccessCodes -contains $code
                if (-not $ok) {
                    $klartext = Get-WingetFehlertext -Code $code
                    if ($klartext) { Write-Log ('{0}: {1}' -f $pkg.Name, $klartext) -Level Warn }
                    $hint = ''
                    if ($r) { $hint = ($r.Output -replace '\\s+', ' ').Trim() }
                    if ($hint.Length -gt 300) { $hint = $hint.Substring(0, 300) }
                    Write-Log ('Exitcode {0}: {1}' -f $code, $hint) -Level Warn
                }
            } else {
                $timedOut = $true
                Stop-Job -Job $job -ErrorAction SilentlyContinue
                Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
                Write-Log ('{0} hat das Zeitlimit von {1} s ueberschritten und wurde abgebrochen.' -f $pkg.Name, $PackageTimeout) -Level Error
                $procName = [IO.Path]::GetFileNameWithoutExtension($exe)
                Get-Process -Name $procName -ErrorAction SilentlyContinue |
                    Where-Object { $_.StartTime -ge $started } |
                    Stop-Process -Force -ErrorAction SilentlyContinue
            }
        } catch {
            Write-Log ('Fehler bei {0}: {1}' -f $pkg.Name, $_.Exception.Message) -Level Warn
        }
    }
    if ($ok) {
        Write-Log ('OK: ' + $pkg.Name)
    } else {
        Write-Log ('FEHLGESCHLAGEN: ' + $pkg.Name) -Level Error
        $failed += $pkg.Name + $(if ($timedOut) { ' (Zeitlimit)' } else { '' })
    }
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

<#  Haeufiger Ablagefehler: die setup.exe des Office Deployment Tools landet
    unter Files\\ oder direkt im Installationsordner statt in Office\\. #>
if (-not (Test-Path -LiteralPath $setupExe)) {
    $alt = @(
        (Join-Path $Global:OemRoot 'Files\\setup.exe'),
        (Join-Path $Global:OemRoot 'Files\\Setup.exe'),
        (Join-Path $Global:OemRoot 'setup.exe')
    ) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
    if ($alt) {
        Write-Log ('setup.exe liegt nicht in Office\\, verwende stattdessen: ' + $alt) -Level Warn
        $setupExe = $alt
    }
}
if (Test-Path -LiteralPath (Join-Path $officeDir 'HIER-setup.exe-ABLEGEN.txt')) {
    Write-Log 'Die Platzhalterdatei im Office-Ordner ist noch vorhanden - wurde die ODT-setup.exe abgelegt?' -Level Warn
}

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

<#  Das Office Deployment Tool laedt die Installationsdateien von Microsoft,
    sofern die Antwortdatei nicht per SourcePath auf eine lokale Quelle zeigt.
    In Phase 1 (specialize) steht noch kein Netzwerk zur Verfuegung. #>
$needsNetwork = $true
$configToUse = $configXml
try {
    [xml]$odtConfig = Get-Content -LiteralPath $configXml -Raw -ErrorAction Stop
    $sourcePath = $odtConfig.Configuration.Add.SourcePath
    if ($sourcePath) {
        <#  ODT erwartet unter SourcePath die Struktur Office\\Data\\<Version>.
            Ein leerer Ordner - etwa weil die Quelle nicht mitkopiert wurde -
            laesst die Installation scheitern, statt online auszuweichen. #>
        if (Test-Path -LiteralPath (Join-Path $sourcePath 'Office\\Data')) {
            $needsNetwork = $false
            Write-Log ('Lokale Office-Quelle: ' + $sourcePath)
        } else {
            Write-Log ('SourcePath verweist auf ' + $sourcePath + ', dort fehlt aber Office\\Data.') -Level Warn
            Write-Log 'Die Quelle wurde offenbar nicht mitgeliefert - es wird online installiert.' -Level Warn
            $odtConfig.Configuration.Add.RemoveAttribute('SourcePath')
            $tempDir = $env:TEMP
            if (-not $tempDir) { $tempDir = $officeDir }
            $configToUse = Join-Path $tempDir ('odt-online-' + [guid]::NewGuid().ToString('N') + '.xml')
            $odtConfig.Save($configToUse)
        }
    }
} catch {
    Write-Log ('Configuration.xml nicht auswertbar: ' + $_.Exception.Message) -Level Warn
}

if ($needsNetwork -and -not (Wait-OemNetwork -TimeoutSeconds 600)) {
    Write-Log 'Ohne Netzwerk kann das Office Deployment Tool die Installationsdateien nicht laden.' -Level Error
    Write-Log 'Office-Modul in Phase 2 ausfuehren oder in der Configuration.xml SourcePath setzen.' -Level Error
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
$res = Invoke-OemProcess -FilePath $setupExe -Arguments @('/configure', $configToUse) -SuccessCodes @(0, 3010, 1641) -TimeoutSeconds 7200 -CaptureOutput
if ($configToUse -ne $configXml) { Remove-Item -LiteralPath $configToUse -Force -ErrorAction SilentlyContinue }
if ($res.Success) {
    Write-Log 'Office-Installation abgeschlossen.'
} else {
    Write-Log ('Office-Installation meldete Exitcode ' + $res.ExitCode) -Level Error
    if ($res.Output) {
        $hint = $res.Output
        if ($hint.Length -gt 400) { $hint = $hint.Substring(0, 400) }
        Write-Log ('Meldung des Deployment Tools: ' + $hint) -Level Error
    }
}
`);
    return s;
  }

  /* ---------- Lokale Office-Quelle ---------- */

  /* Zielpfad der mitgelieferten Quelle auf dem installierten System. ODT erwartet
     darunter Office\Data\..., deshalb zeigt SourcePath auf den Ordner darueber. */
  function officeLocalPath(st) {
    const root = st.paths.installRoot.replace(/\\+$/, '');
    const folder = (st.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
    return root + '\\Office\\' + folder;
  }

  /* Setzt SourcePath im <Add>-Element, ohne die uebrige Datei anzutasten. */
  function withSourcePath(xml, path) {
    if (/<Add\b[^>]*\bSourcePath\s*=/i.test(xml)) {
      return xml.replace(/(<Add\b[^>]*\bSourcePath\s*=\s*")[^"]*(")/i, '$1' + path + '$2');
    }
    return xml.replace(/<Add\b/i, '<Add SourcePath="' + path + '"');
  }

  function officeSourceReadme(st) {
    const local = officeLocalPath(st);
    const folder = (st.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
    return toCRLF([
      '===================================================================',
      ' Hier gehoert die Office-Installationsquelle hin',
      '===================================================================',
      '',
      'Die Configuration.xml verweist per SourcePath auf diesen Ordner:',
      '    ' + local,
      '',
      'Das Office Deployment Tool erwartet darunter die Struktur',
      '    ' + folder + '\\Office\\Data\\<Version>\\...',
      '',
      'SO ERZEUGEN SIE DIE QUELLE',
      '--------------------------',
      '1. setup.exe des Office Deployment Tools in den Ordner Office\\ legen.',
      '   Download: https://www.microsoft.com/download/details.aspx?id=49117',
      '2. In diesem Ordner (Office\\) eine administrative PowerShell oeffnen und',
      '   das beiliegende Skript starten:',
      '',
      '       powershell -ExecutionPolicy Bypass -File Download-Quelle.ps1',
      '',
      '   Es laedt genau die Produkte und Sprachen, die in der Configuration.xml',
      '   stehen - je nach Auswahl mehrere Gigabyte.',
      '3. Diese Hinweisdatei anschliessend loeschen und den gefuellten Ordner',
      '   ' + folder + '\\ mit auf das Installationsmedium kopieren.',
      '',
      'HINWEIS',
      '-------',
      'Ohne gefuellte Quelle faellt Install-Office.ps1 auf die Online-Installation',
      'zurueck und braucht dann eine Netzwerkverbindung. In Phase 1 (specialize)',
      'besteht noch keine - dort funktioniert nur die lokale Quelle.',
      ''
    ].join('\n'));
  }

  function officeDownloadScript(st) {
    const folder = (st.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
    return banner('Laedt die Office-Installationsdateien fuer die Offline-Installation.', st.meta.name) + toCRLF(`
<#  Auf dem Vorbereitungsrechner ausfuehren, nicht auf dem Zielsystem.
    Legt die Quelle neben dieses Skript und richtet sie so ein, wie es
    Install-Office.ps1 auf dem Zielsystem erwartet. #>

$ErrorActionPreference = 'Stop'

$here    = Split-Path -Parent $MyInvocation.MyCommand.Definition
$setup   = Join-Path $here 'setup.exe'
$config  = Join-Path $here 'Configuration.xml'
$target  = Join-Path $here ${psq(folder)}

if (-not (Test-Path -LiteralPath $setup)) {
    Write-Host 'setup.exe des Office Deployment Tools fehlt in diesem Ordner.' -ForegroundColor Red
    Write-Host 'Download: https://www.microsoft.com/download/details.aspx?id=49117'
    exit 1
}
if (-not (Test-Path -LiteralPath $config)) {
    Write-Host 'Configuration.xml fehlt in diesem Ordner.' -ForegroundColor Red
    exit 1
}

New-Item -Path $target -ItemType Directory -Force | Out-Null

<#  Fuer den Download muss SourcePath auf den hiesigen Ordner zeigen, auf dem
    Zielsystem dagegen auf dessen dortigen Pfad. Deshalb eine Arbeitskopie. #>
[xml]$cfg = Get-Content -LiteralPath $config -Raw
$add = $cfg.Configuration.Add
if (-not $add) {
    Write-Host 'Die Configuration.xml enthaelt kein <Add>-Element.' -ForegroundColor Red
    exit 1
}
$add.SetAttribute('SourcePath', $target)
$tempDir = $env:TEMP
if (-not $tempDir) { $tempDir = $here }
$work = Join-Path $tempDir ('odt-download-' + [guid]::NewGuid().ToString('N') + '.xml')
$cfg.Save($work)

Write-Host ('Lade Office nach ' + $target + ' ...') -ForegroundColor Cyan
Write-Host 'Das dauert je nach Auswahl und Leitung eine Weile.' -ForegroundColor DarkGray

$proc = Start-Process -FilePath $setup -ArgumentList @('/download', $work) -Wait -PassThru -NoNewWindow
Remove-Item -LiteralPath $work -Force -ErrorAction SilentlyContinue

if ($proc.ExitCode -ne 0) {
    Write-Host ('Download fehlgeschlagen, Exitcode ' + $proc.ExitCode) -ForegroundColor Red
    exit $proc.ExitCode
}

$data = Join-Path $target 'Office\\Data'
if (Test-Path -LiteralPath $data) {
    $size = (Get-ChildItem -LiteralPath $target -Recurse -File -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum / 1GB
    Write-Host ('Fertig. Quelle belegt {0:n1} GB.' -f $size) -ForegroundColor Green
    Write-Host 'Die Hinweisdatei im Quellordner kann jetzt geloescht werden.'
} else {
    Write-Host 'Der Download meldete Erfolg, aber Office\\Data fehlt.' -ForegroundColor Yellow
}
`);
  }

  /* ---------- Modules/Set-Tweaks.ps1 ---------- */

  /* mode 'main': Registry-Werte und unkritische PowerShell-Teile in der gewaehlten Phase.
     mode 'late': nur die aufgeschobenen PowerShell-Teile, immer in Phase 2.
     Aufgeschoben wird, was es im specialize-Pass noch nicht gibt: einen
     initialisierten Netzwerk- oder Dienststack (solche Cmdlets blockieren dort
     und halten das Setup an) oder ein angelegtes Benutzerkonto. */
  function tweaksModule(st, mode) {
    const sel = Catalog.TWEAKS.filter((t) => st.tweaks.selected.includes(t.id));
    const deferring = st.tweaks.phase === 'setup';
    const late = mode === 'late';

    const list = late ? sel.filter((t) => t.deferPs && t.ps) : sel;
    const title = late
      ? 'Holt die Einstellungen nach, die in Phase 1 noch nicht moeglich waren.'
      : 'Setzt die ausgewaehlten System- und Benutzereinstellungen.';

    let s = banner(title, st.meta.name);
    s += bootstrapHeader(late ? 'Set-Tweaks-Spaet' : 'Set-Tweaks');

    const needsUser = !late && sel.some((t) => (t.reg || []).some((r) => r.scope === 'user'));
    if (needsUser) {
      s += toCRLF(`
$roots = Open-UserHives${st.tweaks.allUsers ? ' -IncludeExistingProfiles' : ''}
Write-Log ('Benutzer-Registry-Ziele: ' + ($roots -join ', '))

try {
`);
    }

    const pad = needsUser ? '    ' : '';
    const cats = [];
    list.forEach((t) => { if (!cats.includes(t.cat)) cats.push(t.cat); });

    for (const cat of cats) {
      s += NL + pad + '# ---------- ' + cat + ' ----------' + NL;
      for (const t of list.filter((x) => x.cat === cat)) {
        /* In 'main' wird der aufgeschobene ps-Teil weggelassen, wenn ein spaetes
           Modul erzeugt wird; sonst laeuft er hier - aber mit Zeitgrenze. */
        const psHere = t.ps && (late || !(t.deferPs && deferring));
        if (!psHere && !(t.reg || []).length) continue;

        s += pad + 'Write-Log ' + psq(t.label + (late ? ' (nachgeholt)' : '')) + NL;

        if (!late) {
          for (const r of (t.reg || [])) {
            s += pad + 'Set-RegValue -Scope ' + (r.scope === 'user' ? 'User' : 'Machine') +
              ' -Path ' + psq(r.path) + ' -Name ' + psq(r.name) +
              ' -Type ' + r.type + ' -Value ' + (typeof r.value === 'number' ? r.value : psq(r.value)) + NL;
          }
        }

        if (psHere) {
          const body = toCRLF(t.ps).split(NL);
          if (t.deferPs) {
            /* Eigener Runspace: der Block darf keine Funktionen aus OEM-Common.ps1 verwenden. */
            s += pad + 'Invoke-WithTimeout -Name ' + psq(t.label) +
              ' -TimeoutSeconds ' + (t.timeout || 120) + ' -Body {' + NL;
            s += body.map((l) => pad + '    ' + l).join(NL) + NL;
            s += pad + '} | Out-Null' + NL;
          } else {
            s += pad + 'try {' + NL;
            s += body.map((l) => pad + '    ' + l).join(NL) + NL;
            s += pad + '} catch { Write-Log (' + psq(t.label + ' fehlgeschlagen: ') + ' + $_.Exception.Message) -Level Warn }' + NL;
          }
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
Write-Log '${late ? 'Nachgeholte Einstellungen abgeschlossen.' : 'Tweaks angewendet.'}'
`);
    return s;
  }

  /* Gibt es aufgeschobene PowerShell-Teile, die ein eigenes Phase-2-Modul brauchen? */
  function hasLateTweaks(st) {
    return st.tweaks.enabled && st.tweaks.phase === 'setup' &&
      Catalog.TWEAKS.some((t) => st.tweaks.selected.includes(t.id) && t.deferPs && t.ps);
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
[CmdletBinding()]
param(
    # Sammelt alle relevanten Protokolle in einem kleinen ZIP zum Weitergeben
    [switch]$Export,
    # Abweichender Installationsordner, falls die Dateien nicht am erwarteten Ort liegen
    # (nicht $Root nennen - PowerShell unterscheidet $Root und $root nicht)
    [string]$InstallRoot
)

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

<#  Reihenfolge: ausdruecklich uebergeben, sonst der konfigurierte Ordner,
    sonst der Ordner, in dem dieses Skript tatsaechlich liegt. Letzteres greift,
    wenn das Paket von einem anderen Laufwerk aus gestartet wird. #>
$root = ${psq(root)}
if ($InstallRoot) {
    $root = $InstallRoot
} elseif (-not (Test-Path -LiteralPath $root) -and $PSScriptRoot -and (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'Install.ps1'))) {
    $root = $PSScriptRoot
}
Write-Host ('OEM Setup - Diagnose   (' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ')') -ForegroundColor White
Write-Host ('Installationsordner: ' + $root) -ForegroundColor DarkGray

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
    (Join-OemPath $env:SystemRoot 'Panther\\UnattendGC\\setupact.log'),
    (Join-OemPath $env:SystemRoot 'Panther\\NewOS\\setupact.log'),
    (Join-OemPath $env:SystemDrive '$WINDOWS.~BT\\Sources\\Panther\\setupact.log'),
    (Join-OemPath $env:SystemDrive '$WINDOWS.~BT\\Sources\\Rollback\\setupact.log')
) | Where-Object { $_ }
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

Show-Head 'Art der Installation'
$bt = Join-OemPath $env:SystemDrive '$WINDOWS.~BT'
if (Test-Path $bt) {
    Write-Host '  $WINDOWS.~BT ist vorhanden - Arbeitsbereich der Setup-Downlevel-Phase.' -ForegroundColor Yellow
    Write-Host '  Der Ordner kann von einem frueheren Setup-Lauf stammen, entsteht aber' -ForegroundColor DarkGray
    Write-Host '  typischerweise, wenn setup.exe aus einem laufenden Windows gestartet wird.' -ForegroundColor DarkGray
    Write-Host '  Pruefen Sie das: wurde diese Installation aus Windows heraus gestartet,' -ForegroundColor Yellow
    Write-Host '  wertet Setup weder $OEM$ noch eine autounattend.xml auf dem Medium aus -' -ForegroundColor Yellow
    Write-Host '  dann muss vom Medium gebootet werden.' -ForegroundColor Yellow
} else {
    Show-Item 'Kein $WINDOWS.~BT vorhanden' $true 'spricht fuer eine Installation vom gebooteten Medium'
}

if ($Export) {
    Show-Head 'Export'
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $tmp = Join-OemPath $env:TEMP ('OEM-Diagnose-' + $stamp)
    New-Item -Path $tmp -ItemType Directory -Force | Out-Null

    # eigene Protokolle vollstaendig
    if (Test-Path $logDir) { Copy-Item -Path (Join-OemPath $logDir '*') -Destination $tmp -Recurse -Force }

    # Setup-Protokolle: nur die relevanten Zeilen und das Ende, sonst wird es zu gross
    $i = 0
    foreach ($log in $panther) {
        if (-not (Test-Path $log)) { continue }
        $i++
        # Nur ein kurzer, garantiert relativer Dateiname - der Pfad selbst taugt nicht dafuer
        $parent = [IO.Path]::GetFileName([IO.Path]::GetDirectoryName($log))
        $tag = '{0:00}_{1}' -f $i, ($parent -replace '[^A-Za-z0-9.~-]', '_')
        Select-String -Path $log -Pattern 'SetupComplete|OEM\\$|configuration set|unattend|FirstLogon|RunSynchronous' -ErrorAction SilentlyContinue |
            ForEach-Object { $_.Line.Trim() } |
            Set-Content -LiteralPath (Join-OemPath $tmp ('TREFFER_' + $tag + '.txt')) -Encoding UTF8
        Get-Content -LiteralPath $log -Tail 3000 -ErrorAction SilentlyContinue |
            Set-Content -LiteralPath (Join-OemPath $tmp ('ENDE_' + $tag + '.txt')) -Encoding UTF8
        Add-Content -LiteralPath (Join-OemPath $tmp 'Quellen.txt') -Value ($tag + ' = ' + $log) -Encoding UTF8
    }

    # Systemzustand
    $state = @()
    $state += 'Edition : ' + (Get-CimInstance Win32_OperatingSystem).Caption
    $state += 'Build   : ' + (Get-CimInstance Win32_OperatingSystem).BuildNumber
    $state += 'Marker  : ' + (( Get-ItemProperty 'HKLM:\\SOFTWARE\\OEM-Setup' -ErrorAction SilentlyContinue |
        Format-List | Out-String ).Trim())
    $state += 'Aufgabe : ' + ((Get-ScheduledTask -TaskName 'OEM-Setup-Phase2' -ErrorAction SilentlyContinue |
        Select-Object TaskName, State | Format-List | Out-String).Trim())
    $state += 'Lizenz  : ' + ((Get-CimInstance SoftwareLicensingProduct -Filter "PartialProductKey IS NOT NULL" -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'Windows*' } |
        Select-Object Name, Description, ProductKeyChannel, LicenseStatus | Format-List | Out-String).Trim())
    $state += 'BT-Ordner vorhanden: ' + (Test-Path $bt)
    $state | Set-Content -LiteralPath (Join-OemPath $tmp 'Systemzustand.txt') -Encoding UTF8

    $zip = Join-OemPath $logDir ('OEM-Diagnose-' + $stamp + '.zip')
    if (-not (Test-Path $logDir)) { New-Item -Path $logDir -ItemType Directory -Force | Out-Null }
    Compress-Archive -Path (Join-OemPath $tmp '*') -DestinationPath $zip -Force
    Remove-Item -LiteralPath $tmp -Recurse -Force
    $size = [math]::Round((Get-Item $zip).Length / 1KB)
    Write-Host ('  Erstellt: ' + $zip + '  (' + $size + ' KB)') -ForegroundColor Green
    Write-Host '  Diese Datei ist klein genug zum Weitergeben.' -ForegroundColor DarkGray
}

Show-Head 'Naechster Schritt'
Write-Host ('  Manuell nachholen:  powershell -ExecutionPolicy Bypass -File "' + (Join-OemPath $root 'Install.ps1') + '" -Phase Manual -Force')
Write-Host ('  Nur Phase 1:        powershell -ExecutionPolicy Bypass -File "' + (Join-OemPath $root 'Install.ps1') + '" -Phase Setup -Force')
if (-not $Export) {
    Write-Host ('  Protokolle packen:  powershell -ExecutionPolicy Bypass -File "' + (Join-OemPath $root 'Diagnose.ps1') + '" -Export')
}
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
    if (st.office.enabled && st.office.source === 'local') {
      const folder = (st.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
      todo.push('Office-Installationsquelle erzeugen und nach Office\\' + folder +
        '\\ kopieren - dazu Office\\Download-Quelle.ps1 auf dem Vorbereitungsrechner ausfuehren ' +
        '(mehrere Gigabyte). Ohne sie weicht die Installation auf den Online-Bezug aus.');
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


  /* ---------- README (englische Fassung) ---------- */

  function readmeEn(st, files) {
    const zipRoot = st.paths.zipRoot === 'oem' ? '$OEM$'
      : st.paths.zipRoot === 'both' ? 'sources\\$OEM$ AND $OEM$' : 'sources\\$OEM$';
    /* Die Modultitel stehen im i18n-Woerterbuch; readmeEn laeuft nur mit geladenem Modul. */
    const modEn = (m) => (global.I18n ? global.I18n.term(m) : m);
    const setupMods = moduleList(st, 'setup').map((m) => modEn(m[1]));
    const logonMods = moduleList(st, 'firstlogon').map((m) => modEn(m[1]));
    const lines = [
      '===================================================================',
      ' OEM Script Generator - project: ' + st.meta.name,
      ' Created on ' + new Date().toLocaleString('en-GB'),
      '===================================================================',
      '',
      'HOW TO USE',
      '----------',
      '1. Extract the Windows 11 ISO or create a USB stick with the installation media.',
      (st.options.trigger !== 'setupcomplete'
        ? '2. Copy autounattend.xml from this archive into the ROOT DIRECTORY of the media\n' +
          '   (next to sources\\ and boot\\). If an autounattend.xml already exists there,\n' +
          '   merge the blocks from autounattend-Einfuegen.txt into that existing file.\n' +
          '2b. Copy the folder "' + zipRoot + '" into the root directory of the'
        : '2. Copy the folder "' + zipRoot + '" from this archive into the root directory of the'),
      '   media as well, so that the following path exists:',
      '      <media>\\sources\\$OEM$\\$$\\Setup\\Scripts\\SetupComplete.cmd',
      '      <media>\\sources\\$OEM$\\$1\\' + relFromRoot(st.paths.installRoot) + '\\Install.ps1',
      '3. Add the missing binaries (see section "STILL TO BE ADDED").',
      '4. Start the installation as usual. Windows copies $1 to ' +
      st.paths.installRoot.replace(/\\+$/, '') + ' and $$ to %WINDIR%.',
      '',
      'WHERE DOES $OEM$ BELONG?',
      '------------------------',
      'That depends on the answer file:',
      '',
      ' * without autounattend.xml, or with UseConfigurationSet = false:',
      '     <media>\\sources\\$OEM$\\...',
      ' * with <UseConfigurationSet>true</UseConfigurationSet> in autounattend.xml:',
      '     Setup looks for the configuration set NEXT TO the answer file, i.e.',
      '     <media>\\$OEM$\\...   (root directory, not sources\\)',
      '',
      'Populating both locations is the safe bet - Setup only evaluates the matching',
      'one and ignores the other folder. That is exactly what the generator offers as',
      'the ZIP root setting "both locations".',
      '',
      'Either way: $OEM$ is only evaluated when the installation is started from this',
      'medium.',
      '',
      'TRIGGER',
      '-------',
      (st.options.trigger === 'setupcomplete'
        ? 'SetupComplete.cmd only.'
        : st.options.trigger === 'unattend'
          ? 'autounattend.xml only (specialize and FirstLogonCommands).'
          : 'SetupComplete.cmd AND autounattend.xml - belt and braces.'),
      '',
      'Important: Windows Setup does NOT run SetupComplete.cmd when the installation',
      'uses a product key from the OEM channel - for instance the key stored in the',
      'BIOS/UEFI of a branded device. This affects the client editions (Home, Pro);',
      'Enterprise and Windows Server are exempt. On such devices only autounattend.xml',
      'runs reliably.',
      '',
      'Running more than once does no harm: Install.ps1 records every completed phase',
      'under HKLM\\SOFTWARE\\OEM-Setup and skips it on the next call. Use -Force to run',
      'a phase again.',
      '',
      'SEQUENCE',
      '--------',
      'Phase 1 (' + (st.options.trigger === 'unattend' ? 'autounattend.xml, specialize pass' : 'SetupComplete.cmd') + ', SYSTEM context, before the first logon):',
      setupMods.length ? setupMods.map((m) => '   - ' + m).join('\n') : '   - no modules',
      '',
      'Phase 2 (' + (st.options.phase2Runner === 'task' ? 'scheduled task as SYSTEM' : 'RunOnce in the user context') + ', after the first logon):',
      logonMods.length ? logonMods.map((m) => '   - ' + m).join('\n') : '   - no modules',
      '',
      'Logs: ' + st.paths.installRoot.replace(/\\+$/, '') + '\\Logs',
      '',
      'TROUBLESHOOTING',
      '---------------',
      'On the installed system, in an elevated PowerShell:',
      '   powershell -ExecutionPolicy Bypass -File ' + st.paths.installRoot + '\\Diagnose.ps1',
      'The script checks the files, the execution state and the scheduled task, and',
      'evaluates the Windows Setup logs - including the question of whether Setup',
      'refused to run SetupComplete.cmd because of the OEM licence channel.',
      '',
      'MANUAL TEST',
      '-----------',
      'On a test system, in an elevated PowerShell:',
      '   powershell -ExecutionPolicy Bypass -File ' + st.paths.installRoot + '\\Install.ps1 -Phase Manual',
      'A single module:',
      '   powershell -ExecutionPolicy Bypass -File ' + st.paths.installRoot + '\\Install.ps1 -Phase Manual -Only Set-Tweaks.ps1',
      'Repeat a phase that already ran:  ... -Phase Setup -Force',
      '',
      'STILL TO BE ADDED',
      '-----------------'
    ];

    const todo = [];
    if (st.office.enabled && st.office.setupSource === 'bundled') {
      todo.push('Copy setup.exe of the Office Deployment Tool to ' + zipRoot + '\\$1\\' +
        relFromRoot(st.paths.installRoot) + '\\Office\\setup.exe.');
    }
    if (st.office.enabled && st.office.source === 'local') {
      const folder = (st.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
      todo.push('Create the Office installation source and copy it to Office\\' + folder +
        '\\ - run Office\\Download-Quelle.ps1 on the staging machine to do so ' +
        '(several gigabytes). Without it the installation falls back to the online source.');
    }
    st.files.items.filter((f) => f.enabled && !f.blobPresent).forEach((f) => {
      todo.push('File "' + f.name + '" is missing from the archive and has to be copied to ' +
        (f.dest === 'scripts' ? '$OEM$\\$$\\Setup\\Scripts\\' : 'Files\\') + f.target + ' by hand.');
    });
    if (!todo.length) todo.push('Nothing - the archive is complete.');
    lines.push(todo.map((t) => ' * ' + t).join('\n'));

    lines.push('', 'FILES INCLUDED', '--------------');
    files.forEach((f) => lines.push(' ' + f.path));
    lines.push('');
    return toCRLF(lines.join('\n'));
  }

  /* Sprache der Oberflaeche; ohne i18n-Modul bleibt es deutsch. */
  function uiLang() {
    return (global.I18n && global.I18n.lang === 'en') ? 'en' : 'de';
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

    if (all.has('Set-Tweaks.ps1')) add(inst + '/Modules/Set-Tweaks.ps1', tweaksModule(st, 'main'));
    if (all.has('Set-Tweaks-Spaet.ps1')) add(inst + '/Modules/Set-Tweaks-Spaet.ps1', tweaksModule(st, 'late'));
    if (all.has('Remove-Bloatware.ps1')) add(inst + '/Modules/Remove-Bloatware.ps1', bloatModule(st));
    if (all.has('Install-Office.ps1')) add(inst + '/Modules/Install-Office.ps1', officeModule(st));
    if (all.has('Install-Apps.ps1')) add(inst + '/Modules/Install-Apps.ps1', appsModule(st));
    if (all.has('Install-Files-P1.ps1')) add(inst + '/Modules/Install-Files-P1.ps1', filesModule(st, 'setup'));
    if (all.has('Install-Files-P2.ps1')) add(inst + '/Modules/Install-Files-P2.ps1', filesModule(st, 'firstlogon'));
    if (all.has('Invoke-Custom.ps1')) add(inst + '/Modules/Invoke-Custom.ps1', customModule(st));

    if (st.office.enabled) {
      const useLocal = st.office.source === 'local';
      const officeXml = useLocal
        ? withSourcePath(st.office.xml.trim(), officeLocalPath(st))
        : st.office.xml.trim();
      add(inst + '/Office/Configuration.xml', toCRLF(officeXml + '\n'));
      if (useLocal) {
        const folder = (st.office.localFolder || 'Quelle').replace(/^[\\/]+|[\\/]+$/g, '');
        add(inst + '/Office/' + folder + '/HIER-OFFICE-QUELLE-ABLEGEN.txt', officeSourceReadme(st));
        add(inst + '/Office/Download-Quelle.ps1', officeDownloadScript(st));
      }
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

    const en = uiLang() === 'en';
    files.push({
      path: en ? 'README.txt' : 'LIESMICH.txt',
      data: en ? readmeEn(st, files.slice()) : readme(st, files.slice()),
      binary: false
    });
    return files;
  }

  global.Templates = { build, relFromRoot, moduleList, hasLateTweaks };
})(window);
