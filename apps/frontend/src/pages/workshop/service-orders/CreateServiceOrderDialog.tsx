import { useEffect, useState } from 'react';
import {
  CButton,
  CFormFeedback,
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
} from '@coreui/react';
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
    <CModal visible={open} onClose={onClose} size="lg">
      <CModalHeader>
        <CModalTitle>Nova ordem de serviço</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p style={{ fontSize: 13, color: 'var(--cui-secondary-color)', margin: '0 0 14px' }}>
          Preencha os dados iniciais de entrada do veículo.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
          </div>

          <div>
            <CFormLabel>Agendamento (opcional)</CFormLabel>
            <Controller
              name="appointmentId"
              control={control}
              render={({ field }) => (
                <CFormSelect {...field} disabled={!selectedClienteId}>
                  <option value="">Nenhum</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.id}>
                      {new Date(a.dataHora).toLocaleString('pt-BR')} — {a.tipoServico ?? 'Sem tipo'}
                    </option>
                  ))}
                </CFormSelect>
              )}
            />
            <div style={{ fontSize: 11.5, color: 'var(--cui-secondary-color)', marginTop: 4 }}>
              Vincule a um agendamento para preencher automaticamente.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <CFormLabel>KM de entrada</CFormLabel>
              <CFormInput {...register('kmEntrada')} placeholder="Ex: 94000" />
            </div>
            <div>
              <CFormLabel>Combustível</CFormLabel>
              <CFormInput {...register('combustivel')} placeholder="Ex: 1/2, cheio..." />
            </div>
          </div>

          <div>
            <CFormLabel>Observações de entrada</CFormLabel>
            <CFormTextarea
              {...register('observacoesEntrada')}
              rows={3}
              placeholder="Ruídos, avarias visíveis, queixas do cliente..."
            />
          </div>
        </div>
      </CModalBody>
      <CModalFooter>
        <CButton color="secondary" variant="outline" onClick={onClose}>Cancelar</CButton>
        <CButton color="primary" onClick={handleSubmit(onSubmit)} disabled={saving}>
          {saving ? <CSpinner size="sm" /> : 'Criar OS'}
        </CButton>
      </CModalFooter>
    </CModal>
  );
}
