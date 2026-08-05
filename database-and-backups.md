# Database and Backups

Each domain owns one SQLite file. No resource writes another resource's tables.

| Resource              | Database                 | Owner data                     |
| --------------------- | ------------------------ | ------------------------------ |
| `fluxcore_core`       | `data/fluxcore.sqlite`   | accounts, characters, wallets  |
| `fluxcore_jobs`       | `data/jobs.sqlite`       | assignments and audit          |
| `fluxcore_inventory`  | `data/inventory.sqlite`  | containers, items and audit    |
| `fluxcore_status`     | `data/status.sqlite`     | hunger, thirst and stress      |
| `fluxcore_vehicles`   | `data/vehicles.sqlite`   | vehicles and keys              |
| `fluxcore_appearance` | `data/appearance.sqlite` | freemode appearance            |
| `fluxcore_admin`      | `data/admin.sqlite`      | admin audit                    |
| `fluxcore_phone`      | `data/phone.sqlite`      | numbers, contacts, messages and pseudonymous Cipher data |

Runtime databases, WAL sidecars and backups are ignored by Git.

## Create a consistent backup

```powershell
npm run data:backup
```

Default destination:

```
backups/<UTC timestamp>
```

Choose a destination:

```powershell
node tools/fluxcore-data.js backup D:\fluxcore-backups\before-update
```

The command uses SQLite's backup API, so snapshots remain consistent while WAL mode is active.

## Verify

```powershell
node tools/fluxcore-data.js verify D:\fluxcore-backups\before-update
```

Verification checks:

* manifest structure
* SHA-256 checksum
* file size
* SQLite integrity
* expected schema version

Inspect live databases:

```powershell
npm run data:inspect
```

{% hint style="info" %}
Store at least one verified copy outside the game server.
{% endhint %}

## Restore

{% stepper %}
{% step %}
### Stop Cfx Server
{% endstep %}

{% step %}
### Verify the selected backup
{% endstep %}

{% step %}
### Copy the current data directories to a second safe location
{% endstep %}

{% step %}
### Restore every database to the source path in `manifest.json`
{% endstep %}

{% step %}
### Remove stale `-wal` and `-shm` files only while stopped
{% endstep %}

{% step %}
### Start the server and inspect migration output
{% endstep %}

{% step %}
### Run `npm run data:inspect`

```powershell
npm run data:inspect
```
{% endstep %}

{% step %}
### Complete the relevant integration tests
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Restore the complete backup set. Mixing timestamps may leave character IDs inconsistent across resources.
{% endhint %}

## Migration rules

Schemas use `PRAGMA user_version`. Startup must:

{% stepper %}
{% step %}
### Read the current version
{% endstep %}

{% step %}
### Reject a database newer than the code supports
{% endstep %}

{% step %}
### Run every missing migration in order inside `BEGIN IMMEDIATE`
{% endstep %}

{% step %}
### Update `user_version` only after success
{% endstep %}

{% step %}
### Roll back the full migration on error
{% endstep %}
{% endstepper %}

Migrations are forward-only. Never edit a migration that reached `main`; add the next version.

A schema pull request must include:

* upgrade code from every supported prior version
* preserved-data tests
* updated documentation
* an operator note for slow migrations

{% hint style="warning" %}
Never edit production tables or `PRAGMA user_version` manually.
{% endhint %}
