const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { HttpRequest } = require("@azure/functions");
const {
  createCalendarService,
  createReminderService,
  validateEntry,
} = require("../src/calendar");
const id = "aaaaaaaa-1111-4111-8111-111111111111";
const entry = {
  id,
  title: "Shared event",
  kind: "event",
  day: "2026-10-10",
  member: "both",
  startTime: "09:00",
  endTime: "10:00",
  completed: false,
  reminderAt: new Date(Date.now() + 86400000).toISOString(),
  remindTo: "both",
};
test("calendar migration protects private tables and atomically versions entries, reminders, completion and concurrent claims", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;grant usage on schema public to anon,authenticated,service_role;",
    );
    const sql = fs.readFileSync(
      path.resolve(
        __dirname,
        "../../supabase/migrations/003_shared_calendar.sql",
      ),
      "utf8",
    );
    await db.exec(sql);
    await db.exec(sql);
    const save = async (e, v) =>
      (
        await db.query(
          "select public.save_calendar($1::jsonb,$2::integer) as result",
          [JSON.stringify(e), v],
        )
      ).rows[0].result;
    assert.equal((await save(entry, null)).version, 1);
    assert.equal(
      (await db.query("select * from calendar_reminders")).rows.length,
      2,
    );
    await assert.rejects(
      save({ ...entry, title: "Overwrite" }, null),
      (e) => e.code === "P0002",
    );
    await assert.rejects(
      save({ ...entry, title: "Stale" }, 9),
      (e) => e.code === "P0002",
    );
    await save({ ...entry, title: "Updated" }, 1);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from calendar_reminders where status='cancelled'",
        )
      ).rows[0].n,
      2,
    );
    await db.exec(
      "update calendar_reminders set due_at=now()-interval '1 minute' where status='pending'",
    );
    const claim = async () =>
      (await db.query("select public.claim_calendar_reminders() as result"))
        .rows[0].result;
    const jobs = await claim();
    assert.equal(jobs.length, 2);
    assert.equal((await claim()).length, 0);
    await db.exec(
      "update calendar_reminders set lease_until=now()-interval '1 minute' where status='sending'",
    );
    const retry = await claim();
    assert.deepEqual(
      retry.map((r) => r.id),
      jobs.map((r) => r.id),
    );
    assert.equal(retry[0].attempts, 2);
    await save(
      {
        ...entry,
        kind: "task",
        startTime: null,
        endTime: null,
        completed: true,
      },
      2,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from calendar_reminders where status in ('pending','sending')",
        )
      ).rows[0].n,
      0,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select * from calendar_entries"),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        db.query("select public.claim_calendar_reminders()"),
        (e) => e.code === "42501",
      );
      await assert.rejects(save(entry, 3), (e) => e.code === "42501");
      await db.exec("reset role");
    }
    await db.query("delete from calendar_entries where id=$1", [id]);
    assert.equal(
      (await db.query("select * from calendar_reminders")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
test("anonymous/Friend cannot read or write the calendar; Owner/Wife can use it; forged body roles and malformed times fail", async () => {
  let calls = 0;
  const handle = createCalendarService({
    authenticate: async (h) =>
      h === "Bearer owner" || h === "Bearer wife"
        ? { calendarAllowed: true }
        : h
          ? { calendarAllowed: false }
          : null,
    getClient: () => {
      calls++;
      return { rpc: async () => ({ data: [] }) };
    },
  });
  const request = (token, method = "GET", body) =>
    new HttpRequest({
      method,
      url: "https://site.test/api/calendar?month=2026-10",
      headers: {
        Authorization: "Bearer platform",
        ...(token ? { "X-Portfolio-Authorization": `Bearer ${token}` } : {}),
        "Content-Type": "application/json",
      },
      ...(body ? { body: { string: JSON.stringify(body) } } : {}),
    });
  for (const token of [null, "friend", "unknown"])
    for (const method of ["GET", "POST", "PUT", "DELETE"])
      assert.equal(
        (await handle(request(token, method))).status,
        token ? 403 : 401,
      );
  assert.equal(calls, 0);
  for (const token of ["owner", "wife"])
    assert.equal((await handle(request(token))).status, 200);
  const { id: unused, ...valid } = entry;
  assert.equal(validateEntry(valid).member, "both");
  for (const bad of [
    { ...valid, endTime: "08:00" },
    { ...valid, day: "2026-02-30" },
    { ...valid, reminderAt: "2026-01-01T00:00:00.000Z" },
    { ...valid, roles: ["OwnerRole"] },
    { ...valid, kind: "task" },
  ])
    assert.throws(
      () => validateEntry(bad),
      (e) => e.status === 400,
    );
});
test("email worker authenticates its trigger, uses fixed recipients and idempotency, and marks retries without exposing provider errors", async () => {
  const env = {
    RESEND_API_KEY: "re_test",
    REMINDER_FROM: "calendar@notify.example.com",
    CALENDAR_OWNER_EMAIL: "owner@example.com",
    CALENDAR_WIFE_EMAIL: "wife@example.com",
    CALENDAR_REMINDER_SECRET: "s".repeat(64),
  };
  const jobs = [{ id, entry_id: id, entry_version: 1, recipient: "wife" }];
  let state = "sending",
    writes = 0,
    sends = 0;
  const client = {
    rpc: async () => ({ data: jobs }),
    from: (table) => ({
      select() {
        return this;
      },
      eq() {
        return this;
      },
      maybeSingle: async () => ({
        data: {
          ...entry,
          start_time: "09:00:00",
          end_time: "10:00:00",
          version: 1,
        },
      }),
      update(value) {
        state = value.status;
        writes++;
        return this;
      },
      then(resolve) {
        resolve({ error: null });
      },
    }),
  };
  let response = { ok: false, status: 429 };
  let sentOptions;
  const handler = createReminderService({
    env,
    getClient: () => client,
    send: async (url, options) => {
      sends++;
      sentOptions = options;
      return response;
    },
  });
  const req = (secret) =>
    new HttpRequest({
      method: "POST",
      url: "https://site.test/api/calendar-reminders",
      headers: { "X-Reminder-Secret": secret },
    });
  assert.equal((await handler(req("wrong"))).status, 403);
  assert.equal((await handler(req("é".repeat(64)))).status, 403);
  assert.equal(sends, 0);
  assert.equal((await handler(req(env.CALENDAR_REMINDER_SECRET))).status, 200);
  assert.equal(state, "pending");
  assert.deepEqual(JSON.parse(sentOptions.body).to, ["wife@example.com"]);
  assert.equal(sentOptions.headers["Idempotency-Key"], `calendar/${id}`);
  response = { ok: true, status: 200 };
  await handler(req(env.CALENDAR_REMINDER_SECRET));
  assert.equal(state, "sent");
  assert.equal(writes, 2);
});
