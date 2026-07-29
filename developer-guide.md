# Developer Guide

This guide is for developers building native Fluxcore resources. Following these rules keeps resources secure, updateable and compatible with future core versions.

## Do not access another resource's database

Database schemas are private implementation details. Direct SQL creates hidden coupling and will break when the owner migrates its schema.

Use the owning resource's exports. If an operation is missing, open an issue so the public API can be extended safely.

## Do not modify Fluxcore Core

Do not patch core files to support one resource. That makes updates and support unpredictable. Prefer:

* a documented export
* a local server event
* an owned State Bag key
* a versioned UI contract
* a separate integration resource

If the required extension point does not exist, propose it through an issue or pull request.

## Do not import legacy framework objects

Native Fluxcore resources must not use:

* `GetCoreObject`
* QBCore/Qbox global player objects
* ESX shared objects
* framework-owned global tables
* compatibility event names inside the core

Future bridges belong in separate adapter resources. Native code uses Fluxcore exports directly.

## Respect ownership

Only the owner mutates a domain:

| Data                                             | Owner                 | Mutation path                    |
| ------------------------------------------------ | --------------------- | -------------------------------- |
| character, wallet, metadata, active job snapshot | `fluxcore_core`       | core server exports              |
| assignments, grades and duty                     | `fluxcore_jobs`       | jobs server exports              |
| items and containers                             | `fluxcore_inventory`  | inventory server exports         |
| hunger, thirst and stress                        | `fluxcore_status`     | status server exports            |
| vehicles and keys                                | `fluxcore_vehicles`   | vehicle server exports           |
| fuel purchases                                   | `fluxcore_fuel`       | fuel server export               |
| appearance                                       | `fluxcore_appearance` | appearance exports               |
| contacts and texts                               | `fluxcore_phone`      | phone request API/server exports |

Never set a core-owned State Bag to simulate a persistent change. For example, use `fluxcore_core:SetJob()` or `fluxcore_jobs:SetActiveJob()` instead of writing `fluxcore:job` yourself.

## Prefer State Bag handlers over polling

Observe replicated public state with `AddStateBagChangeHandler`. Do not run a per-frame or periodic loop just to detect a job or status change.

```lua
AddStateBagChangeHandler('fluxcore:job', nil, function(bagName, _, job)
    local serverId = bagName:match('^player:(%d+)$')
    if tonumber(serverId) ~= GetPlayerServerId(PlayerId()) then
        return
    end

    print(('Active job: %s'):format(job and job.name or 'none'))
end)
```

Read [State Bags and Events](state-bags-and-events.md) before adding a replicated key.

## Use direct exports for trusted server operations

```lua
local player = exports['fluxcore_core']:GetPlayer(source)
if not player then
    return
end

local result = exports['fluxcore_inventory']:AddItem(
    source,
    'water',
    1,
    { quality = 100 }
)

if not result.ok then
    print(('[my_resource] %s: %s'):format(
        result.error.code,
        result.error.message
    ))
end
```

`GetPlayer()` returns a detached snapshot. Changing the table does not change core state.

### Usable inventory items

Usable inventory handlers may return `{ consume, afterUse }`. Fluxcore commits
the inventory consumption first and then calls the synchronous `afterUse`
callback, which is the correct place to grant an external effect such as
health, status, ammo, or an equipped prop.

The inventory tracks the resource that calls `RegisterUsableItem` and removes
its handlers when that resource stops. A provider must register them again
after `fluxcore_inventory` starts; the bundled status and fuel resources
demonstrate this restart-safe lifecycle.

## Handle result envelopes

Mutations return one of:

```lua
{ ok = true, data = ... }
```

```lua
{
    ok = false,
    error = {
        code = 'ERROR_CODE',
        message = 'Safe human-readable message'
    }
}
```

Branch on `ok` and stable error codes. Do not parse human-readable messages.

## Treat every client request as hostile

A client may request an action, but the server must derive and verify:

* authenticated source
* active character
* ownership
* ACE or job permission
* position and distance
* amount, slot, weight and metadata bounds
* current server-owned state
* rate limit and idempotency key

Never accept a client-submitted character ID, container ID, owner ID or money balance when the server can derive it.

## Use native ACE commands

For a restricted command:

```lua
RegisterCommand('myadmincommand', function(source, args)
    -- The handler runs only after command.myadmincommand is allowed.
end, true)
```

Grant it in `server.cfg`:

```cfg
add_ace group.admin command.myadmincommand allow
```

Avoid custom command permission wrappers when native ACE is sufficient.

## Keep UI behind the owning resource

NUI does not call core exports or databases. The client resource:

{% stepper %}
{% step %}
## Receive an owner-only server snapshot
{% endstep %}

{% step %}
## Create a versioned bootstrap payload
{% endstep %}

{% step %}
## Send it with `SendNUIMessage`
{% endstep %}

{% step %}
## Validate callback shape
{% endstep %}

{% step %}
## Ask its server resource to perform the mutation
{% endstep %}
{% endstepper %}

See [UI Contracts](ui-contracts.md).

## Resource structure

Start from [Resource Template](resource-template.md):

```
my_resource/
  fxmanifest.lua
  shared/
    config.lua
  client/
    main.lua
  server/
    main.lua
```

Add `web/` only when the resource actually needs NUI.

## Performance rules

* no idle `Wait(0)` loop unless a native truly requires per-frame work
* use events, exports and State Bag handlers for state changes
* dynamically increase sleep for unavoidable proximity loops
* keep replicated data small
* avoid serializing complete player objects every frame
* let the server own timers for persistent simulation

## Before publishing a resource

* run `npm test` in the Fluxcore repository
* test connect, logout, reconnect and resource restart
* test unauthorized and malformed requests
* document every export, event, State Bag and ACE permission
* never include keys, tokens, identifiers or production data
* declare `dependency 'fluxcore_core'` when required
