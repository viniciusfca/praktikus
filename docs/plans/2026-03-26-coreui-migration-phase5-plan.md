# CoreUI Migration — Phase 5: Catalog, Auth, Public Pages + Remove MUI

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all remaining MUI usage (CatalogPage, LoginPage, RegisterPage, QuoteApprovalPage, LandingPage, ThemeProvider) with CoreUI/plain HTML, then remove MUI packages entirely.

**Key decisions:**
- MUI Tabs → CoreUI `CNav` + `CTabContent` + `CTabPane`
- MUI TablePagination → CoreUI `CPagination` + select (same pattern as other pages)
- MUI Stepper (RegisterPage) → custom two-step indicator with plain divs
- MUI ThemeProvider + CssBaseline → removed entirely; ThemeContext kept with just `data-coreui-theme` attribute toggle
- `theme.ts` deleted — no longer needed
- LandingPage → Bootstrap grid classes + CCard/CButton
- QuoteApprovalPage → no MUI icons; use Unicode ✓ / ✗ or text

**Icons in scope:** `cilPlus`, `cilPen`, `cilTrash`

---

### Task 1: Rewrite CatalogPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/catalog/CatalogPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useState, useEffect, useCallback } from 'react';
import {
  CAlert,
  CButton,
  CCard,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CPagination,
  CPaginationItem,
  CSpinner,
  CTabContent,
  CTabPane,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilPen, cilTrash } from '@coreui/icons';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  catalogServicesApi, catalogPartsApi,
  type CatalogService, type CatalogPart,
} from '../../../services/catalog.service';

// --- Schemas Zod ---
const serviceSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  descricao: z.string().optional(),
  precoPadrao: z.coerce.number().min(0, 'Deve ser ≥ 0'),
});
type ServiceForm = z.infer<typeof serviceSchema>;

const partSchema = z.object({
  nome: z.string().min(2, 'Mínimo 2 caracteres'),
  codigo: z.string().optional(),
  precoUnitario: z.coerce.number().min(0, 'Deve ser ≥ 0'),
});
type PartForm = z.infer<typeof partSchema>;

// --- ServicesTab ---
function ServicesTab() {
  const [items, setItems] = useState<CatalogService[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogService | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema) as Resolver<ServiceForm>,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogServicesApi.list({ page: page + 1, limit: rowsPerPage, search: search || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar serviços.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ nome: '', descricao: '', precoPadrao: 0 }); setModalOpen(true); };
  const openEdit = (item: CatalogService) => {
    setEditing(item);
    reset({ nome: item.nome, descricao: item.descricao ?? '', precoPadrao: item.precoPadrao });
    setModalOpen(true);
  };

  const onSubmit = async (values: ServiceForm) => {
    try {
      if (editing) {
        await catalogServicesApi.update(editing.id, values);
      } else {
        await catalogServicesApi.create(values);
      }
      setModalOpen(false);
      load();
    } catch {
      alert('Erro ao salvar serviço.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este serviço?')) return;
    try {
      await catalogServicesApi.delete(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir serviço.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <CFormInput
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ maxWidth: 320 }}
          size="sm"
        />
        <CButton color="primary" size="sm" onClick={openCreate}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Serviço
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Descrição</CTableHeaderCell>
              <CTableHeaderCell>Preço Padrão</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : items.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell>{item.nome}</CTableDataCell>
                <CTableDataCell>{item.descricao ?? '—'}</CTableDataCell>
                <CTableDataCell>R$ {Number(item.precoPadrao).toFixed(2)}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="d-flex align-items-center gap-2 px-3 py-2 border-top">
          <select
            className="form-select form-select-sm"
            style={{ width: 80 }}
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <small className="text-secondary">por página</small>
          <CPagination className="ms-auto mb-0" size="sm">
            <CPaginationItem disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</CPaginationItem>
            <CPaginationItem active>{page + 1} / {totalPages}</CPaginationItem>
            <CPaginationItem disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</CPaginationItem>
          </CPagination>
        </div>
      </CCard>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel>Nome *</CFormLabel>
                <CFormInput {...register('nome')} invalid={!!errors.nome} />
                {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel>Descrição</CFormLabel>
                <CFormTextarea {...register('descricao')} rows={2} />
              </div>
              <div>
                <CFormLabel>Preço Padrão (R$) *</CFormLabel>
                <CFormInput type="number" step="0.01" min="0" {...register('precoPadrao')} invalid={!!errors.precoPadrao} />
                {errors.precoPadrao && <CFormFeedback invalid>{errors.precoPadrao.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setModalOpen(false)}>Cancelar</CButton>
            <CButton type="submit" color="primary">Salvar</CButton>
          </CModalFooter>
        </form>
      </CModal>
    </div>
  );
}

// --- PartsTab ---
function PartsTab() {
  const [items, setItems] = useState<CatalogPart[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogPart | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PartForm>({
    resolver: zodResolver(partSchema) as Resolver<PartForm>,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await catalogPartsApi.list({ page: page + 1, limit: rowsPerPage, search: search || undefined });
      setItems(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar peças.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); reset({ nome: '', codigo: '', precoUnitario: 0 }); setModalOpen(true); };
  const openEdit = (item: CatalogPart) => {
    setEditing(item);
    reset({ nome: item.nome, codigo: item.codigo ?? '', precoUnitario: item.precoUnitario });
    setModalOpen(true);
  };

  const onSubmit = async (values: PartForm) => {
    try {
      if (editing) {
        await catalogPartsApi.update(editing.id, values);
      } else {
        await catalogPartsApi.create(values);
      }
      setModalOpen(false);
      load();
    } catch {
      alert('Erro ao salvar peça.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir esta peça?')) return;
    try {
      await catalogPartsApi.delete(id);
      load();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir peça.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;

  return (
    <div className="mt-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <CFormInput
          placeholder="Buscar por nome ou código"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          style={{ maxWidth: 320 }}
          size="sm"
        />
        <CButton color="primary" size="sm" onClick={openCreate}>
          <CIcon icon={cilPlus} className="me-1" />
          Nova Peça
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>Código</CTableHeaderCell>
              <CTableHeaderCell>Preço Unitário</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={4} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : items.map((item) => (
              <CTableRow key={item.id}>
                <CTableDataCell>{item.nome}</CTableDataCell>
                <CTableDataCell>{item.codigo ?? '—'}</CTableDataCell>
                <CTableDataCell>R$ {Number(item.precoUnitario).toFixed(2)}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(item)}>
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                    <CIcon icon={cilTrash} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>

        <div className="d-flex align-items-center gap-2 px-3 py-2 border-top">
          <select
            className="form-select form-select-sm"
            style={{ width: 80 }}
            value={rowsPerPage}
            onChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <small className="text-secondary">por página</small>
          <CPagination className="ms-auto mb-0" size="sm">
            <CPaginationItem disabled={page === 0} onClick={() => setPage((p) => p - 1)}>‹</CPaginationItem>
            <CPaginationItem active>{page + 1} / {totalPages}</CPaginationItem>
            <CPaginationItem disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>›</CPaginationItem>
          </CPagination>
        </div>
      </CCard>

      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} size="sm">
        <CModalHeader>
          <CModalTitle>{editing ? 'Editar Peça' : 'Nova Peça'}</CModalTitle>
        </CModalHeader>
        <form onSubmit={handleSubmit(onSubmit)}>
          <CModalBody>
            <div className="d-flex flex-column gap-3">
              <div>
                <CFormLabel>Nome *</CFormLabel>
                <CFormInput {...register('nome')} invalid={!!errors.nome} />
                {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
              </div>
              <div>
                <CFormLabel>Código / Referência</CFormLabel>
                <CFormInput {...register('codigo')} />
              </div>
              <div>
                <CFormLabel>Preço Unitário (R$) *</CFormLabel>
                <CFormInput type="number" step="0.01" min="0" {...register('precoUnitario')} invalid={!!errors.precoUnitario} />
                {errors.precoUnitario && <CFormFeedback invalid>{errors.precoUnitario.message}</CFormFeedback>}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setModalOpen(false)}>Cancelar</CButton>
            <CButton type="submit" color="primary">Salvar</CButton>
          </CModalFooter>
        </form>
      </CModal>
    </div>
  );
}

// --- CatalogPage ---
export function CatalogPage() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <>
      <h5 className="fw-bold mb-3">Catálogo</h5>
      <CNav variant="tabs">
        <CNavItem>
          <CNavLink active={activeTab === 0} onClick={() => setActiveTab(0)} style={{ cursor: 'pointer' }}>
            Serviços
          </CNavLink>
        </CNavItem>
        <CNavItem>
          <CNavLink active={activeTab === 1} onClick={() => setActiveTab(1)} style={{ cursor: 'pointer' }}>
            Peças
          </CNavLink>
        </CNavItem>
      </CNav>
      <CTabContent>
        <CTabPane visible={activeTab === 0}><ServicesTab /></CTabPane>
        <CTabPane visible={activeTab === 1}><PartsTab /></CTabPane>
      </CTabContent>
    </>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/catalog/CatalogPage.tsx
git commit -m "feat(catalog): rewrite CatalogPage with CoreUI CNav CTabs CTable"
```

---

### Task 2: Rewrite LoginPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/auth/LoginPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  CSpinner,
} from '@coreui/react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const tokens = await authService.login(data);
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao fazer login.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 420 }}>
        <CCardBody className="p-4">
          <h5 className="fw-bold text-center mb-1">Praktikus</h5>
          <p className="text-secondary text-center mb-3">Acesse sua conta</p>

          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <CFormLabel>E-mail</CFormLabel>
              <CFormInput
                type="email"
                {...register('email')}
                invalid={!!errors.email}
                aria-label="E-mail"
              />
              {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>Senha</CFormLabel>
              <CFormInput
                type="password"
                {...register('password')}
                invalid={!!errors.password}
                aria-label="Senha"
              />
              {errors.password && <CFormFeedback invalid>{errors.password.message}</CFormFeedback>}
            </div>
            <CButton
              type="submit"
              color="primary"
              className="w-100 mt-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? <CSpinner size="sm" /> : 'Entrar'}
            </CButton>
          </form>

          <p className="text-center mt-3 mb-0" style={{ fontSize: '0.875rem' }}>
            Não tem conta?{' '}
            <Link to="/register" style={{ color: 'inherit' }}>
              Cadastre sua oficina
            </Link>
          </p>
        </CCardBody>
      </CCard>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/auth/LoginPage.tsx
git commit -m "feat(auth): rewrite LoginPage with CoreUI"
```

---

### Task 3: Rewrite RegisterPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/auth/RegisterPage.tsx`

**Context:** MUI Stepper has no CoreUI equivalent. Replace with a custom two-step indicator using plain divs. Preserve all business logic exactly.

**Step 1: Rewrite the file**

```tsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
  CSpinner,
} from '@coreui/react';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const step1Schema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos'),
  razaoSocial: z.string().min(3, 'Razão Social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().min(2, 'Nome Fantasia deve ter no mínimo 2 caracteres'),
  telefone: z.string().optional(),
});

const step2Schema = z
  .object({
    ownerName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const STEPS = ['Dados da Oficina', 'Dados do Responsável'];

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [activeStep, setActiveStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setActiveStep(1);
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1Data) return;
    setError(null);
    try {
      const { confirmPassword: _discard, ...rest } = data;
      const tokens = await authService.register({ ...step1Data, ...rest });
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao cadastrar. Tente novamente.');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <CCard style={{ width: '100%', maxWidth: 520 }}>
        <CCardBody className="p-4">
          <h5 className="fw-bold text-center mb-1">Praktikus</h5>
          <p className="text-secondary text-center mb-3">Cadastre sua oficina — 30 dias grátis</p>

          {/* Step indicator */}
          <div className="d-flex align-items-center mb-4">
            {STEPS.map((label, i) => (
              <div key={label} className="d-flex align-items-center" style={{ flex: 1 }}>
                <div className="d-flex align-items-center gap-2">
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      backgroundColor: i <= activeStep ? 'var(--cui-primary)' : 'var(--cui-secondary-bg)',
                      color: i <= activeStep ? '#fff' : 'var(--cui-body-color)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: i === activeStep ? 600 : 400 }}>{label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: 'var(--cui-border-color)',
                      margin: '0 8px',
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

          {activeStep === 0 && (
            <form onSubmit={form1.handleSubmit(onStep1Submit)} noValidate>
              <div className="mb-3">
                <CFormLabel>CNPJ</CFormLabel>
                <CFormInput
                  placeholder="Apenas números (14 dígitos)"
                  aria-label="CNPJ"
                  {...form1.register('cnpj')}
                  invalid={!!form1.formState.errors.cnpj}
                />
                {form1.formState.errors.cnpj && (
                  <CFormFeedback invalid>{form1.formState.errors.cnpj.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>Razão Social</CFormLabel>
                <CFormInput
                  aria-label="Razão Social"
                  {...form1.register('razaoSocial')}
                  invalid={!!form1.formState.errors.razaoSocial}
                />
                {form1.formState.errors.razaoSocial && (
                  <CFormFeedback invalid>{form1.formState.errors.razaoSocial.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>Nome Fantasia</CFormLabel>
                <CFormInput
                  aria-label="Nome Fantasia"
                  {...form1.register('nomeFantasia')}
                  invalid={!!form1.formState.errors.nomeFantasia}
                />
                {form1.formState.errors.nomeFantasia && (
                  <CFormFeedback invalid>{form1.formState.errors.nomeFantasia.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-4">
                <CFormLabel>Telefone</CFormLabel>
                <CFormInput {...form1.register('telefone')} />
              </div>
              <CButton type="submit" color="primary" className="w-100">
                Próximo
              </CButton>
            </form>
          )}

          {activeStep === 1 && (
            <form onSubmit={form2.handleSubmit(onStep2Submit)} noValidate>
              <div className="mb-3">
                <CFormLabel>Seu nome</CFormLabel>
                <CFormInput
                  {...form2.register('ownerName')}
                  invalid={!!form2.formState.errors.ownerName}
                />
                {form2.formState.errors.ownerName && (
                  <CFormFeedback invalid>{form2.formState.errors.ownerName.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>E-mail</CFormLabel>
                <CFormInput
                  type="email"
                  aria-label="E-mail"
                  {...form2.register('email')}
                  invalid={!!form2.formState.errors.email}
                />
                {form2.formState.errors.email && (
                  <CFormFeedback invalid>{form2.formState.errors.email.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-3">
                <CFormLabel>Senha</CFormLabel>
                <CFormInput
                  type="password"
                  aria-label="Senha"
                  {...form2.register('password')}
                  invalid={!!form2.formState.errors.password}
                />
                {form2.formState.errors.password && (
                  <CFormFeedback invalid>{form2.formState.errors.password.message}</CFormFeedback>
                )}
              </div>
              <div className="mb-4">
                <CFormLabel>Confirmar senha</CFormLabel>
                <CFormInput
                  type="password"
                  {...form2.register('confirmPassword')}
                  invalid={!!form2.formState.errors.confirmPassword}
                />
                {form2.formState.errors.confirmPassword && (
                  <CFormFeedback invalid>{form2.formState.errors.confirmPassword.message}</CFormFeedback>
                )}
              </div>
              <div className="d-flex gap-2">
                <CButton color="secondary" variant="outline" className="flex-grow-1" onClick={() => setActiveStep(0)}>
                  Voltar
                </CButton>
                <CButton
                  type="submit"
                  color="primary"
                  className="flex-grow-1"
                  disabled={form2.formState.isSubmitting}
                >
                  {form2.formState.isSubmitting ? <CSpinner size="sm" /> : 'Cadastrar'}
                </CButton>
              </div>
            </form>
          )}

          <p className="text-center mt-3 mb-0" style={{ fontSize: '0.875rem' }}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: 'inherit' }}>Entrar</Link>
          </p>
        </CCardBody>
      </CCard>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/auth/RegisterPage.tsx
git commit -m "feat(auth): rewrite RegisterPage with CoreUI, custom step indicator"
```

---

### Task 4: Rewrite QuoteApprovalPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/public/QuoteApprovalPage.tsx`

**Context:** Public page, no AppLayout. Uses axios directly for error handling. Replace CheckCircleOutlineIcon → ✓ (text), CancelOutlinedIcon → ✗ (text).

**Step 1: Rewrite the file**

```tsx
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import { publicQuotesApi, type QuoteData } from '../../services/service-orders.service';

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'already_used'; status: string }
  | { kind: 'success'; data: QuoteData }
  | { kind: 'approved' }
  | { kind: 'rejected' }
  | { kind: 'action_error'; message: string };

const STATUS_LABELS: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguardando Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function QuoteApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' });
      return;
    }
    publicQuotesApi
      .get(token)
      .then((data) => setState({ kind: 'success', data }))
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 404) {
            setState({ kind: 'invalid' });
          } else if (status === 410) {
            setState({ kind: 'expired' });
          } else if (status === 409) {
            const soStatus: string = err.response?.data?.status ?? '';
            setState({ kind: 'already_used', status: soStatus });
          } else {
            setState({ kind: 'invalid' });
          }
        } else {
          setState({ kind: 'invalid' });
        }
      });
  }, [token]);

  const handleApprove = async () => {
    if (submitting || !token) return;
    setSubmitting(true);
    try {
      await publicQuotesApi.approve(token);
      setState({ kind: 'approved' });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 410) setState({ kind: 'expired' });
        else if (status === 409) setState({ kind: 'already_used', status: err.response?.data?.status ?? 'APROVADO' });
        else setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      } else {
        setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (submitting || !token) return;
    setSubmitting(true);
    try {
      await publicQuotesApi.reject(token);
      setState({ kind: 'rejected' });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 410) setState({ kind: 'expired' });
        else if (status === 409) setState({ kind: 'already_used', status: err.response?.data?.status ?? 'APROVADO' });
        else setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      } else {
        setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '2rem 1rem',
      }}
    >
      <div style={{ width: '100%', maxWidth: 720 }}>
        {state.kind === 'loading' && (
          <div className="d-flex justify-content-center mt-5">
            <CSpinner color="primary" />
          </div>
        )}

        {state.kind === 'invalid' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Link inválido</h5>
              <p className="text-secondary mb-0">Este link de aprovação não é válido. Verifique o link e tente novamente.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'expired' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Link expirado</h5>
              <p className="text-secondary mb-0">Link expirado. Entre em contato com a oficina.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'already_used' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Orçamento já respondido</h5>
              <p className="text-secondary mb-0">
                Orçamento já respondido. Status atual:{' '}
                {STATUS_LABELS[state.status] ?? state.status}
              </p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'action_error' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <h5 className="fw-bold mb-2">Erro</h5>
              <CAlert color="danger" className="mb-0">{state.message}</CAlert>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'approved' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <div style={{ fontSize: '3rem', color: 'var(--cui-success)', marginBottom: '0.5rem' }}>✓</div>
              <h5 className="fw-bold mb-2">Orçamento aprovado!</h5>
              <p className="text-secondary mb-0">Orçamento aprovado! Aguarde contato da oficina.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'rejected' && (
          <CCard className="mt-5 text-center">
            <CCardBody className="p-4">
              <div style={{ fontSize: '3rem', color: 'var(--cui-danger)', marginBottom: '0.5rem' }}>✗</div>
              <h5 className="fw-bold mb-2">Orçamento recusado</h5>
              <p className="text-secondary mb-0">Orçamento recusado.</p>
            </CCardBody>
          </CCard>
        )}

        {state.kind === 'success' && (
          <>
            <div className="text-center mb-4">
              <h4 className="fw-bold">{state.data.empresa?.nome_fantasia ?? 'Oficina'}</h4>
              <p className="text-secondary mb-0">Aprovação de Orçamento</p>
            </div>

            <CCard className="mb-3">
              <CCardBody>
                <div className="fw-semibold mb-2">Dados do Cliente e Veículo</div>
                <hr className="my-2" />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem 1rem' }}>
                  <small className="text-secondary">Cliente</small>
                  <small>{state.data.cliente?.nome ?? '—'}</small>
                  <small className="text-secondary">CPF / CNPJ</small>
                  <small>{state.data.cliente?.cpf_cnpj ?? '—'}</small>
                  <small className="text-secondary">Veículo</small>
                  <small>
                    {state.data.veiculo
                      ? `${state.data.veiculo.marca} ${state.data.veiculo.modelo} (${state.data.veiculo.ano})`
                      : '—'}
                  </small>
                  <small className="text-secondary">Placa</small>
                  <small>{state.data.veiculo?.placa ?? '—'}</small>
                </div>
              </CCardBody>
            </CCard>

            {state.data.itemsServices.length > 0 && (
              <CCard className="mb-3">
                <CCardBody>
                  <div className="fw-semibold mb-2">Serviços</div>
                  <hr className="my-2" />
                  <CTable small responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Nome</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Valor</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {state.data.itemsServices.map((item) => (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.nomeServico}</CTableDataCell>
                          <CTableDataCell className="text-end">{formatCurrency(item.valor)}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            )}

            {state.data.itemsParts.length > 0 && (
              <CCard className="mb-3">
                <CCardBody>
                  <div className="fw-semibold mb-2">Peças</div>
                  <hr className="my-2" />
                  <CTable small responsive>
                    <CTableHead>
                      <CTableRow>
                        <CTableHeaderCell>Nome</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Qtd</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Valor Unit.</CTableHeaderCell>
                        <CTableHeaderCell className="text-end">Subtotal</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {state.data.itemsParts.map((item) => (
                        <CTableRow key={item.id}>
                          <CTableDataCell>{item.nomePeca}</CTableDataCell>
                          <CTableDataCell className="text-end">{item.quantidade}</CTableDataCell>
                          <CTableDataCell className="text-end">{formatCurrency(item.valorUnitario)}</CTableDataCell>
                          <CTableDataCell className="text-end">{formatCurrency(item.quantidade * item.valorUnitario)}</CTableDataCell>
                        </CTableRow>
                      ))}
                    </CTableBody>
                  </CTable>
                </CCardBody>
              </CCard>
            )}

            <div className="d-flex justify-content-end mb-4">
              <h6 className="fw-bold mb-0">Total: {formatCurrency(state.data.total)}</h6>
            </div>

            <div className="d-flex gap-3 justify-content-center mb-4">
              <CButton
                color="success"
                size="lg"
                disabled={submitting}
                onClick={handleApprove}
              >
                {submitting ? <CSpinner size="sm" className="me-1" /> : null}
                Aprovar Orçamento
              </CButton>
              <CButton
                color="secondary"
                variant="outline"
                size="lg"
                disabled={submitting}
                onClick={handleReject}
              >
                Recusar
              </CButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/public/QuoteApprovalPage.tsx
git commit -m "feat(public): rewrite QuoteApprovalPage with CoreUI, remove MUI icons"
```

---

### Task 5: Rewrite LandingPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/LandingPage.tsx`

**Context:** Public marketing page. Replace all MUI Grid/Card/Button/Typography with Bootstrap classes + CoreUI CButton/CCard. Replace MUI icons with plain emoji or remove.

**Step 1: Rewrite the file**

```tsx
import { CButton, CCard, CCardBody } from '@coreui/react';

const segments = [
  {
    icon: '🔧',
    title: 'Oficina Mecânica',
    description: 'Gestão completa de OS, agendamentos e clientes para oficinas e auto centers.',
    available: true,
  },
  {
    icon: '🏥',
    title: 'Clínica Médica',
    description: 'Prontuários, agendamentos e gestão de pacientes.',
    available: false,
  },
  {
    icon: '🦷',
    title: 'Odontologia',
    description: 'Gestão de consultas, orçamentos e histórico odontológico.',
    available: false,
  },
];

export function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center px-4 py-3">
        <span className="fw-bold fs-5 text-primary">Praktikus</span>
        <div className="d-flex gap-2">
          <CButton color="secondary" variant="ghost" href="/login">Entrar</CButton>
          <CButton color="primary" href="/register">Começar grátis</CButton>
        </div>
      </div>

      {/* Hero */}
      <div className="text-center py-5 px-3">
        <h1 className="fw-bold mb-3">Gerencie seu negócio com inteligência</h1>
        <p className="text-secondary mb-4 fs-5">
          30 dias grátis, sem cartão de crédito. Depois, apenas R$69,90/mês.
        </p>
        <CButton color="primary" size="lg" href="/register" className="px-5">
          Começar gratuitamente
        </CButton>
      </div>

      {/* Segment cards */}
      <div className="container py-5">
        <h4 className="fw-bold text-center mb-4">Escolha seu segmento</h4>
        <div className="row justify-content-center g-4">
          {segments.map((seg) => (
            <div key={seg.title} className="col-12 col-sm-6 col-md-4">
              <CCard style={{ height: '100%', position: 'relative' }}>
                {!seg.available && (
                  <span
                    className="badge bg-secondary"
                    style={{ position: 'absolute', top: 12, right: 12 }}
                  >
                    Em breve
                  </span>
                )}
                <CCardBody className="d-flex flex-column align-items-center text-center pt-4">
                  <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>{seg.icon}</div>
                  <h6 className="fw-bold mt-2 mb-1">{seg.title}</h6>
                  <p className="text-secondary small mb-3">{seg.description}</p>
                  <div className="mt-auto">
                    {seg.available ? (
                      <CButton color="primary" href="/register">Começar grátis</CButton>
                    ) : (
                      <CButton color="secondary" variant="outline" disabled>Em breve</CButton>
                    )}
                  </div>
                </CCardBody>
              </CCard>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/LandingPage.tsx
git commit -m "feat(landing): rewrite LandingPage with CoreUI + Bootstrap, remove MUI"
```

---

### Task 6: Rewrite ThemeProvider.tsx and delete theme.ts

**Files:**
- Modify: `apps/frontend/src/theme/ThemeProvider.tsx`
- Delete: `apps/frontend/src/theme/theme.ts`

**Context:** ThemeProvider currently wraps children in MuiThemeProvider + CssBaseline. After removing MUI, it only needs to manage the `data-coreui-theme` attribute and expose the `useThemeMode` hook. The `PaletteMode` type from MUI is replaced with a plain `'light' | 'dark'` type.

**Step 1: Rewrite ThemeProvider.tsx**

```tsx
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  mode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'dark',
  toggleTheme: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(
    () => (localStorage.getItem('theme-mode') as ThemeMode) ?? 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-coreui-theme', mode);
  }, [mode]);

  const toggleTheme = () => {
    setMode((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme-mode', next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

**Step 2: Delete theme.ts**

```bash
rm apps/frontend/src/theme/theme.ts
```

**Step 3: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success.

**Step 4: Commit**

```bash
git add apps/frontend/src/theme/ThemeProvider.tsx
git rm apps/frontend/src/theme/theme.ts
git commit -m "feat(theme): remove MuiThemeProvider, keep only CoreUI data-coreui-theme toggle"
```

---

### Task 7: Remove MUI packages from package.json

**Files:**
- Modify: `apps/frontend/package.json`

**Step 1: Remove MUI dependencies**

Remove these four lines from `dependencies` in `apps/frontend/package.json`:
- `"@emotion/react": "^11.14.0",`
- `"@emotion/styled": "^11.14.1",`
- `"@mui/icons-material": "^7.3.9",`
- `"@mui/material": "^7.3.9",`

**Step 2: Run pnpm install**

```bash
cd apps/frontend && pnpm install
```

Expected: packages removed from node_modules.

**Step 3: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No `@mui` or `@emotion` imports anywhere.

**Step 4: Confirm no MUI imports remain**

```bash
grep -r "from '@mui" apps/frontend/src || echo "Clean"
grep -r "from \"@mui" apps/frontend/src || echo "Clean"
```

Expected: "Clean" for both.

**Step 5: Commit**

```bash
git add apps/frontend/package.json
git add pnpm-lock.yaml
git commit -m "chore(deps): remove @mui/material @mui/icons-material @emotion packages"
```
