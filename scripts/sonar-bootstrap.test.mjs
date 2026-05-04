import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBasicAuth,
  qualityGateConditions,
  isAlreadyExists,
} from './sonar-bootstrap.mjs';

test('buildBasicAuth produz header Basic com base64', () => {
  const h = buildBasicAuth('admin', 'admin');
  assert.equal(h, 'Basic ' + Buffer.from('admin:admin').toString('base64'));
});

test('buildBasicAuth com token usa empty password', () => {
  const h = buildBasicAuth('squ_xyz', '');
  assert.equal(h, 'Basic ' + Buffer.from('squ_xyz:').toString('base64'));
});

test('qualityGateConditions tem 5 condições alinhadas com a spec', () => {
  const conds = qualityGateConditions();
  assert.equal(conds.length, 5);
  const metrics = conds.map((c) => c.metric);
  assert.deepEqual(metrics.sort(), [
    'new_coverage',
    'new_duplicated_lines_density',
    'new_security_hotspots_reviewed',
    'new_security_rating',
    'new_reliability_rating',
  ].sort());
});

test('qualityGateConditions usa "new_" prefix em todas (gate só vale em new code)', () => {
  for (const c of qualityGateConditions()) {
    assert.ok(c.metric.startsWith('new_'), `${c.metric} deveria começar com new_`);
  }
});

test('isAlreadyExists detecta erro de duplicidade do Sonar', () => {
  assert.equal(isAlreadyExists({ errors: [{ msg: 'Project key already exists' }] }), true);
  assert.equal(isAlreadyExists({ errors: [{ msg: 'A project with key X already exists' }] }), true);
  assert.equal(isAlreadyExists({ errors: [{ msg: 'Name has already been taken' }] }), true);
  assert.equal(isAlreadyExists({ errors: [{ msg: 'Other error' }] }), false);
  assert.equal(isAlreadyExists({}), false);
  assert.equal(isAlreadyExists(null), false);
});
