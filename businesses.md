# Businesses

`fluxcore_businesses` owns companies, roles, permissions, treasuries and audit records.

## Dependencies

`fluxcore_core`, `fluxcore_jobs`, `fluxcore_banking`

## Configuration

Configure business rules in `fluxcore_businesses/config/businesses.json`.

## Server security

`/createbusiness` requires the `fluxcore.businesses.manage` ACE. The server controls membership, roles, permissions, treasury balances and audit records. No fixed UI or locations are required.

## Client integration

Businesses has no public client `Request` export. Integrations use the server exports.

## Server exports

* `GetBusiness`
* `GetBusinesses`
* `HasPermission`
* `CreateBusiness`
* `AddMember`
* `RemoveMember`
* `CreditTreasury`
* `DebitTreasury`

## Commands

* `/createbusiness`
