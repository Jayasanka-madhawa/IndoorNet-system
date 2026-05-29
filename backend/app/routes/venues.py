from flask import Blueprint, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import User, Venue

venues_bp = Blueprint("venues", __name__, url_prefix="/api/venues")


@venues_bp.get("")
def list_venues():
    venues = Venue.query.order_by(Venue.name).all()
    return jsonify([v.to_dict() for v in venues])


@venues_bp.get("/mine")
@jwt_required()
def my_venues():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.role != "owner":
        return jsonify({"error": "Owner access only"}), 403

    venues = Venue.query.filter_by(owner_id=user.id).order_by(Venue.name).all()
    return jsonify([v.to_dict(include_bays=True) for v in venues])


@venues_bp.get("/<int:venue_id>")
def get_venue(venue_id):
    venue = db.session.get(Venue, venue_id)
    if not venue:
        return jsonify({"error": "Venue not found"}), 404
    return jsonify(venue.to_dict(include_bays=True))