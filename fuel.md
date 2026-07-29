# Fuel

`fluxcore_fuel` provides native vehicle fuel consumption and secure fuel purchases without an external fuel script or full-screen NUI.

## Dependencies

Start these resources in order:

```cfg
ensure fluxcore_core
ensure fluxcore_interact
ensure fluxcore_inventory
ensure fluxcore_vehicles
ensure fluxcore_fuel
```

`fluxcore_vehicles` persists the native fuel level when a vehicle is stored.
`fluxcore_inventory` owns purchased fuel cans.

## Player use

At a configured station:

1. Hold left Alt and aim at a fuel pump.
2. Choose **Take fuel hose** or **Buy fuel can**.
3. With the hose equipped, walk to the vehicle and use left Alt on it.
4. Choose **Refuel vehicle** and enter the number of liters.
5. Return the hose to the pump when finished.

A purchased can is stored as `fuel_can` in the player inventory. Use it from
`/inventory`, then use left Alt on a nearby vehicle and select
**Refuel vehicle**. One can adds its configured amount and is consumed.

The fallback command is:

```text
/refuel [liters|full]
```

## Configuration

Edit `resources/[fluxcore]/fluxcore_fuel/config/fuel.json`:

```json
{
  "currency": "cash",
  "pricePerLiter": 3,
  "minimumLiters": 1,
  "maximumLiters": 100,
  "consumptionMultiplier": 1,
  "fuelCanPrice": 250,
  "fuelCanLiters": 20,
  "vehicleDistance": 4,
  "hoseDistance": 18
}
```

Each entry in `stations` has a stable ID, label, coordinates and interaction radius. Restart `fluxcore_fuel` after changing the file.

## Security boundary

The client requests a purchase but cannot approve one. The server:

* resolves the authenticated player and server-observed ped
* resolves the submitted network entity
* requires the player to stand next to the vehicle
* checks distance to the configured station
* bounds the liters and calculates the price
* removes money through the core wallet ledger
* rate-limits purchase attempts
* purchases cans through the wallet and inventory exports, with a refund if
  inventory insertion fails
* consumes one server-observed `fuel_can` when can refuelling succeeds

Only an approved response changes the local native fuel level.

## Server export

```js
const result = global.exports.fluxcore_fuel.PurchaseFuel(
  source,
  networkId,
  stationId,
  liters,
);
```

The result uses the standard Fluxcore `{ ok, data }` or `{ ok, error }` envelope.

## Enhanced behavior

The resource uses FiveM's native fuel system instead of a per-frame consumption loop. Cfx provides the consumption and fuel-level natives, but it does not provide stations or payments. See the live [Cfx fuel consumption guide](https://docs.fivem.net/docs/scripting-manual/using-new-game-features/fuel-consumption/) and Fluxcore's [Enhanced compatibility notes](docs/fivem-enhanced-compatibility.md).
