import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Header from './components/layout/Header';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import KidDetailPage from './pages/KidDetailPage';

function App() {
  return (
    <AuthProvider>
      <Header />
      <main className="app-main">
        <div className="container">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/kids/:id" element={<KidDetailPage />} />
            </Route>
          </Routes>
        </div>
      </main>
    </AuthProvider>
  );
}

export default App;
