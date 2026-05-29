import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, readSession } from '../api';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-LK', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status) {
  const map = {
    confirmed: 'badge-confirmed',
    pending_payment: 'badge-pending_payment',
    cancelled: 'badge-cancelled',
  };
  return map[status] || 'badge-open';
}

export default function Dashboard() {
  const user = readSession();
  const [bookings, setBookings] = useState([]);
  const [venueName, setVenueName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== 'owner') {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    api('/venues/mine')
      .then((venues) => {
        if (!venues.length) return { bookings: [], name: '' };
        setVenueName(venues[0].name);
        return api(`/bookings/venue/${venues[0].id}`).then((data) => ({
          bookings: data || [],
          name: venues[0].name,
        }));
      })
      .then((result) => {
        if (!cancelled && result?.bookings) setBookings(result.bookings);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'owner') return <Navigate to="/venues" replace />;

  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const pending = bookings.filter((b) => b.status === 'pending_payment').length;
  const revenue = bookings
    .filter((b) => b.status === 'confirmed' && b.amountLkr)
    .reduce((sum, b) => sum + b.amountLkr, 0);

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {venueName ? `Bookings for ${venueName}` : 'Your venue bookings at a glance'}
        </p>
      </header>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{bookings.length}</div>
          <div className="stat-label">Total bookings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{confirmed}</div>
          <div className="stat-label">Confirmed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{pending}</div>
          <div className="stat-label">Pending payment</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{revenue.toLocaleString()}</div>
          <div className="stat-label">Revenue (LKR)</div>
        </div>
      </div>

      <h2 className="section-title">Recent bookings</h2>

      {loading ? (
        <div className="loading">
          <span className="spinner" />
          Loading bookings…
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>📋</div>
          <p>No bookings yet — they'll show up here when players book your nets</p>
        </div>
      ) : (
        <div className="card-grid">
          {bookings.map((b) => (
            <article key={b.id} className="card">
              <div className="card-header">
                <h3>{b.bayName || (b.spaceKind === 'full_area' ? 'Full area' : `Net ${b.bayId}`)}</h3>
                <span className={`badge ${statusBadge(b.status)}`}>
                  {b.status.replace('_', ' ')}
                </span>
              </div>
              {b.areaName && (
                <p className="muted">{b.areaName}{b.spaceKind === 'full_area' ? ' — Full area' : ''}</p>
              )}
              <p className="muted">
                {formatDate(b.startsAt)} → {formatDate(b.endsAt)}
              </p>
              {b.amountLkr && (
                <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--accent)' }}>
                  LKR {b.amountLkr.toLocaleString()}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
