from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.booking_conflicts import has_conflict
from datetime import date as date_type

from app.booking_slots import occupied_hours_for_bay, validate_hourly_slot
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


def is_own_venue(user, bay):
    if not user or user.role != "owner":
        return False
    venue = bay.venue
    return venue is not None and venue.owner_id == user.id


@bookings_bp.get("/availability")
def availability():
    bay_id = request.args.get("bay_id", type=int) or request.args.get("bayId", type=int)
    starts_at = parse_dt(request.args.get("starts_at") or request.args.get("startsAt"))
    ends_at = parse_dt(request.args.get("ends_at") or request.args.get("endsAt"))

    if not bay_id or not starts_at or not ends_at:
        return jsonify({"error": "bay_id, starts_at, ends_at required"}), 400
    if ends_at <= starts_at:
        return jsonify({"error": "ends_at must be after starts_at"}), 400

    slot_error = validate_hourly_slot(starts_at, ends_at)
    if slot_error:
        return jsonify({"error": slot_error}), 400

    bay = db.session.get(Bay, bay_id)
    if not bay or not bay.is_active:
        return jsonify({"error": "Space not found"}), 404

    available = not has_conflict(bay_id, starts_at, ends_at)
    return jsonify({"available": available, "bayId": bay_id, "kind": bay.kind})


@bookings_bp.get("/occupied")
def occupied_slots():
    bay_id = request.args.get("bay_id", type=int) or request.args.get("bayId", type=int)
    date_str = request.args.get("date")

    if not bay_id or not date_str:
        return jsonify({"error": "bayId and date required"}), 400

    try:
        day = date_type.fromisoformat(date_str)
    except ValueError:
        return jsonify({"error": "Invalid date"}), 400

    bay = db.session.get(Bay, bay_id)
    if not bay or not bay.is_active:
        return jsonify({"error": "Space not found"}), 404

    return jsonify({
        "bayId": bay_id,
        "date": date_str,
        "occupiedHours": occupied_hours_for_bay(bay_id, day),
    })


@bookings_bp.post("")
@jwt_required()
def create_booking():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    data = request.get_json() or {}

    bay_id = data.get("bayId") or data.get("bay_id")
    starts_at = parse_dt(data.get("startsAt") or data.get("starts_at"))
    ends_at = parse_dt(data.get("endsAt") or data.get("ends_at"))

    if not bay_id or not starts_at or not ends_at:
        return jsonify({"error": "bayId, startsAt, endsAt required"}), 400
    if ends_at <= starts_at:
        return jsonify({"error": "endsAt must be after startsAt"}), 400

    slot_error = validate_hourly_slot(starts_at, ends_at)
    if slot_error:
        return jsonify({"error": slot_error}), 400

    bay = db.session.get(Bay, bay_id)
    if not bay or not bay.is_active:
        return jsonify({"error": "Space not found"}), 404

    if has_conflict(bay_id, starts_at, ends_at):
        return jsonify({"error": "Slot not available"}), 409

    owner_block = is_own_venue(user, bay)
    if owner_block:
        status = "confirmed"
        amount_lkr = 0
    else:
        status = "pending_payment"
        amount_lkr = calculate_amount_lkr(bay.hourly_rate_lkr, starts_at, ends_at)

    booking = Booking(
        bay_id=bay_id,
        user_id=user_id,
        starts_at=starts_at,
        ends_at=ends_at,
        status=status,
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
    return jsonify([b.to_dict(include_details=True) for b in bookings])
