# Architecture

Fluxcore is an independent core with optional integrations at its edges. Compatibility adapters may be added later, but framework-specific objects, tables, globals and event names from other frameworks do not enter the core.

## Ownership

The main design rule is simple:

> The resource that owns data is the only resource that mutates it.

Consumers use documented exports, events and State Bags. They never write another resource's database tables.

## Runtime split

```
Client Lua
  native interaction, UI and local observation
       |
       | rate-limited RPC and owner-only snapshots
       v
fluxcore_core (Node 26)
  validation -> session service -> SQLite repository
       |                            |
       | explicit public state      | atomic wallets + ledger
       v                            v
  replicated State Bags       varde.sqlite
```

Lua handles client-native interaction. Node 26 runs server services because Enhanced ships it directly and its built-in SQLite driver gives Fluxcore durable storage without another database resource.

## Boundaries

### Database

Each resource owns migrations and SQL for its own SQLite database. Other resources use public exports.

### Service

Services own active domain state, validate operations, update persistence and publish safe snapshots.

### RPC

RPC is a small transport boundary. It validates request envelopes and payload size, rate-limits each method and maps expected failures to stable error codes. It is not a remote function executor.

### Public state

State Bags are a discovery and observation mechanism, not a player database. Only facts required by nearby resources are replicated. Private data stays on the server or is sent directly to its owning client.

### UI

NUI frontends do not access databases or framework exports. The owning client resource creates a versioned bootstrap payload, receives NUI callbacks and forwards validated mutations to its server resource.

## Data ownership

| Resource              | Owns                                                                   |
| --------------------- | ---------------------------------------------------------------------- |
| `fluxcore_core`       | accounts, characters, sessions, wallets, metadata, active job snapshot |
| `fluxcore_jobs`       | assignments, grades, duty state and permission audit                   |
| `fluxcore_inventory`  | containers, items, transfers and world drops                           |
| `fluxcore_status`     | persistent needs                                                       |
| `fluxcore_vehicles`   | owned vehicles and keys                                                |
| `fluxcore_appearance` | freemode appearance                                                    |
| `fluxcore_admin`      | administration audit                                                   |
| `fluxcore_phone`      | numbers, contacts, messages and read state                             |

## Dependency direction

Domain resources may depend on `fluxcore_core`. The core does not import optional domain resources. Integrations use public exports and return explicit `INTEGRATION_UNAVAILABLE`-style failures when an optional owner is stopped.

## Compatibility

Future Qbox, QBCore or ESX bridges must remain separate adapter resources. The native Fluxcore API stays framework-independent.
