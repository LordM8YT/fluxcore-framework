# nord_banking

`nord_banking` is Nord's server-authoritative personal banking layer. Core
wallets remain the single source of truth, while this resource adds stable bank
account numbers, offline-capable transfers, access-point validation, statements,
and a UI-ready client contract.

## Server exports

- `GetAccount(identifier)`
- `ResolveAccount(accountNumber)`
- `GetBalance(identifier)`
- `Deposit(identifier, amount)`
- `Withdraw(identifier, amount)`
- `Transfer(identifier, accountNumber, amount, memo)`

Mutation exports return Nord's `{ ok, data, error }` envelope. Player-triggered
requests are rate limited and require server-verified proximity to a configured
bank or ATM. Trusted server exports intentionally bypass the location check.

## Client integration

`/bank` requests a bootstrap and emits:

```lua
AddEventHandler('nord_banking:client:open', function(snapshot)
    -- Present your NUI here.
end)
```

Balance changes emit `nord_banking:client:updated`. A future
`nord_interact` resource can invoke `/bank` or call the client `Request` export
without changing the banking backend.
