# nord_status

`nord_status` owns persistent character needs and supplies a complete,
UI-independent HUD snapshot. It does not ship a visual HUD.

## Ownership

- Hunger, thirst, and stress are stored in `data/status.sqlite`.
- Health, armor, stamina, and vehicle telemetry are observed from local game
  natives and are not trusted as server data.
- Status values are private owner data and are not replicated through public
  state bags.
- The server applies configured decay once per tick and clamps every mutation.

## Server exports

```lua
local status = exports.nord_status:GetStatus(source)

local result = exports.nord_status:RemoveStatus(source, 'hunger', 10)
local result = exports.nord_status:AddStatus(source, 'stress', 5)
local result = exports.nord_status:SetStatus(source, 'thirst', 100)
local result = exports.nord_status:ResetStatus(source)
```

Mutation exports return the standard `{ ok, data, error }` envelope. Only
server resources can mutate needs.

## Client exports and events

```lua
local needs = exports.nord_status:GetStatus()
local hud = exports.nord_status:GetHudData()

AddEventHandler('nord_status:client:hudUpdated', function(snapshot)
    -- snapshot follows Nord.hud.bootstrap.v1, or is nil after logout
end)
```

The frontend contract and mock data are documented in
[the Nord UI Contracts Wiki page](https://github.com/LordM8YT/Nord-framework/wiki/UI-Contracts).
