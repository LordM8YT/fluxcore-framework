# Dispatch

`fluxcore_dispatch` owns emergency calls, priorities, units and call closure.

## Dependencies

`fluxcore_core`, `fluxcore_jobs`, `fluxcore_services`

## Configuration

Configure dispatch behavior in `fluxcore_dispatch/config/dispatch.json`.

## Server security

Call coordinates come from the server-side player ped. Only matching on-duty staff can view or manage calls. The server validates assignment and closure.

## Client integration

Open with `/dispatch` or `fluxcore_dispatch:client:open`. Updates emit `fluxcore_dispatch:client:updated`.

Any frontend calls the client `Request` export. Supported methods are `bootstrap`, `call:create`, `call:assign`, `call:unassign` and `call:close`. The frontend remains replaceable.

## Server exports

* `CreateCall`
* `GetCall`
* `GetDispatch`
* `AssignUnit`
* `UnassignUnit`
* `CloseCall`

## Commands

* `/911 [police|ambulance] [message]`
* `/dispatch`
