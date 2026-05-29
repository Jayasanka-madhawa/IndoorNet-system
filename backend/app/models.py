from datetime import datetime, timezone

from app.extensions import db


def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), nullable=False, default="player")  # player | owner
    gender = db.Column(db.String(20), nullable=True)  # men | women | mixed
    created_at = db.Column(db.DateTime, default=utcnow)

    venues = db.relationship("Venue", back_populates="owner", lazy=True)
    bookings = db.relationship("Booking", back_populates="user", lazy=True)
    games_captained = db.relationship("Game", back_populates="captain", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "email": self.email,
            "fullName": self.full_name,
            "phone": self.phone,
            "role": self.role,
            "gender": self.gender,
        }


class Venue(db.Model):
    __tablename__ = "venues"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    address = db.Column(db.String(500), nullable=True)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    owner = db.relationship("User", back_populates="venues")
    bays = db.relationship("Bay", back_populates="venue", lazy=True, cascade="all, delete-orphan")
    games = db.relationship("Game", back_populates="venue", lazy=True)

    def to_dict(self, include_bays=False):
        data = {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "ownerId": self.owner_id,
        }
        if include_bays:
            data["bays"] = [bay.to_dict() for bay in self.bays]
        return data


class Bay(db.Model):
    __tablename__ = "bays"

    id = db.Column(db.Integer, primary_key=True)
    venue_id = db.Column(db.Integer, db.ForeignKey("venues.id"), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    hourly_rate_lkr = db.Column(db.Integer, nullable=False, default=2000)
    is_active = db.Column(db.Boolean, default=True)

    venue = db.relationship("Venue", back_populates="bays")
    bookings = db.relationship("Booking", back_populates="bay", lazy=True)

    def to_dict(self):
        return {
            "id": self.id,
            "venueId": self.venue_id,
            "name": self.name,
            "hourlyRateLkr": self.hourly_rate_lkr,
            "isActive": self.is_active,
        }


class Booking(db.Model):
    __tablename__ = "bookings"

    id = db.Column(db.Integer, primary_key=True)
    bay_id = db.Column(db.Integer, db.ForeignKey("bays.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    starts_at = db.Column(db.DateTime, nullable=False)
    ends_at = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending_payment")
    # pending_payment | confirmed | cancelled
    amount_lkr = db.Column(db.Integer, nullable=True)
    stripe_session_id = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    bay = db.relationship("Bay", back_populates="bookings")
    user = db.relationship("User", back_populates="bookings")

    def to_dict(self):
        return {
            "id": self.id,
            "bayId": self.bay_id,
            "userId": self.user_id,
            "startsAt": self.starts_at.isoformat(),
            "endsAt": self.ends_at.isoformat(),
            "status": self.status,
            "amountLkr": self.amount_lkr,
        }


# Many-to-many: players in a pickup game
game_players = db.Table(
    "game_players",
    db.Column("game_id", db.Integer, db.ForeignKey("games.id"), primary_key=True),
    db.Column("user_id", db.Integer, db.ForeignKey("users.id"), primary_key=True),
    db.Column("joined_at", db.DateTime, default=utcnow),
)


class Game(db.Model):
    __tablename__ = "games"

    id = db.Column(db.Integer, primary_key=True)
    captain_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    venue_id = db.Column(db.Integer, db.ForeignKey("venues.id"), nullable=True)
    bay_id = db.Column(db.Integer, db.ForeignKey("bays.id"), nullable=True)
    title = db.Column(db.String(255), nullable=False)
    starts_at = db.Column(db.DateTime, nullable=False)
    min_players = db.Column(db.Integer, nullable=False, default=6)
    gender = db.Column(db.String(20), nullable=False, default="mixed")  # men | women | mixed
    status = db.Column(db.String(20), nullable=False, default="open")  # open | booked | cancelled
    created_at = db.Column(db.DateTime, default=utcnow)

    captain = db.relationship("User", back_populates="games_captained")
    venue = db.relationship("Venue", back_populates="games")
    bay = db.relationship("Bay")
    players = db.relationship("User", secondary=game_players, lazy="subquery")

    def to_dict(self):
        return {
            "id": self.id,
            "captainId": self.captain_id,
            "venueId": self.venue_id,
            "bayId": self.bay_id,
            "title": self.title,
            "startsAt": self.starts_at.isoformat(),
            "minPlayers": self.min_players,
            "gender": self.gender,
            "status": self.status,
            "playerCount": len(self.players),
            "players": [p.to_dict() for p in self.players],
        }
