import config from "../public/staticwebapp.config.json";

test("Azure serves only known app routes, leaving unknown addresses and assets as real 404s", () => {
  // Azure normalizes trailing slashes and rejects duplicate normalized routes.
  const normalized = config.routes.map(({ route }) => route.replace(/\/$/, ""));
  expect(new Set(normalized).size).toBe(normalized.length);
  for (const path of [
    "/",
    "/resume",
    "/projects",
    "/interests",
    "/tools",
    "/drawing",
    "/focus",
  ]) {
    expect(config.routes.find((route) => route.route === path)?.rewrite).toBe(
      "/index.html",
    );
  }
  for (const path of [
    "/journal",
    "/calendar",
    "/recovery",
    "/unknown",
    "/assets/missing.js",
  ]) {
    expect(config.routes.some((route) => route.route === path)).toBe(false);
  }
  expect(config.navigationFallback.exclude).toContain("/*");
  expect(config.responseOverrides["404"]).toEqual({ rewrite: "/404.html" });
  expect(config.globalHeaders["Content-Security-Policy"]).toContain(
    "connect-src 'none'",
  );
  expect(config.globalHeaders["Content-Security-Policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(config.globalHeaders["X-Content-Type-Options"]).toBe("nosniff");
});
