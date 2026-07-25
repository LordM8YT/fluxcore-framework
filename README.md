# Nord Framework

Nord is an independent, Enhanced-first roleplay framework for FiveM. It is built from
scratch and does not require Qbox, QBCore, ESX, ox_lib, or oxmysql.

[Documentation](https://nord-framework.gitbook.io/nord-framework-docs/) ·
[Installation](https://nord-framework.gitbook.io/nord-framework-docs/installation) ·
[Developer guide](https://nord-framework.gitbook.io/nord-framework-docs/developer-guide)

The current pre-alpha foundation includes:

- account creation from the player's Cfx license
- multiple persistent characters
- responsive character selection, creation, deletion, and spawn UI
- server-authoritative sessions
- persistent cash and bank balances with an audit ledger
- jobs, metadata, and last position
- persistent hunger, thirst, stress, and a versioned HUD data provider
- server-authoritative inventory sessions, world drops, and UI contracts
- stable bank account numbers, deposits, withdrawals, transfers, and ledgers
- persistent vehicle ownership, keys, garages, locks, and trunks
- persistent freemode appearance reapplied after spawn
- player-owned businesses with roles, permissions, treasuries, and audit logs
- service rosters and secure personal or business invoicing
- emergency dispatch with live calls, priorities, and unit assignments
- police MDT records with reports, warrants, BOLOs, people, and vehicle lookup
- configurable property ownership, shared keys, locks, storage, and garage links
- server-validated shops, vehicle dealerships, and persistent job doors
- shared English/Norwegian localization with English fallback
- a rate-limited client/server RPC layer
- explicit, minimal state bag replication
- a public export API for resources built on top of the framework

The server core uses the `node:sqlite` module bundled with Node 26 in Cfx
Server. Client gameplay code uses Lua 5.4.

## Repository layout

```text
resources/
  [nord]/
    nord_core/       Framework core
    nord_identity/   Character and spawn UI
    nord_jobs/       Jobs, grades, duty, and permissions
    nord_inventory/  Server-authoritative items and containers
    nord_banking/    Accounts, wallet movement, and transfers
    nord_status/     Persistent needs and HUD telemetry
    nord_vehicles/   Ownership, keys, garages, and trunks
    nord_appearance/ Persistent freemode character appearance
    nord_businesses/ Companies, roles, and treasuries
    nord_services/   Rosters and invoices
    nord_dispatch/   Emergency calls and unit assignment
    nord_mdt/        Police reports, warrants, and BOLOs
    nord_properties/ Ownership, access, locks, and storage
    nord_world/      Shops, dealerships, and persistent doors
    nord_admin/      ACE-secured operations and audit panel
    nord_phone/      Contacts and offline text messaging
    nord_example/    Commands showing the public API
templates/
  nord_resource/     Copyable starter for new Nord resources
contracts/
  ui/v1/              Versioned UI mock payloads
server.cfg.example       Minimal development configuration
```

## Current status

This repository contains a testable pre-alpha for FiveM for GTAV Enhanced.
Automated tests cover each persistence and service layer; native-backed vehicle,
ped, NUI, and marker flows still require the manual Enhanced test plan before
an alpha tag.

## Install with txAdmin

Choose **Remote URL Template** during txAdmin setup and paste:

```text
https://raw.githubusercontent.com/LordM8YT/nord-framework/main/recipe.yaml
```

The recipe creates a complete server-data directory with the standard CFX
resources, Nord, a generated `server.cfg`, and no external framework or
database dependency. See the
[Installation guide](https://nord-framework.gitbook.io/nord-framework-docs/installation)
for the full setup flow and Enhanced notes.

## Development

Run all Node tests, web-script checks, and Lua syntax checks from the repository
root:

```powershell
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for design and review rules,
[SECURITY.md](SECURITY.md) for private reporting, and
[Database and Backups](https://nord-framework.gitbook.io/nord-framework-docs/database-and-backups)
for backup and migration
procedures.

External resources should begin with the
[Nord resource starter](templates/nord_resource). It demonstrates direct
exports, replicated State Bags, and native ACE-protected commands without
QBCore, Qbox, or ESX compatibility patterns.

Language is selected once in `server.cfg` with `setr nord_locale "en"` or
`setr nord_locale "no"`. See
[Localization](https://nord-framework.gitbook.io/nord-framework-docs/localization)
for the runtime API and instructions for adding another language.

The first public artifact should be validated with the
[Enhanced test plan](https://nord-framework.gitbook.io/nord-framework-docs/enhanced-test-plan)
before an
alpha release is tagged.

See [the core documentation](<resources/[nord]/nord_core/README.md>) for
installation, exports, events, and the security model.

Job definitions and the permission API are documented in
[nord_jobs](<resources/[nord]/nord_jobs/README.md>).

Item, container, and transfer APIs are documented in
[nord_inventory](<resources/[nord]/nord_inventory/README.md>).

Accounts, deposits, withdrawals, and transfers are documented in
[nord_banking](<resources/[nord]/nord_banking/README.md>).

Needs and HUD telemetry are documented in
[nord_status](<resources/[nord]/nord_status/README.md>).

Vehicle ownership, keys, garages, and trunks are documented in
[nord_vehicles](<resources/[nord]/nord_vehicles/README.md>).

Persistent character customization is documented in
[nord_appearance](<resources/[nord]/nord_appearance/README.md>).

Companies, employee roles, and treasury access are documented in
[nord_businesses](<resources/[nord]/nord_businesses/README.md>).

On-duty rosters and secure invoices are documented in
[nord_services](<resources/[nord]/nord_services/README.md>).

Emergency calls and unit assignment are documented in
[nord_dispatch](<resources/[nord]/nord_dispatch/README.md>).

Police records, warrants, reports, and BOLOs are documented in
[nord_mdt](<resources/[nord]/nord_mdt/README.md>).

Property ownership, keys, storage, and integration points are documented in
[nord_properties](<resources/[nord]/nord_properties/README.md>).

Shops, dealerships, and persistent doors are documented in
[nord_world](<resources/[nord]/nord_world/README.md>).

Administration permissions and actions are documented in
[nord_admin](<resources/[nord]/nord_admin/README.md>).

The text-only communication MVP is documented in
[nord_phone](<resources/[nord]/nord_phone/README.md>).

Frontend contributors should use the versioned
[Nord UI contracts](https://nord-framework.gitbook.io/nord-framework-docs/ui-contracts)
and bundled mock payloads under `contracts/ui/v1`.
NUI code never accesses a framework export or database directly.

## License

Nord Framework is available under the [MIT License](LICENSE).
