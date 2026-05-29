"""Availability rules for nets and full-area spaces.

Within an area:
- Booking the full area blocks every net in that area.
- Booking any net blocks the full area for that area.
- Individual nets can still be booked independently of each other.
"""

from app.extensions import db
from app.models import Bay, Booking

ACTIVE_STATUSES = ("confirmed", "pending_payment")


def related_bay_ids(bay):
    """Bay IDs whose bookings would block booking `bay` at the same time."""
    if not bay or not bay.is_active:
        return []

    if bay.area_id:
        if bay.kind == "full_area":
            nets = Bay.query.filter_by(
                area_id=bay.area_id, kind="net", is_active=True
            ).all()
            return [b.id for b in nets] + [bay.id]

        if bay.kind == "net":
            ids = [bay.id]
            full_area = Bay.query.filter_by(
                area_id=bay.area_id, kind="full_area", is_active=True
            ).first()
            if full_area:
                ids.append(full_area.id)
            return ids

    return [bay.id]


def has_conflict(bay_id, starts_at, ends_at, exclude_id=None):
    bay = db.session.get(Bay, bay_id)
    if not bay or not bay.is_active:
        return True

    target_ids = related_bay_ids(bay)
    query = Booking.query.filter(
        Booking.bay_id.in_(target_ids),
        Booking.status.in_(ACTIVE_STATUSES),
        Booking.starts_at < ends_at,
        Booking.ends_at > starts_at,
    )
    if exclude_id:
        query = query.filter(Booking.id != exclude_id)
    return query.first() is not None
