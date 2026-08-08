# UI Contracts

Versioned contracts are the stable boundary between Fluxcore resources and their NUI frontends. A frontend may be replaced without changing the owning service.

The complete v1 set is now marked `stable` in
`contracts/ui/v1/manifest.json`. This freezes data and action meaning, not
visual design: markup, layout, icons, animation and CSS may all be replaced.

Mock payloads live in:

```
contracts/ui/v1
```

They are data boundaries for local development, not bundled interfaces.

## Rules

* Every bootstrap payload contains a `contract` field ending in `.v1`.
* NUI never accesses framework exports or databases.
* Client input is untrusted and every mutation is validated server-side.
* Private owner data is sent only to its owner.
* Additive fields may be introduced in v1.
* Consumers ignore unknown fields so additive changes remain compatible.
* Removing or changing a field requires a new contract version.
* Timestamps use UTC ISO 8601 strings.
* Weights are integer grams.
* Money uses integer game units.
* Locale dictionaries are presentation data, not trusted mutation input.

## Result envelope

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Expected failure:

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "A safe message for the player."
  }
}
```

Frontends branch on `ok` and stable error codes.

## HUD: `fluxcore.hud.bootstrap.v1`

### Window messages

| Type                      | Payload                    |
| ------------------------- | -------------------------- |
| `fluxcore:hud:bootstrap`  | complete bootstrap         |
| `fluxcore:hud:player`     | `player` object            |
| `fluxcore:hud:status`     | `status` object            |
| `fluxcore:hud:vehicle`    | `vehicle` object or `null` |
| `fluxcore:hud:visibility` | partial visibility object  |
| `fluxcore:hud:close`      | none                       |

Health and armor are observed from the local ped. Needs are owned by `fluxcore_status`; money and job data are owned by `fluxcore_core`.

## Inventory: `fluxcore.inventory.bootstrap.v1`

NUI endpoint: `inventoryRequest`.

### Methods

| Method      | Payload                                        |
| ----------- | ---------------------------------------------- |
| `bootstrap` | `{}`                                           |
| `move`      | sides, slots and amount                        |
| `split`     | side, source slot, destination slot and amount |
| `use`       | player slot                                    |
| `drop`      | player slot and amount                         |
| `transfer`  | different `from` and `to` sides                |
| `close`     | `{}`                                           |

The only accepted sides are `player` and `secondary`. The server resolves them through the active inventory session. Clients never submit a container ID.

### Window messages

* `fluxcore:inventory:open`
* `fluxcore:inventory:update`
* `fluxcore:inventory:error`
* `fluxcore:inventory:close`

## Phone: text contract v1

NUI endpoint: `phoneRequest`.

### Stable methods

* `bootstrap`
* `contacts:create`
* `contacts:update`
* `contacts:delete`
* `messages:list`
* `messages:send`

### Window messages

* `open`
* `bootstrap`
* `newMessage`
* `messagesRead`
* `close`

Voice calls and future apps receive separate versioned contracts.

## Domain bootstrap contracts

Each domain has a mock payload and a versioned bootstrap contract:

| Contract                           | Mock file                                   |
| ---------------------------------- | ------------------------------------------- |
| `fluxcore.banking.bootstrap.v1`    | `contracts/ui/v1/banking.bootstrap.json`    |
| `fluxcore.businesses.bootstrap.v1` | `contracts/ui/v1/businesses.bootstrap.json` |
| `fluxcore.services.bootstrap.v1`   | `contracts/ui/v1/services.bootstrap.json`   |
| `fluxcore.dispatch.bootstrap.v1`   | `contracts/ui/v1/dispatch.bootstrap.json`   |
| `fluxcore.mdt.bootstrap.v1`        | `contracts/ui/v1/mdt.bootstrap.json`        |
| `fluxcore.properties.bootstrap.v1` | `contracts/ui/v1/properties.bootstrap.json` |
| `fluxcore.world.bootstrap.v1`      | `contracts/ui/v1/world.bootstrap.json`      |

Every domain with a public UI contract emits a client open event and exposes a client `Request` export. Any NUI or target adapter can be replaced independently. `fluxcore_businesses` currently exposes server exports only.

## Frontend development

Mock JSON is safe for local browser development. A frontend may load it when `GetParentResourceName` is unavailable.

Production builds must:

* Use relative asset URLs.
* Keep the Enhanced CEF canvas transparent.
* Close focus before gameplay spawn transitions.
* Contain no real player data or server addresses.
* Contain no tokens, secrets or remote development endpoints.
* Route every mutation through the owning resource.

## Contract changes

{% stepper %}
{% step %}
### Update the owning resource
{% endstep %}

{% step %}
### Update its mock payload
{% endstep %}

{% step %}
### Update repository contract tests
{% endstep %}

{% step %}
### Document the field here
{% endstep %}

{% step %}
### Keep old fields working
{% endstep %}
{% endstepper %}

For a breaking change, create a new contract ID and support an explicit migration period.
