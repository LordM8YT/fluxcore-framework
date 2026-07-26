'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { FrameworkDatabase } = require('../server/database');

function defaults() {
  return {
    startingMoney: { cash: 500, bank: 5000 },
    defaultJob: {
      name: 'unemployed',
      label: 'Unemployed',
      grade: 0,
      onDuty: false,
    },
    defaultSpawn: { x: 1, y: 2, z: 3, heading: 90 },
  };
}

function profile(slot = 1) {
  return {
    slot,
    firstName: 'Ada',
    lastName: 'Lovelace',
    birthDate: '1990-01-01',
    gender: 'unspecified',
    nationality: 'British',
  };
}

test('database persists characters and records atomic money changes', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-core-'));
  const filename = path.join(directory, 'test.sqlite');
  const database = new FrameworkDatabase(filename);
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const account = database.upsertAccount(
    'license2:test',
    ['license2:test', 'fivem:1'],
    'Test Player',
  );
  const character = database.createCharacter(account.id, profile(), defaults());

  assert.match(character.characterId, /^vrd_[a-f0-9]{16}$/);
  assert.deepEqual({ ...character.money }, { bank: 5000, cash: 500 });
  assert.equal(database.listCharacters(account.id).length, 1);

  const added = database.changeMoney(
    character,
    'cash',
    250,
    'test_add',
    'test:1',
    'unit-test',
  );
  assert.equal(added, 750);

  const removed = database.changeMoney(
    character,
    'cash',
    -300,
    'test_remove',
    'test:2',
    'unit-test',
  );
  assert.equal(removed, 450);

  assert.throws(
    () =>
      database.changeMoney(
        character,
        'cash',
        -451,
        'too_much',
        null,
        'unit-test',
      ),
    { code: 'INSUFFICIENT_FUNDS' },
  );

  const reloaded = database.loadOwnedCharacter(account.id, character.characterId);
  assert.equal(reloaded.money.cash, 450);
  const ledger = database.getLedger(character.characterId);
  assert.equal(ledger.length, 4);
  assert.deepEqual(
    ledger.map((entry) => Number(entry.delta)),
    [500, 5000, 250, -300],
  );
});

test('a character slot can only be used once per account', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-core-'));
  const database = new FrameworkDatabase(path.join(directory, 'test.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const account = database.upsertAccount('license:test', ['license:test'], 'Player');
  database.createCharacter(account.id, profile(1), defaults());
  assert.throws(
    () => database.createCharacter(account.id, profile(1), defaults()),
    { code: 'SLOT_TAKEN' },
  );
});

test('owned character deletion cascades wallets and ledger entries', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-core-'));
  const database = new FrameworkDatabase(path.join(directory, 'test.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const account = database.upsertAccount('license:delete', ['license:delete'], 'Player');
  const character = database.createCharacter(account.id, profile(1), defaults());
  assert.equal(database.getLedger(character.characterId).length, 2);

  assert.equal(
    database.deleteOwnedCharacter(account.id, character.characterId),
    true,
  );
  assert.equal(database.loadOwnedCharacter(account.id, character.characterId), null);
  assert.deepEqual(database.getLedger(character.characterId), []);
  assert.equal(
    database.deleteOwnedCharacter(account.id, character.characterId),
    false,
  );
});

test('wallet moves and offline transfers commit atomically', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'Fluxcore-core-'));
  const database = new FrameworkDatabase(path.join(directory, 'test.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const firstAccount = database.upsertAccount(
    'license:first',
    ['license:first'],
    'First',
  );
  const secondAccount = database.upsertAccount(
    'license:second',
    ['license:second'],
    'Second',
  );
  const first = database.createCharacter(firstAccount.id, profile(1), defaults());
  const second = database.createCharacter(secondAccount.id, profile(1), defaults());

  const deposited = database.moveMoney(
    first,
    'cash',
    'bank',
    250,
    'bank_deposit',
    'deposit:1',
    'unit-test',
  );
  assert.deepEqual(deposited, {
    fromCurrency: 'cash',
    fromBalance: 250,
    toCurrency: 'bank',
    toBalance: 5250,
  });

  const transfer = database.transferMoney(
    first,
    second,
    'bank',
    1000,
    'bank_transfer',
    'transfer:1',
    'unit-test',
  );
  assert.equal(transfer.fromBalance, 4250);
  assert.equal(transfer.toBalance, 6000);
  assert.equal(database.getMoney(first, 'bank'), 4250);
  assert.equal(database.getMoney(second, 'bank'), 6000);

  assert.throws(
    () =>
      database.transferMoney(
        first,
        second,
        'bank',
        5000,
        'bank_transfer',
        'transfer:2',
        'unit-test',
      ),
    { code: 'INSUFFICIENT_FUNDS' },
  );
  assert.equal(database.getMoney(first, 'bank'), 4250);
  assert.equal(database.getMoney(second, 'bank'), 6000);
});
