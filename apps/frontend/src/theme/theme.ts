import { createTheme } from '@mui/material';
import type { PaletteMode } from '@mui/material';

export const getTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      ...(mode === 'dark'
        ? {
            background: {
              default: '#0F1117',
              paper: '#1A1D27',
            },
            primary: {
              main: '#4F6EF7',
            },
            secondary: {
              main: '#00D97E',
            },
          }
        : {
            background: {
              default: '#F5F7FA',
              paper: '#FFFFFF',
            },
            primary: {
              main: '#4F6EF7',
            },
            secondary: {
              main: '#00D97E',
            },
          }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    },
    shape: {
      borderRadius: 10,
    },
  });
