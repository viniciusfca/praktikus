# CoreUI Migration — Phase 4: Service Orders + Appointments

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace all MUI components in Service Orders and Appointments with CoreUI. Six files total.

**Key decisions:**
- `MUI Autocomplete` → `CFormSelect` (native select — loses type-ahead but preserves functionality)
- `MUI Drawer` → `COffcanvas placement="end"`
- `Dialog` → `CModal`
- `ToggleButtonGroup` → `CButtonGroup` with active state
- `Tooltip` → `CTooltip`
- `TextField multiline` → `CFormTextarea`

**Icons:** `cilChevronLeft`, `cilChevronRight`, `cilCalendar`, `cilList`, `cilX`, `cilSend`, `cilCopy`, `cilExternalLink`, `cilArrowLeft`, `cilPlus`.

---

### Task 1: Rewrite ServiceOrdersPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/service-orders/ServiceOrdersPage.tsx`

**Step 1: Rewrite the file**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CBadge,
  CButton,
  CCard,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilExternalLink } from '@coreui/icons';
import { serviceOrdersApi, type ServiceOrder, type SoStatus } from '../../../services/service-orders.service';
import { CreateServiceOrderDialog } from './CreateServiceOrderDialog';

const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<SoStatus, string> = {
  ORCAMENTO: 'secondary',
  APROVADO: 'info',
  EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning',
  FINALIZADA: 'secondary',
  ENTREGUE: 'success',
};

export function ServiceOrdersPage() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const data = await serviceOrdersApi.list();
    setOrders(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="fw-bold mb-0">Ordens de Serviço</h5>
        <CButton color="primary" size="sm" onClick={() => setCreateOpen(true)}>
          <CIcon icon={cilPlus} className="me-1" />
          Nova OS
        </CButton>
      </div>

      <CCard>
        <CTable hover responsive>
          <CTableHead>
            <CTableRow>
              <CTableHeaderCell>Data</CTableHeaderCell>
              <CTableHeaderCell>Status</CTableHeaderCell>
              <CTableHeaderCell>Pagamento</CTableHeaderCell>
              <CTableHeaderCell>KM</CTableHeaderCell>
              <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
            </CTableRow>
          </CTableHead>
          <CTableBody>
            {orders.map((so) => (
              <CTableRow key={so.id}>
                <CTableDataCell>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</CTableDataCell>
                <CTableDataCell>
                  <CBadge color={STATUS_COLOR[so.status]}>{STATUS_LABEL[so.status]}</CBadge>
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge
                    color={so.statusPagamento === 'PAGO' ? 'success' : 'secondary'}
                    style={{ border: '1px solid currentColor', background: 'transparent' }}
                  >
                    {so.statusPagamento}
                  </CBadge>
                </CTableDataCell>
                <CTableDataCell>{so.kmEntrada ?? '—'}</CTableDataCell>
                <CTableDataCell className="text-end">
                  <CButton
                    color="secondary"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/workshop/service-orders/${so.id}`)}
                  >
                    <CIcon icon={cilExternalLink} />
                  </CButton>
                </CTableDataCell>
              </CTableRow>
            ))}
            {orders.length === 0 && (
              <CTableRow>
                <CTableDataCell colSpan={5} className="text-center text-secondary">
                  Nenhuma OS encontrada.
                </CTableDataCell>
              </CTableRow>
            )}
          </CTableBody>
        </CTable>
      </CCard>

      <CreateServiceOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
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
git add apps/frontend/src/pages/workshop/service-orders/ServiceOrdersPage.tsx
git commit -m "feat(service-orders): rewrite ServiceOrdersPage with CoreUI CTable CBadge"
```

---

### Task 2: Rewrite CreateServiceOrderDialog.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/service-orders/CreateServiceOrderDialog.tsx`

**Context:** Replaces MUI Autocomplete with CFormSelect + Controller. The select options show all customers/vehicles loaded on open.

**Step 1: Rewrite the file**

```tsx
import { useEffect, useState } from 'react';
import {
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { serviceOrdersApi, type CreateServiceOrderPayload } from '../../../services/service-orders.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';
import { appointmentsApi, type Appointment } from '../../../services/appointments.service';

const schema = z.object({
  clienteId: z.string().uuid('Selecione um cliente'),
  veiculoId: z.string().uuid('Selecione um veículo'),
  appointmentId: z.string().uuid().optional().or(z.literal('')),
  kmEntrada: z.string().optional(),
  combustivel: z.string().optional(),
  observacoesEntrada: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CreateServiceOrderDialog({ open, onClose, onSaved }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [saving, setSaving] = useState(false);

  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { clienteId: '', veiculoId: '', appointmentId: '' },
  });

  const selectedClienteId = watch('clienteId');

  useEffect(() => {
    if (!open) return;
    customersService.list({ limit: 200 }).then((r) => setCustomers(r.data));
  }, [open]);

  useEffect(() => {
    if (!selectedClienteId) { setVehicles([]); setAppointments([]); return; }
    Promise.all([
      vehiclesService.list({ limit: 200 }),
      appointmentsApi.list(),
    ]).then(([vRes, aRes]) => {
      setVehicles(vRes.data.filter((v) => v.customerId === selectedClienteId));
      setAppointments(aRes.filter((a) => a.clienteId === selectedClienteId));
    });
  }, [selectedClienteId]);

  useEffect(() => {
    if (!open) reset({ clienteId: '', veiculoId: '', appointmentId: '' });
  }, [open, reset]);

  const onSubmit = async (values: FormData) => {
    setSaving(true);
    try {
      const payload: CreateServiceOrderPayload = {
        clienteId: values.clienteId,
        veiculoId: values.veiculoId,
        ...(values.appointmentId ? { appointmentId: values.appointmentId } : {}),
        kmEntrada: values.kmEntrada || undefined,
        combustivel: values.combustivel || undefined,
        observacoesEntrada: values.observacoesEntrada || undefined,
      };
      await serviceOrdersApi.create(payload);
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <CModal visible={open} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>Nova Ordem de Serviço</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-3">
          <div>
            <CFormLabel>Cliente</CFormLabel>
            <Controller
              name="clienteId"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field} invalid={!!errors.clienteId}>
                  <option value="">Selecione um cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.cpfCnpj}</option>
                  ))}
                </CFormSelect>
              )}
            />
            {errors.clienteId && <CFormFeedback invalid>{errors.clienteId.message}</CFormFeedback>}
          </div>

          <div>
            <CFormLabel>Veículo</CFormLabel>
            <Controller
              name="veiculoId"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field} disabled={!selectedClienteId} invalid={!!errors.veiculoId}>
                  <option value="">{!selectedClienteId ? 'Selecione o cliente primeiro' : 'Selecione um veículo'}</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                  ))}
                </CFormSelect>
              )}
            />
            {errors.veiculoId && <CFormFeedback invalid>{errors.veiculoId.message}</CFormFeedback>}
          </div>

          <div>
            <CFormLabel>Agendamento (opcional)</CFormLabel>
            <Controller
              name="appointmentId"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field} disabled={!selectedClienteId}>
                  <option value="">Nenhum</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.dataHora).toLocaleString('pt-BR')} — {a.tipoServico ?? 'Sem tipo'}
                    </option>
                  ))}
                </CFormSelect>
              )}
            />
          </div>

          <div>
            <CFormLabel>KM de Entrada</CFormLabel>
            <CFormInput {...register('kmEntrada')} />
          </div>

          <div>
            <CFormLabel>Combustível</CFormLabel>
            <CFormInput {...register('combustivel')} placeholder="ex: 1/2, Cheio..." />
          </div>

          <div>
            <CFormLabel>Observações de Entrada</CFormLabel>
            <CFormTextarea {...register('observacoesEntrada')} rows={3} />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? <CSpinner size="sm" /> : 'Criar OS'}
        </CButton>
      </CModalFooter>
    </CModal>
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
git add apps/frontend/src/pages/workshop/service-orders/CreateServiceOrderDialog.tsx
git commit -m "feat(service-orders): rewrite CreateServiceOrderDialog with CoreUI CModal CFormSelect"
```

---

### Task 3: Rewrite ServiceOrderDetailPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx`

**Context:** Complex file with two inline sub-components (AddServiceDialog, AddPartDialog) and a main page. Preserve all business logic exactly. `Dialog` → `CModal`, `TextField select` → `CFormSelect`, `Tooltip` → `CTooltip`, `Stack` → div flex, `Divider` → `<hr/>`.

**Step 1: Rewrite the file**

```tsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CFormTextarea,
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
  CTooltip,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilArrowLeft, cilCopy } from '@coreui/icons';
import {
  serviceOrdersApi, soItemsServicesApi, soItemsPartsApi,
  type ServiceOrderDetail, type SoStatus,
} from '../../../services/service-orders.service';
import { useAuthStore } from '../../../store/auth.store';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';
import { catalogServicesApi, catalogPartsApi, type CatalogService, type CatalogPart } from '../../../services/catalog.service';
import { pdf } from '@react-pdf/renderer';
import { OsPdf } from '../../../components/OsPdf';
import { companiesService, type CompanyProfile } from '../../../services/companies.service';

// ---------- helpers ----------
const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento', APROVADO: 'Aprovado', EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça', FINALIZADA: 'Finalizada', ENTREGUE: 'Entregue',
};
const STATUS_COLOR: Record<SoStatus, string> = {
  ORCAMENTO: 'secondary', APROVADO: 'info', EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning', FINALIZADA: 'secondary', ENTREGUE: 'success',
};
const NEXT_STATUSES: Partial<Record<SoStatus, SoStatus[]>> = {
  ORCAMENTO: ['APROVADO'],
  APROVADO: ['EM_EXECUCAO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'FINALIZADA'],
  AGUARDANDO_PECA: ['EM_EXECUCAO'],
  FINALIZADA: ['ENTREGUE'],
};
const fmt = (n: number) => `R$ ${Number(n).toFixed(2)}`;

// ---------- AddServiceDialog ----------
interface AddServiceDialogProps {
  open: boolean;
  soId: string;
  services: CatalogService[];
  onClose: () => void;
  onSaved: () => void;
}

function AddServiceDialog({ open, soId, services, onClose, onSaved }: AddServiceDialogProps) {
  const [serviceId, setServiceId] = useState('');
  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [mecanicoId, setMecanicoId] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setServiceId(''); setNome(''); setValor(''); setMecanicoId(''); }
  }, [open]);

  const handleSave = async () => {
    if (!serviceId || !nome || !valor) return;
    setSaving(true);
    try {
      await soItemsServicesApi.create(soId, {
        catalogServiceId: serviceId,
        nomeServico: nome,
        valor: Number(valor),
        mecanicoId: mecanicoId || undefined,
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <CModal visible={open} onClose={onClose} size="sm">
      <CModalHeader><CModalTitle>Adicionar Serviço</CModalTitle></CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-3">
          <div>
            <CFormLabel>Serviço</CFormLabel>
            <CFormSelect
              value={serviceId}
              onChange={(e) => {
                const s = services.find((x) => x.id === e.target.value);
                setServiceId(e.target.value);
                setNome(s?.nome ?? '');
                setValor(String(s?.precoPadrao ?? ''));
              }}
            >
              <option value="" />
              {services.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </CFormSelect>
          </div>
          <div>
            <CFormLabel>Nome do Serviço</CFormLabel>
            <CFormInput value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <CFormLabel>Valor (R$)</CFormLabel>
            <CFormInput type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <CFormLabel>ID do Mecânico (opcional)</CFormLabel>
            <CFormInput value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSave} disabled={saving}>Adicionar</CButton>
      </CModalFooter>
    </CModal>
  );
}

// ---------- AddPartDialog ----------
interface AddPartDialogProps {
  open: boolean;
  soId: string;
  parts: CatalogPart[];
  onClose: () => void;
  onSaved: () => void;
}

function AddPartDialog({ open, soId, parts, onClose, onSaved }: AddPartDialogProps) {
  const [partId, setPartId] = useState('');
  const [nome, setNome] = useState('');
  const [quantidade, setQuantidade] = useState('1');
  const [valorUnitario, setValorUnitario] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) { setPartId(''); setNome(''); setQuantidade('1'); setValorUnitario(''); }
  }, [open]);

  const handleSave = async () => {
    if (!partId || !nome || !valorUnitario) return;
    setSaving(true);
    try {
      await soItemsPartsApi.create(soId, {
        catalogPartId: partId,
        nomePeca: nome,
        quantidade: Number(quantidade),
        valorUnitario: Number(valorUnitario),
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <CModal visible={open} onClose={onClose} size="sm">
      <CModalHeader><CModalTitle>Adicionar Peça</CModalTitle></CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-3">
          <div>
            <CFormLabel>Peça</CFormLabel>
            <CFormSelect
              value={partId}
              onChange={(e) => {
                const p = parts.find((x) => x.id === e.target.value);
                setPartId(e.target.value);
                setNome(p?.nome ?? '');
                setValorUnitario(String(p?.precoUnitario ?? ''));
              }}
            >
              <option value="" />
              {parts.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </CFormSelect>
          </div>
          <div>
            <CFormLabel>Nome da Peça</CFormLabel>
            <CFormInput value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <CFormLabel>Quantidade</CFormLabel>
            <CFormInput type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          </div>
          <div>
            <CFormLabel>Valor Unitário (R$)</CFormLabel>
            <CFormInput type="number" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSave} disabled={saving}>Adicionar</CButton>
      </CModalFooter>
    </CModal>
  );
}

// ---------- main page ----------
export function ServiceOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const [so, setSo] = useState<ServiceOrderDetail | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [empresa, setEmpresa] = useState<CompanyProfile | null>(null);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const [km, setKm] = useState('');
  const [combustivel, setCombustivel] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);

  useEffect(() => {
    companiesService.getProfile().then(setEmpresa).catch(() => null);
  }, []);

  useEffect(() => {
    Promise.all([
      catalogServicesApi.list({ limit: 200 }),
      catalogPartsApi.list({ limit: 200 }),
    ]).then(([svcs, prts]) => {
      setCatalogServices(svcs.data);
      setCatalogParts(prts.data);
    }).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await serviceOrdersApi.getById(id);
      setSo(data);
      setKm(data.kmEntrada ?? '');
      setCombustivel(data.combustivel ?? '');
      setObservacoes(data.observacoesEntrada ?? '');
      const [cust, veh] = await Promise.all([
        customersService.getById(data.clienteId).catch(() => null),
        vehiclesService.getById(data.veiculoId).catch(() => null),
      ]);
      setCustomer(cust);
      setVehicle(veh);
    } catch {
      setError('Erro ao carregar OS.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (newStatus: SoStatus) => {
    if (!id) return;
    try {
      await serviceOrdersApi.patchStatus(id, newStatus);
      await load();
    } catch {
      setError('Erro ao atualizar status da OS.');
    }
  };

  const handleTogglePayment = async () => {
    if (!id || !so) return;
    const next = so.statusPagamento === 'PAGO' ? 'PENDENTE' : 'PAGO';
    try {
      await serviceOrdersApi.patchPaymentStatus(id, next);
      await load();
    } catch {
      setError('Erro ao atualizar status de pagamento.');
    }
  };

  const handleSaveChecklist = async () => {
    if (!id) return;
    setSavingChecklist(true);
    try {
      await serviceOrdersApi.update(id, { kmEntrada: km, combustivel, observacoesEntrada: observacoes });
      await load();
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleGenerateLink = async () => {
    if (!id) return;
    try {
      const { token } = await serviceOrdersApi.generateApprovalToken(id);
      const link = `${window.location.origin}/quotes/${token}`;
      setApprovalLink(link);
      await load();
    } catch {
      setError('Erro ao gerar link de aprovação.');
    }
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadPdf = async () => {
    if (!so || !empresa || !customer || !vehicle) return;
    try {
      const blob = await pdf(
        <OsPdf
          so={so}
          empresa={{ nomeFantasia: empresa.nomeFantasia }}
          cliente={{ nome: customer.nome, cpfCnpj: customer.cpfCnpj }}
          veiculo={{ placa: vehicle.placa, marca: vehicle.marca, modelo: vehicle.modelo, ano: vehicle.ano }}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OS-${so.id.slice(0, 8).toUpperCase()}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError('Erro ao gerar PDF.');
    }
  };

  const handleRemoveService = async (itemId: string) => {
    if (!id) return;
    try {
      await soItemsServicesApi.delete(id, itemId);
      await load();
    } catch {
      setError('Erro ao remover serviço.');
    }
  };

  const handleRemovePart = async (itemId: string) => {
    if (!id) return;
    try {
      await soItemsPartsApi.delete(id, itemId);
      await load();
    } catch {
      setError('Erro ao remover peça.');
    }
  };

  if (loading) return (
    <div className="d-flex justify-content-center mt-4">
      <CSpinner color="primary" />
    </div>
  );
  if (error || !so) return <CAlert color="danger">{error ?? 'OS não encontrada.'}</CAlert>;

  const totalServices = so.itemsServices.reduce((s, i) => s + Number(i.valor), 0);
  const totalParts = so.itemsParts.reduce((s, i) => s + Number(i.valorUnitario) * i.quantidade, 0);
  const total = totalServices + totalParts;
  const nextStatuses = NEXT_STATUSES[so.status] ?? [];
  const isFinal = so.status === 'ENTREGUE';
  const approvalDisplayLink =
    so.status === 'ORCAMENTO' && so.approvalToken
      ? approvalLink ?? `${window.location.origin}/quotes/${so.approvalToken}`
      : null;

  return (
    <>
      {/* Header */}
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        <CButton color="secondary" variant="ghost" size="sm" onClick={() => navigate('/workshop/service-orders')}>
          <CIcon icon={cilArrowLeft} />
        </CButton>
        <h5 className="fw-bold mb-0 me-auto">Ordem de Serviço</h5>
        <CBadge color={STATUS_COLOR[so.status]}>{STATUS_LABEL[so.status]}</CBadge>
        <CBadge
          color={so.statusPagamento === 'PAGO' ? 'success' : 'secondary'}
          style={{ cursor: isOwner ? 'pointer' : 'default', border: '1px solid currentColor', background: 'transparent' }}
          onClick={isOwner ? handleTogglePayment : undefined}
        >
          {so.statusPagamento}
        </CBadge>
        {nextStatuses.map((s) => (
          <CButton key={s} color="secondary" variant="outline" size="sm" onClick={() => handleTransition(s)}>
            → {STATUS_LABEL[s]}
          </CButton>
        ))}
        {so.status === 'ORCAMENTO' && (
          <CButton color="primary" size="sm" onClick={handleGenerateLink}>
            {so.approvalToken ? 'Gerar novo link' : 'Gerar link de aprovação'}
          </CButton>
        )}
        <CButton color="secondary" variant="outline" size="sm" onClick={handleDownloadPdf} disabled={!empresa}>
          Baixar PDF
        </CButton>
      </div>

      {/* Dados */}
      <CCard className="mb-3">
        <CCardBody>
          <div className="fw-semibold mb-2">Dados</div>
          <div>Cliente: {customer?.nome ?? so.clienteId}</div>
          <div>Veículo: {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : so.veiculoId}</div>
          {so.appointmentId && <div>Agendamento: {so.appointmentId}</div>}
          <small className="text-secondary">
            Criado em: {new Date(so.createdAt).toLocaleString('pt-BR')}
          </small>
        </CCardBody>
      </CCard>

      {/* Checklist */}
      <CCard className="mb-3">
        <CCardBody>
          <div className="fw-semibold mb-3">Checklist de Entrada</div>
          <div className="d-flex gap-3 flex-wrap mb-3">
            <div style={{ flex: '1 1 180px' }}>
              <CFormLabel>KM de Entrada</CFormLabel>
              <CFormInput size="sm" value={km} onChange={(e) => setKm(e.target.value)} disabled={isFinal} />
            </div>
            <div style={{ flex: '1 1 180px' }}>
              <CFormLabel>Combustível</CFormLabel>
              <CFormInput size="sm" value={combustivel} onChange={(e) => setCombustivel(e.target.value)} disabled={isFinal} />
            </div>
          </div>
          <div className="mb-3">
            <CFormLabel>Observações / Avarias</CFormLabel>
            <CFormTextarea
              rows={3}
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={isFinal}
            />
          </div>
          {!isFinal && (
            <CButton color="secondary" variant="outline" size="sm" onClick={handleSaveChecklist} disabled={savingChecklist}>
              {savingChecklist ? 'Salvando...' : 'Salvar Checklist'}
            </CButton>
          )}
        </CCardBody>
      </CCard>

      {/* Serviços */}
      <CCard className="mb-3">
        <CCardBody>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">Serviços</div>
            {!isFinal && (
              <CButton color="secondary" variant="ghost" size="sm" onClick={() => setAddServiceOpen(true)}>
                + Adicionar
              </CButton>
            )}
          </div>
          <CTable small responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Serviço</CTableHeaderCell>
                <CTableHeaderCell>Mecânico</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Valor</CTableHeaderCell>
                {!isFinal && <CTableHeaderCell />}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {so.itemsServices.map((item) => (
                <CTableRow key={item.id}>
                  <CTableDataCell>{item.nomeServico}</CTableDataCell>
                  <CTableDataCell>{item.mecanicoId ?? '—'}</CTableDataCell>
                  <CTableDataCell className="text-end">{fmt(item.valor)}</CTableDataCell>
                  {!isFinal && (
                    <CTableDataCell className="text-end">
                      <CButton color="danger" variant="ghost" size="sm" onClick={() => handleRemoveService(item.id)}>Remover</CButton>
                    </CTableDataCell>
                  )}
                </CTableRow>
              ))}
              {so.itemsServices.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={isFinal ? 3 : 4} className="text-center text-secondary">Nenhum serviço.</CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Peças */}
      <CCard className="mb-3">
        <CCardBody>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div className="fw-semibold">Peças</div>
            {!isFinal && (
              <CButton color="secondary" variant="ghost" size="sm" onClick={() => setAddPartOpen(true)}>
                + Adicionar
              </CButton>
            )}
          </div>
          <CTable small responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Peça</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Qtd</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Valor Unit.</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Subtotal</CTableHeaderCell>
                {!isFinal && <CTableHeaderCell />}
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {so.itemsParts.map((item) => (
                <CTableRow key={item.id}>
                  <CTableDataCell>{item.nomePeca}</CTableDataCell>
                  <CTableDataCell className="text-end">{item.quantidade}</CTableDataCell>
                  <CTableDataCell className="text-end">{fmt(item.valorUnitario)}</CTableDataCell>
                  <CTableDataCell className="text-end">{fmt(Number(item.valorUnitario) * item.quantidade)}</CTableDataCell>
                  {!isFinal && (
                    <CTableDataCell className="text-end">
                      <CButton color="danger" variant="ghost" size="sm" onClick={() => handleRemovePart(item.id)}>Remover</CButton>
                    </CTableDataCell>
                  )}
                </CTableRow>
              ))}
              {so.itemsParts.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={isFinal ? 4 : 5} className="text-center text-secondary">Nenhuma peça.</CTableDataCell>
                </CTableRow>
              )}
            </CTableBody>
          </CTable>
        </CCardBody>
      </CCard>

      {/* Total */}
      <CCard className="mb-3">
        <CCardBody>
          <div className="fw-semibold mb-2">Total</div>
          <hr className="my-2" />
          <div className="d-flex justify-content-between"><span>Serviços</span><span>{fmt(totalServices)}</span></div>
          <div className="d-flex justify-content-between"><span>Peças</span><span>{fmt(totalParts)}</span></div>
          <hr className="my-2" />
          <div className="d-flex justify-content-between fw-bold fs-5">
            <span>Total</span><span>{fmt(total)}</span>
          </div>
        </CCardBody>
      </CCard>

      {/* Aprovação */}
      {approvalDisplayLink && (
        <CCard className="mb-3">
          <CCardBody>
            <div className="fw-semibold mb-2">Link de Aprovação</div>
            {so.approvalExpiresAt && (
              <CAlert color="info" className="mb-2">
                Token ativo até {new Date(so.approvalExpiresAt).toLocaleString('pt-BR')}
              </CAlert>
            )}
            <div className="d-flex gap-2 align-items-center mb-2">
              <CButton color="secondary" variant="outline" size="sm" onClick={handleGenerateLink}>
                Gerar novo link
              </CButton>
              <CTooltip content={copied ? 'Copiado!' : 'Copiar link'}>
                <CButton color="secondary" variant="ghost" size="sm" onClick={() => handleCopy(approvalDisplayLink)}>
                  <CIcon icon={cilCopy} />
                </CButton>
              </CTooltip>
            </div>
            <small className="text-secondary" style={{ wordBreak: 'break-all' }}>
              {approvalDisplayLink}
            </small>
          </CCardBody>
        </CCard>
      )}

      <AddServiceDialog
        open={addServiceOpen}
        soId={so.id}
        services={catalogServices}
        onClose={() => setAddServiceOpen(false)}
        onSaved={load}
      />
      <AddPartDialog
        open={addPartOpen}
        soId={so.id}
        parts={catalogParts}
        onClose={() => setAddPartOpen(false)}
        onSaved={load}
      />
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
git add apps/frontend/src/pages/workshop/service-orders/ServiceOrderDetailPage.tsx
git commit -m "feat(service-orders): rewrite ServiceOrderDetailPage with CoreUI CModal CTable"
```

---

### Task 4: Rewrite AppointmentsPage.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/appointments/AppointmentsPage.tsx`

**Context:** Has calendar view (7-day week grid) and list view. `ToggleButtonGroup` → two `CButton` with active state. Calendar uses CSS grid with inline styles. Status badge colors: PENDENTE=warning, CONFIRMADO=info, CONCLUIDO=success, CANCELADO=secondary.

**Calendar cell colors (inline styles):**
- PENDENTE: `#f9b115`
- CONFIRMADO: `#39f`
- CONCLUIDO: `#1b9e3e`
- CANCELADO: `#aab3c5`

**Step 1: Rewrite the file**

```tsx
import { useState, useEffect, useCallback } from 'react';
import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilPlus, cilChevronLeft, cilChevronRight, cilCalendar, cilList, cilPen, cilTrash } from '@coreui/icons';
import {
  appointmentsApi, type Appointment,
} from '../../../services/appointments.service';
import { AppointmentFormDialog } from './AppointmentFormDialog';
import { AppointmentDrawer } from './AppointmentDrawer';
import { useAuthStore } from '../../../store/auth.store';

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'secondary',
};

const CALENDAR_BG: Record<string, string> = {
  PENDENTE: '#f9b115',
  CONFIRMADO: '#39f',
  CONCLUIDO: '#1b9e3e',
  CANCELADO: '#aab3c5',
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay();
  const monday = new Date(referenceDate);
  monday.setDate(referenceDate.getDate() - day + (day === 0 ? -6 : 1));
  monday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function AppointmentsPage() {
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [weekRef, setWeekRef] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const weekDates = getWeekDates(weekRef);
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await appointmentsApi.list({
        date_start: weekStart.toISOString(),
        date_end: new Date(weekEnd.getTime() + 86400000).toISOString(),
      });
      setAppointments(items);
    } catch {
      setError('Erro ao carregar agendamentos.');
    } finally {
      setLoading(false);
    }
  }, [weekStart.toISOString(), weekEnd.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const prevWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() - 7); return n; });
  const nextWeek = () => setWeekRef((d) => { const n = new Date(d); n.setDate(d.getDate() + 7); return n; });

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (appt: Appointment) => { setEditing(appt); setFormOpen(true); setSelectedId(null); };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Confirmar exclusão?')) return;
    try {
      await appointmentsApi.delete(id);
      load();
    } catch {
      setError('Erro ao deletar agendamento.');
    }
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – ${weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}`;

  return (
    <>
      <div className="d-flex align-items-center justify-content-between mb-3">
        <h5 className="fw-bold mb-0">Agendamentos</h5>
        <CButton color="primary" size="sm" onClick={openNew}>
          <CIcon icon={cilPlus} className="me-1" />
          Novo Agendamento
        </CButton>
      </div>

      {error && <CAlert color="danger" className="mb-3">{error}</CAlert>}

      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-center gap-2">
          <CButton color="secondary" variant="ghost" size="sm" onClick={prevWeek}>
            <CIcon icon={cilChevronLeft} />
          </CButton>
          <span>{weekLabel}</span>
          <CButton color="secondary" variant="ghost" size="sm" onClick={nextWeek}>
            <CIcon icon={cilChevronRight} />
          </CButton>
        </div>
        <CButtonGroup size="sm">
          <CButton
            color="secondary"
            variant={view === 'calendar' ? undefined : 'outline'}
            onClick={() => setView('calendar')}
          >
            <CIcon icon={cilCalendar} />
          </CButton>
          <CButton
            color="secondary"
            variant={view === 'list' ? undefined : 'outline'}
            onClick={() => setView('list')}
          >
            <CIcon icon={cilList} />
          </CButton>
        </CButtonGroup>
      </div>

      {loading && <div className="text-center py-4"><CSpinner color="primary" /></div>}

      {!loading && view === 'calendar' && (
        <CCard>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--cui-border-color)' }}>
            {weekDates.map((d, i) => (
              <div
                key={i}
                style={{
                  padding: '8px',
                  textAlign: 'center',
                  borderRight: i < 6 ? '1px solid var(--cui-border-color)' : 'none',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--cui-secondary-color)' }}>{DAY_LABELS[d.getDay()]}</div>
                <div style={{ fontWeight: isSameDay(d, new Date()) ? 'bold' : 'normal', fontSize: '0.875rem' }}>
                  {d.getDate()}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
            {weekDates.map((d, i) => {
              const dayAppts = appointments
                .filter((a) => isSameDay(new Date(a.dataHora), d))
                .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
              return (
                <div
                  key={i}
                  style={{
                    padding: '4px',
                    borderRight: i < 6 ? '1px solid var(--cui-border-color)' : 'none',
                    minHeight: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {dayAppts.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      style={{
                        padding: '6px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        backgroundColor: CALENDAR_BG[a.status] ?? '#aab3c5',
                        color: '#fff',
                        opacity: 1,
                      }}
                    >
                      <div style={{ fontWeight: 'bold' }}>
                        {new Date(a.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {a.tipoServico ?? '—'}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </CCard>
      )}

      {!loading && view === 'list' && (
        <CCard>
          <CTable hover responsive>
            <CTableHead>
              <CTableRow>
                <CTableHeaderCell>Data/Hora</CTableHeaderCell>
                <CTableHeaderCell>Tipo de Serviço</CTableHeaderCell>
                <CTableHeaderCell>Duração</CTableHeaderCell>
                <CTableHeaderCell>Status</CTableHeaderCell>
                <CTableHeaderCell className="text-end">Ações</CTableHeaderCell>
              </CTableRow>
            </CTableHead>
            <CTableBody>
              {appointments.length === 0 && (
                <CTableRow>
                  <CTableDataCell colSpan={5} className="text-center text-secondary">
                    Nenhum agendamento nesta semana.
                  </CTableDataCell>
                </CTableRow>
              )}
              {appointments.map((a) => (
                <CTableRow
                  key={a.id}
                  onClick={() => setSelectedId(a.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <CTableDataCell>{new Date(a.dataHora).toLocaleString('pt-BR')}</CTableDataCell>
                  <CTableDataCell>{a.tipoServico ?? '—'}</CTableDataCell>
                  <CTableDataCell>{a.duracaoMin} min</CTableDataCell>
                  <CTableDataCell>
                    <CBadge color={STATUS_COLORS[a.status] ?? 'secondary'}>{a.status}</CBadge>
                  </CTableDataCell>
                  <CTableDataCell className="text-end" onClick={(e) => e.stopPropagation()}>
                    <CButton color="secondary" variant="ghost" size="sm" onClick={() => openEdit(a)}>
                      <CIcon icon={cilPen} />
                    </CButton>
                    {isOwner && (
                      <CButton color="danger" variant="ghost" size="sm" onClick={() => handleDelete(a.id)}>
                        <CIcon icon={cilTrash} />
                      </CButton>
                    )}
                  </CTableDataCell>
                </CTableRow>
              ))}
            </CTableBody>
          </CTable>
        </CCard>
      )}

      <AppointmentFormDialog
        open={formOpen}
        editing={editing}
        onClose={() => setFormOpen(false)}
        onSaved={() => load()}
      />

      <AppointmentDrawer
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
        onEdit={(appt) => { setSelectedId(null); openEdit(appt); }}
        onDeleted={() => load()}
        isOwner={isOwner}
      />
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
git add apps/frontend/src/pages/workshop/appointments/AppointmentsPage.tsx
git commit -m "feat(appointments): rewrite AppointmentsPage with CoreUI calendar + CTable list"
```

---

### Task 5: Rewrite AppointmentDrawer.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/appointments/AppointmentDrawer.tsx`

**Context:** `MUI Drawer anchor="right"` → `COffcanvas placement="end"`. Width set via style on the inner content div (380px).

**Step 1: Rewrite the file**

```tsx
import { useCallback, useEffect, useState } from 'react';
import {
  CAlert,
  CBadge,
  CButton,
  CFormInput,
  COffcanvas,
  COffcanvasBody,
  COffcanvasHeader,
  COffcanvasTitle,
  CSpinner,
} from '@coreui/react';
import CIcon from '@coreui/icons-react';
import { cilSend, cilX } from '@coreui/icons';
import {
  appointmentsApi, appointmentCommentsApi,
  type Appointment, type AppointmentComment,
} from '../../../services/appointments.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'secondary',
};

interface Props {
  appointmentId: string | null;
  onClose: () => void;
  onEdit: (appt: Appointment) => void;
  onDeleted: () => void;
  isOwner: boolean;
}

export function AppointmentDrawer({ appointmentId, onClose, onEdit, onDeleted, isOwner }: Props) {
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [comments, setComments] = useState<AppointmentComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const [a, c] = await Promise.all([
        appointmentsApi.getById(id),
        appointmentCommentsApi.list(id),
      ]);
      setAppt(a);
      setComments(c);
      const [cust, veh] = await Promise.all([
        customersService.getById(a.clienteId),
        vehiclesService.getById(a.veiculoId),
      ]);
      setCustomer(cust);
      setVehicle(veh);
    } catch {
      setAppt(null);
      setError('Erro ao carregar agendamento.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (appointmentId) loadData(appointmentId);
    else { setAppt(null); setCustomer(null); setVehicle(null); setComments([]); setError(null); }
  }, [appointmentId, loadData]);

  const handleAddComment = async () => {
    if (!newComment.trim() || !appointmentId) return;
    try {
      const c = await appointmentCommentsApi.create(appointmentId, newComment.trim());
      setComments((prev) => [...prev, c]);
      setNewComment('');
    } catch {
      setError('Erro ao adicionar comentário.');
    }
  };

  const handleDelete = async () => {
    if (!appt) return;
    if (!window.confirm('Confirmar exclusão do agendamento?')) return;
    try {
      await appointmentsApi.delete(appt.id);
      onDeleted();
      onClose();
    } catch {
      setError('Erro ao deletar agendamento.');
    }
  };

  return (
    <COffcanvas placement="end" visible={!!appointmentId} onHide={onClose} style={{ width: 380 }}>
      <COffcanvasHeader>
        <COffcanvasTitle>Agendamento</COffcanvasTitle>
        <CButton color="secondary" variant="ghost" size="sm" onClick={onClose}>
          <CIcon icon={cilX} />
        </CButton>
      </COffcanvasHeader>
      <COffcanvasBody className="d-flex flex-column">
        {loading && <CSpinner color="primary" className="align-self-center mt-4" />}
        {error && <CAlert color="danger">{error}</CAlert>}

        {appt && !loading && (
          <>
            <CBadge
              color={STATUS_COLORS[appt.status] ?? 'secondary'}
              className="align-self-start mb-3"
            >
              {appt.status}
            </CBadge>

            <small className="text-secondary">Cliente</small>
            <div className="mb-2">{customer?.nome ?? appt.clienteId}</div>

            <small className="text-secondary">Veículo</small>
            <div className="mb-2">
              {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : appt.veiculoId}
            </div>

            <small className="text-secondary">Data/Hora</small>
            <div className="mb-2">
              {new Date(appt.dataHora).toLocaleString('pt-BR')} ({appt.duracaoMin} min)
            </div>

            {appt.tipoServico && (
              <>
                <small className="text-secondary">Tipo de Serviço</small>
                <div className="mb-2">{appt.tipoServico}</div>
              </>
            )}

            <div className="d-flex gap-2 mt-2 mb-3">
              <CButton color="secondary" variant="outline" size="sm" onClick={() => onEdit(appt)}>Editar</CButton>
              {isOwner && (
                <CButton color="danger" variant="outline" size="sm" onClick={handleDelete}>Deletar</CButton>
              )}
            </div>

            <hr className="mb-3" />
            <div className="fw-semibold mb-2">Comentários</div>

            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {comments.length === 0 && (
                <small className="text-secondary">Nenhum comentário.</small>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="mb-2 p-2 rounded"
                  style={{ backgroundColor: 'var(--cui-tertiary-bg)' }}
                >
                  <div style={{ fontSize: '0.875rem' }}>{c.texto}</div>
                  <small className="text-secondary">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </small>
                </div>
              ))}
            </div>

            <div className="d-flex gap-2">
              <CFormInput
                size="sm"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
              />
              <CButton
                color="primary"
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim()}
              >
                <CIcon icon={cilSend} />
              </CButton>
            </div>
          </>
        )}
      </COffcanvasBody>
    </COffcanvas>
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
git add apps/frontend/src/pages/workshop/appointments/AppointmentDrawer.tsx
git commit -m "feat(appointments): rewrite AppointmentDrawer with CoreUI COffcanvas"
```

---

### Task 6: Rewrite AppointmentFormDialog.tsx

**Files:**
- Modify: `apps/frontend/src/pages/workshop/appointments/AppointmentFormDialog.tsx`

**Context:** Has `Autocomplete` for client/vehicle → `CFormSelect` with `Controller`. `FormControl/InputLabel/Select` → `CFormSelect`. All other fields → `CFormInput`.

**Step 1: Rewrite the file**

```tsx
import { useEffect, useState } from 'react';
import {
  CAlert,
  CButton,
  CFormFeedback,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react';
import { useForm, Controller, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { appointmentsApi, type Appointment, type AppointmentStatus } from '../../../services/appointments.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

const schema = z.object({
  clienteId: z.string().uuid('Selecione um cliente'),
  veiculoId: z.string().uuid('Selecione um veículo'),
  date: z.string().min(1, 'Data obrigatória'),
  time: z.string().min(1, 'Hora obrigatória'),
  duracaoMin: z.coerce.number().int().min(15, 'Mínimo 15 minutos'),
  tipoServico: z.string().optional(),
  status: z.enum(['PENDENTE', 'CONFIRMADO', 'CONCLUIDO', 'CANCELADO']),
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  editing: Appointment | null;
  onClose: () => void;
  onSaved: () => void;
}

export function AppointmentFormDialog({ open, editing, onClose, onSaved }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [conflictWarning, setConflictWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { control, register, handleSubmit, watch, reset, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: { duracaoMin: 60, status: 'PENDENTE' },
  });

  const selectedClienteId = watch('clienteId');

  useEffect(() => {
    if (!open) return;
    customersService.list({ limit: 100 }).then((r) => setCustomers(r.data));
  }, [open]);

  useEffect(() => {
    if (!selectedClienteId) { setVehicles([]); return; }
    vehiclesService.list({ limit: 100 }).then((r) =>
      setVehicles(r.data.filter((v) => v.customerId === selectedClienteId)),
    );
  }, [selectedClienteId]);

  useEffect(() => {
    if (editing) {
      const d = new Date(editing.dataHora);
      const date = d.toISOString().slice(0, 10);
      const time = d.toISOString().slice(11, 16);
      reset({
        clienteId: editing.clienteId,
        veiculoId: editing.veiculoId,
        date,
        time,
        duracaoMin: editing.duracaoMin,
        tipoServico: editing.tipoServico ?? '',
        status: editing.status as AppointmentStatus,
      });
    } else {
      reset({ duracaoMin: 60, status: 'PENDENTE', date: '', time: '', clienteId: '', veiculoId: '', tipoServico: '' });
    }
    setConflictWarning(false);
    setError(null);
  }, [editing, open, reset]);

  const onSubmit = async (values: FormData) => {
    setSaving(true);
    setError(null);
    setConflictWarning(false);
    try {
      const dataHora = `${values.date}T${values.time}:00.000Z`;
      const payload = {
        clienteId: values.clienteId,
        veiculoId: values.veiculoId,
        dataHora,
        duracaoMin: values.duracaoMin,
        tipoServico: values.tipoServico || undefined,
        status: values.status,
      };

      let result;
      if (editing) {
        result = await appointmentsApi.update(editing.id, payload);
      } else {
        result = await appointmentsApi.create(payload);
      }

      if (result.conflicts.length > 0) setConflictWarning(true);
      onSaved();
      if (result.conflicts.length === 0) onClose();
    } catch {
      setError('Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <CModal visible={open} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>{editing ? 'Editar Agendamento' : 'Novo Agendamento'}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-3">
          {conflictWarning && (
            <CAlert color="warning">
              Atenção: já existe agendamento neste horário. O agendamento foi salvo mesmo assim.
            </CAlert>
          )}
          {error && <CAlert color="danger">{error}</CAlert>}

          <div>
            <CFormLabel>Cliente</CFormLabel>
            <Controller
              name="clienteId"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field} invalid={!!errors.clienteId}>
                  <option value="">Selecione um cliente</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome} — {c.cpfCnpj}</option>
                  ))}
                </CFormSelect>
              )}
            />
            {errors.clienteId && <CFormFeedback invalid>{errors.clienteId.message}</CFormFeedback>}
          </div>

          <div>
            <CFormLabel>Veículo</CFormLabel>
            <Controller
              name="veiculoId"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field} disabled={!selectedClienteId} invalid={!!errors.veiculoId}>
                  <option value="">{!selectedClienteId ? 'Selecione o cliente primeiro' : 'Selecione um veículo'}</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.placa} — {v.modelo}</option>
                  ))}
                </CFormSelect>
              )}
            />
            {errors.veiculoId && <CFormFeedback invalid>{errors.veiculoId.message}</CFormFeedback>}
          </div>

          <div className="d-flex gap-3">
            <div className="flex-grow-1">
              <CFormLabel>Data</CFormLabel>
              <CFormInput type="date" {...register('date')} invalid={!!errors.date} />
              {errors.date && <CFormFeedback invalid>{errors.date.message}</CFormFeedback>}
            </div>
            <div className="flex-grow-1">
              <CFormLabel>Hora</CFormLabel>
              <CFormInput type="time" {...register('time')} invalid={!!errors.time} />
              {errors.time && <CFormFeedback invalid>{errors.time.message}</CFormFeedback>}
            </div>
          </div>

          <div>
            <CFormLabel>Duração (minutos)</CFormLabel>
            <CFormInput type="number" {...register('duracaoMin')} invalid={!!errors.duracaoMin} />
            {errors.duracaoMin && <CFormFeedback invalid>{errors.duracaoMin.message}</CFormFeedback>}
          </div>

          <div>
            <CFormLabel>Tipo de Serviço</CFormLabel>
            <CFormInput {...register('tipoServico')} placeholder="ex: Troca de óleo, Alinhamento..." />
          </div>

          <div>
            <CFormLabel>Status</CFormLabel>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field}>
                  <option value="PENDENTE">Pendente</option>
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="CONCLUIDO">Concluído</option>
                  <option value="CANCELADO">Cancelado</option>
                </CFormSelect>
              )}
            />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? <CSpinner size="sm" /> : 'Salvar'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
```

**Step 2: Verify build**

```bash
cd apps/frontend && pnpm build
```

Expected: BUILD success. No MUI or Autocomplete imports in any appointment or service-order file.

**Step 3: Commit**

```bash
git add apps/frontend/src/pages/workshop/appointments/AppointmentFormDialog.tsx
git commit -m "feat(appointments): rewrite AppointmentFormDialog with CoreUI CModal CFormSelect"
```
