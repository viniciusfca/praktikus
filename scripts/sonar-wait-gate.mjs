#!/usr/bin/env node
/**
 * Faz polling no quality gate do projeto Praktikus até OK ou ERROR.
 * Sai 0 em sucesso, 1 em falha de gate, 2 em timeout.
 */

const HOST = process.env.SONAR_HOST ?? 'http://localhost:9000';
const PROJECT = 'praktikus';
const TOKEN = process.env.SONAR_TOKEN ?? '';
const TIMEOUT_MS = Number(process.env.SONAR_GATE_TIMEOUT_MS ?? 120_000);
const POLL_MS = 2_000;

export function parseGateStatus(body) {
  return body?.projectStatus?.status ?? 'PENDING';
}

export function formatFailure(body) {
  const conds = body?.projectStatus?.conditions ?? [];
  const failed = conds.filter((c) => c.status === 'ERROR');
  if (failed.length === 0) return 'Quality gate falhou (sem detalhes).';
  const lines = failed.map(
    (c) => `  - ${c.metricKey}: atual=${c.actualValue}, limite=${c.errorThreshold}`,
  );
  return ['❌ Quality gate falhou:', ...lines].join('\n');
}

async function fetchStatus() {
  const auth = 'Basic ' + Buffer.from(`${TOKEN}:`).toString('base64');
  const res = await fetch(
    `${HOST}/api/qualitygates/project_status?projectKey=${PROJECT}`,
    { headers: { Authorization: auth } },
  );
  if (!res.ok) {
    throw new Error(`Sonar API ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function main() {
  if (!TOKEN) {
    console.error('❌ SONAR_TOKEN não definido. Adicione ao apps/backend/.env e re-rode.');
    process.exit(1);
  }

  const start = Date.now();
  while (Date.now() - start < TIMEOUT_MS) {
    try {
      const body = await fetchStatus();
      const status = parseGateStatus(body);
      if (status === 'OK') {
        console.log('✅ Quality gate verde.');
        process.exit(0);
      }
      if (status === 'ERROR') {
        console.error(formatFailure(body));
        console.error(
          `\nLista detalhada de issues new-code:\n  curl -s -u "$SONAR_TOKEN:" "${HOST}/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true" | jq '.issues[] | {key, rule, severity, message, component, line}'`,
        );
        process.exit(1);
      }
    } catch (err) {
      console.error('Aguardando análise:', err.message);
    }
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  console.error('❌ Timeout aguardando quality gate.');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
