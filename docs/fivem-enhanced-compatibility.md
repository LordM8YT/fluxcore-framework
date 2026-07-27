# FiveM Enhanced compatibility notes

Last reviewed: 2026-07-27
Validated locally against: FiveM for GTAV Enhanced early access and Cfx Server
artifact `b96-ea/Win`.
Latest release notes reviewed: FiveM for GTAV Enhanced Early Access Hotfix 5.

This file is Fluxcore's project memory for Enhanced runtime behavior. It
combines official Cfx documentation with observations reproduced in the local
Enhanced client. Re-check the live sources whenever the client, gamebuild, or
server artifact changes.

## Check these live sources first

These pages can change independently of this repository:

- [Enhanced onboarding guide](https://docs.fivem.net/docs/server-manual/onboarding-guide-fivem-for-gtav-enhanced/)
- [Legacy vs. Enhanced changes and breaking changes](https://docs.fivem.net/docs/developers/legacy-vs-enhanced/)
- [FiveM developer documentation index](https://docs.fivem.net/docs/developers/)
- [FiveM native reference](https://docs.fivem.net/natives/)
- [Enhanced client console commands](https://docs.fivem.net/docs/client-manual/console-commands/)
- [Cfx Server downloads](https://docs.fivem.net/docs/server-download/)
- [Cfx announcements](https://forum.cfx.re/c/cfxre-announcements/66)
- [Enhanced Early Access reports](https://github.com/citizenfx/rfc/discussions)
- [Cfx service status](https://status.cfx.re/)

When the local note does not cover a feature, search the official developer
documentation and native reference before implementing it. For early-access
behavior not yet documented, check official Cfx announcements and reproduce it
locally before relying on it.

## Required workflow

1. Read the relevant official page before introducing a native or lifecycle
   assumption.
2. Add a repository test for the contract or static safety rule.
3. Sync every changed runtime file into active txData and compare hashes.
4. For manifest changes or new files: stop dependents, stop the provider, use
   txAdmin **Reload & Refresh**, start the provider, then its dependents.
5. Verify in the Enhanced client. Unit tests do not prove CEF composition,
   player input, raycasts, resource caching, or restart behavior.
6. Inspect the newest server log and, when relevant, the client F8/NUI console.

## Enhanced differences that affect Fluxcore

The official Enhanced change log is the source of truth. At the review date it
documents, among other changes:

- the client-server networking model replaces P2P synchronization;
- OneSync non-big mode no longer exists;
- pure mode is always enabled during early access;
- developer tools require `sv_devMode true`;
- state-bag callbacks only fire when the entity exists;
- replicated values must be explicitly replicated;
- only one TCP and one UDP endpoint are supported;
- server archives/executables use the Cfx Server names; and
- several legacy convars are removed, deprecated, or compatibility-only.

Do not copy Legacy configuration into Fluxcore without comparing it to the
live [Enhanced change log](https://docs.fivem.net/docs/developers/legacy-vs-enhanced/).

## Early Access Hotfix 5

Hotfix 5 resolves several Enhanced regressions that overlap Fluxcore's
lifecycle, NUI, spawn, networking, and vehicle code. Do not keep compatibility
workarounds for these bugs after both client and server have been updated.

Fluxcore impact:

- A resource must initialize its own state directly. Do not rely on its own
  `onResourceStart` notification; Hotfix 5 no longer emits that self-start
  event. Cross-resource start events may still be used to restore registrations
  after a provider restarts.
- `SetNuiFocus(false, false)` releases focus immediately again. Keep explicit
  close and resource-stop cleanup, but do not add release delays or polling.
- `ShutdownLoadingScreenNui` no longer moves the local ped to a default spawn.
  Custom spawn code remains responsible for the final coordinates.
- `NetworkGetEntityOwner` and `NetworkGetFirstEntityOwner` return `-1` for
  server-owned entities again. Treat any negative owner as no player owner.
- Server-created vehicles can be deleted again unless protected mode forbids
  it. Fluxcore must still validate ownership and authorization server-side.
- Custom endpoints, proxied listings, resource file serving, semicolons in
  configuration values, indented configuration comments, and resource-category
  shutdown were fixed upstream. Avoid local parsers or lifecycle workarounds
  for those regressions.
- The `GetGamePool('CObject')` crash near map objects and MLOs was fixed.
  Fluxcore currently does not depend on `GetGamePool` for targeting.

Relevant upstream reports:

- [`onResourceStart` self-start behavior](https://github.com/citizenfx/rfc/discussions/113)
- [`SetNuiFocus` delayed release](https://github.com/citizenfx/rfc/discussions/235)
- [`ShutdownLoadingScreenNui` spawn relocation](https://github.com/citizenfx/rfc/discussions/224)
- [Resource file server regression](https://github.com/citizenfx/rfc/discussions/146)
- [Server-created vehicle deletion](https://github.com/citizenfx/rfc/discussions/254)

The local validation line at the top records the last artifact tested in-game.
Update it only after Hotfix 5 has been installed and the checklist has been
re-run; reviewing release notes alone is not runtime validation.

## NUI and transparency

Official Cfx behavior:

- A resource `ui_page` is hosted as a full-screen iframe.
- The most recently focused NUI resource is placed on top of the focus stack.
- Full-screen NUI frames do not provide click-through between resources.
- `SendNUIMessage` sends structured data to the current resource's page.

Fluxcore rules:

- The iframe is always full-screen; the *painted UI* must remain bounded.
- Put critical transparency inline before external CSS loads:

  ```html
  <style>
    html, body, #app {
      background: none !important;
      background-color: rgba(0, 0, 0, 0) !important;
    }
  </style>
  ```

- Do not set `color-scheme: dark` on an overlay document. Enhanced CEF may
  paint a dark document canvas despite later transparent styling.
- A viewport-sized root may paint nothing and capture no pointer input.
  Opaque backgrounds belong only on bounded panels.
- Hide panels in initial HTML and open them only after an explicit message.
- Target prompts and notifications do not take focus until the player clicks
  a highlighted target. Target choices, menus, and dialogs may call
  `SetNuiFocus(true, true)` and must always release it.
- Inspect real CEF state with `http://localhost:13172/` or `nui_devTools` in F8.

Live references:

- [Fullscreen NUI](https://docs.fivem.net/docs/scripting-manual/nui-development/full-screen-nui/)
- [SendNUIMessage](https://docs.fivem.net/docs/scripting-reference/runtimes/lua/functions/SendNUIMessage/)

## Input and key mappings

- Use paired `+command`/`-command` handlers and `RegisterKeyMapping` for
  holdable, user-configurable controls.
- Do not poll a raw GTA control for a framework-level key when a FiveM mapping
  can express it.
- Fluxcore target defaults to `LMENU` (left Alt). While a valid target is
  highlighted, GTA control `24` (left mouse) activates NUI focus without
  firing a weapon. The player then clicks an option directly; five or more
  choices scroll vertically with the mouse wheel. While the target cursor has
  focus, controls `1` and `2` are disabled so mouse movement cannot rotate the
  gameplay camera. `E` is not used.
- Key mappings are user-editable, so diagnostics must check the registered
  command/mapping rather than assume a physical key.

Live reference:

- [Cfx key bindings](https://docs.fivem.net/docs/cookbook/2020/01/06/using-the-new-console-key-bindings/)

## Resource lifecycle and dependencies

- Initialize a resource's own state directly at module load. Never make
  bootstrap depend on receiving its own `onResourceStart` or
  `onClientResourceStart` event.
- Hotfix 5 no longer emits `onResourceStart` for a resource's own start.
- Start events do not preserve another resource's in-memory Lua state.
- Restarting a provider such as `fluxcore_interact` clears registrations.
- Consumers must perform an initial registration, listen for provider starts,
  and use a bounded retry while `GetResourceState(provider) == 'started'`.
- Registration IDs must be namespaced and re-registration idempotent.
- For manual reload: stop consumers, stop the provider, use
  **Reload & Refresh**, start the provider, wait, then start consumers.
- A full txAdmin restart is the final dependency-order integration test.

Live references:

- [onResourceStart](https://docs.fivem.net/docs/scripting-reference/events/list/onResourceStart/)
- [onClientResourceStart](https://docs.fivem.net/docs/scripting-reference/events/list/onClientResourceStart/)
- [Client events](https://docs.fivem.net/docs/scripting-reference/events/client-events/)
- [Server events](https://docs.fivem.net/docs/scripting-reference/events/server-events/)

## Raycasts and model targets

- Shape tests are asynchronous. Poll `GetShapeTestResult` across enough frames.
- A line probe can hit the wall around an embedded prop such as an ATM.
  Registered model targeting may use a bounded screen-space nearest-object
  fallback while target mode is active.
- Limit fallbacks by registered hashes, distance, screen radius, and target
  activation time.
- Registration distance and option distance both apply. A smaller option
  default can silently override a larger registration range.
- Test real variants, not a single prop name.
- Diagnose in this order:
  1. target activation;
  2. registration count and IDs;
  3. entity/raycast/fallback hit;
  4. distance and `canInteract`;
  5. NUI prompt message.

Live reference:

- [Shape-test native reference](https://docs.fivem.net/natives/?_0x052837721A854EC7=)
- [ox_target reference implementation](https://github.com/overextended/ox_target)
- [ox_lib camera raycast reference](https://github.com/overextended/ox_lib/blob/main/imports/raycast/client.lua)

Fluxcore's dependency-free target follows the proven camera strategy used by
`ox_target`: final-rendered camera coordinates/rotation, trace flags `511` and
`26`, ignore flags `4`, and waiting for the asynchronous result to finish.

## txAdmin and diagnostics

- A running server resource does not prove its client registered targets or its
  NUI rendered correctly.
- After a full restart, verify port `30120`, the newest log, and dependency
  order.
- Public server-list endpoint timeouts are separate from Fluxcore startup
  errors.
- Temporary runtime probes are acceptable for diagnosis, but remove their
  scripts, events, and manifest entries after confirmation.

Live reference:

- [Setting up a server with txAdmin](https://docs.fivem.net/docs/server-manual/setting-up-a-server-txadmin/)

## Confirmed local incidents

### Opaque target canvas

Stopping `fluxcore_interact` removed the black overlay. Removing the
document-level dark color scheme and forcing transparent `html`, `body`, and
`#app` fixed the Enhanced CEF canvas.

### Missing target prompt after restart

The eye rendered, but a runtime probe reported `registrations=0`. The ATM model
was not the initial cause; the consumer had not restored registrations after
the target provider restarted. Registration now initializes directly, retries
while the provider becomes available, and repeats after provider restarts.

### Manifest/runtime refresh

Adding a runtime file without deploying the matching manifest and running
**Reload & Refresh** produced misleading dependency/start messages. Deploy new
files and manifest changes as one unit.
