const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs"),
  path = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { HttpRequest } = require("@azure/functions");
const {
  createCalendarService,
  createReminderService,
  createSenderReadiness,
  validateEntry,
} = require("../src/calendar");
test("email controls follow verified sender status and fail closed on provider errors", async () => {
  const env = {
    RESEND_API_KEY: "re_test",
    REMINDER_FROM: "calendar@example.com",
    CALENDAR_OWNER_EMAIL: "owner@example.com",
    CALENDAR_WIFE_EMAIL: "wife@example.com",
    CALENDAR_REMINDER_SECRET: "s".repeat(64),
    RESEND_DOMAIN_ID: "aaaaaaaa-1111-4111-8111-111111111111",
  };
  let domain = { status: "pending", name: "example.com" };
  const ready = createSenderReadiness({
    env,
    cacheMs: 0,
    get: async () => ({ ok: true, json: async () => domain }),
  });
  assert.equal(await ready(), false);
  domain.status = "verified";
  assert.equal(await ready(), true);
  domain.name = "different.example.com";
  assert.equal(await ready(), false);
  const unavailable = createSenderReadiness({
    env,
    get: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await unavailable(), false);
});
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
test("minute scheduler only triggers due work with a private Vault secret", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema cron;create schema net;create schema vault;
      create table cron.jobs(name text primary key,schedule text,command text);
      create function cron.schedule(text,text,text) returns bigint language sql as $$
        insert into cron.jobs values($1,$2,$3) on conflict(name) do update set schedule=$2,command=$3 returning 1::bigint $$;
      create table net.http_request_queue(id bigint generated always as identity,url text,headers jsonb);
      create function net.http_post(url text,headers jsonb,body jsonb,timeout_milliseconds int) returns bigint language sql as $$
        insert into net.http_request_queue(url,headers) values($1,$2) returning id $$;
      create table vault.decrypted_secrets(name text,decrypted_secret text);`);
    await db.exec(
      fs.readFileSync(
        path.resolve(
          __dirname,
          "../../supabase/migrations/003_shared_calendar.sql",
        ),
        "utf8",
      ),
    );
    const migration = fs
      .readFileSync(
        path.resolve(
          __dirname,
          "../../supabase/migrations/004_calendar_schedule.sql",
        ),
        "utf8",
      )
      .replace(/^create extension.*$/gm, "");
    await db.exec(migration);
    await db.exec(migration);
    const trigger = async () =>
      (await db.query("select public.trigger_calendar_reminders() as id"))
        .rows[0].id;
    assert.equal(await trigger(), null);
    await db.query("select public.save_calendar($1::jsonb,null)", [
      JSON.stringify(entry),
    ]);
    await db.exec(
      "update calendar_reminders set due_at=now()-interval '1 minute'",
    );
    assert.equal(await trigger(), null);
    await db.exec(
      "insert into vault.decrypted_secrets values('calendar_reminder_trigger',repeat('test',16))",
    );
    assert.equal(await trigger(), 1);
    const request = (await db.query("select * from net.http_request_queue"))
      .rows[0];
    assert.equal(request.url, "https://mcnairscode.com/api/calendar-reminders");
    assert.equal(request.headers["X-Reminder-Secret"], "test".repeat(16));
    assert.deepEqual((await db.query("select * from cron.jobs")).rows, [
      {
        name: "calendar-reminders-every-minute",
        schedule: "* * * * *",
        command: "select public.trigger_calendar_reminders();",
      },
    ]);
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select public.trigger_calendar_reminders()"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from net.http_request_queue"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
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
