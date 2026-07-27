'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const resource = path.join(
  root,
  'resources',
  '[fluxcore]',
  'fluxcore_interact',
);

test('interaction resource exposes the documented public UI API', () => {
  const manifest = fs.readFileSync(path.join(resource, 'fxmanifest.lua'), 'utf8');
  const client = fs.readFileSync(
    path.join(resource, 'client', 'main.lua'),
    'utf8',
  );
  const readme = fs.readFileSync(path.join(resource, 'README.md'), 'utf8');

  assert.match(manifest, /dependency 'fluxcore_core'/u);
  assert.match(manifest, /ui_page 'web\/index\.html'/u);

  for (const exportName of [
    'RegisterZone',
    'AddModel',
    'AddEntity',
    'AddGlobalPlayer',
    'AddGlobalVehicle',
    'AddGlobalPed',
    'AddGlobalObject',
    'RemoveInteraction',
    'OpenMenu',
    'InputDialog',
    'Notify',
    'Progress',
  ]) {
    assert.match(client, new RegExp(`exports\\('${exportName}'`, 'u'));
    assert.match(readme, new RegExp(exportName, 'u'));
  }

  assert.match(
    client,
    /local function isCallable\(value\)/u,
    'callbacks crossing resource exports must support callable references',
  );
  assert.doesNotMatch(
    client,
    /type\(option\.(?:onSelect|canInteract)\) == 'function'/u,
    'callback checks must not reject FiveM callable references',
  );
});

test('interaction UI remains a replaceable message and callback boundary', () => {
  const app = fs.readFileSync(path.join(resource, 'web', 'app.js'), 'utf8');
  const mock = JSON.parse(
    fs.readFileSync(
      path.join(root, 'contracts', 'ui', 'v1', 'interact.bootstrap.json'),
      'utf8',
    ),
  );

  assert.equal(mock.contract, 'fluxcore.interact.bootstrap.v1');
  assert.ok(mock.interaction.options.length > 1);
  assert.equal(mock.interaction.focused, false);
  assert.ok(mock.menu.options.length > 1);

  for (const action of [
    'target:active',
    'target:focus',
    'interaction:show',
    'interaction:hide',
    'menu:open',
    'menu:close',
    'dialog:open',
    'dialog:close',
    'notification:show',
    'progress:open',
    'progress:close',
  ]) {
    assert.ok(app.includes(`'${action}'`), `${action} is missing from NUI`);
  }

  const client = fs.readFileSync(
    path.join(resource, 'client', 'main.lua'),
    'utf8',
  );
  const config = JSON.parse(
    fs.readFileSync(path.join(resource, 'config', 'interact.json'), 'utf8'),
  );
  assert.equal(config.activationKey, 'LMENU');
  assert.equal(config.interactionControl, undefined);
  assert.match(client, /RegisterCommand\('\+fluxcore_target'/u);
  assert.match(client, /RegisterCommand\('-fluxcore_target'/u);
  assert.match(client, /RegisterKeyMapping\(/u);
  assert.match(client, /action = 'target:active'/u);
  assert.match(client, /GetClosestObjectOfType\(/u);
  assert.match(client, /GetScreenCoordFromWorldCoord\(/u);
  assert.match(client, /GetFinalRenderedCamCoord\(\)/u);
  assert.match(client, /GetFinalRenderedCamRot\(2\)/u);
  assert.match(client, /raycastEntity\(511\)/u);
  assert.match(client, /raycastEntity\(26\)/u);
  assert.match(client, /IsDisabledControlJustPressed\(0,\s*24\)/u);
  assert.match(client, /DisableControlAction\(0,\s*1,\s*true\)/u);
  assert.match(client, /DisableControlAction\(0,\s*2,\s*true\)/u);
  assert.doesNotMatch(client, /IsControlJustReleased\(0,\s*interactionControl\)/u);

  for (const callback of [
    'selectTarget',
    'releaseTargetFocus',
    'selectMenu',
    'closeMenu',
    'submitDialog',
    'closeDialog',
    'cancelProgress',
  ]) {
    assert.ok(app.includes(`'${callback}'`), `${callback} callback is missing`);
  }

  const styles = fs.readFileSync(
    path.join(resource, 'web', 'styles.css'),
    'utf8',
  );
  assert.match(styles, /\.target-options[\s\S]*overflow-y:\s*auto/u);
  assert.match(app, /options\.length > 4/u);
});

test('example interactions bootstrap directly and recover after provider restart', () => {
  const exampleClient = fs.readFileSync(
    path.join(
      root,
      'resources',
      '[fluxcore]',
      'fluxcore_example',
      'client.lua',
    ),
    'utf8',
  );

  const directBootstrap = exampleClient.indexOf(
    'scheduleTestInteractionRegistration()\n\nAddEventHandler',
  );
  assert.notEqual(
    directBootstrap,
    -1,
    'own bootstrap must run directly instead of relying on a self-start event',
  );
  assert.match(
    exampleClient,
    /AddEventHandler\('onClientResourceStart', function\(resource\)[\s\S]*if resource == 'fluxcore_interact' then[\s\S]*scheduleTestInteractionRegistration\(\)/u,
    'provider restart must restore cross-resource registrations',
  );
  assert.doesNotMatch(
    exampleClient,
    /resource == GetCurrentResourceName\(\)[\s\S]*scheduleTestInteractionRegistration\(\)/u,
    'Hotfix 5 no longer guarantees a resource receives its own start event',
  );
});
