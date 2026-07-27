# fluxcore_interact

`fluxcore_interact` is the shared, dependency-free interaction and basic UI
layer for Fluxcore. It provides:

- sphere zones with proximity prompts;
- raycast interactions for entities, models, players, vehicles, and objects;
- context menus and confirmation menus;
- text input dialogs;
- notifications;
- cancellable progress actions; and
- exports that keep gameplay code separate from the replaceable NUI.

The bundled NUI is intentionally basic. UI contributors may replace files
under `web/` as long as the documented message and callback contract remains
compatible.

## Player controls

Hold `Left Alt` to enable the target eye. Aim the eye at a registered entity,
model, player, or zone; the eye highlights and shows every available option.
Left-click once to activate the cursor, then click the option you want. Up to
four options are visible at once; use the mouse wheel when five or more options
are available. `Escape` releases the cursor without selecting anything.

The controls are configurable through `config/interact.json`. Resources that
register interactions should register again when `fluxcore_interact` starts,
because restarting the shared target clears its in-memory registrations.

## Start order

Start the resource immediately after `fluxcore_core`, before resources that
register interactions:

```cfg
ensure fluxcore_core
ensure fluxcore_interact
```

## Register a zone

Registrations return the supplied ID. IDs must be unique and should be
namespaced to the owning resource.

```lua
exports.fluxcore_interact:RegisterZone({
    id = 'my_resource:front_desk',
    coords = vector3(441.2, -981.9, 30.7),
    radius = 1.5,
    distance = 2.0,
    marker = true,
    options = {
        {
            id = 'open',
            label = 'Open front desk',
            event = 'my_resource:client:openDesk',
            type = 'client'
        }
    }
})
```

Remove any registration with:

```lua
exports.fluxcore_interact:RemoveInteraction('my_resource:front_desk')
```

Registrations created by a resource are automatically removed when that
resource stops.

## Entity interactions

```lua
exports.fluxcore_interact:AddGlobalVehicle({
    id = 'my_resource:vehicle_actions',
    distance = 2.5,
    options = {
        {
            id = 'inspect',
            label = 'Inspect vehicle',
            onSelect = function(context)
                print(('Selected vehicle %s'):format(context.entity))
            end
        }
    }
})

exports.fluxcore_interact:AddModel({
    id = 'my_resource:atm',
    models = { `prop_atm_01`, `prop_atm_02` },
    options = {
        {
            id = 'bank',
            label = 'Use ATM',
            event = 'my_banking:client:open',
            type = 'client'
        }
    }
})

exports.fluxcore_interact:AddEntity({
    id = 'my_resource:specific_vehicle',
    entities = { vehicle },
    options = { ... }
})
```

Available global exports are `AddGlobalPlayer`, `AddGlobalVehicle`,
`AddGlobalPed`, and `AddGlobalObject`.

Options accept `label`, `icon`, `distance`, `type`, `event`, `args`,
`onSelect`, and `canInteract`. `type` may be `client`, `server`, or `command`.
Function fields stay client-side and are not sent to NUI.

`canInteract(entity, distance, coords)` is presentation filtering only. A
server event must independently verify character ownership, permissions,
distance, inventory, money, and all other trusted state.

## UI exports

```lua
exports.fluxcore_interact:Notify({
    title = 'Garage',
    description = 'Vehicle stored',
    type = 'success',
    duration = 4000
})

local accepted = exports.fluxcore_interact:Progress({
    label = 'Repairing vehicle',
    duration = 5000,
    canCancel = true,
    disable = {
        move = true,
        combat = true,
        vehicle = true
    }
})

local selected = exports.fluxcore_interact:OpenMenu({
    title = 'Vehicle actions',
    options = {
        { id = 'lock', label = 'Lock vehicle' },
        { id = 'keys', label = 'Share keys', description = 'Give temporary access' }
    }
})

local value = exports.fluxcore_interact:InputDialog({
    title = 'Invoice',
    label = 'Amount',
    placeholder = '1000',
    required = true,
    maxLength = 10
})
```

`Progress` returns `true` when completed and `false` when cancelled.
`OpenMenu` returns the selected option table or `nil`. `InputDialog` returns
the submitted string or `nil`.

Only one focus-taking menu or dialog and one progress action may be active at a
time.

## Stable UI contract

The client sends NUI messages with these actions:

- `interaction:show` `{ options[] }`
- `interaction:hide`
- `target:focus` `{ active }`
- `menu:open` `{ title, description, options[] }`
- `menu:close`
- `dialog:open` `{ title, description, label, placeholder, value, required, maxLength }`
- `dialog:close`
- `notification:show` `{ id, title, description, type, duration }`
- `progress:open` `{ label, duration, canCancel }`
- `progress:close`

NUI calls these callbacks:

- `selectTarget` `{ id }`
- `releaseTargetFocus`
- `selectMenu` `{ id }`
- `closeMenu`
- `submitDialog` `{ value }`
- `closeDialog`
- `cancelProgress`

New optional fields may be added in future minor versions. Existing fields and
callback names remain stable throughout UI contract v1.
