import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api';

export default function VenueDetail() {
  const { id } = useParams();
  const [venue, setVenue] = useState(null);
  const [bayId, setBayId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    api(`/venues/${id}`)
      .then((v) => {
        setVenue(v);
        if (v.bays?.length) setBayId(String(v.bays[0].id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setPageLoading(false));
  }, [id]);

  async function handleBook(e) {
    e.preventDefault();
    if (!getToken()) {
      setError('Please sign in to book a bay');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const booking = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          bayId: Number(bayId),
          startsAt: new Date(startsAt).toISOString().slice(0, 19),
          endsAt: new Date(endsAt).toISOString().slice(0, 19),
        }),
      });
      const checkout = await api('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ bookingId: booking.id }),
      });
      window.location.href = checkout.checkoutUrl;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  const selectedBay = venue?.bays?.find((b) => String(b.id) === bayId);

  if (pageLoading) {
    return (
      <div className="loading">
        <span className="spinner" />
        Loading venue…
      </div>
    );
  }

  if (!venue) return <p className="error">{error || 'Venue not found'}</p>;

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">{venue.name}</h1>
        <p className="page-subtitle">📍 {venue.address}</p>
      </header>

      <div className="detail-layout">
        <section>
          <h2 className="section-title">Available bays</h2>
          <div className="bay-list">
            {venue.bays.map((b) => (
              <div key={b.id} className="bay-item">
                <span>{b.name}</span>
                <span className="bay-price">LKR {b.hourlyRateLkr}/hr</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Book a session</h2>
          {!getToken() && (
            <p className="muted" style={{ marginBottom: '1rem' }}>
              <Link to="/login">Sign in</Link> to reserve a bay and pay online.
            </p>
          )}
          <form className="form" onSubmit={handleBook}>
            <label>
              Bay
              <select value={bayId} onChange={(e) => setBayId(e.target.value)}>
                {venue.bays.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} — LKR {b.hourlyRateLkr}/hr
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Start
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  required
                />
              </label>
              <label>
                End
                <input
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  required
                />
              </label>
            </div>
            {selectedBay && startsAt && endsAt && (
              <p className="muted">
                Rate: LKR {selectedBay.hourlyRateLkr}/hr — final amount calculated at checkout
              </p>
            )}
            {error && <p className="error">{error}</p>}
            <button type="submit" className="btn" disabled={loading}>
              {loading ? 'Redirecting to payment…' : 'Book & pay'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
