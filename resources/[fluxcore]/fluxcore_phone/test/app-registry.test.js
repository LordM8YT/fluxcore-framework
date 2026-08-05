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

test('phone ships useful starter apps and an in-game Cipher surface', () => {
  const html = fs.readFileSync(path.join(resourceRoot, 'web', 'index.html'), 'utf8');
  const script = fs.readFileSync(path.join(resourceRoot, 'web', 'app.js'), 'utf8');

  for (const identifier of ['phone', 'messages', 'contacts', 'clock', 'notes', 'calculator', 'darkchat', 'settings']) {
    assert.match(html, new RegExp(`data-open-native="${identifier}"`));
  }
  assert.match(html, />Cipher</);
  assert.match(script, /ENCRYPTED \/\/ IN-GAME/);
  assert.match(html, /id="cipher-channels"/);
  assert.match(html, /id="cipher-voice"/);
  assert.match(script, /cipher:bootstrap/);
  assert.match(script, /fluxcore_phone:quick-note/);
  assert.match(script, /function pressCalculator/);
  assert.match(html, /id="dialer-keys"/);
  assert.match(script, /calls:start/);
});

test('phone calls are server-owned and use Enhanced private voice channels', () => {
  const server = fs.readFileSync(path.join(resourceRoot, 'server', 'main.js'), 'utf8');
  const voice = fs.readFileSync(path.resolve(resourceRoot, '..', 'fluxcore_voice', 'server.lua'), 'utf8');

  assert.match(server, /case 'calls:start'/);
  assert.match(server, /case 'calls:accept'/);
  assert.match(server, /activeCalls/);
  assert.match(voice, /CreateVoiceChannel, 0, 0\.0/);
  assert.match(voice, /exports\('CreatePrivateChannel'/);
  assert.match(voice, /exports\('DeletePrivateChannel'/);
});
