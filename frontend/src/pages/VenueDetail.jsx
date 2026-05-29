import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, readSession } from '../api';
import { buildSlotTimesFromHours, estimateAmount, todayDateStr } from '../bookingSlots';
import BookingSlotPicker from '../components/BookingSlotPicker';
import { buildBookableOptions, isOwnVenue } from '../venueUtils';

export default function VenueDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = readSession();
  const [venue, setVenue] = useState(null);
  const [spaceId, setSpaceId] = useState('');
  const [date, setDate] = useState(todayDateStr());
  const [selectedHours, setSelectedHours] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  const bookableOptions = useMemo(
    () => buildBookableOptions(venue),
    [venue]
  );
  const ownVenue = isOwnVenue(user, venue);
  const selected = bookableOptions.find((o) => String(o.id) === spaceId);
  const slot = buildSlotTimesFromHours(date, selectedHours);

  useEffect(() => {
    setSelectedHours([]);
  }, [spaceId]);

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
    if (!user) {
      setError('Please sign in to book');
      return;
    }
    if (!slot.valid) {
      setError('Pick at least one time slot');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const booking = await api('/bookings', {
        method: 'POST',
        body: JSON.stringify({
          bayId: Number(spaceId),
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
        }),
      });

      if (booking.status === 'confirmed') {
        navigate('/dashboard');
        return;
      }

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

  const estimatedTotal = selected && slot.valid
    ? estimateAmount(selected.hourlyRateLkr, slot.durationHours)
    : 0;

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
          <h2 className="section-title" style={{ marginTop: 0 }}>
            {ownVenue ? 'Block a slot' : 'Book a session'}
          </h2>
          {!user && (
            <p className="muted" style={{ marginBottom: '1rem' }}>
              <Link to="/login">Sign in</Link> to reserve and pay online.
            </p>
          )}
          {ownVenue && (
            <p className="muted" style={{ marginBottom: '1rem' }}>
              You own this venue — blocks are free and confirmed instantly.
            </p>
          )}
          <form className="form" onSubmit={handleBook}>
            <label>
              Space
              <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)}>
                {bookableOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}{ownVenue ? '' : ` — LKR ${o.hourlyRateLkr}/hr`}
                  </option>
                ))}
              </select>
            </label>
            {selected?.kind === 'full_area' && selected.areaName && (
              <p className="muted">
                Blocking the full area reserves all nets in {selected.areaName} for this time slot.
              </p>
            )}

            <BookingSlotPicker
              bayId={Number(spaceId)}
              date={date}
              selectedHours={selectedHours}
              onDateChange={setDate}
              onSelectionChange={setSelectedHours}
              summaryExtra={
                !ownVenue && estimatedTotal > 0
                  ? ` · LKR ${estimatedTotal.toLocaleString()} estimated`
                  : null
              }
            />

            {error && <p className="error">{error}</p>}
            <button
              type="submit"
              className="btn"
              disabled={loading || !slot.valid}
            >
              {loading
                ? (ownVenue ? 'Blocking…' : 'Redirecting to payment…')
                : (ownVenue ? 'Block slot' : 'Book & pay')}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
