# Fluxcore adapter for multi-framework resources

Copy the `fluxcore` directory into the resource's existing framework or bridge
directory. Load `fluxcore/client.lua` and `fluxcore/server.lua` when the
configured framework is `Fluxcore`, and declare `dependency 'fluxcore_bridge'`.

The files implement `fluxcore.resource-bridge.v1`. Rename the three generic
`bridge:client:*` lifecycle events to the resource's own namespace before
publishing.

The adapter does not emulate QBCore, Qbox or ESX. It maps the resource's small
framework-neutral surface directly to stable Fluxcore exports.
