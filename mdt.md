# MDT

`fluxcore_mdt` provides police people search, vehicle lookup, reports, warrants, BOLOs and a dispatch feed.

## Dependencies

`fluxcore_core`, `fluxcore_jobs`, `fluxcore_vehicles`, `fluxcore_dispatch`

## Configuration

Configure MDT rules in `fluxcore_mdt/config/mdt.json`.

## Server security

Reads require `police.records.read`. Writes require `police.records.write`. Reports, warrants and BOLOs persist in SQLite. The server authorizes every query and mutation.

## Client integration

Open with `/mdt` or `fluxcore_mdt:client:open`.

Any frontend calls the client `Request` export. Supported methods are `bootstrap`, `people:search`, `profile:get`, `report:create`, `warrant:create`, `warrant:close`, `bolo:create` and `bolo:close`. The frontend remains replaceable.

## Server exports

* `GetDashboard`
* `SearchPeople`
* `GetProfile`
* `CreateReport`
* `CreateWarrant`
* `CreateBolo`

## Commands

* `/mdt`
