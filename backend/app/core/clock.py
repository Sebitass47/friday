from datetime import date, datetime
from zoneinfo import ZoneInfo

APP_TZ = ZoneInfo("America/Mexico_City")


def today_local() -> date:
    """Today's date in the user's timezone (containers run in UTC)."""
    return datetime.now(APP_TZ).date()
