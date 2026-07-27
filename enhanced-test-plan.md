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
* Create characters in two slots.
* Select each character.
* Test every configured spawn.
* Move, disconnect and verify saved position.
* Log out and switch character.
* Delete a character with exact confirmation.
* Restart the server and verify deletion persists.

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
{% endstep %}

{% step %}
## Inventory

Give `water`, `bandage` and `phone` through `/vadmin`.

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

Keep the text fallback until a frontend follows `fluxcore.inventory.bootstrap.v1`.
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
## Enhanced Hotfix 5 regression gate

Run these checks after updating both the Enhanced client and Cfx Server:

* Start every Fluxcore resource from a stopped state and confirm its own
  bootstrap succeeds without depending on an `onResourceStart` self-event.
* Restart `fluxcore_interact` while `fluxcore_example` remains running and
  verify its ATM and other test registrations return.
* Open and close identity, inventory, phone, admin, and target choices. Confirm
  mouse and keyboard focus return immediately every time.
* Complete character selection with a custom spawn and confirm
  `ShutdownLoadingScreenNui` does not relocate the ped.
* Inspect a server-owned entity and confirm owner natives return `-1`; no
  player-owned path may accept a negative owner.
* Spawn and store/delete a server-created test vehicle, unless protected mode
  intentionally blocks deletion.
* Re-test proxied endpoints, resource downloads, semicolons and indented
  comments in a disposable server configuration when those features are used.

See the
[FiveM Enhanced compatibility notes](https://github.com/LordM8YT/fluxcore-framework/blob/main/docs/fivem-enhanced-compatibility.md)
for the upstream reports and implementation rules.
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
