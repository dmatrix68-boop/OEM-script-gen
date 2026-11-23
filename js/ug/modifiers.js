/*  Antwortdatei-Generator - Modifier.

    Port von https://github.com/cschneegans/unattend-generator/tree/master/modifier
    Copyright (c) Christoph Schneegans, MIT-Lizenz (vendor/schneegans/LICENSE.txt).
    Port-Stand und Status je Datei: vendor/schneegans/UPSTREAM.json.

    Je Datei des Originals ein Abschnitt mit gleichem Namen, in derselben
    Reihenfolge wie in Main.cs (GenerateXml). Nicht portierte Modifier stehen
    als Platzhalter in der Liste, damit die Reihenfolge erkennbar bleibt.

    Konfiguration (Gegenstueck zu Configuration in Main.cs, als JSON):
      language:   { mode: 'interactive' | 'unattended', image, locales: [{ locale, keyboard }], geo }
      account:    { mode: 'interactive-ms' | 'interactive-local' | 'unattended',
                    accounts: [{ name, displayName, password, group }],
                    autoLogon: 'none' | 'own' | 'builtin', builtinPassword, obscure }
      lockout:    { mode: 'default' | 'disabled' | 'custom', threshold, duration, window }
      passwordExpiration: { mode: 'default' | 'unlimited' | 'custom', maxAge }
      computerName: { mode: 'random' | 'custom' | 'prompt', name }
      timeZone:   { mode: 'implicit' | 'explicit', id }
      wifi:       { mode: 'interactive' | 'skip' | 'unattended' | 'xml', name, password,
                    authentication: 'Open' | 'WPA2PSK' | 'WPA3SAE', connectAutomatically, nonBroadcast, xml }
      appLocker:  { mode: 'skip' | 'configure', policyXml }
      edition:    { mode: 'interactive' | 'firmware' | 'edition' | 'key', edition, key }
      activationKey, bypassRequirements, bypassNetwork, useConfigurationSet,
      expressSettings: 'interactive' | 'enableAll' | 'disableAll',
      architectures: ['amd64' | 'x86' | 'arm64'],
      hidePowerShellWindows, keepSensitiveFiles, useNarrator */
(function (global) {
  'use strict';
  const UG = global.UG;
  const { ConfigurationException, lookup, res, inRange } = UG;
  const ADMINISTRATORS = 'Administrators';

  /* ---------- modifier/Build.cs ----------
     PORT: Statt des eigenen Build-Hashs steht hier der Upstream-Commit, auf
     dem der Port beruht (vendor/schneegans/UPSTREAM.json). */
  const Build = {
    name: 'Build',
    process(c) {
      const commit = UG.portCommit;
      if (!commit) return;
      c.sel('//s:Build/s:Commit/s:Hash').textContent = commit;
      c.sel('//s:Build/s:Commit/s:GitHubUrl').textContent = 'https://github.com/cschneegans/unattend-generator/commit/' + commit;
    }
  };

  /* ---------- modifier/Accessibility.cs ---------- */
  const Accessibility = {
    name: 'Accessibility',
    process(c) {
      if (!c.config.useNarrator) return;
      c.appender('windowsPE').append(c.cb.shellCommand('start X:\\Windows\\System32\\Narrator.exe'));
      c.specializeScript.append("& 'C:\\Windows\\System32\\Narrator.exe';\r\n" +
        'reg.exe ADD "HKLM\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Accessibility" /v Configuration /t REG_SZ /d narrator /f;');
      c.userOnceScript.append("& 'C:\\Windows\\System32\\Narrator.exe';\r\n" +
        'reg.exe ADD "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Accessibility" /v Configuration /t REG_SZ /d narrator /f;');
    }
  };

  /* ---------- modifier/ComputerName.cs ---------- */
  function validateComputerName(name) {
    const bad = () => { throw new ConfigurationException("Computer name '" + name + "' is invalid."); };
    if (!name || !name.trim()) bad();
    if (name.length > 15) bad();
    if (/\s/.test(name)) bad();
    if (/^[0-9]+$/.test(name)) bad();
    if (/[{|}~[\\\]^':;<=>?@!"#$%`()+/.,*&]/.test(name)) bad();
    return name;
  }
  const ComputerName = {
    name: 'ComputerName',
    process(c) {
      const s = c.config.computerName || { mode: 'random' };
      const set = (value) => c.newSimpleElement('ComputerName', c.getOrCreateElement('specialize', 'Microsoft-Windows-Shell-Setup'), value);
      if (s.mode === 'custom') {
        set(validateComputerName(s.name));
      } else if (s.mode === 'prompt' || s.mode === 'script') {
        set('TEMPNAME');
        const getterFile = c.embedTextFile('GetComputerName.ps1', s.mode === 'prompt' ? res('ComputerNamePrompt.ps1') : s.script);
        const setterFile = c.embedTextFileFromResource('SetComputerName.ps1');
        c.specializeScript.append(
          "[string] $newName = & '" + getterFile + "';\r\n" +
          "$newName > 'C:\\Windows\\Setup\\Scripts\\ComputerName.txt';\r\n" +
          "\"Will set the computer name to '${newName}'.\";\r\n" +
          "Start-Process -FilePath ( Get-Process -Id $PID ).Path -ArgumentList '-ExecutionPolicy \"Unrestricted\" -NoProfile -File \"" + setterFile + "\"' -WindowStyle 'Hidden';\r\n" +
          'Start-Sleep -Seconds 10;');
      } else if (s.mode !== 'random') {
        throw new Error('Unbekannter Modus fuer den Computernamen: ' + s.mode);
      }
    }
  };

  /* ---------- modifier/Bypass.cs ---------- */
  const Bypass = {
    name: 'Bypass',
    process(c) {
      const peDefault = !c.config.pe || c.config.pe.mode === 'default';
      if (peDefault && c.config.bypassRequirements) {
        const a = c.appender('windowsPE');
        for (const v of ['BypassTPMCheck', 'BypassSecureBootCheck', 'BypassRAMCheck']) {
          a.append(c.cb.registryCommand('add "HKLM\\SYSTEM\\Setup\\LabConfig" /v ' + v + ' /t REG_DWORD /d 1 /f'));
        }
      }
      if (c.config.bypassNetwork) {
        c.specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\OOBE" /v BypassNRO /t REG_DWORD /d 1 /f;');
      }
    }
  };

  /* ---------- modifier/ProductKey.cs ---------- */
  function productKey(value) {
    if (!/^([A-Z0-9]{5}-){4}[A-Z0-9]{5}$/i.test(value || '')) throw new ConfigurationException("Product key '" + value + "' is ill-formed.");
    return value.toUpperCase();
  }
  const ProductKey = {
    name: 'ProductKey',
    process(c) {
      const e = c.config.edition || { mode: 'interactive' };
      const keyElement = c.sel('//u:UserData/u:ProductKey/u:Key');
      const uiElement = c.sel('//u:UserData/u:ProductKey/u:WillShowUI');
      const set = (key, ui) => { keyElement.textContent = key; uiElement.textContent = ui; };
      const peDefault = !c.config.pe || c.config.pe.mode === 'default';
      if (peDefault) switch (e.mode) {
        case 'edition': set(lookup('WindowsEdition', e.edition).ProductKey, 'OnError'); break;
        case 'key': set(productKey(e.key), 'OnError'); break;
        case 'interactive': set('00000-00000-00000-00000-00000', 'Always'); break;
        case 'firmware': keyElement.parentNode.removeChild(keyElement); uiElement.textContent = 'Never'; break;
        default: throw new Error('Unbekannter Modus fuer die Edition: ' + e.mode);
      }
      const activation = c.config.activationKey ? productKey(c.config.activationKey) : (peDefault && e.mode === 'key' ? productKey(e.key) : null);
      if (activation) c.getOrCreateElement('specialize', 'Microsoft-Windows-Shell-Setup', 'ProductKey').textContent = activation;
    }
  };

  /* ---------- modifier/Locales.cs ---------- */
  const Locales = {
    name: 'Locales',
    process(c) {
      const componentPe = c.sel("//u:component[@name = 'Microsoft-Windows-International-Core-WinPE']");
      const componentOobe = c.sel("//u:component[@name = 'Microsoft-Windows-International-Core']");
      const s = c.config.language || { mode: 'interactive' };
      if (s.mode === 'interactive') {
        componentPe.parentNode.removeChild(componentPe);
        componentOobe.parentNode.removeChild(componentOobe);
        return;
      }
      const image = lookup('ImageLanguage', s.image);
      const pairs = (s.locales || []).filter((p) => p && p.locale && p.keyboard).slice(0, 3)
        .map((p) => ({ locale: lookup('UserLocale', p.locale), keyboard: lookup('KeyboardIdentifier', p.keyboard) }));
      if (!pairs.length) throw new ConfigurationException('At least one locale and keyboard must be selected.');
      const geo = lookup('GeoId', s.geo);

      const replacement = (pair) => {
        const found = UG.list('UserLocale').find((l) => l.Id.toLowerCase() === image.Id.toLowerCase());
        if (found) return found;
        if (image.Id === 'zh-CN') return lookup('UserLocale', 'zh');
        if (image.Id === 'zh-TW') return lookup('UserLocale', 'zh-Hant');
        return pair.locale;
      };
      const keyboards = pairs.map((pair) => {
        if (pair.keyboard.Type === 'IME') return pair.keyboard.Id;
        if (pair.locale.LCID === '1000') return replacement(pair).LCID + ':' + pair.keyboard.Id;
        return pair.locale.LCID + ':' + pair.keyboard.Id;
      }).join(';');

      c.sel('u:UILanguage', componentPe).textContent = image.Id;
      c.sel('u:InputLocale', componentOobe).textContent = keyboards;
      c.sel('u:SystemLocale', componentOobe).textContent = pairs[0].locale.Id;
      c.sel('u:UserLocale', componentOobe).textContent = pairs[0].locale.Id;
      c.sel('u:UILanguage', componentOobe).textContent = image.Id;

      if (geo.Id !== pairs[0].locale.GeoLocation) {
        c.userOnceScript.append('Set-WinHomeLocation -GeoId ' + geo.Id + ';');
      }
    }
  };

  /* ---------- modifier/Disk.cs ----------
     Standard (DefaultPESettings): Windows Setup partitioniert, nur
     UseConfigurationSet wird gesetzt. "generate"/"script" (ICmdPESettings):
     Die windowsPE-Phase uebernimmt ein eigenes pe.cmd - Zieldatentraeger
     waehlen, mit diskpart partitionieren, Image per dism anwenden, bcdboot,
     $OEM$ per robocopy kopieren, neu starten.

     csRaw bildet C#-Raw-Strings nach (""" ... """): erste und letzte Zeile
     entfallen, die Einrueckung der letzten Zeile wird von allen Zeilen
     abgezogen, reine Leerraum-Zeilen werden leer. So bleiben die Bloecke des
     Originals fast wortgleich und lassen sich bei Aenderungen vergleichen.
     Eingesetzte Werte duerfen keine Zeilenumbrueche enthalten. */
  function csRaw(strings, ...vals) {
    const text = String.raw({ raw: strings.raw }, ...vals);
    const lines = text.split('\n');
    const indent = lines[lines.length - 1];
    if (lines[0].trim() !== '' || indent.trim() !== '') throw new Error('csRaw: Block muss mit Zeilenumbruch beginnen und enden.');
    return lines.slice(1, -1).map((l) => (l.trim() === '' ? '' : (l.startsWith(indent) ? l.slice(indent.length) : l))).join('\n');
  }
  /* StringWriter mit WriteLine (Zeilenende \n) und Util.SplitLines */
  function cmdWriter() {
    const parts = [];
    return {
      writeLine: (s) => parts.push((s === undefined ? '' : s) + '\n'),
      lines: () => UG.csSplitLines(parts.join(''))
    };
  }
  const W = 'W', S = 'S', R = 'R';                  // DriveLetters
  const PATHS = { PEScript: 'X:\\pe.cmd', DiskpartScript: 'X:\\diskpart.txt', TargetDiskScript: 'X:\\target.vbs', TargetDiskOutput: 'X:\\target.out' };
  const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const SKIPPED = ['A', 'B'];
  const DEFAULT_TARGET = { minSizeGiB: 100, maxSizeGiB: 4000, index: 0, assertNoPartitions: true, assertInterfaceType: false, assertMediaType: false };

  function getTargetDiskScript(g) {
    const w = cmdWriter();
    w.writeLine(csRaw`
      Function Fail(message)
        WScript.Echo message
        WScript.Quit 1
      End Function

      On Error Resume Next
      Set wmi = GetObject("winmgmts:\\.\root\cimv2")
      Set drives = wmi.InstancesOf("Win32_DiskDrive")
      If Err.Number <> 0 Then
        Fail "Could not enumerate disks: " & Err.Description
      End If
      Set accepted = CreateObject("Scripting.Dictionary")

      For Each drive In drives
        accept = True

      `);
    if (g.assertInterfaceType) {
      w.writeLine(csRaw`
          actual = drive.InterfaceType
          If actual <> "IDE" And actual <> "SCSI" Then
            accept = False
          End If

        `);
    }
    if (g.assertMediaType) {
      w.writeLine(csRaw`
          actual = drive.MediaType
          If actual <> "Fixed hard disk media" Then
            accept = False
          End If

        `);
    }
    if (g.minSizeGiB !== null && g.minSizeGiB !== undefined) {
      w.writeLine(csRaw`
          actual = CInt(drive.Size / 1024 / 1024 / 1024)
          expected = ${g.minSizeGiB}
          If actual < expected Then
            accept = False
          End If

        `);
    }
    if (g.maxSizeGiB !== null && g.maxSizeGiB !== undefined) {
      w.writeLine(csRaw`
          actual = CInt(drive.Size / 1024 / 1024 / 1024)
          expected = ${g.maxSizeGiB}
          If actual > expected Then
            accept = False
          End If

        `);
    }
    if (g.index !== null && g.index !== undefined) {
      w.writeLine(csRaw`
          actual = drive.Index
          expected = ${g.index}
          If actual <> expected Then
            accept = False
          End If

        `);
    }
    if (g.assertNoPartitions) {
      w.writeLine(csRaw`
          actual = drive.Partitions
          If actual > 0 Then
            accept = False
          End If

        `);
    }
    w.writeLine(csRaw`
        If accept Then
          accepted.Add drive.Index, ""
        End If
      Next

      If accepted.Count = 0 Then
        Fail "No disk satisfied the given criteria."
      ElseIf accepted.Count > 1 Then
        Fail "Several disks (" & Join(accepted.Keys, ", ") & ") satisfied the given criteria."
      Else
        WScript.Echo Join(accepted.Keys)
        WScript.Quit 0
      End If
      `);
    return w.lines();
  }

  function getDiskpartScript(p, layout) {
    const rec = (line) => (p.recovery === 'None' ? '' : line);
    const t = p.target || {};
    const targetDisk = t.mode === 'fixed' ? String(t.index === null || t.index === undefined || t.index === '' ? 0 : t.index) : '%TARGET_DISK%';
    if (layout === 'MBR') {
      return [
        'SELECT DISK=' + targetDisk,
        'CLEAN',
        'CREATE PARTITION PRIMARY SIZE=' + p.systemSize,
        'FORMAT QUICK FS=NTFS LABEL="System"',
        'ASSIGN LETTER=' + S,
        'ACTIVE',
        'CREATE PARTITION PRIMARY',
        rec('SHRINK MINIMUM=' + p.recoverySize),
        'FORMAT QUICK FS=NTFS LABEL="Windows"',
        'ASSIGN LETTER=' + W,
        rec('CREATE PARTITION PRIMARY'),
        rec('FORMAT QUICK FS=NTFS LABEL="Recovery"'),
        rec('ASSIGN LETTER=' + R),
        rec('SET ID=27')
      ];
    }
    if (layout === 'GPT') {
      return [
        'SELECT DISK=' + targetDisk,
        'CLEAN',
        'CONVERT GPT',
        'CREATE PARTITION EFI SIZE=' + p.systemSize,
        'FORMAT QUICK FS=FAT32 LABEL="System"',
        'ASSIGN LETTER=' + S,
        'CREATE PARTITION MSR SIZE=16',
        'CREATE PARTITION PRIMARY',
        rec('SHRINK MINIMUM=' + p.recoverySize),
        'FORMAT QUICK FS=NTFS LABEL="Windows"',
        'ASSIGN LETTER=' + W,
        rec('CREATE PARTITION PRIMARY'),
        rec('FORMAT QUICK FS=NTFS LABEL="Recovery"'),
        rec('ASSIGN LETTER=' + R),
        rec('SET ID="de94bba4-06d1-4d40-a16a-bfd50179d6ac"'),
        rec('GPT ATTRIBUTES=0x8000000000000001')
      ];
    }
    throw new Error('Unbekanntes Partitionslayout: ' + layout);
  }

  function getPEScript(config, pe) {
    const w = cmdWriter();
    const include = (path, lines, escape) => {
      if (!lines.length) return false;
      w.writeLine('>' + path + ' (');
      for (const line of UG.echoProcess(lines, escape)) w.writeLine('    ' + line);
      w.writeLine(')');
      w.writeLine();
      return true;
    };
    const lang = config.language || {};
    const unattendedLanguage = lang.mode === 'unattended';
    let firstPair = null, geo = null;
    if (unattendedLanguage) {
      const p0 = (lang.locales || []).filter((p) => p && p.locale && p.keyboard)[0];
      if (p0) firstPair = { locale: lookup('UserLocale', p0.locale), keyboard: lookup('KeyboardIdentifier', p0.keyboard) };
      geo = lookup('GeoId', lang.geo);
    }

    w.writeLine(csRaw`
      @echo off

      `);

    if (firstPair) {
      w.writeLine(csRaw`
          call :print "Setting keyboard layout for PE session"
          wpeutil.exe SetKeyboardLayout ${firstPair.locale.LCID}:${firstPair.keyboard.Id}

          `);
    }

    const probe = LETTERS.filter((l) => !SKIPPED.concat([S, W, R]).includes(l)).join(' ');
    w.writeLine(csRaw`
      for %%d in (${probe}) do (
          if exist %%d:\sources\install.wim set "IMAGE_FILE=%%d:\sources\install.wim"
          if exist %%d:\sources\install.esd set "IMAGE_FILE=%%d:\sources\install.esd"
          if exist %%d:\sources\install.swm set "IMAGE_FILE=%%d:\sources\install.swm" & set "SWM_PARAM=/SWMFile:%%d:\sources\install*.swm"
          if exist %%d:\autounattend.xml set "XML_FILE=%%d:\autounattend.xml"
          if exist %%d:\$OEM$ set "OEM_FOLDER=%%d:\$OEM$"
          if exist %%d:\$WinPEDriver$ set "PEDRIVERS_FOLDER=%%d:\$WinPEDriver$"
          if exist %%d:\$WinPEPackage$ set "MSU_FOLDER=%%d:\$WinPEPackage$"
      `);
    /* PORT: VirtIoGuestTools gibt es in der Oberflaeche nicht (Optimizations) */
    w.writeLine(csRaw`
      )
      for /f "tokens=3" %%t in ('reg.exe query HKLM\System\Setup /v UnattendFile 2^>nul') do ( if exist %%t set "XML_FILE=%%t" )
      if not defined IMAGE_FILE call :fail "Could not locate install.wim, install.esd or install.swm."
      if not defined XML_FILE call :fail "Could not locate autounattend.xml."

      `);

    w.writeLine(csRaw`
      set "OS_VERSION=11"
      for /f "tokens=3 delims=." %%v in ('ver') do (
          if %%v LSS 20000 set "OS_VERSION=10"
      )

      `);

    w.writeLine(csRaw`
      if defined PEDRIVERS_FOLDER (
          call :print "Loading drivers from %PEDRIVERS_FOLDER%"
          for /R %PEDRIVERS_FOLDER% %%f IN (*.inf) do drvload.exe "%%f"
      )

      `);

    const part = pe.partition || { mode: 'interactive' };
    {
      const runTargetDiskScript = (lines) => {
        include(PATHS.TargetDiskScript, lines, true);
        w.writeLine(csRaw`
          call :print "Determining target disk"
          (cscript.exe //E:vbscript "${PATHS.TargetDiskScript}" //Nologo >${PATHS.TargetDiskOutput}) || (type ${PATHS.TargetDiskOutput} & call :fail "Could not determine target disk. Windows Setup will halt to avoid potential data loss.")
          for /f %%t in (${PATHS.TargetDiskOutput}) do set "TARGET_DISK=%%t"

          `);
      };
      if (part.mode === 'unattended') {
        const t = part.target || { mode: 'generated' };
        switch (t.mode) {
          case 'interactive':
            w.writeLine(csRaw`
              echo list disk | diskpart.exe
              echo:
              :choice
              set /p "CHOICE=Enter index of the disk you want to install Windows to: " || goto :choice
              set "TARGET_DISK=%CHOICE%"

              `);
            break;
          case 'script': runTargetDiskScript(UG.csSplitLines(t.script || '')); break;
          case 'generated': runTargetDiskScript(getTargetDiskScript(generatedTarget(t))); break;
          case 'fixed': break;
          default: throw new Error('Unbekannte Zieldatentraeger-Einstellung: ' + t.mode);
        }
      }
    }

    {
      const checkDriveLetterAssignments = (lines) => {
        const check = (letter, purpose) => {
          const re = new RegExp('^\\s*ASSIGN\\s+LETTER((\\s+)|(\\s*=\\s*))((' + letter + ')|("' + letter + '"))\\s*$', 'i');
          if (!lines.some((l) => re.test(l))) {
            throw new ConfigurationException('Your diskpart script must contain a line such as \u2018ASSIGN LETTER=' + letter +
              '\u2019 to assign the drive letter \u2018' + letter + ':\u2019 to the ' + purpose + ' partition.');
          }
        };
        check(W, 'Windows');
        check(S, 'system');
      };
      const includeDiskpartScript = (path, lines, escape) => { checkDriveLetterAssignments(lines); include(path, lines, escape); };
      const execute = (path, message) => {
        w.writeLine(csRaw`
          call :print "${message}"
          `);
        if (pe.pauseBeforeFormatting) w.writeLine('pause');
        w.writeLine(csRaw`
          diskpart.exe /s ${path} || call :fail "diskpart.exe encountered an error."

          `);
      };

      w.writeLine(csRaw`
        wpeutil.exe UpdateBootInfo
        for /f "tokens=3" %%t in ('reg.exe query HKLM\System\CurrentControlSet\Control /v PEFirmwareType') do (
            if %%t == 0x1 (
                set "LAYOUT=MBR"
                set "FIRMWARE=BIOS"
            ) else if %%t == 0x2 (
                set "LAYOUT=GPT"
                set "FIRMWARE=UEFI"
            ) else (
                call :fail "Unexpected PEFirmwareType value %%t."
            )
        )
        call :print "The computer is booted in %FIRMWARE% mode, hence the target disk must be configured with the %LAYOUT% partition layout"
        `);

      switch (part.mode) {
        case 'custom':
          includeDiskpartScript(PATHS.DiskpartScript, UG.csSplitLines(part.customScript || ''), true);
          execute(PATHS.DiskpartScript, 'diskpart will now execute your script');
          break;
        case 'unattended': {
          const message = 'diskpart will now wipe, partition and format disk %TARGET_DISK%';
          if (part.layout === 'Automatic') {
            for (const layout of ['GPT', 'MBR']) includeDiskpartScript('X:\\' + layout + '.txt', getDiskpartScript(part, layout), false);
            execute('X:\\%LAYOUT%.txt', message);
          } else {
            includeDiskpartScript(PATHS.DiskpartScript, getDiskpartScript(part, part.layout), false);
            execute(PATHS.DiskpartScript, message);
          }
          break;
        }
        case 'interactive':
          w.writeLine(csRaw`
              call :print ^"Press Shift+F10 to open a new console window, then use diskpart to partition and format the disk manually. Make sure to assign the drive letters ${W} and ${S} ^
              to the Windows and system partitions, respectively. When finished, continue with Windows Setup in this window.^"
              pause
              `);
          break;
        default: throw new Error('Unbekannte Partitionseinstellung: ' + part.mode);
      }
    }

    const inst = pe.installFrom || { mode: 'interactive' };
    switch (inst.mode) {
      case 'index':
        w.writeLine(csRaw`
          set "IMG_PARAM=/Index:${inst.index}"
          `);
        break;
      case 'name':
        w.writeLine(csRaw`
          set "IMG_PARAM=/Name:"${inst.name}""
          `);
        break;
      case 'interactive':
        w.writeLine(csRaw`
          dism.exe /Get-WimInfo /WimFile:"%IMAGE_FILE%"
          echo:
          :choice
          set /p "CHOICE=Enter index of the image you want to install: " || goto :choice
          set "IMG_PARAM=/Index:%CHOICE%"
          `);
        break;
      case 'edition':
        w.writeLine(csRaw`
          set "IMG_PARAM=/Name:"Windows %OS_VERSION% ${lookup('WindowsEdition', inst.edition).DisplayName}""
          `);
        break;
      default: throw new Error('Unbekannte Image-Auswahl: ' + inst.mode);
    }

    const compact = pe.compactOs ? ' /Compact' : '';
    const integrity = pe.skipIntegrityCheck ? '' : ' /CheckIntegrity /Verify';
    w.writeLine(csRaw`
      call :print "Applying Windows image to target disk"
      dism.exe /Apply-Image /ImageFile:%IMAGE_FILE% %SWM_PARAM% %IMG_PARAM% /ApplyDir:${W}:${'\\'}${compact}${integrity} || call :fail "dism.exe encountered an error."

      call :print "Making system partition bootable"
      bcdboot.exe ${W}:\Windows /s ${S}: || call :fail "bcdboot.exe encountered an error."
      if %LAYOUT% == GPT (
          bcdedit.exe /set {fwbootmgr} bootsequence {bootmgr} || call :fail "bcdedit.exe encountered an error."
      )

      `);

    w.writeLine(csRaw`
      if defined MSU_FOLDER (
          call :print "Adding packages from %MSU_FOLDER% to new installation"
          dism.exe /Add-Package /Image:${W}:\ /PackagePath:%MSU_FOLDER% /ScratchDir:${W}:\Windows\Temp || call :fail "dism.exe encountered an error."
      )

      `);

    {
      const deleteWinRE = () => {
        w.writeLine(csRaw`
        call :print "Deleting winre.wim file to avoid creation of recovery partition"
        del ${W}:\Windows\System32\Recovery\winre.wim

        `);
      };
      if (part.mode === 'unattended') {
        if (part.recovery === 'None') deleteWinRE();
        else if (part.recovery !== 'Partition') throw new Error('Unbekannter Wiederherstellungsmodus: ' + part.recovery);
      } else if (part.mode === 'custom') {
        const script = (part.customScript || '').toLowerCase();
        const keywords = ['SET ID=27', 'LABEL="Recovery"', 'SET ID="de94bba4-06d1-4d40-a16a-bfd50179d6ac"'];
        if (!keywords.some((k) => script.includes(k.toLowerCase()))) deleteWinRE();
      }
    }

    w.writeLine(csRaw`
      call :print "Copying answer file to target disk"
      mkdir ${W}:\Windows\Panther
      copy %XML_FILE% ${W}:\Windows\Panther\unattend.xml

      `);

    w.writeLine(csRaw`
      if defined PEDRIVERS_FOLDER (
          call :print "Adding drivers from %PEDRIVERS_FOLDER% to new installation"
          dism.exe /Add-Driver /Image:${W}:\ /Driver:"%PEDRIVERS_FOLDER%" /Recurse
      )

      `);

    const tz = config.timeZone || {};
    if (tz.mode === 'explicit') {
      w.writeLine(csRaw`
          call :print "Setting time zone"
          dism.exe /Image:${W}:\ /Set-TimeZone:"${lookup('TimeOffset', tz.id).Id}"

          `);
    }

    if (pe.disable8Dot3Names) {
      w.writeLine(csRaw`
        call :print "Disabling 8.3 file names"
        fsutil.exe 8dot3name set ${W}: 1
        fsutil.exe 8dot3name strip /s /f ${W}:\
        reg.exe LOAD HKLM\mount ${W}:\Windows\System32\config\SYSTEM
        reg.exe ADD HKLM\mount\ControlSet001\Control\FileSystem /v NtfsDisable8dot3NameCreation /t REG_DWORD /d 1 /f
        reg.exe UNLOAD HKLM\mount

        `);
    }

    if (pe.disableDefender) {
      w.writeLine(csRaw`
        call :print "Disabling Windows Defender"
        reg.exe LOAD HKLM\mount ${W}:\Windows\System32\config\SYSTEM
        for %%s in (Sense WdBoot WdFilter WdNisDrv WdNisSvc WinDefend) do reg.exe ADD HKLM\mount\ControlSet001\Services\%%s /v Start /t REG_DWORD /d 4 /f
        reg.exe UNLOAD HKLM\mount

        `);
    }
    /* PORT: DisableWpbt (Optimizations) gibt es in der Oberflaeche nicht */

    {
      const configurePagingFile = (data) => {
        w.writeLine(csRaw`
          call :print "Configuring paging file"
          reg.exe LOAD HKLM\mount ${W}:\Windows\System32\config\SYSTEM
          reg.exe add "HKLM\mount\ControlSet001\Control\Session Manager\Memory Management" /v PagingFiles /t REG_MULTI_SZ /f ${data}
          reg.exe UNLOAD HKLM\mount

          `);
      };
      const pf = pe.pagingFile || { mode: 'automatic' };
      if (pf.mode === 'none') configurePagingFile('');
      else if (pf.mode === 'custom') configurePagingFile('/d "C:\\pagefile.sys ' + pf.initialSizeMiB + ' ' + pf.maxSizeMiB + '"');
    }

    if (geo) {
      w.writeLine(csRaw`
          call :print "Setting device setup region to ${geo.DisplayName} (GeoID ${geo.Id})"
          reg.exe LOAD HKLM\mount ${W}:\Windows\System32\config\SOFTWARE
          reg.exe ADD "HKLM\mount\Microsoft\Windows\CurrentVersion\Control Panel\DeviceRegion" /v DeviceRegion /t REG_DWORD /d ${geo.Id} /f
          reg.exe UNLOAD HKLM\mount

          `);
    }

    w.writeLine(csRaw`
        set "ROBOCOPY_ARGS=/E /XX /COPY:DAT /DCOPY:DAT /R:0"
        if defined OEM_FOLDER (
            call :print "Copying contents of %OEM_FOLDER%"
            if exist "%OEM_FOLDER%\$$" robocopy.exe "%OEM_FOLDER%\$$" ${W}:\Windows %ROBOCOPY_ARGS%
            if exist "%OEM_FOLDER%\$1" robocopy.exe "%OEM_FOLDER%\$1" ${W}:\ %ROBOCOPY_ARGS%
            for %%d in (${LETTERS.filter((l) => !SKIPPED.includes(l)).join(' ')}) do (
                if exist "%OEM_FOLDER%\%%d" robocopy.exe "%OEM_FOLDER%\%%d" %%d:\ %ROBOCOPY_ARGS%
            )
        )

        `);

    w.writeLine(csRaw`
      call :print "Computer will now reboot"
      `);
    if (pe.pauseBeforeReboot) w.writeLine('pause');
    w.writeLine(csRaw`
      wpeutil.exe reboot
      goto :eof

      :fail
      echo:
      echo:Fatal error: %~1
      echo:
      pause
      exit 1

      :print
      echo:
      echo:*** %~1 ***
      echo:
      goto :eof
      `);

    return w.lines();
  }

  /* GeneratedTargetDiskSettings: Pruefung wie im Konstruktor des Originals */
  function generatedTarget(t) {
    const g = Object.assign({}, DEFAULT_TARGET, t);
    const num = (v) => (v === '' || v === undefined ? null : v);
    g.minSizeGiB = num(g.minSizeGiB); g.maxSizeGiB = num(g.maxSizeGiB); g.index = num(g.index);
    if (g.minSizeGiB !== null && g.maxSizeGiB !== null && g.minSizeGiB > g.maxSizeGiB) {
      throw new ConfigurationException("Value of 'minSizeGiB' (" + g.minSizeGiB + ") must be less than or equal to value of 'maxSizeGiB' (" + g.maxSizeGiB + ').');
    }
    return g;
  }

  const Disk = {
    name: 'Disk',
    process(c) {
      const pe = c.config.pe || { mode: 'default' };
      if (pe.mode === 'default' && c.config.useConfigurationSet) c.sel('//u:UseConfigurationSet').textContent = 'true';
      if (pe.mode === 'generate' || pe.mode === 'script') {
        /* PORT: Pruefung auf eigene windowsPE-Komponenten entfaellt (Components nicht portiert) */
        for (const node of c.selAll("/u:unattend/u:settings[@pass='windowsPE']/*")) node.parentNode.removeChild(node);
        if (c.config.useNarrator) c.appender('windowsPE').append(c.cb.shellCommand('start X:\\Windows\\System32\\Narrator.exe'));
      } else if (pe.mode !== 'default') {
        throw new Error('Unbekannter PE-Modus: ' + pe.mode);
      }
      const lines = pe.mode === 'script' ? UG.csSplitLines(pe.script || '') : pe.mode === 'generate' ? getPEScript(c.config, pe) : [];
      const copy = c.sel('//s:PEScriptCopy');
      if (lines.length > 0) {
        c.appender('windowsPE').append(c.cb.writeToFilePE(PATHS.PEScript, lines).concat([c.cb.shellCommand(PATHS.PEScript)]));
        c.insertTextWithIndentation(copy, lines.join('\r\n'));
      } else {
        copy.parentNode.removeChild(copy);
      }
    }
  };

  /* ---------- modifier/Users.cs ---------- */
  const RESERVED_NAMES = ['administrator', 'guest', 'defaultaccount', 'system', 'network service', 'local service', 'none', 'wdagutilityaccount'];
  function validateAccount(a) {
    const bad = () => { throw new ConfigurationException("Username '" + a.name + "' is invalid."); };
    const n = a.name || '';
    if (!n.trim()) bad();
    if (n !== n.trim()) bad();
    if (n.length > 20) bad();
    if (/[/\\[\]:;|=,+*?<>"%]/.test(n)) bad();
    if (n.endsWith('.')) bad();
    if (RESERVED_NAMES.includes(n.toLowerCase())) bad();
  }
  function validateAccountSettings(s) {
    s.accounts.forEach(validateAccount);
    if (s.autoLogon !== 'builtin' && !s.accounts.some((a) => a.group === ADMINISTRATORS)) {
      throw new ConfigurationException('Must have at least one administrator account.');
    }
    const seen = new Map();
    const dup = [];
    s.accounts.forEach((a) => {
      const k = a.name.toLowerCase();
      if (seen.has(k) && !dup.includes(seen.get(k))) dup.push(seen.get(k));
      else seen.set(k, a.name);
    });
    if (dup.length) throw new ConfigurationException('Account name(s) ' + dup.map((d) => "'" + d + "'").join(', ') + ' specified more than once.');
  }
  /* Base64 von UTF-16LE(Passwort + Elementname) - wie Windows SIM. Verschleiert, verschluesselt nicht. */
  function obscure(password, element) {
    const s = password + element;
    let bin = '';
    for (let i = 0; i < s.length; i++) { const code = s.charCodeAt(i); bin += String.fromCharCode(code & 0xFF, code >> 8); }
    return btoa(bin);
  }
  const Users = {
    name: 'Users',
    process(c) {
      const s = c.config.account || { mode: 'interactive-ms' };
      if (s.mode === 'unattended') {
        const settings = { accounts: s.accounts || [], autoLogon: s.autoLogon || 'none', builtinPassword: s.builtinPassword || '', obscure: !!s.obscure };
        validateAccountSettings(settings);
        const cn = c.config.computerName;
        if (cn && cn.mode === 'custom') {
          for (const a of settings.accounts) {
            if (a.name.toLowerCase() === String(cn.name).toLowerCase()) {
              throw new ConfigurationException("Account name '" + a.name + "' must not be the same as the computer name.");
            }
          }
        }
        addAutoLogon(c, c.sel('//u:AutoLogon'), settings);
        addUserAccounts(c, c.sel('//u:UserAccounts'), settings);
      } else if (s.mode === 'interactive-ms' || s.mode === 'interactive-local') {
        const al = c.sel('//u:AutoLogon'); al.parentNode.removeChild(al);
        const ua = c.sel('//u:UserAccounts'); ua.parentNode.removeChild(ua);
        if (s.mode === 'interactive-local') c.sel('//u:HideOnlineAccountScreens').textContent = 'true';
      } else {
        throw new Error('Unbekannter Modus fuer Benutzerkonten: ' + s.mode);
      }
    }
  };
  function newPasswordElement(c, parent, element, password, obscured) {
    const elem = c.newElement(element, parent);
    c.newSimpleElement('Value', elem, obscured ? obscure(password, element) : password);
    c.newSimpleElement('PlainText', elem, obscured ? 'false' : 'true');
  }
  function addAutoLogon(c, container, s) {
    if (s.autoLogon === 'none') return;
    let username, password;
    if (s.autoLogon === 'builtin') { username = 'Administrator'; password = s.builtinPassword; }
    else if (s.autoLogon === 'own') {
      const first = s.accounts.find((a) => a.group === ADMINISTRATORS);
      username = first.name; password = first.password;
    } else throw new Error('Unbekannte Autologon-Einstellung: ' + s.autoLogon);
    c.newSimpleElement('Username', container, username);
    c.newSimpleElement('Enabled', container, 'true');
    c.newSimpleElement('LogonCount', container, '1');
    newPasswordElement(c, container, 'Password', password, s.obscure);
    c.firstLogonScript.append("Set-ItemProperty -LiteralPath 'Registry::HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Winlogon' -Name 'AutoLogonCount' -Type 'DWord' -Force -Value 0;");
  }
  function addUserAccounts(c, container, s) {
    if (s.autoLogon === 'builtin') newPasswordElement(c, container, 'AdministratorPassword', s.builtinPassword, s.obscure);
    const local = c.newElement('LocalAccounts', container);
    for (const a of s.accounts) {
      const el = c.newElement('LocalAccount', local);
      el.setAttributeNS(UG.NS.wcm, 'wcm:action', 'add');
      c.newSimpleElement('Name', el, a.name);
      c.newSimpleElement('DisplayName', el, a.displayName || '');
      c.newSimpleElement('Group', el, a.group);
      newPasswordElement(c, el, 'Password', a.password || '', s.obscure);
    }
  }

  /* ---------- modifier/Bloatware.cs ----------
     Bewusst nicht portiert: Der Generator hat eine eigene Bloatware-Seite. */
  const Bloatware = { name: 'Bloatware', process() {} };

  /* ---------- modifier/ExpressSettings.cs ---------- */
  const ExpressSettings = {
    name: 'ExpressSettings',
    process(c) {
      const elem = c.sel('//u:OOBE/u:ProtectYourPC');
      switch (c.config.expressSettings || 'disableAll') {
        case 'interactive': elem.parentNode.removeChild(elem); break;
        case 'enableAll': elem.textContent = '1'; break;
        case 'disableAll': elem.textContent = '3'; break;
        default: throw new Error('Unbekannte Datenschutz-Einstellung: ' + c.config.expressSettings);
      }
    }
  };

  /* ---------- XML-Werkzeug fuer AppLocker und WLAN ----------
     Beide Modifier laden fremdes XML (XmlDocument.LoadXml), pruefen es gegen
     ein XSD des Originals (Util.ValidateAgainstSchema) und betten es per
     EmbedXmlFile ein.
     PORT: Der Browser kennt keine XSD-Pruefung. XT.validator() bildet die
     beiden Schemas als Tabelle nach (Sequenzen, xs:all, xs:any, Attribute,
     einfache Typen, xs:unique); die Meldungen nach dem Praefix lauten anders
     als bei .NET. DOCTYPE wird abgelehnt. */
  const XT = (() => {
    const INF = Infinity;
    const collapse = (v) => v.replace(/[\t\n\r ]+/g, ' ').trim();
    const chars = (v) => [...v].length;
    const T = {
      string: () => true,
      len: (min, max) => (v) => chars(v) >= min && chars(v) <= max,
      re: (src) => { const r = new RegExp('^(?:' + src + ')$'); return (v) => r.test(v); },
      enumOf: (...vals) => (v) => vals.includes(v),
      all: (...fs) => (v) => fs.every((f) => f(v)),
      anyOf: (...fs) => (v) => fs.some((f) => f(v)),
      decimal: (v) => /^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(collapse(v)),
      integer: (min = -INF, max = INF) => (v) => {
        const s = collapse(v);
        return /^[+-]?\d+$/.test(s) && Number(s) >= min && Number(s) <= max;
      },
      unsignedInt: (v) => { const s = collapse(v); return /^\+?\d+$/.test(s) && Number(s) <= 4294967295; },
      boolean: (v) => ['true', 'false', '1', '0'].includes(collapse(v)),
      hexBinary: (min, max) => (v) => {
        const s = collapse(v);
        return /^([0-9a-fA-F]{2})*$/.test(s) && s.length / 2 >= min && s.length / 2 <= max;
      }
    };
    /* Partikel: el(name, typ, min, max) | choice({name: typ}, min, max) | any(ns, min, max) */
    const el = (name, type, min = 1, max = 1) => ({ names: { [name]: type }, min, max });
    const choice = (map, min, max) => ({ names: map, min, max });
    const any = (ns = '##any', min = 0, max = INF) => ({ any: ns, min, max });
    const simple = (check) => ({ simple: check, attrs: {} });

    function validator(opt) {
      const target = opt.ns || '';
      const fail = (m) => { throw new ConfigurationException(opt.prefix + m); };
      const nsOf = (e) => e.namespaceURI || '';
      const matches = (e, p) => {
        if (p.any) return p.any === '##any' || (nsOf(e) !== target && nsOf(e) !== '');
        return nsOf(e) === target && Object.prototype.hasOwnProperty.call(p.names, e.localName);
      };
      function check(e, type) {
        const name = e.localName;
        for (const a of Array.from(e.attributes)) {
          if (a.name === 'xmlns' || a.name.startsWith('xmlns:') || a.name.startsWith('xml:')) continue;
          const decl = !a.namespaceURI && Object.prototype.hasOwnProperty.call(type.attrs, a.name) ? type.attrs[a.name] : null;
          if (!decl) fail("The '" + a.name + "' attribute is not declared (element '" + name + "').");
          if (!decl[0](a.value)) fail("The '" + a.name + "' attribute of element '" + name + "' is invalid - the value '" + a.value + "' is invalid according to its datatype.");
        }
        for (const [an, decl] of Object.entries(type.attrs)) {
          if (decl[1] && !e.hasAttribute(an)) fail("The required attribute '" + an + "' is missing (element '" + name + "').");
        }
        const kids = Array.from(e.childNodes);
        const elems = kids.filter((k) => k.nodeType === 1);
        if (type.simple) {
          if (elems.length) fail("The element '" + name + "' cannot contain child element '" + elems[0].localName + "' because it has a simple type.");
          const text = kids.filter((k) => k.nodeType === 3 || k.nodeType === 4).map((k) => k.nodeValue).join('');
          if (!type.simple(text)) fail("The '" + name + "' element is invalid - the value '" + text + "' is invalid according to its datatype.");
          return;
        }
        if (kids.some((k) => (k.nodeType === 3 || k.nodeType === 4) && k.nodeValue.trim() !== '')) {
          fail("The element '" + name + "' cannot contain text.");
        }
        if (type.model === 'empty') {
          if (elems.length) fail("The element '" + name + "' cannot contain child element '" + elems[0].localName + "' because the parent element's content model is empty.");
          return;
        }
        const items = type.items();
        const expected = (p) => (p.any ? 'any element' : Object.keys(p.names).join(', '));
        if (type.model === 'all') {
          const seen = {};
          for (const k of elems) {
            const p = items.find((i) => matches(k, i));
            if (!p || seen[k.localName]) fail("The element '" + name + "' has invalid child element '" + k.localName + "'.");
            seen[k.localName] = true;
            check(k, p.names[k.localName]);
          }
          for (const p of items) {
            const n = Object.keys(p.names)[0];
            if (p.min > 0 && !seen[n]) fail("The element '" + name + "' has incomplete content. List of possible elements expected: '" + n + "'.");
          }
          return;
        }
        let i = 0;
        for (const p of items) {
          let n = 0;
          while (i < elems.length && n < p.max && matches(elems[i], p)) {
            if (!p.any) check(elems[i], p.names[elems[i].localName]);
            i++; n++;
          }
          if (n < p.min) {
            if (i < elems.length) fail("The element '" + name + "' has invalid child element '" + elems[i].localName + "'. List of possible elements expected: '" + expected(p) + "'.");
            fail("The element '" + name + "' has incomplete content. List of possible elements expected: '" + expected(p) + "'.");
          }
        }
        if (i < elems.length) fail("The element '" + name + "' has invalid child element '" + elems[i].localName + "'.");
      }
      return function validate(doc) {
        const root = doc.documentElement;
        /* Util.ValidateAgainstSchema: Meldung wortgleich */
        if (nsOf(root) !== target) fail("Namespace URI of root element must be '" + target + "', but was '" + nsOf(root) + "'.");
        if (root.localName !== opt.rootName) fail("The '" + root.nodeName + "' element is not declared.");
        check(root, opt.root);
        if (opt.unique) opt.unique(root, fail);
      };
    }

    /* XmlDocument.LoadXml mit PreserveWhitespace=false: reine Leerraum-
       Textknoten entfallen. DOMParser verliert, ob ein Element als <X/>
       oder <X></X> geschrieben war (XmlElement.IsEmpty) - das stellt ein
       Durchlauf ueber die Start-Tags des Quelltexts wieder her. */
    function parse(text, prefix) {
      const fail = (m) => { throw new ConfigurationException(prefix + m); };
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const err = doc.getElementsByTagName('parsererror')[0];
      if (err) {
        const detail = err.querySelector('div') || err;
        fail(String(detail.textContent || 'not well-formed').replace(/\s+/g, ' ').trim());
      }
      if (doc.doctype) fail('DTDs are not supported.');
      const empty = [];
      const tok = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/[^>]*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
      let m;
      while ((m = tok.exec(text)) !== null) if (m[1]) empty.push(m[3] === '/');
      const all = Array.from(doc.getElementsByTagName('*'));
      if (all.length !== empty.length) fail('unexpected markup.');
      const isEmpty = new Map(all.map((e, i) => [e, empty[i]]));
      const strip = (n) => {
        for (const k of Array.from(n.childNodes)) {
          if (k.nodeType === 3 && k.nodeValue.trim() === '') n.removeChild(k);
          else if (k.nodeType === 1) strip(k);
        }
      };
      strip(doc);
      return { doc, isEmpty };
    }

    /* Main.cs: EmbedXmlFile - XmlDocument.Save ueber XmlWriter mit Indent,
       IndentChars \t, NewLineChars \r\n, OmitXmlDeclaration. Nachgebildet
       ist XmlEncodedRawTextWriterIndent: Einrueckung nur ausserhalb
       gemischten Inhalts, leere Elemente als <X />, fehlende
       Namensraum-Deklarationen werden ergaenzt. */
    function pretty(doc, isEmpty) {
      const CRLF = '\r\n';
      let out = '', level = 0, mixed = false, textPos = 0, contentPos = -1;
      const stack = [];
      const indent = () => { out += CRLF + '\t'.repeat(level); };
      const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r\n|\r|\n/g, CRLF);
      const escAttr = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/\t/g, '&#x9;').replace(/\n/g, '&#xA;').replace(/\r/g, '&#xD;');
      function node(n, defNs) {
        switch (n.nodeType) {
          case 1: {
            if (!mixed && out.length !== textPos) indent();
            level++; stack.push(mixed);
            out += '<' + n.nodeName;
            let ns = defNs;
            for (const a of Array.from(n.attributes)) {
              out += ' ' + a.name + '="' + escAttr(a.value) + '"';
              if (a.name === 'xmlns') ns = a.value;
            }
            if (!n.prefix && (n.namespaceURI || '') !== ns) {
              ns = n.namespaceURI || '';
              out += ' xmlns="' + escAttr(ns) + '"';
            }
            const empty = isEmpty && isEmpty.has(n) ? isEmpty.get(n) : !n.hasChildNodes();
            if (empty) {
              level--; mixed = stack.pop();
              contentPos = out.length + 1;
              out += ' />';
            } else {
              out += '>';
              contentPos = out.length;
              Array.from(n.childNodes).forEach((k) => node(k, ns));
              level--;
              if (!mixed && contentPos !== out.length && textPos !== out.length) indent();
              mixed = stack.pop();
              out += '</' + n.nodeName + '>';
            }
            break;
          }
          case 3:
            mixed = true; out += escText(n.nodeValue); textPos = out.length;
            break;
          case 4:
            mixed = true; out += '<![CDATA[' + n.nodeValue.replace(/\r\n|\r|\n/g, CRLF) + ']]>'; textPos = out.length;
            break;
          case 7:
            if (!mixed && out.length !== textPos) indent();
            out += '<?' + n.target + (n.data ? ' ' + n.data : '') + '?>';
            break;
          case 8:
            if (!mixed && out.length !== textPos) indent();
            out += '<!--' + n.nodeValue + '-->';
            break;
          default: break;
        }
      }
      Array.from(doc.childNodes).forEach((k) => node(k, ''));
      return out;
    }
    /* XmlElement.InnerText = v: ersetzt den Inhalt durch einen Textknoten (auch leer) */
    function setText(e, v) {
      while (e.firstChild) e.removeChild(e.firstChild);
      e.appendChild(e.ownerDocument.createTextNode(v));
    }
    return { T, el, choice, any, simple, validator, parse, pretty, setText, INF };
  })();

  /* ---------- modifier/Wifi.cs ----------
     interaktiv, ueberspringen, Profil aus Einstellungen (ParameterizedWifiSettings,
     Vorlage resource/WLANProfile.xml) oder als XML (XmlWifiSettings, geprueft
     gegen resource/WLAN_profile_v1.xsd - nachgebildet, siehe XT). */
  const WLAN_NS = 'http://www.microsoft.com/networking/WLAN/profile/v1';
  const WLAN_ERR = 'WLAN profile XML is invalid: ';
  const validateWlan = (() => {
    const { T, el, any, simple, INF } = XT;
    const other = (min = 0, max = INF) => any('##other', min, max);
    const seq = (items, attrs = {}) => ({ attrs, model: 'seq', items: () => items });
    const str = (min, max) => simple(T.len(min, max));
    const bool = simple(T.boolean);
    const en = (...v) => simple(T.enumOf(...v));
    const int = (min, max) => simple(T.integer(min, max));
    const hex = (min, max) => simple(T.hexBinary(min, max));
    const root = seq([
      el('name', str(1, 255)),
      el('SSIDConfig', seq([
        el('SSID', seq([el('hex', hex(1, 32), 0), el('name', str(1, 32), 0), other()]), 1, 256),
        el('nonBroadcast', bool, 0),
        other()]), 1, 256),
      el('Hotspot2', seq([
        el('DomainName', str(1, 255), 0),
        el('NAIRealm', seq([el('name', str(1, 255), 0, 256)]), 0),
        el('Network3GPP', seq([el('PLMNID', str(5, 6), 0, 256)]), 0),
        el('RoamingConsortium', seq([el('OUI', hex(3, 5), 0, 256)]), 0)]), 0),
      el('connectionType', en('IBSS', 'ESS')),
      el('connectionMode', en('auto', 'manual'), 0),
      el('autoSwitch', bool, 0),
      el('MSM', seq([
        el('connectivity', seq([el('phyType', en('a', 'b', 'g', 'n', 'ac', 'ax'), 0, 6), other()]), 0),
        el('security', seq([
          el('authEncryption', seq([
            el('authentication', en('open', 'shared', 'WPA', 'WPAPSK', 'WPA2', 'WPA2PSK', 'WPA3', 'WPA3SAE', 'OWE')),
            el('encryption', en('none', 'WEP', 'TKIP', 'AES', 'GCMP256')),
            el('useOneX', bool, 0),
            other()]), 0),
          el('sharedKey', seq([
            el('keyType', en('networkKey', 'passPhrase')),
            el('protected', bool),
            el('keyMaterial', simple(T.string)),
            other()]), 0),
          el('keyIndex', int(0, 3), 0),
          el('PMKCacheMode', en('disabled', 'enabled'), 0),
          el('PMKCacheTTL', int(5, 1440), 0),
          el('PMKCacheSize', int(1, 255), 0),
          el('preAuthMode', en('disabled', 'enabled'), 0),
          el('preAuthThrottle', int(1, 16), 0),
          other()]), 0),
        other()]), 0),
      el('IHV', seq([
        el('OUIHeader', seq([el('OUI', hex(3, 3)), el('type', hex(1, 1)), other()])),
        el('connectivity', seq([other(1, 1)]), 0),
        el('security', seq([other(1, 1)]), 0),
        el('useMSOneX', bool, 0),
        other()]), 0),
      other()]);
    return XT.validator({ ns: WLAN_NS, prefix: WLAN_ERR, rootName: 'WLANProfile', root });
  })();
  const wlanChild = (e, name) => Array.from(e.children).find((k) => k.namespaceURI === WLAN_NS && k.localName === name) || null;
  const wlanPath = (doc, ...names) => {
    let e = doc.documentElement;
    if (!e || e.namespaceURI !== WLAN_NS || e.localName !== 'WLANProfile') return null;
    for (const n of names) { e = e && wlanChild(e, n); }
    return e;
  };

  function wifiProfile(w) {
    if (w.mode === 'xml') {
      const parsed = XT.parse(String(w.xml || ''), WLAN_ERR);
      validateWlan(parsed.doc);
      const mode = wlanPath(parsed.doc, 'connectionMode');
      return {
        doc: parsed.doc, isEmpty: parsed.isEmpty,
        name: wlanPath(parsed.doc, 'name').textContent,
        connect: mode ? mode.textContent === 'auto' : false
      };
    }
    /* ParameterizedWifiSettings.ProfileXml */
    const name = String(w.name || '');
    const doc = XT.parse(res('WLANProfile.xml').replace(/^﻿/, ''), 'WLANProfile.xml: ').doc;
    const p = (...names) => wlanPath(doc, ...names);
    const utf8hex = Array.from(new TextEncoder().encode(name)).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('');
    XT.setText(p('name'), name);
    XT.setText(p('SSIDConfig', 'SSID', 'name'), name);
    XT.setText(p('SSIDConfig', 'SSID', 'hex'), utf8hex);
    XT.setText(p('connectionType'), 'ESS');
    XT.setText(p('connectionMode'), w.connectAutomatically ? 'auto' : 'manual');
    const authEnc = p('MSM', 'security', 'authEncryption');
    const setNonBroadcast = () => {
      if (!w.nonBroadcast) return;
      const e = doc.createElementNS(WLAN_NS, 'nonBroadcast');
      XT.setText(e, 'true');
      p('SSIDConfig').appendChild(e);
    };
    const setPassword = () => XT.setText(p('MSM', 'security', 'sharedKey', 'keyMaterial'), String(w.password || ''));
    switch (w.authentication || 'WPA2PSK') {
      case 'Open': {
        XT.setText(wlanChild(authEnc, 'authentication'), 'open');
        XT.setText(wlanChild(authEnc, 'encryption'), 'none');
        setNonBroadcast();
        const key = p('MSM', 'security', 'sharedKey');
        key.parentNode.removeChild(key);
        break;
      }
      case 'WPA2PSK':
        XT.setText(wlanChild(authEnc, 'authentication'), 'WPA2PSK');
        XT.setText(wlanChild(authEnc, 'encryption'), 'AES');
        setNonBroadcast();
        setPassword();
        break;
      case 'WPA3SAE': {
        XT.setText(wlanChild(authEnc, 'authentication'), 'WPA3SAE');
        XT.setText(wlanChild(authEnc, 'encryption'), 'AES');
        setNonBroadcast();
        setPassword();
        const t = doc.createElementNS('http://www.microsoft.com/networking/WLAN/profile/v4', 'transitionMode');
        XT.setText(t, 'true');
        authEnc.appendChild(t);
        break;
      }
      default: throw new Error('Authentication mode ' + w.authentication + ' is not implemented.');
    }
    return { doc, isEmpty: null, name, connect: !!w.connectAutomatically };
  }

  const Wifi = {
    name: 'Wifi',
    process(c) {
      const elem = c.sel('//u:OOBE/u:HideWirelessSetupInOOBE');
      const w = c.config.wifi || { mode: 'interactive' };
      const mode = w.mode || 'interactive';
      if (mode === 'interactive') { elem.textContent = 'false'; return; }
      if (mode === 'skip') { elem.textContent = 'true'; return; }
      if (mode !== 'unattended' && mode !== 'xml') throw new Error('Unbekannte WLAN-Einstellung: ' + mode);
      const profile = wifiProfile(w);
      elem.parentNode.removeChild(elem);
      const xmlFile = c.embedFile('Wifi.xml', XT.pretty(profile.doc, profile.isEmpty));
      c.specializeScript.append([
        "$name = 'WlanSvc';",
        '$start = [datetime]::Now;',
        '$timeout = $start.AddMinutes( 1 );',
        '$params = @{',
        '  Id = 1;',
        '  ParentId = 0;',
        '  Activity = "Waiting for service \'${name}\' to start.";',
        '};',
        'while( $true ) {',
        "\tif( $service = Get-Service -Name $name -ErrorAction 'SilentlyContinue' ) {",
        "\t\tif( $service.Status -eq 'Running' ) {",
        '\t\t\tbreak;',
        '\t\t}',
        '\t}',
        '\tif( [datetime]::Now -gt $timeout ) {',
        '\t\t"Service \'${name}\' did not start in time." | Write-Warning;',
        '\t\tbreak;',
        '\t}',
        '\tWrite-Progress @params -PercentComplete $(',
        '\t\t100 * ( [datetime]::Now - $start ).Ticks / ( $timeout - $start ).Ticks',
        '\t);',
        '\tStart-Sleep -Seconds 5;',
        '}',
        'Write-Progress @params -Completed;'
      ].join('\n'));
      c.specializeScript.append('netsh.exe wlan add profile filename="' + xmlFile + '" user=all;');
      if (profile.connect) {
        c.specializeScript.append('netsh.exe wlan connect name="' + profile.name + '" ssid="' + profile.name + '";');
      }
    }
  };

  /* ---------- modifier/EmptyElements.cs ---------- */
  const EmptyElements = {
    name: 'EmptyElements',
    process(c) {
      let modified;
      do {
        modified = false;
        for (const leaf of c.selAll('//*')) {
          if (!leaf.hasChildNodes() && leaf.attributes.length === 0) {
            leaf.parentNode.removeChild(leaf);
            modified = true;
          }
        }
      } while (modified);
    }
  };

  /* ---------- modifier/Lockout.cs ---------- */
  const Lockout = {
    name: 'Lockout',
    process(c) {
      const s = c.config.lockout || { mode: 'default' };
      if (s.mode === 'default') return;
      if (s.mode === 'disabled') { c.specializeScript.append('net.exe accounts /lockoutthreshold:0;'); return; }
      if (s.mode !== 'custom') throw new Error('Unbekannte Sperr-Einstellung: ' + s.mode);
      const threshold = inRange(s.threshold, 0, 999, 'lockoutThreshold');
      const duration = inRange(s.duration, 1, 99999, 'lockoutDuration');
      const window = inRange(s.window, 1, 99999, 'lockoutWindow');
      if (window > duration) {
        throw new ConfigurationException("Value of 'LockoutWindow' (" + window + ") must be less than or equal to value of 'LockoutDuration' (" + duration + ').');
      }
      c.specializeScript.append('net.exe accounts /lockoutthreshold:' + threshold + ' /lockoutduration:' + duration + ' /lockoutwindow:' + window + ';');
    }
  };

  /* ---------- modifier/PasswordExpiration.cs ---------- */
  const PasswordExpiration = {
    name: 'PasswordExpiration',
    process(c) {
      const s = c.config.passwordExpiration || { mode: 'default' };
      if (s.mode === 'default') return;
      if (s.mode === 'unlimited') { c.specializeScript.append('net.exe accounts /maxpwage:UNLIMITED;'); return; }
      if (s.mode !== 'custom') throw new Error('Unbekannte Kennwortablauf-Einstellung: ' + s.mode);
      c.specializeScript.append('net.exe accounts /maxpwage:' + inRange(s.maxAge, 1, 999, 'maxAge') + ';');
    }
  };

  /* ---------- modifier/Optimizations.cs ----------
     Teilweise portiert: Tweaks liefert der Generator selbst (Tweaks-Seite).
     Uebernommen sind die Abschnitte, die es dort nicht gibt - in der
     Reihenfolge des Originals: Defender-Hinweise (haengt am PE-Modus),
     Edge-Verknuepfung, Sperrtasten, visuelle Effekte, Desktopsymbole, Ordner
     im Startmenue. Alle anderen Schalter des Originals stehen auf ihrem
     Standardwert und erzeugen dort keine Ausgabe. */
  const EFFECTS = ['ControlAnimations', 'AnimateMinMax', 'TaskbarAnimations', 'DWMAeroPeekEnabled', 'MenuAnimation',
    'TooltipAnimation', 'SelectionFade', 'DWMSaveThumbnailEnabled', 'CursorShadow', 'ListviewShadow', 'ThumbnailsOrIcon',
    'ListviewAlphaSelect', 'DragFullWindows', 'ComboBoxAnimation', 'FontSmoothing', 'ListBoxSmoothScrolling', 'DropShadow'];
  /* ImmutableSortedDictionary nach Id (string.CompareTo) */
  const byId = (a, b) => a.Id.localeCompare(b.Id, 'en');
  /* StartFolder.json hat kein Id-Feld - die Tabelle nach Id taugt hier nicht */
  const startFolders = () => UG.res('StartFolder.json').map((f) => Object.assign({ Id: f.DisplayName.replace(/ /g, '') }, f)).sort(byId);

  const Optimizations = {
    name: 'Optimizations',
    process(c) {
      const cfg = c.config;
      const pe = cfg.pe;
      if (pe && pe.mode === 'generate' && pe.disableDefender) {
        c.specializeScript.append('reg.exe add "HKLM\\SOFTWARE\\Policies\\Microsoft\\Windows Defender Security Center\\Notifications" /v DisableNotifications /t REG_DWORD /d 1 /f;');
      }

      if (cfg.deleteEdgeDesktopIcon) {
        c.specializeScript.append("Remove-Item -LiteralPath 'C:\\Users\\Public\\Desktop\\Microsoft Edge.lnk' -ErrorAction 'SilentlyContinue' -Verbose;");
        c.userOnceScript.append('Remove-Item -LiteralPath "${env:USERPROFILE}\\Desktop\\Microsoft Edge.lnk" -ErrorAction \'SilentlyContinue\' -Verbose;');
      }

      const lk = cfg.lockKeys;
      if (lk && lk.mode === 'configure') {
        const keys = [lk.capsLock || {}, lk.numLock || {}, lk.scrollLock || {}];
        let indicators = 0;
        if (keys[0].initial === 'On') indicators |= 1;
        if (keys[1].initial === 'On') indicators |= 2;
        if (keys[2].initial === 'On') indicators |= 4;
        c.defaultUserScript.append(
          "foreach( $root in 'Registry::HKU\\.DEFAULT', 'Registry::HKU\\DefaultUser' ) {\n" +
          "  Set-ItemProperty -LiteralPath \"$root\\Control Panel\\Keyboard\" -Name 'InitialKeyboardIndicators' -Type 'String' -Value " + indicators + ' -Force;\n' +
          '}');
        /* Scancode Map: Taste auf 0 abbilden = Tastendruck ignorieren */
        const scancodes = [0x3A, 0x45, 0x46];
        const ignored = keys.map((k, i) => (k.behavior === 'Ignore' ? scancodes[i] : null)).filter((x) => x !== null);
        if (ignored.length > 0) {
          const bytes = [0, 0, 0, 0, 0, 0, 0, 0, ignored.length + 1, 0, 0, 0];
          ignored.forEach((code) => bytes.push(0, 0, code, 0));
          bytes.push(0, 0, 0, 0);
          const base64 = btoa(String.fromCharCode.apply(null, bytes));
          c.specializeScript.append("Set-ItemProperty -LiteralPath 'Registry::HKLM\\SYSTEM\\CurrentControlSet\\Control\\Keyboard Layout' -Name 'Scancode Map' -Type 'Binary' -Value([convert]::FromBase64String('" + base64 + "'));");
        }
      }

      const fx = cfg.effects || { mode: 'default' };
      const setEffects = (values, setting) => {
        let sb = '';
        EFFECTS.forEach((key) => {
          sb += 'Set-ItemProperty -LiteralPath "Registry::HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects\\' + key +
            '" -Name \'DefaultValue\' -Value ' + (values(key) ? 1 : 0) + " -Type 'DWord' -Force;\n";
        });
        c.specializeScript.append(sb);
        c.userOnceScript.append("Set-ItemProperty -LiteralPath 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name 'VisualFXSetting' -Type 'DWord' -Value " + setting + ' -Force;');
      };
      switch (fx.mode) {
        case 'default': break;
        case 'bestAppearance': setEffects(() => true, 1); break;
        case 'bestPerformance': setEffects(() => false, 2); break;
        case 'custom': setEffects((k) => !!(fx.custom && fx.custom[k]), 3); break;
        default: throw new Error('Unbekannte Effekt-Einstellung: ' + fx.mode);
      }

      const di = cfg.desktopIcons || { mode: 'default' };
      if (di.mode === 'custom') {
        const show = di.show || [];
        const icons = UG.list('DesktopIcon').slice().sort(byId);
        let sb = '';
        for (const key of ['ClassicStartMenu', 'NewStartPanel']) {
          const path = 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\HideDesktopIcons\\' + key;
          sb += "New-Item -Path '" + path + "' -Force;\n";
          for (const icon of icons) {
            sb += "Set-ItemProperty -Path '" + path + "' -Name '" + icon.Guid + "' -Value " + (show.includes(icon.Id) ? 0 : 1) + " -Type 'DWord';\n";
          }
        }
        c.userOnceScript.append(sb);
        c.userOnceScript.restartExplorer();
      } else if (di.mode !== 'default') throw new Error('Unbekannte Desktopsymbol-Einstellung: ' + di.mode);

      const sf = cfg.startFolders || { mode: 'default' };
      if (sf.mode === 'custom') {
        const show = sf.show || [];
        let bin = '';
        for (const f of startFolders()) if (show.includes(f.Id)) bin += atob(f.Bytes);
        c.userOnceScript.append("Set-ItemProperty -Path 'Registry::HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Start' -Name 'VisiblePlaces' -Value $( [convert]::FromBase64String('" + btoa(bin) + "') ) -Type 'Binary';");
      } else if (sf.mode !== 'default') throw new Error('Unbekannte Startmenue-Einstellung: ' + sf.mode);
    }
  };

  /* ---------- modifier/Personalization.cs ----------
     Portiert: Farben. Hintergrund und Sperrbildschirm folgen. */
  const Personalization = {
    name: 'Personalization',
    process(c) {
      const col = c.config.colors || { mode: 'default' };
      if (col.mode === 'custom') {
        const theme = (t) => (t === 'Light' ? 1 : 0);
        const hex = String(col.accentColor || '#0078D4').replace(/^#?/, '#').toUpperCase();
        if (!/^#[0-9A-F]{6}$/.test(hex)) throw new ConfigurationException("Color '" + col.accentColor + "' is invalid.");
        const before = [
          '$lightThemeSystem = ' + theme(col.systemTheme) + ';',
          '$lightThemeApps = ' + theme(col.appsTheme) + ';',
          '$accentColorOnStart = ' + (col.accentOnStart ? 1 : 0) + ';',
          '$enableTransparency = ' + (col.transparency ? 1 : 0) + ';',
          "$htmlAccentColor = '" + hex + "';"
        ].join('\n') + '\n';
        const ps1 = c.embedTextFileFromResource('SetColorTheme.ps1', before);
        c.defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\DWM" /v ColorPrevalence /t REG_DWORD /d ' + (col.accentOnBorders ? 1 : 0) + ' /f;');
        c.userOnceScript.invokeFile(ps1);
        c.userOnceScript.restartExplorer();
      } else if (col.mode !== 'default') throw new Error('Unbekannte Farb-Einstellung: ' + col.mode);
    }
  };

  /* ---------- modifier/TimeZone.cs ---------- */
  const TimeZone = {
    name: 'TimeZone',
    process(c) {
      const s = c.config.timeZone || { mode: 'implicit' };
      if (s.mode !== 'explicit') return;
      const tz = lookup('TimeOffset', s.id);
      c.newSimpleElement('TimeZone', c.getOrCreateElement('specialize', 'Microsoft-Windows-Shell-Setup'), tz.Id);
    }
  };

  /* ---------- modifier/AppLocker.cs ----------
     Richtlinie als XML (Export von Get-AppLockerPolicy -Xml), geprueft gegen
     resource/AppLocker.xsd (nachgebildet, siehe XT), als Datei eingebettet und
     im specialize-Pass mit Set-AppLockerPolicy angewendet. */
  const AL_ERR = 'AppLocker policy XML is invalid: ';
  const validateAppLocker = (() => {
    const { T, el, choice, any, INF } = XT;
    const guid = T.re('[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}');
    const sid = T.all(T.len(7, INF), T.re('S-1(-[0-9a-fA-F]+)+'));
    const fileVersion = T.anyOf(T.re('([0-9]{1,5}.){3}[0-9]{1,5}'), T.enumOf('*'));
    const hashData = T.anyOf(T.re('0x([0-9A-Fa-f]{64})'), T.re('0x([0-9A-Fa-f]{40})'));
    const appidTypes = (v) => v.replace(/[\t\n\r ]+/g, ' ').trim().split(' ').filter(Boolean).every((x) => ['Hash', 'Path', 'Publisher'].includes(x));
    const ruleAttrs = { Id: [guid, true], Name: [T.len(1, 1024), true], Description: [T.len(0, 1024), true],
      UserOrGroupSid: [sid, true], Action: [T.enumOf('Allow', 'Deny'), true] };
    const C = {};
    const cond = (name, type) => ({ attrs: {}, model: 'seq', items: () => [el(name, type)] });
    C.FileHash = { attrs: { Type: [T.enumOf('SHA256', 'SHA256Flat', 'SHA1'), true], Data: [hashData, true], SourceFileName: [T.string, false], SourceFileLength: [T.integer(), false] }, model: 'empty' };
    C.FileHashCondition = { attrs: {}, model: 'seq', items: () => [el('FileHash', C.FileHash, 1, INF)] };
    C.FilePathCondition = { attrs: { Path: [T.len(1, 32767), true] }, model: 'empty' };
    C.BinaryVersionRange = { attrs: { LowSection: [fileVersion, true], HighSection: [fileVersion, true] }, model: 'empty' };
    C.FilePublisherCondition = { attrs: { PublisherName: [T.len(1, INF), true], ProductName: [T.string, true], BinaryName: [T.string, true] },
      model: 'all', items: () => [el('BinaryVersionRange', C.BinaryVersionRange)] };
    const exceptions = { attrs: {}, model: 'seq',
      items: () => [choice({ FilePublisherCondition: C.FilePublisherCondition, FilePathCondition: C.FilePathCondition, FileHashCondition: C.FileHashCondition }, 0, INF)] };
    C.FilePublisherRule = { attrs: ruleAttrs, model: 'all',
      items: () => [el('Conditions', cond('FilePublisherCondition', C.FilePublisherCondition)), el('Exceptions', exceptions, 0)] };
    C.FilePathRule = { attrs: ruleAttrs, model: 'all',
      items: () => [el('Conditions', cond('FilePathCondition', C.FilePathCondition)), el('Exceptions', exceptions, 0)] };
    C.FileHashRule = { attrs: ruleAttrs, model: 'all', items: () => [el('Conditions', cond('FileHashCondition', C.FileHashCondition))] };
    C.Services = { attrs: { EnforcementMode: [T.enumOf('NotConfigured', 'Enabled', 'ServicesOnly'), true] }, model: 'empty' };
    C.SystemApps = { attrs: { Allow: [T.enumOf('Enabled', 'NotEnabled'), true] }, model: 'empty' };
    C.OriginDataRevocation = { attrs: { CurrentOriginDataId: [T.unsignedInt, true], TrustedOriginDataId: [T.unsignedInt, true] }, model: 'empty' };
    C.RuleCollectionExtensions = { attrs: {}, model: 'seq', items: () => [
      el('ThresholdExtensions', { attrs: {}, model: 'seq', items: () => [el('Services', C.Services, 0)] }),
      el('RedstoneExtensions', { attrs: {}, model: 'seq', items: () => [el('SystemApps', C.SystemApps, 0), el('OriginDataRevocation', C.OriginDataRevocation, 0)] }),
      any()] };
    C.RuleCollection = { attrs: { Type: [T.string, true], EnforcementMode: [T.enumOf('NotConfigured', 'Enabled', 'AuditOnly'), false] }, model: 'seq', items: () => [
      choice({ FilePublisherRule: C.FilePublisherRule, FilePathRule: C.FilePathRule, FileHashRule: C.FileHashRule }, 0, INF),
      el('RuleCollectionExtensions', C.RuleCollectionExtensions, 0)] };
    C.PluginPolicy = { attrs: { Id: [guid, false] }, model: 'empty' };
    C.ExecutionCategory = { attrs: { Id: [guid, false], AppidTypes: [appidTypes, false] }, model: 'seq',
      items: () => [el('Policies', { attrs: {}, model: 'seq', items: () => [el('Policy', C.PluginPolicy, 0, INF)] }, 0)] };
    C.Plugin = { attrs: { Name: [T.string, false], Id: [guid, false] }, model: 'seq',
      items: () => [el('ExecutionCategories', { attrs: {}, model: 'seq', items: () => [el('ExecutionCategory', C.ExecutionCategory, 1, INF)] })] };
    C.PolicyExtensions = { attrs: {}, model: 'seq', items: () => [
      el('ThresholdExtensions', { attrs: {}, model: 'seq', items: () => [el('Plugins', { attrs: {}, model: 'seq', items: () => [el('Plugin', C.Plugin, 0, INF)] }, 0)] }),
      any()] };
    C.AppLockerPolicy = { attrs: { Version: [T.decimal, true] }, model: 'seq', items: () => [
      el('RuleCollection', C.RuleCollection, 0, INF), el('PolicyExtensions', C.PolicyExtensions, 0)] };
    /* xs:unique UniqueRuleCollectionTypeConstraint und UniqueRuleIdConstraint */
    const unique = (root, fail) => {
      const types = new Set(), ids = new Set();
      for (const rc of Array.from(root.children).filter((k) => k.localName === 'RuleCollection')) {
        const t = rc.getAttribute('Type');
        if (types.has(t)) fail("There is a duplicate key sequence '" + t + "' for the 'UniqueRuleCollectionTypeConstraint' key or unique identity constraint.");
        types.add(t);
        for (const r of Array.from(rc.children)) {
          if (!r.hasAttribute('Id')) continue;
          const id = r.getAttribute('Id');
          if (ids.has(id)) fail("There is a duplicate key sequence '" + id + "' for the 'UniqueRuleIdConstraint' key or unique identity constraint.");
          ids.add(id);
        }
      }
    };
    return XT.validator({ ns: '', prefix: AL_ERR, rootName: 'AppLockerPolicy', root: C.AppLockerPolicy, unique });
  })();

  const AppLocker = {
    name: 'AppLocker',
    process(c) {
      const s = c.config.appLocker || { mode: 'skip' };
      if (s.mode === 'skip') return;
      if (s.mode !== 'configure') throw new Error('Unbekannte AppLocker-Einstellung: ' + s.mode);
      const parsed = XT.parse(String(s.policyXml || ''), AL_ERR);
      validateAppLocker(parsed.doc);
      const xmlFile = c.embedFile('AppLockerPolicy.xml', XT.pretty(parsed.doc, parsed.isEmpty));
      c.specializeScript.append(
        "Get-Service -Name 'AppIDSvc' | Set-Service -StartupType 'Automatic';\n" +
        "Get-Service -Name 'AppIDSvc' | Start-Service;\n" +
        "Set-AppLockerPolicy -XmlPolicy '" + xmlFile + "';");
    }
  };

  /* ---------- modifier/Script.cs ----------
     Nicht portiert: eigene Skripte laufen ueber die Module des Generators. */
  const Script = { name: 'Script', process() {} };

  /* ---------- modifier/Specialize.cs ---------- */
  const Specialize = {
    name: 'Specialize',
    process(c) {
      if (c.specializeScript.isEmpty) return;
      const ps1 = c.embedTextFile('Specialize.ps1', c.specializeScript.getScript());
      c.appender('specialize').append(c.cb.invokePowerShellScript(ps1));
    }
  };

  /* ---------- modifier/UserOnce.cs ---------- */
  const UserOnce = {
    name: 'UserOnce',
    process(c) {
      if (c.userOnceScript.isEmpty) return;
      const ps1 = c.embedTextFile('UserOnce.ps1', c.userOnceScript.getScript());
      const command = c.cb.invokePowerShellScript(ps1).replace(/"/g, '\\""');
      c.defaultUserScript.append('reg.exe add "HKU\\DefaultUser\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce" /v "UnattendedSetup" /t REG_SZ /d "' + command + '" /f;');
    }
  };

  /* ---------- modifier/DefaultUser.cs ---------- */
  const DefaultUser = {
    name: 'DefaultUser',
    process(c) {
      if (c.defaultUserScript.isEmpty) return;
      const a = c.appender('specialize');
      const ps1 = c.embedTextFile('DefaultUser.ps1', c.defaultUserScript.getScript());
      a.append(c.cb.registryCommand('load "HKU\\DefaultUser" "C:\\Users\\Default\\NTUSER.DAT"'));
      a.append(c.cb.invokePowerShellScript(ps1));
      a.append(c.cb.registryCommand('unload "HKU\\DefaultUser"'));
    }
  };

  /* ---------- modifier/Delete.cs ---------- */
  const Delete = {
    name: 'Delete',
    process(c) {
      if (c.config.keepSensitiveFiles) return;
      const s = c.config.account;
      if (s && s.mode === 'unattended' && (s.autoLogon || 'none') === 'none') {
        throw new ConfigurationException('To delete sensitive files, you must let Windows log on to an administrator account.');
      }
      c.firstLogonScript.append('Remove-Item -LiteralPath @(\r\n' +
        "  'C:\\Windows\\Panther\\unattend.xml';\r\n" +
        "  'C:\\Windows\\Panther\\unattend-original.xml';\r\n" +
        "  'C:\\Windows\\Setup\\Scripts\\Wifi.xml';\r\n" +
        ") -Force -ErrorAction 'SilentlyContinue' -Verbose;");
    }
  };

  /* ---------- modifier/FirstLogon.cs ---------- */
  const FirstLogon = {
    name: 'FirstLogon',
    process(c) {
      if (c.firstLogonScript.isEmpty) return;
      const ps1 = c.embedTextFile('FirstLogon.ps1', c.firstLogonScript.getScript());
      c.appender('oobe').append(c.cb.invokePowerShellScript(ps1));
    }
  };

  /* ---------- modifier/Components.cs ----------
     Nicht portiert: eigene Komponenten gibt es in der Oberflaeche nicht. */
  const Components = { name: 'Components', process() {} };

  /* ---------- modifier/Order.cs ---------- */
  const Order = {
    name: 'Order',
    process(c) {
      for (const container of c.selAll('//u:RunSynchronous | //u:RunAsynchronous | //u:FirstLogonCommands')) {
        let pos = 1;
        for (const child of c.selAll('*', container)) {
          if (c.selAll('u:Order', child).length) throw new Error("'" + child.localName + "' already contains an <Order> element.");
          const order = c.doc.createElementNS(UG.NS.u, 'Order');
          order.textContent = String(pos++);
          child.insertBefore(order, child.firstChild);
          child.setAttributeNS(UG.NS.wcm, 'wcm:action', 'add');
        }
      }
    }
  };

  /* ---------- modifier/ProcessorArchitecture.cs ---------- */
  const ProcessorArchitecture = {
    name: 'ProcessorArchitecture',
    process(c) {
      /* Im Original ein ImmutableHashSet<ProcessorArchitecture> - der zaehlt nach
         Enum-Wert auf (x86, amd64, arm64), nicht in der Reihenfolge der Auswahl. */
      const ORDER = ['x86', 'amd64', 'arm64'];
      const picked = (c.config.architectures || []).filter((a, i, all) => ORDER.includes(a) && all.indexOf(a) === i);
      const archs = picked.length ? picked.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)) : null;
      for (const component of c.selAll('//*[@processorArchitecture]')) {
        if (!archs) throw new ConfigurationException('At least one processor architecture must be selected.');
        component.setAttribute('processorArchitecture', archs[0]);
        /* Wie im Original: jede Kopie direkt hinter die urspruengliche
           Komponente - bei drei Architekturen also x86, arm64, amd64. */
        for (const arch of archs.slice(1)) {
          const copy = component.cloneNode(true);
          copy.setAttribute('processorArchitecture', arch);
          component.parentNode.insertBefore(copy, component.nextSibling);
        }
      }
    }
  };

  /* ---------- modifier/Pretty.cs ---------- PORT: im Serialisierer (core.js) */
  const Pretty = { name: 'Pretty', process() {} };

  UG.modifiers = [
    Build, Accessibility, ComputerName, Bypass, ProductKey, Locales, Disk, Users, Bloatware,
    ExpressSettings, Wifi, EmptyElements, Lockout, PasswordExpiration, Optimizations, Personalization,
    TimeZone, AppLocker, Script, Specialize, UserOnce, DefaultUser, Delete, FirstLogon, Components,
    Order, ProcessorArchitecture, Pretty
  ];

  /* Standardwerte wie Configuration.Default im Original */
  UG.defaultConfig = function () {
    return {
      language: { mode: 'interactive', image: 'de-DE', locales: [{ locale: 'de-DE', keyboard: '00000407' }], geo: '94' },
      account: { mode: 'interactive-ms', accounts: [{ name: 'Admin', displayName: '', password: '', group: ADMINISTRATORS }],
        autoLogon: 'own', builtinPassword: '', obscure: true },
      lockout: { mode: 'default', threshold: 10, duration: 10, window: 10 },
      passwordExpiration: { mode: 'default', maxAge: 42 },
      computerName: { mode: 'random', name: '' },
      timeZone: { mode: 'implicit', id: 'W. Europe Standard Time' },
      wifi: { mode: 'interactive', name: '', password: '', authentication: 'WPA2PSK', connectAutomatically: true, nonBroadcast: false, xml: '' },
      edition: { mode: 'interactive', edition: 'pro', key: '' },
      activationKey: '',
      bypassRequirements: true,
      bypassNetwork: false,
      expressSettings: 'disableAll',
      architectures: ['amd64'],
      pe: {
        mode: 'default', script: '',
        partition: {
          mode: 'unattended', layout: 'Automatic', recovery: 'Partition', systemSize: 300, recoverySize: 1000, customScript: '',
          target: { mode: 'generated', index: 0, minSizeGiB: 100, maxSizeGiB: 4000, assertNoPartitions: true, assertInterfaceType: false, assertMediaType: false, script: '' }
        },
        installFrom: { mode: 'edition', edition: 'pro', index: 1, name: '' },
        pagingFile: { mode: 'automatic', initialSizeMiB: 1024, maxSizeMiB: 4096 },
        disableDefender: false, disable8Dot3Names: false, pauseBeforeFormatting: false, pauseBeforeReboot: false,
        compactOs: false, skipIntegrityCheck: false
      },
      deleteEdgeDesktopIcon: false,
      lockKeys: { mode: 'default', capsLock: { initial: 'Off', behavior: 'Toggle' }, numLock: { initial: 'On', behavior: 'Toggle' }, scrollLock: { initial: 'Off', behavior: 'Toggle' } },
      effects: { mode: 'default', custom: {} },
      desktopIcons: { mode: 'default', show: [] },
      startFolders: { mode: 'default', show: [] },
      appLocker: { mode: 'skip', policyXml: '' },
      colors: { mode: 'default', systemTheme: 'Dark', appsTheme: 'Light', accentColor: '#0078D4', accentOnStart: true, accentOnBorders: true, transparency: true },
      hidePowerShellWindows: false,
      keepSensitiveFiles: false,
      useNarrator: false
    };
  };

  UG.validateComputerName = validateComputerName;
  UG.EFFECTS = EFFECTS;
  UG.startFolders = startFolders;
})(typeof window !== 'undefined' ? window : globalThis);
