'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ServicesDatabase } = require('../server/database');

test('invoice lifecycle can only be paid or cancelled once', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'varde-services-'));
  const database = new ServicesDatabase(path.join(directory, 'services.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const invoice = database.create(
    'mechanic',
    'vrd_0123456789abcdef',
    'vrd_fedcba9876543210',
    null,
    1500,
    'Repair',
  );
  assert.match(invoice.id, /^inv_[a-f0-9]{16}$/u);
  assert.equal(database.claim(invoice.id, 'invoice:test').status, 'processing');
  assert.equal(database.claim(invoice.id, 'invoice:again'), null);
  assert.equal(database.markPaid(invoice.id).status, 'paid');
  assert.equal(database.cancel(invoice.id), null);
});

test('failed payment claims can return to pending', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'varde-services-'));
  const database = new ServicesDatabase(path.join(directory, 'services.sqlite'));
  t.after(() => {
    database.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const invoice = database.create(
    'police',
    'vrd_0123456789abcdef',
    'vrd_fedcba9876543210',
    null,
    500,
    'Fine',
  );
  database.claim(invoice.id, 'invoice:test');
  assert.equal(database.reset(invoice.id), true);
  assert.equal(database.get(invoice.id).status, 'pending');
});
