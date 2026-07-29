# Installation

Fluxcore supports a complete txAdmin recipe and a manual development setup. It does not require MySQL, MariaDB, oxmysql, or another roleplay framework.

## Requirements

* FiveM for GTAV Enhanced and a current Cfx Server artifact
* txAdmin
* a valid Cfx.re server license key
* OneSync, which is built into Cfx Server for Enhanced
* Node 26, bundled with the Enhanced server runtime

The repository tools require a local Node installation when running tests or backup commands outside Cfx Server.

## Recommended: txAdmin recipe

{% stepper %}
{% step %}
## Start Cfx Server

Start `cfx-server.exe` without a `+exec server.cfg` argument.
{% endstep %}

{% step %}
## Complete txAdmin setup

Complete the initial txAdmin account setup.
{% endstep %}

{% step %}
## Choose a template

Choose **Remote URL Template**.
{% endstep %}

{% step %}
## Paste the recipe URL

```
https://raw.githubusercontent.com/LordM8YT/fluxcore-framework/main/recipe.yaml
```
{% endstep %}

{% step %}
## Select a server-data directory

Select an empty server-data directory.
{% endstep %}

{% step %}
## Review the recipe

Review the recipe and enter the Cfx.re server key.
{% endstep %}

{% step %}
## Run the deployer

Run the deployer.
{% endstep %}

{% step %}
## Review the configuration

Review the generated `server.cfg`.
{% endstep %}

{% step %}
## Save and run the server

Select **Save & Run Server**.
{% endstep %}
{% endstepper %}

The recipe installs the standard CFX resources, every Fluxcore resource, the MIT license and a ready-to-run configuration. It already contains the documented Fluxcore start order. The first txAdmin administrator inherits the Fluxcore administration permissions through `group.admin`.

## Manual development install

{% stepper %}
{% step %}
## Clone or download the repository

Clone or download the repository.
{% endstep %}

{% step %}
## Copy Fluxcore resources

Copy `resources/[fluxcore]` into the server's `resources` directory.
{% endstep %}

{% step %}
## Copy the example configuration

Copy `server.cfg.example` outside the repository.
{% endstep %}

{% step %}
## Add the server license key

Add a real `sv_licenseKey` only to that external configuration.
{% endstep %}

{% step %}
## Configure resource order

Keep the documented resource order:

```cfg
setr sv_showBusySpinnerOnLoadingScreen false

ensure fluxcore_loading
ensure fluxcore_core
ensure fluxcore_chat
ensure fluxcore_interact
ensure fluxcore_status
ensure fluxcore_jobs
ensure fluxcore_inventory
ensure fluxcore_banking
ensure fluxcore_vehicles
ensure fluxcore_fuel
ensure fluxcore_appearance
ensure fluxcore_businesses
ensure fluxcore_services
ensure fluxcore_dispatch
ensure fluxcore_mdt
ensure fluxcore_properties
ensure fluxcore_world
ensure fluxcore_admin
ensure fluxcore_phone
ensure fluxcore_identity
```

Administrators need this ACE for business creation:

```cfg
add_ace group.admin fluxcore.businesses.manage allow
```
{% endstep %}

{% step %}
## Start Cfx Server

Start Cfx Server with the external configuration.
{% endstep %}
{% endstepper %}

{% hint style="info" %}
`fluxcore_example` is not started by default. It contains development-only
targets which overlap real systems, including the fuel pumps. Start it manually
only when testing the public framework API, then stop it before gameplay.
{% endhint %}

## First boot

A healthy first boot should:

* start every Fluxcore resource without a stack trace
* create one SQLite database per data-owning resource
* show the character selector after a client connects
* create and select a character
* spawn at one of the configured locations
* keep `sv_stateBagStrictMode` enabled

After the first clean shutdown, run:

```powershell
npm run data:inspect
```

Every database should report `integrity=ok`.

## Enhanced-specific settings

OneSync is always enabled by Cfx Server for Enhanced. Its convar is read-only, so do not add an old `onesync on` line. The txAdmin recipe manages it.

The development config enables:

```cfg
set sv_stateBagStrictMode true
set sv_devMode true
```

Disable `sv_devMode` on production servers that do not need Enhanced client developer tooling.

Fluxcore intentionally does not set `sv_enforceGameBuild`. Enhanced loads its current game build by default.

## Updating

Fluxcore is pre-alpha. Before updating:

{% stepper %}
{% step %}
## Read the commit or release notes

Read the commit or release notes.
{% endstep %}

{% step %}
## Create a backup

Create and verify a complete backup.
{% endstep %}

{% step %}
## Stop the server

Stop the server for schema-changing updates.
{% endstep %}

{% step %}
## Update resources

Update all Fluxcore resources together.
{% endstep %}

{% step %}
## Run automated tests

Run the automated tests.
{% endstep %}

{% step %}
## Start the server

Start the server and inspect migration output.
{% endstep %}

{% step %}
## Complete the test plan

Complete the relevant sections in [Enhanced Test Plan](enhanced-test-plan.md).
{% endstep %}
{% endstepper %}

{% hint style="warning" %}
Do not mix resource versions from different commits.
{% endhint %}
