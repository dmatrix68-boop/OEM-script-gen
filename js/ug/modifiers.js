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
      wifi:       { mode: 'interactive' | 'skip' }
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
      if (c.config.bypassRequirements) {
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
      /* PORT: Nur DefaultPESettings - der pe.cmd-Modus folgt in Schritt 2. */
      switch (e.mode) {
        case 'edition': set(lookup('WindowsEdition', e.edition).ProductKey, 'OnError'); break;
        case 'key': set(productKey(e.key), 'OnError'); break;
        case 'interactive': set('00000-00000-00000-00000-00000', 'Always'); break;
        case 'firmware': keyElement.parentNode.removeChild(keyElement); uiElement.textContent = 'Never'; break;
        default: throw new Error('Unbekannter Modus fuer die Edition: ' + e.mode);
      }
      const activation = c.config.activationKey ? productKey(c.config.activationKey) : (e.mode === 'key' ? productKey(e.key) : null);
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
     PORT: nur DefaultPESettings. pe.cmd, Partitionierung und Zieldatentraeger
     folgen in Schritt 2; bis dahin waehlt man die Partitionen in Setup selbst. */
  const Disk = {
    name: 'Disk',
    process(c) {
      if (c.config.useConfigurationSet) c.sel('//u:UseConfigurationSet').textContent = 'true';
      const copy = c.sel('//s:PEScriptCopy');
      copy.parentNode.removeChild(copy);
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

  /* ---------- modifier/Wifi.cs ----------
     PORT: interaktiv und ueberspringen; WLAN-Profil folgt in Schritt 3. */
  const Wifi = {
    name: 'Wifi',
    process(c) {
      const elem = c.sel('//u:OOBE/u:HideWirelessSetupInOOBE');
      const mode = (c.config.wifi && c.config.wifi.mode) || 'interactive';
      if (mode === 'interactive') elem.textContent = 'false';
      else if (mode === 'skip') elem.textContent = 'true';
      else throw new Error('Unbekannte WLAN-Einstellung: ' + mode);
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
      const threshold = inRange(s.threshold, 0, 999);
      const duration = inRange(s.duration, 1, 99999);
      const window = inRange(s.window, 1, 99999);
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
      c.specializeScript.append('net.exe accounts /maxpwage:' + inRange(s.maxAge, 1, 999) + ';');
    }
  };

  /* ---------- modifier/Optimizations.cs, Personalization.cs ----------
     Nicht portiert: Tweaks liefert der Generator selbst. Mit den Standardwerten
     des Originals erzeugen beide keine Ausgabe. */
  const Optimizations = { name: 'Optimizations', process() {} };
  const Personalization = { name: 'Personalization', process() {} };

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

  /* ---------- modifier/AppLocker.cs, Script.cs ----------
     Nicht portiert: AppLocker gibt es in der Oberflaeche nicht; eigene Skripte
     laufen ueber die Module des Generators. */
  const AppLocker = { name: 'AppLocker', process() {} };
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
      const archs = (c.config.architectures && c.config.architectures.length) ? c.config.architectures : null;
      for (const component of c.selAll('//*[@processorArchitecture]')) {
        if (!archs) throw new ConfigurationException('At least one processor architecture must be selected.');
        component.setAttribute('processorArchitecture', archs[0]);
        let after = component;
        for (const arch of archs.slice(1)) {
          const copy = component.cloneNode(true);
          copy.setAttribute('processorArchitecture', arch);
          after.parentNode.insertBefore(copy, after.nextSibling);
          after = copy;
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
      wifi: { mode: 'interactive' },
      edition: { mode: 'interactive', edition: 'pro', key: '' },
      activationKey: '',
      bypassRequirements: true,
      bypassNetwork: false,
      expressSettings: 'disableAll',
      architectures: ['amd64'],
      hidePowerShellWindows: false,
      keepSensitiveFiles: false,
      useNarrator: false
    };
  };

  UG.validateComputerName = validateComputerName;
})(typeof window !== 'undefined' ? window : globalThis);
