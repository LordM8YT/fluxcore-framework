# fluxcore_services

Shared operational services for police, EMS, and player businesses.

The first version provides:

- live on-duty rosters derived from Fluxcore job state;
- permission-gated invoices;
- private issued/received invoice histories;
- atomic personal payments through `fluxcore_core`;
- business treasury payments with compensating refunds on integration failure;
- claim-before-pay invoice state to prevent double payment.

The client emits `fluxcore_services:client:open` and
`fluxcore_services:client:updated` with the versioned contract. UI and target
resources remain replaceable.
