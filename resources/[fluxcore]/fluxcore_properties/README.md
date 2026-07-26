# fluxcore_properties

Property ownership, secure purchasing, shared keys, lock state, storage, and
garage metadata. It does not require a shell, MLO, NUI, or target resource.

The included coordinates are access points that work on the base map. An
interior resource can listen for property client events and use `HasAccess`
without replacing the ownership backend.

`/properties` emits the `Fluxcore.properties.bootstrap.v1` contract. UI or target
adapters call the client `Request` export with `purchase`, `key:give`,
`key:revoke`, `lock:set`, or `storage:open`.
