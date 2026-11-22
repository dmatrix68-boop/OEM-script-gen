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
    return o.TryGetProperty(key, out JsonElement v) && v.ValueKind == JsonValueKind.String ? v.GetString()! : fallback;
  }

  static bool Bool(JsonElement o, string key)
  {
    return o.TryGetProperty(key, out JsonElement v) && v.ValueKind == JsonValueKind.True;
  }

  static int? Int(JsonElement o, string key)
  {
    if (!o.TryGetProperty(key, out JsonElement v)) return null;
    return v.ValueKind == JsonValueKind.Number ? v.GetInt32() : null;
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
    IWifiSettings wifi = Str(Obj(c, "wifi"), "mode") == "skip" ? new SkipWifiSettings() : new InteractiveWifiSettings();

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
      PESettings = new DefaultPESettings(
        EditionSettings: edition,
        BypassRequirementsCheck: Bool(c, "bypassRequirements"),
        UseConfigurationSet: Bool(c, "useConfigurationSet")
      ),
      ActivationKey = activation.Length > 0 ? new ProductKey(activation) : null,
      BypassNetworkCheck = Bool(c, "bypassNetwork"),
      ExpressSettings = express,
      ProcessorArchitectures = archs,
      HidePowerShellWindows = Bool(c, "hidePowerShellWindows"),
      KeepSensitiveFiles = Bool(c, "keepSensitiveFiles"),
      UseNarrator = Bool(c, "useNarrator"),
    };
  }
}
