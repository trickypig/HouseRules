import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { isAuthenticated, user, isKid } = useAuth();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="app-logo">
          <svg className="logo-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 12 12 3 21 12" />
            <rect x="5" y="12" width="14" height="10" />
            <rect x="9" y="16" width="6" height="6" />
          </svg>
          House Rules
        </Link>
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <Link to="/money" className="nav-link">Money</Link>
              <Link to="/chores" className="nav-link">Chores</Link>
              <Link to="/shopping" className="nav-link">Shopping</Link>
              <div className="header-user">
                <Link to="/settings" className="user-name-link">
                  {user?.display_name}
                  {isKid && <span className="role-badge role-kid">Kid</span>}
                </Link>
              </div>
            </>
          ) : (
            <>
              <Link to="/login" className="nav-link">Login</Link>
              <Link to="/register" className="nav-link">Register</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
