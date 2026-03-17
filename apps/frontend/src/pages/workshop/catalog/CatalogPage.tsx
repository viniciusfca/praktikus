import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, IconButton, Paper, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination,
  TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useForm } from 'react-hook-form';
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
    resolver: zodResolver(serviceSchema),
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

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <TextField
          label="Buscar por nome"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          size="small"
          sx={{ width: 320 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Novo Serviço
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Preço Padrão</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.nome}</TableCell>
                <TableCell>{item.descricao ?? '—'}</TableCell>
                <TableCell>R$ {Number(item.precoPadrao).toFixed(2)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página:"
        />
      </TableContainer>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField
              label="Nome *"
              {...register('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
              fullWidth
            />
            <TextField
              label="Descrição"
              {...register('descricao')}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="Preço Padrão (R$) *"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              {...register('precoPadrao')}
              error={!!errors.precoPadrao}
              helperText={errors.precoPadrao?.message}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
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
    resolver: zodResolver(partSchema),
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

  return (
    <Box sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <TextField
          label="Buscar por nome ou código"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          size="small"
          sx={{ width: 320 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
          Nova Peça
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome</TableCell>
              <TableCell>Código</TableCell>
              <TableCell>Preço Unitário</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={4} align="center"><CircularProgress size={24} /></TableCell></TableRow>
            ) : items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.nome}</TableCell>
                <TableCell>{item.codigo ?? '—'}</TableCell>
                <TableCell>R$ {Number(item.precoUnitario).toFixed(2)}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => openEdit(item)}><EditIcon fontSize="small" /></IconButton>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}><DeleteIcon fontSize="small" /></IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, p) => setPage(p)}
          onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
          rowsPerPageOptions={[10, 20, 50]}
          labelRowsPerPage="Por página:"
        />
      </TableContainer>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} fullWidth maxWidth="sm">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogTitle>{editing ? 'Editar Peça' : 'Nova Peça'}</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
            <TextField
              label="Nome *"
              {...register('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
              fullWidth
            />
            <TextField
              label="Código / Referência"
              {...register('codigo')}
              fullWidth
            />
            <TextField
              label="Preço Unitário (R$) *"
              type="number"
              inputProps={{ step: '0.01', min: '0' }}
              {...register('precoUnitario')}
              error={!!errors.precoUnitario}
              helperText={errors.precoUnitario?.message}
              fullWidth
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" variant="contained">Salvar</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}

// --- CatalogPage ---
export function CatalogPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" sx={{ mb: 2 }}>
        Catálogo
      </Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Serviços" />
        <Tab label="Peças" />
      </Tabs>
      {tab === 0 && <ServicesTab />}
      {tab === 1 && <PartsTab />}
    </Box>
  );
}
