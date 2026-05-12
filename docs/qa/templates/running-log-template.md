# Running Log — Recycling E2E {{YYYY-MM-DD}}

Cronologia da execução. Atualizado pelo Claude a cada checkpoint.

---

## Fase 0 — Setup (humano)

- **Início**: {{HH:MM}}
- **Stack subido**: docker compose ps mostra postgres, redis, backend, frontend UP
- **Asaas sandbox**: chave configurada em .env, webhook apontando para {{URL}}
- **DB resetado**: `pnpm --filter backend qa:reset-db` rodou sem erro
- **Persona gerada**: `pnpm --filter backend qa:generate-data 1` retornou {{CNPJ}}
- **Status**: PRONTO PARA CLAUDE
- **Fim**: {{HH:MM}} ({{X}}min)

---

## Fase 1 — Signup Recycling

- **Início**: {{HH:MM}}
- **Persona usada**: CNPJ {{cnpj}}, email {{email}}, senha "Praktikus@2026"
- **Checkpoints**:
  - [x/✗] CP1: Acessou /register/segment → screenshot phase1-cp1.png
  - [x/✗] CP2: Clicou em "Recicladoras" → redirect /register/recycling → screenshot phase1-cp2.png
  - [x/✗] CP3: Wizard passo 1 salvou OK → screenshot phase1-cp3.png
  - [x/✗] CP4: Wizard passo 2 + submit → redirect /recycling/dashboard → screenshot phase1-cp4.png
  - [x/✗] CP5: Banner trial "30 dias" visível → screenshot phase1-cp5.png
- **Anomalias**: {{descreva qualquer problema ou "nenhuma"}}
- **Bugs registrados**: {{lista de IDs ex: B-IMP-003}}
- **Fim**: {{HH:MM}} ({{X}}min)

---

## Fase 2 — Configurações iniciais

(Mesmo formato para cada uma das 11 fases.)

---

## Resumo final

- **Início absoluto**: {{HH:MM}}
- **Fim absoluto**: {{HH:MM}}
- **Tempo total**: {{Hh MMmin}}
- **Fases COMPLETAS**: {{N}}/11
- **Fases BLOCKED**: {{lista}}
- **Bugs encontrados**: {{contagem por severidade}}
- **Próximo passo**: relatorio.md está pronto em docs/qa/runs/{{YYYY-MM-DD}}/
