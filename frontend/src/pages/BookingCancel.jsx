import { Link } from 'react-router-dom';

export default function BookingCancel() {
  return (
    <div className="result-page">
      <div className="result-icon cancel">✕</div>
      <h1 className="page-title">Payment cancelled</h1>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>
        Your slot was not confirmed. You can try booking again anytime.
      </p>
      <div className="btn-group" style={{ justifyContent: 'center' }}>
        <Link to="/venues" className="btn">Try again</Link>
        <Link to="/" className="btn btn-outline">Home</Link>
      </div>
    </div>
  );
}
