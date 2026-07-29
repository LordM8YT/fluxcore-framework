# Chat and Player Controls

Fluxcore replaces the GTA chat, weapon wheel, vehicle radio and most vanilla
HUD elements with framework-owned controls. Every default key mapping can be
changed in FiveM settings.

## Chat and roleplay

Press `T` to open chat. Type `/` to filter suggestions, Tab to complete the
first result, and Arrow Up/Down to browse command history.

| Command | Behavior |
| --- | --- |
| `/me <text>` | Local character action with a temporary 3D bubble |
| `/do <text>` | Local scene description with a temporary 3D bubble |
| `/try <text>` | Local action with a server-generated success/fail result |
| `/whisper <text>` | Speech within 3 meters |
| `/shout <text>` | Speech within 40 meters |
| `/ooc <text>` | Global out-of-character message |
| `/e <name>` | Play a configured emote |
| `/e cancel` | Stop the current emote |
| `/clear` | Clear local chat history |
| `/controls` | Show the most important key mappings in chat |

The server resolves character names, recipients, distance and `/try` results.
Messages sent before selecting a character are rejected. Input is stripped of
control characters, rate-limited and truncated safely to 280 Unicode
characters.

Press `X` to cancel an active emote. Entering a vehicle or dying also clears
it.

## Inventory and weapons

| Control | Behavior |
| --- | --- |
| `LEFT ALT` | Hold to target nearby interactions |
| `TAB` | Open or close inventory |
| `1`-`5` | Use the matching hotbar slot |

The GTA weapon wheel remains blocked. A `weapon_pistol` item must be used to
equip the test pistol; `pistol_ammo` consumes up to 12 inventory rounds before
adding ammunition. Dropping the weapon item removes the equipped weapon.

## Vehicles

| Control | Behavior |
| --- | --- |
| `L` | Lock or unlock an accessible Fluxcore vehicle |
| `G` or `/engine` | Start or stop the engine as its authorized driver |
| `B` | Fasten or unfasten the seatbelt |

The server validates engine control against the driver seat and vehicle keys.
The seatbelt blocks normal exit controls and resets after leaving the vehicle,
death, logout or resource restart.

## HUD, characters and voice

| Command | Behavior |
| --- | --- |
| `/hud` | Hide or show the Fluxcore HUD and RP minimap |
| `/voice` | Show proximity voice status |
| `/logout` | Save and return to character selection |
| `/characters` | Open character selection while logged out |
| `/paycheck` | Show current grade pay and time to payday |

Proximity voice activates only after character selection and leaves the
channel on logout. The HUD microphone turns green while the local player is
talking.

Press `GRAVE` (backtick) to cycle voice range between 3, 8 and 15 meters.
Seatbelt remains mapped to `B`.
