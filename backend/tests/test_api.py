from unittest.mock import MagicMock, patch

from app.extensions import db
from app.models import Booking, Game
from tests.conftest import auth_headers, create_pending_booking, login

SLOT = "2026-06-01T17:00:00"
SLOT_END = "2026-06-01T18:00:00"
SLOT_2 = "2026-06-02T17:00:00"
SLOT_2_END = "2026-06-02T18:00:00"
GAME_SLOT = "2026-06-16T18:00:00"
GAME_SLOT_END = "2026-06-16T19:00:00"

MOCK_CHECKOUT = MagicMock(
    id="cs_test_mock123",
    url="https://checkout.stripe.com/c/pay/cs_test_mock123",
)


class TestHealth:
    def test_health_ok(self, client):
        response = client.get("/api/health")
        assert response.status_code == 200
        assert response.get_json() == {"ok": True}


class TestAuth:
    def test_login_player(self, client):
        response = client.post(
            "/api/auth/login",
            json={"email": "player@nets.lk", "password": "player123"},
        )
        assert response.status_code == 200
        data = response.get_json()
        assert "token" in data
        assert data["user"]["email"] == "player@nets.lk"
        assert data["user"]["role"] == "player"

    def test_login_owner(self, client):
        response = client.post(
            "/api/auth/login",
            json={"email": "owner@nets.lk", "password": "owner123"},
        )
        assert response.status_code == 200
        assert response.get_json()["user"]["role"] == "owner"

    def test_login_wrong_password(self, client):
        response = client.post(
            "/api/auth/login",
            json={"email": "player@nets.lk", "password": "wrong"},
        )
        assert response.status_code == 401
        assert response.get_json()["error"] == "Invalid email or password"

    def test_login_missing_fields(self, client):
        response = client.post("/api/auth/login", json={"email": "player@nets.lk"})
        assert response.status_code == 400

    def test_register_new_user(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "new@test.lk",
                "password": "pass123",
                "fullName": "New User",
                "role": "player",
            },
        )
        assert response.status_code == 201
        data = response.get_json()
        assert "token" in data
        assert data["user"]["email"] == "new@test.lk"

    def test_register_duplicate_email(self, client):
        response = client.post(
            "/api/auth/register",
            json={
                "email": "player@nets.lk",
                "password": "pass123",
                "fullName": "Duplicate",
            },
        )
        assert response.status_code == 409

    def test_register_missing_fields(self, client):
        response = client.post(
            "/api/auth/register",
            json={"email": "incomplete@test.lk"},
        )
        assert response.status_code == 400

    def test_me_with_token(self, client):
        token = login(client, "player@nets.lk", "player123")
        response = client.get("/api/auth/me", headers=auth_headers(token))
        assert response.status_code == 200
        assert response.get_json()["email"] == "player@nets.lk"

    def test_me_without_token(self, client):
        response = client.get("/api/auth/me")
        assert response.status_code == 401


class TestVenues:
    def test_list_venues(self, client):
        response = client.get("/api/venues")
        assert response.status_code == 200
        venues = response.get_json()
        assert len(venues) == 1
        assert venues[0]["name"] == "Colombo Indoor Nets"

    def test_get_venue_with_bays(self, client):
        response = client.get("/api/venues/1")
        assert response.status_code == 200
        venue = response.get_json()
        assert venue["name"] == "Colombo Indoor Nets"
        assert len(venue["bays"]) == 3
        assert venue["bays"][0]["hourlyRateLkr"] == 2000

    def test_get_venue_not_found(self, client):
        response = client.get("/api/venues/999")
        assert response.status_code == 404

    def test_owner_my_venues(self, client):
        token = login(client, "owner@nets.lk", "owner123")
        response = client.get("/api/venues/mine", headers=auth_headers(token))
        assert response.status_code == 200
        venues = response.get_json()
        assert len(venues) == 1
        assert len(venues[0]["bays"]) == 3

    def test_player_cannot_access_my_venues(self, client):
        token = login(client, "player@nets.lk", "player123")
        response = client.get("/api/venues/mine", headers=auth_headers(token))
        assert response.status_code == 403


class TestBookings:
    def test_availability_free_slot(self, client):
        response = client.get(
            "/api/bookings/availability",
            query_string={
                "bay_id": 1,
                "starts_at": SLOT,
                "ends_at": SLOT_END,
            },
        )
        assert response.status_code == 200
        assert response.get_json()["available"] is True

    def test_availability_missing_params(self, client):
        response = client.get("/api/bookings/availability")
        assert response.status_code == 400

    def test_availability_invalid_times(self, client):
        response = client.get(
            "/api/bookings/availability",
            query_string={
                "bay_id": 1,
                "starts_at": SLOT_END,
                "ends_at": SLOT,
            },
        )
        assert response.status_code == 400

    def test_create_booking_pending_payment(self, client):
        token = login(client, "player@nets.lk", "player123")
        response = client.post(
            "/api/bookings",
            json={"bayId": 1, "startsAt": SLOT, "endsAt": SLOT_END},
            headers=auth_headers(token),
        )
        assert response.status_code == 201
        booking = response.get_json()
        assert booking["bayId"] == 1
        assert booking["status"] == "pending_payment"
        assert booking["amountLkr"] == 2000

    def test_create_booking_conflict(self, client):
        token = login(client, "player@nets.lk", "player123")
        payload = {"bayId": 1, "startsAt": SLOT, "endsAt": SLOT_END}

        first = client.post(
            "/api/bookings", json=payload, headers=auth_headers(token)
        )
        assert first.status_code == 201

        second = client.post(
            "/api/bookings", json=payload, headers=auth_headers(token)
        )
        assert second.status_code == 409
        assert second.get_json()["error"] == "Slot not available"

    def test_availability_after_pending_booking(self, client):
        token = login(client, "player@nets.lk", "player123")
        client.post(
            "/api/bookings",
            json={"bayId": 1, "startsAt": SLOT_2, "endsAt": SLOT_2_END},
            headers=auth_headers(token),
        )

        response = client.get(
            "/api/bookings/availability",
            query_string={
                "bay_id": 1,
                "starts_at": SLOT_2,
                "ends_at": SLOT_2_END,
            },
        )
        assert response.status_code == 200
        assert response.get_json()["available"] is False

    def test_my_bookings(self, client):
        token = login(client, "player@nets.lk", "player123")
        client.post(
            "/api/bookings",
            json={"bayId": 2, "startsAt": SLOT, "endsAt": SLOT_END},
            headers=auth_headers(token),
        )

        response = client.get("/api/bookings/mine", headers=auth_headers(token))
        assert response.status_code == 200
        bookings = response.get_json()
        assert len(bookings) >= 1
        assert bookings[0]["bayId"] == 2

    def test_create_booking_without_token(self, client):
        response = client.post(
            "/api/bookings",
            json={"bayId": 1, "startsAt": SLOT, "endsAt": SLOT_END},
        )
        assert response.status_code == 401

    def test_owner_venue_bookings(self, client):
        player_token = login(client, "player@nets.lk", "player123")
        client.post(
            "/api/bookings",
            json={"bayId": 1, "startsAt": SLOT, "endsAt": SLOT_END},
            headers=auth_headers(player_token),
        )

        owner_token = login(client, "owner@nets.lk", "owner123")
        response = client.get(
            "/api/bookings/venue/1",
            headers=auth_headers(owner_token),
        )
        assert response.status_code == 200
        bookings = response.get_json()
        assert len(bookings) >= 1

    def test_player_cannot_view_venue_bookings(self, client):
        token = login(client, "player@nets.lk", "player123")
        response = client.get(
            "/api/bookings/venue/1",
            headers=auth_headers(token),
        )
        assert response.status_code == 403


class TestPayments:
    @patch("app.routes.payments.create_checkout_session", return_value=MOCK_CHECKOUT)
    def test_checkout_returns_url(self, mock_checkout, client):
        token = login(client, "player@nets.lk", "player123")
        booking = create_pending_booking(client, token)

        response = client.post(
            "/api/payments/checkout",
            json={"bookingId": booking["id"]},
            headers=auth_headers(token),
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["checkoutUrl"] == MOCK_CHECKOUT.url
        assert data["sessionId"] == MOCK_CHECKOUT.id
        mock_checkout.assert_called_once()

    def test_checkout_not_owner(self, client):
        token = login(client, "player@nets.lk", "player123")
        booking = create_pending_booking(
            client, token, bay_id=2, slot=SLOT_2, slot_end=SLOT_2_END
        )
        other_token = login(client, "newplayer@test.lk", "test123")

        response = client.post(
            "/api/payments/checkout",
            json={"bookingId": booking["id"]},
            headers=auth_headers(other_token),
        )
        assert response.status_code == 403

    @patch("app.routes.payments.create_checkout_session", return_value=MOCK_CHECKOUT)
    def test_checkout_already_paid(self, mock_checkout, client, app):
        token = login(client, "player@nets.lk", "player123")
        booking = create_pending_booking(
            client, token, bay_id=3, slot="2026-06-03T17:00:00", slot_end="2026-06-03T18:00:00"
        )

        with app.app_context():
            row = db.session.get(Booking, booking["id"])
            row.status = "confirmed"
            db.session.commit()

        response = client.post(
            "/api/payments/checkout",
            json={"bookingId": booking["id"]},
            headers=auth_headers(token),
        )
        assert response.status_code == 400
        mock_checkout.assert_not_called()

    @patch("app.routes.payments.stripe.Webhook.construct_event")
    def test_webhook_confirms_booking(self, mock_construct, client, app):
        token = login(client, "player@nets.lk", "player123")
        booking = create_pending_booking(
            client, token, bay_id=1, slot="2026-06-04T17:00:00", slot_end="2026-06-04T18:00:00"
        )

        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_webhook123",
                    "metadata": {"booking_id": str(booking["id"])},
                }
            },
        }

        response = client.post(
            "/api/payments/webhooks/stripe",
            data=b"{}",
            headers={"Stripe-Signature": "test_sig"},
        )
        assert response.status_code == 200

        with app.app_context():
            row = db.session.get(Booking, booking["id"])
            assert row.status == "confirmed"
            assert row.stripe_session_id == "cs_test_webhook123"

    @patch("app.routes.payments.stripe.Webhook.construct_event")
    def test_webhook_confirms_game(self, mock_construct, client, app):
        captain_token = login(client, "player@nets.lk", "player123")
        player2_token = login(client, "newplayer@test.lk", "test123")

        game_resp = client.post(
            "/api/games",
            json={
                "title": "Webhook Game",
                "startsAt": GAME_SLOT,
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(captain_token),
        )
        game_id = game_resp.get_json()["id"]

        client.post(
            f"/api/games/{game_id}/join",
            headers=auth_headers(player2_token),
        )

        with patch(
            "app.routes.games.create_checkout_session", return_value=MOCK_CHECKOUT
        ):
            book_resp = client.post(
                f"/api/games/{game_id}/book",
                json={"venueId": 1, "bayId": 2, "endsAt": GAME_SLOT_END},
                headers=auth_headers(captain_token),
            )
        booking_id = book_resp.get_json()["booking"]["id"]

        mock_construct.return_value = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_game_webhook",
                    "metadata": {
                        "booking_id": str(booking_id),
                        "game_id": str(game_id),
                    },
                }
            },
        }

        response = client.post(
            "/api/payments/webhooks/stripe",
            data=b"{}",
            headers={"Stripe-Signature": "test_sig"},
        )
        assert response.status_code == 200

        with app.app_context():
            booking = db.session.get(Booking, booking_id)
            game = db.session.get(Game, game_id)
            assert booking.status == "confirmed"
            assert game.status == "booked"


class TestGames:
    def test_list_games_empty(self, client):
        response = client.get("/api/games")
        assert response.status_code == 200
        assert response.get_json() == []

    def test_create_game(self, client):
        token = login(client, "player@nets.lk", "player123")
        response = client.post(
            "/api/games",
            json={
                "title": "Friday Softball",
                "startsAt": GAME_SLOT,
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(token),
        )
        assert response.status_code == 201
        game = response.get_json()
        assert game["title"] == "Friday Softball"
        assert game["playerCount"] == 1
        assert game["status"] == "open"

    def test_join_game(self, client):
        captain = login(client, "player@nets.lk", "player123")
        player2 = login(client, "newplayer@test.lk", "test123")

        create = client.post(
            "/api/games",
            json={
                "title": "Join Test",
                "startsAt": GAME_SLOT,
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(captain),
        )
        game_id = create.get_json()["id"]

        response = client.post(
            f"/api/games/{game_id}/join",
            headers=auth_headers(player2),
        )
        assert response.status_code == 200
        assert response.get_json()["playerCount"] == 2

    def test_join_already_joined(self, client):
        token = login(client, "player@nets.lk", "player123")
        create = client.post(
            "/api/games",
            json={
                "title": "Duplicate Join",
                "startsAt": "2026-06-17T18:00:00",
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(token),
        )
        game_id = create.get_json()["id"]

        response = client.post(
            f"/api/games/{game_id}/join",
            headers=auth_headers(token),
        )
        assert response.status_code == 409

    def test_book_game_not_enough_players(self, client):
        token = login(client, "player@nets.lk", "player123")
        create = client.post(
            "/api/games",
            json={
                "title": "Need Players",
                "startsAt": "2026-06-18T18:00:00",
                "minPlayers": 4,
                "gender": "mixed",
            },
            headers=auth_headers(token),
        )
        game_id = create.get_json()["id"]

        response = client.post(
            f"/api/games/{game_id}/book",
            json={"venueId": 1, "bayId": 1, "endsAt": "2026-06-18T19:00:00"},
            headers=auth_headers(token),
        )
        assert response.status_code == 400
        assert response.get_json()["error"] == "Not enough players yet"

    @patch("app.routes.games.create_checkout_session", return_value=MOCK_CHECKOUT)
    def test_book_game_returns_checkout_url(self, mock_checkout, client):
        captain = login(client, "player@nets.lk", "player123")
        player2 = login(client, "newplayer@test.lk", "test123")

        create = client.post(
            "/api/games",
            json={
                "title": "Book Test",
                "startsAt": "2026-06-19T18:00:00",
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(captain),
        )
        game_id = create.get_json()["id"]
        client.post(f"/api/games/{game_id}/join", headers=auth_headers(player2))

        response = client.post(
            f"/api/games/{game_id}/book",
            json={"venueId": 1, "bayId": 1, "endsAt": "2026-06-19T19:00:00"},
            headers=auth_headers(captain),
        )
        assert response.status_code == 200
        data = response.get_json()
        assert data["checkoutUrl"] == MOCK_CHECKOUT.url
        assert data["booking"]["status"] == "pending_payment"
        assert data["status"] == "open"
        mock_checkout.assert_called_once()

    def test_cancel_game(self, client):
        token = login(client, "player@nets.lk", "player123")
        create = client.post(
            "/api/games",
            json={
                "title": "Cancel Me",
                "startsAt": "2026-06-20T18:00:00",
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(token),
        )
        game_id = create.get_json()["id"]

        response = client.post(
            f"/api/games/{game_id}/cancel",
            headers=auth_headers(token),
        )
        assert response.status_code == 200
        assert response.get_json()["status"] == "cancelled"

    def test_captain_cannot_leave(self, client):
        captain = login(client, "player@nets.lk", "player123")
        player2 = login(client, "newplayer@test.lk", "test123")

        create = client.post(
            "/api/games",
            json={
                "title": "Leave Test",
                "startsAt": "2026-06-21T18:00:00",
                "minPlayers": 2,
                "gender": "mixed",
            },
            headers=auth_headers(captain),
        )
        game_id = create.get_json()["id"]
        client.post(f"/api/games/{game_id}/join", headers=auth_headers(player2))

        response = client.post(
            f"/api/games/{game_id}/leave",
            headers=auth_headers(captain),
        )
        assert response.status_code == 400
