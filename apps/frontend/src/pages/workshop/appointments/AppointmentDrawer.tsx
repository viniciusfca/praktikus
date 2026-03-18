import { useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider,
  Drawer, IconButton, TextField, Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import {
  appointmentsApi, appointmentCommentsApi,
  type Appointment, type AppointmentComment,
} from '../../../services/appointments.service';
import { customersService, type Customer } from '../../../services/customers.service';
import { vehiclesService, type Vehicle } from '../../../services/vehicles.service';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'default',
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

  const loadData = async (id: string) => {
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
      setError('Erro ao carregar agendamento.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appointmentId) loadData(appointmentId);
    else { setAppt(null); setCustomer(null); setVehicle(null); setComments([]); }
  }, [appointmentId]);

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
    <Drawer anchor="right" open={!!appointmentId} onClose={onClose}>
      <Box sx={{ width: 380, p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography variant="h6">Agendamento</Typography>
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </Box>

        {loading && <CircularProgress sx={{ alignSelf: 'center', mt: 4 }} />}
        {error && <Alert severity="error">{error}</Alert>}

        {appt && !loading && (
          <>
            <Chip
              label={appt.status}
              color={STATUS_COLORS[appt.status] ?? 'default'}
              size="small"
              sx={{ alignSelf: 'flex-start', mb: 2 }}
            />

            <Typography variant="body2" color="text.secondary">Cliente</Typography>
            <Typography variant="body1" mb={1}>{customer?.nome ?? appt.clienteId}</Typography>

            <Typography variant="body2" color="text.secondary">Veículo</Typography>
            <Typography variant="body1" mb={1}>
              {vehicle ? `${vehicle.placa} — ${vehicle.modelo}` : appt.veiculoId}
            </Typography>

            <Typography variant="body2" color="text.secondary">Data/Hora</Typography>
            <Typography variant="body1" mb={1}>
              {new Date(appt.dataHora).toLocaleString('pt-BR')} ({appt.duracaoMin} min)
            </Typography>

            {appt.tipoServico && (
              <>
                <Typography variant="body2" color="text.secondary">Tipo de Serviço</Typography>
                <Typography variant="body1" mb={1}>{appt.tipoServico}</Typography>
              </>
            )}

            <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
              <Button size="small" variant="outlined" onClick={() => onEdit(appt)}>Editar</Button>
              {isOwner && (
                <Button size="small" variant="outlined" color="error" onClick={handleDelete}>
                  Deletar
                </Button>
              )}
            </Box>

            <Divider sx={{ mb: 2 }} />
            <Typography variant="subtitle2" mb={1}>Comentários</Typography>

            <Box sx={{ flex: 1, overflowY: 'auto', mb: 2 }}>
              {comments.length === 0 && (
                <Typography variant="body2" color="text.secondary">Nenhum comentário.</Typography>
              )}
              {comments.map((c) => (
                <Box key={c.id} sx={{ mb: 1.5, p: 1.5, bgcolor: 'action.hover', borderRadius: 1 }}>
                  <Typography variant="body2">{c.texto}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </Typography>
                </Box>
              ))}
            </Box>

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Adicionar comentário..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                fullWidth
              />
              <IconButton onClick={handleAddComment} disabled={!newComment.trim()}>
                <SendIcon />
              </IconButton>
            </Box>
          </>
        )}
      </Box>
    </Drawer>
  );
}
