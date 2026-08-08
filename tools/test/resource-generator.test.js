'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createResource } = require('../create-resource');

test('resource generator creates a renamed, native Fluxcore resource', () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxcore-generator-'));
  const destination = path.join(temporaryRoot, 'my_delivery');
  try {
    createResource('my_delivery', destination);
    const manifest = fs.readFileSync(path.join(destination, 'fxmanifest.lua'), 'utf8');
    const client = fs.readFileSync(path.join(destination, 'client', 'main.lua'), 'utf8');
    assert.match(manifest, /name 'my_delivery'/u);
    assert.match(manifest, /dependency 'fluxcore_core'/u);
    assert.doesNotMatch(client, /fluxcore_starter/u);
    assert.match(client, /my_delivery:client:jobChanged/u);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('resource generator rejects traversal and does not overwrite', () => {
  assert.throws(() => createResource('../escape'), /name must match/u);
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fluxcore-generator-'));
  try {
    assert.throws(() => createResource('valid_name', temporaryRoot), /already exists/u);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
