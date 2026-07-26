# fluxcore_admin

`fluxcore_admin` is an ACE-secured operations panel for Fluxcore. Open it with
`/vadmin`. Every client request is re-authorized and validated on the server;
the NUI never has direct access to framework exports.

## Capabilities

- online Fluxcore character list
- go to / bring
- freeze / unfreeze, heal, and kick
- set cash or bank balance
- assign configured jobs and grades
- give configured inventory items
- persistent success and failure audit records

The integrations call Fluxcore's public server exports. `fluxcore_jobs` or
`fluxcore_inventory` can be stopped, but their respective actions will return an
explicit integration error.

## ACE permissions

`Fluxcore.admin` is the root permission and grants every panel capability.
Granular permissions are:

- `Fluxcore.admin.open`
- `Fluxcore.admin.players`
- `Fluxcore.admin.teleport`
- `Fluxcore.admin.moderation`
- `Fluxcore.admin.economy`
- `Fluxcore.admin.jobs`
- `Fluxcore.admin.inventory`
- `Fluxcore.admin.audit`

Example:

```cfg
add_ace group.admin Fluxcore.admin allow

# A support role with only player visibility and teleport:
add_ace group.support Fluxcore.admin.open allow
add_ace group.support Fluxcore.admin.players allow
add_ace group.support Fluxcore.admin.teleport allow
```

FiveM principals still need to be assigned to these groups in the server's
access-control configuration.

## Audit and privacy

Actions record actor and target source/character IDs, action name, outcome,
bounded action details, and timestamp in `data/admin.sqlite`. Free-form item
metadata is not copied into the admin audit. The default retention window is
180 days and old records are pruned when the resource starts.
