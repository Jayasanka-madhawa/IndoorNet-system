import os

import stripe

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")


def calculate_amount_lkr(hourly_rate, starts_at, ends_at):
    hours = (ends_at - starts_at).total_seconds() / 3600
    return max(1, int(round(hours * hourly_rate)))


def create_checkout_session(booking, bay_name, game_id=None):
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    metadata = {"booking_id": str(booking.id)}
    if game_id:
        metadata["game_id"] = str(game_id)

    session = stripe.checkout.Session.create(
        mode="payment",
        line_items=[
            {
                "price_data": {
                    "currency": "lkr",
                    "product_data": {
                        "name": f"Net booking — {bay_name}",
                    },
                    "unit_amount": booking.amount_lkr * 100,
                },
                "quantity": 1,
            }
        ],
        metadata=metadata,
        success_url=f"{frontend_url}/booking/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{frontend_url}/booking/cancel",
    )
    return session