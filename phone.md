# Phone

`fluxcore_phone` provides persistent phone numbers, contacts, offline text
messages, unread state, read receipts, and an extensible client-side app
registry. Other resources can add apps without changing the phone resource or
`fluxcore_core`.

## Player use

Open the phone with `F1` or `/phone`. The default apps provide contacts and
messages. Phone numbers belong to accounts and remain stable across sessions.
Messages can be delivered while the recipient is offline.

Voice calls are not part of the current phone milestone.

## Dependencies and start order

Start the core before the phone and start app resources after the phone:

```cfg
ensure fluxcore_core
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

See [UI Contracts](ui-contracts.md) and the
[Enhanced compatibility notes](docs/fivem-enhanced-compatibility.md) for the
shared NUI requirements.
