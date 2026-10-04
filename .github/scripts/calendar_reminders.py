"""Trigger the private reminder worker without logging credentials or event content."""
import json
import os
from urllib.request import Request, urlopen
secret = os.environ.get("CALENDAR_REMINDER_SECRET", "")
if not secret:
    print("Email delivery is not configured yet; no reminders sent.")
else:
    request = Request("https://mcnairscode.com/api/calendar-reminders", data=b"{}", method="POST",
                      headers={"X-Reminder-Secret": secret, "Content-Type": "application/json"})
    try:
        with urlopen(request, timeout=240) as response:
            result = json.load(response)
        print(f"Processed {result['processed']} reminders; accepted by provider: {result['sent']}.")
    except Exception:
        raise SystemExit("Reminder processing failed. The database will retry eligible reminders.")
