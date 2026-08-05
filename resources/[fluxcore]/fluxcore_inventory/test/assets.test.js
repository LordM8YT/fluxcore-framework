'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('every configured inventory item has a matching PNG asset', () => {
  const resourceRoot = path.resolve(__dirname, '..');
  const config = JSON.parse(
    fs.readFileSync(path.join(resourceRoot, 'config', 'items.json'), 'utf8'),
  );
  const imageRoot = path.join(resourceRoot, 'web', 'images', 'items');
  const expected = Object.keys(config.items)
    .map((name) => `${name}.png`)
    .sort();
  const actual = fs.readdirSync(imageRoot)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .sort();

  assert.deepEqual(actual, expected);
  for (const filename of actual) {
    assert.ok(
      fs.statSync(path.join(imageRoot, filename)).size > 1024,
      `${filename} should contain a real image`,
    );
  }
});

test('inventory manifest packs item images for NUI', () => {
  const resourceRoot = path.resolve(__dirname, '..');
  const manifest = fs.readFileSync(
    path.join(resourceRoot, 'fxmanifest.lua'),
    'utf8',
  );
  assert.match(manifest, /'web\/images\/items\/\*\.png'/);
});

test('inventory NUI wires slot dragging to the server-authoritative move action', () => {
  const resourceRoot = path.resolve(__dirname, '..');
  const app = fs.readFileSync(path.join(resourceRoot, 'web', 'app.js'), 'utf8');

  assert.match(app, /addEventListener\('pointerdown'/);
  assert.match(app, /addEventListener\('pointermove'/);
  assert.match(app, /addEventListener\('pointerup'/);
  assert.match(app, /document\.elementFromPoint\(x, y\)/);
  assert.match(app, /distance < 6/);
  assert.match(app, /perform\('move', \{[\s\S]*from: source\.side,[\s\S]*to: side,[\s\S]*fromSlot: source\.slot,[\s\S]*toSlot: slot/);
});
