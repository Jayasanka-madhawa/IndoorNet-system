import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken, setUser } from '../api';

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    role: 'player',
    gender: 'men',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setToken(data.token);
      setUser(data.user);
      navigate('/venues');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="page-title">Create account</h1>
        <p className="page-subtitle">Join as a player or net owner</p>
        <form className="form" onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
              placeholder="Your name"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              placeholder="you@example.lk"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
              placeholder="Min. 6 characters"
              required
            />
          </label>
          <label>
            Phone
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              placeholder="0771234567"
            />
          </label>
          <div className="form-row">
            <label>
              I am a…
              <select value={form.role} onChange={(e) => update('role', e.target.value)}>
                <option value="player">Player</option>
                <option value="owner">Net owner</option>
              </select>
            </label>
            {form.role === 'player' && (
              <label>
                Gender
                <select value={form.gender} onChange={(e) => update('gender', e.target.value)}>
                  <option value="men">Men</option>
                  <option value="women">Women</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
            )}
          </div>
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
