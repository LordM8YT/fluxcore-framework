# Interactions and Shared UI

`fluxcore_interact` is the shared interaction and basic UI layer for Fluxcore. It keeps gameplay code independent from the replaceable NUI and has no external runtime dependency.

### Player controls

Hold `Left Alt` and aim at a registered target. Left-click once to activate the cursor, then click an option. Up to four options are visible at once; five or more scroll vertically with the mouse wheel. `Escape` releases the cursor. `E` is not used, and the gameplay camera is locked while the cursor is active.

`fluxcore_interact` does not use a database. Registrations live in client memory, so consumer resources must register again after `fluxcore_interact` restarts.

### Start order

Start it immediately after `fluxcore_core` and before resources that register interactions:

```cfg
ensure fluxcore_core
ensure fluxcore_interact
ensure fluxcore_status
```

The standard txAdmin recipe already uses this order.

### Features

* sphere zones with proximity prompts and optional markers
* raycast interactions for models, specific entities, players, peds, vehicles, and objects
* mouse-selectable target options with vertical scrolling
* context menus and text input dialogs
* localized notifications
* cancellable progress actions with movement, combat, and vehicle controls
* automatic cleanup when the resource that registered an interaction stops

The bundled HTML, CSS, and JavaScript are intentionally basic. Frontend contributors may replace the files under `web/` without changing gameplay code as long as UI contract v1 remains compatible.

### Register a zone

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

IDs must be unique and should include the owning resource name. Remove a registration with:

```lua
exports.fluxcore_interact:RemoveInteraction('my_resource:front_desk')
```

### Entity interactions

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
```

Available registration exports are `RegisterZone`, `AddModel`, `AddEntity`, `AddGlobalPlayer`, `AddGlobalPed`, `AddGlobalVehicle`, and `AddGlobalObject`.

Options accept `label`, `icon`, `description`, `distance`, `type`, `event`, `args`, `onSelect`, and `canInteract`. `type` may be `client`, `server`, or `command`. The selection context contains `interactionId`, `optionId`, `entity`, `networkId`, `distance`, `coords`, and `args`.

### Shared UI exports

`Notify`, `Progress`, `OpenMenu`, and `InputDialog` provide the bundled basic UI. Run `/interactdemo` on a development server to preview the menu, dialog, notification, and progress UI.

### Security boundary

`canInteract` and every other client-side condition are presentation filtering only. Server events must independently verify character ownership, permissions, distance, inventory, money, and all other trusted state. Never grant an item, move money, or mutate persistent state only because an interaction was visible.

### UI contract v1

Target-specific NUI actions are `target:active`, `target:focus`, `interaction:show` with `options[]`, and `interaction:hide`. Target NUI callbacks are `selectTarget` with an `id` and `releaseTargetFocus`.

The generic shared UI also uses `config`, `menu:open`, `menu:close`, `dialog:open`, `dialog:close`, `notification:show`, `progress:open`, and `progress:close`. Its callbacks are `selectMenu`, `closeMenu`, `submitDialog`, `closeDialog`, and `cancelProgress`.

The complete mock payload is stored at `contracts/ui/v1/interact.bootstrap.json`. New optional fields may be added in minor releases, while existing v1 fields and callback names remain stable.
