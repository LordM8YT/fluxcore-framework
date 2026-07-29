# Configuration

Fluxcore keeps safe defaults inside each resource and exposes operator settings through JSON, Lua configuration files and server convars.

## Core convars

Place core settings before every `ensure fluxcore_*` line:

```cfg
set sv_stateBagStrictMode true
voice_internal

setr fluxcore_locale "en"
set fluxcore_maxCharacters 4
set fluxcore_saveIntervalMs 60000
```

| Convar                    | Default | Purpose                                |
| ------------------------- | ------- | -------------------------------------- |
| `fluxcore_locale`         | `en`    | shared server, client and NUI language |
| `fluxcore_fallbackLocale` | `en`    | fallback catalog                       |
| `fluxcore_maxCharacters`  | `4`     | maximum character slots per account    |
| `fluxcore_saveIntervalMs` | `60000` | active-character autosave interval     |

Use `setr` for locale because clients must receive it. See [Localization](localization.md).

## Resource order

Start the core before every resource that consumes its exports:

```cfg
setr sv_showBusySpinnerOnLoadingScreen false

ensure fluxcore_loading
ensure fluxcore_core
ensure fluxcore_chat
ensure fluxcore_voice
ensure fluxcore_interact
ensure fluxcore_jobs
ensure fluxcore_inventory
ensure fluxcore_status
ensure fluxcore_banking
ensure fluxcore_vehicles
ensure fluxcore_fuel
ensure fluxcore_appearance
ensure fluxcore_businesses
ensure fluxcore_services
ensure fluxcore_dispatch
ensure fluxcore_mdt
ensure fluxcore_properties
ensure fluxcore_world
ensure fluxcore_admin
ensure fluxcore_phone
ensure fluxcore_identity
```

The manifests also declare dependencies, but explicit order keeps boot output predictable.

## Resource files

| Resource              | Main configuration                           |
| --------------------- | -------------------------------------------- |
| `fluxcore_identity`   | `config.lua`                                 |
| `fluxcore_loading`    | bundled `web/` files                         |
| `fluxcore_voice`      | `config/voice.json`                          |
| `fluxcore_jobs`       | `config/jobs.json`                           |
| `fluxcore_inventory`  | `config/items.json`, `config/ui.json`        |
| `fluxcore_status`     | `config/status.json`                         |
| `fluxcore_vehicles`   | `config/vehicles.json`                       |
| `fluxcore_fuel`       | `config/fuel.json`                           |
| `fluxcore_appearance` | `config/appearance.json`                     |
| `fluxcore_banking`    | `fluxcore_banking/config/banking.json`       |
| `fluxcore_businesses` | `fluxcore_businesses/config/businesses.json` |
| `fluxcore_services`   | `fluxcore_services/config/services.json`     |
| `fluxcore_dispatch`   | `fluxcore_dispatch/config/dispatch.json`     |
| `fluxcore_mdt`        | `fluxcore_mdt/config/mdt.json`               |
| `fluxcore_properties` | `fluxcore_properties/config/properties.json` |
| `fluxcore_world`      | `fluxcore_world/config/world.json`           |
| `fluxcore_admin`      | `config/admin.json`                          |
| `fluxcore_phone`      | `config/phone.json`                          |

Restart the owning resource after changing a configuration file.

`fluxcore_status/config/status.json` also controls `disableVanillaHud`,
`disableVanillaPolice` and `minimapVehicleOnly`. See
[Player Experience](player-experience.md).

Base-map coordinates are defaults. Server owners can replace them for their MLOs.

## ACE permissions

The txAdmin recipe grants the root permissions to `group.admin`:

```cfg
add_ace group.admin command allow
add_ace group.admin command.quit deny
add_ace group.admin fluxcore.admin allow
add_ace group.admin fluxcore.jobs.manage allow
add_ace group.admin fluxcore.vehicles.manage allow
add_ace group.admin fluxcore.businesses.manage allow
```

Assign a player principal locally:

```cfg
add_principal identifier.license:REPLACE_ME group.admin
```

{% hint style="warning" %}
Never commit real player identifiers, license keys, IP addresses or access tokens. See [Security and ACE](security-and-ace.md) for granular roles.
{% endhint %}

## Jobs

Jobs and grades live in `fluxcore_jobs/config/jobs.json`. Every grade has:

* stable internal name
* translated/display label
* payment
* explicit permission list
* optional duty points and map blips

`payIntervalMs` controls payday frequency (15 minutes by default) and
`payCurrency` selects the wallet. Only an active paid job that is currently
on duty receives a server-issued payment.

{% hint style="warning" %}
Internal names must remain language-independent. Changing them is a data migration, not a cosmetic rename.
{% endhint %}

## Inventory

Items live in `fluxcore_inventory/config/items.json`. Weight is measured in integer grams. Stack limits, labels and usable behavior are server-owned.
The optional `starterItems` list is granted atomically when a character's
inventory container is created for the first time. Removing every item later
does not grant the package again.

The bundled temporary inventory UI follows `fluxcore.inventory.bootstrap.v1`.
TAB opens it and suppresses the GTA weapon wheel. `water`, `sandwich`, and
`bandage` effects are configured under `fluxcore_status/config/status.json`.

## Vehicles and garages

Garages live in `fluxcore_vehicles/config/vehicles.json`. Each garage declares coordinates, accepted vehicle types and optional blip data. The default public parking locations use accessible base-map exteriors and require no MLO.

## Fuel

Fuel stations, station radii, price, currency and consumption multiplier live in `fluxcore_fuel/config/fuel.json`. Prices are whole currency units per liter. `defaultTankLiters` is used when a vehicle model does not expose a valid `fPetrolTankVolume`, so a partly filled tank is not mistaken for a full one. The server validates the driver, network entity, station distance, quantity and wallet before approving a purchase.

## Phone

The text phone does not require an inventory item by default. To require one:

```json
{
  "requirePhoneItem": true,
  "phoneItem": "phone"
}
```

{% hint style="warning" %}
Phone number prefix and length should be treated as permanent after accounts exist.
{% endhint %}

## Local-only secrets

Keep these outside the repository:

* `sv_licenseKey`
* Discord bot tokens and webhook URLs
* production player identifiers
* private ACE principal files
* production database backups
