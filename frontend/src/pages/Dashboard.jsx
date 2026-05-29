import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, readSession } from '../api';
import { buildSlotTimesFromHours, todayDateStr } from '../bookingSlots';
import BookingSlotPicker from '../components/BookingSlotPicker';
import { buildBookableOptions } from '../venueUtils';

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

function loadDashboardData() {
  return api('/venues/mine').then((venues) => {
    if (!venues.length) return { venue: null, bookings: [] };
    const venue = venues[0];
    return api(`/bookings/venue/${venue.id}`).then((bookings) => ({
      venue,
      bookings: bookings || [],
    }));
  });
}

export default function Dashboard() {
  const user = readSession();
  const [venue, setVenue] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [spaceId, setSpaceId] = useState('');
  const [date, setDate] = useState(todayDateStr());
  const [selectedHours, setSelectedHours] = useState([]);
  const [blocking, setBlocking] = useState(false);
  const [blockSuccess, setBlockSuccess] = useState('');

  const bookableOptions = useMemo(() => buildBookableOptions(venue), [venue]);

  useEffect(() => {
    setSelectedHours([]);
  }, [spaceId]);

  function refresh() {
    setLoading(true);
    setError('');
    return loadDashboardData()
      .then(({ venue: v, bookings: b }) => {
        setVenue(v);
        setBookings(b);
        const options = buildBookableOptions(v);
        if (options.length && !spaceId) setSpaceId(String(options[0].id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (user?.role !== 'owner') {
      setLoading(false);
      return undefined;
    }
    refresh();
  }, [user?.id]);

  useEffect(() => {
    if (bookableOptions.length && !spaceId) {
      setSpaceId(String(bookableOptions[0].id));
    }
  }, [bookableOptions, spaceId]);

  const slot = buildSlotTimesFromHours(date, selectedHours);

  async function handleBlock(e) {
    e.preventDefault();
    if (!slot.valid) {
      setError('Pick at least one time slot');
      return;
    }
    setError('');
    setBlockSuccess('');
    setBlocking(true);
    try {
      await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          bayId: Number(spaceId),
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        }),
      });
      setDate(todayDateStr());
      setSelectedHours([]);
      setBlockSuccess('Slot blocked — no payment required.');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBlocking(false);
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'owner') return <Navigate to="/venues" replace />;

  const confirmed = bookings.filter((b) => b.status === 'confirmed').length;
  const pending = bookings.filter((b) => b.status === 'pending_payment').length;
  const revenue = bookings
    .filter((b) => b.status === 'confirmed' && b.amountLkr)
    .reduce((sum, b) => sum + b.amountLkr, 0);

  const selected = bookableOptions.find((o) => String(o.id) === spaceId);

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">
          {venue?.name ? `Manage ${venue.name}` : 'Your venue bookings at a glance'}
        </p>
      </header>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}
      {blockSuccess && (
        <p className="success" style={{ marginBottom: '1rem' }}>{blockSuccess}</p>
      )}

      {venue && bookableOptions.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginTop: 0 }}>Block a slot</h2>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Reserve a net or full area on your venue — free, confirmed instantly.
          </p>
          <form className="form" onSubmit={handleBlock}>
            <label>
              Space
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                {bookableOptions.map((o) => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </label>
            {selected?.kind === 'full_area' && selected.areaName && (
              <p className="muted">
                Blocks all nets in {selected.areaName} for this time slot.
              </p>
            )}
            <BookingSlotPicker
              bayId={Number(spaceId)}
              date={date}
              selectedHours={selectedHours}
              onDateChange={setDate}
              onSelectionChange={setSelectedHours}
            />
            <button type="submit" className="btn" disabled={blocking || !slot.valid}>
              {blocking ? 'Blocking…' : 'Block slot'}
            </button>
          </form>
        </div>
      )}

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
          <p>No bookings yet — player bookings and your blocks will show here</p>
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
              {b.amountLkr > 0 && (
                <p style={{ marginTop: '0.5rem', fontWeight: 600, color: 'var(--navy)' }}>
                  LKR {b.amountLkr.toLocaleString()}
                </p>
              )}
              {b.amountLkr === 0 && b.status === 'confirmed' && (
                <p className="muted" style={{ marginTop: '0.5rem' }}>Owner block</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
