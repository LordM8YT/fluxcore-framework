# Character Creation

Use `/logout` to save the active character and return to character selection.
`/characters` opens the selector whenever no character is active.

Fluxcore provides a temporary, database-backed character creator through
`fluxcore_identity`. It is intentionally simple so the final custom interface
can replace the visual layer without changing the character lifecycle.

## Player flow

Before a character is selected, the player is moved into an isolated preview
scene. The normal world, HUD and radar remain hidden while the character menu
owns input focus and displays the mouse cursor.

A player can:

* view the characters owned by their account;
* create a character in an available slot;
* preview and select a character;
* delete an owned character after exact confirmation; and
* log out to return to character selection.

Character creation collects the first name, last name, date of birth and
gender. The server normalizes and validates all submitted values before writing
them to SQLite.

## Appearance

New characters continue into the temporary `fluxcore_appearance` editor. It
uses a bounded freemode model and component configuration with live preview,
save and reset support. Saved appearance is associated with the character ID
and restored when that character spawns.

## Persistence and deletion

The core database owns the account, character slots, character identity,
position, metadata and wallets. Character deletion emits the
`Fluxcore:server:characterDeleted` lifecycle event so dependent resources can
remove character-owned data such as:

* appearance;
* inventory;
* status needs;
* banking;
* jobs;
* vehicles;
* phone data; and
* business or property relationships.

Consumers that store character-owned data must handle this event.

## Resources

Start the relevant resources in this order:

```cfg
ensure fluxcore_loading
ensure fluxcore_core
ensure fluxcore_appearance
ensure fluxcore_identity
```

The complete server order in [Configuration](configuration.md) includes the
other framework dependencies between these entries.

## Testing

Test the complete flow in the Enhanced client:

1. Join with an account that has an empty character slot.
2. Confirm the world and radar are hidden in character selection.
3. Confirm the cursor is visible and every field accepts input.
4. Create a character and save an appearance.
5. Reconnect and confirm identity, position and appearance persist.
6. Delete the character using exact confirmation.
7. Confirm the slot becomes available and dependent character data is removed.

See [Player Experience](player-experience.md) for the surrounding loading,
spawn, HUD, chat and inventory behavior.
