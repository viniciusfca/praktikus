# CoreUI Migration — Phase 3: Customers + Vehicles

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all MUI components in the Customers and Vehicles sections with CoreUI equivalents. Six files total: CustomersPage, CustomerFormPage, CustomerDetailPage, VehiclesPage, VehicleFormPage, VehicleHistoryPage.

**Architecture:** Preserve all business logic. Swap only the UI layer. Pagination using CPagination + CPaginationItem. Dialogs become CModal. MUI Chip → CBadge. Icons from @coreui/icons.

**Icons used:** `cilPlus` (add), `cilPen` (edit), `cilTrash` (delete), `cilArrowLeft` (back), `cilSearch` (view/detail), `cilHistory` (history).

---

### Task 1: Rewrite CustomersPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/customers/CustomersPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
  CCard,
  CFormInput,
  CPagination,
  CPaginationItem,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilSearch, cilPen, cilTrash } from '@coreui/icons';
import { customersService, type Customer } from '../../../services/customers.service';

export function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await customersService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setCustomers(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { loadCustomers(); }, [loadCustomers]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este cliente?')) return;
    try {
      await customersService.delete(id);
      loadCustomers();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir cliente.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Clientes</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/workshop/customers/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Cliente
        </CButton>
      </div>

      <CFormInput
        placeholder="Buscar por nome ou CPF/CNPJ"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="mb-3"
        style={{ maxWidth: 360 }}
        size="sm"
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Nome</CTableHeaderCell>
              <CTableHeaderCell>CPF/CNPJ</CTableHeaderCell>
              <CTableHeaderCell>WhatsApp</CTableHeaderCell>
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
            ) : customers.map((c) => (
              <CTableRow key={c.id}>
                <CTableDataCell>{c.nome}</CTableDataCell>
                <CTableDataCell>{c.cpfCnpj}</CTableDataCell>
                <CTableDataCell>{c.whatsapp ?? '—'}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/customers/${c.id}`)}
                    title="Ver detalhes"
                  >
                    <CIcon icon={cilSearch} />
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/customers/${c.id}/edit`)}
                    title="Editar"
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(c.id)}
                    title="Excluir"
                  >
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
git add apps/frontend/src/pages/workshop/customers/CustomersPage.tsx
git commit -m "feat(customers): rewrite CustomersPage with CoreUI CTable + CPagination"
```

---

### Task 2: Rewrite CustomerFormPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react';
import { customersService } from '../../../services/customers.service';

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpfCnpj: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [savedCustomer, setSavedCustomer] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    if (isEdit && id) {
      customersService.getById(id).then((customer) => {
        reset({
          nome: customer.nome,
          cpfCnpj: customer.cpfCnpj,
          whatsapp: customer.whatsapp ?? '',
          email: customer.email ?? '',
        });
      });
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      nome: data.nome,
      cpfCnpj: data.cpfCnpj,
      whatsapp: data.whatsapp || undefined,
      email: data.email || undefined,
    };
    try {
      if (isEdit && id) {
        await customersService.update(id, payload);
        navigate('/workshop/customers');
      } else {
        const created = await customersService.create(payload);
        setSavedCustomer({ id: created.id, nome: created.nome });
      }
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar cliente.',
      });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">{isEdit ? 'Editar Cliente' : 'Novo Cliente'}</h5>

      <CCard>
        <CCardBody className="p-4">
          {errors.root && (
            <CAlert color="danger" className="mb-3">{errors.root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            <div className="mb-3">
              <CFormLabel>Nome</CFormLabel>
              <CFormInput {...register('nome')} invalid={!!errors.nome} />
              {errors.nome && <CFormFeedback invalid>{errors.nome.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>CPF / CNPJ (somente números)</CFormLabel>
              <CFormInput {...register('cpfCnpj')} maxLength={14} invalid={!!errors.cpfCnpj} />
              {errors.cpfCnpj && <CFormFeedback invalid>{errors.cpfCnpj.message}</CFormFeedback>}
            </div>
            <div className="mb-3">
              <CFormLabel>WhatsApp (opcional)</CFormLabel>
              <CFormInput {...register('whatsapp')} />
            </div>
            <div className="mb-4">
              <CFormLabel>E-mail (opcional)</CFormLabel>
              <CFormInput type="email" {...register('email')} invalid={!!errors.email} />
              {errors.email && <CFormFeedback invalid>{errors.email.message}</CFormFeedback>}
            </div>
            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" className="flex-grow-1" onClick={() => navigate('/workshop/customers')}>
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" className="flex-grow-1" disabled={isSubmitting}>
                {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
              </CButton>
            </div>
          </form>
        </CCardBody>
      </CCard>

      <CModal visible={Boolean(savedCustomer)} onClose={() => navigate('/workshop/customers')}>
        <CModalHeader>
          <CModalTitle>Cadastrar veículo?</CModalTitle>
        </CModalHeader>
        <CModalBody>
          Deseja cadastrar um veículo para <strong>{savedCustomer?.nome}</strong>?
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => navigate('/workshop/customers')}>Não</CButton>
          <CButton
            color="primary"
            onClick={() => navigate(`/workshop/vehicles/new?customerId=${savedCustomer?.id}`)}
          >
            Sim
          </CButton>
        </CModalFooter>
      </CModal>
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
git add apps/frontend/src/pages/workshop/customers/CustomerFormPage.tsx
git commit -m "feat(customers): rewrite CustomerFormPage with CoreUI CModal post-save dialog"
```

---

### Task 3: Rewrite CustomerDetailPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/customers/CustomerDetailPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CBadge,
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
import CIcon from '@coreui/icons-react';
import { cilArrowLeft, cilPen, cilPlus } from '@coreui/icons';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function CustomerDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      customersService.getById(id),
      vehiclesService.list({ page: 1, limit: 1000, search: undefined }),
    ]).then(([c, v]) => {
      setCustomer(c);
      setVehicles(v.data.filter((veh) => veh.customerId === id));
    }).catch(() => {
      setCustomer(null);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-4">
        <CSpinner color="primary" />
      </div>
    );
  }
  if (!customer) return <p>Cliente não encontrado.</p>;

  return (
    <>
      <div className="d-flex align-items-center gap-2 mb-4">
        <CButton color="secondary" variant="ghost" size="sm" onClick={() => navigate('/workshop/customers')}>
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <h5 className="fw-bold mb-0">{customer.nome}</h5>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          className="ms-auto"
          onClick={() => navigate(`/workshop/customers/${id}/edit`)}
        >
          <CIcon icon={cilPen} className="me-1" />
          Editar
        </CButton>
      </div>

      <CCard className="mb-4">
        <CCardBody>
          <div className="mb-2">
            <small className="text-secondary">CPF / CNPJ</small>
            <div>{customer.cpfCnpj}</div>
          </div>
          <hr className="my-2" />
          <div className="mb-2">
            <small className="text-secondary">WhatsApp</small>
            <div>{customer.whatsapp ?? '—'}</div>
          </div>
          <hr className="my-2" />
          <div>
            <small className="text-secondary">E-mail</small>
            <div>{customer.email ?? '—'}</div>
          </div>
        </CCardBody>
      </CCard>

      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold mb-0">Veículos</h6>
        <CButton
          color="secondary"
          variant="outline"
          size="sm"
          onClick={() => navigate(`/workshop/vehicles/new?customerId=${id}`)}
        >
          <CIcon icon={cilPlus} className="me-1" />
          Novo Veículo
        </CButton>
      </div>

      <CCard>
        <CTable small hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Placa</CTableHeaderCell>
              <CTableHeaderCell>Marca / Modelo</CTableHeaderCell>
              <CTableHeaderCell>Ano</CTableHeaderCell>
              <CTableHeaderCell>KM</CTableHeaderCell>
              <CTableHeaderCell />
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {vehicles.length === 0 ? (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center text-secondary">
                  Nenhum veículo cadastrado.
                </CTableDataCell>
              </CTableRow>
            ) : vehicles.map((v) => (
              <CTableRow key={v.id}>
                <CTableDataCell>
                  <CBadge color="secondary">{v.placa}</CBadge>
                </CTableDataCell>
                <CTableDataCell>{v.marca} {v.modelo}</CTableDataCell>
                <CTableDataCell>{v.ano}</CTableDataCell>
                <CTableDataCell>{v.km.toLocaleString()} km</CTableDataCell>
                <CTableDataCell>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
          </CTableBody>
        </CTable>
      </CCard>
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
git add apps/frontend/src/pages/workshop/customers/CustomerDetailPage.tsx
git commit -m "feat(customers): rewrite CustomerDetailPage with CoreUI"
```

---

### Task 4: Rewrite VehiclesPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CFormInput,
  CPagination,
  CPaginationItem,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilHistory, cilPen, cilTrash } from '@coreui/icons';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

export function VehiclesPage() {
  const navigate = useNavigate();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await vehiclesService.list({
        page: page + 1,
        limit: rowsPerPage,
        search: search || undefined,
      });
      setVehicles(result.data);
      setTotal(result.total);
    } catch {
      setError('Erro ao carregar veículos.');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search]);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este veículo?')) return;
    try {
      await vehiclesService.delete(id);
      loadVehicles();
    } catch (err: any) {
      alert(err?.response?.data?.message ?? 'Erro ao excluir.');
    }
  };

  const totalPages = Math.ceil(total / rowsPerPage) || 1;

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Veículos</h5>
        <CButton color="primary" size="sm" onClick={() => navigate('/workshop/vehicles/new')}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Veículo
        </CButton>
      </div>

      <CFormInput
        placeholder="Buscar por placa, marca ou modelo"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        className="mb-3"
        style={{ maxWidth: 360 }}
        size="sm"
      />

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Placa</CTableHeaderCell>
              <CTableHeaderCell>Marca</CTableHeaderCell>
              <CTableHeaderCell>Modelo</CTableHeaderCell>
              <CTableHeaderCell>Ano</CTableHeaderCell>
              <CTableHeaderCell>KM</CTableHeaderCell>
              <CTableHeaderCell>Cliente</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {loading ? (
              <CTableRow>
                <CTableDataCell colSpan={7} className="text-center py-3">
                  <CSpinner size="sm" />
                </CTableDataCell>
              </CTableRow>
            ) : vehicles.map((v) => (
              <CTableRow key={v.id}>
                <CTableDataCell>
                  <CBadge color="secondary">{v.placa}</CBadge>
                </CTableDataCell>
                <CTableDataCell>{v.marca}</CTableDataCell>
                <CTableDataCell>{v.modelo}</CTableDataCell>
                <CTableDataCell>{v.ano}</CTableDataCell>
                <CTableDataCell>{v.km.toLocaleString()} km</CTableDataCell>
                <CTableDataCell>
                  <CBadge
                    color="info"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/workshop/customers/${v.customerId}`)}
                  >
                    {v.customerId.slice(0, 8)}…
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    title="Prontuário"
                    onClick={() => navigate(`/workshop/vehicles/${v.id}/history`)}
                  >
                    <CIcon icon={cilHistory} />
                  </CButton>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    title="Editar"
                    onClick={() => navigate(`/workshop/vehicles/${v.id}/edit`)}
                  >
                    <CIcon icon={cilPen} />
                  </CButton>
                  <CButton
                    color="danger"
                    variant="ghost"
                    size="sm"
                    title="Excluir"
                    onClick={() => handleDelete(v.id)}
                  >
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
git add apps/frontend/src/pages/workshop/vehicles/VehiclesPage.tsx
git commit -m "feat(vehicles): rewrite VehiclesPage with CoreUI CTable + CPagination"
```

---

### Task 5: Rewrite VehicleFormPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx`

**Context:** Has CPF search (blur + button), customerId hidden field, then vehicle fields. Preserve the CPF lookup logic exactly.

**Step 1: Rewrite the file**

```tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
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
  CInputGroup,
  CSpinner,
} from '@coreui/react';
import { vehiclesService } from '../../../services/vehicles.service';
import { customersService } from '../../../services/customers.service';

const currentYear = new Date().getFullYear();

const schema = z.object({
  customerId: z.string().uuid('ID do cliente inválido'),
  placa: z
    .string()
    .regex(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, 'Placa inválida (ex: ABC1234 ou ABC1D23)'),
  marca: z.string().min(1, 'Marca obrigatória'),
  modelo: z.string().min(1, 'Modelo obrigatório'),
  ano: z.coerce
    .number()
    .int()
    .min(1900, 'Ano inválido')
    .max(currentYear + 1, `Ano máximo: ${currentYear + 1}`),
  km: z.coerce.number().int().min(0, 'KM não pode ser negativo'),
});

type FormData = z.infer<typeof schema>;

export function VehicleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) as Resolver<FormData> });

  const [cpfInput, setCpfInput] = useState('');
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const handleCpfSearch = async () => {
    const cpf = cpfInput.trim();
    if (!cpf || searching) return;
    setSearching(true);
    setCpfError(null);
    setCustomerName(null);
    try {
      const result = await customersService.list({ search: cpf, limit: 1 });
      const found = result.data.find((c) => c.cpfCnpj === cpf);
      if (found) {
        setValue('customerId', found.id, { shouldValidate: true });
        setCustomerName(found.nome);
      } else {
        setValue('customerId', '', { shouldValidate: false });
        setCpfError('Cliente não encontrado para o CPF informado.');
      }
    } catch {
      setCpfError('Erro ao buscar cliente. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const prefilledCustomerId = searchParams.get('customerId');
    if (isEdit && id) {
      vehiclesService.getById(id).then((v) => {
        reset({ customerId: v.customerId, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, km: v.km });
        customersService.getById(v.customerId).then((c) => {
          setCpfInput(c.cpfCnpj);
          setCustomerName(c.nome);
        }).catch(() => { /* display-only */ });
      });
    } else if (prefilledCustomerId) {
      reset({ customerId: prefilledCustomerId, placa: '', marca: '', modelo: '', ano: currentYear, km: 0 });
      customersService.getById(prefilledCustomerId).then((c) => {
        setCpfInput(c.cpfCnpj);
        setCustomerName(c.nome);
      }).catch(() => { /* display-only */ });
    }
  }, [id, isEdit, reset, searchParams]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && id) {
        await vehiclesService.update(id, data);
      } else {
        await vehiclesService.create(data);
      }
      navigate(-1);
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar veículo.',
      });
    }
  };

  return (
    <div style={{ maxWidth: 560 }}>
      <h5 className="fw-bold mb-4">{isEdit ? 'Editar Veículo' : 'Novo Veículo'}</h5>
      <CCard>
        <CCardBody className="p-4">
          {errors.root && (
            <CAlert color="danger" className="mb-3">{errors.root.message}</CAlert>
          )}
          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* CPF search */}
            <div className="mb-3">
              <CFormLabel>CPF do Cliente</CFormLabel>
              <CInputGroup>
                <CFormInput
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={handleCpfSearch}
                  maxLength={14}
                  invalid={Boolean(cpfError || errors.customerId)}
                />
                <CButton
                  color="secondary"
                  variant="outline"
                  onClick={handleCpfSearch}
                  disabled={searching || !cpfInput.trim()}
                  style={{ minWidth: 80 }}
                >
                  {searching ? <CSpinner size="sm" /> : 'Buscar'}
                </CButton>
              </CInputGroup>
              {customerName && (
                <div className="text-success small mt-1">✓ {customerName}</div>
              )}
              {cpfError && <CAlert color="danger" className="mt-2 py-2">{cpfError}</CAlert>}
              {errors.customerId && !cpfError && (
                <CFormFeedback invalid style={{ display: 'block' }}>
                  {errors.customerId.message}
                </CFormFeedback>
              )}
            </div>

            <div className="mb-3">
              <CFormLabel>Placa (ex: ABC1234)</CFormLabel>
              <CFormInput
                {...register('placa')}
                maxLength={7}
                style={{ textTransform: 'uppercase' }}
                invalid={!!errors.placa}
              />
              {errors.placa && <CFormFeedback invalid>{errors.placa.message}</CFormFeedback>}
            </div>

            <div className="mb-3">
              <CFormLabel>Marca</CFormLabel>
              <CFormInput {...register('marca')} invalid={!!errors.marca} />
              {errors.marca && <CFormFeedback invalid>{errors.marca.message}</CFormFeedback>}
            </div>

            <div className="mb-3">
              <CFormLabel>Modelo</CFormLabel>
              <CFormInput {...register('modelo')} invalid={!!errors.modelo} />
              {errors.modelo && <CFormFeedback invalid>{errors.modelo.message}</CFormFeedback>}
            </div>

            <div className="d-flex gap-3 mb-4">
              <div className="flex-grow-1">
                <CFormLabel>Ano</CFormLabel>
                <CFormInput type="number" {...register('ano')} invalid={!!errors.ano} />
                {errors.ano && <CFormFeedback invalid>{errors.ano.message}</CFormFeedback>}
              </div>
              <div className="flex-grow-1">
                <CFormLabel>KM</CFormLabel>
                <CFormInput type="number" {...register('km')} invalid={!!errors.km} />
                {errors.km && <CFormFeedback invalid>{errors.km.message}</CFormFeedback>}
              </div>
            </div>

            <div className="d-flex gap-2">
              <CButton color="secondary" variant="outline" className="flex-grow-1" onClick={() => navigate(-1)}>
                Cancelar
              </CButton>
              <CButton type="submit" color="primary" className="flex-grow-1" disabled={isSubmitting}>
                {isSubmitting ? <CSpinner size="sm" /> : 'Salvar'}
              </CButton>
            </div>
          </form>
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
git add apps/frontend/src/pages/workshop/vehicles/VehicleFormPage.tsx
git commit -m "feat(vehicles): rewrite VehicleFormPage with CoreUI CInputGroup CPF search"
```

---

### Task 6: Rewrite VehicleHistoryPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/vehicles/VehicleHistoryPage.tsx`

**Context:** STATUS_COLOR maps MUI chip colors to CoreUI CBadge colors: `default→secondary`, `info→info`, `primary→primary`, `warning→warning`, `secondary→secondary`, `success→success`.

**Step 1: Rewrite the file**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft } from '@coreui/icons';
import {
  vehiclesService,
  type Vehicle,
  type VehicleServiceOrder,
} from '../../../services/vehicles.service';

const STATUS_LABEL: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<string, string> = {
  ORCAMENTO: 'secondary',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

const fmt = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export function VehicleHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [orders, setOrders] = useState<VehicleServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [v, os] = await Promise.all([
        vehiclesService.getById(id),
        vehiclesService.getServiceOrders(id),
      ]);
      setVehicle(v);
      setOrders(os);
    } catch {
      setError('Erro ao carregar histórico do veículo.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-4">
        <CSpinner color="primary" />
      </div>
    );
  }

  return (
    <>
      <CButton
        color="secondary"
        variant="ghost"
        size="sm"
        className="mb-3"
        onClick={() => navigate('/workshop/vehicles')}
      >
        <CIcon icon={cilArrowLeft} className="me-1" />
        Veículos
      </CButton>

      <div className="mb-4">
        <h5 className="fw-bold mb-0">
          {vehicle
            ? `${vehicle.placa} — ${vehicle.marca} ${vehicle.modelo} ${vehicle.ano}`
            : 'Veículo'}
        </h5>
        <small className="text-secondary">Prontuário do Veículo</small>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      {orders.length === 0 && !error && (
        <p className="text-secondary">
          Nenhuma ordem de serviço registrada para este veículo.
        </p>
      )}

      <div className="d-flex flex-column gap-3">
        {orders.map((o) => {
          const services = o.itemsServices.map((s) => s.nomeServico).join(', ');
          const parts = o.itemsParts
            .map((p) => `${p.nomePeca} x${p.quantidade}`)
            .join(', ');

          return (
            <CCard key={o.id}>
              <CCardBody>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="text-secondary">
                    {new Date(o.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </small>
                  <CBadge color={STATUS_COLOR[o.status] ?? 'secondary'}>
                    {STATUS_LABEL[o.status] ?? o.status}
                  </CBadge>
                </div>

                {o.kmEntrada && (
                  <p className="text-secondary small mb-1">KM entrada: {o.kmEntrada}</p>
                )}
                {services && (
                  <p className="small mb-1"><strong>Serviços:</strong> {services}</p>
                )}
                {parts && (
                  <p className="small mb-0"><strong>Peças:</strong> {parts}</p>
                )}

                <hr className="my-2" />

                <div className="d-flex justify-content-between align-items-center">
                  <strong>{fmt(o.total)}</strong>
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/service-orders/${o.id}`)}
                  >
                    Ver OS →
                  </CButton>
                </div>
              </CCardBody>
            </CCard>
          );
        })}
      </div>
    </>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No MUI imports in any customers or vehicles file.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/vehicles/VehicleHistoryPage.tsx
git commit -m "feat(vehicles): rewrite VehicleHistoryPage with CoreUI CBadge status cards"
```
