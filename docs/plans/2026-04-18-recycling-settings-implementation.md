# Recycling Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the white-screen bug on `/recycling/settings` by registering the route and creating a per-segment Settings page, extracting 3 shared tabs (Empresa/Conta/Assinatura) out of the monolithic workshop `SettingsPage.tsx` into `src/components/settings/` and adding a new `UnitsTab` specific to recycling.

**Architecture:** Share self-contained tab components across segments via `src/components/settings/`. Each segment's `SettingsPage` is a thin composition that chooses which tabs to render and redirects non-OWNER users to its own dashboard. The existing `unitsService` powers the new Units tab.

**Tech Stack:** React 19 + Vite + TypeScript + CoreUI (`@coreui/react`) + react-hook-form + zod + react-router-dom v7. Tests with Vitest + React Testing Library + jsdom. No new deps.

---

## Context for implementer

Working directory: `/home/vinicius/Projetos/vinicius/praktikus/apps/frontend`. Run all `npx tsc` / `pnpm test` commands from there.

**Commit style:** `tipo(escopo): descrição` — e.g. `feat(settings): ...`, `refactor(settings): ...`. Pass `--no-gpg-sign` to `git commit` (repo has `commit.gpgsign=true` with SSH key that needs a passphrase not available in this environment; user has authorized skipping signing).

**Test philosophy here:** The existing frontend has no component-level tests for CRUD pages (CatalogPage, CustomersPage etc. have none). Don't introduce a new testing pattern — rely on `tsc --noEmit` and manual browser verification for refactors. The only test file this plan adds is a smoke test for the new `UnitsTab`, matching the existing `App.test.tsx` pattern.

**Typecheck command:** `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20` — we filter `recycling/purchases` because that path has pre-existing unrelated errors (missing `@praktikus/shared` types) that aren't relevant to this work.

---

## File Structure

**Create:**
- `src/components/settings/Card.tsx` — `Card`, `CardTitle`, and `labelStyle` helpers (one responsibility: presentation primitives used by all Settings tabs)
- `src/components/settings/CompanyTab.tsx` — Empresa tab: logo upload, form fields, address. Self-contained state.
- `src/components/settings/AccountTab.tsx` — Minha conta tab: password change. Self-contained state.
- `src/components/settings/SubscriptionTab.tsx` — Assinatura tab: status banner + billing info. Self-contained state.
- `src/pages/recycling/settings/SettingsPage.tsx` — Recycling composition: [Empresa, Unidades, Conta, Assinatura]
- `src/pages/recycling/settings/UnitsTab.tsx` — CRUD of `units` using existing `unitsService`
- `src/pages/recycling/settings/UnitsTab.test.tsx` — smoke test

**Modify:**
- `src/pages/workshop/settings/SettingsPage.tsx` — slim composition: [Empresa, Conta, Assinatura]
- `src/App.tsx` — register `<Route path="settings" element={<RecyclingSettingsPage />} />`

---

## Task 1: Extract Card + labelStyle to shared module

**Files:**
- Create: `src/components/settings/Card.tsx`

- [ ] **Step 1.1: Create the shared Card module**

Write `src/components/settings/Card.tsx` with exactly this content:

```tsx
import type { ReactNode } from 'react';

export const labelStyle = { fontWeight: 500, fontSize: 13 };

interface CardProps {
  children: ReactNode;
  header?: ReactNode;
  padding?: number | string;
}

export function Card({ children, header, padding = 20 }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--cui-card-bg)',
        border: '1px solid var(--cui-border-color)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {header && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--cui-border-color)' }}>
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

interface CardTitleProps {
  title: string;
  desc?: string;
}

export function CardTitle({ title, desc }: CardTitleProps) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
      {desc && (
        <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 1.2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output (no new errors).

- [ ] **Step 1.3: Commit**

```bash
git add src/components/settings/Card.tsx
git commit --no-gpg-sign -m "refactor(settings): extract Card and CardTitle to shared module"
```

---

## Task 2: Extract CompanyTab to shared module

**Files:**
- Create: `src/components/settings/CompanyTab.tsx`

- [ ] **Step 2.1: Create the CompanyTab file**

Write `src/components/settings/CompanyTab.tsx` with exactly this content:

```tsx
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCloudUpload } from '@coreui/icons';
import { Card, CardTitle, labelStyle } from './Card';
import {
  companyService,
  type CompanyProfile,
  type UpdateCompanyPayload,
} from '../../services/company.service';

const companySchema = z.object({
  nomeFantasia: z.string().min(2, 'Mínimo 2 caracteres'),
  razaoSocial: z.string().min(3, 'Mínimo 3 caracteres'),
  telefone: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
});
type CompanyForm = z.infer<typeof companySchema>;

export function CompanyTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<CompanyForm>({ resolver: zodResolver(companySchema) });

  useEffect(() => {
    companyService.getProfile().then((p) => {
      setProfile(p);
      reset({
        nomeFantasia: p.nomeFantasia,
        razaoSocial: p.razaoSocial,
        telefone: p.telefone ?? '',
        street: p.endereco?.street ?? '',
        number: p.endereco?.number ?? '',
        complement: p.endereco?.complement ?? '',
        city: p.endereco?.city ?? '',
        state: p.endereco?.state ?? '',
        zip: p.endereco?.zip ?? '',
      });
      setLoading(false);
    }).catch(() => {
      setError('Erro ao carregar dados da empresa.');
      setLoading(false);
    });
  }, [reset]);

  const onSubmit = async (data: CompanyForm) => {
    setSuccess(null);
    setError(null);
    try {
      const payload: UpdateCompanyPayload = {
        nomeFantasia: data.nomeFantasia,
        razaoSocial: data.razaoSocial,
        telefone: data.telefone,
        endereco: {
          street: data.street ?? '',
          number: data.number ?? '',
          complement: data.complement,
          city: data.city ?? '',
          state: data.state ?? '',
          zip: data.zip ?? '',
        },
      };
      const updated = await companyService.updateProfile(payload);
      setProfile(updated);
      setSuccess('Dados salvos com sucesso.');
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    setError(null);
    try {
      const updated = await companyService.uploadLogo(file);
      setProfile(updated);
      setSuccess('Logo atualizada.');
    } catch {
      setError('Erro ao enviar logo. Use JPG ou PNG (máx. 2 MB).');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {success && <CAlert color="success" className="mb-0">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      {/* Logo card */}
      <Card header={<CardTitle title="Logo" desc="Aparece no PDF da OS e em comunicações" />}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {profile?.logoUrl ? (
            <img
              src={profile.logoUrl}
              alt="Logo"
              style={{
                width: 72,
                height: 72,
                objectFit: 'contain',
                borderRadius: 10,
                border: '1px solid var(--cui-border-color)',
                background: 'var(--cui-card-cap-bg)',
                padding: 6,
              }}
            />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 10,
                border: '1px dashed var(--cui-border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--cui-secondary-color)',
                background: 'var(--cui-card-cap-bg)',
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              Logo
            </div>
          )}
          <div style={{ flex: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              style={{ display: 'none' }}
              onChange={handleLogoChange}
            />
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              disabled={logoUploading}
              onClick={() => fileInputRef.current?.click()}
              style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {logoUploading ? (
                <CSpinner size="sm" />
              ) : (
                <>
                  <CIcon icon={cilCloudUpload} size="sm" />
                  {profile?.logoUrl ? 'Trocar logo' : 'Enviar logo'}
                </>
              )}
            </CButton>
            <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)', marginTop: 6 }}>
              JPG ou PNG, máx. 2 MB
            </div>
          </div>
        </div>
      </Card>

      {/* Dados da empresa */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card header={<CardTitle title="Dados da empresa" desc="Razão social, nome fantasia e contato" />}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <CFormLabel style={labelStyle}>Nome fantasia</CFormLabel>
              <CFormInput {...register('nomeFantasia')} invalid={!!errors.nomeFantasia} />
              {errors.nomeFantasia && <CFormFeedback invalid>{errors.nomeFantasia.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Razão social</CFormLabel>
              <CFormInput {...register('razaoSocial')} invalid={!!errors.razaoSocial} />
              {errors.razaoSocial && <CFormFeedback invalid>{errors.razaoSocial.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Telefone</CFormLabel>
              <CFormInput {...register('telefone')} placeholder="(11) 3333-4444" />
            </div>
          </div>
        </Card>

        {/* Endereço */}
        <div style={{ marginTop: 16 }}>
          <Card header={<CardTitle title="Endereço" desc="Endereço fiscal da empresa" />}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>
              <div style={{ gridColumn: 'span 8' }}>
                <CFormLabel style={labelStyle}>Rua</CFormLabel>
                <CFormInput {...register('street')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>Número</CFormLabel>
                <CFormInput {...register('number')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>CEP</CFormLabel>
                <CFormInput {...register('zip')} placeholder="00000-000" />
              </div>
              <div style={{ gridColumn: 'span 4' }}>
                <CFormLabel style={labelStyle}>Complemento</CFormLabel>
                <CFormInput {...register('complement')} />
              </div>
              <div style={{ gridColumn: 'span 6' }}>
                <CFormLabel style={labelStyle}>Cidade</CFormLabel>
                <CFormInput {...register('city')} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <CFormLabel style={labelStyle}>Estado</CFormLabel>
                <CFormInput {...register('state')} maxLength={2} placeholder="SP" />
              </div>
            </div>
          </Card>
        </div>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <CButton type="submit" color="primary" disabled={isSubmitting} style={{ borderRadius: 8, minWidth: 120 }}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar alterações'}
          </CButton>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 2.2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 2.3: Commit**

```bash
git add src/components/settings/CompanyTab.tsx
git commit --no-gpg-sign -m "refactor(settings): extract CompanyTab to shared module"
```

---

## Task 3: Extract AccountTab to shared module

**Files:**
- Create: `src/components/settings/AccountTab.tsx`

- [ ] **Step 3.1: Create the AccountTab file**

Write `src/components/settings/AccountTab.tsx` with exactly this content:

```tsx
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CSpinner,
} from '@coreui/react';
import { Card, CardTitle, labelStyle } from './Card';
import { authService } from '../../services/auth.service';

const passwordSchema = z
  .object({
    currentPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
type PasswordForm = z.infer<typeof passwordSchema>;

export function AccountTab() {
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<PasswordForm>({ resolver: zodResolver(passwordSchema) });

  const onSubmit = async (data: PasswordForm) => {
    setSuccess(null);
    setError(null);
    try {
      await authService.changePassword(data.currentPassword, data.newPassword);
      setSuccess('Senha alterada com sucesso.');
      reset();
    } catch {
      setError('Senha atual incorreta ou erro ao alterar.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {success && <CAlert color="success" className="mb-0">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-0">{error}</CAlert>}

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card header={<CardTitle title="Alterar senha" desc="Defina uma nova senha de acesso" />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 440 }}>
            <div>
              <CFormLabel style={labelStyle}>Senha atual</CFormLabel>
              <CFormInput
                type="password"
                {...register('currentPassword')}
                invalid={!!errors.currentPassword}
              />
              {errors.currentPassword && <CFormFeedback invalid>{errors.currentPassword.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Nova senha</CFormLabel>
              <CFormInput
                type="password"
                {...register('newPassword')}
                invalid={!!errors.newPassword}
              />
              {errors.newPassword && <CFormFeedback invalid>{errors.newPassword.message}</CFormFeedback>}
            </div>
            <div>
              <CFormLabel style={labelStyle}>Confirmar nova senha</CFormLabel>
              <CFormInput
                type="password"
                {...register('confirmPassword')}
                invalid={!!errors.confirmPassword}
              />
              {errors.confirmPassword && <CFormFeedback invalid>{errors.confirmPassword.message}</CFormFeedback>}
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <CButton type="submit" color="primary" disabled={isSubmitting} style={{ borderRadius: 8, minWidth: 120 }}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Alterar senha'}
          </CButton>
        </div>
      </form>
    </div>
  );
}
```

- [ ] **Step 3.2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 3.3: Commit**

```bash
git add src/components/settings/AccountTab.tsx
git commit --no-gpg-sign -m "refactor(settings): extract AccountTab to shared module"
```

---

## Task 4: Extract SubscriptionTab to shared module

**Files:**
- Create: `src/components/settings/SubscriptionTab.tsx`

- [ ] **Step 4.1: Create the SubscriptionTab file**

Write `src/components/settings/SubscriptionTab.tsx` with exactly this content:

```tsx
import { useEffect, useState } from 'react';
import { CAlert, CButton, CSpinner } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilCheck, cilExternalLink } from '@coreui/icons';
import { Card, CardTitle } from './Card';
import { companyService, type CompanyProfile } from '../../services/company.service';

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; border: string }> = {
  TRIAL:     { label: 'Trial',     color: 'var(--cui-primary)', bg: 'rgba(52, 142, 145, 0.1)',  border: 'rgba(52, 142, 145, 0.3)' },
  ACTIVE:    { label: 'Ativo',     color: '#15803d',            bg: 'rgba(22, 163, 74, 0.1)',   border: 'rgba(22, 163, 74, 0.3)' },
  OVERDUE:   { label: 'Em atraso', color: '#b45309',            bg: 'rgba(217, 119, 6, 0.1)',   border: 'rgba(217, 119, 6, 0.3)' },
  SUSPENDED: { label: 'Suspenso',  color: '#b91c1c',            bg: 'rgba(220, 38, 38, 0.1)',   border: 'rgba(220, 38, 38, 0.3)' },
};

export function SubscriptionTab() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    companyService.getProfile()
      .then(setProfile)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-4"><CSpinner size="sm" color="primary" /></div>;
  if (error || !profile) return <CAlert color="danger">Erro ao carregar dados de assinatura.</CAlert>;

  const statusInfo = STATUS_MAP[profile.status] ?? {
    label: profile.status,
    color: 'var(--cui-secondary-color)',
    bg: 'rgba(107,114,128,0.1)',
    border: 'rgba(107,114,128,0.3)',
  };

  const nextDate = profile.status === 'TRIAL' ? profile.trialEndsAt : profile.billingAnchorDate;
  const formattedDate = nextDate ? new Date(nextDate).toLocaleDateString('pt-BR') : '—';
  const dateLabel =
    profile.status === 'TRIAL'
      ? 'Fim do trial'
      : profile.status === 'OVERDUE'
        ? 'Vencimento em atraso'
        : 'Próxima cobrança';

  let trialDaysLeft: number | null = null;
  if (profile.status === 'TRIAL' && profile.trialEndsAt) {
    const diff = new Date(profile.trialEndsAt).getTime() - Date.now();
    trialDaysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 720 }}>
      {/* Highlight banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          padding: 18,
          background: statusInfo.bg,
          border: `1px solid ${statusInfo.border}`,
          borderRadius: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: statusInfo.color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <CIcon icon={cilCheck} size="lg" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cui-body-color)' }}>
            {profile.status === 'TRIAL' && trialDaysLeft !== null
              ? `Seu trial termina em ${trialDaysLeft} dia${trialDaysLeft !== 1 ? 's' : ''}`
              : profile.status === 'ACTIVE'
                ? 'Sua assinatura está ativa'
                : profile.status === 'OVERDUE'
                  ? 'Há um pagamento em atraso'
                  : 'Assinatura suspensa'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)', marginTop: 2 }}>
            {profile.status === 'TRIAL'
              ? 'Ative um plano para continuar sem interrupção.'
              : `${dateLabel}: ${formattedDate}`}
          </div>
        </div>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: '#fff',
            color: statusInfo.color,
            fontSize: 11.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            border: `1px solid ${statusInfo.border}`,
          }}
        >
          {statusInfo.label}
        </span>
      </div>

      {/* Billing info */}
      <Card header={<CardTitle title="Informações de cobrança" />}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Status
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--cui-body-color)' }}>
              {statusInfo.label}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: 11,
                color: 'var(--cui-secondary-color)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              {dateLabel}
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: 'var(--cui-body-color)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formattedDate}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <CButton
            color="primary"
            variant="outline"
            href="https://www.asaas.com/login"
            target="_blank"
            rel="noopener noreferrer"
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Gerenciar assinatura <CIcon icon={cilExternalLink} size="sm" />
          </CButton>
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4.2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 4.3: Commit**

```bash
git add src/components/settings/SubscriptionTab.tsx
git commit --no-gpg-sign -m "refactor(settings): extract SubscriptionTab to shared module"
```

---

## Task 5: Slim down workshop SettingsPage to composition-only

**Files:**
- Modify: `src/pages/workshop/settings/SettingsPage.tsx` (full rewrite — 614 → ~65 lines)

- [ ] **Step 5.1: Replace the file content**

Overwrite `src/pages/workshop/settings/SettingsPage.tsx` with exactly this content:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBuilding, cilUser, cilCreditCard } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { useAuthStore } from '../../../store/auth.store';
import { CompanyTab } from '../../../components/settings/CompanyTab';
import { AccountTab } from '../../../components/settings/AccountTab';
import { SubscriptionTab } from '../../../components/settings/SubscriptionTab';

const TABS = [
  { label: 'Empresa', icon: cilBuilding },
  { label: 'Minha conta', icon: cilUser },
  { label: 'Assinatura', icon: cilCreditCard },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/workshop/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'OWNER') return null;

  return (
    <>
      <PageHead title="Configurações" subtitle="Gerencie os dados da sua empresa, conta e assinatura" />

      <div style={{ borderBottom: '1px solid var(--cui-border-color)', marginBottom: 20 }}>
        <CNav variant="tabs" className="pk-tabs" style={{ border: 0 }}>
          {TABS.map((t, i) => (
            <CNavItem key={t.label}>
              <CNavLink
                active={activeTab === i}
                onClick={() => setActiveTab(i)}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={t.icon} size="sm" /> {t.label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 0}><CompanyTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><AccountTab /></CTabPane>
        <CTabPane visible={activeTab === 2}><SubscriptionTab /></CTabPane>
      </CTabContent>
    </>
  );
}
```

- [ ] **Step 5.2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 5.3: Manual browser verification**

Start the dev server (if not running): `pnpm --filter frontend dev`. In the browser:
1. Log in as a workshop OWNER
2. Navigate to `/workshop/settings`
3. Click each of the three tabs (Empresa, Minha conta, Assinatura)
4. Confirm forms load (Empresa fields populated, Assinatura banner renders, Minha conta form shows)

If any tab is broken, STOP and debug — do not proceed.

- [ ] **Step 5.4: Commit**

```bash
git add src/pages/workshop/settings/SettingsPage.tsx
git commit --no-gpg-sign -m "refactor(settings): slim workshop SettingsPage to shared tab composition"
```

---

## Task 6: Create UnitsTab with CRUD

**Files:**
- Create: `src/pages/recycling/settings/UnitsTab.tsx`
- Create: `src/pages/recycling/settings/UnitsTab.test.tsx`

- [ ] **Step 6.1: Create the UnitsTab file**

Write `src/pages/recycling/settings/UnitsTab.tsx` with exactly this content:

```tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilTrash, cilSearch, cilOptions } from '@coreui/icons';
import { labelStyle } from '../../../components/settings/Card';
import { unitsService, type Unit } from '../../../services/recycling/units.service';

const unitSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  abbreviation: z.string().min(1, 'Obrigatório').max(10, 'Máximo 10 caracteres'),
});
type UnitForm = z.infer<typeof unitSchema>;

export function UnitsTab() {
  const [items, setItems] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } =
    useForm<UnitForm>({ resolver: zodResolver(unitSchema) });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await unitsService.list();
      setItems(data);
    } catch {
      setError('Erro ao carregar unidades.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (u) => u.name.toLowerCase().includes(q) || u.abbreviation.toLowerCase().includes(q),
    );
  }, [items, search]);

  const openCreate = () => {
    setEditing(null);
    reset({ name: '', abbreviation: '' });
    setModalOpen(true);
  };

  const openEdit = (unit: Unit) => {
    setEditing(unit);
    reset({ name: unit.name, abbreviation: unit.abbreviation });
    setModalOpen(true);
  };

  const onSubmit = async (values: UnitForm) => {
    try {
      if (editing) {
        await unitsService.update(editing.id, values);
      } else {
        await unitsService.create(values);
      }
      setModalOpen(false);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Erro ao salvar unidade.');
    }
  };

  const handleDelete = async (unit: Unit) => {
    if (!confirm(`Deseja excluir a unidade "${unit.name}"?`)) return;
    try {
      await unitsService.delete(unit.id);
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg ?? 'Erro ao excluir unidade. Pode haver produtos vinculados.');
    }
  };

  return (
    <div>
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="pk-table-card">
        <div className="pk-table-toolbar">
          <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
            <CIcon
              icon={cilSearch}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--cui-secondary-color)',
                pointerEvents: 'none',
                width: 14,
                height: 14,
              }}
            />
            <CFormInput
              placeholder="Buscar por nome ou abreviação..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
              size="sm"
              aria-label="Buscar unidades"
            />
          </div>
          <CButton
            color="primary"
            size="sm"
            onClick={openCreate}
            style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <CIcon icon={cilPlus} size="sm" /> Nova unidade
          </CButton>
        </div>

        <CTable hover responsive className="mb-0">
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Abreviação</CTableHeaderCell>
              <CTableHeaderCell style={{ textAlign: 'right' }}>Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-4">
                  <CSpinner size="sm" color="primary" />
                </CTableDataCell>
              </CTableRow>
            ) : filtered.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={3} className="text-center py-5">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        background: 'rgba(52,142,145,0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <CIcon icon={cilOptions} size="lg" style={{ color: 'var(--cui-primary)' }} />
                    </div>
                    <div style={{ fontWeight: 600 }}>Nenhuma unidade encontrada</div>
                    <div style={{ fontSize: 13, color: 'var(--cui-secondary-color)' }}>
                      {search ? 'Tente ajustar sua busca.' : 'Cadastre a primeira unidade (ex: Quilograma / kg).'}
                    </div>
                  </div>
                </CTableDataCell>
              </CTableRow>
            ) : filtered.map((unit) => (
              <CTableRow key={unit.id}>
                <CTableDataCell style={{ fontWeight: 500 }}>{unit.name}</CTableDataCell>
                <CTableDataCell
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: 'var(--cui-secondary-color)',
                  }}
                >
                  {unit.abbreviation}
                </CTableDataCell>
                <CTableDataCell style={{ textAlign: 'right' }}>
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(unit)} title="Editar">
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(unit)} title="Excluir">
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </div>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar unidade' : 'Nova unidade'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel style={labelStyle}>Nome *</CFormLabel>
                <CFormInput placeholder="Ex: Quilograma" {...register('name')} invalid={!!errors.name} />
                {errors.name && <CFormFeedback invalid>{errors.name.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel style={labelStyle}>Abreviação *</CFormLabel>
                <CFormInput
                  placeholder="Ex: kg"
                  {...register('abbreviation')}
                  invalid={!!errors.abbreviation}
                  maxLength={10}
                />
                {errors.abbreviation && <CFormFeedback invalid>{errors.abbreviation.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" variant="outline" onClick={() => setModalOpen(false)}>
              Cancelar
            </CButton>
            <CButton type="submit" color="primary" disabled={isSubmitting}>
              {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
            </CButton>
          </CModalFooter>
        </form>
      </CModal>
    </div>
  );
}
```

- [ ] **Step 6.2: Create the smoke test**

Write `src/pages/recycling/settings/UnitsTab.test.tsx` with exactly this content:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { UnitsTab } from './UnitsTab';

vi.mock('../../../services/recycling/units.service', () => ({
  unitsService: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

import { unitsService } from '../../../services/recycling/units.service';

describe('UnitsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders list of units from the service', async () => {
    vi.mocked(unitsService.list).mockResolvedValue([
      { id: '1', name: 'Quilograma', abbreviation: 'kg' },
      { id: '2', name: 'Tonelada', abbreviation: 't' },
    ]);

    render(<UnitsTab />);

    await waitFor(() => {
      expect(screen.getByText('Quilograma')).toBeInTheDocument();
    });
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('Tonelada')).toBeInTheDocument();
    expect(screen.getByText('t')).toBeInTheDocument();
  });

  it('shows empty state when no units exist', async () => {
    vi.mocked(unitsService.list).mockResolvedValue([]);

    render(<UnitsTab />);

    await waitFor(() => {
      expect(screen.getByText('Nenhuma unidade encontrada')).toBeInTheDocument();
    });
    expect(screen.getByText(/Cadastre a primeira unidade/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.3: Run the tests**

Run: `pnpm test -- UnitsTab`
Expected: both tests pass (2 passed).

- [ ] **Step 6.4: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 6.5: Commit**

```bash
git add src/pages/recycling/settings/UnitsTab.tsx src/pages/recycling/settings/UnitsTab.test.tsx
git commit --no-gpg-sign -m "feat(recycling/settings): add UnitsTab with CRUD of measurement units"
```

---

## Task 7: Create recycling SettingsPage composing 4 tabs

**Files:**
- Create: `src/pages/recycling/settings/SettingsPage.tsx`

- [ ] **Step 7.1: Create the file**

Write `src/pages/recycling/settings/SettingsPage.tsx` with exactly this content:

```tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CNav, CNavItem, CNavLink, CTabContent, CTabPane } from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilBuilding, cilOptions, cilUser, cilCreditCard } from '@coreui/icons';
import { PageHead } from '../../../components/PageHead';
import { useAuthStore } from '../../../store/auth.store';
import { CompanyTab } from '../../../components/settings/CompanyTab';
import { AccountTab } from '../../../components/settings/AccountTab';
import { SubscriptionTab } from '../../../components/settings/SubscriptionTab';
import { UnitsTab } from './UnitsTab';

const TABS = [
  { label: 'Empresa', icon: cilBuilding },
  { label: 'Unidades de medida', icon: cilOptions },
  { label: 'Minha conta', icon: cilUser },
  { label: 'Assinatura', icon: cilCreditCard },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      navigate('/recycling/dashboard', { replace: true });
    }
  }, [user, navigate]);

  if (!user || user.role !== 'OWNER') return null;

  return (
    <>
      <PageHead
        title="Configurações"
        subtitle="Gerencie os dados da sua empresa, unidades de medida, conta e assinatura"
      />

      <div style={{ borderBottom: '1px solid var(--cui-border-color)', marginBottom: 20 }}>
        <CNav variant="tabs" className="pk-tabs" style={{ border: 0 }}>
          {TABS.map((t, i) => (
            <CNavItem key={t.label}>
              <CNavLink
                active={activeTab === i}
                onClick={() => setActiveTab(i)}
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={t.icon} size="sm" /> {t.label}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      </div>

      <CTabContent>
        <CTabPane visible={activeTab === 0}><CompanyTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><UnitsTab /></CTabPane>
        <CTabPane visible={activeTab === 2}><AccountTab /></CTabPane>
        <CTabPane visible={activeTab === 3}><SubscriptionTab /></CTabPane>
      </CTabContent>
    </>
  );
}
```

- [ ] **Step 7.2: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 7.3: Commit**

```bash
git add src/pages/recycling/settings/SettingsPage.tsx
git commit --no-gpg-sign -m "feat(recycling/settings): add SettingsPage composing shared tabs + UnitsTab"
```

---

## Task 8: Register the `/recycling/settings` route in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 8.1: Add the import**

Open `src/App.tsx`. Find this block (around line 26):

```tsx
import { RecyclingReportsPage } from './pages/recycling/reports/ReportsPage';
```

Add a new line immediately after it:

```tsx
import { SettingsPage as RecyclingSettingsPage } from './pages/recycling/settings/SettingsPage';
```

- [ ] **Step 8.2: Add the route**

Still in `src/App.tsx`, find this block (around line 114):

```tsx
            <Route path="reports" element={<RecyclingReportsPage />} />
          </Route>
```

Change it to:

```tsx
            <Route path="reports" element={<RecyclingReportsPage />} />
            <Route path="settings" element={<RecyclingSettingsPage />} />
          </Route>
```

- [ ] **Step 8.3: Verify typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 8.4: Manual browser verification**

With the dev server running:
1. Log in as a recycling OWNER
2. Click "Configurações" in the sidebar (or navigate to `/recycling/settings` directly)
3. Confirm the page renders with 4 tabs: Empresa / Unidades de medida / Minha conta / Assinatura
4. Click each tab:
   - Empresa: form loads with company data
   - Unidades de medida: table loads (or empty state)
   - Minha conta: password form renders
   - Assinatura: status banner + billing info render
5. Click "Nova unidade" on the Unidades tab: modal opens with Nome + Abreviação fields
6. Cancel the modal — it closes without creating

If anything breaks, STOP and debug.

- [ ] **Step 8.5: Commit**

```bash
git add src/App.tsx
git commit --no-gpg-sign -m "feat(recycling/settings): register /recycling/settings route"
```

---

## Task 9: Final end-to-end verification

**Files:** (no file changes in this task — verification only)

- [ ] **Step 9.1: Full typecheck**

Run: `npx tsc -b --noEmit 2>&1 | grep -v "recycling/purchases" | head -20`
Expected: no output.

- [ ] **Step 9.2: Full test suite**

Run: `pnpm --filter frontend test`
Expected: all tests pass (including the new 2 in UnitsTab.test.tsx and the existing App/PrivateRoute tests).

- [ ] **Step 9.3: Production build**

Run: `pnpm --filter frontend build`
Expected: build completes successfully, no TypeScript errors.

- [ ] **Step 9.4: Manual end-to-end smoke test**

Start the dev server and verify both sides:

**Workshop (should be unchanged):**
1. Log in as workshop OWNER → `/workshop/settings`
2. Verify 3 tabs (Empresa, Minha conta, Assinatura) still work
3. Edit a company field, save, confirm success alert
4. Try an incorrect password change, confirm error alert

**Recycling (should now work):**
1. Log in as recycling OWNER → `/recycling/settings`
2. Verify 4 tabs render
3. Go to **Unidades de medida** → click "Nova unidade" → create `Quilograma` / `kg` → confirm it appears in the list
4. Click the edit (pencil) icon on that unit → change name to `Kg` → save → confirm it updates
5. Click the delete (trash) icon on a unit not referenced by products → confirm the `confirm()` dialog → confirm removal
6. Type in the search box (e.g., "qui") → confirm filter works
7. Navigate to the Empresa tab, save a field → confirm the same companyService endpoint responds
8. Navigate to Minha conta, try a password change
9. Navigate to Assinatura, confirm banner shows the correct status

**Role guard:**
1. Log in as recycling EMPLOYEE (non-OWNER) → manually go to `/recycling/settings`
2. Should redirect to `/recycling/dashboard`
3. Same test for workshop EMPLOYEE at `/workshop/settings` → redirects to `/workshop/dashboard`

If any step fails, STOP and address before closing the plan.

---

## Completion

When all 9 tasks are done:
- 6 new files in `src/components/settings/` and `src/pages/recycling/settings/`
- 2 modified files (`src/App.tsx`, `src/pages/workshop/settings/SettingsPage.tsx`)
- 9 atomic commits on branch `redesign/praktikus-v2`
- `/recycling/settings` renders 4 tabs; workshop settings unchanged functionally

The plan is complete.
