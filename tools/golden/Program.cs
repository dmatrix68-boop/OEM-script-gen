// Golden-Test-Harness: uebersetzt die JSON-Konfiguration des Ports (js/ug,
// siehe Kopf von js/ug/modifiers.js) in die Configuration des Originals und
// schreibt dessen Ergebnis. Nur Lesen und Schreiben im Ausgabeordner.
//
//   dotnet run --project tools/golden -p:UGDIR=<Klon> -- <resolved.json> <Ausgabeordner>
//
// Je Fall <name>.xml (UnattendGenerator.Serialize) oder <name>.error mit der
// Meldung der ConfigurationException.
using System;
using System.Collections.Generic;
using System.Collections.Immutable;
using System.Drawing;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.Json;

namespace Schneegans.Unattend;

static class Program
{
  static int Main(string[] args)
  {
    if (args.Length != 2)
    {
      Console.Error.WriteLine("Aufruf: Harness <resolved.json> <Ausgabeordner>");
      return 2;
    }
    var gen = new UnattendGenerator();
    using var doc = JsonDocument.Parse(File.ReadAllText(args[0]));
    Directory.CreateDirectory(args[1]);
    int count = 0;
    foreach (JsonElement c in doc.RootElement.EnumerateArray())
    {
      string name = c.GetProperty("name").GetString()!;
      string baseName = Path.Combine(args[1], name);
      try
      {
        Configuration conf = Build(gen, c.GetProperty("config"));
        File.WriteAllBytes(baseName + ".xml", UnattendGenerator.Serialize(gen.GenerateXml(conf)));
      }
      catch (ConfigurationException e)
      {
        File.WriteAllText(baseName + ".error", e.Message, new UTF8Encoding(false));
      }
      catch (Exception e)
      {
        File.WriteAllText(baseName + ".error", e.GetType().Name + ": " + e.Message, new UTF8Encoding(false));
      }
      count++;
    }
    Console.WriteLine($"Harness: {count} Faelle nach {args[1]}");
    return 0;
  }

  static string Str(JsonElement o, string key, string fallback = "")
  {
    return o.ValueKind == JsonValueKind.Object && o.TryGetProperty(key, out JsonElement v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : fallback;
  }

  static bool Bool(JsonElement o, string key)
  {
    return o.ValueKind == JsonValueKind.Object && o.TryGetProperty(key, out JsonElement v) && v.ValueKind == JsonValueKind.True;
  }

  static int? Int(JsonElement o, string key)
  {
    if (!o.TryGetProperty(key, out JsonElement v)) return null;
    return v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;
  }

  // Wie im Port: fehlt ein Wert, gilt die Voreinstellung; ein ausdrueckliches null bleibt null.
  static int? IntOr(JsonElement o, string key, int? fallback)
  {
    if (!o.TryGetProperty(key, out JsonElement v)) return fallback;
    return v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;
  }

  static bool BoolOr(JsonElement o, string key, bool fallback)
  {
    if (!o.TryGetProperty(key, out JsonElement v)) return fallback;
    return v.ValueKind == JsonValueKind.True;
  }

  static IPESettings BuildPE(UnattendGenerator gen, JsonElement c, IEditionSettings edition)
  {
    JsonElement pe = c.TryGetProperty("pe", out JsonElement x) ? x : default;
    string mode = pe.ValueKind == JsonValueKind.Object ? Str(pe, "mode", "default") : "default";
    if (mode == "script") return new ScriptPESetttings(Str(pe, "script"));
    if (mode != "generate")
    {
      return new DefaultPESettings(
        EditionSettings: edition,
        BypassRequirementsCheck: Bool(c, "bypassRequirements"),
        UseConfigurationSet: Bool(c, "useConfigurationSet")
      );
    }

    JsonElement p = Obj(pe, "partition");
    JsonElement t = p.TryGetProperty("target", out JsonElement tt) ? tt : default;
    ITargetDiskSettings target = (t.ValueKind == JsonValueKind.Object ? Str(t, "mode", "generated") : "generated") switch
    {
      "interactive" => new InteractiveTargetDiskSettings(),
      "fixed" => new FixedTargetDiskSettings(IntOr(t, "index", 0) ?? 0),
      "script" => new ScriptTargetDiskSettings(Str(t, "script")),
      _ => new GeneratedTargetDiskSettings(
        minSizeGiB: IntOr(t, "minSizeGiB", Constants.TargetDiskMinSizeGiB),
        maxSizeGiB: IntOr(t, "maxSizeGiB", Constants.TargetDiskMaxSizeGiB),
        index: IntOr(t, "index", 0),
        assertNoPartitions: BoolOr(t, "assertNoPartitions", true),
        assertInterfaceType: BoolOr(t, "assertInterfaceType", false),
        assertMediaType: BoolOr(t, "assertMediaType", false)
      ),
    };
    IPartitionSettings partition = Str(p, "mode") switch
    {
      "custom" => new CustomPartitionSettings(Str(p, "customScript")),
      "unattended" => new UnattendedPartitionSettings(
        TargetDiskSettings: target,
        PartitionLayout: Enum.Parse<PartitionLayout>(Str(p, "layout", "Automatic")),
        RecoveryMode: Enum.Parse<RecoveryMode>(Str(p, "recovery", "Partition")),
        SystemSize: IntOr(p, "systemSize", Constants.SystemPartitionSize) ?? Constants.SystemPartitionSize,
        RecoverySize: IntOr(p, "recoverySize", Constants.RecoveryPartitionSize) ?? Constants.RecoveryPartitionSize
      ),
      _ => new InteractivePartitionSettings(),
    };
    JsonElement i = Obj(pe, "installFrom");
    IInstallFromSettings installFrom = Str(i, "mode") switch
    {
      "index" => new IndexInstallFromSettings(IntOr(i, "index", 1) ?? 1),
      "name" => new NameInstallFromSettings(Str(i, "name")),
      "edition" => new EditionInstallFromSettings(gen.Lookup<WindowsEdition>(Str(i, "edition"))),
      _ => new InteractiveInstallFromSettings(),
    };
    JsonElement pf = Obj(pe, "pagingFile");
    IPagingFileSettings paging = Str(pf, "mode") switch
    {
      "none" => new NoPagingFileSettings(),
      "custom" => new CustomPagingFileSettings(IntOr(pf, "initialSizeMiB", 0) ?? 0, IntOr(pf, "maxSizeMiB", 0) ?? 0),
      _ => new AutomaticPagingFileSettings(),
    };
    return new GeneratePESettings(
      PartitionSettings: partition,
      InstallFromSettings: installFrom,
      PagingFileSettings: paging,
      DisableDefender: Bool(pe, "disableDefender"),
      Disable8Dot3Names: Bool(pe, "disable8Dot3Names"),
      PauseBeforeFormatting: Bool(pe, "pauseBeforeFormatting"),
      PauseBeforeReboot: Bool(pe, "pauseBeforeReboot"),
      CompactOs: Bool(pe, "compactOs"),
      SkipIntegrityCheck: Bool(pe, "skipIntegrityCheck")
    );
  }

  static JsonElement Opt(JsonElement o, string key)
  {
    return o.TryGetProperty(key, out JsonElement v) && v.ValueKind == JsonValueKind.Object ? v : default;
  }

  static string Mode(JsonElement o)
  {
    return o.ValueKind == JsonValueKind.Object ? Str(o, "mode", "default") : "default";
  }

  static HashSet<string> Strings(JsonElement o, string key)
  {
    HashSet<string> set = [];
    if (o.ValueKind == JsonValueKind.Object && o.TryGetProperty(key, out JsonElement a) && a.ValueKind == JsonValueKind.Array)
    {
      foreach (JsonElement e in a.EnumerateArray()) set.Add(e.GetString()!);
    }
    return set;
  }

  static ILockKeySettings BuildLockKeys(JsonElement c)
  {
    JsonElement lk = Opt(c, "lockKeys");
    if (Mode(lk) != "configure") return new SkipLockKeySettings();
    LockKeySetting Key(string name)
    {
      JsonElement k = Obj(lk, name);
      return new LockKeySetting(Enum.Parse<LockKeyInitial>(Str(k, "initial", "Off")), Enum.Parse<LockKeyBehavior>(Str(k, "behavior", "Toggle")));
    }
    return new ConfigureLockKeySettings(Key("capsLock"), Key("numLock"), Key("scrollLock"));
  }

  static IEffects BuildEffects(JsonElement c)
  {
    JsonElement fx = Opt(c, "effects");
    switch (Mode(fx))
    {
      case "bestAppearance": return new BestAppearanceEffects();
      case "bestPerformance": return new BestPerformanceEffects();
      case "custom":
        JsonElement custom = Opt(fx, "custom");
        var b = ImmutableDictionary.CreateBuilder<Effect, bool>();
        foreach (Effect e in Enum.GetValues<Effect>())
        {
          b.Add(e, custom.ValueKind == JsonValueKind.Object && Bool(custom, e.ToString()));
        }
        return new CustomEffects(b.ToImmutable());
      default: return new DefaultEffects();
    }
  }

  static IDesktopIconSettings BuildDesktopIcons(UnattendGenerator gen, JsonElement c)
  {
    JsonElement di = Opt(c, "desktopIcons");
    if (Mode(di) != "custom") return new DefaultDesktopIconSettings();
    HashSet<string> show = Strings(di, "show");
    return new CustomDesktopIconSettings(gen.DesktopIcons.Values.ToDictionary(i => i, i => show.Contains(i.Id)));
  }

  static IStartFolderSettings BuildStartFolders(UnattendGenerator gen, JsonElement c)
  {
    JsonElement sf = Opt(c, "startFolders");
    if (Mode(sf) != "custom") return new DefaultStartFolderSettings();
    HashSet<string> show = Strings(sf, "show");
    return new CustomStartFolderSettings(gen.StartFolders.Values.ToDictionary(f => f, f => show.Contains(f.Id)));
  }

  static IColorSettings BuildColors(JsonElement c)
  {
    JsonElement col = Opt(c, "colors");
    if (Mode(col) != "custom") return new DefaultColorSettings();
    int rgb = int.Parse(Str(col, "accentColor", "#0078D4").TrimStart('#'), NumberStyles.HexNumber);
    return new CustomColorSettings(
      SystemTheme: Enum.Parse<ColorTheme>(Str(col, "systemTheme", "Dark")),
      AppsTheme: Enum.Parse<ColorTheme>(Str(col, "appsTheme", "Light")),
      EnableTransparency: Bool(col, "transparency"),
      AccentColorOnStart: Bool(col, "accentOnStart"),
      AccentColorOnBorders: Bool(col, "accentOnBorders"),
      AccentColor: Color.FromArgb(255, (rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF)
    );
  }

  static Color HtmlColor(string html)
  {
    int rgb = int.Parse(html.TrimStart('#'), NumberStyles.HexNumber);
    return Color.FromArgb(255, (rgb >> 16) & 0xFF, (rgb >> 8) & 0xFF, rgb & 0xFF);
  }

  static IWallpaperSettings BuildWallpaper(JsonElement c)
  {
    JsonElement w = Opt(c, "wallpaper");
    return Mode(w) switch
    {
      "solid" => new SolidWallpaperSettings(Color: HtmlColor(Str(w, "color", "#000000"))),
      "script" => new ScriptWallpaperSettings(Script: Str(w, "script")),
      _ => new DefaultWallpaperSettings(),
    };
  }

  static ILockScreenSettings BuildLockScreen(JsonElement c)
  {
    JsonElement l = Opt(c, "lockScreen");
    return Mode(l) == "script" ? new ScriptLockScreenSettings(Script: Str(l, "script")) : new DefaultLockScreenSettings();
  }

  static IWifiSettings BuildWifi(JsonElement c)
  {
    JsonElement w = Opt(c, "wifi");
    switch (w.ValueKind == JsonValueKind.Object ? Str(w, "mode", "interactive") : "interactive")
    {
      case "skip": return new SkipWifiSettings();
      case "unattended":
        return new ParameterizedWifiSettings(
          Name: Str(w, "name"),
          Password: Str(w, "password"),
          ConnectAutomatically: Bool(w, "connectAutomatically"),
          Authentication: Enum.Parse<WifiAuthentications>(Str(w, "authentication", "WPA2PSK")),
          NonBroadcast: Bool(w, "nonBroadcast"));
      case "xml": return new XmlWifiSettings(Str(w, "xml"));
      default: return new InteractiveWifiSettings();
    }
  }

  static IAppLockerSettings BuildAppLocker(JsonElement c)
  {
    JsonElement al = Opt(c, "appLocker");
    if (Mode(al) != "configure") return new SkipAppLockerSettings();
    return new ConfigureAppLockerSettings(PolicyXml: Str(al, "policyXml"));
  }

  static JsonElement Obj(JsonElement o, string key)
  {
    return o.GetProperty(key);
  }

  static Configuration Build(UnattendGenerator gen, JsonElement c)
  {
    // Sprache
    ILanguageSettings language;
    JsonElement lang = Obj(c, "language");
    if (Str(lang, "mode") == "unattended")
    {
      List<LocaleAndKeyboard> pairs = [];
      foreach (JsonElement p in lang.GetProperty("locales").EnumerateArray())
      {
        string l = Str(p, "locale"), k = Str(p, "keyboard");
        if (l.Length == 0 || k.Length == 0) continue;
        pairs.Add(new LocaleAndKeyboard(gen.Lookup<UserLocale>(l), gen.Lookup<KeyboardIdentifier>(k)));
      }
      language = new UnattendedLanguageSettings(
        ImageLanguage: gen.Lookup<ImageLanguage>(Str(lang, "image")),
        LocaleAndKeyboard: pairs[0],
        LocaleAndKeyboard2: pairs.Count > 1 ? pairs[1] : null,
        LocaleAndKeyboard3: pairs.Count > 2 ? pairs[2] : null,
        GeoLocation: gen.Lookup<GeoLocation>(Str(lang, "geo"))
      );
    }
    else
    {
      language = new InteractiveLanguageSettings();
    }

    // Konten
    IAccountSettings account;
    JsonElement acc = Obj(c, "account");
    switch (Str(acc, "mode"))
    {
      case "unattended":
        var accounts = acc.GetProperty("accounts").EnumerateArray()
          .Select(a => new Account(Str(a, "name"), Str(a, "displayName"), Str(a, "password"), Str(a, "group")))
          .ToImmutableList();
        IAutoLogonSettings autoLogon = Str(acc, "autoLogon") switch
        {
          "own" => new OwnAutoLogonSettings(),
          "builtin" => new BuiltinAutoLogonSettings(Str(acc, "builtinPassword")),
          _ => new NoneAutoLogonSettings(),
        };
        account = new UnattendedAccountSettings(accounts, autoLogon, Bool(acc, "obscure"));
        break;
      case "interactive-local":
        account = new InteractiveLocalAccountSettings();
        break;
      default:
        account = new InteractiveMicrosoftAccountSettings();
        break;
    }

    // Kontosperrung, Kennwortablauf
    JsonElement lo = Obj(c, "lockout");
    ILockoutSettings lockout = Str(lo, "mode") switch
    {
      "disabled" => new DisableLockoutSettings(),
      "custom" => new CustomLockoutSettings(Int(lo, "threshold"), Int(lo, "duration"), Int(lo, "window")),
      _ => new DefaultLockoutSettings(),
    };
    JsonElement pw = Obj(c, "passwordExpiration");
    IPasswordExpirationSettings expiration = Str(pw, "mode") switch
    {
      "unlimited" => new UnlimitedPasswordExpirationSettings(),
      "custom" => new CustomPasswordExpirationSettings(Int(pw, "maxAge")),
      _ => new DefaultPasswordExpirationSettings(),
    };

    // Computername, Zeitzone, WLAN
    JsonElement cn = Obj(c, "computerName");
    IComputerNameSettings computerName = Str(cn, "mode") switch
    {
      "custom" => new CustomComputerNameSettings(Str(cn, "name")),
      "prompt" => new PromptComputerNameSettings(),
      _ => new RandomComputerNameSettings(),
    };
    JsonElement tz = Obj(c, "timeZone");
    ITimeZoneSettings timeZone = Str(tz, "mode") == "explicit"
      ? gen.CreateExplicitTimeZoneSettings(Str(tz, "id"))
      : new ImplicitTimeZoneSettings();
    IWifiSettings wifi = BuildWifi(c);

    // Edition
    JsonElement ed = Obj(c, "edition");
    IEditionSettings edition = Str(ed, "mode") switch
    {
      "firmware" => new FirmwareEditionSettings(),
      "edition" => new UnattendedEditionSettings(gen.Lookup<WindowsEdition>(Str(ed, "edition"))),
      "key" => new CustomEditionSettings(new ProductKey(Str(ed, "key"))),
      _ => new InteractiveEditionSettings(),
    };
    string activation = Str(c, "activationKey");

    ExpressSettingsMode express = Str(c, "expressSettings", "disableAll") switch
    {
      "interactive" => ExpressSettingsMode.Interactive,
      "enableAll" => ExpressSettingsMode.EnableAll,
      _ => ExpressSettingsMode.DisableAll,
    };

    var archs = c.GetProperty("architectures").EnumerateArray()
      .Select(a => Enum.Parse<ProcessorArchitecture>(a.GetString()!))
      .ToImmutableHashSet();

    return Configuration.Default with
    {
      LanguageSettings = language,
      AccountSettings = account,
      LockoutSettings = lockout,
      PasswordExpirationSettings = expiration,
      ComputerNameSettings = computerName,
      TimeZoneSettings = timeZone,
      WifiSettings = wifi,
      PESettings = BuildPE(gen, c, edition),
      ActivationKey = activation.Length > 0 ? new ProductKey(activation) : null,
      BypassNetworkCheck = Bool(c, "bypassNetwork"),
      ExpressSettings = express,
      ProcessorArchitectures = archs,
      HidePowerShellWindows = Bool(c, "hidePowerShellWindows"),
      KeepSensitiveFiles = Bool(c, "keepSensitiveFiles"),
      UseNarrator = Bool(c, "useNarrator"),
      DeleteEdgeDesktopIcon = Bool(c, "deleteEdgeDesktopIcon"),
      LockKeySettings = BuildLockKeys(c),
      Effects = BuildEffects(c),
      DesktopIcons = BuildDesktopIcons(gen, c),
      StartFolderSettings = BuildStartFolders(gen, c),
      ColorSettings = BuildColors(c),
      AppLockerSettings = BuildAppLocker(c),
      WallpaperSettings = BuildWallpaper(c),
      LockScreenSettings = BuildLockScreen(c),
      VBoxGuestAdditions = Bool(Opt(c, "vmTools"), "virtualBox"),
      VMwareTools = Bool(Opt(c, "vmTools"), "vmware"),
      VirtIoGuestTools = Bool(Opt(c, "vmTools"), "virtIo"),
      ParallelsTools = Bool(Opt(c, "vmTools"), "parallels"),
    };
  }
}
