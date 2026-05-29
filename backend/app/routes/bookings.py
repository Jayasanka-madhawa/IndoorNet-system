from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Bay, Booking, User, Venue
from app.stripe_utils import calculate_amount_lkr


bookings_bp = Blueprint("bookings", __name__, url_prefix="/api/bookings")


def parse_dt(value):
    """Parse ISO datetime to naive UTC (matches SQLite storage)."""
    if not value:
        return None
    if value.endswith("Z"):
        value = value[:-1] + "+00:00"
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def has_conflict(bay_id, starts_at, ends_at, exclude_id=None):
    query = Booking.query.filter(
        Booking.bay_id == bay_id,
        Booking.status.in_(["confirmed", "pending_payment"]),
        Booking.starts_at < ends_at,
        Booking.ends_at > starts_at,
    )
    if exclude_id:
        query = query.filter(Booking.id != exclude_id)
    return query.first() is not None


@bookings_bp.get("/availability")
def availability():
    bay_id = request.args.get("bay_id", type=int)
    starts_at = parse_dt(request.args.get("starts_at"))
    ends_at = parse_dt(request.args.get("ends_at"))

    if not bay_id or not starts_at or not ends_at:
        return jsonify({"error": "bay_id, starts_at, ends_at required"}), 400
    if ends_at <= starts_at:
        return jsonify({"error": "ends_at must be after starts_at"}), 400

    bay = db.session.get(Bay, bay_id)
    if not bay or not bay.is_active:
        return jsonify({"error": "Bay not found"}), 404

    available = not has_conflict(bay_id, starts_at, ends_at)
    return jsonify({"available": available, "bayId": bay_id})


@bookings_bp.post("")
@jwt_required()
def create_booking():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}

    bay_id = data.get("bayId") or data.get("bay_id")
    starts_at = parse_dt(data.get("startsAt") or data.get("starts_at"))
    ends_at = parse_dt(data.get("endsAt") or data.get("ends_at"))

    if not bay_id or not starts_at or not ends_at:
        return jsonify({"error": "bayId, startsAt, endsAt required"}), 400
    if ends_at <= starts_at:
        return jsonify({"error": "endsAt must be after startsAt"}), 400

    bay = db.session.get(Bay, bay_id)
    if not bay or not bay.is_active:
        return jsonify({"error": "Bay not found"}), 404

    if has_conflict(bay_id, starts_at, ends_at):
        return jsonify({"error": "Slot not available"}), 409


    amount_lkr = calculate_amount_lkr(bay.hourly_rate_lkr, starts_at, ends_at)
    booking = Booking(
        bay_id=bay_id,
        user_id=user_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status="pending_payment",
        amount_lkr=amount_lkr,
    )
    db.session.add(booking)
    db.session.commit()
    return jsonify(booking.to_dict()), 201


@bookings_bp.get("/mine")
@jwt_required()
def my_bookings():
    user_id = int(get_jwt_identity())
    bookings = (
        Booking.query.filter_by(user_id=user_id)
        .order_by(Booking.starts_at.desc())
        .all()
    )
    return jsonify([b.to_dict(include_details=True) for b in bookings])


@bookings_bp.get("/venue/<int:venue_id>")
@jwt_required()
def venue_bookings(venue_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.role != "owner":
        return jsonify({"error": "Owner access only"}), 403

    venue = db.session.get(Venue, venue_id)
    if not venue:
        return jsonify({"error": "Venue not found"}), 404
    if venue.owner_id != user.id:
        return jsonify({"error": "Not your venue"}), 403

    bay_ids = [bay.id for bay in venue.bays]
    if not bay_ids:
        return jsonify([])

    bookings = (
        Booking.query.filter(Booking.bay_id.in_(bay_ids))
        .order_by(Booking.starts_at.desc())
        .all()
    )
    return jsonify([b.to_dict() for b in bookings])