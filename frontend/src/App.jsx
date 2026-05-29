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

export default function App() {
  const user = getUser();

  function logout() {
    clearToken();
    window.location.href = '/';
  }

  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/" className="nav-brand">NetBook</NavLink>
        <div className="nav-links">
          <NavLink to="/venues">Nets</NavLink>
          <NavLink to="/games">Games</NavLink>
          {user?.role === 'owner' && <NavLink to="/dashboard">Dashboard</NavLink>}
          {user ? (
            <>
              <span className="muted">{user.fullName}</span>
              <button type="button" className="btn btn-outline" onClick={logout}>Logout</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Login</NavLink>
              <NavLink to="/register">Register</NavLink>
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
    </div>
  );
}