import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div>
      <h1 className="page-title">Indoor Cricket Nets</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        Book nets and join pickup softball games in Sri Lanka.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <Link to="/venues" className="btn">Browse Nets</Link>
        <Link to="/games" className="btn btn-outline">Pickup Games</Link>
      </div>
    </div>
  );
}