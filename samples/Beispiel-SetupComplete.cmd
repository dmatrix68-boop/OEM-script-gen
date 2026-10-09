@echo off
REM Beispiel eines vorhandenen Skripts zum Testen des Imports.
setlocal EnableExtensions
set LOG=%WINDIR%\Temp\SetupComplete.log
echo [%date% %time%] Start > "%LOG%"

winget install --id 7zip.7zip --exact --silent --accept-package-agreements
winget install --id Notepad++.Notepad++ -e --silent

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Install\Extras\Konfiguration.ps1"

reg add "HKLM\SOFTWARE\Firma\Image" /v BuildDatum /t REG_SZ /d "2026-01-01" /f
net user Techniker /add /passwordreq:yes

echo [%date% %time%] Ende >> "%LOG%"
exit /b 0
