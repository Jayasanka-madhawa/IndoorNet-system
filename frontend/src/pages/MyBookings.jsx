import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { api, readSession } from '../api';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-LK', {
    weekday: 'short',
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

function statusLabel(status) {
  return status.replace('_', ' ');
}

function spaceLabel(booking) {
  if (booking.spaceKind === 'full_area') {
    return booking.areaName ? `${booking.areaName} — Full area` : booking.bayName || 'Full area';
  }
  return booking.bayName || `Net ${booking.bayId}`;
}

export default function MyBookings() {
  const user = readSession();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    api('/bookings/mine')
      .then((data) => {
        if (!cancelled) setBookings(data);
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
  if (user.role !== 'player') return <Navigate to="/dashboard" replace />;

  const upcoming = bookings.filter(
    (b) => b.status !== 'cancelled' && new Date(b.startsAt) >= new Date()
  );
  const past = bookings.filter(
    (b) => b.status === 'cancelled' || new Date(b.startsAt) < new Date()
  );

  function renderBooking(b) {
    return (
      <article key={b.id} className="card">
        <div className="card-header">
          <h3>{b.venueName || 'Booking'}</h3>
          <span className={`badge ${statusBadge(b.status)}`}>{statusLabel(b.status)}</span>
        </div>
        <p className="muted">{spaceLabel(b)}</p>
        {b.venueAddress && <p className="muted">📍 {b.venueAddress}</p>}
        <p style={{ marginTop: '0.5rem' }}>
          {formatDate(b.startsAt)} → {formatDate(b.endsAt)}
        </p>
        {b.amountLkr != null && (
          <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--accent)' }}>
            LKR {b.amountLkr.toLocaleString()}
          </p>
        )}
        {b.venueId && (
          <div className="card-footer">
            <Link to={`/venues/${b.venueId}`} className="btn btn-outline btn-sm">
              View venue
            </Link>
          </div>
        )}
      </article>
    );
  }

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">My bookings</h1>
        <p className="page-subtitle">Nets and full-area sessions you have reserved</p>
      </header>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      {loading ? (
        <div className="loading">
          <span className="spinner" />
          Loading your bookings…
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>🏏</div>
          <p>No bookings yet</p>
          <Link to="/venues" className="btn" style={{ marginTop: '1rem' }}>
            Browse nets
          </Link>
        </div>
      ) : (
        <>
          <section style={{ marginBottom: '2rem' }}>
            <h2 className="section-title">Upcoming</h2>
            {upcoming.length > 0 ? (
              <div className="card-grid">{upcoming.map(renderBooking)}</div>
            ) : (
              <div className="empty-state">
                <p>No upcoming sessions</p>
                <Link to="/venues" className="btn" style={{ marginTop: '1rem' }}>
                  Book a net
                </Link>
              </div>
            )}
          </section>
          {past.length > 0 && (
            <section>
              <h2 className="section-title">Past & cancelled</h2>
              <div className="card-grid">{past.map(renderBooking)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
