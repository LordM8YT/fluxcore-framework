'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const recipe = fs.readFileSync(path.join(root, 'recipe.yaml'), 'utf8');
const serverConfig = fs.readFileSync(
  path.join(root, 'txadmin', 'server.cfg'),
  'utf8',
);

function indexOfLine(value, line) {
  return value.split(/\r?\n/u).findIndex((candidate) => candidate.trim() === line);
}

test('txAdmin recipe installs a complete dependency-free Fluxcore server', () => {
  assert.match(recipe, /^\$engine: 3$/mu);
  assert.match(recipe, /^\$onesync: on$/mu);
  assert.match(recipe, /^name: Fluxcore Framework$/mu);
  assert.match(recipe, /src: https:\/\/github\.com\/LordM8YT\/fluxcore-framework/u);
  assert.match(recipe, /ref: main/u);
  assert.match(recipe, /src: \.\/tmp\/fluxcore\/resources\/\[fluxcore\]/u);
  assert.match(recipe, /dest: \.\/resources\/\[fluxcore\]/u);
  assert.match(recipe, /src: \.\/tmp\/fluxcore\/LICENSE/u);
  assert.match(recipe, /dest: \.\/resources\/\[fluxcore\]\/LICENSE/u);
  assert.match(recipe, /src: https:\/\/github\.com\/citizenfx\/cfx-server-data/u);
  assert.match(recipe, /ref: e265cb251c88260533c847d4a1a2838c7d828a66/u);
  assert.match(recipe, /subpath: resources/u);
  assert.match(recipe, /path: \.\/tmp\s*$/mu);
  assert.doesNotMatch(recipe, /qbox|qbcore|esx|oxmysql/iu);
});

test('generated server config exposes every txAdmin placeholder', () => {
  for (const placeholder of [
    '{{serverEndpoints}}',
    '{{maxClients}}',
    '{{svLicense}}',
    '{{addPrincipalsMaster}}',
  ]) {
    assert.ok(serverConfig.includes(placeholder), `${placeholder} is missing`);
  }

  assert.doesNotMatch(serverConfig, /^set onesync on$/mu);
  assert.match(serverConfig, /^set sv_stateBagStrictMode true$/mu);
  assert.match(serverConfig, /^set sv_devMode true$/mu);
  assert.doesNotMatch(serverConfig, /^set sv_devmode true$/mu);
  assert.doesNotMatch(serverConfig, /^sv_enforceGameBuild\s+/mu);
  assert.match(serverConfig, /^add_ace group\.admin fluxcore\.admin allow$/mu);
  assert.match(
    serverConfig,
    /^add_ace group\.admin fluxcore\.jobs\.manage allow$/mu,
  );
  assert.match(
    serverConfig,
    /^add_ace group\.admin fluxcore\.vehicles\.manage allow$/mu,
  );
  assert.match(
    serverConfig,
    /^add_ace group\.admin fluxcore\.businesses\.manage allow$/mu,
  );
});

test('Fluxcore resources start after core in dependency order', () => {
  const expected = [
    'ensure fluxcore_core',
    'ensure fluxcore_interact',
    'ensure fluxcore_status',
    'ensure fluxcore_jobs',
    'ensure fluxcore_inventory',
    'ensure fluxcore_banking',
    'ensure fluxcore_vehicles',
    'ensure fluxcore_appearance',
    'ensure fluxcore_businesses',
    'ensure fluxcore_services',
    'ensure fluxcore_dispatch',
    'ensure fluxcore_mdt',
    'ensure fluxcore_properties',
    'ensure fluxcore_world',
    'ensure fluxcore_admin',
    'ensure fluxcore_phone',
    'ensure fluxcore_identity',
    'ensure fluxcore_example',
  ];

  const indexes = expected.map((line) => indexOfLine(serverConfig, line));
  assert.ok(indexes.every((index) => index >= 0), 'a Fluxcore resource is missing');
  assert.deepEqual(indexes, [...indexes].sort((a, b) => a - b));
  assert.equal(indexOfLine(serverConfig, 'ensure basic-gamemode'), -1);
  assert.equal(indexOfLine(serverConfig, 'stop basic-gamemode'), -1);
});
