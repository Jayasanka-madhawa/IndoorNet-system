"""Hourly booking window — whole hours only."""

from datetime import datetime

OPEN_HOUR = 6
CLOSE_HOUR = 22  # sessions must end by this hour (e.g. 21:00–22:00 is OK)
MIN_DURATION_HOURS = 1
MAX_DURATION_HOURS = 4


def validate_hourly_slot(starts_at, ends_at):
    if starts_at.minute or starts_at.second or ends_at.minute or ends_at.second:
        return "Times must be on the hour (e.g. 6:00, 7:00)"

    if starts_at.hour < OPEN_HOUR:
        return f"Earliest start is {OPEN_HOUR}:00"

    duration_hours = (ends_at - starts_at).total_seconds() / 3600
    if duration_hours < MIN_DURATION_HOURS:
        return f"Minimum booking is {MIN_DURATION_HOURS} hour"
    if duration_hours != int(duration_hours):
        return "Duration must be whole hours"
    if int(duration_hours) > MAX_DURATION_HOURS:
        return f"Maximum booking is {MAX_DURATION_HOURS} hours"

    if ends_at.hour > CLOSE_HOUR or (
        ends_at.hour == CLOSE_HOUR and (ends_at.minute or ends_at.second)
    ):
        return f"Sessions must end by {CLOSE_HOUR}:00"

    if starts_at.date() != ends_at.date():
        return "Bookings cannot cross midnight"

    return None


def occupied_hours_for_bay(bay_id, day):
    """Return hour values (OPEN_HOUR .. CLOSE_HOUR-1) already booked for this space."""
    from app.booking_conflicts import has_conflict

    hours = []
    for hour in range(OPEN_HOUR, CLOSE_HOUR):
        starts_at = datetime(day.year, day.month, day.day, hour, 0, 0)
        ends_at = datetime(day.year, day.month, day.day, hour + 1, 0, 0)
        if has_conflict(bay_id, starts_at, ends_at):
            hours.append(hour)
    return hours
