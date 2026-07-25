# nord_appearance

Persistent freemode character appearance for Nord Framework. The resource is
deliberately independent from an editor UI, so a designer can replace the
frontend without changing character storage or spawn behavior.

## Stored data

- Allowed ped model.
- Components and props.
- Head blend, face features, hair and eye colors.
- Head overlays and overlay colors.

All client saves are normalized against strict server-side ranges. The default
model follows the character gender from `nord_core`, and appearance is
reapplied after every `playerSpawned` event.

## Integration

The local `nord_appearance:client:openRequested` event receives the current
appearance when `/appearance` is used. An editor can submit its result with:

```lua
exports.nord_appearance:SaveAppearance(appearance)
```

Client exports:

- `GetAppearance()`
- `ApplyAppearance(appearance)`
- `SaveAppearance(appearance)`
- `ResetAppearance()`

Trusted server resources can use `GetAppearance`, `SaveAppearance`, and
`ResetAppearance`. Server mutations return `{ ok, data, error }`.

`/resetappearance` restores the gender-based default without deleting the
character.
