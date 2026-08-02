# Fluxcore Phone

Fluxcore Phone provides messages, contacts, a home screen, and a client-side
app registry. Other resources can add a phone app without changing
`fluxcore_phone` or `fluxcore_core`.

## Register an app

Declare `fluxcore_phone` as a dependency and include your app HTML in your own
resource packfile:

```lua
dependency 'fluxcore_phone'

files {
    'phone/index.html',
    'phone/app.js',
    'phone/styles.css'
}
```

Register from the app resource's client script. The identifier is owned by the
calling resource and cannot be replaced or removed by another resource.

```lua
local function registerPhoneApp()
    local success, errorMessage = exports.fluxcore_phone:RegisterApp({
        identifier = 'example_bank',
        name = 'Bank',
        description = 'View your accounts and recent transactions.',
        developer = 'Example Resources',
        ui = 'phone/index.html',
        icon = 'https://cfx-nui-example_bank/phone/icon.png',
        color = '#3f7cff',
        onOpen = function()
            print('Bank phone app opened')
        end,
        onClose = function()
            print('Bank phone app closed')
        end
    })

    if not success then
        print(('Could not register phone app: %s'):format(errorMessage))
    end
end

registerPhoneApp()

AddEventHandler('fluxcore_phone:client:ready', function()
    registerPhoneApp()
end)

AddEventHandler('onClientResourceStart', function(resourceName)
    if resourceName == 'fluxcore_phone' then
        registerPhoneApp()
    end
end)
```

Registration is idempotent for the same identifier and owner. Register once at
module load and again when the provider starts so the app recovers after a
`fluxcore_phone` restart. The registry automatically removes apps when their
owner resource stops.

## App UI lifecycle

The phone loads the registered page from the owner resource in a sandboxed
iframe. The app receives this browser message after its document has loaded:

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'fluxcore:phone:open') {
    const { app, resourceName, phoneNumber, localeName } = event.data;
  }
});
```

An app calls its own resource's NUI callbacks directly. It does not route
private operations through `fluxcore_phone`:

```js
const response = await fetch(`https://${GetParentResourceName()}/bankOverview`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=UTF-8' },
  body: JSON.stringify({}),
});
```

Do not send initial data from `onOpen`; the iframe may not have loaded yet.
Request initial state from the app UI after receiving `fluxcore:phone:open`.

## Push data to an open app

The owner resource can forward a structured message to its app:

```lua
exports.fluxcore_phone:SendAppMessage('example_bank', {
    type = 'balanceChanged',
    balance = 12500
})
```

Listen in the app UI:

```js
window.addEventListener('message', (event) => {
  if (event.data?.type === 'fluxcore:phone:message') {
    console.log(event.data.data);
  }
});
```

`SendAppMessage` returns `false` when the caller does not own the identifier.

## Client exports

- `RegisterApp(definition)` returns `success, errorMessage`.
- `UnregisterApp(identifier)` returns whether the caller removed its app.
- `SendAppMessage(identifier, data)` returns whether the caller owns the app.
- `GetApps()` returns the public, serializable app definitions.
- `IsOpen()` returns whether the phone currently owns NUI focus.

App pages must be relative `.htm` or `.html` paths in the registering resource.
Remote pages, absolute paths, and parent-directory traversal are rejected.
