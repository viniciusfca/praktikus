import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
  FormHelperText,
} from '@mui/material';
import { vehiclesService } from '../../../services/vehicles.service';
import { customersService } from '../../../services/customers.service';

const currentYear = new Date().getFullYear();

const schema = z.object({
  customerId: z.string().uuid('ID do cliente inválido'),
  placa: z
    .string()
    .regex(/^[A-Z]{3}\d{4}$|^[A-Z]{3}\d[A-Z]\d{2}$/, 'Placa inválida (ex: ABC1234 ou ABC1D23)'),
  marca: z.string().min(1, 'Marca obrigatória'),
  modelo: z.string().min(1, 'Modelo obrigatório'),
  ano: z.coerce
    .number()
    .int()
    .min(1900, 'Ano inválido')
    .max(currentYear + 1, `Ano máximo: ${currentYear + 1}`),
  km: z.coerce.number().int().min(0, 'KM não pode ser negativo'),
});

type FormData = z.infer<typeof schema>;

export function VehicleFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) as Resolver<FormData> });

  const [cpfInput, setCpfInput] = useState('');
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const handleCpfSearch = async () => {
    const cpf = cpfInput.trim();
    if (!cpf) return;
    setSearching(true);
    setCpfError(null);
    setCustomerName(null);
    try {
      const result = await customersService.list({ search: cpf, limit: 1 });
      const found = result.data.find((c) => c.cpfCnpj === cpf);
      if (found) {
        setValue('customerId', found.id, { shouldValidate: true });
        setCustomerName(found.nome);
      } else {
        setValue('customerId', '', { shouldValidate: false });
        setCpfError('Cliente não encontrado para o CPF informado.');
      }
    } catch {
      setCpfError('Erro ao buscar cliente. Tente novamente.');
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const prefilledCustomerId = searchParams.get('customerId');
    if (isEdit && id) {
      vehiclesService.getById(id).then((v) => {
        reset({ customerId: v.customerId, placa: v.placa, marca: v.marca, modelo: v.modelo, ano: v.ano, km: v.km });
        customersService.getById(v.customerId).then((c) => {
          setCpfInput(c.cpfCnpj);
          setCustomerName(c.nome);
        }).catch(() => { /* display-only — ignore errors */ });
      });
    } else if (prefilledCustomerId) {
      reset({ customerId: prefilledCustomerId, placa: '', marca: '', modelo: '', ano: currentYear, km: 0 });
      customersService.getById(prefilledCustomerId).then((c) => {
        setCpfInput(c.cpfCnpj);
        setCustomerName(c.nome);
      }).catch(() => { /* display-only — ignore errors */ });
    }
  }, [id, isEdit, reset, searchParams]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEdit && id) {
        await vehiclesService.update(id, data);
      } else {
        await vehiclesService.create(data);
      }
      navigate(-1);
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar veículo.',
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {isEdit ? 'Editar Veículo' : 'Novo Veículo'}
      </Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          {errors.root && (
            <Alert severity="error" sx={{ mb: 2 }}>{errors.root.message}</Alert>
          )}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Box sx={{ mt: 1, mb: 0.5 }}>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="CPF do Cliente"
                  value={cpfInput}
                  onChange={(e) => setCpfInput(e.target.value.replace(/\D/g, ''))}
                  onBlur={handleCpfSearch}
                  inputProps={{ maxLength: 14 }}
                  sx={{ flex: 1 }}
                  error={Boolean(cpfError || errors.customerId)}
                />
                <Button
                  variant="outlined"
                  onClick={handleCpfSearch}
                  disabled={searching || !cpfInput.trim()}
                  sx={{ mt: 0.5, minWidth: 90, height: 56 }}
                >
                  {searching ? <CircularProgress size={20} /> : 'Buscar'}
                </Button>
              </Box>
              {customerName && (
                <Typography variant="body2" color="success.main" sx={{ mt: 0.5 }}>
                  ✓ {customerName}
                </Typography>
              )}
              {cpfError && (
                <Alert severity="error" sx={{ mt: 1 }}>{cpfError}</Alert>
              )}
              {errors.customerId && !cpfError && (
                <FormHelperText error>{errors.customerId.message}</FormHelperText>
              )}
            </Box>
            <TextField
              label="Placa (ex: ABC1234)"
              fullWidth
              margin="normal"
              inputProps={{ style: { textTransform: 'uppercase' }, maxLength: 7 }}
              {...register('placa')}
              error={!!errors.placa}
              helperText={errors.placa?.message}
            />
            <TextField
              label="Marca"
              fullWidth
              margin="normal"
              {...register('marca')}
              error={!!errors.marca}
              helperText={errors.marca?.message}
            />
            <TextField
              label="Modelo"
              fullWidth
              margin="normal"
              {...register('modelo')}
              error={!!errors.modelo}
              helperText={errors.modelo?.message}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                label="Ano"
                type="number"
                fullWidth
                margin="normal"
                {...register('ano')}
                error={!!errors.ano}
                helperText={errors.ano?.message}
              />
              <TextField
                label="KM"
                type="number"
                fullWidth
                margin="normal"
                {...register('km')}
                error={!!errors.km}
                helperText={errors.km?.message}
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" fullWidth onClick={() => navigate(-1)}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={22} /> : 'Salvar'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
