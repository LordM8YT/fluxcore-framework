# Fluxcore Framework

Fluxcore is an independent, Enhanced-first roleplay framework for FiveM. It is built from scratch and does not require Qbox, QBCore, ESX, ox\_lib, oxmysql, or an external database server.

{% hint style="warning" %}
**Project status:** pre-alpha. The public API is usable, but breaking changes may still happen before the first stable release. Pin a tested commit for production servers.
{% endhint %}

## Start here

| I want to…                          | Read                                              |
| ----------------------------------- | ------------------------------------------------- |
| install a complete server           | [Installation](installation.md)                   |
| configure resources and permissions | [Configuration](configuration.md)                 |
| build a Fluxcore resource           | [Developer Guide](developer-guide.md)             |
| build interactions                  | [Interactions and Shared UI](interactions-and-shared-ui.md) |
| copy a clean resource starter       | [Resource Template](resource-template.md)         |
| use core exports and events         | [Core API](core-api.md)                           |
| understand State Bags               | [State Bags and Events](state-bags-and-events.md) |
| see RP commands and default controls | [Chat and Player Controls](chat-and-player-controls.md) |
| integrate a frontend                | [UI Contracts](ui-contracts.md)                   |
| back up or migrate data             | [Database and Backups](database-and-backups.md)   |
| test on FiveM Enhanced              | [Enhanced Test Plan](enhanced-test-plan.md)       |
| diagnose a problem                  | [Troubleshooting](troubleshooting.md)             |

## What Fluxcore includes

| Resource              | Responsibility                                                           |
| --------------------- | ------------------------------------------------------------------------ |
| `fluxcore_core`       | accounts, characters, sessions, money, metadata, active job and position |
| `fluxcore_interact`   | shared zones, entity interactions, menus, dialogs, notifications, and progress actions |
| `fluxcore_loading`    | Fluxcord loading screen with real Cfx loading progress                    |
| `fluxcore_ui`         | temporary data-driven menus for domains awaiting their replacement frontend |
| `fluxcore_identity`   | character selection, creation, deletion and spawning                     |
| `fluxcore_jobs`       | persistent job assignments, grades, duty and permissions                 |
| `fluxcore_inventory`  | server-authoritative items, containers and world drops                   |
| `fluxcore_status`     | persistent needs, Fluxcord HUD, RP minimap and vanilla police suppression |
| `fluxcore_chat`       | replacement RP chat, slash commands and basic emotes                     |
| `fluxcore_voice`      | guarded Enhanced proximity-voice channel and talking-state export        |
| `fluxcore_vehicles`   | ownership, keys, public garages, locks and trunks                        |
| `fluxcore_fuel`       | native consumption and server-validated fuel purchases                  |
| `fluxcore_appearance` | persistent freemode appearance and temporary live-preview editor          |
| `fluxcore_banking`    | stable accounts, money movements and statements                          |
| `fluxcore_businesses` | companies, roles, permissions, treasuries and audit                      |
| `fluxcore_services`   | on-duty rosters and secure personal and business invoices                |
| `fluxcore_dispatch`   | emergency calls, priorities, units and closure                           |
| `fluxcore_mdt`        | police records, warrants, BOLOs and dispatch feed                        |
| `fluxcore_properties` | ownership, keys, locks, storage and garage metadata                      |
| `fluxcore_world`      | server-validated shops, dealerships and persistent job doors             |
| `fluxcore_admin`      | ACE-secured administration and audit records                             |
| `fluxcore_phone`      | phone numbers, contacts and offline text messaging                       |
| `fluxcore_example`    | opt-in development examples for the public API                            |

Read [Player Experience](player-experience.md) and
[Character Creation](character-creation.md) for loading, characters,
inventory controls, HUD, minimap and RP police behavior. Domain references
cover [Interactions and Shared UI](interactions-and-shared-ui.md),
[Fuel](fuel.md), [Banking](banking.md), [Businesses](businesses.md),
[Services and Invoicing](services-and-invoicing.md), [Dispatch](dispatch.md),
[MDT](mdt.md), [Properties](properties.md), and [World](world.md).

## Design principles

* The server owns persistent state.
* The resource that owns a domain is the only resource that mutates it.
* Consumers use documented exports, events and State Bags.
* Private player data is sent only to its owner.
* Public State Bags contain only facts other nearby resources need.
* Every client request is untrusted and revalidated by the server.
* UI is replaceable and communicates through versioned contracts.
* Runtime dependencies stay minimal and explicit.

Read [Architecture](architecture.md) for the complete ownership model.

## Quick install

Choose **Remote URL Template** in txAdmin and paste:

```
https://raw.githubusercontent.com/LordM8YT/fluxcore-framework/main/recipe.yaml
```

The recipe installs a complete server-data directory. See [Installation](installation.md) before starting a public server.

## Links

* [GitHub repository](https://github.com/LordM8YT/fluxcore-framework)
* [Issues](https://github.com/LordM8YT/fluxcore-framework/issues)
* [Releases](https://github.com/LordM8YT/fluxcore-framework/releases)
* [License](https://github.com/LordM8YT/fluxcore-framework/blob/main/LICENSE)
