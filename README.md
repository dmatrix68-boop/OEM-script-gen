# OEM Script Generator

Web-Oberfläche zum Erzeugen von Installationsskripten für den `$OEM$`-Ordner eines
Windows-11-Installationsmediums. Konfiguration im Browser, Ergebnis ist ein ZIP mit
der fertigen Ordnerstruktur, die direkt in die ISO bzw. auf den USB-Stick kopiert wird.

Läuft vollständig lokal: keine Server-Komponente, keine externen Bibliotheken, kein
Build-Schritt. `index.html` im Browser öffnen genügt (auch per `file://`).

## Funktionen

* **Import bestehender Skripte** – `SetupComplete.cmd`/`.bat` wird analysiert:
  `winget install`-Aufrufe werden zu Paketen, ODT-Aufrufe erkannt, alles Übrige
  bleibt als „eigene Befehle“ unverändert erhalten. Ebenfalls importierbar:
  ODT-`Configuration.xml`, PowerShell-Skripte, beliebige Binärdateien.
* **UniGetUI-Import** – `.ubundle` (JSON, XML, YAML) und winget-`export`-Dateien.
  Nicht-winget-Manager (Chocolatey, Scoop, npm, pip, Cargo, .NET Tool) werden
  übernommen und passend installiert; Chocolatey wird bei Bedarf nachinstalliert.
  Beim Export entsteht wieder ein `.ubundle`, das UniGetUI einlesen kann.
* **Microsoft Office (ODT)** – Configuration.xml importieren oder bearbeiten, mit
  Auswertung (Produkte, Sprachen, Kanal) und Prüfung auf unbeaufsichtigte Installation.
* **System-Tweaks** – rund 35 Einstellungen zu Explorer, Taskleiste, Datenschutz,
  System und Netzwerk. Benutzerbezogene Werte werden in Phase 1 in
  `C:\Users\Default\NTUSER.DAT` geschrieben und gelten damit für neue Konten.
* **Bloatware** – Auswahl vorinstallierter AppX-Pakete inkl. Provisioning-Entfernung.
* **Eigene Dateien** – Installer und Skripte mitliefern, wahlweise nach
  `Install\Files` (wird ausgeführt) oder neben `SetupComplete.cmd` in
  `Setup\Scripts` (über `%~dp0` erreichbar).
* **Vorschau** aller erzeugten Dateien, **Projektdatei** zum Speichern und
  Weiterarbeiten, ZIP-Export.

## Zwei-Phasen-Modell

| Phase | Auslöser | Kontext | Geeignet für |
|-------|----------|---------|--------------|
| 1 | `SetupComplete.cmd` am Ende des Setups | SYSTEM, vor der ersten Anmeldung | Registry, Bloatware, Office (ODT) |
| 2 | Geplante Aufgabe oder `RunOnce` bei der ersten Anmeldung | SYSTEM bzw. erster Benutzer | winget-Pakete, alles mit Netzwerkbedarf |

Hintergrund: In Phase 1 ist `winget` nur eingeschränkt nutzbar – der App Installer ist
ein MSIX-Paket, das unter SYSTEM nicht im Suchpfad liegt (der Generator löst den Pfad
unter `Program Files\WindowsApps` selbst auf), und Pakete, die ausschließlich
benutzerbezogen installieren, schlagen ohne Benutzerprofil fehl. Deshalb ist für
Anwendungen standardmäßig Phase 2 vorgewählt.

## Erzeugte Struktur

```
sources/$OEM$/
├── $$/Setup/Scripts/SetupComplete.cmd     → %WINDIR%\Setup\Scripts
└── $1/Install/                            → C:\Install
    ├── Install.ps1                        Steuerskript (-Phase Setup|FirstLogon|Manual)
    ├── Lib/OEM-Common.ps1                 Logging, Registry-Helfer, winget-Auflösung
    ├── Modules/                            Set-Tweaks, Remove-Bloatware,
    │                                       Install-Office, Install-Apps,
    │                                       Install-Files-P1/P2, Invoke-Custom
    ├── Office/Configuration.xml
    ├── Apps/  Paketliste.csv, packages.json, *.ubundle
    └── Logs/                              Protokolle und Transcripts
```

## Verwendung

1. `index.html` öffnen (Chrome, Edge oder Firefox).
2. Bestehende Skripte bzw. das UniGetUI-Bundle per Drag & Drop ablegen.
3. Module konfigurieren, Vorschau prüfen, **ZIP erzeugen**.
4. Inhalt des ZIPs in das Wurzelverzeichnis des Installationsmediums kopieren, sodass
   `<Medium>\sources\$OEM$\...` entsteht. Der im ZIP enthaltene `LIESMICH.txt` listet
   auf, was noch fehlt (z. B. `setup.exe` des Office Deployment Tools).

### Test ohne Neuinstallation

Auf einem Testsystem in einer administrativen PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Install\Install.ps1 -Phase Manual
powershell -ExecutionPolicy Bypass -File C:\Install\Install.ps1 -Phase Manual -Only Set-Tweaks.ps1
```

## Hinweise

* Die erzeugten `.ps1`-Dateien werden mit UTF-8-BOM geschrieben, damit Windows
  PowerShell 5.1 Umlaute korrekt liest.
* `$OEM$` wird nur ausgewertet, wenn das Setup von diesem Medium gestartet wird.
  Eine parallel verwendete `autounattend.xml` bleibt unberührt und gehört weiterhin
  in das Wurzelverzeichnis des Mediums.
* Beim Speichern eines Projekts werden mitgelieferte Binärdateien **nicht** in die
  Projektdatei aufgenommen – sie müssen nach dem Laden erneut hinzugefügt werden.

## Projektaufbau

```
index.html        Oberfläche
css/app.css       Layout
js/zip.js         ZIP-Writer (Deflate über CompressionStream, sonst „stored“)
js/catalog.js     Tweak- und Bloatware-Katalog, Paketmanager-Definitionen
js/importers.js   Parser für Bundles, SetupComplete.cmd und ODT-XML
js/templates.js   Erzeugung sämtlicher Skripte
js/app.js         Zustand, Oberfläche, Import/Export
samples/          Beispieldateien zum Testen der Importfunktion
```
