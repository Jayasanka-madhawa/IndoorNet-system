import os

import stripe
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from app.extensions import db
from app.models import Booking, Game
from app.stripe_utils import create_checkout_session

payments_bp = Blueprint("payments", __name__, url_prefix="/api/payments")

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


@payments_bp.post("/checkout")
@jwt_required()
def checkout():
    user_id = int(get_jwt_identity())
    data = request.get_json() or {}
    booking_id = data.get("bookingId") or data.get("booking_id")

    if not booking_id:
        return jsonify({"error": "bookingId required"}), 400

    booking = db.session.get(Booking, booking_id)
    if not booking:
        return jsonify({"error": "Booking not found"}), 404
    if booking.user_id != user_id:
        return jsonify({"error": "Not your booking"}), 403
    if booking.status != "pending_payment":
        return jsonify({"error": "Booking is not awaiting payment"}), 400

    session = create_checkout_session(booking, booking.bay.name)
    booking.stripe_session_id = session.id
    db.session.commit()

    return jsonify({"checkoutUrl": session.url, "sessionId": session.id})


@payments_bp.post("/webhooks/stripe")
def stripe_webhook():
    payload = request.get_data()
    sig_header = request.headers.get("Stripe-Signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret:
        return jsonify({"error": "STRIPE_WEBHOOK_SECRET not configured"}), 500

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except ValueError:
        return jsonify({"error": "Invalid payload"}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({"error": "Invalid signature"}), 400

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        booking_id = session.get("metadata", {}).get("booking_id")
        game_id = session.get("metadata", {}).get("game_id")

        if booking_id:
            booking = db.session.get(Booking, int(booking_id))
            if booking and booking.status == "pending_payment":
                booking.status = "confirmed"
                booking.stripe_session_id = session["id"]

        if game_id:
            game = db.session.get(Game, int(game_id))
            if game and game.status == "open":
                game.status = "booked"

        db.session.commit()

    return jsonify({"ok": True})