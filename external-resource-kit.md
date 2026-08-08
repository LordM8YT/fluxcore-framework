# External Resource Kit

Fluxcore Resource Bridge Contract v1 lets a multi-framework resource add native
Fluxcore support without rewriting gameplay code or pretending Fluxcore is
QBCore, Qbox or ESX.

## Install the adapter

Point the installer at an external resource's existing `framework` or `bridge`
directory:

```bash
npm run create:bridge -- C:/server/resources/my_resource/framework
```

This creates only:

```text
framework/
  fluxcore/
    client.lua
    server.lua
```

It refuses to overwrite an existing `fluxcore` directory. Add the files to the
external resource's manifest and declare:

```lua
dependency 'fluxcore_bridge'
```

Select the adapter in the external resource:

```lua
Config.Framework = 'Fluxcore'
```

Existing automatic detection can use `Bridge.IsAvailable()`. It returns true
only while `fluxcore_bridge` is started, just like a Qbox or QBCore availability
check based on resource state.

## Stable Bridge API

The contract is machine-readable at `contracts/resource-bridge/v1.json`.
Additive methods may be introduced in v1. Existing methods cannot be removed or
change meaning without a new major contract.

Common server methods:

```lua
Bridge.GetPlayer(source)
Bridge.GetIdentifier(source)
Bridge.GetJob(source)
Bridge.GetMoney(source, 'cash')
Bridge.AddMoney(source, 'bank', 500, 'sale', saleId)
Bridge.HasItem(source, 'receipt', 1)
Bridge.SetJob(source, 'cardealer', 1)
Bridge.Notify(source, 'Vehicle purchased', 'success')
Bridge.RegisterOwnedVehicle(source, vehicleData)
Bridge.GiveVehicleKey(source, targetSource, vehicleId)
Bridge.CreditBusiness(businessId, 500, 'vehicle_sale', saleId)
```

Common client methods:

```lua
Bridge.GetPlayerData()
Bridge.GetIdentifier()
Bridge.GetJob()
Bridge.IsLoggedIn()
Bridge.HasItem('phone', 1)
Bridge.Notify('Showroom opened', 'info')
```

## Framework mapping

| Portable operation | QBCore/Qbox pattern | ESX pattern | Fluxcore adapter |
| --- | --- | --- | --- |
| Player | `GetPlayer(source)` | `GetPlayerFromId(source)` | `Bridge.GetPlayer(source)` |
| Identifier | `citizenid` | `identifier` | `Bridge.GetIdentifier(source)` |
| Cash/bank | player money functions | account functions | `Bridge.*Money(...)` |
| Items | player/ox inventory functions | xPlayer inventory functions | `Bridge.*Item(...)` |
| Job | `SetJob`, duty | `setJob` | `Bridge.SetJob`, `SetDuty` |
| Owned vehicle | framework vehicle table | `owned_vehicles` | `Bridge.RegisterOwnedVehicle` |
| Vehicle keys | key-resource event/export | key-resource event/export | `Bridge.GiveVehicleKey` |
| Society funds | banking/management integration | addon account | `Bridge.CreditBusiness`, `DebitBusiness` |
| Notification | framework notify | ESX notify | `Bridge.Notify` |

## Dealership-style resources

A dealership resource should keep vehicle purchase, showroom, finance and UI
logic framework-neutral. Its Fluxcore adapter should:

1. validate and charge through Bridge money methods;
2. create ownership through `RegisterOwnedVehicle`;
3. grant keys through `GiveVehicleKey`;
4. credit an owned dealership through `CreditBusiness`; and
5. use a script-owned database only for its own stock and finance records.

Do not write Fluxcore's vehicle, wallet or business databases directly.

## Boundaries

The kit does not provide callbacks, menus, target libraries, ox_lib, gangs or a
legacy framework global. External resources may keep their existing utility
library while routing persistent gameplay state through the Bridge contract.

The generic lifecycle events in the template must be renamed to the external
resource's namespace before publishing.
