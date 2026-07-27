# Contributing

Fluxcore welcomes focused, tested contributions.

## Independence

Contributions may learn from public APIs and general architecture elsewhere, but must not copy implementation code, branding, UI assets, or database schemas from Qbox, QBCore, ESX, or another project unless the license, attribution, and reason are explicitly documented.

## Setup

### Requirements

* Node 24 or newer locally
* Lua 5.4 compiler (`luac`)
* Git

### Run checks

```powershell
npm test
git diff --check
```

No `npm install` is required for the repository tests.

## Design checklist

* Assign each domain one owning resource and database.
* Keep `fluxcore_core` small.
* Consume public APIs from domain resources.
* Treat client events and NUI callbacks as untrusted.
* Keep private player data out of replicated State Bags.
* Use result envelopes for fallible mutations.
* Bound strings, numbers, metadata, payloads, and request rate.
* Audit economy, inventory, and moderation changes.
* Clean character-owned state on logout and deletion.
* Document exports, events, config keys, contracts, and ACE permissions.

## Database changes

Read [Database and Backups](database-and-backups.md). Migrations are:

* Forward-only
* Transactional
* Owned by one resource
* Covered by preserved-data tests

Never edit an operator's database manually.

## Pull requests

Keep one milestone per pull request. Include:

* Why the change is needed
* Ownership and security boundaries
* Automated test output
* Manual FiveM steps for native integration
* Screenshots for visible UI changes
* Migration and operator notes where relevant

Resolve review feedback with new commits. Avoid force-pushing after review starts unless removing a secret.

## Documentation

Update this Wiki when changing a public export, event, State Bag, contract, configuration key, command, or ACE permission.
