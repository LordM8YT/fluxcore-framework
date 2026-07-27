# Resource Template

The repository contains a copyable starter at:

```
templates/fluxcore_resource
```

[Browse the template on GitHub](templates/fluxcore_resource).

It demonstrates modern Fluxcore patterns without Qbox, QBCore or ESX imports.

## Copy and rename

{% stepper %}
{% step %}
### Copy `templates/fluxcore_resource` into the server's resources directory.
{% endstep %}

{% step %}
### Rename the folder and manifest `name`.
{% endstep %}

{% step %}
### Replace the `fluxcore_starter:*` event and State Bag prefixes.
{% endstep %}

{% step %}
### Replace the example command and config values.
{% endstep %}

{% step %}
### Keep the `fluxcore_core` dependency if the resource consumes core exports.
{% endstep %}

{% step %}
### Add `ensure your_resource` after its dependencies.
{% endstep %}
{% endstepper %}

## Manifest

```lua
fx_version 'cerulean'
game 'gta5'

name 'my_resource'
author 'Your name'
version '1.0.0'
license 'MIT'

dependency 'fluxcore_core'

shared_script 'shared/config.lua'
client_script 'client/main.lua'
server_script 'server/main.lua'
```

{% hint style="info" %}
Lua 5.4 is the current FiveM runtime. Do not add old framework include files.
{% endhint %}

## Observe a State Bag

The client template registers key-specific handlers and filters the local player bag:

```lua
local function isLocalPlayerBag(bagName)
    local serverId = bagName:match('^player:(%d+)$')
    return serverId ~= nil
        and tonumber(serverId) == GetPlayerServerId(PlayerId())
end

AddStateBagChangeHandler('fluxcore:job', nil, function(bagName, _, job)
    if not isLocalPlayerBag(bagName) then
        return
    end

    TriggerEvent('my_resource:client:jobChanged', job)
end)
```

There is no continuous `Wait()` loop and therefore no idle polling cost.

## Read player data

{% tabs %}
{% tab title="Client" %}
```lua
local player = exports['fluxcore_core']:GetPlayerData()
```
{% endtab %}

{% tab title="Server" %}
```lua
local player = exports['fluxcore_core']:GetPlayer(source)
```

The server result is a detached snapshot. Use mutation exports for changes.
{% endtab %}
{% endtabs %}

## Own a replicated state key

Namespace every custom key with the resource name:

```lua
Player(source).state:set('my_resource:status', 'active', true)
```

The final `true` replicates the value. Only the resource that owns the key should write it. Clear resource-owned character state on logout:

```lua
AddEventHandler('fluxcore:server:playerLoggedOut', function(source)
    Player(source).state:set('my_resource:status', nil, true)
end)
```

## Native ACE command

```lua
RegisterCommand('mystatus', function(source, args)
local player = exports['fluxcore_core']:GetPlayer(source)
    if not player then
        return
    end

    Player(source).state:set('my_resource:status', args[1], true)
end, true)
```

```cfg
add_ace group.admin command.mystatus allow
```

The native restricted flag is simpler and safer than a custom command wrapper.

## Optional NUI

{% hint style="info" %}
Do not ship an empty NUI. Add one only when needed:
{% endhint %}

```lua
ui_page 'web/index.html'

files {
    'web/index.html',
    'web/assets/**/*'
}
```

Define a versioned UI contract before connecting mutations. See [UI Contracts](ui-contracts.md).
