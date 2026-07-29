'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const fuelRoot = path.join(
  root,
  'resources',
  '[fluxcore]',
  'fluxcore_fuel',
);

function read(...segments) {
  return fs.readFileSync(path.join(fuelRoot, ...segments), 'utf8');
}

test('fuel resource follows the Enhanced native and lifecycle contract', () => {
  const manifest = read('fxmanifest.lua');
  const client = read('client', 'main.lua');

  assert.match(manifest, /dependencies\s*\{[\s\S]*'fluxcore_core'/u);
  assert.match(manifest, /dependencies\s*\{[\s\S]*'fluxcore_interact'/u);
  assert.match(manifest, /dependencies\s*\{[\s\S]*'fluxcore_inventory'/u);
  assert.doesNotMatch(manifest, /\bui_page\b/u);
  assert.match(client, /SetFuelConsumptionState\(true\)/u);
  assert.match(client, /SetFuelConsumptionRateMultiplier/u);
  assert.match(client, /DoesVehicleUseFuel/u);
  assert.match(client, /GetVehicleFuelLevel/u);
  assert.match(client, /function tankVolume\(vehicle\)/u);
  assert.match(client, /config\.defaultTankLiters\) or 65\.0/u);
  assert.match(client, /currentLiters = tank \* \(currentPercent \/ 100\.0\)/u);
  assert.match(client, /purchase\.liters or 0\) \/ tank\) \* 100\.0/u);
  assert.match(client, /SetVehicleFuelLevel/u);

  const directRegistration = client.indexOf('scheduleRegistration()');
  const lifecycleHandler = client.indexOf(
    "AddEventHandler('onClientResourceStart'",
  );
  assert.ok(directRegistration >= 0);
  assert.ok(lifecycleHandler > directRegistration);
  assert.match(
    client,
    /startedResource == 'fluxcore_interact'[\s\S]*scheduleRegistration\(\)/u,
  );
});

test('fuel purchases are validated and charged on the server', () => {
  const service = read('server', 'service.js');
  const server = read('server', 'main.js');

  assert.match(service, /this\.config\.vehicleDistance/u);
  assert.match(service, /station\.radius \+ 2/u);
  assert.match(service, /this\.liters\(requestedLiters\)/u);
  assert.match(service, /this\.core\.removeMoney/u);
  assert.match(server, /fluxcore_fuel:server:purchase/u);
  assert.match(server, /fluxcore_fuel:server:buyCan/u);
  assert.match(server, /fluxcore_fuel:server:useCan/u);
  assert.match(server, /RegisterUsableItem\(\s*'fuel_can'/u);
  assert.match(server, /RATE_LIMITED/u);
});

test('fuel can registration recovers after inventory restarts', () => {
  const main = read('server', 'main.js');
  assert.match(main, /function registerFuelCan\(\)/u);
  assert.match(
    main,
    /onResourceStart[\s\S]*startedResource === 'fluxcore_inventory'[\s\S]*registerFuelCan/u,
  );
});
