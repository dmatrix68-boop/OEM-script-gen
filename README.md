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
* **autounattend.xml** – wird als Auslöser erzeugt oder, wenn Sie bereits eine
  Antwortdatei verwenden, importiert und **ergänzt statt ersetzt**: die Aufrufe
  werden mit fortlaufender `<Order>` in die vorhandenen Blöcke eingefügt.
* **Diagnose.ps1** – liegt im erzeugten Paket und beantwortet nach der
  Installation, warum nichts gelaufen ist.
* **Vorschau** aller erzeugten Dateien, **Projektdatei** zum Speichern und
  Weiterarbeiten, ZIP-Export.

## Zwei-Phasen-Modell

| Phase | Auslöser | Kontext | Geeignet für |
|-------|----------|---------|--------------|
| 1 | `SetupComplete.cmd` am Ende des Setups | SYSTEM, vor der ersten Anmeldung | Registry, Bloatware, Office (ODT) |
| 2 | Geplante Aufgabe oder `RunOnce` bei der ersten Anmeldung | SYSTEM bzw. erster Benutzer | winget-Pakete, alles mit Netzwerkbedarf |

## Auslöser – warum `SetupComplete.cmd` allein nicht reicht

Windows Setup führt `SetupComplete.cmd` **nicht** aus, wenn die Installation einen
Produktschlüssel aus dem OEM-Kanal verwendet – etwa den im BIOS/UEFI hinterlegten
Schlüssel eines Markengeräts. Betroffen sind die Client-Editionen (Home, Pro);
Enterprise und Windows Server sind ausgenommen. Im Setup-Protokoll
`C:\Windows\Panther\setupact.log` steht dann sinngemäß:

```
Client OS edition and OEM license detected and no enterprise edition detected,
will not run SetupComplete.cmd
```

Der Generator bietet deshalb drei Auslöser an, standardmäßig beide gemeinsam:

| Auslöser | Phase 1 | Phase 2 | von der OEM-Sperre betroffen |
|---|---|---|---|
| `SetupComplete.cmd` | am Ende des Setups | geplante Aufgabe / RunOnce | **ja** |
| `autounattend.xml` | `specialize`-Pass | `FirstLogonCommands` | nein |

Mehrfachausführung ist unschädlich: `Install.ps1` vermerkt jede abgeschlossene
Phase unter `HKLM\SOFTWARE\OEM-Setup` und überspringt sie beim nächsten Aufruf;
`-Force` erzwingt die Wiederholung.

## Wo gehört `$OEM$` hin?

Das hängt von der Antwortdatei ab – eine falsche Ablage ist die häufigste Ursache
dafür, dass gar nichts kopiert wird:

| Antwortdatei | Ablageort |
|---|---|
| keine, oder `UseConfigurationSet` nicht gesetzt | `<Medium>\sources\$OEM$\…` |
| `<UseConfigurationSet>true</UseConfigurationSet>` | `<Medium>\$OEM$\…` (Wurzelverzeichnis) |

Bei `UseConfigurationSet=true` sucht Setup den Konfigurationssatz **neben der
Antwortdatei**. Der Generator erkennt das beim Import und stellt die Ablage auf
„beide Orte“ – Setup wertet nur den passenden aus, der andere Ordner wird
ignoriert. Das ist die Voreinstellung.

Hintergrund zu den Phasen: In Phase 1 ist `winget` nur eingeschränkt nutzbar – der App Installer ist
ein MSIX-Paket, das unter SYSTEM nicht im Suchpfad liegt (der Generator löst den Pfad
unter `Program Files\WindowsApps` selbst auf), und Pakete, die ausschließlich
benutzerbezogen installieren, schlagen ohne Benutzerprofil fehl. Deshalb ist für
Anwendungen standardmäßig Phase 2 vorgewählt.

## Erzeugte Struktur

```
autounattend.xml                            → Wurzelverzeichnis des Mediums
sources/$OEM$/  bzw.  $OEM$/
├── $$/Setup/Scripts/SetupComplete.cmd     → %WINDIR%\Setup\Scripts
└── $1/Install/                            → C:\Install
    ├── Install.ps1                        Steuerskript (-Phase Setup|FirstLogon|Manual)
    ├── Diagnose.ps1                       Fehlersuche nach der Installation
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

### Wenn nichts passiert ist

Auf dem installierten System in einer administrativen PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Install\Diagnose.ps1
```

Das Skript prüft Dateien, Ausführungsmarker, geplante Aufgabe und Protokolle,
wertet `setupact.log` aus und meldet ausdrücklich, wenn Setup `SetupComplete.cmd`
wegen des OEM-Lizenzkanals verweigert hat oder wenn `$OEM$` am falschen Ort lag.

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
* Läuft Phase 1 über den `specialize`-Pass, verzögert jedes Modul das Setup, weil
  Windows auf das Ende des Befehls wartet. Langläufer wie die Office-Installation
  gehören deshalb besser in Phase 2.
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
