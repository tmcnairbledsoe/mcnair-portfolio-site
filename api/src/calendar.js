const { randomUUID, timingSafeEqual } = require("node:crypto");
const { HttpError } = require("./auth");
const { readBytes } = require("./service");
const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function validDay(day) {
  return (
    typeof day === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(day) &&
    Number.isFinite(Date.parse(day)) &&
    new Date(day).toISOString().slice(0, 10) === day
  );
}
function validateEntry(body, now = Date.now()) {
  if (
    !body ||
    Object.keys(body).some(
      (k) =>
        ![
          "title",
          "kind",
          "day",
          "member",
          "startTime",
          "endTime",
          "completed",
          "reminderAt",
          "remindTo",
        ].includes(k),
    ) ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.trim().length > 200 ||
    !["event", "task"].includes(body.kind) ||
    !validDay(body.day) ||
    !["owner", "wife", "both"].includes(body.member) ||
    typeof body.completed !== "boolean"
  )
    throw new HttpError(400, "Choose a title, valid date, and person.");
  if (
    body.kind === "event" &&
    (!/^([01]\d|2[0-3]):[0-5]\d$/.test(body.startTime || "") ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.endTime || "") ||
      body.endTime <= body.startTime ||
      body.completed)
  )
    throw new HttpError(
      400,
      "Events need a start and later end time on the selected day.",
    );
  if (
    body.kind === "task" &&
    (body.startTime !== null || body.endTime !== null)
  )
    throw new HttpError(400, "Tasks have no busy-time interval.");
  if (
    body.reminderAt !== null &&
    (typeof body.reminderAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(body.reminderAt) ||
      !Number.isFinite(Date.parse(body.reminderAt)) ||
      new Date(body.reminderAt).toISOString() !== body.reminderAt ||
      Date.parse(body.reminderAt) <= now ||
      Date.parse(body.reminderAt) > now + 730 * 86400000 ||
      !["owner", "wife", "both"].includes(body.remindTo))
  )
    throw new HttpError(
      400,
      "Choose a future reminder time within two years and its recipients.",
    );
  if (body.reminderAt === null && body.remindTo !== null)
    throw new HttpError(400, "Choose a reminder time.");
  return { ...body, title: body.title.trim() };
}
function dto(e) {
  return {
    id: e.id,
    title: e.title,
    kind: e.kind,
    day: e.day,
    member: e.member,
    startTime: e.start_time?.slice(0, 5) || null,
    endTime: e.end_time?.slice(0, 5) || null,
    completed: e.completed,
    reminderAt: e.reminder_at,
    remindTo: e.remind_to,
    version: e.version,
    reminders: e.reminders || [],
  };
}
function expected(request) {
  const value = request.headers.get("if-match");
  if (!/^"[1-9]\d{0,8}"$/.test(value || ""))
    throw new HttpError(428, "Reload this calendar entry before changing it.");
  return Number(value.slice(1, -1));
}
function check(error) {
  if (!error) return;
  if (["P0002", "23505"].includes(error.code))
    throw new HttpError(
      412,
      "This calendar entry changed. Reload it before saving.",
    );
  throw new HttpError(503, "Calendar storage is unavailable. Please retry.");
}
function createCalendarService({
  authenticate,
  getClient,
  emailReady = () => false,
}) {
  return async (request) => {
    try {
      const user = await authenticate(
        request.headers.get("x-portfolio-authorization"),
      );
      if (!user)
        throw new HttpError(401, "Sign in to open the shared calendar.");
      if (!user.calendarAllowed)
        throw new HttpError(403, "The calendar is only for Owner and Wife.");
      const url = new URL(request.url),
        parts = url.pathname.replace(/^\/api\//, "").split("/"),
        id = parts[1];
      if (parts[0] !== "calendar" || parts.length > 2 || (id && !uuid.test(id)))
        throw new HttpError(404, "Calendar entry not found.");
      const client = getClient();
      if (request.method === "GET" && !id) {
        const month = url.searchParams.get("month");
        if (!/^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(month || ""))
          throw new HttpError(
            400,
            "Choose a calendar month from 2000 through 2100.",
          );
        const { data, error } = await client.rpc("read_calendar", {
          p_month: month,
        });
        check(error);
        if (data.length > 500)
          throw new HttpError(
            503,
            "This month contains too many entries to display.",
          );
        return {
          status: 200,
          headers,
          jsonBody: { items: data.map(dto), emailReady: emailReady() },
        };
      }
      if (
        (request.method === "POST" && !id) ||
        (request.method === "PUT" && id)
      ) {
        if (request.headers.get("content-type") !== "application/json")
          throw new HttpError(400, "Send calendar JSON.");
        let body;
        try {
          body = JSON.parse((await readBytes(request, 12000)).toString());
        } catch (e) {
          if (e instanceof HttpError) throw e;
          throw new HttpError(400, "Invalid calendar JSON.");
        }
        const entry = validateEntry(body);
        if (entry.reminderAt && !emailReady())
          throw new HttpError(
            503,
            "Email reminders are not connected yet. Save without a reminder for now.",
          );
        const { data, error } = await client.rpc("save_calendar", {
          p_entry: { ...entry, id: id || randomUUID() },
          p_expected: id ? expected(request) : null,
        });
        check(error);
        return { status: id ? 200 : 201, headers, jsonBody: dto(data) };
      }
      if (request.method === "DELETE" && id) {
        const { data, error } = await client
          .from("calendar_entries")
          .delete()
          .eq("id", id)
          .eq("version", expected(request))
          .select("id");
        check(error);
        if (!data.length)
          throw new HttpError(
            412,
            "This calendar entry changed. Reload it before deleting.",
          );
        return { status: 200, headers, jsonBody: { deleted: true } };
      }
      throw new HttpError(405, "Method not allowed.");
    } catch (error) {
      return {
        status: error instanceof HttpError ? error.status : 503,
        headers,
        jsonBody: {
          error:
            error instanceof HttpError
              ? error.message
              : "Calendar is unavailable. Please retry.",
        },
      };
    }
  };
}
function reminderSettings(env = process.env) {
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return !!(
    env.RESEND_API_KEY?.startsWith("re_") &&
    email.test(env.REMINDER_FROM || "") &&
    email.test(env.CALENDAR_OWNER_EMAIL || "") &&
    email.test(env.CALENDAR_WIFE_EMAIL || "") &&
    env.CALENDAR_REMINDER_SECRET?.length >= 32
  );
}
function createReminderService({ getClient, env = process.env, send = fetch }) {
  return async (request) => {
    const secret = request.headers.get("x-reminder-secret") || "",
      wanted = env.CALENDAR_REMINDER_SECRET || "";
    const actualBytes = Buffer.from(secret),
      wantedBytes = Buffer.from(wanted);
    if (
      !wanted ||
      actualBytes.length !== wantedBytes.length ||
      !timingSafeEqual(actualBytes, wantedBytes)
    )
      return { status: 403, headers, jsonBody: { error: "Not authorized." } };
    if (!reminderSettings(env))
      return {
        status: 503,
        headers,
        jsonBody: { error: "Email reminders are not configured." },
      };
    try {
      const client = getClient();
      const { data: jobs, error } = await client.rpc(
        "claim_calendar_reminders",
      );
      check(error);
      let sent = 0;
      for (const job of jobs) {
        const { data: entry, error: readError } = await client
          .from("calendar_entries")
          .select("*")
          .eq("id", job.entry_id)
          .eq("version", job.entry_version)
          .maybeSingle();
        check(readError);
        if (!entry || entry.completed) continue;
        const to =
          job.recipient === "owner"
            ? env.CALENDAR_OWNER_EMAIL
            : env.CALENDAR_WIFE_EMAIL;
        const names = {
          owner: "McNair",
          wife: "Charlotte",
          both: "McNair and Charlotte",
        };
        const text = `${entry.kind === "task" ? "Task" : "Event"}: ${entry.title}\nFor: ${names[entry.member]}\nDate: ${entry.day}${entry.kind === "event" ? `\nBusy: ${entry.start_time.slice(0, 5)}–${entry.end_time.slice(0, 5)} (America/New_York)` : ""}\n\nOpen your shared calendar: https://mcnairscode.com/calendar`;
        let status = "pending";
        try {
          const result = await send("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
              "Idempotency-Key": `calendar/${job.id}`,
            },
            body: JSON.stringify({
              from: env.REMINDER_FROM,
              to: [to],
              subject: "Shared calendar reminder",
              text,
            }),
            signal: AbortSignal.timeout(15000),
          });
          if (result.ok) {
            status = "sent";
            sent++;
          } else if (
            result.status >= 400 &&
            result.status < 500 &&
            ![408, 429].includes(result.status)
          )
            status = "failed";
        } catch {
          /* Retried with the same provider idempotency key. */
        }
        const { error: updateError } = await client
          .from("calendar_reminders")
          .update({
            status,
            lease_until: null,
            ...(status === "sent" ? { sent_at: new Date().toISOString() } : {}),
          })
          .eq("id", job.id)
          .eq("status", "sending");
        check(updateError);
      }
      return {
        status: 200,
        headers,
        jsonBody: { processed: jobs.length, sent },
      };
    } catch {
      return {
        status: 503,
        headers,
        jsonBody: { error: "Reminder processing failed. Retry later." },
      };
    }
  };
}
module.exports = {
  createCalendarService,
  createReminderService,
  validateEntry,
  reminderSettings,
  dto,
};
