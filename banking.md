# Banking

`fluxcore_banking` owns stable account numbers, deposits, withdrawals, transfers and statements.

## Dependencies

`fluxcore_core`

## Configuration

Configure accounts and banking locations in `fluxcore_banking/config/banking.json`.

## Server security

Deposits and withdrawals require server-verified bank proximity. Transfers use stable account numbers and support offline recipients. The server validates balances, account ownership and amounts.

## Client integration

Open with `/bank` or `fluxcore_banking:client:open`. Updates emit `fluxcore_banking:client:updated`.

Any frontend calls the client `Request` export. Supported methods are `bootstrap`, `deposit`, `withdraw` and `transfer`. The frontend remains replaceable.

## Server exports

* `GetAccount`
* `ResolveAccount`
* `GetBalance`
* `Deposit`
* `Withdraw`
* `Transfer`

## Commands

* `/bank`
