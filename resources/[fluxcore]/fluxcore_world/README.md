# fluxcore_world

Config-driven shops, vehicle dealerships, and persistent job-managed doors.
Prices, inventory capacity, player position, permissions, and ownership are
validated by the server.

The resource has no target or NUI dependency. `/world` emits the versioned
bootstrap contract, while frontends call the client `Request` export using
`shop:buy`, `dealership:buy`, and `door:set`.

Default shop coordinates use the base map. Door and dealership definitions can
be replaced in `config/world.json` when a server adds an MLO.
