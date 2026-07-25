# nord_mdt

Police records backend for Nord Framework. It includes person search, profiles,
owned vehicles, reports, warrants, BOLOs, and the current dispatch feed.

The resource contains no fixed NUI. `/mdt` emits
`nord_mdt:client:open` with the versioned bootstrap contract. UI adapters use
the client `Request` export for searches and write operations.

Read and write access use `police.records.read` and
`police.records.write`, require the configured job permission, and require the
officer to be on duty.
