# Recuperação de senha + remoção de "Lembrar de mim"

**Data:** 2026-04-25
**Branch:** redesign/praktikus-v2 (ou nova branch)
**Escopo:** frontend (LoginPage + 2 páginas novas) + backend (auth module + mail service)

---

## Contexto

A `LoginPage` em `apps/frontend/src/pages/auth/LoginPage.tsx` tem hoje:

1. Um checkbox **"Lembrar de mim"** que é puramente visual — não envia nada para o backend, não é lido em parte alguma do código. É código morto.
2. Um link **"Esqueci a senha"** com `href="#"`. Ao clicar, o usuário não vai a lugar algum.

O backend (`apps/backend/src/modules/core/auth/`) tem `register`, `login`, `refresh-token`, mas **não tem endpoints de forgot/reset password**. Não há infraestrutura de envio de email instalada.

## Objetivo

1. Remover o checkbox "Lembrar de mim" da `LoginPage`.
2. Implementar fluxo end-to-end de recuperação de senha por email, com:
   - Página `/forgot-password` para o usuário pedir o link de reset.
   - Página `/reset-password/:token` onde o usuário define nova senha.
   - Backend que gera token seguro, envia email via Resend, e processa a redefinição.

## Decisões de design (validadas no brainstorming)

- **Provedor de email:** Resend (`pnpm --filter backend add resend`). Escolhido pela DX e free tier.
- **Token format:** random opaco (32 bytes hex) armazenado **como hash SHA-256** em tabela própria. Plaintext só viaja no email.
- **Validade do token:** 1 hora.
- **UX:** páginas dedicadas (`/forgot-password`, `/reset-password/:token`) reusando `<AuthShell>`, não modal.
- **Anti-enumeration:** `/auth/forgot-password` sempre retorna 204 — o cliente não consegue saber se o email existe. Mensagem na UI reflete: *"Se essa conta existir, enviamos um link…"*.
- **Sessões antigas:** após reset bem-sucedido, todos os refresh tokens do user são apagados (force-relogin em outros dispositivos).
- **Single-use:** token é marcado `usedAt = now` após reset; não pode ser reusado.
- **Modo dev:** quando `RESEND_API_KEY` está ausente, o `MailService` faz `console.log(resetUrl)` em vez de enviar — permite testar local sem provedor de email.

## Arquitetura

### Backend: nova entity

`apps/backend/src/modules/core/auth/password-reset-token.entity.ts`:

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | gerado |
| `user_id` | uuid (FK em `public.users`) | dono do token |
| `token_hash` | varchar(64) | `sha256(token_plaintext)` |
| `expires_at` | timestamptz | `created_at + 1h` |
| `used_at` | timestamptz, nullable | preenchido quando o reset acontece (ou ao invalidar tokens anteriores do mesmo user) |
| `created_at` | timestamptz | autogerado |

Índice em `token_hash` (lookup primário) e em `user_id` (invalidação por user).

Migration nova em `apps/backend/src/database/migrations/`. Tabela em `public` (usuários moram em `public`, não no schema-por-tenant).

### Backend: novo módulo Mail

`apps/backend/src/modules/core/mail/mail.module.ts` (e `mail.service.ts`).

```typescript
@Injectable()
export class MailService {
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
  }

  async sendPasswordReset(email: string, name: string, resetUrl: string): Promise<void> { ... }
  async sendPasswordChangedConfirmation(email: string, name: string): Promise<void> { ... }
}
```

Em modo dev (`this.resend === null`), faz `this.logger.log(\`[mail dev] reset url: ${resetUrl}\`)` e retorna sem erro. Em prod, envia via Resend e captura erros (loga com `userId` mas não relança — anti-enumeration).

Templates HTML inline no service (strings com `${...}` placeholders), em pt-BR. Branding mínimo: cabeçalho "Praktikus", saudação com `name`, botão com `resetUrl`, footer com tempo de validade ("válido por 1 hora").

`AuthModule` importa `MailModule`.

### Backend: variáveis de ambiente novas

| Variável | Default em dev | Descrição |
|---|---|---|
| `RESEND_API_KEY` | (ausente) | Token API. Se ausente, mail vai pra console. |
| `MAIL_FROM` | `Praktikus <no-reply@praktikus.com.br>` | Remetente |
| `APP_BASE_URL` | `http://localhost:5173` | Base do link de reset |

Adicionar à `.env.example` (se existir) e ao README/docker-compose se tiver.

### Backend: endpoints

#### `POST /auth/forgot-password`

DTO em `apps/backend/src/modules/core/auth/dto/forgot-password.dto.ts`:

```typescript
export class ForgotPasswordDto {
  @IsEmail() email: string;
}
```

Service: `AuthService.requestPasswordReset(email: string): Promise<void>`:

1. `user = await this.userRepo.findOne({ where: { email } })`
2. **Se `user === null`**: retorna silenciosamente. Não cria token, não chama mailer.
3. **Se user existe**:
   1. Invalida tokens anteriores: `UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = :userId AND used_at IS NULL`.
   2. Gera `token = crypto.randomBytes(32).toString('hex')` (64 chars).
   3. Calcula `tokenHash = crypto.createHash('sha256').update(token).digest('hex')`.
   4. Insere linha em `password_reset_tokens` com `expiresAt = now + 1h`.
   5. Monta `resetUrl = \`${APP_BASE_URL}/reset-password/${token}\``.
   6. `await this.mail.sendPasswordReset(user.email, user.name, resetUrl)` (try/catch — falha apenas loga, não propaga).

Controller responde `204 No Content` em todos os casos.

#### `POST /auth/reset-password`

DTO em `apps/backend/src/modules/core/auth/dto/reset-password.dto.ts`:

```typescript
export class ResetPasswordDto {
  @IsString() @IsNotEmpty() token: string;
  @IsString() @MinLength(8) newPassword: string;
}
```

Service: `AuthService.resetPassword(token: string, newPassword: string): Promise<void>`:

1. `tokenHash = sha256(token)`.
2. `record = await this.resetTokenRepo.findOne({ where: { tokenHash } })`
3. Validar:
   - `record` não null
   - `record.usedAt === null`
   - `record.expiresAt > now`
   - Se qualquer falhar: `throw new BadRequestException('Link inválido ou expirado.')`
4. `user = await this.userRepo.findOne({ where: { id: record.userId } })`
5. `user.passwordHash = await bcrypt.hash(newPassword, 10)` (round 10 — mesmo padrão do `register` e do `changePassword` existentes neste service).
6. Em uma transação Postgres (via `dataSource.transaction(async manager => ...)`):
   - `await manager.save(UserEntity, user)`
   - `await manager.update(PasswordResetTokenEntity, record.id, { usedAt: now })`
   - `await manager.delete(RefreshTokenEntity, { userId: user.id })` — invalida sessões existentes
7. Após a transação: fire-and-forget `void this.mail.sendPasswordChangedConfirmation(user.email, user.name)` (não aguarda; falha apenas loga).

Controller responde `204 No Content` em sucesso.

**Nota:** o método `changePassword` já existente em `auth.service.ts` (autenticado, requer senha atual) é o template do padrão de hash/save. `resetPassword` se diferencia em três pontos defensivos: validação por token em vez de senha atual, invalidação de refresh tokens (force-relogin) e email de confirmação. A diferença é justificada pelo vetor de risco (reset é mais sensível por não exigir prova de identidade prévia).

### Frontend: rotas e páginas

Adicionar em `apps/frontend/src/App.tsx`:

```tsx
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password/:token" element={<ResetPasswordPage />} />
```

#### `apps/frontend/src/pages/auth/ForgotPasswordPage.tsx`

Reusa `<AuthShell>`. Estrutura:

- Estado local: `submitted: boolean`.
- Form com Zod schema `{ email: z.string().email() }`.
- Submit chama `authService.forgotPassword(email)` → `POST /auth/forgot-password`. Em sucesso, set `submitted = true`.
- Se `submitted`: renderiza success state (em vez do form):
  - Título: "Confira seu e-mail"
  - Texto: "Se essa conta existir, enviamos um link para recuperar sua senha. Verifique sua caixa de entrada e o spam."
  - Link `<Link to="/login">← Voltar ao login</Link>`
- Se erro de rede: exibe `<CAlert color="danger">` com mensagem genérica `"Erro ao processar solicitação. Tente novamente."`.

#### `apps/frontend/src/pages/auth/ResetPasswordPage.tsx`

Reusa `<AuthShell>`. Captura `token` via `useParams<{ token: string }>()`.

Estados locais: `success: boolean`, `error: string | null`.

Form com Zod schema:

```typescript
const schema = z.object({
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: 'Senhas não conferem',
  path: ['confirmPassword'],
});
```

Submit chama `authService.resetPassword(token, password)`:

- Sucesso: `success = true`. Renderiza tela de sucesso com título "Senha redefinida!" e botão `<Link to="/login">Ir para login</Link>`.
- Erro 400 com `"Link inválido ou expirado."`: set `error` e renderiza `<CAlert color="danger">` com a mensagem + botão `<Link to="/forgot-password">Pedir novo link</Link>`.

#### `LoginPage.tsx` — alterações

Em `apps/frontend/src/pages/auth/LoginPage.tsx`, no bloco entre linhas ~108 e ~138:

**Antes:**

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
  <label style={{ ... }}>
    <input type="checkbox" /> Lembrar de mim
  </label>
  <a href="#" style={{ ... }}>Esqueci a senha</a>
</div>
```

**Depois:**

```tsx
<div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 2 }}>
  <Link to="/forgot-password" style={{
    fontSize: 13,
    color: 'var(--cui-primary)',
    textDecoration: 'none',
    fontWeight: 500,
  }}>
    Esqueci a senha
  </Link>
</div>
```

`Link` já é importado do `react-router-dom` no arquivo.

#### `authService.ts` — métodos novos

Em `apps/frontend/src/services/auth.service.ts`, adicionar:

```typescript
async forgotPassword(email: string): Promise<void> {
  await api.post('/auth/forgot-password', { email });
},

async resetPassword(token: string, newPassword: string): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
},
```

## Testes

### Backend (unit)

Em `apps/backend/src/modules/core/auth/auth.service.spec.ts`, 5 casos novos:

1. `requestPasswordReset` com email inexistente: `userRepo.findOne` retorna null. Verificar que `resetTokenRepo.save` NÃO foi chamado e `mail.sendPasswordReset` NÃO foi chamado. Função retorna sem erro.
2. `requestPasswordReset` com email existente: cria token (verifica que o `tokenHash` é hex de 64 chars, e que NÃO é o token plaintext). Invalida tokens anteriores (verifica `update` em `usedAt`). Chama mail com a URL contendo o token plaintext (capturar via mock e validar formato).
3. `resetPassword` com token válido: bcrypt da nova senha, salva user, marca token `usedAt`, deleta refresh tokens do user.
4. `resetPassword` com token expirado: throw `BadRequestException('Link inválido ou expirado.')`. Senha do user NÃO muda.
5. `resetPassword` com token já usado: throw `BadRequestException`. Senha NÃO muda.

Em `apps/backend/src/modules/core/mail/mail.service.spec.ts`:

- Modo dev (sem `RESEND_API_KEY`): chama `sendPasswordReset` e verifica que `console.log` (ou logger) recebeu a URL. Não chama Resend SDK.
- Modo prod: mock do `Resend.emails.send`, verifica payload (`from`, `to`, `subject`, `html` contendo o `resetUrl`).

### Frontend

Sem testes RTL específicos para as duas novas páginas — consistente com decisão das ondas anteriores. Smoke test manual:

1. Login → "Esqueci a senha" → navega para `/forgot-password`.
2. Submeter email → success state.
3. Em dev, copiar URL do console do backend, abrir → `/reset-password/<token>`.
4. Submeter senha nova (≥ 8 chars, confirm igual) → success state.
5. Tentar logar com senha antiga → falha (refresh tokens deletados também invalidam sessões antigas).
6. Logar com senha nova → sucesso.

## Riscos e mitigações

- **Token vazado em logs/Sentry/erros do mailer:** mitigado armazenando só o hash no DB. Logs do mailer devem conter apenas `userId`, nunca o token plaintext.
- **Email vai para spam:** Resend tem boa entregabilidade. Configuração de SPF/DKIM no domínio do `MAIL_FROM` é responsabilidade operacional (DNS) — fora do escopo de código mas necessária pra produção.
- **Brute-force em `/auth/forgot-password` para enumerar emails:** mitigado por sempre retornar 204 e pela mensagem genérica na UI. Rate limiting é defesa adicional. `@nestjs/throttler` **não está** no projeto hoje (verificado). Aplicar throttler é deixado como **follow-up não-bloqueante**: se for adicionado depois, o decorator vai no controller (`@Throttle({ default: { limit: 5, ttl: 60_000 } })`).
- **Sessão antiga após reset:** invalidar refresh tokens cuida disso. O access token atual ainda vale até expirar (~15 min); aceitamos esse risco residual.
- **Janela de uso do token:** validade de 1 hora é equilíbrio razoável (usuário pode demorar a abrir o email). Reduzir para 30 min é trivial se for desejável.
- **Race condition em "invalidar tokens anteriores + criar novo":** dois pedidos simultâneos do mesmo email podem deixar dois tokens válidos por uma janela mínima. Aceitável — ambos são invalidados quando um é usado (refresh token delete + único token marcado usado), e o atacante precisaria já ter acesso ao email em si.

## Fora de escopo

- 2FA / MFA
- Magic link login (sem senha) — pattern diferente, feature separada
- Internacionalização do conteúdo do email (texto fixo em pt-BR)
- Tela de "alterar senha" no perfil do usuário logado — outra feature
- Rate limiting via `@nestjs/throttler` — follow-up não-bloqueante
- Notificação por SMS/WhatsApp do reset — fora de escopo
