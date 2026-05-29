import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <>
      <section className="hero">
        <span className="hero-badge">🇱🇰 Sri Lanka</span>
        <h1>Book nets. Play together.</h1>
        <p>
          Find indoor cricket facilities, reserve a bay in minutes, or join a pickup
          softball game with players near you.
        </p>
        <div className="hero-actions">
          <Link to="/venues" className="btn">Browse nets</Link>
          <Link to="/games" className="btn btn-outline">Find a game</Link>
        </div>
      </section>

      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">📅</div>
          <h3>Instant booking</h3>
          <p>Pick a bay, choose your slot, pay online — done in under a minute.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">👥</div>
          <h3>Pickup games</h3>
          <p>Create a game, fill your squad, and book a net only when enough players join.</p>
        </div>
        <div className="feature-card">
          <div className="feature-icon">🏟️</div>
          <h3>For net owners</h3>
          <p>Manage your venue, see bookings, and grow your indoor cricket business.</p>
        </div>
      </div>
    </>
  );
}
