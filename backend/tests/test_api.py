from tests.conftest import auth_headers, login

SLOT = "2026-06-01T17:00:00"
SLOT_END = "2026-06-01T18:00:00"
SLOT_2 = "2026-06-02T17:00:00"
SLOT_2_END = "2026-06-02T18:00:00"


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

    def test_create_booking(self, client):
        token = login(client, "player@nets.lk", "player123")
        response = client.post(
            "/api/bookings",
            json={"bayId": 1, "startsAt": SLOT, "endsAt": SLOT_END},
            headers=auth_headers(token),
        )
        assert response.status_code == 201
        booking = response.get_json()
        assert booking["bayId"] == 1
        assert booking["status"] == "confirmed"

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

    def test_availability_after_booking(self, client):
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
