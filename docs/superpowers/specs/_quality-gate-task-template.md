# Quality Gate (Sonar) — Template de task obrigatória

> **Como usar:** copie a seção `## Task N` abaixo como **última task** de qualquer plano gerado via `/superpowers:writing-plans`. Substitua `N` pelo número correto. Esta task é **não-negociável** — sem ela, o push estará violando a política do CLAUDE.md.

---

## Task N: Quality Gate (Sonar) — obrigatória, sempre última

**Files:** N/A — esta task valida o trabalho das tasks anteriores.

- [ ] **Step 1: Garantir SonarQube de pé**

Run: `docker compose --profile sonar up -d`
Verificar: `curl -sf http://localhost:9000/api/system/status | grep '"status":"UP"'`
Expected: `"status":"UP"`. Se demorar, aguardar até 60s.

- [ ] **Step 2: Rodar coverage + scanner + aguardar gate**

Run: `pnpm sonar:check`
Expected: gate verde com mensagem `✅ Quality gate verde.`

- [ ] **Step 3: Se gate falhou, listar issues new-code**

Run: `curl -s -u "$SONAR_TOKEN:" "http://localhost:9000/api/issues/search?componentKeys=praktikus&resolved=false&inNewCodePeriod=true&ps=500" | jq '.issues[] | {key, rule, severity, message, component, line}'`

- [ ] **Step 4: Para cada issue, corrigir ou suprimir com justificativa**

- **Bug/vuln/duplicação real:** corrigir o código.
- **Falso positivo legítimo:** suprimir inline com `// NOSONAR(rule:S####) — <razão em pt-BR>`.

Re-rodar Step 2 até gate verde.

- [ ] **Step 5: Push autorizado**

Run: `git push`
Expected: pre-push hook valida silenciosamente e libera.
