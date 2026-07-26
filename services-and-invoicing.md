# Services and Invoicing

`fluxcore_services` owns on-duty rosters and secure personal and business invoices.

## Dependencies

`fluxcore_core`, `fluxcore_jobs`, `fluxcore_banking`, `fluxcore_businesses`

## Configuration

Configure roster and invoice rules in `fluxcore_services/config/services.json`.

## Server security

Invoice creation requires configured on-duty job permission. Payment is claimed once before money moves. The server validates invoice ownership, status and payment.

## Client integration

Open with `/invoices` or `fluxcore_services:client:open`. Updates emit `fluxcore_services:client:updated`.

Any frontend calls the client `Request` export. Supported methods are `bootstrap`, `invoice:create`, `invoice:pay` and `invoice:cancel`. The frontend remains replaceable.

## Server exports

* `CreateInvoice`
* `GetInvoice`
* `GetInvoices`
* `PayInvoice`
* `CancelInvoice`
* `GetRoster`

## Commands

* `/invoices`
