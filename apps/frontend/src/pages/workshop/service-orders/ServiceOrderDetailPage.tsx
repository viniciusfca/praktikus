import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CAlert,
  CButton,
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
import {
  cilArrowLeft,
  cilCopy,
  cilPlus,
  cilCheck,
  cilCloudDownload,
  cilShareBoxed,
  cilTrash,
} from '@coreui/icons';
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
import { companyService as companiesService, type CompanyProfile } from '../../../services/company.service';
import { SoStatusBadge, PaymentBadge } from '../../../components/SoStatusBadge';

// ── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento', APROVADO: 'Aprovado', EM_EXECUCAO: 'Em execução',
  AGUARDANDO_PECA: 'Aguard. peça', FINALIZADA: 'Finalizada', ENTREGUE: 'Entregue',
};
const NEXT_STATUSES: Partial<Record<SoStatus, SoStatus[]>> = {
  ORCAMENTO: ['APROVADO'],
  APROVADO: ['EM_EXECUCAO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'FINALIZADA'],
  AGUARDANDO_PECA: ['EM_EXECUCAO'],
  FINALIZADA: ['ENTREGUE'],
};
const fmt = (n: number) => `R$ ${Number(n).toFixed(2).replace('.', ',')}`;

const labelStyle = { fontWeight: 500, fontSize: 13 };

// ── Card wrapper ─────────────────────────────────────────────────────────────
function Card({
  children,
  header,
  padding = 20,
}: {
  children: React.ReactNode;
  header?: React.ReactNode;
  padding?: number | string;
}) {
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
        <div
          style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--cui-border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          {header}
        </div>
      )}
      <div style={{ padding: typeof padding === 'number' ? padding : padding }}>{children}</div>
    </div>
  );
}

function CardTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cui-body-color)' }}>{title}</div>
      {desc && <div style={{ fontSize: 12.5, color: 'var(--cui-secondary-color)', marginTop: 2 }}>{desc}</div>}
    </div>
  );
}

// ── Add dialogs ──────────────────────────────────────────────────────────────
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
      <CModalHeader><CModalTitle>Adicionar serviço</CModalTitle></CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-3">
          <div>
            <CFormLabel style={labelStyle}>Serviço</CFormLabel>
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
            <CFormLabel style={labelStyle}>Nome do serviço</CFormLabel>
            <CFormInput value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <CFormLabel style={labelStyle}>Valor (R$)</CFormLabel>
            <CFormInput type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <CFormLabel style={labelStyle}>ID do mecânico (opcional)</CFormLabel>
            <CFormInput value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSave} disabled={saving}>
          {saving ? <CSpinner size="sm" /> : 'Adicionar'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

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
      <CModalHeader><CModalTitle>Adicionar peça</CModalTitle></CModalHeader>
      <CModalBody>
        <div className="d-flex flex-column gap-3">
          <div>
            <CFormLabel style={labelStyle}>Peça</CFormLabel>
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
            <CFormLabel style={labelStyle}>Nome da peça</CFormLabel>
            <CFormInput value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <CFormLabel style={labelStyle}>Quantidade</CFormLabel>
              <CFormInput type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
            </div>
            <div>
              <CFormLabel style={labelStyle}>Valor unitário (R$)</CFormLabel>
              <CFormInput type="number" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} />
            </div>
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSave} disabled={saving}>
          {saving ? <CSpinner size="sm" /> : 'Adicionar'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}

// ── Summary row ──────────────────────────────────────────────────────────────
function SummaryRow({ label, value, bold, big, muted }: { label: string; value: string; bold?: boolean; big?: boolean; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: big ? 16 : 13.5 }}>
      <span style={{ color: muted ? 'var(--cui-secondary-color)' : 'var(--cui-secondary-color)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, fontVariantNumeric: 'tabular-nums', color: 'var(--cui-body-color)' }}>
        {value}
      </span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
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
    <div className="d-flex justify-content-center py-5">
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

  const osNumber = `#OS-${so.id.slice(0, 8).toUpperCase()}`;
  const createdAtFmt = new Date(so.createdAt).toLocaleString('pt-BR');

  return (
    <>
      {/* ── Page head ─────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <CButton color="secondary" variant="outline" size="sm" onClick={() => navigate('/workshop/service-orders')} style={{ padding: '4px 10px', borderRadius: 8 }}>
            <CIcon icon={cilArrowLeft} size="sm" />
          </CButton>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--cui-secondary-color)', fontWeight: 600 }}>
            {osNumber}
          </span>
          <SoStatusBadge status={so.status} />
          <span onClick={isOwner ? handleTogglePayment : undefined} style={{ cursor: isOwner ? 'pointer' : 'default' }}>
            <PaymentBadge status={so.statusPagamento} />
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--cui-body-color)' }}>
              Ordem de serviço{customer ? ` — ${customer.nome}` : ''}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--cui-secondary-color)' }}>
              {vehicle ? `${vehicle.placa} · ${vehicle.marca} ${vehicle.modelo}` : '—'}
              {so.kmEntrada ? ` · ${so.kmEntrada} km` : ''}
              {' · criada em '}{createdAtFmt}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0 }}>
            {so.status === 'ORCAMENTO' && (
              <CButton color="secondary" variant="outline" size="sm" onClick={handleGenerateLink} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <CIcon icon={cilShareBoxed} size="sm" />
                {so.approvalToken ? 'Novo link' : 'Link de aprovação'}
              </CButton>
            )}
            <CButton color="secondary" variant="outline" size="sm" onClick={handleDownloadPdf} disabled={!empresa} style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <CIcon icon={cilCloudDownload} size="sm" /> PDF
            </CButton>
            {nextStatuses.map((s, i) => (
              <CButton
                key={s}
                color="primary"
                variant={i === 0 ? undefined : 'outline'}
                size="sm"
                onClick={() => handleTransition(s)}
                style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <CIcon icon={cilCheck} size="sm" />
                {STATUS_LABEL[s]}
              </CButton>
            ))}
          </div>
        </div>
      </div>

      {/* ── Grid 2fr / 1fr ────────────────────────────────────────────── */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 16 }}
        className="pk-dashboard-grid"
      >
        {/* Left column ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Checklist */}
          <Card header={<CardTitle title="Checklist de entrada" desc="Dados do veículo na chegada" />}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <CFormLabel style={labelStyle}>KM de entrada</CFormLabel>
                <CFormInput value={km} onChange={(e) => setKm(e.target.value)} disabled={isFinal} />
              </div>
              <div>
                <CFormLabel style={labelStyle}>Combustível</CFormLabel>
                <CFormInput value={combustivel} onChange={(e) => setCombustivel(e.target.value)} disabled={isFinal} placeholder="Ex: 1/2 tanque" />
              </div>
            </div>
            <div>
              <CFormLabel style={labelStyle}>Observações / avarias</CFormLabel>
              <CFormTextarea
                rows={3}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                disabled={isFinal}
                placeholder="Ruídos, avarias visíveis, queixas do cliente..."
              />
            </div>
            {!isFinal && (
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                <CButton color="primary" variant="outline" size="sm" onClick={handleSaveChecklist} disabled={savingChecklist} style={{ borderRadius: 8 }}>
                  {savingChecklist ? <CSpinner size="sm" /> : 'Salvar checklist'}
                </CButton>
              </div>
            )}
          </Card>

          {/* Serviços */}
          <Card
            padding={0}
            header={
              <>
                <CardTitle title="Serviços" desc="Mão de obra aplicada" />
                {!isFinal && (
                  <CButton
                    color="primary"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddServiceOpen(true)}
                    style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <CIcon icon={cilPlus} size="sm" /> Adicionar
                  </CButton>
                )}
              </>
            }
          >
            <CTable hover responsive className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Serviço</CTableHeaderCell>
                  <CTableHeaderCell>Mecânico</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Valor</CTableHeaderCell>
                  {!isFinal && <CTableHeaderCell style={{ width: 48 }} />}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {so.itemsServices.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell style={{ fontWeight: 500 }}>{item.nomeServico}</CTableDataCell>
                    <CTableDataCell style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                      {item.mecanicoId ?? '—'}
                    </CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmt(item.valor)}
                    </CTableDataCell>
                    {!isFinal && (
                      <CTableDataCell style={{ textAlign: 'right' }}>
                        <CButton color="danger" variant="ghost" size="sm" onClick={() => handleRemoveService(item.id)} title="Remover">
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                ))}
                {so.itemsServices.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={isFinal ? 3 : 4} className="text-center py-4" style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                      Nenhum serviço adicionado.
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          </Card>

          {/* Peças */}
          <Card
            padding={0}
            header={
              <>
                <CardTitle title="Peças" desc="Consumíveis e componentes" />
                {!isFinal && (
                  <CButton
                    color="primary"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddPartOpen(true)}
                    style={{ borderRadius: 8, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <CIcon icon={cilPlus} size="sm" /> Adicionar
                  </CButton>
                )}
              </>
            }
          >
            <CTable hover responsive className="mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Peça</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Qtd</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Valor unit.</CTableHeaderCell>
                  <CTableHeaderCell style={{ textAlign: 'right' }}>Subtotal</CTableHeaderCell>
                  {!isFinal && <CTableHeaderCell style={{ width: 48 }} />}
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {so.itemsParts.map((item) => (
                  <CTableRow key={item.id}>
                    <CTableDataCell style={{ fontWeight: 500 }}>{item.nomePeca}</CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                      {item.quantidade}
                    </CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'var(--cui-secondary-color)' }}>
                      {fmt(item.valorUnitario)}
                    </CTableDataCell>
                    <CTableDataCell style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {fmt(Number(item.valorUnitario) * item.quantidade)}
                    </CTableDataCell>
                    {!isFinal && (
                      <CTableDataCell style={{ textAlign: 'right' }}>
                        <CButton color="danger" variant="ghost" size="sm" onClick={() => handleRemovePart(item.id)} title="Remover">
                          <CIcon icon={cilTrash} />
                        </CButton>
                      </CTableDataCell>
                    )}
                  </CTableRow>
                ))}
                {so.itemsParts.length === 0 && (
                  <CTableRow>
                    <CTableDataCell colSpan={isFinal ? 4 : 5} className="text-center py-4" style={{ color: 'var(--cui-secondary-color)', fontSize: 13 }}>
                      Nenhuma peça adicionada.
                    </CTableDataCell>
                  </CTableRow>
                )}
              </CTableBody>
            </CTable>
          </Card>
        </div>

        {/* Right column (sticky) ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, position: 'sticky', top: 72, height: 'fit-content' }}>
          <Card header={<CardTitle title="Resumo" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <SummaryRow label="Serviços" value={fmt(totalServices)} />
              <SummaryRow label="Peças" value={fmt(totalParts)} />
              <div style={{ height: 1, background: 'var(--cui-border-color)', margin: '6px 0' }} />
              <SummaryRow label="Total" value={fmt(total)} bold big />
              {so.statusPagamento !== 'PAGO' && isOwner && (
                <CButton color="primary" onClick={handleTogglePayment} style={{ borderRadius: 8, marginTop: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <CIcon icon={cilCheck} size="sm" /> Registrar pagamento
                </CButton>
              )}
              {so.statusPagamento === 'PAGO' && (
                <div style={{ padding: 10, borderRadius: 8, background: 'rgba(22, 163, 74, 0.08)', color: '#15803d', fontSize: 12.5, fontWeight: 600, textAlign: 'center', marginTop: 8 }}>
                  ✓ Pagamento confirmado
                </div>
              )}
            </div>
          </Card>

          {/* Dados */}
          <Card header={<CardTitle title="Informações" />}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 2 }}>
                  Cliente
                </div>
                <div style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>{customer?.nome ?? so.clienteId}</div>
                {customer?.cpfCnpj && (
                  <div style={{ color: 'var(--cui-secondary-color)', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{customer.cpfCnpj}</div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 2 }}>
                  Veículo
                </div>
                <div style={{ fontWeight: 500, color: 'var(--cui-body-color)' }}>
                  {vehicle ? `${vehicle.marca} ${vehicle.modelo}` : so.veiculoId}
                </div>
                {vehicle && (
                  <div style={{ color: 'var(--cui-secondary-color)', fontSize: 12 }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{vehicle.placa}</span>
                    {' · '}{vehicle.ano}
                  </div>
                )}
              </div>
              {so.appointmentId && (
                <div>
                  <div style={{ fontSize: 11, color: 'var(--cui-secondary-color)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 2 }}>
                    Agendamento
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12 }}>{so.appointmentId}</div>
                </div>
              )}
            </div>
          </Card>

          {/* Approval link */}
          {approvalDisplayLink && (
            <Card header={<CardTitle title="Link de aprovação" />}>
              {so.approvalExpiresAt && (
                <div style={{ fontSize: 12, color: 'var(--cui-secondary-color)', marginBottom: 10 }}>
                  Ativo até {new Date(so.approvalExpiresAt).toLocaleString('pt-BR')}
                </div>
              )}
              <div
                style={{
                  padding: 10,
                  background: 'var(--cui-card-cap-bg)',
                  border: '1px solid var(--cui-border-color)',
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontFamily: "'JetBrains Mono', monospace",
                  wordBreak: 'break-all',
                  color: 'var(--cui-secondary-color)',
                  marginBottom: 10,
                }}
              >
                {approvalDisplayLink}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <CTooltip content={copied ? 'Copiado!' : 'Copiar link'}>
                  <CButton color="primary" size="sm" onClick={() => handleCopy(approvalDisplayLink)} style={{ borderRadius: 8, flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                    <CIcon icon={cilCopy} size="sm" /> {copied ? 'Copiado!' : 'Copiar'}
                  </CButton>
                </CTooltip>
                <CButton color="secondary" variant="outline" size="sm" onClick={handleGenerateLink} style={{ borderRadius: 8 }}>
                  Novo
                </CButton>
              </div>
            </Card>
          )}
        </div>
      </div>

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
