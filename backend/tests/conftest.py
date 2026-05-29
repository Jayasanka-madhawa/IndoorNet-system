import os

import pytest
from werkzeug.security import generate_password_hash

# Use in-memory DB before the app is created
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret"
os.environ["SECRET_KEY"] = "test-secret"

from app import create_app
from app.extensions import db
from app.models import Bay, User, Venue


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
    db.session.add_all([owner, player])
    db.session.flush()

    venue = Venue(
        name="Colombo Indoor Nets",
        address="123 Galle Road, Colombo",
        owner_id=owner.id,
    )
    db.session.add(venue)
    db.session.flush()

    bays = [
        Bay(venue_id=venue.id, name="Bay 1", hourly_rate_lkr=2000),
        Bay(venue_id=venue.id, name="Bay 2", hourly_rate_lkr=2000),
        Bay(venue_id=venue.id, name="Bay 3", hourly_rate_lkr=2500),
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
