'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const resourceRoot = path.resolve(__dirname, '..');

test('phone app registry is owner-bound and restart-aware', () => {
  const source = fs.readFileSync(
    path.join(resourceRoot, 'client', 'main.lua'),
    'utf8',
  );

  assert.match(source, /GetInvokingResource\(\)/);
  assert.match(source, /exports\('RegisterApp', registerApp\)/);
  assert.match(source, /exports\('UnregisterApp', unregisterApp\)/);
  assert.match(source, /exports\('SendAppMessage'/);
  assert.match(source, /fluxcore_phone:client:ready/);
  assert.match(source, /onClientResourceStop/);
  assert.match(source, /registration\.resource == stoppedResource/);
  assert.match(source, /ui:find\('\.\.', 1, true\)/);
  assert.match(source, /ui:match\('\^%a\+:\/\/'\)/);
});

test('phone NUI starts transparent and custom apps stay sandboxed', () => {
  const html = fs.readFileSync(path.join(resourceRoot, 'web', 'index.html'), 'utf8');

  assert.match(
    html,
    /html,body,#app\{background:none!important;background-color:rgba\(0,0,0,0\)!important\}/,
  );
  assert.match(
    html,
    /id="custom-app-frame"[^>]+sandbox="allow-forms allow-scripts allow-same-origin"/,
  );
  assert.match(html, /class="app is-hidden"/);
});
