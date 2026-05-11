# Setup — Claude for Chrome para Smoke E2E Recycling

Este doc cobre a **Fase 0** do [playbook](playbook-recycling-e2e.md). Faça esses passos no terminal antes de iniciar a conversa com o Claude for Chrome.

## Pré-requisitos no seu computador

- [x] Docker + Docker Compose
- [x] Node 18+ e pnpm 8+
- [x] Chrome com a extensão **Claude for Chrome** instalada e configurada com API key
- [x] (Opcional mas recomendado) **ngrok** ou **cloudflared** para expor o webhook do backend ao Asaas sandbox

## Passo 1: Subir a stack

```bash
docker compose up -d postgres redis backend frontend
```

Aguarde até `docker compose ps` mostrar tudo `healthy` ou `Up`. Tipicamente 30s.

Validar:
```bash
curl -sf http://localhost:3000/api/health || echo "backend não respondeu"
curl -sf http://localhost:8080 -o /dev/null && echo "frontend OK"
```

## Passo 2: Configurar Asaas sandbox

1. Crie/abra sua conta em `https://sandbox.asaas.com`.
2. **Integrações → Chave de API** → copie a chave.
3. Edite `apps/backend/.env` (e/ou `.env` raiz, dependendo de como o docker-compose injeta):

   ```bash
   ASAAS_API_KEY=<chave-do-sandbox>
   ASAAS_API_URL=https://sandbox.asaas.com/api/v3
   ASAAS_WEBHOOK_TOKEN=<token aleatório que você define>
   ```

4. **No painel Asaas sandbox**, **Integrações → Webhooks**:
   - URL: `https://<seu-túnel-ngrok>.ngrok-free.app/api/billing/webhook`
   - Token: mesmo valor de `ASAAS_WEBHOOK_TOKEN`
   - Eventos: marcar `PAYMENT_*`, `CHECKOUT_*`, `SUBSCRIPTION_INACTIVATED`
5. Restart backend pra pegar as envs:

   ```bash
   docker restart praktikus_backend
   ```

### Túnel para webhook (ngrok / cloudflared)

Se você não tiver ngrok/cloudflared, **pule esta etapa**. O popup do Asaas Checkout ainda abre (Fase 9), mas o webhook `CHECKOUT_PAID` não chega no backend local → cartão não aparece automaticamente em `PaymentMethodCard`. Você ainda valida o fluxo visual; só não valida a integração ponta-a-ponta.

Se tiver ngrok:
```bash
ngrok http 3000
```
Use a URL `https://xxx.ngrok-free.app/api/billing/webhook` no painel Asaas.

## Passo 3: Resetar o banco

```bash
pnpm --filter backend qa:reset-db
```

Esperado:
```
[reset-db] Resetting DB "praktikus" (NODE_ENV=development)...
[reset-db] DataSource initialized
[reset-db] Public schema dropped + recreated
[reset-db] Ran N migrations
[reset-db] Done. DB is empty + migrated. Ready for fresh signup.
```

**O script recusa rodar com `NODE_ENV=production`** — é seguro chamar localmente.

## Passo 4: Gerar persona

```bash
pnpm --filter backend qa:generate-data 1
```

Esperado: um JSON com 1 persona (CNPJ/CPF/email/etc.). Copie esse JSON para um arquivo temporário ou cole direto na conversa com o Claude na hora de iniciar a Fase 1.

Exemplo de saída:
```json
[
  {
    "razaoSocial": "EcoCompany Reciclagem LTDA",
    "nomeFantasia": "Sustentável Recicla",
    "cnpj": "12345678000195",
    "telefone": "11912345678",
    "cep": "01310100",
    "ownerName": "Maria Silva",
    "ownerEmail": "praktikus-qa-cli-0@mailinator.com",
    "ownerCpf": "12345678909",
    "ownerPassword": "Praktikus@2026"
  }
]
```

## Passo 5: Preparar o diretório da run

```bash
RUN_DATE=$(date +%Y-%m-%d)
mkdir -p docs/qa/runs/$RUN_DATE/screenshots
cp docs/qa/templates/relatorio-template.md docs/qa/runs/$RUN_DATE/relatorio.md
cp docs/qa/templates/running-log-template.md docs/qa/runs/$RUN_DATE/running-log.md
echo "Run dir: docs/qa/runs/$RUN_DATE/"
```

## Passo 6: Iniciar Claude for Chrome

1. Abra o Chrome com a extensão ativada e API key configurada.
2. Abra uma nova aba em `http://localhost:8080/register/segment` (a tela de escolha de segmento — começa do zero).
3. Abra a extensão Claude for Chrome.
4. **Cole na conversa, nesta ordem**:
   - Conteúdo de `docs/qa/playbook-recycling-e2e.md`.
   - O JSON da persona gerada no Passo 4 (rotulando como "`Persona para o teste`").
   - Uma linha final: "**Execute o playbook na ordem. Pause entre fases para meu OK.**" (ou "Execute tudo direto" se quiser autônomo).
5. Acompanhe a execução. Faça screenshots adicionais manualmente se algo curioso aparecer fora dos checkpoints.

## Após a execução

Veja a Seção "Pós-execução" do playbook.

## Solução de problemas

### Backend mostra 500 em `/api/billing/webhook`
- Verifique se o `ASAAS_WEBHOOK_TOKEN` bate entre `.env` e painel Asaas.
- Verifique logs: `docker logs praktikus_backend | tail -50`.

### Stack sobe mas frontend mostra "conexão recusada"
- Verifique se o frontend está apontando para `localhost:3000` (ver `apps/frontend/.env` ou variável `VITE_API_URL`).

### `qa:reset-db` falha com "permission denied"
- Confirme `DB_USER` e `DB_PASS` no `.env`. O usuário padrão é `praktikus`/`praktikus_dev` em dev.

### Claude for Chrome não interage com o popup Asaas
- É limitação esperada (cross-origin). Registre como nota no relatório e continue.
