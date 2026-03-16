import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Box, Button, Card, CardContent, TextField,
  Typography, Alert, CircularProgress,
} from '@mui/material';
import { authService } from '../../services/auth.service';
import { useAuthStore } from '../../store/auth.store';

const schema = z.object({
  email: z.string().email('E-mail inválido'),
  password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const onSubmit = async (data: FormData) => {
    setError(null);
    try {
      const tokens = await authService.login(data);
      setTokens(tokens);
      navigate('/workshop/dashboard');
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.message;
      setError(msg ?? 'Erro ao fazer login.');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Card sx={{ width: '100%', maxWidth: 420 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight="bold" textAlign="center" mb={1}>
            Practicus
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" mb={3}>
            Acesse sua conta
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <TextField
              label="E-mail"
              type="email"
              fullWidth
              margin="normal"
              inputProps={{ 'aria-label': 'E-mail' }}
              {...register('email')}
              error={!!errors.email}
              helperText={errors.email?.message}
            />
            <TextField
              label="Senha"
              type="password"
              fullWidth
              margin="normal"
              inputProps={{ 'aria-label': 'Senha' }}
              {...register('password')}
              error={!!errors.password}
              helperText={errors.password?.message}
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={isSubmitting}
              sx={{ mt: 2 }}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Entrar'}
            </Button>
          </Box>

          <Typography variant="body2" textAlign="center" mt={2}>
            Não tem conta?{' '}
            <Link to="/register" style={{ color: 'inherit' }}>
              Cadastre sua oficina
            </Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
