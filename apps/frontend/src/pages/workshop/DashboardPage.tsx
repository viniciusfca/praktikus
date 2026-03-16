import { Box, Card, CardContent, Grid, Typography } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EventIcon from '@mui/icons-material/Event';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';

const summaryCards = [
  { label: 'OS Abertas', value: '—', icon: <AssignmentIcon fontSize="large" color="primary" /> },
  { label: 'Agendamentos Hoje', value: '—', icon: <EventIcon fontSize="large" color="primary" /> },
  { label: 'Faturamento do Mês', value: '—', icon: <AttachMoneyIcon fontSize="large" color="primary" /> },
];

export function DashboardPage() {
  return (
    <Box>
      <Typography variant="h5" fontWeight="bold" mb={3}>
        Dashboard
      </Typography>
      <Grid container spacing={3}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} key={card.label}>
            <Card>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                {card.icon}
                <Box>
                  <Typography variant="h4" fontWeight="bold">{card.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{card.label}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
