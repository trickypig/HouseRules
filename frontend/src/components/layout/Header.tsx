import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { isAuthenticated, user, isKid, logout } = useAuth();

  return (
    <header className="app-header">
      <div className="header-inner">
        <Link to="/" className="app-logo">
          <span className="logo-icon">&#127968;</span>
          House Rules
        </Link>
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <Link to="/dashboard" className="nav-link">
                {isKid ? 'My Dashboard' : 'Dashboard'}
              </Link>
              <Link to="/money" className="nav-link">Money</Link>
              <Link to="/chores" className="nav-link">Chores</Link>
              <Link to="/shopping" className="nav-link">Lists</Link>
              <div className="header-user">
                <span className="user-name">
                  {user?.display_name}
                  {isKid && <span className="role-badge role-kid">Kid</span>}
                </span>
                <button onClick={logout} className="btn btn-sm btn-outline">Logout</button>
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
