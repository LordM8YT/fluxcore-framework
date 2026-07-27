# Troubleshooting

Start with the first error in the server or F8 console. Dependency failures after it are often consequences rather than separate bugs.

## `server.cfg` does not exist or is unreadable

In txAdmin open **Settings → FXServer** and verify:

* Server Data Folder points to the deployed server-data directory
* CFG File Path points to the generated `server.cfg`

Do not point either setting at the Cfx binary folder or `txData`.

## A Fluxcore export does not exist

Check:

1. the owning resource is present
2. its manifest name has not been renamed
3. it started before the consumer
4. every Fluxcore resource comes from the same commit
5. the server was fully restarted after a core API update

For core consumers:

```lua
dependency 'fluxcore_core'
```

## `GetPlayer()` returns `nil`

The source must have an active selected Fluxcore character. Listen for `fluxcore:server:playerLoaded` or check after the relevant request instead of assuming a character exists during connection setup.

## A State Bag handler never runs

Verify:

* the exact namespaced key
* the server uses `state:set(key, value, true)`
* the handler filters the correct `player:<serverId>` bag
* the value actually changed
* `sv_stateBagStrictMode` is enabled
* the owning resource, not a consumer, writes the value

Read the current value once after registering the handler.

## Blank or stuck NUI

Check the client F8 console and NUI developer tools for the first error.

Then verify:

* `ui_page` and `files` match real paths
* asset URLs are relative
* the page background is transparent
* every NUI callback always replies
* focus is cleared before spawn or resource stop
* no stale resource version remains in the server cache
* client and server use a current Enhanced hotfix

Restarting only a frontend resource may preserve broken focus during early development. A complete server reconnect is the cleanest control test.

## A callback says it must be a function

Use the documented callback form:

```lua
exports.fluxcore_core:CallAsync('characters:list', {}, function(response)
    -- handle response
end)
```

Do not pass the result of a function call in place of the callback.

## Database integrity or migration failure

Stop the server before manual file operations. Run:

```powershell
npm run data:inspect
node tools/fluxcore-data.js verify <backup-path>
```

Do not change `PRAGMA user_version`. Restore a complete verified backup set or fix the forward migration.

## Permission denied

For a native restricted command, grant `command.<name>`. For Fluxcore domain operations, grant the documented Fluxcore ACE.

Check the principal inheritance:

```cfg
add_principal identifier.license:REPLACE_ME group.admin
```

Restart or reload the ACL configuration after changes.

## Job duty cannot be toggled

The server verifies coordinates. Confirm:

* the job is assigned
* it is the active job
* the marker belongs to that job
* the player is within the configured radius
* the job and point names match `config/jobs.json`

No MLO is required for the default points.

## Garage action is rejected

Check ownership or key, vehicle type, configured garage, player distance and stored/out state. Clients cannot choose an arbitrary spawn position.

## Phone hardware integration fails

If `requirePhoneItem` is enabled, `fluxcore_inventory` must be started and the character must own the configured item. Disable the hardware requirement for early testing.

## Report a bug

Include:

* exact Fluxcore commit
* Cfx Server and Enhanced client build
* first relevant error
* reproduction steps
* expected and actual result
* whether clean data reproduces it

Remove license keys, identifiers, IP addresses, tokens and database contents. Use private reporting for security issues.
