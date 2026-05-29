import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { getUser, clearToken } from './api';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Venues from './pages/Venues';
import VenueDetail from './pages/VenueDetail';
import Games from './pages/Games';
import Dashboard from './pages/Dashboard';
import BookingSuccess from './pages/BookingSuccess';
import BookingCancel from './pages/BookingCancel';

function navClass({ isActive }) {
  return isActive ? 'active' : undefined;
}

export default function App() {
  const [user, setUserState] = useState(getUser());

  useEffect(() => {
    const sync = () => setUserState(getUser());
    window.addEventListener('auth-change', sync);
    return () => window.removeEventListener('auth-change', sync);
  }, []);

  function logout() {
    clearToken();
    setUserState(null);
    window.location.href = '/';
  }

  const initials = user?.fullName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">
          <span className="brand-icon">🏏</span>
          NetBook
        </NavLink>
        <div className="nav-links">
          <NavLink to="/venues" className={navClass}>Nets</NavLink>
          <NavLink to="/games" className={navClass}>Games</NavLink>
          {user?.role === 'owner' && (
            <NavLink to="/dashboard" className={navClass}>Dashboard</NavLink>
          )}
          {user ? (
            <>
              <span className="user-pill">
                <span className="user-avatar">{initials}</span>
                {user.fullName}
              </span>
              <button type="button" className="btn btn-outline btn-sm" onClick={logout}>
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>Login</NavLink>
              <NavLink to="/register" className={navClass}>Register</NavLink>
            </>
          )}
        </div>
      </nav>

      <main className="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/venues/:id" element={<VenueDetail />} />
          <Route path="/games" element={<Games />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/booking/success" element={<BookingSuccess />} />
          <Route path="/booking/cancel" element={<BookingCancel />} />
        </Routes>
      </main>

      <footer className="footer">
        NetBook — Book indoor cricket nets in Sri Lanka
      </footer>
    </div>
  );
}
