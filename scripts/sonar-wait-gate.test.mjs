import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatFailure, parseGateStatus } from './sonar-wait-gate.mjs';

test('parseGateStatus extrai status OK', () => {
  const body = { projectStatus: { status: 'OK', conditions: [] } };
  assert.equal(parseGateStatus(body), 'OK');
});

test('parseGateStatus extrai status ERROR', () => {
  const body = { projectStatus: { status: 'ERROR', conditions: [] } };
  assert.equal(parseGateStatus(body), 'ERROR');
});

test('parseGateStatus retorna PENDING quando body é vazio ou inválido', () => {
  assert.equal(parseGateStatus(null), 'PENDING');
  assert.equal(parseGateStatus({}), 'PENDING');
  assert.equal(parseGateStatus({ projectStatus: {} }), 'PENDING');
});

test('formatFailure lista apenas condições em ERROR com metric e thresholds', () => {
  const body = {
    projectStatus: {
      status: 'ERROR',
      conditions: [
        { status: 'OK', metricKey: 'new_coverage', actualValue: '95', errorThreshold: '80' },
        { status: 'ERROR', metricKey: 'new_duplicated_lines_density', actualValue: '5.2', errorThreshold: '3' },
        { status: 'ERROR', metricKey: 'new_security_rating', actualValue: '3', errorThreshold: '1' },
      ],
    },
  };
  const out = formatFailure(body);
  assert.match(out, /new_duplicated_lines_density.*5\.2.*3/);
  assert.match(out, /new_security_rating.*3.*1/);
  assert.doesNotMatch(out, /new_coverage/);
});

test('formatFailure retorna mensagem padrão se sem condições', () => {
  assert.match(formatFailure({}), /sem detalhes/i);
});
