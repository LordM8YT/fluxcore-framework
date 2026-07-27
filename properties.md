# Properties

`fluxcore_properties` owns property ownership, keys, locks, storage and garage metadata.

## Dependencies

`fluxcore_core`, `fluxcore_inventory`, `fluxcore_banking`, `fluxcore_vehicles`

## Configuration

Configure properties in `fluxcore_properties/config/properties.json`.

## Server security

Purchase, lock, key and storage actions require server-verified position. Storage uses `fluxcore_inventory` stashes. No interior is bundled. An MLO or shell adapter consumes access exports and events.

## Client integration

Open with `/properties` or `fluxcore_properties:client:open`. Updates emit `fluxcore_properties:client:updated`.

Any frontend calls the client `Request` export. Supported methods are `bootstrap`, `purchase`, `key:give`, `key:revoke`, `lock:set` and `storage:open`. The frontend remains replaceable.

## Server exports

* `GetProperties`
* `HasAccess`
* `GiveKey`
* `RevokeKey`

## Commands

* `/properties`
