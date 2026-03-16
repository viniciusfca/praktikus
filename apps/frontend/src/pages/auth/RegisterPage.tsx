import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField, Typography, Alert,
  Stepper, Step, StepLabel, CircularProgress,
} from '@mui/material';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const step1Schema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, 'CNPJ deve conter 14 dígitos numéricos'),
  razaoSocial: z.string().min(3, 'Razão Social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().min(2, 'Nome Fantasia deve ter no mínimo 2 caracteres'),
  telefone: z.string().optional(),
});

const step2Schema = z
  .object({
    ownerName: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
    email: z.string().email('E-mail inválido'),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;

const steps = ['Dados da Oficina', 'Dados do Responsável'];

export function RegisterPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [activeStep, setActiveStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  const form1 = useForm<Step1Data>({ resolver: zodResolver(step1Schema) });
  const form2 = useForm<Step2Data>({ resolver: zodResolver(step2Schema) });

  const onStep1Submit = (data: Step1Data) => {
    setStep1Data(data);
    setActiveStep(1);
  };

  const onStep2Submit = async (data: Step2Data) => {
    if (!step1Data) return;
    setError(null);
    try {
      const tokens = await authService.register({ ...step1Data, ...data });
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao cadastrar. Tente novamente.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 520 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" textAlign="center" mb={1}>
            Practicus
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Cadastre sua oficina — 30 dias grátis
          </Typography>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}><StepLabel>{label}</StepLabel></Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {activeStep === 0 && (
            <Box component="form" onSubmit={form1.handleSubmit(onStep1Submit)} noValidate>
              <TextField
                label="CNPJ"
                fullWidth
                margin="normal"
                placeholder="Apenas números (14 dígitos)"
                inputProps={{ 'aria-label': 'CNPJ' }}
                {...form1.register('cnpj')}
                error={!!form1.formState.errors.cnpj}
                helperText={form1.formState.errors.cnpj?.message}
              />
              <TextField
                label="Razão Social"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Razão Social' }}
                {...form1.register('razaoSocial')}
                error={!!form1.formState.errors.razaoSocial}
                helperText={form1.formState.errors.razaoSocial?.message}
              />
              <TextField
                label="Nome Fantasia"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Nome Fantasia' }}
                {...form1.register('nomeFantasia')}
                error={!!form1.formState.errors.nomeFantasia}
                helperText={form1.formState.errors.nomeFantasia?.message}
              />
              <TextField
                label="Telefone"
                fullWidth
                margin="normal"
                {...form1.register('telefone')}
              />
              <Button type="submit" variant="contained" fullWidth size="large" sx={{ mt: 2 }}>
                Próximo
              </Button>
            </Box>
          )}

          {activeStep === 1 && (
            <Box component="form" onSubmit={form2.handleSubmit(onStep2Submit)} noValidate>
              <TextField
                label="Seu nome"
                fullWidth
                margin="normal"
                {...form2.register('ownerName')}
                error={!!form2.formState.errors.ownerName}
                helperText={form2.formState.errors.ownerName?.message}
              />
              <TextField
                label="E-mail"
                type="email"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'E-mail' }}
                {...form2.register('email')}
                error={!!form2.formState.errors.email}
                helperText={form2.formState.errors.email?.message}
              />
              <TextField
                label="Senha"
                type="password"
                fullWidth
                margin="normal"
                inputProps={{ 'aria-label': 'Senha' }}
                {...form2.register('password')}
                error={!!form2.formState.errors.password}
                helperText={form2.formState.errors.password?.message}
              />
              <TextField
                label="Confirmar senha"
                type="password"
                fullWidth
                margin="normal"
                {...form2.register('confirmPassword')}
                error={!!form2.formState.errors.confirmPassword}
                helperText={form2.formState.errors.confirmPassword?.message}
              />
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button variant="outlined" fullWidth onClick={() => setActiveStep(0)}>
                  Voltar
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={form2.formState.isSubmitting}
                >
                  {form2.formState.isSubmitting ? <CircularProgress size={24} /> : 'Cadastrar'}
                </Button>
              </Box>
            </Box>
          )}

          <Typography variant="body2" textAlign="center" mt={2}>
            Já tem conta?{' '}
            <Link to="/login" style={{ color: 'inherit' }}>Entrar</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
