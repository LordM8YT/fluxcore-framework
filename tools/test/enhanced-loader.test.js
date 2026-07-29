'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const resourceRoot = path.join(root, 'resources', '[fluxcore]');

const nodeResources = fs
  .readdirSync(resourceRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((resourceName) => {
    const manifestPath = path.join(
      resourceRoot,
      resourceName,
      'fxmanifest.lua',
    );
    return (
      fs.existsSync(manifestPath) &&
      /^node_version '26'$/mu.test(fs.readFileSync(manifestPath, 'utf8'))
    );
  })
  .sort();

test('Enhanced Node resources enter CommonJS through a root loader', () => {
  for (const resourceName of nodeResources) {
    const resourcePath = path.join(resourceRoot, resourceName);
    const manifest = fs.readFileSync(
      path.join(resourcePath, 'fxmanifest.lua'),
      'utf8',
    );
    const loader = fs.readFileSync(path.join(resourcePath, 'server.js'), 'utf8');

    assert.match(manifest, /^node_version '26'$/mu, resourceName);
    assert.match(manifest, /^server_script 'server\.js'$/mu, resourceName);
    assert.doesNotMatch(
      manifest,
      /^server_script 'server\/main\.js'$/mu,
      resourceName,
    );
    assert.equal(loader, "'use strict';\n\nrequire('./server/main');\n");
  }
});

test('CommonJS modules call the Cfx export registrar explicitly', () => {
  for (const resourceName of nodeResources) {
    const main = fs.readFileSync(
      path.join(resourceRoot, resourceName, 'server', 'main.js'),
      'utf8',
    );

    assert.doesNotMatch(main, /(^|[^.\w])exports(?:\.|\()/mu, resourceName);
    assert.match(main, /globalThis\.exports\(/u, resourceName);
  }
});

test('Enhanced Node resources use the stable Fluxcore player-list API', () => {
  for (const resourceName of nodeResources) {
    const main = fs.readFileSync(
      path.join(resourceRoot, resourceName, 'server', 'main.js'),
      'utf8',
    );

    assert.doesNotMatch(main, /(^|[^.\w])GetPlayers\(/mu, resourceName);
  }
});

test('client RPC accepts serialized Cfx callback references', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_core', 'client', 'main.lua'),
    'utf8',
  );

  assert.match(client, /local function isCallable\(value\)/u);
  assert.match(client, /rawget\(metatable, '__call'\)/u);
  assert.match(
    client,
    /assert\(isCallable\(callback\), 'callback must be callable'\)/u,
  );
  assert.doesNotMatch(client, /type\(callback\) == 'function'/u);
});

test('client spawning delegates player creation to the Cfx spawnmanager', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_core', 'client', 'main.lua'),
    'utf8',
  );

  assert.match(client, /exports\.spawnmanager:spawnPlayer\(\{/u);
  assert.match(client, /local function nativeTrue\(value\)/u);
  assert.match(client, /return value == true or value == 1/u);
  assert.match(client, /shutdownLoadingScreens\(\)\s*DoScreenFadeIn\(500\)/u);
  assert.match(client, /GetResourceState\('spawnmanager'\) ~= 'started'/u);
  assert.doesNotMatch(client, /SetPlayerModel\(/u);
  assert.doesNotMatch(client, /NetworkResurrectLocalPlayer\(/u);
  assert.match(client, /SetPlayerControl\(PlayerId\(\), true, false\)/u);
  assert.match(client, /RenderScriptCams\(false, false, 0, true, true\)/u);
  assert.match(client, /TriggerServerEvent\('fluxcore:server:spawnDiagnostics'/u);
  assert.match(client, /DoScreenFadeIn\(500\)/u);
  assert.match(client, /ShutdownLoadingScreen\(\)/u);
  assert.match(client, /ShutdownLoadingScreenNui\(\)/u);
  assert.match(client, /SetTimeout\(15000,/u);
  assert.match(
    client,
    /if response\.ok and response\.data then[\s\n]*loadPlayer\(response\.data\)/u,
  );
});

test('Fluxcore NUI pages keep the Enhanced CEF canvas transparent before CSS loads', () => {
  for (const resourceName of [
    'fluxcore_identity',
    'fluxcore_appearance',
    'fluxcore_admin',
    'fluxcore_phone',
    'fluxcore_interact',
  ]) {
    const page = fs.readFileSync(
      path.join(resourceRoot, resourceName, 'web', 'index.html'),
      'utf8',
    );
    const styles = fs.readFileSync(
      path.join(resourceRoot, resourceName, 'web', 'styles.css'),
      'utf8',
    );

    assert.match(
      styles,
      /html,\s*body(?:,\s*#app)?\s*\{[^}]*(?:background:\s*none|background-color:\s*(?:transparent|rgba\(0,\s*0,\s*0,\s*0\)))\s*!important;/u,
      resourceName,
    );
    assert.match(
      page,
      /<style>html,body(?:,#app)?\{background:(?:transparent|none)!important/u,
      `${resourceName} must make the initial CEF document transparent`,
    );
    assert.doesNotMatch(page, /<meta\s+name="color-scheme"/u, resourceName);
  }
});

test('interactive NUI shells never paint an opaque fullscreen layer', () => {
  const identity = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_identity', 'web', 'styles.css'),
    'utf8',
  );
  const phone = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_phone', 'web', 'styles.css'),
    'utf8',
  );
  const interact = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_interact', 'web', 'styles.css'),
    'utf8',
  );

  assert.match(identity, /\.app\s*\{[\s\S]*?position:\s*fixed;/u);
  assert.match(identity, /\.app\s*\{[\s\S]*?width:\s*min\(1040px,/u);
  assert.match(identity, /\.app\s*\{[\s\S]*?height:\s*min\(640px,/u);
  assert.doesNotMatch(
    identity,
    /\.app\s*\{[^}]*min-height:\s*100vh/u,
    'identity may be opaque only inside a bounded window',
  );
  assert.match(
    phone,
    /\.app\s*\{[\s\S]*?background:\s*transparent;/u,
    'phone root must not shade the game viewport',
  );
  assert.doesNotMatch(
    interact,
    /color-scheme:\s*dark/u,
    'interaction NUI may not ask CEF to paint a dark document canvas',
  );
  assert.match(
    interact,
    /html,\s*[\r\n]+body,\s*[\r\n]+#app\s*\{[\s\S]*?background:\s*none\s*!important;/u,
    'interaction viewport must remain fully transparent',
  );
});

test('identity closes its NUI before handling the spawn request', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_identity', 'client.lua'),
    'utf8',
  );

  assert.match(client, /local function releaseNuiFocus\(\)/u);
  assert.match(client, /SetNuiFocusKeepInput\(false\)/u);
  assert.match(
    client,
    /AddEventHandler\('fluxcore_identity:client:spawnRequested',[\s\S]*?closeMenu\(\)[\s\S]*?exports\.fluxcore_core:SpawnAt/u,
  );
});

test('identity owns cursor focus after shutting down the manual loading screen', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_identity', 'client.lua'),
    'utf8',
  );

  assert.match(client, /local function shutdownLoadingScreens\(\)/u);
  assert.match(client, /ShutdownLoadingScreenNui\(\)/u);
  assert.match(
    client,
    /shutdownLoadingScreens\(\)[\s\S]*SetNuiFocus\(true,\s*true\)[\s\S]*SetCursorLocation\(0\.5,\s*0\.5\)[\s\S]*identity:open/u,
  );
});

test('identity isolates character selection in a scripted preview scene', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_identity', 'client.lua'),
    'utf8',
  );
  const config = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_identity', 'config.lua'),
    'utf8',
  );

  assert.match(config, /preview\s*=\s*\{/u);
  assert.match(client, /CreateCam\('DEFAULT_SCRIPTED_CAMERA'/u);
  assert.match(client, /RenderScriptCams\(true/u);
  assert.match(client, /HideHudAndRadarThisFrame/u);
  assert.match(client, /SetPlayerControl\(PlayerId\(\), false/u);
  assert.match(
    client,
    /spawnRequested[\s\S]*DoScreenFadeOut[\s\S]*SpawnAt/u,
  );
  assert.match(
    client,
    /onResourceStop[\s\S]*leavePreview\(true\)[\s\S]*DoScreenFadeIn/u,
  );
});

test('identity owns the production character-switch commands', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_identity', 'client.lua'),
    'utf8',
  );

  assert.match(client, /RegisterCommand\('characters'/u);
  assert.match(client, /RegisterCommand\('logout'/u);
  assert.match(client, /CallAsync\('session:logout'/u);
  assert.match(
    client,
    /Fluxcore:client:playerLoggedOut[\s\S]*SetTimeout\(250,\s*openMenu\)/u,
  );
  assert.match(
    client,
    /if exports\.fluxcore_core:IsLoggedIn\(\) then[\s\S]*DoScreenFadeIn\(0\)[\s\S]*return/u,
  );
});

test('inventory owns TAB and suppresses the GTA weapon wheel', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_inventory', 'client', 'main.lua'),
    'utf8',
  );

  assert.match(client, /RegisterCommand\('\+fluxcore_inventory'/u);
  assert.match(client, /RegisterCommand\('-fluxcore_inventory'/u);
  assert.match(
    client,
    /RegisterKeyMapping\([\s\S]*?'\+fluxcore_inventory'[\s\S]*?'TAB'/u,
  );
  assert.match(client, /DisableControlAction\(0,\s*37,\s*true\)/u);
  assert.match(client, /DisableControlAction\(1,\s*37,\s*true\)/u);
  assert.match(client, /DisableControlAction\(2,\s*37,\s*true\)/u);
  assert.match(client, /BlockWeaponWheelThisFrame\(\)/u);
  assert.match(client, /HideHudComponentThisFrame\(19\)/u);
  assert.match(client, /\+fluxcore_hotbar_%d/u);
  assert.match(client, /fluxcore_inventory:client:equipWeapon/u);
  assert.match(client, /fluxcore_inventory:client:addWeaponAmmo/u);
  assert.match(client, /RemoveWeaponFromPed/u);
});

test('vehicle engine control is mapped and server-authoritative', () => {
  const root = path.join(resourceRoot, 'fluxcore_vehicles');
  const client = fs.readFileSync(path.join(root, 'client', 'main.lua'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server', 'main.js'), 'utf8');

  assert.match(client, /RegisterKeyMapping\([\s\S]*'\+fluxcore_engine'[\s\S]*'G'/u);
  assert.match(client, /RegisterCommand\('engine',\s*toggleEngine/u);
  assert.match(client, /GetPedInVehicleSeat\(vehicle,\s*-1\) ~= ped/u);
  assert.match(client, /fluxcore_vehicles:server:toggleEngine/u);
  assert.match(client, /SetVehicleEngineOn\(vehicle,\s*enabled == true/u);
  assert.match(server, /GetPedInVehicleSeat\(entity,\s*-1\)/u);
  assert.match(server, /prepareEntityAccess\(/u);
  assert.match(server, /state\.set\('Fluxcore:engineOn',\s*enabled,\s*true\)/u);
});

test('vehicle seatbelt is mapped, blocks exit, and feeds the HUD state', () => {
  const vehicles = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_vehicles', 'client', 'main.lua'),
    'utf8',
  );
  const status = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_status', 'client', 'main.lua'),
    'utf8',
  );

  assert.match(vehicles, /RegisterKeyMapping\([\s\S]*'\+fluxcore_seatbelt'[\s\S]*'B'/u);
  assert.match(vehicles, /LocalPlayer\.state:set\('Fluxcore:seatbelt'/u);
  assert.match(vehicles, /DisableControlAction\(0,\s*75,\s*true\)/u);
  assert.match(vehicles, /IsEntityDead\(ped\)/u);
  assert.match(status, /LocalPlayer\.state\['Fluxcore:seatbelt'\] == true/u);
});

test('status replaces the vanilla HUD with a vehicle-only RP minimap', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_status', 'client', 'main.lua'),
    'utf8',
  );

  assert.match(client, /SetMinimapComponentPosition\(/u);
  assert.match(client, /SETUP_HEALTH_ARMOUR/u);
  assert.match(client, /DisplayHud\(false\)/u);
  assert.match(client, /SetRadarBigmapEnabled\(true,\s*false\)/u);
  assert.match(
    client,
    /DisplayRadar\([\s\S]*?clientConfig\.minimapVehicleOnly[\s\S]*?hudSnapshot\.vehicle ~= nil[\s\S]*?\)/u,
  );
  assert.match(client, /HideHudComponentThisFrame\(component\)/u);
  assert.match(client, /RegisterCommand\('hud'/u);
  assert.match(client, /hud = not hudHidden/u);
  assert.match(
    client,
    /Fluxcore:client:playerLoggedOut[\s\S]*hudHidden = false/u,
  );
  assert.match(
    client,
    /HideHudComponentThisFrame\(component\)[\s\S]*if hudSnapshot then/u,
  );
  assert.match(
    client,
    /onClientResourceStop[\s\S]*DisplayRadar\(true\)[\s\S]*SetRadarBigmapEnabled\(false,\s*false\)/u,
  );
});

test('status disables GTA wanted levels and ambient police dispatch', () => {
  const client = fs.readFileSync(
    path.join(resourceRoot, 'fluxcore_status', 'client', 'main.lua'),
    'utf8',
  );

  assert.match(client, /SetMaxWantedLevel\(0\)/u);
  assert.match(client, /SetPoliceIgnorePlayer\(player,\s*true\)/u);
  assert.match(client, /SetDispatchCopsForPlayer\(player,\s*false\)/u);
  assert.match(client, /EnableDispatchService\(service,\s*false\)/u);
  assert.match(client, /ClearPlayerWantedLevel\(player\)/u);
  assert.match(client, /nextEnforcementAt = GetGameTimer\(\) \+ 5000/u);
  assert.match(
    client,
    /if GetGameTimer\(\) >= nextEnforcementAt then[\s\S]*disableVanillaPolice\(\)/u,
  );
  assert.match(client, /onClientResourceStop[\s\S]*restoreVanillaPolice\(\)/u);
});

test('status removes the vanilla radio and minimap health armour bars', () => {
  const root = path.join(resourceRoot, 'fluxcore_status');
  const client = fs.readFileSync(path.join(root, 'client', 'main.lua'), 'utf8');
  const config = JSON.parse(
    fs.readFileSync(path.join(root, 'config', 'status.json'), 'utf8'),
  );

  assert.equal(config.disableVanillaRadio, true);
  assert.match(client, /SETUP_HEALTH_ARMOUR/u);
  assert.match(client, /ScaleformMovieMethodAddParamInt\(3\)/u);
  assert.match(client, /GetGameTimer\(\) - minimapBarsHiddenAt >= 1000/u);
  assert.match(client, /SetUserRadioControlEnabled\(false\)/u);
  assert.match(client, /SetFrontendRadioActive\(false\)/u);
  assert.match(client, /SetVehicleRadioEnabled\(vehicle,\s*false\)/u);
  assert.match(client, /SetVehRadioStation\(vehicle,\s*'OFF'\)/u);
  assert.match(client, /DisableControlAction\(0,\s*85,\s*true\)/u);
});

test('status HUD renders native sprint stamina as a separate live value', () => {
  const root = path.join(resourceRoot, 'fluxcore_status');
  const client = fs.readFileSync(path.join(root, 'client', 'main.lua'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'web', 'app.js'), 'utf8');

  assert.match(
    client,
    /100\s*-\s*rounded\(GetPlayerSprintStaminaRemaining\(PlayerId\(\)\)\)/u,
  );
  assert.match(client, /stamina = stamina/u);
  assert.match(page, /id="stamina">100</u);
  assert.match(app, /'thirst', 'stamina', 'stress'/u);
});

test('status HUD recovers optional voice state across resource restarts', () => {
  const root = path.join(resourceRoot, 'fluxcore_status');
  const client = fs.readFileSync(path.join(root, 'client', 'main.lua'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'web', 'app.js'), 'utf8');

  assert.match(client, /fluxcore_voice:client:stateChanged/u);
  assert.match(client, /GetResourceState\('fluxcore_voice'\) ~= 'started'/u);
  assert.match(client, /exports\.fluxcore_voice:GetVoiceState\(\)/u);
  assert.match(client, /onClientResourceStart[\s\S]*refreshVoiceState\(\)/u);
  assert.match(client, /onClientResourceStop[\s\S]*stoppedResource == 'fluxcore_voice'/u);
  assert.match(page, /id="voice-item"/u);
  assert.match(app, /voice\.talking === true/u);
});

test('appearance provides a bounded live-preview creator with safe cleanup', () => {
  const root = path.join(resourceRoot, 'fluxcore_appearance');
  const manifest = fs.readFileSync(path.join(root, 'fxmanifest.lua'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'client', 'main.lua'), 'utf8');

  assert.match(manifest, /ui_page 'web\/index\.html'/u);
  assert.match(client, /RegisterNUICallback\('appearancePreview'/u);
  assert.match(client, /RegisterNUICallback\('appearanceSave'/u);
  assert.match(client, /CreateCam\('DEFAULT_SCRIPTED_CAMERA'/u);
  assert.match(client, /DisableAllControlActions\(0\)/u);
  assert.match(client, /onResourceStop[\s\S]*closeEditor\(true\)/u);
});

test('loading screen follows the Cfx progress and manual-shutdown contract', () => {
  const root = path.join(resourceRoot, 'fluxcore_loading');
  const manifest = fs.readFileSync(path.join(root, 'fxmanifest.lua'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'web', 'app.js'), 'utf8');

  assert.match(manifest, /loadscreen 'web\/index\.html'/u);
  assert.match(manifest, /loadscreen_manual_shutdown 'yes'/u);
  assert.match(app, /eventName === 'loadProgress'/u);
  assert.match(app, /loadFraction/u);
});

test('cross-resource client lifecycle handlers are network-safe', () => {
  const consumers = {
    fluxcore_identity: ['Fluxcore:client:playerLoggedOut'],
  };

  for (const [resourceName, eventNames] of Object.entries(consumers)) {
    const client = fs.readFileSync(
      path.join(resourceRoot, resourceName, 'client.lua'),
      'utf8',
    );

    for (const eventName of eventNames) {
      assert.match(
        client,
        new RegExp(`RegisterNetEvent\\('${eventName.replace(':', '\\:')}'`),
        `${resourceName}: ${eventName}`,
      );
    }
  }
});

test('replacement chat owns mapped input and supports RP commands', () => {
  const root = path.join(resourceRoot, 'fluxcore_chat');
  const manifest = fs.readFileSync(path.join(root, 'fxmanifest.lua'), 'utf8');
  const client = fs.readFileSync(path.join(root, 'client', 'main.lua'), 'utf8');
  const server = fs.readFileSync(path.join(root, 'server.lua'), 'utf8');
  const page = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'web', 'app.js'), 'utf8');

  assert.match(manifest, /ui_page 'web\/index\.html'/u);
  assert.match(client, /RegisterKeyMapping\('fluxcore_chat_open'/u);
  assert.match(client, /RegisterCommand\('me'/u);
  assert.match(client, /RegisterCommand\('do'/u);
  assert.match(client, /RegisterCommand\('ooc'/u);
  assert.match(client, /\{ 'try', 'whisper', 'shout' \}/u);
  assert.match(client, /RegisterCommand\('e'/u);
  assert.match(client, /RegisterCommand\('controls'/u);
  assert.match(client, /RegisterKeyMapping\(\s*'\+fluxcore_cancel_emote'/u);
  assert.match(client, /IsEntityDead\(ped\)/u);
  assert.match(client, /IsPedInAnyVehicle\(ped,\s*false\)/u);
  assert.match(client, /AddEventHandler\('chat:addMessage'/u);
  assert.match(client, /AddEventHandler\('chat:addSuggestions'/u);
  assert.match(client, /local hasAuthor = args\[2\] ~= nil/u);
  assert.match(client, /ExecuteCommand\(text:sub\(2\)\)/u);
  assert.match(client, /GetPlayerFromServerId\(bubble\.serverId\)/u);
  assert.match(client, /pcall\(utf8\.offset, text, 121\)/u);
  assert.match(client, /offsets\[bubble\.serverId\]/u);
  assert.match(
    client,
    /Fluxcore:client:playerLoggedOut[\s\S]*roleplayBubbles = \{\}[\s\S]*action = 'clear'/u,
  );
  assert.match(client, /World3dToScreen2d/u);
  assert.match(server, /RP_DISTANCE = 20\.0/u);
  assert.match(server, /WHISPER_DISTANCE = 3\.0/u);
  assert.match(server, /SHOUT_DISTANCE = 40\.0/u);
  assert.match(server, /math\.random\(0,\s*1\)/u);
  assert.match(server, /source = playerSource/u);
  assert.match(server, /pcall\(utf8\.offset,\s*text,\s*MAX_LENGTH \+ 1\)/u);
  assert.match(server, /type\(player\.profile\) ~= 'table'/u);
  assert.match(server, /GetPlayerPed\(playerSource\)/u);
  assert.match(
    server,
    /local function forgetPlayer\(playerSource\)[\s\S]*lastMessageAt\[id\] = nil[\s\S]*Fluxcore:server:playerLoggedOut', forgetPlayer/u,
  );
  assert.match(page, /background:\s*none\s*!important/u);
  assert.match(app, /event\.key === 'Tab' && currentSuggestion/u);
  assert.match(app, /setSelectionRange/u);
});
