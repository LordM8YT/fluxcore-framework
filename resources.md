# Resources

`fluxcore_ui` is the temporary frontend adapter for domain resources that
already expose versioned bootstrap data but do not yet own a finished NUI. It
uses `fluxcore_interact` menus and dialogs, reads no database directly, and can
be removed when replacement frontends subscribe to the same client open events
and `Request` exports.

`fluxcore_status` includes the temporary HUD renderer for health, armor,
hunger, thirst, stress, job and vehicle information. It consumes
`fluxcore.hud.bootstrap.v1`; a replacement HUD can keep the same contract and
remove only the bundled `web/` presentation.

`fluxcore_voice` owns the Enhanced-native proximity channel and exposes local
talking state without coupling it to the temporary HUD. See [Voice](voice.md).

Fluxcore separates domains into small owning resources. Install all resources together for the complete framework, or omit optional UI/domain resources when their dependants are not used.

## `fluxcore_core`

Owns accounts, characters, sessions, wallets, metadata, active job snapshots and position persistence.

Key server exports:

* `GetPlayer(identifier)`
* `GetPlayers()`
* `GetPlayerSource(characterId)`
* `AddMoney`, `RemoveMoney`, `SetMoney`
* `SetMetadata`
* `SetJob`
* `SavePlayer`

Read [Core API](core-api.md).

## `fluxcore_identity`

Provides character selection, creation, deletion and spawn choice with plain HTML, CSS and JavaScript.

Configuration in `config.lua` controls:

* Title and subtitle
* Whether deletion is visible
* Spawn locations

Ownership, slot limits and deletion confirmation remain server-authoritative in core. If identity is stopped, core falls back to the saved character position.

## `fluxcore_jobs`

Owns persistent job assignments, grades, duty state and resource permissions.

Server exports:

* `GetJobs(identifier)`
* `HasJob(identifier, jobName, minimumGrade)`
* `HasPermission(identifier, permission, options)`
* `AssignJob(identifier, jobName, grade)`
* `RemoveJob(identifier, jobName)`
* `SetActiveJob(identifier, jobName)`
* `SetDuty(identifier, onDuty)`

Player commands:

* `/jobs`
* `/job <name>`
* `/duty`

Management commands:

* `/assignjob <source> <job> <grade>`
* `/removejob <source> <job>`

```cfg
add_ace group.admin fluxcore.jobs.manage allow
```

Duty changes are validated against actual server-observed coordinates. Default points use Mission Row, Pillbox Medical and La Mesa Customs without MLOs.

## `fluxcore_inventory`

Owns player inventories, registered containers and temporary world drops.

Read exports:

```lua
local inventory = exports.fluxcore_inventory:GetInventory(source)
local count = exports.fluxcore_inventory:GetItemCount(source, 'water')
local hasItem = exports.fluxcore_inventory:HasItem(source, 'radio', 1)
local canCarry = exports.fluxcore_inventory:CanCarryItem(source, 'water', 2)
```

Mutation exports:

* `AddItem`
* `RemoveItem`
* `MoveItem`
* `TransferItem`
* `RegisterStash`
* `RegisterContainer`
* `DeleteContainer`
* `OpenInventory`

Slot, stack and weight checks run on the server. UI clients submit only the opaque `player` and `secondary` sides; the server resolves container IDs.

Temporary test commands include `/inventory`, `/invslot`, `/useitem`, `/dropitem`, `/takeitem` and `/putitem`.

## `fluxcore_status`

Owns persistent hunger, thirst and stress. It also creates a complete, UI-independent HUD snapshot.

Server exports:

```lua
local status = exports.fluxcore_status:GetStatus(source)
exports.fluxcore_status:RemoveStatus(source, 'hunger', 10)
exports.fluxcore_status:AddStatus(source, 'stress', 5)
exports.fluxcore_status:SetStatus(source, 'thirst', 100)
exports.fluxcore_status:ResetStatus(source)
```

Client:

```lua
local needs = exports.fluxcore_status:GetStatus()
local hud = exports.fluxcore_status:GetHudData()

AddEventHandler('fluxcore_status:client:hudUpdated', function(snapshot)
end)
```

Health, armor, stamina and vehicle telemetry come from local natives and are not trusted as server data.

## `fluxcore_vehicles`

Owns persistent vehicles, shareable keys, public garages, locks and trunk integration.

Server exports:

```lua
exports.fluxcore_vehicles:RegisterOwnedVehicle(source, vehicle)
exports.fluxcore_vehicles:GetVehicles(source)
exports.fluxcore_vehicles:HasKey(source, vehicleId)
exports.fluxcore_vehicles:GiveKey(ownerSource, targetSource, vehicleId)
exports.fluxcore_vehicles:RevokeKey(ownerSource, targetSource, vehicleId)
exports.fluxcore_vehicles:SpawnVehicle(source, vehicleId, garageId)
```

Vehicles are created server-side through OneSync. Clients never select the owner, trusted world position, trunk container or stored state.

Test commands include `/garage`, `/trunk`, `/vlock` and the ACE-protected `/givevehicle`.

## `fluxcore_fuel`

Enables FiveM's native vehicle fuel consumption and adds configurable base-map fuel stations. Players use the shared target cursor or `/refuel [liters|full]`; no separate full-screen NUI is included.

Every purchase is server-authoritative. The server resolves the network vehicle and player ped, verifies the player is the driver and near the selected station, bounds the requested liters and removes money through `fluxcore_core`.

Server export:

```js
const result = global.exports.fluxcore_fuel.PurchaseFuel(
  source,
  networkId,
  stationId,
  liters,
);
```

Configuration lives in `fluxcore_fuel/config/fuel.json`. Read [Fuel](fuel.md).

## `fluxcore_appearance`

Owns freemode model, components, props, head blend, face features, hair, eyes
and overlays. It includes a temporary live-preview editor that opens once for
new characters and through `/appearance` for existing characters.

Client exports:

* `GetAppearance()`
* `ApplyAppearance(appearance)`
* `SaveAppearance(appearance)`
* `ResetAppearance()`

The local `fluxcore_appearance:client:openRequested` event supplies current
data to replacement editors. Every save is normalized against server-side
ranges. See [Player Experience](player-experience.md).

## Domain resources

| Resource              | Responsibility                                                                   |
| --------------------- | -------------------------------------------------------------------------------- |
| `fluxcore_banking`    | stable account numbers, deposits, withdrawals, transfers and statements          |
| `fluxcore_businesses` | companies, roles, permissions, treasuries and audit                              |
| `fluxcore_services`   | on-duty rosters and secure personal and business invoices                        |
| `fluxcore_dispatch`   | emergency calls, priorities, units and closure                                   |
| `fluxcore_mdt`        | police people search, vehicle lookup, reports, warrants, BOLOs and dispatch feed |
| `fluxcore_properties` | ownership, keys, locks, storage and garage metadata; MLO-agnostic                |
| `fluxcore_world`      | server-validated shops, dealerships and persistent job doors                     |

Read [Banking](banking.md), [Businesses](businesses.md), [Services and Invoicing](services-and-invoicing.md), [Dispatch](dispatch.md), [MDT](mdt.md), [Properties](properties.md), and [World](world.md).

## `fluxcore_admin`

ACE-secured operations panel opened with `/vadmin`.

Capabilities:

* Online Fluxcore character list
* Go to and bring
* Freeze, heal and kick
* Set wallet balances
* Assign configured jobs
* Give configured items
* Inspect persistent audit records

Every action is reauthorized by the server. See [Security and ACE](security-and-ace.md).

## `fluxcore_phone`

Text-only communication with persistent numbers, contacts, offline messages, unread state and read receipts.

Open with `F1` or `/phone`.

Server exports:

```lua
local number = exports.fluxcore_phone:GetPhoneNumber(source)

local result = exports.fluxcore_phone:SendMessage(
    source,
    recipientNumber,
    'Your vehicle is ready.'
)
```

Phone contents are owner-only. Voice calls remain outside the current milestone.

## `fluxcore_example`

Contains temporary commands demonstrating the public API. Treat it as development material and review or remove it before production.
