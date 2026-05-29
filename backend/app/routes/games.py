from datetime import timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Bay, Booking, Game, User, Venue
from app.booking_conflicts import has_conflict
from app.routes.bookings import parse_dt
from app.stripe_utils import calculate_amount_lkr, create_checkout_session


games_bp = Blueprint("games", __name__, url_prefix="/api/games")


def get_game_or_404(game_id):
    game = db.session.get(Game, game_id)
    if not game:
        return None, (jsonify({"error": "Game not found"}), 404)
    return game, None


@games_bp.get("")
def list_games():
    games = (
        Game.query.filter_by(status="open")
        .order_by(Game.starts_at.asc())
        .all()
    )
    return jsonify([g.to_dict() for g in games])


@games_bp.post("")
@jwt_required()
def create_game():
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    data = request.get_json() or {}

    title = (data.get("title") or "").strip()
    starts_at = parse_dt(data.get("startsAt") or data.get("starts_at"))
    min_players = data.get("minPlayers") or data.get("min_players") or 6
    gender = data.get("gender") or "mixed"

    if not title or not starts_at:
        return jsonify({"error": "title and startsAt required"}), 400
    if min_players < 2:
        return jsonify({"error": "minPlayers must be at least 2"}), 400
    if gender not in ("men", "women", "mixed"):
        return jsonify({"error": "gender must be men, women, or mixed"}), 400

    game = Game(
        captain_id=user_id,
        title=title,
        starts_at=starts_at,
        min_players=min_players,
        gender=gender,
        status="open",
    )
    game.players.append(user)
    db.session.add(game)
    db.session.commit()

    return jsonify(game.to_dict()), 201


@games_bp.post("/<int:game_id>/join")
@jwt_required()
def join_game(game_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    game, err = get_game_or_404(game_id)
    if err:
        return err

    if game.status != "open":
        return jsonify({"error": "Game is not open"}), 400

    if user in game.players:
        return jsonify({"error": "Already joined"}), 409

    game.players.append(user)
    db.session.commit()
    return jsonify(game.to_dict())


@games_bp.post("/<int:game_id>/leave")
@jwt_required()
def leave_game(game_id):
    user_id = int(get_jwt_identity())
    user = db.session.get(User, user_id)
    game, err = get_game_or_404(game_id)
    if err:
        return err

    if game.status != "open":
        return jsonify({"error": "Game is not open"}), 400
    if game.captain_id == user_id:
        return jsonify({"error": "Captain cannot leave — cancel the game instead"}), 400
    if user not in game.players:
        return jsonify({"error": "You are not in this game"}), 400

    game.players.remove(user)
    db.session.commit()
    return jsonify(game.to_dict())


@games_bp.post("/<int:game_id>/book")
@jwt_required()
def book_game(game_id):
    user_id = int(get_jwt_identity())
    game, err = get_game_or_404(game_id)
    if err:
        return err

    if game.captain_id != user_id:
        return jsonify({"error": "Only the captain can book"}), 403
    if game.status != "open":
        return jsonify({"error": "Game is not open"}), 400
    if len(game.players) < game.min_players:
        return jsonify({"error": "Not enough players yet"}), 400

    data = request.get_json() or {}
    venue_id = data.get("venueId") or data.get("venue_id")
    bay_id = data.get("bayId") or data.get("bay_id")
    ends_at = parse_dt(data.get("endsAt") or data.get("ends_at"))

    if not venue_id or not bay_id:
        return jsonify({"error": "venueId and bayId required"}), 400
    if not ends_at:
        ends_at = game.starts_at + timedelta(hours=1)
    if ends_at <= game.starts_at:
        return jsonify({"error": "endsAt must be after startsAt"}), 400

    venue = db.session.get(Venue, venue_id)
    if not venue:
        return jsonify({"error": "Venue not found"}), 404

    bay = db.session.get(Bay, bay_id)
    if not bay or bay.venue_id != venue_id or not bay.is_active:
        return jsonify({"error": "Bay not found"}), 404

    if has_conflict(bay_id, game.starts_at, ends_at):
        return jsonify({"error": "Slot not available"}), 409

    amount_lkr = calculate_amount_lkr(bay.hourly_rate_lkr, game.starts_at, ends_at)
    booking = Booking(
        bay_id=bay_id,
        user_id=user_id,
        starts_at=game.starts_at,
        ends_at=ends_at,
        status="pending_payment",
        amount_lkr=amount_lkr,
    )
    game.venue_id = venue_id
    game.bay_id = bay_id
    # game stays "open" until payment webhook sets "booked"
    db.session.add(booking)
    db.session.flush()
    session = create_checkout_session(booking, bay.name, game_id=game.id)
    booking.stripe_session_id = session.id
    db.session.commit()
    result = game.to_dict()
    result["booking"] = booking.to_dict()
    result["checkoutUrl"] = session.url
    return jsonify(result)


@games_bp.post("/<int:game_id>/cancel")
@jwt_required()
def cancel_game(game_id):
    user_id = int(get_jwt_identity())
    game, err = get_game_or_404(game_id)
    if err:
        return err

    if game.captain_id != user_id:
        return jsonify({"error": "Only the captain can cancel"}), 403
    if game.status != "open":
        return jsonify({"error": "Only open games can be cancelled"}), 400

    game.status = "cancelled"
    db.session.commit()
    return jsonify(game.to_dict())