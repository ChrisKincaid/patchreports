import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { Shield, Eye, List, Settings as SettingsIcon, LogOut } from 'lucide-react';

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const isActive = (path) => {
    return location.pathname === path ? 'active' : '';
  };

  return (
    <nav className="navigation">
      <div className="nav-brand">
        <Shield size={24} />
        <span>CVE Alert System</span>
      </div>

      <div className="nav-links">
        <Link to="/" className={`nav-link ${isActive('/')}`}>
          <Eye size={18} />
          Dashboard
        </Link>
        <Link to="/watchlist" className={`nav-link ${isActive('/watchlist')}`}>
          <List size={18} />
          Watch List
        </Link>
        <Link to="/settings" className={`nav-link ${isActive('/settings')}`}>
          <SettingsIcon size={18} />
          Settings
        </Link>
      </div>

      <button className="nav-link logout-btn" onClick={handleLogout}>
        <LogOut size={18} />
        Sign Out
      </button>
    </nav>
  );
}

export default Navigation;
