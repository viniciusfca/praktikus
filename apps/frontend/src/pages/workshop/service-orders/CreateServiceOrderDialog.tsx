import { useEffect, useState } from 'react';
import {
  Autocomplete, Box, Button, Dialog, DialogActions,
  DialogContent, DialogTitle, TextField,
} from '@mui/material';
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Nova Ordem de Serviço</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
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
                  <TextField {...params} label="Cliente" error={!!errors.clienteId} helperText={errors.clienteId?.message} />
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
          <Controller
            name="appointmentId"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={appointments}
                getOptionLabel={(a) => `${new Date(a.dataHora).toLocaleString('pt-BR')} — ${a.tipoServico ?? 'Sem tipo'}`}
                value={appointments.find((a) => a.id === field.value) ?? null}
                onChange={(_, v) => field.onChange(v?.id ?? '')}
                disabled={!selectedClienteId}
                renderInput={(params) => (
                  <TextField {...params} label="Agendamento (opcional)" />
                )}
              />
            )}
          />
          <TextField label="KM de Entrada" {...register('kmEntrada')} />
          <TextField label="Combustível" {...register('combustivel')} placeholder="ex: 1/2, Cheio..." />
          <TextField label="Observações de Entrada" {...register('observacoesEntrada')} multiline rows={3} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? 'Criando...' : 'Criar OS'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
