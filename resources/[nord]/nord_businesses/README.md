# nord_businesses

Dynamic, MLO-agnostic businesses for Nord Framework.

The resource owns business identity, membership roles, active membership,
permission evaluation, a bounded treasury ledger, and audit records. It does
not draw target zones or ship a fixed UI; those layers consume the documented
events and exports.

## Useful exports

- `GetBusiness(id)`
- `GetBusinesses(identifier)`
- `HasPermission(identifier, id, permission)`
- `CreateBusiness(owner, type, name)`
- `AddMember(actor, id, characterId, role)`
- `RemoveMember(actor, id, characterId)`
- `CreditTreasury(id, amount, reason, reference)`
- `DebitTreasury(id, amount, reason, reference)`

Treasury mutation exports are server-only trusted integration points. A future
checkout/invoicing resource should debit the payer first and credit the treasury
with a stable reference.
