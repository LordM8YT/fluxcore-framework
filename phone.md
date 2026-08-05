# Phone

`fluxcore_phone` provides persistent phone numbers, contacts, offline text
messages, private voice calls, the anonymous-facing Cipher community, and an
extensible client-side app registry. Other resources can add apps without
changing the phone resource or `fluxcore_core`.

## Player use

Open the phone with `F1` or `/phone`. The bundled apps include Phone, Messages,
Contacts, Clock, Notes, Calculator, Cipher and Settings. Phone numbers belong
to accounts and remain stable across sessions. Messages can be delivered while
the recipient is offline.

The Phone app supports outgoing and incoming calls, busy state, accept,
decline and hang-up. Connected calls use non-spatial, server-owned Enhanced
voice channels. Both participants must be online and have a phone account.

### Cipher

Cipher is a crime-community surface inspired by channel-based chat systems. It
does not use or display phone numbers. Each character receives a persistent
random alias such as `ghost-a3f91c` and can use configured text channels and
their associated voice rooms.

Cipher is pseudonymous to players, not untraceable infrastructure. The server
stores the character-to-alias relationship so ownership, moderation and data
cleanup remain enforceable. Cipher messages expose only alias, channel, body
and timestamp to the client.

Default channels are `Lobby`, `Black Market` and `Operations`. Configure them
in `config/phone.json`:

```json
{
  "cipherChannels": [
    { "id": "lobby", "name": "Lobby" },
    { "id": "market", "name": "Black Market" },
    { "id": "ops", "name": "Operations" }
  ]
}
```

Channel IDs use 2-24 lowercase letters, numbers, `_` or `-`. Changing the list
does not delete existing history, but removed channels are no longer exposed.

## Dependencies and start order

Start core and voice before the phone, then start app resources after it:

```cfg
ensure fluxcore_core
ensure fluxcore_voice
ensure fluxcore_phone
ensure example_phone_app
```

App resources must also declare the dependency in `fxmanifest.lua`:

```lua
dependency 'fluxcore_phone'

files {
    'phone/index.html',
    'phone/app.js',
    'phone/styles.css',
    'phone/icon.png'
}
```

## Create a phone app

Register the app from the owning resource's client script. Identifiers are
owned by the calling resource, so another resource cannot replace, remove, or
send data to the app.

```lua
local function registerPhoneApp()
    local success, errorMessage = exports.fluxcore_phone:RegisterApp({
        identifier = 'example_bank',
        name = 'Bank',
        description = 'View accounts and recent transactions.',
        developer = 'Example Resources',
        ui = 'phone/index.html',
        icon = 'https://cfx-nui-example_phone_app/phone/icon.png',
        color = '#3f7cff',
        onOpen = function()
            print('Bank app opened')
        end,
        onClose = function()
            print('Bank app closed')
        end
    })

    if not success then
        print(('Could not register phone app: %s'):format(errorMessage))
    end
end

registerPhoneApp()

AddEventHandler('fluxcore_phone:client:ready', registerPhoneApp)

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName == 'fluxcore_phone' then
        registerPhoneApp()
    end
end)
```

Registration is idempotent for the same identifier and owner. Register at
module load and again when the provider becomes ready so the app recovers from
a `fluxcore_phone` restart. The registry automatically removes registrations
when their owner resource stops.

### App definition

| Field | Required | Rules |
| --- | --- | --- |
| `identifier` | yes | 2-48 lowercase letters, numbers, `_`, or `-` |
| `name` | yes | 1-32 characters |
| `ui` | yes | relative `.htm` or `.html` path owned by the app resource |
| `description` | no | up to 120 characters |
| `developer` | no | up to 32 characters |
| `icon` | no | image URL, normally a `https://cfx-nui-...` resource URL |
| `color` | no | app accent color |
| `onOpen` | no | client callback when the app opens |
| `onClose` | no | client callback when the app closes |

Remote UI pages, absolute paths, and parent-directory traversal are rejected.

## App UI lifecycle

The phone loads the registered page in a sandboxed iframe. After the document
loads, it receives an open message:

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'fluxcore:phone:open') {
    const { app, resourceName, phoneNumber, localeName } = event.data;
    loadOverview(phoneNumber);
  }
});
```

Do not send initial UI data from the Lua `onOpen` callback because the iframe
may still be loading. Let the page request its initial state after receiving
`fluxcore:phone:open`.

The app calls NUI callbacks in its own resource directly:

```js
const response = await fetch(
  `https://${GetParentResourceName()}/bankOverview`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({}),
  },
);

const result = await response.json();
```

Always invoke the NUI callback response function on every code path so the
browser request cannot remain pending.

## Push data to an open app

The owner resource can forward JSON-serializable data to its app:

```lua
exports.fluxcore_phone:SendAppMessage('example_bank', {
    type = 'balanceChanged',
    balance = 12500
})
```

Listen for it inside the app page:

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'fluxcore:phone:message') {
    updateBalance(event.data.data.balance);
  }
});
```

`SendAppMessage` returns `false` if the caller does not own the identifier or
the app is not available.

## Client exports

| Export | Result |
| --- | --- |
| `RegisterApp(definition)` | `success, errorMessage` |
| `UnregisterApp(identifier)` | whether the caller removed its own app |
| `SendAppMessage(identifier, data)` | whether data was accepted for the caller's app |
| `GetApps()` | serializable public app definitions |
| `IsOpen()` | whether the phone currently owns NUI focus |

## Server exports

```lua
local number = exports.fluxcore_phone:GetPhoneNumber(source)

local result = exports.fluxcore_phone:SendMessage(
    source,
    recipientNumber,
    'Your vehicle is ready.'
)
```

Server-side exports return Fluxcore's standard `{ ok, data }` or
`{ ok, error }` envelope where applicable. Phone data remains owner-only, and
client input never authorizes access to another account's contacts or message
history.

## Development checklist

1. Keep the app page transparent from its first inline style.
2. Package every HTML, CSS, JavaScript, and image asset in the owner resource.
3. Register at module load and again after `fluxcore_phone` starts.
4. Keep private operations in the app resource's own NUI callbacks.
5. Validate permissions and mutations on the server.
6. Stop the app resource and confirm its registration disappears.
7. Restart `fluxcore_phone` and confirm the app registers again.
8. Test opening, closing, focus release, and Escape in the Enhanced client.
9. Test calls with two clients and confirm the private channel is removed on
   hang-up and disconnect.
10. Confirm Cipher never renders a phone number and that leaving a VC removes
    the player from the managed voice channel.

## Database migration and backup

Cipher upgrades `data/phone.sqlite` to schema version 2 and adds
`cipher_profiles` and `cipher_messages`. The migration preserves existing
numbers, contacts and SMS history. Stop the server and copy the SQLite file
plus any `-wal` and `-shm` companions before first startup on this version.

See [UI Contracts](ui-contracts.md) and the
[Enhanced compatibility notes](docs/fivem-enhanced-compatibility.md) for the
shared NUI requirements.
