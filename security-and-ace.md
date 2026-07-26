# Security and ACE

Fluxcore treats clients, NUI callbacks, and third-party inputs as untrusted. Server resources are trusted code and can mutate persistent state through exports.

## Operator rules

* Keep `sv_licenseKey`, txAdmin data, and ACE principal files outside Git.
* Never expose resource data directories through a web server.
* Verify backups before updates.
* Stop the server before restoring databases.
* Grant mutation exports only by controlling which server resources are installed.
* Review every third-party server resource as privileged code.

{% hint style="warning" %}
Fluxcore cannot protect a server from arbitrary malicious server-side code.
{% endhint %}

## Root permissions

```cfg
add_ace group.admin fluxcore.admin allow
add_ace group.admin fluxcore.jobs.manage allow
add_ace group.admin fluxcore.vehicles.manage allow
add_ace group.admin fluxcore.businesses.manage allow
```

Assign a principal:

```cfg
add_principal identifier.license:REPLACE_ME group.admin
```

## Granular admin permissions

* `fluxcore.admin.open`
* `fluxcore.admin.players`
* `fluxcore.admin.teleport`
* `fluxcore.admin.moderation`
* `fluxcore.admin.economy`
* `fluxcore.admin.jobs`
* `fluxcore.admin.inventory`
* `fluxcore.admin.audit`

Example support role:

```cfg
add_ace group.support fluxcore.admin.open allow
add_ace group.support fluxcore.admin.players allow
add_ace group.support fluxcore.admin.teleport allow
```

{% hint style="info" %}
Opening the panel alone does not grant access to the player roster.
{% endhint %}

## Native command ACE

`RegisterCommand(name, handler, true)` uses `command.<name>`.

```cfg
add_ace group.admin command.mycommand allow
```

Prefer this for a simple restricted command.

## Server validation

Sensitive operations verify:

* Source and active character
* Ownership
* Permission
* Server-observed distance
* Amount and numeric bounds
* Item, job, and vehicle registry membership
* Slots, weight, and metadata
* Rate and duplicate nonce

Wallet and inventory mutations are transactional and auditable.

All domain player mutations are server-authoritative. Client RPC is rate-limited where available. The server never trusts client coordinates, prices, ownership, permissions or balances.

## State Bag privacy

{% columns %}
{% column %}
### Public

* Loaded state
* Character ID
* Active job
* Small resource-owned discovery flags
{% endcolumn %}

{% column %}
### Private

* Profile details
* Wallets
* Position history
* Metadata
* Inventory
* Contacts and messages
* Admin records
{% endcolumn %}
{% endcolumns %}

## Vulnerability reporting

{% hint style="danger" %}
Do not open a public issue for a suspected vulnerability.
{% endhint %}

[Create a private security advisory](https://github.com/LordM8YT/fluxcore-framework/security/advisories/new) with:

* Affected commit
* Resource and API
* Realistic impact
* Minimal reproduction
* Suggested mitigation when known

Remove tokens, license keys, player identifiers, IP addresses, and production database contents.
