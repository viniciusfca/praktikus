import { useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControl, InputLabel,
  MenuItem, Select, TextField,
} from '@mui/material';
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

  // Load customers on open
  useEffect(() => {
    if (!open) return;
    customersService.list({ limit: 100 }).then((r) => setCustomers(r.data));
  }, [open]);

  // Load vehicles when cliente changes
  useEffect(() => {
    if (!selectedClienteId) { setVehicles([]); return; }
    vehiclesService.list({ limit: 100 }).then((r) =>
      setVehicles(r.data.filter((v) => v.customerId === selectedClienteId)),
    );
  }, [selectedClienteId]);

  // Populate form when editing
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

      if (result.conflicts.length > 0) {
        setConflictWarning(true);
      }
      onSaved();
      if (result.conflicts.length === 0) onClose();
    } catch {
      setError('Erro ao salvar agendamento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{editing ? 'Editar Agendamento' : 'Novo Agendamento'}</DialogTitle>
      <DialogContent>
        <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {conflictWarning && (
            <Alert severity="warning">
              Atenção: já existe agendamento neste horário. O agendamento foi salvo mesmo assim.
            </Alert>
          )}
          {error && <Alert severity="error">{error}</Alert>}

          <Controller
            name="clienteId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={customers}
                getOptionLabel={(c) => `${c.nome} — ${c.cpfCnpj}`}
                value={customers.find((c) => c.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cliente"
                    error={!!errors.clienteId}
                    helperText={errors.clienteId?.message}
                  />
                )}
              />
            )}
          />

          <Controller
            name="veiculoId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={vehicles}
                getOptionLabel={(v) => `${v.placa} — ${v.modelo}`}
                value={vehicles.find((v) => v.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                disabled={!selectedClienteId}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Veículo"
                    error={!!errors.veiculoId}
                    helperText={errors.veiculoId?.message ?? (!selectedClienteId ? 'Selecione o cliente primeiro' : '')}
                  />
                )}
              />
            )}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Data"
              type="date"
              InputLabelProps={{ shrink: true }}
              {...register('date')}
              error={!!errors.date}
              helperText={errors.date?.message}
              fullWidth
            />
            <TextField
              label="Hora"
              type="time"
              InputLabelProps={{ shrink: true }}
              {...register('time')}
              error={!!errors.time}
              helperText={errors.time?.message}
              fullWidth
            />
          </Box>

          <TextField
            label="Duração (minutos)"
            type="number"
            {...register('duracaoMin')}
            error={!!errors.duracaoMin}
            helperText={errors.duracaoMin?.message}
          />

          <TextField
            label="Tipo de Serviço"
            {...register('tipoServico')}
            placeholder="ex: Troca de óleo, Alinhamento..."
          />

          <Controller
            name="status"
            control={control}
            render={({ field }) => (
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select {...field} label="Status">
                  <MenuItem value="PENDENTE">Pendente</MenuItem>
                  <MenuItem value="CONFIRMADO">Confirmado</MenuItem>
                  <MenuItem value="CONCLUIDO">Concluído</MenuItem>
                  <MenuItem value="CANCELADO">Cancelado</MenuItem>
                </Select>
              </FormControl>
            )}
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
