# nord_dispatch

Server-authoritative emergency calls, service feeds, unit assignment, and call
closure. The resource intentionally has no NUI or target dependency.

Players use `/911 police message` or `/911 ambulance message`. On-duty staff can
open their dispatch adapter with `/dispatch`. UI resources should listen for
`nord_dispatch:client:open` and `nord_dispatch:client:updated`, then use the
client `Request` export for assignment and closure actions.

Server exports return `{ ok, data }` or `{ ok = false, error }`:

- `CreateCall(identifier, service, description, coordinates, options)`
- `GetCall(identifier, callId)`
- `GetDispatch(identifier)`
- `AssignUnit(identifier, callId)`
- `UnassignUnit(identifier, callId)`
- `CloseCall(identifier, callId)`
