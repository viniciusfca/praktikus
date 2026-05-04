#!/usr/bin/env node
/**
 * Bootstrap idempotente do SonarQube local pra Praktikus.
 * Cria: senha admin (se ainda for default), projeto, quality gate, token.
 * Pode rodar várias vezes sem efeito colateral.
 */

const HOST = process.env.SONAR_HOST ?? 'http://localhost:9000';
const PROJECT_KEY = 'praktikus';
const PROJECT_NAME = 'Praktikus';
const GATE_NAME = 'Praktikus';
const NEW_ADMIN_PASS = 'Praktikus@2026!';
const TOKEN_NAME = 'praktikus-local';

export function buildBasicAuth(user, pass) {
  return 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64');
}

export function qualityGateConditions() {
  // Cada condição: gate falha se a métrica em new code violar o limite.
  // op=GT (greater than), op=LT (less than). error é o threshold.
  return [
    // Reliability rating em new code: A=1, B=2, C=3, D=4, E=5. Bug = degrada o rating.
    // GT 1 = falha se houver QUALQUER bug em new code.
    { metric: 'new_reliability_rating', op: 'GT', error: '1' },
    // Security rating em new code: idem. Vuln = degrada rating.
    { metric: 'new_security_rating', op: 'GT', error: '1' },
    // % de hotspots novos revisados. LT 100 = falha se < 100% revisados.
    { metric: 'new_security_hotspots_reviewed', op: 'LT', error: '100' },
    // Duplicação em new code. GT 3 = falha se > 3%.
    { metric: 'new_duplicated_lines_density', op: 'GT', error: '3' },
    // Coverage em new code. LT 80 = falha se < 80%.
    { metric: 'new_coverage', op: 'LT', error: '80' },
  ];
}

export function isAlreadyExists(body) {
  if (!body || !Array.isArray(body.errors)) return false;
  return body.errors.some((e) => {
    const msg = e.msg ?? '';
    // Sonar usa duas variações: "already exists" (projetos) e
    // "has already been taken" (quality gates).
    return /already exists/i.test(msg) || /already been taken/i.test(msg);
  });
}

async function http(method, path, auth, body) {
  const url = `${HOST}${path}`;
  const headers = { Authorization: auth };
  let init = { method, headers };
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = new URLSearchParams(body).toString();
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* not json */ }
  return { status: res.status, body: json, raw: text };
}

async function login(user, pass) {
  const auth = buildBasicAuth(user, pass);
  const { status, body } = await http('GET', '/api/authentication/validate', auth);
  // /api/authentication/validate retorna 200 mesmo com senha errada,
  // mas o body traz {"valid":false}. Precisa checar os dois.
  if (status === 200 && body?.valid === true) return auth;
  throw new Error(`Login falhou para ${user}`);
}

async function changeAdminPasswordIfDefault() {
  // Tenta com nova senha primeiro
  try {
    return await login('admin', NEW_ADMIN_PASS);
  } catch { /* não é a nova ainda */ }

  const adminAuth = await login('admin', 'admin');
  const { status, body } = await http('POST', '/api/users/change_password', adminAuth, {
    login: 'admin',
    previousPassword: 'admin',
    password: NEW_ADMIN_PASS,
  });
  if (status !== 204 && status !== 200) {
    throw new Error(`Falha ao trocar senha admin: ${status} ${JSON.stringify(body)}`);
  }
  console.log('✅ Senha admin atualizada');
  return await login('admin', NEW_ADMIN_PASS);
}

async function ensureProject(auth) {
  const { status, body } = await http('POST', '/api/projects/create', auth, {
    project: PROJECT_KEY,
    name: PROJECT_NAME,
  });
  if (status === 200) {
    console.log('✅ Projeto criado:', PROJECT_KEY);
    return;
  }
  if (isAlreadyExists(body)) {
    console.log('ℹ️  Projeto já existe:', PROJECT_KEY);
    return;
  }
  throw new Error(`Falha ao criar projeto: ${status} ${JSON.stringify(body)}`);
}

async function ensureQualityGate(auth) {
  // Cria o gate (se já existe, ok)
  const { status, body } = await http('POST', '/api/qualitygates/create', auth, {
    name: GATE_NAME,
  });
  let gateId;
  if (status === 200) {
    gateId = body.id;
    console.log('✅ Quality gate criado:', GATE_NAME);
  } else if (isAlreadyExists(body)) {
    const list = await http('GET', '/api/qualitygates/list', auth);
    const found = list.body?.qualitygates?.find((g) => g.name === GATE_NAME);
    if (!found) throw new Error('Gate "Praktikus" alegadamente existe mas não foi encontrado.');
    gateId = found.id;
    console.log('ℹ️  Quality gate já existe:', GATE_NAME);
  } else {
    throw new Error(`Falha ao criar gate: ${status} ${JSON.stringify(body)}`);
  }

  // Garantir condições — primeiro busca as existentes
  const show = await http('GET', `/api/qualitygates/show?name=${encodeURIComponent(GATE_NAME)}`, auth);
  const existing = show.body?.conditions ?? [];

  for (const desired of qualityGateConditions()) {
    const match = existing.find((c) => c.metric === desired.metric);
    if (match && match.op === desired.op && String(match.error) === String(desired.error)) {
      continue; // Já correto
    }
    if (match) {
      // Atualiza
      await http('POST', '/api/qualitygates/update_condition', auth, {
        id: match.id,
        metric: desired.metric,
        op: desired.op,
        error: desired.error,
      });
      console.log(`  ✓ condição atualizada: ${desired.metric}`);
    } else {
      // Cria nova
      await http('POST', '/api/qualitygates/create_condition', auth, {
        gateName: GATE_NAME,
        metric: desired.metric,
        op: desired.op,
        error: desired.error,
      });
      console.log(`  ✓ condição criada: ${desired.metric} ${desired.op} ${desired.error}`);
    }
  }

  // Atribui o gate ao projeto
  await http('POST', '/api/qualitygates/select', auth, {
    gateName: GATE_NAME,
    projectKey: PROJECT_KEY,
  });
  console.log(`✅ Gate "${GATE_NAME}" atribuído ao projeto ${PROJECT_KEY}`);
}

async function ensureToken(auth) {
  // Revoga token antigo com mesmo nome (se houver) pra emitir novo
  await http('POST', '/api/user_tokens/revoke', auth, { name: TOKEN_NAME });

  const { status, body } = await http('POST', '/api/user_tokens/generate', auth, {
    name: TOKEN_NAME,
    type: 'PROJECT_ANALYSIS_TOKEN',
    projectKey: PROJECT_KEY,
  });
  if (status !== 200) {
    throw new Error(`Falha ao gerar token: ${status} ${JSON.stringify(body)}`);
  }
  return body.token;
}

async function main() {
  console.log('🚀 Bootstrap SonarQube em', HOST);

  // Aguarda Sonar UP
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${HOST}/api/system/status`);
      const j = await r.json();
      if (j.status === 'UP') break;
      console.log(`  Sonar status: ${j.status} (tentativa ${i + 1}/60)`);
    } catch {
      console.log(`  Sonar inacessível (tentativa ${i + 1}/60)`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const auth = await changeAdminPasswordIfDefault();
  await ensureProject(auth);
  await ensureQualityGate(auth);
  const token = await ensureToken(auth);

  console.log('\n────────────────────────────────────────');
  console.log('✅ Bootstrap concluído.');
  console.log('SONAR_TOKEN=' + token);
  console.log('────────────────────────────────────────');
  console.log('\nAdicione esta linha ao seu apps/backend/.env (não commite):');
  console.log(`  SONAR_TOKEN=${token}`);
}

// Só roda main se este arquivo for o entry point (não em import dos testes)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
