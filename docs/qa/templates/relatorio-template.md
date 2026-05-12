# Relatório de Teste E2E — Segmento Recycling

**Data**: {{YYYY-MM-DD}}
**Ambiente**: Local + Asaas sandbox
**Branch / SHA**: {{branch}} / {{sha}}
**Tempo total**: {{Hh MMmin}}
**Status**: COMPLETO | PARCIAL (bloqueado na Fase X)

---

## Resumo executivo

| Severidade | Quantidade |
|------------|-----------|
| 🚨 Críticos | {{X}} |
| ⚠️ Importantes | {{Y}} |
| 💡 Melhorias UX | {{Z}} |
| ✓ Fluxos validados | {{N}}/11 fases |

**Top 3 riscos**:
1. {{descrição do problema mais grave}}
2. {{segundo}}
3. {{terceiro}}

---

## 🚨 Bugs Críticos

### B-CRIT-001: {{Título descritivo}}

**Fase**: {{N — Nome da fase}}

**Como reproduzir**:
1. {{passo 1}}
2. {{passo 2}}
3. {{...}}

**Esperado**: {{comportamento esperado}}

**Observado**: {{comportamento real}}

**Screenshot**: [{{phaseN-cpM-descricao.png}}](screenshots/{{phaseN-cpM-descricao.png}})

**Notas**: {{erros de console, request 500, payload anômalo, etc.}}

---

## ⚠️ Bugs Importantes

### B-IMP-001: {{Título}}

(Mesmo formato de B-CRIT.)

---

## 💡 Melhorias UX

### UX-001: {{Título}}

**Fase**: {{N — Nome}}

**Contexto**: {{quando observado}}

**Sugestão**: {{melhoria proposta}}

**Screenshot**: [{{path}}](screenshots/{{path}})

---

## ✓ Fluxos validados

Marcar com `[x]` o que passou, `[ ]` o que bloqueou.

- [ ] Fase 1 — Signup Recycling
- [ ] Fase 2 — Configurações iniciais
- [ ] Fase 3 — Cadastros base (produtos, fornecedores, compradores)
- [ ] Fase 4 — Abrir caixa
- [ ] Fase 5 — Compras
- [ ] Fase 6 — Coletas
- [ ] Fase 7 — Vendas
- [ ] Fase 8 — Relatórios (dashboard + reports)
- [ ] Fase 9 — Billing self-service (Asaas Checkout)
- [ ] Fase 10 — Fechar caixa
- [ ] Fase 11 — Logout + relogin (validar TTL 8h)

---

## Apêndice

### Dados gerados durante o teste

- **Tenant**: CNPJ {{cnpj}}, Razão Social "{{razao}}"
- **OWNER user**: email `{{email}}`
- **Fornecedores criados**: {{lista}}
- **Compradores criados**: {{lista}}
- **Produtos**: {{lista}}

### Ambiente

- Node {{vX.Y.Z}} / pnpm {{vA.B.C}} / Docker stack
- Backend SHA: {{sha}}
- Asaas: sandbox.asaas.com ({{token nickname}})
- Resend: dev mode (console.log only)
- Webhook Asaas: {{ngrok URL ou "não configurado"}}

### Running log

Ver [running-log.md](running-log.md) para timeline detalhada com timestamps.
