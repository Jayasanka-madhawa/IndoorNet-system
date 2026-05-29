from werkzeug.security import generate_password_hash

from app import create_app
from app.extensions import db
from app.models import Area, Bay, User, Venue


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

        main_hall = Area(
            venue_id=venue.id,
            name="Main Hall",
            allows_full_booking=True,
        )
        side_lanes = Area(
            venue_id=venue.id,
            name="Side Lanes",
            allows_full_booking=False,
        )
        db.session.add_all([main_hall, side_lanes])
        db.session.flush()

        spaces = [
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
            Bay(
                venue_id=venue.id,
                area_id=side_lanes.id,
                kind="net",
                name="Side Net 1",
                hourly_rate_lkr=1800,
            ),
            Bay(
                venue_id=venue.id,
                area_id=None,
                kind="full_area",
                name="Open Practice Court",
                hourly_rate_lkr=8000,
            ),
        ]
        db.session.add_all(spaces)
        db.session.commit()

        print("Seed complete.")
        print("Owner: owner@nets.lk / owner123")
        print("Player: player@nets.lk / player123")
        print(f"Venue: {venue.name} — Main Hall (3 nets + full area), Side Lanes, Open Court")


if __name__ == "__main__":
    seed()
