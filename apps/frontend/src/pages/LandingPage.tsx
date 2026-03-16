import { Box, Typography, Button, Container, Card, CardContent, CardActions, Chip, Grid } from '@mui/material';
import BuildIcon from '@mui/icons-material/Build';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';

const segments = [
  {
    icon: <BuildIcon sx={{ fontSize: 48 }} />,
    title: 'Oficina Mecânica',
    description: 'Gestão completa de OS, agendamentos e clientes para oficinas e auto centers.',
    available: true,
  },
  {
    icon: <LocalHospitalIcon sx={{ fontSize: 48 }} />,
    title: 'Clínica Médica',
    description: 'Prontuários, agendamentos e gestão de pacientes.',
    available: false,
  },
  {
    icon: <LocalHospitalIcon sx={{ fontSize: 48 }} />,
    title: 'Odontologia',
    description: 'Gestão de consultas, orçamentos e histórico odontológico.',
    available: false,
  },
];

export function LandingPage() {
  return (
    <Box sx={{ minHeight: '100vh' }}>
      {/* Header */}
      <Box sx={{ px: 4, py: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" fontWeight="bold" color="primary">
          Practicus
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant="text" href="/login">Entrar</Button>
          <Button variant="contained" href="/register">Começar grátis</Button>
        </Box>
      </Box>

      {/* Hero */}
      <Container maxWidth="md" sx={{ textAlign: 'center', py: 10 }}>
        <Typography variant="h2" fontWeight="bold" gutterBottom>
          Gerencie seu negócio com inteligência
        </Typography>
        <Typography variant="h6" color="text.secondary" sx={{ mb: 4 }}>
          30 dias grátis, sem cartão de crédito. Depois, apenas R$69,90/mês.
        </Typography>
        <Button variant="contained" size="large" href="/register" sx={{ px: 6, py: 1.5 }}>
          Começar gratuitamente
        </Button>
      </Container>

      {/* Cards de segmentos */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h4" fontWeight="bold" textAlign="center" gutterBottom>
          Escolha seu segmento
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }} justifyContent="center">
          {segments.map((seg) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={seg.title}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                {!seg.available && (
                  <Chip
                    label="Em breve"
                    color="default"
                    size="small"
                    sx={{ position: 'absolute', top: 12, right: 12 }}
                  />
                )}
                <CardContent sx={{ flexGrow: 1, textAlign: 'center', pt: 4 }}>
                  <Box color="primary.main">{seg.icon}</Box>
                  <Typography variant="h6" fontWeight="bold" sx={{ mt: 2, mb: 1 }}>
                    {seg.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {seg.description}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'center', pb: 3 }}>
                  {seg.available ? (
                    <Button variant="contained" href="/register">
                      Começar grátis
                    </Button>
                  ) : (
                    <Button variant="outlined" disabled>
                      Em breve
                    </Button>
                  )}
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}
