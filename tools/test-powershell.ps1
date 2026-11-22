<#  PowerShell-Tests fuer die erzeugten Skripte - laeuft in GitHub Actions auf
    windows-latest (Windows PowerShell 5.1 und PowerShell 7), Adminrechte.

      node tools/emit-scripts.js out
      powershell -ExecutionPolicy Bypass -File tools/test-powershell.ps1 -Root out [-Functional]

    1. Syntax: jedes .ps1 mit dem PowerShell-Parser; UTF-8 mit BOM (ohne BOM
       liest Windows PowerShell 5.1 Umlaute als ANSI).
    2. autounattend.xml ist wohlgeformtes XML.
    3. PSScriptAnalyzer, nur Schweregrad "Error" (wenn installiert).
    4. -Functional: Set-Tweaks.ps1 aus dem Profil "regtest" wirklich ausfuehren
       und die Werte aus samples/Beispiel.reg zuruecklesen; dasselbe Modul aus
       "voll" ausfuehren (alle Tweaks, Default-Profil einbinden); Diagnose.ps1
       laufen lassen. Nur auf einem Wegwerf-System (CI-Runner) verwenden -
       die Tweaks aendern das System.  #>
param(
    [Parameter(Mandatory)][string]$Root,
    [switch]$Functional
)

$ErrorActionPreference = 'Stop'
$script:failures = 0
function Fail([string]$Message) {
    Write-Host ('FEHLER: ' + $Message) -ForegroundColor Red
    $script:failures++
}
function Ok([string]$Message) { Write-Host ('ok      ' + $Message) -ForegroundColor Green }

$Root = (Resolve-Path -LiteralPath $Root).Path
Write-Host ('PowerShell ' + $PSVersionTable.PSVersion + ' (' + $PSVersionTable.PSEdition + ')') -ForegroundColor Cyan

# ---------- 1. Syntax und Kodierung ----------
$scripts = @(Get-ChildItem -LiteralPath $Root -Recurse -Filter '*.ps1' -File)
if ($scripts.Count -eq 0) { Fail 'keine .ps1-Dateien gefunden'; exit 1 }
foreach ($f in $scripts) {
    $tokens = $null; $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$tokens, [ref]$errors) | Out-Null
    foreach ($e in $errors) {
        Fail ('{0}:{1}: {2}' -f $f.FullName.Substring($Root.Length + 1), $e.Extent.StartLineNumber, $e.Message)
    }
    $bytes = [System.IO.File]::ReadAllBytes($f.FullName)
    if ($bytes.Length -lt 3 -or $bytes[0] -ne 0xEF -or $bytes[1] -ne 0xBB -or $bytes[2] -ne 0xBF) {
        Fail ('ohne UTF-8-BOM: ' + $f.FullName.Substring($Root.Length + 1))
    }
}
Ok ('Syntax: ' + $scripts.Count + ' Skripte geprueft')

# ---------- 2. Antwortdateien ----------
foreach ($x in @(Get-ChildItem -LiteralPath $Root -Recurse -Filter 'autounattend.xml' -File)) {
    try { [xml](Get-Content -LiteralPath $x.FullName -Raw) | Out-Null; Ok ('XML: ' + $x.FullName.Substring($Root.Length + 1)) }
    catch { Fail ('XML nicht wohlgeformt: ' + $x.FullName + ' - ' + $_.Exception.Message) }
}

# ---------- 3. PSScriptAnalyzer ----------
if (Get-Module -ListAvailable -Name PSScriptAnalyzer) {
    Import-Module PSScriptAnalyzer
    $found = @(Invoke-ScriptAnalyzer -Path $Root -Recurse -Severity Error)
    foreach ($r in $found) {
        Fail ('PSScriptAnalyzer {0}: {1}:{2} {3}' -f $r.RuleName, $r.ScriptName, $r.Line, $r.Message)
    }
    Ok ('PSScriptAnalyzer: ' + $found.Count + ' Fehler')
} else {
    Write-Host 'PSScriptAnalyzer nicht installiert - uebersprungen.' -ForegroundColor Yellow
}

# ---------- 4. Funktionstests ----------
if ($Functional) {
    function Find-OemModule([string]$Profile, [string]$Name) {
        foreach ($base in @('sources\$OEM$', '$OEM$')) {
            $p = Join-Path $Root (Join-Path $Profile (Join-Path $base ('$1\Install\Modules\' + $Name)))
            if (Test-Path -LiteralPath $p) { return $p }
        }
        return $null
    }
    <#  reg.exe ohne Abbruch: Windows PowerShell 5.1 macht aus jeder stderr-Zeile
        eines externen Programms einen Fehler, mit 'Stop' also einen Abbruch. #>
    function Invoke-Reg {
        $old = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { & reg.exe @args 2>&1 | Out-Null; return $LASTEXITCODE }
        finally { $ErrorActionPreference = $old }
    }
    function Invoke-Isolated([string]$Path, [string[]]$Arguments) {
        $exe = (Get-Process -Id $PID).Path
        $all = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Path) + $Arguments
        $out = & $exe @all 2>&1
        $code = $LASTEXITCODE
        $out | ForEach-Object { Write-Host ('        ' + $_) }
        return $code
    }

    $userKey = 'HKCU:\Software\OEM-Script-Gen-Test'
    $machineKey = 'HKLM:\SOFTWARE\OEM-Script-Gen-Test'
    $classKey = 'HKLM:\SOFTWARE\Classes\.oemscriptgentest'
    foreach ($k in @($userKey, $machineKey, $classKey)) { Remove-Item -LiteralPath $k -Recurse -Force -ErrorAction SilentlyContinue }

    # 4a. .reg-Werte schreiben und zuruecklesen
    $tweaks = Find-OemModule 'regtest' 'Set-Tweaks.ps1'
    if (-not $tweaks) { Fail 'regtest: Set-Tweaks.ps1 nicht gefunden' }
    else {
        $code = Invoke-Isolated $tweaks @()
        if ($code -ne 0) { Fail ('regtest: Set-Tweaks.ps1 Exitcode ' + $code) }
        $key = Get-Item -LiteralPath $userKey -ErrorAction SilentlyContinue
        if (-not $key) { Fail ('Schluessel fehlt: ' + $userKey) }
        else {
            function Check([string]$Name, $Expected, [string]$Kind) {
                $actual = $key.GetValue($Name, $null, 'DoNotExpandEnvironmentNames')
                $kindActual = if ($null -ne $actual) { [string]$key.GetValueKind($Name) } else { '' }
                $same = if ($Expected -is [array]) { $null -ne $actual -and (@(Compare-Object $Expected $actual -SyncWindow 0).Count -eq 0) } else { $actual -eq $Expected }
                if (-not $same -or ($Kind -and $kindActual -ne $Kind)) {
                    Fail ('{0}: {1} ({2}) statt {3} ({4})' -f $Name, ($actual -join ','), $kindActual, ($Expected -join ','), $Kind)
                } else { Ok ('Registry ' + $Name + ' = ' + ($actual -join ',') + ' (' + $kindActual + ')') }
            }
            Check '' 'Standardwert' 'String'
            Check 'Text' ('Gr' + [char]0xFC + [char]0xDF + 'e "zitiert" C:\Pfad\') 'String'
            Check 'DwordMax' -1 'DWord'
            Check 'DwordNull' 0 'DWord'
            Check 'Qword' ([int64]-1) 'QWord'
            Check 'Expand' '%SystemRoot%' 'ExpandString'
            Check 'Multi' @('a', [string][char]0xE4) 'MultiString'
            Check 'Binaer' ([byte[]]@(1, 2, 171)) 'Binary'
            if ($null -ne $key.GetValue('Weg')) { Fail 'Wert "Weg" haette geloescht werden muessen' } else { Ok 'Wert "Weg" geloescht' }
            if (Test-Path -LiteralPath ($userKey + '\Alt')) { Fail 'Schluessel "Alt" haette geloescht werden muessen' } else { Ok 'Schluessel "Alt" geloescht' }
        }
        $m = Get-ItemProperty -LiteralPath $machineKey -ErrorAction SilentlyContinue
        if (-not $m -or $m.Rechner -ne 1) { Fail 'HKLM-Wert "Rechner" fehlt' } else { Ok 'HKLM-Wert "Rechner"' }
        $c = (Get-Item -LiteralPath $classKey -ErrorAction SilentlyContinue)
        if (-not $c -or $c.GetValue('') -ne 'OEMScriptGenTestFile') { Fail 'HKCR wurde nicht nach HKLM\SOFTWARE\Classes geschrieben' } else { Ok 'HKCR -> HKLM\SOFTWARE\Classes' }

        # zweiter Lauf: Loeschen nicht vorhandener Werte/Schluessel darf nicht scheitern
        $code = Invoke-Isolated $tweaks @()
        if ($code -ne 0) { Fail ('regtest, zweiter Lauf: Exitcode ' + $code) } else { Ok 'zweiter Lauf ohne Fehler' }
    }

    # 4b. Volles Tweak-Modul inkl. Default-Profil (reg load)
    $full = Find-OemModule 'voll' 'Set-Tweaks.ps1'
    if (-not $full) { Fail 'voll: Set-Tweaks.ps1 nicht gefunden' }
    else {
        Remove-Item -LiteralPath $userKey -Recurse -Force -ErrorAction SilentlyContinue
        <#  Ausgangszustand im Default-Profil festlegen - sonst koennte ein Wert,
            den das Runner-Image schon mitbringt, den Test zufaellig bestehen. #>
        $hive = Join-Path $env:SystemDrive 'Users\Default\NTUSER.DAT'
        if ((Invoke-Reg load 'HKLM\OEMTESTDEFAULT' $hive) -eq 0) {
            $null = Invoke-Reg delete 'HKLM\OEMTESTDEFAULT\Software\OEM-Script-Gen-Test' /f
            $null = Invoke-Reg add 'HKLM\OEMTESTDEFAULT\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' /v HideFileExt /t REG_DWORD /d 1 /f
            $null = Invoke-Reg unload 'HKLM\OEMTESTDEFAULT'
        } else { Fail 'Default-Profil laesst sich vor dem Test nicht einbinden' }
        $code = Invoke-Isolated $full @()
        if ($code -ne 0) { Fail ('voll: Set-Tweaks.ps1 Exitcode ' + $code) } else { Ok 'voll: Set-Tweaks.ps1' }
        $hive = Join-Path $env:SystemDrive 'Users\Default\NTUSER.DAT'
        if ((Invoke-Reg load 'HKLM\OEMTESTDEFAULT' $hive) -ne 0) { Fail 'Default-Profil laesst sich nicht pruefen (noch eingebunden?)' }
        else {
            try {
                $testKey = 'Registry::HKEY_LOCAL_MACHINE\OEMTESTDEFAULT\Software\OEM-Script-Gen-Test'
                $v = (Get-ItemProperty -LiteralPath $testKey -ErrorAction SilentlyContinue).DwordMax
                <#  0xFFFFFFFF: je nach Weg als Int32 -1 oder als 4294967295 gelesen #>
                if (-not ($v -eq -1 -or $v -eq 4294967295)) {
                    Fail ('Default-Profil: Wert aus Beispiel.reg fehlt (gelesen: ' + $v + ')')
                    Write-Host ('        Schluessel vorhanden: ' + (Test-Path -LiteralPath $testKey))
                    Get-ChildItem -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\OEMTESTDEFAULT\Software' -ErrorAction SilentlyContinue |
                        ForEach-Object { Write-Host ('        Software\' + $_.PSChildName) }
                    Get-ItemProperty -LiteralPath $testKey -ErrorAction SilentlyContinue | Format-List | Out-String | Write-Host
                } else { Ok 'Default-Profil: Wert aus Beispiel.reg vorhanden' }
                $h = (Get-ItemProperty -LiteralPath 'Registry::HKEY_LOCAL_MACHINE\OEMTESTDEFAULT\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced' -ErrorAction SilentlyContinue).HideFileExt
                if ($h -ne 0) { Fail 'Default-Profil: Tweak HideFileExt fehlt' } else { Ok 'Default-Profil: Tweak HideFileExt' }
            } finally {
                [gc]::Collect(); [gc]::WaitForPendingFinalizers()
                $null = Invoke-Reg unload 'HKLM\OEMTESTDEFAULT'
            }
        }
    }

    # 4c. Diagnose.ps1 darf nicht abbrechen
    foreach ($profile in @('voll', 'standard')) {
        $diag = $null
        foreach ($base in @('sources\$OEM$', '$OEM$')) {
            $p = Join-Path $Root (Join-Path $profile (Join-Path $base '$1\Install\Diagnose.ps1'))
            if (Test-Path -LiteralPath $p) { $diag = $p; break }
        }
        if (-not $diag) { Fail ($profile + ': Diagnose.ps1 nicht gefunden'); continue }
        $out = & (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File $diag 2>&1
        $text = ($out | Out-String)
        if ($text -match 'ParserError|Exception calling|is not recognized as the name of a cmdlet|CommandNotFoundException') {
            Fail ($profile + ': Diagnose.ps1 meldet einen Skriptfehler')
            Write-Host $text
        } else { Ok ($profile + ': Diagnose.ps1 laeuft durch') }
    }

    foreach ($k in @($userKey, $machineKey, $classKey)) { Remove-Item -LiteralPath $k -Recurse -Force -ErrorAction SilentlyContinue }
}

if ($script:failures) {
    Write-Host ('test-powershell: ' + $script:failures + ' Fehler.') -ForegroundColor Red
    exit 1
}
Write-Host 'test-powershell: alles in Ordnung.' -ForegroundColor Green
exit 0
