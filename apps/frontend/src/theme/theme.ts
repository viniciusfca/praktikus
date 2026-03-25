import { createTheme, alpha } from '@mui/material';
import type { PaletteMode } from '@mui/material';

export const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#0A1929',
              paper: '#132F4C',
            },
            primary: {
              main: '#4A90D9',
              light: '#74B3E2',
            },
            secondary: {
              main: '#00D97E',
            },
          }
        : {
            background: {
              default: '#F0F4F8',
              paper: '#FFFFFF',
            },
            primary: {
              main: '#1565C0',
              light: '#42A5F5',
            },
            secondary: {
              main: '#00D97E',
            },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      fontWeightMedium: 500,
      h5: { fontSize: '1.375rem' },
      h6: { fontSize: '1.125rem' },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCard: {
        defaultProps: { variant: 'outlined' },
        styleOverrides: {
          root: ({ theme }) => ({
            boxShadow: 'none',
            border: `1px solid ${theme.palette.divider}`,
          }),
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 6,
          },
        },
      },
      MuiTableHead: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: alpha(theme.palette.primary.main, 0.04),
            '& .MuiTableCell-head': {
              fontWeight: 600,
            },
          }),
        },
      },
    },
  });
