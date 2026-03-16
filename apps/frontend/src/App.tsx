import { Routes, Route } from 'react-router-dom';
import { AppThemeProvider } from './theme/ThemeProvider';
import { LandingPage } from './pages/LandingPage';

function App() {
  return (
    <AppThemeProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
      </Routes>
    </AppThemeProvider>
  );
}

export default App;
