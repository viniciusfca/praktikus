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
