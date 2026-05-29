import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setUser(data.user);
      navigate(data.user.role === 'owner' ? '/dashboard' : '/venues');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="page-title">Welcome back</h1>
        <p className="page-subtitle">Sign in to book nets or join games</p>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.lk"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          No account? <Link to="/register">Create one</Link>
        </p>
        <div className="demo-hint">
          <strong>Demo player:</strong> player@nets.lk / player123<br />
          <strong>Demo owner:</strong> owner@nets.lk / owner123
        </div>
      </div>
    </div>
  );
}
