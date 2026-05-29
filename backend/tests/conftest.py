import os

import pytest
from werkzeug.security import generate_password_hash

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-at-least-32-chars-long"
os.environ["SECRET_KEY"] = "test-secret"
os.environ["STRIPE_SECRET_KEY"] = "sk_test_fake"
os.environ["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake"
os.environ["FRONTEND_URL"] = "http://localhost:5173"

from app import create_app
from app.extensions import db
from app.models import Area, Bay, User, Venue


def seed_database():
    owner = User(
        email="owner@nets.lk",
        password_hash=generate_password_hash("owner123"),
        full_name="Net Owner",
        phone="0771234567",
        role="owner",
    )
    player = User(
        email="player@nets.lk",
        password_hash=generate_password_hash("player123"),
        full_name="Test Player",
        phone="0777654321",
        role="player",
        gender="men",
    )
    player2 = User(
        email="newplayer@test.lk",
        password_hash=generate_password_hash("test123"),
        full_name="New Player",
        phone="0771111111",
        role="player",
        gender="men",
    )
    db.session.add_all([owner, player, player2])
    db.session.flush()

    venue = Venue(
        name="Colombo Indoor Nets",
        address="123 Galle Road, Colombo",
        owner_id=owner.id,
    )
    db.session.add(venue)
    db.session.flush()

    main_hall = Area(
        venue_id=venue.id,
        name="Main Hall",
        allows_full_booking=True,
    )
    db.session.add(main_hall)
    db.session.flush()

    bays = [
        Bay(
            venue_id=venue.id,
            area_id=main_hall.id,
            kind="net",
            name="Net 1",
            hourly_rate_lkr=2000,
        ),
        Bay(
            venue_id=venue.id,
            area_id=main_hall.id,
            kind="net",
            name="Net 2",
            hourly_rate_lkr=2000,
        ),
        Bay(
            venue_id=venue.id,
            area_id=main_hall.id,
            kind="net",
            name="Net 3",
            hourly_rate_lkr=2500,
        ),
        Bay(
            venue_id=venue.id,
            area_id=main_hall.id,
            kind="full_area",
            name="Main Hall — Full area",
            hourly_rate_lkr=5500,
        ),
    ]
    db.session.add_all(bays)
    db.session.commit()


@pytest.fixture
def app():
    app = create_app()
    app.config["TESTING"] = True

    with app.app_context():
        db.drop_all()
        db.create_all()
        seed_database()

    yield app

    with app.app_context():
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


def login(client, email, password):
    response = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert response.status_code == 200
    return response.get_json()["token"]


def auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def create_pending_booking(client, token, bay_id=1, slot="2026-06-01T17:00:00", slot_end="2026-06-01T18:00:00"):
    response = client.post(
        "/api/bookings",
        json={"bayId": bay_id, "startsAt": slot, "endsAt": slot_end},
        headers=auth_headers(token),
    )
    assert response.status_code == 201
    return response.get_json()
