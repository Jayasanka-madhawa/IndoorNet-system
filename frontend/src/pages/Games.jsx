import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { slotToIso, todayDateStr } from '../bookingSlots';
import BookingSlotPicker from '../components/BookingSlotPicker';
import { api, getToken, getUser } from '../api';

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
    open: 'badge-open',
    full: 'badge-pending_payment',
    booked: 'badge-confirmed',
    cancelled: 'badge-cancelled',
  };
  return map[status] || 'badge-open';
}

export default function Games() {
  const user = getUser();
  const [games, setGames] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(todayDateStr());
  const [selectedHours, setSelectedHours] = useState([]);
  const [minPlayers, setMinPlayers] = useState(6);
  const [gender, setGender] = useState('mixed');

  function loadGames() {
    setLoading(true);
    api('/games')
      .then(setGames)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadGames();
  }, []);

  async function createGame(e) {
    e.preventDefault();
    if (!getToken()) return setError('Please sign in first');
    if (!selectedHours.length) return setError('Pick a start time');
    setError('');
    setCreating(true);
    try {
      await api('/games', {
        method: 'POST',
        body: JSON.stringify({
          title,
          startsAt: slotToIso(date, selectedHours[0]),
          minPlayers: Number(minPlayers),
          gender,
        }),
      });
      setTitle('');
      setSelectedHours([]);
      loadGames();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function joinGame(id) {
    if (!getToken()) return setError('Please sign in first');
    setError('');
    try {
      await api(`/games/${id}/join`, { method: 'POST' });
      loadGames();
    } catch (err) {
      setError(err.message);
    }
  }

  async function bookGame(id) {
    setError('');
    try {
      const data = await api(`/games/${id}/book`, {
        method: 'POST',
        body: JSON.stringify({ venueId: 1, bayId: 1, endsAt: null }),
      });
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err.message);
    }
  }

  const isLoggedIn = !!getToken();

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Pickup games</h1>
        <p className="page-subtitle">
          Browse open games and join a squad, or create your own pickup game below
        </p>
      </header>

      {error && <p className="error" style={{ marginBottom: '1rem' }}>{error}</p>}

      <h2 className="section-title">Open games</h2>

      {loading ? (
        <div className="loading">
          <span className="spinner" />
          Loading games…
        </div>
      ) : games.length === 0 ? (
        <div className="empty-state" style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: '2rem' }}>👥</div>
          <p>No open games yet — create one below</p>
        </div>
      ) : (
        <div className="card-grid" style={{ marginBottom: '2rem' }}>
          {games.map((g) => {
            const pct = Math.min(100, (g.playerCount / g.minPlayers) * 100);
            const isJoined = g.players?.some((p) => p.id === user?.id);
            const isCaptain = g.captainId === user?.id;
            const canBook = isCaptain && g.playerCount >= g.minPlayers && g.status === 'open';

            return (
              <article key={g.id} className="card">
                <div className="card-header">
                  <h3>{g.title}</h3>
                  <span className={`badge ${statusBadge(g.status)}`}>{g.status}</span>
                </div>
                <p className="muted">{formatDate(g.startsAt)}</p>
                <span className={`badge badge-${g.gender}`} style={{ marginTop: '0.5rem' }}>
                  {g.gender}
                </span>

                <div className="progress-wrap">
                  <div className="progress-label">
                    <span>Players</span>
                    <span>{g.playerCount} / {g.minPlayers}</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>

                {g.players?.length > 0 && (
                  <p className="muted" style={{ fontSize: '0.8rem' }}>
                    {g.players.map((p) => p.fullName).join(', ')}
                  </p>
                )}

                <div className="card-footer btn-group">
                  {isLoggedIn && !isJoined && g.status === 'open' && (
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => joinGame(g.id)}>
                      Join game
                    </button>
                  )}
                  {isJoined && !isCaptain && (
                    <span className="badge badge-confirmed">You joined</span>
                  )}
                  {canBook && (
                    <button type="button" className="btn btn-sm" onClick={() => bookGame(g.id)}>
                      Book net & pay
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <h2 className="section-title">Create a pickup game</h2>

      {isLoggedIn ? (
        <div className="card">
          <form className="form form-wide" onSubmit={createGame}>
            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Friday evening nets"
                required
              />
            </label>
            <BookingSlotPicker
              date={date}
              selectedHours={selectedHours}
              onDateChange={setDate}
              onSelectionChange={setSelectedHours}
              singleSelect
            />
            <label>
              Min players
              <input
                type="number"
                min={2}
                value={minPlayers}
                onChange={(e) => setMinPlayers(e.target.value)}
              />
            </label>
            <label>
              Gender
              <select value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="men">Men</option>
                <option value="women">Women</option>
                <option value="mixed">Mixed</option>
              </select>
            </label>
            <button type="submit" className="btn" disabled={creating || !selectedHours.length}>
              {creating ? 'Creating…' : 'Create game'}
            </button>
          </form>
        </div>
      ) : (
        <div className="empty-state">
          <p>
            <Link to="/login">Sign in</Link> to create a pickup game
          </p>
        </div>
      )}
    </div>
  );
}
