import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, Chip, IconButton, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { serviceOrdersApi, type ServiceOrder, type SoStatus } from '../../../services/service-orders.service';
import { useAuthStore } from '../../../store/auth.store';
import { CreateServiceOrderDialog } from './CreateServiceOrderDialog';

const STATUS_LABEL: Record<SoStatus, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguard. Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

const STATUS_COLOR: Record<SoStatus, 'default' | 'warning' | 'info' | 'primary' | 'secondary' | 'success' | 'error'> = {
  ORCAMENTO: 'default',
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
  const user = useAuthStore((s) => s.user);
  const isOwner = user?.role === 'OWNER';

  const load = useCallback(async () => {
    const data = await serviceOrdersApi.list();
    setOrders(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5">Ordens de Serviço</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Nova OS
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Data</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pagamento</TableCell>
              <TableCell>KM</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {orders.map((so) => (
              <TableRow key={so.id} hover>
                <TableCell>{new Date(so.createdAt).toLocaleDateString('pt-BR')}</TableCell>
                <TableCell>
                  <Chip
                    label={STATUS_LABEL[so.status]}
                    color={STATUS_COLOR[so.status]}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    label={so.statusPagamento}
                    color={so.statusPagamento === 'PAGO' ? 'success' : 'default'}
                    size="small"
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{so.kmEntrada ?? '—'}</TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => navigate(`/workshop/service-orders/${so.id}`)}>
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {orders.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">Nenhuma OS encontrada.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateServiceOrderDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={load}
      />
    </Box>
  );
}
