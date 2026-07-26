# World

`fluxcore_world` owns server-validated shops, dealerships and persistent job doors.

## Dependencies

`fluxcore_core`, `fluxcore_jobs`, `fluxcore_inventory`, `fluxcore_vehicles`, `fluxcore_banking`

## Configuration

Configure world locations and rules in `fluxcore_world/config/world.json`.

## Server security

Shop, dealership and door actions validate server position. Inventory capacity and payment are server checked. Purchased vehicles register through `fluxcore_vehicles`. No target dependency exists.

## Client integration

Open with `/world` or `fluxcore_world:client:open`. Updates emit `fluxcore_world:client:updated`.

Any frontend calls the client `Request` export. Supported methods are `bootstrap`, `shop:buy`, `dealership:buy` and `door:set`. The frontend remains replaceable.

## Server exports

* `GetWorld`
* `BuyItem`
* `BuyVehicle`
* `SetDoorLocked`

## Commands

* `/world`
