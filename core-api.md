# Core API

`fluxcore_core` owns accounts, characters, online sessions, wallets, metadata, active job snapshots and last known positions.

## Result envelope

High-level client calls and every server mutation return:

```lua
{ ok = true, data = ... }
```

or:

```lua
{
    ok = false,
    error = {
        code = 'ERROR_CODE',
        message = 'Human-readable description'
    }
}
```

## Client exports

### Character and session

```lua
local response = exports.fluxcore_core:ListCharacters()
local response = exports.fluxcore_core:GetCharacterBootstrap()

local response = exports.fluxcore_core:CreateCharacter({
    slot = 1,
    firstName = 'Kari',
    lastName = 'Hansen',
    birthDate = '1995-06-15',
    gender = 'unspecified',
    nationality = 'Norwegian'
})

local response = exports.fluxcore_core:SelectCharacter(
    'flx_0123456789abcdef'
)

local response = exports.fluxcore_core:DeleteCharacter(
    'flx_0123456789abcdef'
)

local response = exports.fluxcore_core:Logout()
```

### Local player cache

```lua
local playerData = exports.fluxcore_core:GetPlayerData()
local loggedIn = exports.fluxcore_core:IsLoggedIn()
```

`GetPlayerData()` returns a safe copy or `nil`.

### Spawn

```lua
exports.fluxcore_core:SpawnAt({
    x = 215.76,
    y = -810.12,
    z = 30.73,
    heading = 157.0
})
```

### Locale

```lua
local text = exports.fluxcore_core:Locale(
    'jobs.noJobs',
    nil,
    'No jobs are assigned.'
)

local localeName = exports.fluxcore_core:GetLocale()
local translations = exports.fluxcore_core:GetLocaleData('identity')
```

See [Localization](localization.md).

### Generic RPC

```lua
local response = exports.fluxcore_core:Call('characters:list', {})

exports.fluxcore_core:CallAsync('characters:list', {}, function(response)
    if response.ok then
        print(json.encode(response.data))
    end
end)
```

The generic RPC only exposes methods registered by core.

## Server exports

An identifier may be an online server ID or online Fluxcore character ID.

### Read players

```lua
local player = exports.fluxcore_core:GetPlayer(source)
local sameSnapshot = exports.fluxcore_core:GetPlayerData(source)
local character = exports.fluxcore_core:GetCharacterData(identifier)
local players = exports.fluxcore_core:GetPlayers()
local source = exports.fluxcore_core:GetPlayerSource(characterId)
```

`GetPlayer()` and `GetPlayerData()` return detached snapshots. Editing them never mutates core state.

### Delete a logged-out character

```lua
local result = exports.fluxcore_core:DeleteCharacter(
    source,
    characterId,
    characterId
)
```

Deletion requires ownership, a logged-out session and exact confirmation.

### Wallets

```lua
local result = exports.fluxcore_core:AddMoney(
    source,
    'cash',
    250,
    'delivery_payment',
    'delivery:841'
)

local result = exports.fluxcore_core:RemoveMoney(
    source,
    'bank',
    100,
    'invoice_payment',
    'invoice:95'
)

local result = exports.fluxcore_core:SetMoney(
    source,
    'cash',
    500,
    'admin_correction',
    'ticket:12'
)
```

Currencies are `cash` and `bank`. Amounts are non-negative integer game units. Every change records the invoking resource, reason and reference in the ledger.

### Money ledger and transfers

```lua
local balance = exports.fluxcore_core:GetMoney(identifier, 'bank')
local ledger = exports.fluxcore_core:GetMoneyLedger(identifier)
local result = exports.fluxcore_core:MoveMoney(identifier, 'cash', 'bank', 100, 'deposit')
local result = exports.fluxcore_core:TransferMoney(identifier, recipientIdentifier, 'bank', 100, 'transfer')
```

`MoveMoney` and `TransferMoney` return the standard result envelope.

### Metadata

```lua
local result = exports.fluxcore_core:SetMetadata(
    source,
    'licenses.driving',
    {
        granted = true,
        issuedAt = os.time()
    }
)
```

Metadata is private owner data. Keep keys and values bounded.

### Active job snapshot

```lua
local result = exports.fluxcore_core:SetJob(source, {
    name = 'police',
    label = 'Police',
    type = 'leo',
    grade = 1,
    gradeLabel = 'Officer',
    payment = 750,
    onDuty = false
})
```

Persistent assignments are owned by `fluxcore_jobs`. Use its exports for normal job management.

### Save

```lua
local result = exports.fluxcore_core:SavePlayer(source)
```

Autosave runs on the configured interval. Explicit save is useful before a trusted transition.

## Events

### Client network events

```lua
RegisterNetEvent('fluxcore:client:playerLoaded', function(playerData)
end)

RegisterNetEvent('fluxcore:client:playerUpdated', function(playerData)
end)

RegisterNetEvent('fluxcore:client:playerLoggedOut', function()
end)
```

These originate on the server, so consuming client resources must register them with `RegisterNetEvent`.

### Local server events

* `fluxcore:server:playerLoaded(source, playerData)`
* `fluxcore:server:playerLoggedOut(source, characterId)`
* `fluxcore:server:playerDropped(source, characterId)`
* `fluxcore:server:characterDeleted(source, characterId)`
* `fluxcore:server:jobUpdated(source, job)`

These are local server events. Clients cannot invoke them over the network.

## Player snapshot

```
characterId
slot
profile
  firstName
  lastName
  birthDate
  gender
  nationality
job
  name
  label
  type
  grade
  gradeLabel
  payment
  onDuty
position
  x
  y
  z
  heading
money
  cash
  bank
metadata
createdAt
updatedAt
```

## Public State Bags

* `fluxcore:loaded`
* `fluxcore:characterId`
* `fluxcore:job`

Wallets, profiles, positions and metadata are never replicated publicly. See [State Bags and Events](state-bags-and-events.md).
