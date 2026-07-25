# nord_admin

`nord_admin` is an ACE-secured operations panel for Nord. Open it with
`/vadmin`. Every client request is re-authorized and validated on the server;
the NUI never has direct access to framework exports.

## Capabilities

- online Nord character list
- go to / bring
- freeze / unfreeze, heal, and kick
- set cash or bank balance
- assign configured jobs and grades
- give configured inventory items
- persistent success and failure audit records

The integrations call Nord's public server exports. `nord_jobs` or
`nord_inventory` can be stopped, but their respective actions will return an
explicit integration error.

## ACE permissions

`Nord.admin` is the root permission and grants every panel capability.
Granular permissions are:

- `Nord.admin.open`
- `Nord.admin.players`
- `Nord.admin.teleport`
- `Nord.admin.moderation`
- `Nord.admin.economy`
- `Nord.admin.jobs`
- `Nord.admin.inventory`
- `Nord.admin.audit`

Example:

```cfg
add_ace group.admin Nord.admin allow

# A support role with only player visibility and teleport:
add_ace group.support Nord.admin.open allow
add_ace group.support Nord.admin.players allow
add_ace group.support Nord.admin.teleport allow
```

FiveM principals still need to be assigned to these groups in the server's
access-control configuration.

## Audit and privacy

Actions record actor and target source/character IDs, action name, outcome,
bounded action details, and timestamp in `data/admin.sqlite`. Free-form item
metadata is not copied into the admin audit. The default retention window is
180 days and old records are pruned when the resource starts.
