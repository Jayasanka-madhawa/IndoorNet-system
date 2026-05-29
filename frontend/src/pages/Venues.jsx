import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function Venues() {
  const [venues, setVenues] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/venues')
      .then(setVenues)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading">
        <span className="spinner" />
        Loading venues…
      </div>
    );
  }

  if (error) return <p className="error">{error}</p>;

  return (
    <div>
      <header className="page-header">
        <h1 className="page-title">Indoor nets</h1>
        <p className="page-subtitle">Browse venues and book a bay for your session</p>
      </header>

      {venues.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2rem' }}>🏏</div>
          <p>No venues listed yet</p>
        </div>
      ) : (
        <div className="card-grid">
          {venues.map((v) => (
            <article key={v.id} className="card card-highlight">
              <div className="card-header">
                <h3>{v.name}</h3>
                <span className="badge badge-open">Open</span>
              </div>
              <p className="muted">📍 {v.address}</p>
              <div className="card-footer">
                <Link to={`/venues/${v.id}`} className="btn btn-sm">
                  View bays & book
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
