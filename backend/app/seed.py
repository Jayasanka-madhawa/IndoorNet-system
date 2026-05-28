from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import Bay, User, Venue


def seed():
    app = create_app()

    with app.app_context():
        db.drop_all()
        db.create_all()

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

        print("Seed complete.")
        print("Owner: owner@nets.lk / owner123")
        print("Player: player@nets.lk / player123")
        print(f"Venue: {venue.name} with {len(bays)} bays")


if __name__ == "__main__":
    seed()