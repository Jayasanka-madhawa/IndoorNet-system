import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, getToken } from '../api';

function buildBookableOptions(venue) {
  const options = [];

  venue.areas?.forEach((area) => {
    area.nets?.forEach((net) => {
      options.push({
        id: net.id,
        label: `${area.name} — ${net.name}`,
        kind: 'net',
        areaName: area.name,
        hourlyRateLkr: net.hourlyRateLkr,
      });
    });
    if (area.fullArea) {
      options.push({
        id: area.fullArea.id,
        label: `${area.name} — Full area`,
        kind: 'full_area',
        areaName: area.name,
        hourlyRateLkr: area.fullArea.hourlyRateLkr,
      });
    }
  });

  venue.bays
    ?.filter((b) => !b.areaId)
    .forEach((space) => {
      options.push({
        id: space.id,
        label: space.name,
        kind: space.kind,
        areaName: null,
        hourlyRateLkr: space.hourlyRateLkr,
      });
    });

  return options;
}

export default function VenueDetail() {
  const { id } = useParams();
  const [venue, setVenue] = useState(null);
  const [spaceId, setSpaceId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const bookableOptions = useMemo(
    () => (venue ? buildBookableOptions(venue) : []),
    [venue]
  );

  useEffect(() => {
    api(`/venues/${id}`)
      .then((v) => {
        setVenue(v);
        const options = buildBookableOptions(v);
        if (options.length) setSpaceId(String(options[0].id));
      })
      .catch((err) => setError(err.message))
      .finally(() => setPageLoading(false));
  }, [id]);

  async function handleBook(e) {
    e.preventDefault();
    if (!getToken()) {
      setError('Please sign in to book');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const booking = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          bayId: Number(spaceId),
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

  const selected = bookableOptions.find((o) => String(o.id) === spaceId);

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
          <h2 className="section-title">What you can book</h2>

          {venue.areas?.map((area) => (
            <div key={area.id} className="area-group">
              <h3 className="area-name">{area.name}</h3>
              <p className="muted area-hint">
                {area.allowsFullBooking
                  ? 'Book individual nets or the full area — full area takes all nets.'
                  : 'Individual nets only in this zone.'}
              </p>
              <div className="bay-list">
                {area.nets?.map((net) => (
                  <div key={net.id} className="bay-item">
                    <span>
                      <span className="badge badge-open" style={{ marginRight: '0.5rem' }}>Net</span>
                      {net.name}
                    </span>
                    <span className="bay-price">LKR {net.hourlyRateLkr}/hr</span>
                  </div>
                ))}
                {area.fullArea && (
                  <div className="bay-item bay-item-full">
                    <span>
                      <span className="badge badge-pending_payment" style={{ marginRight: '0.5rem' }}>Full area</span>
                      {area.fullArea.name}
                    </span>
                    <span className="bay-price">LKR {area.fullArea.hourlyRateLkr}/hr</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {venue.bays?.filter((b) => !b.areaId).length > 0 && (
            <div className="area-group">
              <h3 className="area-name">Standalone spaces</h3>
              <div className="bay-list">
                {venue.bays
                  .filter((b) => !b.areaId)
                  .map((space) => (
                    <div key={space.id} className="bay-item">
                      <span>
                        <span className={`badge ${space.kind === 'full_area' ? 'badge-pending_payment' : 'badge-open'}`} style={{ marginRight: '0.5rem' }}>
                          {space.kind === 'full_area' ? 'Full area' : 'Net'}
                        </span>
                        {space.name}
                      </span>
                      <span className="bay-price">LKR {space.hourlyRateLkr}/hr</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="section-title" style={{ marginTop: 0 }}>Book a session</h2>
          {!getToken() && (
            <p className="muted" style={{ marginBottom: '1rem' }}>
              <Link to="/login">Sign in</Link> to reserve and pay online.
            </p>
          )}
          <form className="form" onSubmit={handleBook}>
            <label>
              Space
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                {bookableOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label} — LKR {o.hourlyRateLkr}/hr
                  </option>
                ))}
              </select>
            </label>
            {selected?.kind === 'full_area' && selected.areaName && (
              <p className="muted">
                Booking the full area blocks all nets in {selected.areaName} for this time slot.
              </p>
            )}
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
            {selected && startsAt && endsAt && (
              <p className="muted">
                Rate: LKR {selected.hourlyRateLkr}/hr — final amount calculated at checkout
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
