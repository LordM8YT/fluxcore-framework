# Enhanced Test Plan

Use this checklist for every release candidate and after a major Cfx Server artifact update. Record the exact client and server build before testing.

{% stepper %}
{% step %}
## Prepare

* Pull the intended Fluxcore commit.
* Run `npm test`.
* Create and verify a complete backup.
* Copy `server.cfg.example` outside the repository.
* Add real keys and principals only to the external copy.
* Keep the documented resource order.
* Use empty data directories for a clean-install test.

Example test permissions:

```cfg
add_principal identifier.license:REPLACE_ME group.admin
add_ace group.admin fluxcore.admin allow
add_ace group.admin fluxcore.jobs.manage allow
add_ace group.admin fluxcore.vehicles.manage allow
```

{% hint style="warning" %}
Never attach real keys, identifiers, IP addresses or production databases to a public issue.
{% endhint %}
{% endstep %}

{% step %}
## Boot gate

The server must:

* accept `node_version '26'`
* load `node:sqlite`
* start all resources without a stack trace
* create one SQLite database per owner
* use OneSync and strict State Bags

After a clean shutdown:

```powershell
npm run data:inspect
```

{% hint style="warning" %}
Stop on the first resource error. Later dependency failures are usually noise.
{% endhint %}
{% endstep %}

{% step %}
## Identity and persistence

With player A:

* Connect and open character selection.
* Confirm the world and previous player location never flash before selection;
  only the isolated preview studio, local ped and bounded identity UI render.
* Create characters in two slots.
* Select each character.
* Test every configured spawn.
* Move, disconnect and verify saved position.
* Log out and switch character.
* Confirm `/logout` closes gameplay UI, clears roleplay chat, shows the
  character menu with a visible cursor, and never joins proximity voice in the
  preview studio.
* Delete a character with exact confirmation.
* Restart the server and verify deletion persists.
* Restart `fluxcore_identity` while logged out and confirm camera, focus,
  frozen controls and radar recover after the next spawn.
* Restart `fluxcore_identity` while logged in and confirm it does not leave a
  black screen or steal NUI focus.
- Enter and leave a vehicle: the compact RP minimap should appear only in the
  vehicle, with vanilla GTA HUD components and weapon wheel absent.
- Fire a weapon near ambient NPCs and confirm no wanted stars, dispatch calls,
  or vanilla police response is created; only Fluxcore RP dispatch may react.
- Create a fresh character and confirm the appearance creator opens once after
  spawn, previews changes live, saves persistently, and Escape restores the
  original appearance.
- Reconnect from a cold client and confirm the Fluxcord loading screen tracks
  real Cfx load progress, then yields cleanly to identity without a black frame.

Player B must not select or delete player A's character.
{% endstep %}

{% step %}
## Jobs without MLOs

```
assignjob <source> police 1
assignjob <source> ambulance 1
assignjob <source> mechanic 1
```

Default duty points:

| Job      | Location        | Coordinates               |
| -------- | --------------- | ------------------------- |
| Police   | Mission Row     | `441.13, -981.94, 30.69`  |
| EMS      | Pillbox Medical | `299.67, -584.38, 43.26`  |
| Mechanic | La Mesa Customs | `731.29, -1088.95, 22.17` |

Verify marker, blip, duty toggle, `/jobs`, server distance rejection and duty cleanup after disconnect.
Remain on duty through one configured payday and verify the grade payment is
credited once. Clock off before the next interval and confirm no payment.
{% endstep %}

{% step %}
## Inventory

Give `water`, `bandage` and `phone` through `/vadmin`.

On a brand-new character, first confirm the configured starter package appears
once. Empty and reopen the inventory to ensure it is not granted again.

Verify:

* slots and weight
* full and partial stack moves
* stack maximum
* atomic rejection when full
* player-to-player transfer
* registered stash transfer
* persistence after restart
* partial ground drops
* server distance validation
* empty-drop cleanup
* `player`/`secondary` UI sides

Verify both the temporary visual frontend and its text commands. Use water,
sandwich and bandage once below maximum status/health and confirm exactly one
item is consumed; full hunger or thirst must reject consumption.
{% endstep %}

{% step %}
## Status and HUD

* Inspect initial needs.
* Wait through two decay intervals.
* Restart the resource and server.
* Verify persistence.
* Inspect `fluxcore_status:client:hudUpdated`.
* Confirm `fluxcore.hud.bootstrap.v1`.
* Verify owner-only delivery.
{% endstep %}

{% step %}
## Vehicles and garages

```
givevehicle <source> sultan automobile
```

Verify:

* garage listing
* server-created spawn
* persisted plate and properties
* lock/unlock with a valid key
* trunk inventory persistence
* storage through the garage marker
* rejected remote operations
* shared and revoked keys
* `G` engine toggle rejects non-drivers and players without a key
* `B` seatbelt blocks exit, updates the HUD and clears after death/exit
{% endstep %}

{% step %}
## Fuel

With an owned vehicle and enough cash:

* drive to two different configured stations
* use left Alt on a pump, take the hose, then use left Alt on a vehicle and
  select `Refuel vehicle`
* confirm the nozzle prop is cleaned up when returned, when moving too far
  away, and when the resource stops
* buy a fuel can, confirm it appears in inventory, use it on a vehicle away
  from the station, and confirm the item is consumed exactly once
* verify the mouse controls the target UI rather than the gameplay camera
* buy a partial amount and then use `/refuel full`
* confirm the exact wallet deduction and fuel increase
* on a vehicle whose HUD is below 100%, confirm refuelling is offered even if
  its handling metadata has no usable petrol-tank volume
* verify consumption while driving and no consumption for unsupported vehicles
* reject a remote player, remote station, invalid amount and insufficient funds
* store and respawn the vehicle through a garage and confirm its fuel level persists
* restart `fluxcore_interact` and confirm station targets register again
* restart `fluxcore_fuel` and confirm consumption and targets recover
{% endstep %}

{% step %}
## Appearance

Test male and female defaults, components, props, head blend, overlays, hair, eyes, respawn, restart persistence, invalid values and `/resetappearance`.
{% endstep %}

{% step %}
## Admin

With an authorized player, test player list, go to, bring, freeze, heal, wallets, jobs, items and audit output.

With an unauthorized player, confirm `/vadmin` discloses no roster. Grant only `fluxcore.admin.open` and verify that `fluxcore.admin.players` is still required.
{% endstep %}

{% step %}
## Phone

With two players:

* Record both numbers.
* Add contacts.
* Exchange texts.
* Verify order and unread state.
* Retry a nonce and confirm idempotency.
* Send while the recipient is offline.
* Reconnect and verify delivery.
* Restart and verify persistence.

Voice calls are outside the current milestone.
{% endstep %}

{% step %}
## Restart and data gate

* Create an online backup.
* Verify the backup.
* Restart each Fluxcore resource.
* Restart the complete server.
* Inspect every database.
* Verify all domain state.

{% hint style="warning" %}
Do not test restoration while Cfx Server is running. Follow [Database and Backups](database-and-backups.md).
{% endhint %}
{% endstep %}

{% step %}
## Performance

With at least two clients:

* watch server event-loop delay and memory
* record a trace during selection and inventory moves
* remain connected through multiple autosaves
* inspect WAL growth
* confirm position sync does not flood logs or the network
* use resmon to identify idle client loops
{% endstep %}
{% endstepper %}

## Go or no-go

Ready for an alpha tag only when:

* all tests and GitHub Actions pass
* every resource boots on the public Enhanced artifact
* identity persistence survives a full restart
* ownership, permission, distance, amount, weight and rate failures are rejected
* backups verify
* no known data-loss or privilege-escalation issue exists

{% hint style="danger" %}
Data corruption, crashes, identifier leaks, duplication or permission bypasses are release blockers.
{% endhint %}
