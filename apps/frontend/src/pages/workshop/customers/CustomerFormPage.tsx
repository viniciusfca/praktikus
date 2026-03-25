import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
} from '@mui/material';
import { customersService } from '../../../services/customers.service';

const schema = z.object({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  cpfCnpj: z
    .string()
    .regex(/^\d{11}$|^\d{14}$/, 'CPF deve ter 11 dígitos ou CNPJ 14 dígitos'),
  whatsapp: z.string().optional(),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

export function CustomerFormPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const [savedCustomer, setSavedCustomer] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    if (isEdit && id) {
      customersService.getById(id).then((customer) => {
        reset({
          nome: customer.nome,
          cpfCnpj: customer.cpfCnpj,
          whatsapp: customer.whatsapp ?? '',
          email: customer.email ?? '',
        });
      });
    }
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FormData) => {
    const payload = {
      nome: data.nome,
      cpfCnpj: data.cpfCnpj,
      whatsapp: data.whatsapp || undefined,
      email: data.email || undefined,
    };
    try {
      if (isEdit && id) {
        await customersService.update(id, payload);
        navigate('/workshop/customers');
      } else {
        const created = await customersService.create(payload);
        setSavedCustomer({ id: created.id, nome: created.nome });
      }
    } catch (err: any) {
      setError('root', {
        message: err?.response?.data?.message ?? 'Erro ao salvar cliente.',
      });
    }
  };

  return (
    <Box sx={{ maxWidth: 560 }}>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        {isEdit ? 'Editar Cliente' : 'Novo Cliente'}
      </Typography>
      <Card>
        <CardContent sx={{ p: 3 }}>
          {errors.root && (
            <Alert severity="error" sx={{ mb: 2 }}>{errors.root.message}</Alert>
          )}
          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="Nome"
              fullWidth
              margin="normal"
              {...register('nome')}
              error={!!errors.nome}
              helperText={errors.nome?.message}
            />
            <TextField
              label="CPF / CNPJ (somente números)"
              fullWidth
              margin="normal"
              inputProps={{ maxLength: 14 }}
              {...register('cpfCnpj')}
              error={!!errors.cpfCnpj}
              helperText={errors.cpfCnpj?.message}
            />
            <TextField
              label="WhatsApp (opcional)"
              fullWidth
              margin="normal"
              {...register('whatsapp')}
            />
            <TextField
              label="E-mail (opcional)"
              type="email"
              fullWidth
              margin="normal"
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
              <Button variant="outlined" fullWidth onClick={() => navigate('/workshop/customers')}>
                Cancelar
              </Button>
              <Button type="submit" variant="contained" fullWidth disabled={isSubmitting}>
                {isSubmitting ? <CircularProgress size={22} /> : 'Salvar'}
              </Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Dialog open={Boolean(savedCustomer)}>
        <DialogTitle>Cadastrar veículo?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Deseja cadastrar um veículo para <strong>{savedCustomer?.nome}</strong>?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => navigate('/workshop/customers')}>
            Não
          </Button>
          <Button
            variant="contained"
            onClick={() => navigate(`/workshop/vehicles/new?customerId=${savedCustomer?.id}`)}
          >
            Sim
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
