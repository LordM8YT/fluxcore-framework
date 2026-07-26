# Fluxcore Framework

Fluxcore is an independent, Enhanced-first roleplay framework for FiveM. It is built from
scratch and does not require Qbox, QBCore, ESX, ox_lib, or oxmysql.

[Documentation](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/) ·
[Installation](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/installation) ·
[Developer guide](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/developer-guide)

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
  [fluxcore]/
    fluxcore_core/       Framework core
    fluxcore_identity/   Character and spawn UI
    fluxcore_jobs/       Jobs, grades, duty, and permissions
    fluxcore_inventory/  Server-authoritative items and containers
    fluxcore_banking/    Accounts, wallet movement, and transfers
    fluxcore_status/     Persistent needs and HUD telemetry
    fluxcore_vehicles/   Ownership, keys, garages, and trunks
    fluxcore_appearance/ Persistent freemode character appearance
    fluxcore_businesses/ Companies, roles, and treasuries
    fluxcore_services/   Rosters and invoices
    fluxcore_dispatch/   Emergency calls and unit assignment
    fluxcore_mdt/        Police reports, warrants, and BOLOs
    fluxcore_properties/ Ownership, access, locks, and storage
    fluxcore_world/      Shops, dealerships, and persistent doors
    fluxcore_admin/      ACE-secured operations and audit panel
    fluxcore_phone/      Contacts and offline text messaging
    fluxcore_example/    Commands showing the public API
templates/
  fluxcore_resource/     Copyable starter for new Fluxcore resources
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
https://raw.githubusercontent.com/LordM8YT/fluxcore-framework/main/recipe.yaml
```

The recipe creates a complete server-data directory with the standard CFX
resources, Fluxcore, a generated `server.cfg`, and no external framework or
database dependency. See the
[Installation guide](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/installation)
for the full setup flow and Enhanced notes.

## Development

Run all Node tests, web-script checks, and Lua syntax checks from the repository
root:

```powershell
npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for design and review rules,
[SECURITY.md](SECURITY.md) for private reporting, and
[Database and Backups](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/database-and-backups)
for backup and migration
procedures.

External resources should begin with the
[Fluxcore resource starter](templates/fluxcore_resource). It demonstrates direct
exports, replicated State Bags, and native ACE-protected commands without
QBCore, Qbox, or ESX compatibility patterns.

Language is selected once in `server.cfg` with `setr fluxcore_locale "en"` or
`setr fluxcore_locale "no"`. See
[Localization](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/localization)
for the runtime API and instructions for adding another language.

The first public artifact should be validated with the
[Enhanced test plan](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/enhanced-test-plan)
before an
alpha release is tagged.

See [the core documentation](<resources/[fluxcore]/fluxcore_core/README.md>) for
installation, exports, events, and the security model.

Job definitions and the permission API are documented in
[fluxcore_jobs](<resources/[fluxcore]/fluxcore_jobs/README.md>).

Item, container, and transfer APIs are documented in
[fluxcore_inventory](<resources/[fluxcore]/fluxcore_inventory/README.md>).

Accounts, deposits, withdrawals, and transfers are documented in
[fluxcore_banking](<resources/[fluxcore]/fluxcore_banking/README.md>).

Needs and HUD telemetry are documented in
[fluxcore_status](<resources/[fluxcore]/fluxcore_status/README.md>).

Vehicle ownership, keys, garages, and trunks are documented in
[fluxcore_vehicles](<resources/[fluxcore]/fluxcore_vehicles/README.md>).

Persistent character customization is documented in
[fluxcore_appearance](<resources/[fluxcore]/fluxcore_appearance/README.md>).

Companies, employee roles, and treasury access are documented in
[fluxcore_businesses](<resources/[fluxcore]/fluxcore_businesses/README.md>).

On-duty rosters and secure invoices are documented in
[fluxcore_services](<resources/[fluxcore]/fluxcore_services/README.md>).

Emergency calls and unit assignment are documented in
[fluxcore_dispatch](<resources/[fluxcore]/fluxcore_dispatch/README.md>).

Police records, warrants, reports, and BOLOs are documented in
[fluxcore_mdt](<resources/[fluxcore]/fluxcore_mdt/README.md>).

Property ownership, keys, storage, and integration points are documented in
[fluxcore_properties](<resources/[fluxcore]/fluxcore_properties/README.md>).

Shops, dealerships, and persistent doors are documented in
[fluxcore_world](<resources/[fluxcore]/fluxcore_world/README.md>).

Administration permissions and actions are documented in
[fluxcore_admin](<resources/[fluxcore]/fluxcore_admin/README.md>).

The text-only communication MVP is documented in
[fluxcore_phone](<resources/[fluxcore]/fluxcore_phone/README.md>).

Frontend contributors should use the versioned
[Fluxcore UI contracts](https://fluxcore-framework.gitbook.io/fluxcore-framework-docs/ui-contracts)
and bundled mock payloads under `contracts/ui/v1`.
NUI code never accesses a framework export or database directly.

## License

Fluxcore Framework is available under the [MIT License](LICENSE).
