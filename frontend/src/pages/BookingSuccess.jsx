import { Link } from 'react-router-dom';

export default function BookingSuccess() {
  return (
    <div className="result-page">
      <div className="result-icon success">✓</div>
      <h1 className="page-title">Booking confirmed</h1>
      <p className="success" style={{ marginBottom: '1.5rem' }}>
        Payment received — your net is reserved. See you on the pitch!
      </p>
      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <Link to="/my-bookings" className="btn">My bookings</Link>
        <Link to="/venues" className="btn btn-outline">Browse nets</Link>
      </div>
    </div>
  );
}
