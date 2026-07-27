# State Bags and Events

State Bags replicate small public facts. Events signal lifecycle transitions or deliver owner-only snapshots. Persistent mutation still goes through the owning server resource.

## Core player State Bags

| Key                    | Type          | Owner           | Meaning                            |
| ---------------------- | ------------- | --------------- | ---------------------------------- |
| `fluxcore:loaded`      | boolean       | `fluxcore_core` | an active character is selected    |
| `fluxcore:characterId` | string or nil | `fluxcore_core` | public stable character identifier |
| `fluxcore:job`         | object or nil | `fluxcore_core` | public active-job snapshot         |

Core clears the keys on logout.

## Observe without polling

```lua
local function isLocalPlayerBag(bagName)
    local serverId = bagName:match('^player:(%d+)$')
    return serverId ~= nil
        and tonumber(serverId) == GetPlayerServerId(PlayerId())
end

AddStateBagChangeHandler('fluxcore:job', nil, function(
    bagName,
    key,
    value,
    reserved,
    replicated
)
    if not isLocalPlayerBag(bagName) then
        return
    end

    local job = value
    print(job and job.name or 'unemployed')
end)
```

The handler runs only when the key changes. It has no idle resmon cost.

Read the current value once in case a resource starts after replication:

```lua
local currentJob = LocalPlayer.state['fluxcore:job']
```

## Create a resource-owned key

Namespace the key:

```lua
local key = 'my_resource:status'
Player(source).state:set(key, 'active', true)
```

The last argument controls replication. Use `true` only when other clients or resources genuinely need the value.

Ownership rules:

* one resource owns each key
* consumers treat values as read-only
* the owner validates every value server-side
* character-scoped values are cleared on logout
* large or private tables do not belong in public State Bags
* nested table mutations require setting the complete value again

## State Bags are not persistence

Writing a bag does not update SQLite. Never set `fluxcore:job` directly to change a player's job. Use the owning export, which persists and then republishes the safe snapshot.

## Events versus State Bags

{% columns %}
{% column %}
### Use a State Bag when

* the fact has a current value
* late consumers must read it
* nearby resources may observe it
* the value is safe to replicate
{% endcolumn %}

{% column %}
### Use an event when

* the action is a one-time transition
* the payload is owner-only
* a server resource is notifying trusted local consumers
* the value should not remain discoverable
{% endcolumn %}
{% endcolumns %}

### Use an export when

* a trusted resource needs an immediate read
* a trusted resource requests a server-authoritative mutation
* the caller needs a result envelope

## Client lifecycle

```lua
RegisterNetEvent('fluxcore:client:playerLoaded', function(player)
    -- Initialize owner-only client state.
end)

RegisterNetEvent('fluxcore:client:playerUpdated', function(player)
    -- Replace the cached owner snapshot.
end)

RegisterNetEvent('fluxcore:client:playerLoggedOut', function()
    -- Clear owner-only caches and close UI.
end)
```

## Server lifecycle

```lua
AddEventHandler('fluxcore:server:playerLoaded', function(source, player)
    Player(source).state:set('my_resource:status', 'ready', true)
end)

AddEventHandler('fluxcore:server:playerLoggedOut', function(source)
    Player(source).state:set('my_resource:status', nil, true)
end)
```

{% hint style="warning" %}
These are local server events. Do not register a public network handler for a server-only lifecycle event.
{% endhint %}

## Privacy

Do not replicate:

* cash or bank balances
* birth dates or nationality
* private metadata
* inventory contents
* phone contacts or messages
* admin audit details
* access tokens or identifiers

Send private snapshots only to their owning client.
