# fluxcore_status

`fluxcore_status` owns persistent character needs and supplies a complete,
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
local status = exports.fluxcore_status:GetStatus(source)

local result = exports.fluxcore_status:RemoveStatus(source, 'hunger', 10)
local result = exports.fluxcore_status:AddStatus(source, 'stress', 5)
local result = exports.fluxcore_status:SetStatus(source, 'thirst', 100)
local result = exports.fluxcore_status:ResetStatus(source)
```

Mutation exports return the standard `{ ok, data, error }` envelope. Only
server resources can mutate needs.

## Client exports and events

```lua
local needs = exports.fluxcore_status:GetStatus()
local hud = exports.fluxcore_status:GetHudData()

AddEventHandler('fluxcore_status:client:hudUpdated', function(snapshot)
    -- snapshot follows Fluxcore.hud.bootstrap.v1, or is nil after logout
end)
```

The frontend contract and mock data are documented in
[the Fluxcore UI Contracts Wiki page](https://github.com/LordM8YT/Fluxcore-framework/wiki/UI-Contracts).
