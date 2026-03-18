import { useState, useEffect, useCallback } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton,
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ListIcon from '@mui/icons-material/List';
import {
  appointmentsApi, type Appointment,
} from '../../../services/appointments.service';
import { AppointmentFormDialog } from './AppointmentFormDialog';
import { AppointmentDrawer } from './AppointmentDrawer';
import { useAuthStore } from '../../../store/auth.store';

const STATUS_COLORS: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  PENDENTE: 'warning',
  CONFIRMADO: 'info',
  CONCLUIDO: 'success',
  CANCELADO: 'default',
};

const DAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function getWeekDates(referenceDate: Date): Date[] {
  const day = referenceDate.getDay(); // 0=Sun
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
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" fontWeight="bold">Agendamentos</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openNew}>
          Novo Agendamento
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={prevWeek}><ChevronLeftIcon /></IconButton>
          <Typography>{weekLabel}</Typography>
          <IconButton onClick={nextWeek}><ChevronRightIcon /></IconButton>
        </Box>
        <ToggleButtonGroup value={view} exclusive onChange={(_, v) => v && setView(v)} size="small">
          <ToggleButton value="calendar"><CalendarMonthIcon fontSize="small" /></ToggleButton>
          <ToggleButton value="list"><ListIcon fontSize="small" /></ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading && <CircularProgress sx={{ display: 'block', mx: 'auto', my: 4 }} />}

      {!loading && view === 'calendar' && (
        <Paper>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: 1, borderColor: 'divider' }}>
            {weekDates.map((d, i) => (
              <Box key={i} sx={{ p: 1, textAlign: 'center', borderRight: i < 6 ? 1 : 0, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary">{DAY_LABELS[d.getDay()]}</Typography>
                <Typography variant="body2" fontWeight={isSameDay(d, new Date()) ? 'bold' : 'normal'}>
                  {d.getDate()}
                </Typography>
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 400 }}>
            {weekDates.map((d, i) => {
              const dayAppts = appointments
                .filter((a) => isSameDay(new Date(a.dataHora), d))
                .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
              return (
                <Box
                  key={i}
                  sx={{
                    p: 0.5,
                    borderRight: i < 6 ? 1 : 0,
                    borderColor: 'divider',
                    minHeight: 200,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 0.5,
                  }}
                >
                  {dayAppts.map((a) => (
                    <Box
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      sx={{
                        p: 0.75,
                        borderRadius: 1,
                        cursor: 'pointer',
                        fontSize: '0.75rem',
                        bgcolor:
                          a.status === 'PENDENTE' ? 'warning.dark' :
                          a.status === 'CONFIRMADO' ? 'info.dark' :
                          a.status === 'CONCLUIDO' ? 'success.dark' : 'action.disabledBackground',
                        '&:hover': { opacity: 0.85 },
                      }}
                    >
                      <Typography variant="caption" display="block" fontWeight="bold">
                        {new Date(a.dataHora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </Typography>
                      <Typography variant="caption" display="block" noWrap>
                        {a.tipoServico ?? '—'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {!loading && view === 'list' && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Data/Hora</TableCell>
                <TableCell>Tipo de Serviço</TableCell>
                <TableCell>Duração</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {appointments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">Nenhum agendamento nesta semana.</TableCell>
                </TableRow>
              )}
              {appointments.map((a) => (
                <TableRow
                  key={a.id}
                  hover
                  onClick={() => setSelectedId(a.id)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{new Date(a.dataHora).toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{a.tipoServico ?? '—'}</TableCell>
                  <TableCell>{a.duracaoMin} min</TableCell>
                  <TableCell>
                    <Chip label={a.status} color={STATUS_COLORS[a.status]} size="small" />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => openEdit(a)}><EditIcon fontSize="small" /></IconButton>
                    {isOwner && (
                      <IconButton size="small" color="error" onClick={() => handleDelete(a.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
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
    </Box>
  );
}
