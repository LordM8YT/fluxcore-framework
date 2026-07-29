# Player Experience

The replacement chat supports local speech, `/me`, `/do`, server-resolved
`/try`, global `/ooc`, 3-meter `/whisper`, 40-meter `/shout`, and `/e` emotes.
Nearby `/me`, `/do`, and `/try` actions also appear briefly above the relevant
streamed player ped.
Type `/` to filter available commands and press Tab to complete the first
suggestion. Arrow Up/Down recalls recent commands and messages.
Press `X` (rebindable in FiveM key mappings) or use `/e cancel` to stop an
emote. Active emotes are also cleared on death or when entering a vehicle.

TAB opens the temporary inventory. Water restores thirst, sandwiches restore
hunger, and bandages restore health after the server validates and consumes
the item.
Number keys 1-5 use the matching inventory slots. A pistol must exist in the
inventory before pistol ammunition can be consumed and loaded.

While driving a Fluxcore vehicle, press `G` to start or stop the engine. The
mapping is rebindable and the server verifies both the driver seat and vehicle
key before replicating the engine state.
Press `B` to fasten the seatbelt. While fastened, normal vehicle-exit controls
are blocked and the HUD shows `BELT ON`; leaving the vehicle or dying clears it.

Use `/hud` to hide or show the complete Fluxcore HUD and RP minimap for the
current session. Vanilla HUD suppression remains active either way.

Fluxcore includes temporary, replaceable interfaces for the first connection,
character flow, inventory and in-game HUD. They are intentionally lightweight
so a custom frontend can replace them without changing domain logic.

## Roleplay chat

`fluxcore_chat` replaces the stock FiveM chat and opens on the configurable
`T` key mapping. It remains compatible with `chat:addMessage`, so existing
Fluxcore resources render feedback in the replacement UI. Text without a slash
is local speech. `/me` and `/do` are proximity-based, while `/ooc` is global.
Use `/e sit` (or another listed emote) and `/e cancel` for basic animations.
All other slash input is passed to FiveM's registered command system, including
framework commands such as `/911`, `/inventory`, `/jobs` and `/garage`.

## Connection and loading

`fluxcore_loading` replaces the default FiveM loading screen with the
Fluxcord-branded screen. It reads Cfx's real `loadProgress` event, displays a
percentage and rotates roleplay tips.

Start it before the framework:

```cfg
setr sv_showBusySpinnerOnLoadingScreen false

ensure fluxcore_loading
ensure fluxcore_core
```

The resource uses manual shutdown. `fluxcore_core` closes it during the spawn
transition so the loading screen yields directly to character selection.

## Character selection

`fluxcore_identity` opens before the player enters the world. The local player
ped is moved into an isolated preview studio and shown with a scripted camera,
so the previous map position is never exposed behind the menu.

The menu supports:

* character slots, creation and deletion;
* live local character preview;
* last-position and configured spawn choices; and
* fade-controlled transitions into gameplay.

## Character appearance

`fluxcore_appearance` owns the persistent freemode appearance and includes a
basic live-preview editor. A fresh character opens the editor once after the
first spawn. Existing characters can open it with:

```text
/appearance
```

The temporary editor supports model, heritage and skin blends, hair, hair
colour, eyes, beard and basic clothing. Saving is validated by the server and
stored in `data/appearance.sqlite`. Escape or **Cancel** restores the
appearance from before the editor opened.

The editor is a replaceable NUI. Integrations may continue to use
`fluxcore_appearance:client:openRequested` and the existing appearance exports.

## Inventory controls

`TAB` opens and closes `fluxcore_inventory`. The binding uses FiveM key
mappings and can be changed in the player's key-binding settings.

Fluxcore disables GTA control `37`, so TAB cannot open the vanilla weapon
wheel. RP weapon use should be implemented through server-authoritative
inventory items and usable-item handlers.

## HUD and minimap

`fluxcore_status` renders the Fluxcord HUD with player needs and a compact
vehicle panel. By default:

* the vanilla GTA HUD, ammunition display and weapon wheel are hidden;
* the vanilla vehicle radio and its selection controls are disabled;
* an optional microphone indicator turns green while Enhanced voice transmits;
* the minimap appears only while inside a vehicle;
* the minimap's built-in health and armour bars are removed;
* health, armour, hunger, thirst, native sprint stamina and stress use compact
  status indicators; and
* vehicle speed, gear, fuel, engine condition and plate are displayed.

The behavior is configured in `fluxcore_status/config/status.json`:

```json
{
  "disableVanillaHud": true,
  "disableVanillaPolice": true,
  "disableVanillaRadio": true,
  "minimapVehicleOnly": true
}
```

## RP police behavior

With `disableVanillaPolice` enabled, GTA wanted levels, ambient police
dispatch and random police creation are disabled. Police response must instead
come from Fluxcore jobs and `fluxcore_dispatch`, where real roleplay players
receive and handle calls.

Stopping `fluxcore_status` restores the vanilla HUD, radar, radio controls and police settings
to avoid leaking modified native state into other resources.

{% hint style="warning" %}
FiveM Enhanced behavior must be verified in the running client. Static and
unit tests cannot prove CEF layering, minimap Scaleform composition or dispatch
behavior.
{% endhint %}
