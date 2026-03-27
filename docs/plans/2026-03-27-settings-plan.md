# Settings Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the `/workshop/settings` page (OWNER only) with two tabs — Empresa (company profile + logo) and Minha Conta (change password) — plus the backend endpoint `PATCH /auth/me/password`.

**Architecture:** New `ChangePasswordDto` + `AuthService.changePassword` method on backend. New `company.service.ts` on frontend. Single `SettingsPage.tsx` with CoreUI `CNav` tabs matching the pattern in `CatalogPage.tsx`.

**Tech Stack:** NestJS + TypeORM + bcrypt (backend); React + CoreUI v5 + react-hook-form + Zod (frontend).

---

## Task 1: Backend — ChangePasswordDto + AuthService.changePassword

**Files:**
- Create: `apps/backend/src/modules/core/auth/dto/change-password.dto.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.service.ts`
- Test: `apps/backend/src/modules/core/auth/auth.service.spec.ts`

**Step 1: Write failing tests in auth.service.spec.ts**

Add a new `describe('changePassword')` block at the end of the existing `describe('AuthService')` in `auth.service.spec.ts`:

```typescript
describe('changePassword', () => {
  it('should update passwordHash when currentPassword is correct', async () => {
    const user = { id: 'u1', passwordHash: 'old_hash' };
    mockUserRepo.findOne.mockResolvedValue(user);
    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(true as never);
    jest.spyOn(require('bcrypt'), 'hash').mockResolvedValue('new_hash' as never);
    mockUserRepo.save.mockResolvedValue({ ...user, passwordHash: 'new_hash' });

    await service.changePassword('u1', 'oldPass', 'newPass12');

    expect(mockUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ passwordHash: 'new_hash' }),
    );
  });

  it('should throw UnauthorizedException when currentPassword is wrong', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 'u1', passwordHash: 'hash' });
    jest.spyOn(require('bcrypt'), 'compare').mockResolvedValue(false as never);

    await expect(service.changePassword('u1', 'wrong', 'newPass12')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should throw UnauthorizedException when user not found', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(service.changePassword('u1', 'any', 'newPass12')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec
```
Expected: FAIL — `service.changePassword is not a function`

**Step 3: Create ChangePasswordDto**

Create `apps/backend/src/modules/core/auth/dto/change-password.dto.ts`:

```typescript
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @MinLength(8)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}
```

**Step 4: Add changePassword to AuthService**

Add this method to `auth.service.ts` (before the private `generateTokens` method):

```typescript
async changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await this.userRepo.findOne({ where: { id: userId } });
  if (!user) {
    throw new UnauthorizedException('Usuário não encontrado.');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedException('Senha atual incorreta.');
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await this.userRepo.save(user);
}
```

**Step 5: Run tests to confirm they pass**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.service.spec
```
Expected: all `changePassword` tests PASS

**Step 6: Commit**

```bash
git add apps/backend/src/modules/core/auth/dto/change-password.dto.ts \
        apps/backend/src/modules/core/auth/auth.service.ts \
        apps/backend/src/modules/core/auth/auth.service.spec.ts
git commit -m "feat(auth): add changePassword method to AuthService"
```

---

## Task 2: Backend — PATCH /auth/me/password endpoint

**Files:**
- Modify: `apps/backend/src/modules/core/auth/auth.controller.ts`
- Modify: `apps/backend/src/modules/core/auth/auth.controller.spec.ts`

**Step 1: Write failing test in auth.controller.spec.ts**

Read `auth.controller.spec.ts` first to understand the existing test module setup. Then add at the end:

```typescript
describe('PATCH /auth/me/password', () => {
  it('should call changePassword with userId from JWT and return 204', async () => {
    const mockReq = { user: { sub: 'user-1' } };
    mockAuthService.changePassword = jest.fn().mockResolvedValue(undefined);

    // call the controller method directly
    await controller.changePassword(mockReq as any, {
      currentPassword: 'oldPass12',
      newPassword: 'newPass12',
    });

    expect(mockAuthService.changePassword).toHaveBeenCalledWith(
      'user-1',
      'oldPass12',
      'newPass12',
    );
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.controller.spec
```
Expected: FAIL — `controller.changePassword is not a function`

**Step 3: Add endpoint to AuthController**

Add imports at top of `auth.controller.ts`:
- Add `Patch, Req, HttpCode, HttpStatus` to the existing NestJS import if not already there (they may partially exist)
- Add `Request` to the existing import (already present as `Request` from NestJS)

Add to `auth.controller.ts`:

```typescript
import { ChangePasswordDto } from './dto/change-password.dto';
```

Add this method to `AuthController`:

```typescript
@Patch('me/password')
@HttpCode(HttpStatus.NO_CONTENT)
@UseGuards(JwtAuthGuard)
async changePassword(
  @Request() req: any,
  @Body() dto: ChangePasswordDto,
): Promise<void> {
  await this.authService.changePassword(req.user.sub, dto.currentPassword, dto.newPassword);
}
```

> Note: `req.user` is populated by `JwtAuthGuard` → `JwtStrategy`. The `sub` claim is the user's UUID (see `jwt.strategy.ts` — it sets `sub` from `payload.sub`).

**Step 4: Run tests to confirm they pass**

```bash
cd apps/backend && pnpm test --testPathPattern=auth.controller.spec
```
Expected: PASS

**Step 5: Full backend test suite**

```bash
cd apps/backend && pnpm test
```
Expected: all tests pass

**Step 6: Commit**

```bash
git add apps/backend/src/modules/core/auth/auth.controller.ts \
        apps/backend/src/modules/core/auth/auth.controller.spec.ts
git commit -m "feat(auth): add PATCH /auth/me/password endpoint"
```

---

## Task 3: Frontend — company.service.ts

**Files:**
- Create: `apps/frontend/src/services/company.service.ts`

**Step 1: Create the service**

Create `apps/frontend/src/services/company.service.ts`:

```typescript
import { api } from './api';

export interface CompanyAddress {
  street: string;
  number: string;
  complement?: string;
  city: string;
  state: string;
  zip: string;
}

export interface CompanyProfile {
  id: string;
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  telefone: string | null;
  endereco: CompanyAddress | null;
  logoUrl: string | null;
}

export interface UpdateCompanyPayload {
  nomeFantasia?: string;
  razaoSocial?: string;
  telefone?: string;
  endereco?: CompanyAddress;
}

export const companyService = {
  async getProfile(): Promise<CompanyProfile> {
    const { data } = await api.get<CompanyProfile>('/workshop/company');
    return data;
  },

  async updateProfile(payload: UpdateCompanyPayload): Promise<CompanyProfile> {
    const { data } = await api.patch<CompanyProfile>('/workshop/company', payload);
    return data;
  },

  async uploadLogo(file: File): Promise<CompanyProfile> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<CompanyProfile>('/workshop/company/logo', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },
};
```

> No tests needed here — it's a thin HTTP wrapper with no logic, same pattern as other services in this project.

**Step 2: Verify TypeScript compiles**

```bash
cd apps/frontend && pnpm build 2>&1 | grep -E "error|warning" | head -20
```
Expected: no TypeScript errors for the new file

**Step 3: Commit**

```bash
git add apps/frontend/src/services/company.service.ts
git commit -m "feat(settings): add company.service.ts"
```

---

## Task 4: Frontend — Add changePassword to auth.service.ts

**Files:**
- Modify: `apps/frontend/src/services/auth.service.ts`

**Step 1: Add changePassword method**

Add to the `authService` object in `auth.service.ts` (after `isAuthenticated`):

```typescript
async changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await api.patch('/auth/me/password', { currentPassword, newPassword });
},
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/frontend && pnpm build 2>&1 | grep -E "error" | head -20
```
Expected: no errors

**Step 3: Commit**

```bash
git add apps/frontend/src/services/auth.service.ts
git commit -m "feat(settings): add changePassword to auth.service"
```

---

## Task 5: Frontend — SettingsPage.tsx

**Files:**
- Create: `apps/frontend/src/pages/workshop/settings/SettingsPage.tsx`

**Step 1: Create SettingsPage**

Create `apps/frontend/src/pages/workshop/settings/SettingsPage.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
  CTabContent,
  CTabPane,
} from '@coreui/react';
import { useAuthStore } from '../../../store/auth.store';
import { companyService, type CompanyProfile, type UpdateCompanyPayload } from '../../../services/company.service';
import { authService } from '../../../services/auth.service';

// ---- Schemas ----

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

// ---- CompanyTab ----

function CompanyTab() {
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
    }).catch(() => setLoading(false));
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

  if (loading) return <div className="text-center py-4"><CSpinner /></div>;

  return (
    <>
      {success && <CAlert color="success" className="mb-3">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {/* Logo section */}
      <div className="mb-4 d-flex align-items-center gap-3">
        {profile?.logoUrl ? (
          <img
            src={profile.logoUrl}
            alt="Logo"
            style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--cui-border-color)' }}
          />
        ) : (
          <div style={{ width: 64, height: 64, borderRadius: 8, border: '1px solid var(--cui-border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--cui-secondary-color)' }}>
            Logo
          </div>
        )}
        <div>
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
          >
            {logoUploading ? <CSpinner size="sm" /> : 'Enviar logo'}
          </CButton>
          <div className="text-secondary mt-1" style={{ fontSize: '0.75rem' }}>JPG ou PNG, máx. 2 MB</div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row g-3">
          <div className="col-12 col-md-6">
            <CFormLabel>Nome Fantasia</CFormLabel>
            <CFormInput aria-label="Nome Fantasia" {...register('nomeFantasia')} invalid={!!errors.nomeFantasia} />
            {errors.nomeFantasia && <CFormFeedback invalid>{errors.nomeFantasia.message}</CFormFeedback>}
          </div>
          <div className="col-12 col-md-6">
            <CFormLabel>Razão Social</CFormLabel>
            <CFormInput aria-label="Razão Social" {...register('razaoSocial')} invalid={!!errors.razaoSocial} />
            {errors.razaoSocial && <CFormFeedback invalid>{errors.razaoSocial.message}</CFormFeedback>}
          </div>
          <div className="col-12 col-md-4">
            <CFormLabel>Telefone</CFormLabel>
            <CFormInput {...register('telefone')} />
          </div>
          <div className="col-12 col-md-6">
            <CFormLabel>Rua</CFormLabel>
            <CFormInput {...register('street')} />
          </div>
          <div className="col-12 col-md-2">
            <CFormLabel>Número</CFormLabel>
            <CFormInput {...register('number')} />
          </div>
          <div className="col-12 col-md-4">
            <CFormLabel>Complemento</CFormLabel>
            <CFormInput {...register('complement')} />
          </div>
          <div className="col-12 col-md-4">
            <CFormLabel>Cidade</CFormLabel>
            <CFormInput {...register('city')} />
          </div>
          <div className="col-6 col-md-2">
            <CFormLabel>Estado</CFormLabel>
            <CFormInput {...register('state')} maxLength={2} />
          </div>
          <div className="col-6 col-md-2">
            <CFormLabel>CEP</CFormLabel>
            <CFormInput {...register('zip')} />
          </div>
        </div>
        <div className="mt-4">
          <CButton type="submit" color="primary" disabled={isSubmitting}>
            {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
          </CButton>
        </div>
      </form>
    </>
  );
}

// ---- AccountTab ----

function AccountTab() {
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
    <>
      {success && <CAlert color="success" className="mb-3">{success}</CAlert>}
      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ maxWidth: 400 }}>
        <div className="mb-3">
          <CFormLabel>Senha Atual</CFormLabel>
          <CFormInput
            type="password"
            aria-label="Senha Atual"
            {...register('currentPassword')}
            invalid={!!errors.currentPassword}
          />
          {errors.currentPassword && <CFormFeedback invalid>{errors.currentPassword.message}</CFormFeedback>}
        </div>
        <div className="mb-3">
          <CFormLabel>Nova Senha</CFormLabel>
          <CFormInput
            type="password"
            aria-label="Nova Senha"
            {...register('newPassword')}
            invalid={!!errors.newPassword}
          />
          {errors.newPassword && <CFormFeedback invalid>{errors.newPassword.message}</CFormFeedback>}
        </div>
        <div className="mb-4">
          <CFormLabel>Confirmar Nova Senha</CFormLabel>
          <CFormInput
            type="password"
            aria-label="Confirmar Nova Senha"
            {...register('confirmPassword')}
            invalid={!!errors.confirmPassword}
          />
          {errors.confirmPassword && <CFormFeedback invalid>{errors.confirmPassword.message}</CFormFeedback>}
        </div>
        <CButton type="submit" color="primary" disabled={isSubmitting}>
          {isSubmitting ? <CSpinner size="sm" /> : 'Alterar senha'}
        </CButton>
      </form>
    </>
  );
}

// ---- SettingsPage ----

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
    <div className="p-3">
      <h4 className="mb-4">Configurações</h4>
      <CCard>
        <CCardBody>
          <CNav variant="tabs" className="mb-4">
            <CNavItem>
              <CNavLink active={activeTab === 0} onClick={() => setActiveTab(0)} style={{ cursor: 'pointer' }}>
                Empresa
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} style={{ cursor: 'pointer' }}>
                Minha Conta
              </CNavLink>
            </CNavItem>
          </CNav>
          <CTabContent>
            <CTabPane visible={activeTab === 0}>
              <CompanyTab />
            </CTabPane>
            <CTabPane visible={activeTab === 1}>
              <AccountTab />
            </CTabPane>
          </CTabContent>
        </CCardBody>
      </CCard>
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/frontend && pnpm build 2>&1 | grep "error" | head -20
```
Expected: no errors

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/settings/SettingsPage.tsx
git commit -m "feat(settings): add SettingsPage with Empresa and Minha Conta tabs"
```

---

## Task 6: Wire route + fix ownerOnly in AppLayout

**Files:**
- Modify: `apps/frontend/src/App.tsx`
- Modify: `apps/frontend/src/layouts/AppLayout.tsx`

**Step 1: Add route in App.tsx**

In `apps/frontend/src/App.tsx`, add the import:
```typescript
import { SettingsPage } from './pages/workshop/settings/SettingsPage';
```

Then inside the `/workshop` `<Route>` block (after the `reports` route):
```tsx
<Route path="settings" element={<SettingsPage />} />
```

**Step 2: Fix ownerOnly in AppLayout.tsx**

In `apps/frontend/src/layouts/AppLayout.tsx`, line 51, change:
```typescript
{ label: 'Configurações', icon: cilSettings, path: '/workshop/settings', ownerOnly: false },
```
to:
```typescript
{ label: 'Configurações', icon: cilSettings, path: '/workshop/settings', ownerOnly: true },
```

**Step 3: Build to confirm no errors**

```bash
cd apps/frontend && pnpm build 2>&1 | grep "error" | head -20
```
Expected: 0 errors, build succeeds

**Step 4: Run full frontend test suite**

```bash
cd apps/frontend && pnpm test
```
Expected: all tests pass

**Step 5: Commit**

```bash
git add apps/frontend/src/App.tsx apps/frontend/src/layouts/AppLayout.tsx
git commit -m "feat(settings): wire /workshop/settings route, set ownerOnly=true in nav"
```

---

## Done

After all tasks:
- Backend: `PATCH /auth/me/password` — protected by JWT, validates current password
- Frontend: `/workshop/settings` — OWNER only, two tabs (Empresa + Minha Conta)
- Sidebar: Configurações link hidden from EMPLOYEE users
