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
  Auswertung (Produkte, Sprachen, Kanal) und Prüfung auf unbeaufsichtigte
  Installation. Läuft standardmäßig in Phase 2, weil das Deployment Tool die
  Installationsdateien aus dem Netz lädt.
* **System-Tweaks** – rund 35 Einstellungen zu Explorer, Taskleiste, Datenschutz,
  System und Netzwerk. Benutzerbezogene Werte werden in Phase 1 in
  `C:\Users\Default\NTUSER.DAT` geschrieben und gelten damit für neue Konten.
  Einstellungen, die einen laufenden Netzwerk- oder Dienststack brauchen, werden
  automatisch in Phase 2 nachgeholt (siehe unten).
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

Gleichzeitige Läufe werden doppelt abgesichert. Ein benannter Mutex allein
genügt nicht: Legt ihn SYSTEM mit Standardrechten an, scheitert ein Lauf im
Benutzerkontext beim Öffnen an „Zugriff verweigert" und liefe ungebremst
parallel. Der Mutex wird deshalb mit einer Zugriffsregel für alle erstellt, und
zusätzlich hält `Install.ps1` eine Laufmarkierung mit Prozesskennung in der
Registry, die jeder Kontext lesen kann. Deckt die autounattend.xml Phase 2 schon
über `FirstLogonCommands` ab, startet die geplante Aufgabe erst 15 Minuten
verzögert — als Rückfall, nicht als zweiter gleichzeitiger Lauf.

### Warum manche Tweaks erst in Phase 2 laufen

Im `specialize`-Pass ist der Netzwerkstack noch nicht initialisiert. Cmdlets wie
`Get-NetConnectionProfile`, `Enable-NetFirewallRule` oder
`Disable-WindowsOptionalFeature` warten dort unter Umständen endlos — und weil
Windows Setup auf das Ende des Befehls wartet, **bleibt die gesamte Installation
stehen**. `-ErrorAction SilentlyContinue` hilft dagegen nicht: Es unterdrückt
Fehler, nicht das Blockieren.

Dieselbe Verschiebung gilt für Einstellungen, die ein angelegtes Benutzerkonto
brauchen — etwa „Anzeigename des Benutzerkontos berichtigen". Windows zeigt in
den Kontoeinstellungen den vollständigen Namen (`FullName`) und nur ersatzweise
den Kontonamen; kurz nach einer Installation steht dort mitunter ein Platzhalter
wie `USER`. **In aller Regel zieht Windows den richtigen Namen von selbst nach**,
der Tweak ist also kein Standardfall — er ist für Installationen gedacht, bei
denen der Platzhalter stehen bleibt. Er setzt `FullName` auf den Kontonamen, und
auch das nur dort, wo wirklich ein Platzhalter steht: selbstvergebene Namen,
deaktivierte Konten und Systemkonten bleiben unangetastet.

Betroffene Einträge sind im Katalog mit `deferPs` markiert (`deferReason`
unterscheidet Netzwerk- von Konto-Abhängigkeit). Steht das Tweak-Modul
auf Phase 1, erzeugt der Generator daraus ein zweites Modul
`Set-Tweaks-Spaet.ps1`, das in Phase 2 läuft; die Registry-Anteile desselben
Tweaks bleiben in Phase 1. Jeder dieser Aufrufe läuft zusätzlich über
`Invoke-WithTimeout` mit eigener Zeitgrenze, wird nach deren Ablauf abgebrochen
und protokolliert — ein hängendes Cmdlet kann den Ablauf also nicht mehr
blockieren.

Der Block läuft dabei in einem eigenen Runspace und kennt die Funktionen aus
`OEM-Common.ps1` nicht; `deferPs`-Tweaks dürfen deshalb nur native Cmdlets
verwenden.

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

### Office braucht ein Netzwerk

Das Office Deployment Tool lädt die Installationsdateien von Microsoft — auch
dann, wenn die `setup.exe` mitgeliefert wird; das Archiv enthält nur das
Werkzeug, nicht Office selbst. In Phase 1 (`specialize`) steht aber noch keine
Netzwerkverbindung zur Verfügung, genau wie bei den Netzwerk-Tweaks oben.

Das Office-Modul steht deshalb auf Phase 2. Ohne Netzwerk und ohne lokale Quelle
bricht es mit einer erklärenden Meldung ab, statt ins Leere zu laufen.

#### Offline-Installation aus mitgelieferter Quelle

Für Phase 1 — oder für Rechner ohne Internetzugang — stellt man die
Installationsquelle unter *Office → Installationsquelle* auf **lokal
mitgeliefert**. Der Generator trägt dann `SourcePath` in die
`Configuration.xml` ein und legt im Paket an:

```
Office/
├─ setup.exe                      (ODT, selbst ablegen)
├─ Configuration.xml              SourcePath=C:\Install\Office\Quelle
├─ Download-Quelle.ps1            erzeugt die Quelle
└─ Quelle/                        hierhin kommt Office\Data\…
```

Die Quelle selbst landet **nicht** im ZIP — mehrere Gigabyte durch den Browser
zu schleusen ist nicht praktikabel. Stattdessen führt man nach dem Entpacken auf
dem Vorbereitungsrechner einmal aus:

```powershell
powershell -ExecutionPolicy Bypass -File Office\Download-Quelle.ps1
```

Das Skript liest die `Configuration.xml`, lädt genau die darin konfigurierten
Produkte und Sprachen per `setup.exe /download` in den Quellordner und meldet
am Ende die belegte Größe. Danach kommt der gefüllte Ordner mit aufs Medium.

`Install-Office.ps1` prüft zur Laufzeit, ob unter `SourcePath` tatsächlich
`Office\Data` liegt. Fehlt die Quelle — etwa weil sie nicht mitkopiert wurde —,
entfernt es `SourcePath` aus einer Arbeitskopie der Antwortdatei und installiert
online weiter, statt an einem leeren Ordner zu scheitern.

### winget braucht einen Benutzerkontext

`winget.exe` ist Teil eines MSIX-Pakets. Erreichbar ist es über den
App-Execution-Alias unter `%LOCALAPPDATA%\Microsoft\WindowsApps\winget.exe` —
und den gibt es **nur je Benutzer**. Ruft man die Datei stattdessen direkt aus
`C:\Program Files\WindowsApps\…` auf, wie es unter SYSTEM naheliegt, bricht sie
mit `0xC0000135` (`-1073741515`, DLL nicht gefunden) ab, weil die
MSIX-Abhängigkeiten nicht aufgelöst werden.

Gemessen an einem Durchlauf mit 33 Paketen: als SYSTEM 3 erfolgreich, im
Benutzerkontext 33. Für Anwendungen muss Phase 2 deshalb im Benutzerkontext
laufen — über `FirstLogonCommands` der autounattend.xml oder über `RunOnce`.
`Resolve-Winget` prüft jeden Kandidaten vorab mit `--version` und bricht mit
einer erklärenden Meldung ab, statt jedes Paket einzeln scheitern zu lassen.

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

### Die Installation muss vom Medium gebootet werden

`$OEM$` und `autounattend.xml` wertet Windows Setup nur aus, wenn vom
Installationsmedium **gebootet** wird. Startet man `setup.exe` aus einem
laufenden Windows heraus, läuft Setup in der Downlevel-Phase (Arbeitsordner
`C:\$WINDOWS.~BT`) und ignoriert beides. Die Setup-Protokolle dieser Phase liegen
unter `C:\$WINDOWS.~BT\Sources\Panther\` – `Diagnose.ps1` durchsucht sie mit.

### Wenn nichts passiert ist

Auf dem installierten System in einer administrativen PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Install\Diagnose.ps1
```

Liegt das Paket woanders — etwa noch auf dem Medium —, findet das Skript seinen
eigenen Ordner selbst; mit `-InstallRoot <Pfad>` lässt sich er auch vorgeben.

Das Skript prüft Dateien, Ausführungsmarker, geplante Aufgabe und Protokolle,
wertet `setupact.log` aus und meldet ausdrücklich, wenn Setup `SetupComplete.cmd`
wegen des OEM-Lizenzkanals verweigert hat oder wenn `$OEM$` am falschen Ort lag.

Mit `-Export` packt es die relevanten Stellen in ein ZIP von typischerweise
wenigen Kilobyte – die passenden Zeilen aus allen `setupact.log`-Fundorten, die
eigenen Protokolle und den Systemzustand. Das ist das, was man zum Weitergeben
braucht; ganze Setup-Ordner sind dafür nicht nötig:

```powershell
powershell -ExecutionPolicy Bypass -File C:\Install\Diagnose.ps1 -Export
```

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

## Entwicklung

Die PowerShell-Skripte entstehen in JavaScript-Template-Literalen. Dort
verschluckt JavaScript Backslash-Folgen, die es nicht als Escape kennt: aus
`'\s+'` wird `'s+'`, aus `'\|'` wird `'|'` — der erzeugte Code enthält dann
stillschweigend ein anderes Muster. So entstand unter anderem ein `-split`, das
nie etwas trennte, und ein `-replace`, das jedes „s" durch ein Leerzeichen
ersetzte. Im Template-Literal gehören solche Folgen deshalb verdoppelt
(`\\s+`). Dagegen prüft:

```bash
node tools/check-escapes.js
```

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
tools/            check-escapes.js – prüft die Template-Literale auf verschluckte Escapes
```
