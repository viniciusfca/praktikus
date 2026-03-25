import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { publicQuotesApi, type QuoteData } from '../../services/service-orders.service';

type PageState =
  | { kind: 'loading' }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'already_used'; status: string }
  | { kind: 'success'; data: QuoteData }
  | { kind: 'approved' }
  | { kind: 'rejected' }
  | { kind: 'action_error'; message: string };

const STATUS_LABELS: Record<string, string> = {
  ORCAMENTO: 'Orçamento',
  APROVADO: 'Aprovado',
  EM_EXECUCAO: 'Em Execução',
  AGUARDANDO_PECA: 'Aguardando Peça',
  FINALIZADA: 'Finalizada',
  ENTREGUE: 'Entregue',
};

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function QuoteApprovalPage() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setState({ kind: 'invalid' });
      return;
    }
    publicQuotesApi
      .get(token)
      .then((data) => setState({ kind: 'success', data }))
      .catch((err) => {
        if (axios.isAxiosError(err)) {
          const status = err.response?.status;
          if (status === 404) {
            setState({ kind: 'invalid' });
          } else if (status === 410) {
            setState({ kind: 'expired' });
          } else if (status === 409) {
            const soStatus: string = err.response?.data?.status ?? '';
            setState({ kind: 'already_used', status: soStatus });
          } else {
            setState({ kind: 'invalid' });
          }
        } else {
          setState({ kind: 'invalid' });
        }
      });
  }, [token]);

  const handleApprove = async () => {
    if (submitting) return;
    if (!token) return;
    setSubmitting(true);
    try {
      await publicQuotesApi.approve(token);
      setState({ kind: 'approved' });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 410) {
          setState({ kind: 'expired' });
        } else if (status === 409) {
          const soStatus: string = err.response?.data?.status ?? 'APROVADO';
          setState({ kind: 'already_used', status: soStatus });
        } else {
          setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
        }
      } else {
        setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (submitting) return;
    if (!token) return;
    setSubmitting(true);
    try {
      await publicQuotesApi.reject(token);
      setState({ kind: 'rejected' });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status;
        if (status === 410) {
          setState({ kind: 'expired' });
        } else if (status === 409) {
          const soStatus: string = err.response?.data?.status ?? 'APROVADO';
          setState({ kind: 'already_used', status: soStatus });
        } else {
          setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
        }
      } else {
        setState({ kind: 'action_error', message: 'Erro ao processar. Tente novamente.' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        p: { xs: 2, sm: 4 },
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 720 }}>
        {state.kind === 'loading' && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
            <CircularProgress />
          </Box>
        )}

        {state.kind === 'invalid' && (
          <Card sx={{ mt: 6, textAlign: 'center' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Link inválido
              </Typography>
              <Typography color="text.secondary">
                Este link de aprovação não é válido. Verifique o link e tente novamente.
              </Typography>
            </CardContent>
          </Card>
        )}

        {state.kind === 'expired' && (
          <Card sx={{ mt: 6, textAlign: 'center' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Link expirado
              </Typography>
              <Typography color="text.secondary">
                Link expirado. Entre em contato com a oficina.
              </Typography>
            </CardContent>
          </Card>
        )}

        {state.kind === 'already_used' && (
          <Card sx={{ mt: 6, textAlign: 'center' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Orçamento já respondido
              </Typography>
              <Typography color="text.secondary">
                Orçamento já respondido. Status atual:{' '}
                {STATUS_LABELS[state.status] ?? state.status}
              </Typography>
            </CardContent>
          </Card>
        )}

        {state.kind === 'action_error' && (
          <Card sx={{ mt: 6, textAlign: 'center' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Erro
              </Typography>
              <Typography color="error">{state.message}</Typography>
            </CardContent>
          </Card>
        )}

        {state.kind === 'approved' && (
          <Card sx={{ mt: 6, textAlign: 'center' }}>
            <CardContent sx={{ p: 4 }}>
              <CheckCircleOutlineIcon color="success" sx={{ fontSize: 56, mb: 1 }} />
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Orçamento aprovado!
              </Typography>
              <Typography color="text.secondary">
                Orçamento aprovado! Aguarde contato da oficina.
              </Typography>
            </CardContent>
          </Card>
        )}

        {state.kind === 'rejected' && (
          <Card sx={{ mt: 6, textAlign: 'center' }}>
            <CardContent sx={{ p: 4 }}>
              <CancelOutlinedIcon color="error" sx={{ fontSize: 56, mb: 1 }} />
              <Typography variant="h5" fontWeight="bold" gutterBottom>
                Orçamento recusado
              </Typography>
              <Typography color="text.secondary">Orçamento recusado.</Typography>
            </CardContent>
          </Card>
        )}

        {state.kind === 'success' && (
          <>
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="h4" fontWeight="bold">
                {state.data.empresa?.nome_fantasia ?? 'Oficina'}
              </Typography>
              <Typography variant="subtitle1" color="text.secondary">
                Aprovação de Orçamento
              </Typography>
            </Box>

            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" fontWeight="bold" gutterBottom>
                  Dados do Cliente e Veículo
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    Cliente
                  </Typography>
                  <Typography variant="body2">{state.data.cliente?.nome ?? '-'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    CPF / CNPJ
                  </Typography>
                  <Typography variant="body2">{state.data.cliente?.cpf_cnpj ?? '-'}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Veículo
                  </Typography>
                  <Typography variant="body2">
                    {state.data.veiculo
                      ? `${state.data.veiculo.marca} ${state.data.veiculo.modelo} (${state.data.veiculo.ano})`
                      : '-'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Placa
                  </Typography>
                  <Typography variant="body2">{state.data.veiculo?.placa ?? '-'}</Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Services table */}
            {state.data.itemsServices.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Serviços
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <TableContainer component={Paper} elevation={0} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nome</TableCell>
                          <TableCell align="right">Valor</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {state.data.itemsServices.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.nomeServico}</TableCell>
                            <TableCell align="right">{formatCurrency(item.valor)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* Parts table */}
            {state.data.itemsParts.length > 0 && (
              <Card sx={{ mb: 3 }}>
                <CardContent>
                  <Typography variant="h6" fontWeight="bold" gutterBottom>
                    Peças
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <TableContainer component={Paper} elevation={0} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Nome</TableCell>
                          <TableCell align="right">Qtd</TableCell>
                          <TableCell align="right">Valor Unit.</TableCell>
                          <TableCell align="right">Subtotal</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {state.data.itemsParts.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>{item.nomePeca}</TableCell>
                            <TableCell align="right">{item.quantidade}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(item.valorUnitario)}
                            </TableCell>
                            <TableCell align="right">
                              {formatCurrency(item.quantidade * item.valorUnitario)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            )}

            {/* Total */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 4 }}>
              <Typography variant="h6" fontWeight="bold">
                Total: {formatCurrency(state.data.total)}
              </Typography>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 4 }}>
              <Button
                variant="contained"
                color="success"
                size="large"
                disabled={submitting}
                onClick={handleApprove}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : undefined}
              >
                Aprovar Orçamento
              </Button>
              <Button
                variant="outlined"
                color="secondary"
                size="large"
                disabled={submitting}
                onClick={handleReject}
              >
                Recusar
              </Button>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}
