'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..', '..');
const jobsRoot = path.join(root, 'resources', '[fluxcore]', 'fluxcore_jobs');
const read = (...parts) => fs.readFileSync(path.join(jobsRoot, ...parts), 'utf8');

test('job payday is bounded, on-duty only, and server-issued', () => {
  const config = JSON.parse(read('config', 'jobs.json'));
  const validator = read('server', 'config.js');
  const main = read('server', 'main.js');

  assert.ok(config.payIntervalMs >= 60_000);
  assert.ok(config.payIntervalMs <= 86_400_000);
  assert.equal(config.payCurrency, 'bank');
  assert.match(validator, /payIntervalMs[\s\S]*60_000[\s\S]*86_400_000/u);
  assert.match(main, /!active\.onDuty \|\| active\.payment <= 0/u);
  assert.match(main, /core\.addMoney\(/u);
  assert.match(main, /'job_payday'/u);
  assert.match(main, /player\.characterId.*active\.name.*active\.grade/u);
  assert.match(main, /setInterval\(runPayday,\s*config\.payIntervalMs\)/u);
  assert.match(main, /clearInterval\(paydayTimer\)/u);
  assert.match(main, /RegisterCommand\('paycheck'/u);
});
