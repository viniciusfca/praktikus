import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  IconButton, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  serviceOrdersApi, soItemsServicesApi, soItemsPartsApi,
  type ServiceOrderDetail, type SoStatus,
} from '../../../services/service-orders.service';
import { useAuthStore } from '../../../store/auth.store';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';
import { catalogServicesApi, catalogPartsApi, type CatalogService, type CatalogPart } from '../../../services/catalog.service';

// ---------- helpers ----------
const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento', APROVADO: 'Aprovado', EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça', FINALIZADA: 'Finalizada', ENTREGUE: 'Entregue',
};
const STATUS_COLOR: Record<SoStatus, 'default' | 'warning' | 'info' | 'primary' | 'secondary' | 'success' | 'error'> = {
  ORCAMENTO: 'default', APROVADO: 'info', EM_EXECUCAO: 'primary',
  AGUARDANDO_PECA: 'warning', FINALIZADA: 'secondary', ENTREGUE: 'success',
};
const NEXT_STATUSES: Partial<Record<SoStatus, SoStatus[]>> = {
  ORCAMENTO: ['APROVADO'],
  APROVADO: ['EM_EXECUCAO'],
  EM_EXECUCAO: ['AGUARDANDO_PECA', 'FINALIZADA'],
  AGUARDANDO_PECA: ['EM_EXECUCAO'],
  FINALIZADA: ['ENTREGUE'],
};

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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adicionar Serviço</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            select
            label="Serviço"
            value={serviceId}
            onChange={(e) => {
              const s = services.find((x) => x.id === e.target.value);
              setServiceId(e.target.value);
              setNome(s?.nome ?? '');
              setValor(String(s?.precoPadrao ?? ''));
            }}
            SelectProps={{ native: true }}
          >
            <option value="" />
            {services.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </TextField>
          <TextField label="Nome do Serviço" value={nome} onChange={(e) => setNome(e.target.value)} />
          <TextField label="Valor (R$)" type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
          <TextField label="ID do Mecânico (opcional)" value={mecanicoId} onChange={(e) => setMecanicoId(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>Adicionar</Button>
      </DialogActions>
    </Dialog>
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Adicionar Peça</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <TextField
            select
            label="Peça"
            value={partId}
            onChange={(e) => {
              const p = parts.find((x) => x.id === e.target.value);
              setPartId(e.target.value);
              setNome(p?.nome ?? '');
              setValorUnitario(String(p?.precoUnitario ?? ''));
            }}
            SelectProps={{ native: true }}
          >
            <option value="" />
            {parts.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </TextField>
          <TextField label="Nome da Peça" value={nome} onChange={(e) => setNome(e.target.value)} />
          <TextField label="Quantidade" type="number" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
          <TextField label="Valor Unitário (R$)" type="number" value={valorUnitario} onChange={(e) => setValorUnitario(e.target.value)} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>Adicionar</Button>
      </DialogActions>
    </Dialog>
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
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [catalogParts, setCatalogParts] = useState<CatalogPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [addPartOpen, setAddPartOpen] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [km, setKm] = useState('');
  const [combustivel, setCombustivel] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [savingChecklist, setSavingChecklist] = useState(false);

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
      const [cust, veh, svcs, prts] = await Promise.all([
        customersService.getById(data.clienteId).catch(() => null),
        vehiclesService.getById(data.veiculoId).catch(() => null),
        catalogServicesApi.list({ limit: 200 }),
        catalogPartsApi.list({ limit: 200 }),
      ]);
      setCustomer(cust);
      setVehicle(veh);
      setCatalogServices(svcs.data);
      setCatalogParts(prts.data);
    } catch {
      setError('Erro ao carregar OS.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const handleTransition = async (newStatus: SoStatus) => {
    if (!id) return;
    await serviceOrdersApi.patchStatus(id, newStatus);
    await load();
  };

  const handleTogglePayment = async () => {
    if (!id || !so) return;
    const next = so.statusPagamento === 'PAGO' ? 'PENDENTE' : 'PAGO';
    await serviceOrdersApi.patchPaymentStatus(id, next);
    await load();
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
    const { token } = await serviceOrdersApi.generateApprovalToken(id);
    const link = `${window.location.origin}/quotes/${token}`;
    setApprovalLink(link);
    await load();
  };

  const handleCopy = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveService = async (itemId: string) => {
    if (!id) return;
    await soItemsServicesApi.delete(id, itemId);
    await load();
  };

  const handleRemovePart = async (itemId: string) => {
    if (!id) return;
    await soItemsPartsApi.delete(id, itemId);
    await load();
  };

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <CircularProgress />
    </Box>
  );
  if (error || !so) return <Alert severity="error">{error ?? 'OS não encontrada.'}</Alert>;

  const totalServices = so.itemsServices.reduce((s, i) => s + Number(i.valor), 0);
  const totalParts = so.itemsParts.reduce((s, i) => s + Number(i.valorUnitario) * i.quantidade, 0);
  const total = totalServices + totalParts;
  const nextStatuses = NEXT_STATUSES[so.status] ?? [];
  const isFinal = so.status === 'ENTREGUE';

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <IconButton onClick={() => navigate('/workshop/service-orders')}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" sx={{ flex: 1 }}>Ordem de Serviço</Typography>
        <Chip label={STATUS_LABEL[so.status]} color={STATUS_COLOR[so.status]} />
        <Chip
          label={so.statusPagamento}
          color={so.statusPagamento === 'PAGO' ? 'success' : 'default'}
          variant="outlined"
          onClick={isOwner ? handleTogglePayment : undefined}
          sx={{ cursor: isOwner ? 'pointer' : 'default' }}
        />
        {nextStatuses.map((s) => (
          <Button key={s} variant="outlined" size="small" onClick={() => handleTransition(s)}>
            → {STATUS_LABEL[s]}
          </Button>
        ))}
        {so.status === 'ORCAMENTO' && (
          <Button variant="contained" size="small" onClick={handleGenerateLink}>
            {so.approvalToken ? 'Gerar novo link' : 'Gerar link de aprovação'}
          </Button>
        )}
      </Box>

      {/* Dados */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Dados</Typography>
          <Typography>Cliente: {customer?.nome ?? so.clienteId}</Typography>
          <Typography>Veículo: {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : so.veiculoId}</Typography>
          {so.appointmentId && <Typography>Agendamento: {so.appointmentId}</Typography>}
          <Typography variant="caption" color="text.secondary">
            Criado em: {new Date(so.createdAt).toLocaleString('pt-BR')}
          </Typography>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Checklist de Entrada</Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            <TextField label="KM de Entrada" value={km} onChange={(e) => setKm(e.target.value)} disabled={isFinal} size="small" />
            <TextField label="Combustível" value={combustivel} onChange={(e) => setCombustivel(e.target.value)} disabled={isFinal} size="small" />
          </Box>
          <TextField
            label="Observações / Avarias"
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            disabled={isFinal}
            multiline rows={3} fullWidth sx={{ mb: 1 }}
          />
          {!isFinal && (
            <Button variant="outlined" size="small" onClick={handleSaveChecklist} disabled={savingChecklist}>
              {savingChecklist ? 'Salvando...' : 'Salvar Checklist'}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Serviços */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Serviços</Typography>
            {!isFinal && <Button size="small" onClick={() => setAddServiceOpen(true)}>+ Adicionar</Button>}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Serviço</TableCell>
                <TableCell>Mecânico</TableCell>
                <TableCell align="right">Valor</TableCell>
                {!isFinal && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {so.itemsServices.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.nomeServico}</TableCell>
                  <TableCell>{item.mecanicoId ?? '—'}</TableCell>
                  <TableCell align="right">R$ {Number(item.valor).toFixed(2)}</TableCell>
                  {!isFinal && (
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => handleRemoveService(item.id)}>Remover</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {so.itemsServices.length === 0 && (
                <TableRow><TableCell colSpan={isFinal ? 3 : 4} align="center">Nenhum serviço.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Peças */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">Peças</Typography>
            {!isFinal && <Button size="small" onClick={() => setAddPartOpen(true)}>+ Adicionar</Button>}
          </Box>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Peça</TableCell>
                <TableCell align="right">Qtd</TableCell>
                <TableCell align="right">Valor Unit.</TableCell>
                <TableCell align="right">Subtotal</TableCell>
                {!isFinal && <TableCell />}
              </TableRow>
            </TableHead>
            <TableBody>
              {so.itemsParts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.nomePeca}</TableCell>
                  <TableCell align="right">{item.quantidade}</TableCell>
                  <TableCell align="right">R$ {Number(item.valorUnitario).toFixed(2)}</TableCell>
                  <TableCell align="right">R$ {(Number(item.valorUnitario) * item.quantidade).toFixed(2)}</TableCell>
                  {!isFinal && (
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => handleRemovePart(item.id)}>Remover</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {so.itemsParts.length === 0 && (
                <TableRow><TableCell colSpan={isFinal ? 4 : 5} align="center">Nenhuma peça.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Total */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight="bold">Total</Typography>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography>Serviços</Typography>
            <Typography>R$ {totalServices.toFixed(2)}</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography>Peças</Typography>
            <Typography>R$ {totalParts.toFixed(2)}</Typography>
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography variant="h6">Total</Typography>
            <Typography variant="h6">R$ {total.toFixed(2)}</Typography>
          </Box>
        </CardContent>
      </Card>

      {/* Aprovação — only visible when ORCAMENTO and a token already exists */}
      {so.status === 'ORCAMENTO' && so.approvalToken && (() => {
        const displayLink = approvalLink ?? `${window.location.origin}/quotes/${so.approvalToken}`;
        return (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>Link de Aprovação</Typography>
              {so.approvalExpiresAt && (
                <Alert severity="info" sx={{ mb: 1 }}>
                  Token ativo até {new Date(so.approvalExpiresAt).toLocaleString('pt-BR')}
                </Alert>
              )}
              <Stack direction="row" spacing={1} alignItems="center">
                <Button variant="outlined" size="small" onClick={handleGenerateLink}>Gerar novo link</Button>
                <Tooltip title={copied ? 'Copiado!' : 'Copiar link'}>
                  <IconButton onClick={() => handleCopy(displayLink)}><ContentCopyIcon /></IconButton>
                </Tooltip>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1, wordBreak: 'break-all', color: 'text.secondary' }}>
                {displayLink}
              </Typography>
            </CardContent>
          </Card>
        );
      })()}

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
    </Box>
  );
}
