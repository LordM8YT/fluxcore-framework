# Bridges and Compatibility

Fluxcore's native API remains the source of truth. Compatibility code lives in
separate resources so migrating an older script cannot freeze core design or a
frontend's visual design.

## Stable integration facade

`fluxcore_bridge` exposes `fluxcore.bridge.v1`. Its server exports cover the
first common integration surface:

* players: `GetPlayer`, `GetPlayers`
* money: `GetMoney`, `AddMoney`, `RemoveMoney`, `SetMoney`
* inventory: `GetInventory`, `HasItem`, `AddItem`, `RemoveItem`
* jobs: `GetJobs`, `AssignJob`, `SetActiveJob`, `SetDuty`
* discovery: `GetCapabilities`, `ListAdapters`

Mutations preserve the owning resource's normal `{ ok, data, error }` result
envelope. The bridge does not cache or own player data.

```lua
local capabilities = exports.fluxcore_bridge:GetCapabilities()
local player = exports.fluxcore_bridge:GetPlayer(source)
local result = exports.fluxcore_bridge:AddMoney(
    source,
    'cash',
    250,
    'delivery_payment',
    deliveryId
)
```

Optional domains report an error when their owning resource is stopped. Check
`GetCapabilities()` when an integration can operate without them.

## Adapter registry

An external adapter registers a name, version, exported dispatcher and exact
method allow-list. Registration is tied to the invoking resource and is removed
automatically when that resource stops.

```lua
exports.fluxcore_bridge:RegisterAdapter('my-system', {
    version = '1.0.0',
    exportName = 'FluxcoreAdapterCall',
    methods = { 'lookup-order' }
})
```

Adapters must register again when `fluxcore_bridge` restarts. The bundled
QBCore adapter demonstrates this lifecycle.

## Limited QBCore provider

`fluxcore_qb_bridge` declares `provide 'qb-core'`, which Cfx uses to satisfy a
`qb-core` dependency with a replacement resource. It currently supports only:

* `exports['qb-core']:GetCoreObject()`
* `GetPlayer`, `GetPlayerByCitizenId`, `GetPlayers`, `GetQBPlayers`
* player money methods
* `AddItem`, `RemoveItem`, `HasItem`
* `SetJob`, `SetJobDuty`

It is not a claim of complete QBCore compatibility. Client APIs, callbacks,
commands, gangs, shared item/job catalogs and arbitrary QBCore events remain
unsupported until they have explicit tests. Unsupported scripts should fail
visibly instead of silently corrupting state.

Enable it after its dependencies:

```cfg
ensure fluxcore_core
ensure fluxcore_jobs
ensure fluxcore_inventory
ensure fluxcore_bridge
ensure fluxcore_qb_bridge
```

Prefer native Fluxcore APIs for new resources. Use the provider to port one
resource at a time and document any missing surface before extending it.

## Qbox and ESX porting providers

`fluxcore_qbx_bridge` provides `qbx_core` while a Qbox resource is being
ported. Its supported server surface is limited to player lookup/listing,
money, active jobs, duty and the corresponding player functions. It does not
provide ox_lib, ox_inventory, callbacks, gangs or Qbox client modules.

`fluxcore_esx_bridge` provides `es_extended` and a bounded server-side
`getSharedObject()` containing player lookup, cash/bank, inventory and job
methods. It does not provide ESX imports, client state, callbacks, societies,
addon accounts, menus or framework lifecycle events.

All three migration providers are disabled by default. Enable only one for the
resource currently being assessed:

```cfg
# choose one
ensure fluxcore_qb_bridge
# ensure fluxcore_qbx_bridge
# ensure fluxcore_esx_bridge
```

The preferred finished structure belongs inside the external script:

```text
my_resource/
  bridge/
    fluxcore.lua
    qbcore.lua
    qbox.lua
    esx.lua
```

Once its native `fluxcore.lua` works, remove the framework provider from the
server. These providers are diagnostics and migration scaffolding, not a
permanent compatibility promise.

The ready-to-copy native implementation is documented in
[External Resource Kit](external-resource-kit.md). It implements the stable
`fluxcore.resource-bridge.v1` contract for resources that already separate
their framework code.

## Stability policy

The `fluxcore.bridge.v1` export names and result envelopes are stable. Additive
capabilities may be introduced in v1. Removing an export, changing argument
meaning or changing a success/failure shape requires v2 and a migration period.

UI contracts follow the same policy independently. Bridge changes do not
require HTML, CSS, icon or layout changes.
