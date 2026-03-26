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
