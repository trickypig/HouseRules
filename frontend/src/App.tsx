import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Header from './components/layout/Header';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import MoneyPage from './pages/MoneyPage';
import KidDetailPage from './pages/KidDetailPage';
import KidDashboardPage from './pages/KidDashboardPage';
import KidMoneyPage from './pages/KidMoneyPage';
import ChoreBoardPage from './pages/ChoreBoardPage';
import ShoppingListsPage from './pages/ShoppingListsPage';
import ShoppingListDetailPage from './pages/ShoppingListDetailPage';

function AppRoutes() {
  const { isKid } = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        {isKid ? (
          <>
            <Route path="/dashboard" element={<KidDashboardPage />} />
            <Route path="/money" element={<KidMoneyPage />} />
          </>
        ) : (
          <>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/money" element={<MoneyPage />} />
            <Route path="/kids/:id" element={<KidDetailPage />} />
          </>
        )}
        <Route path="/chores" element={<ChoreBoardPage />} />
        <Route path="/shopping" element={<ShoppingListsPage />} />
        <Route path="/shopping/:id" element={<ShoppingListDetailPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Header />
      <main className="app-main">
        <div className="container">
          <AppRoutes />
        </div>
      </main>
    </AuthProvider>
  );
}

export default App;
