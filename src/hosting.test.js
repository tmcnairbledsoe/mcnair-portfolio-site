import config from "../public/staticwebapp.config.json";

test("Azure serves only known app routes, leaving unknown addresses and assets as real 404s", () => {
  // Azure normalizes trailing slashes and rejects duplicate normalized routes.
  const normalized = config.routes.map(({ route }) => route.replace(/\/$/, ""));
  expect(new Set(normalized).size).toBe(normalized.length);
  for (const path of [
    "/",
    "/resume",
    "/projects",
    "/tools",
    "/drawing",
    "/focus",
    "/blog",
    "/journal",
    "/calendar",
  ]) {
    expect(config.routes.find((route) => route.route === path)?.rewrite).toBe(
      "/index.html",
    );
  }
  for (const path of [
    "/interests",
    "/interests/",
    "/recovery",
    "/unknown",
    "/assets/missing.js",
  ]) {
    expect(config.routes.some((route) => route.route === path)).toBe(false);
  }
  expect(config.navigationFallback.exclude).toContain("/*");
  expect(config.responseOverrides["404"]).toEqual({ rewrite: "/404.html" });
  expect(config.globalHeaders["Content-Security-Policy"]).toContain(
    "connect-src 'self' https://login.microsoftonline.com",
  );
  expect(config.globalHeaders["Content-Security-Policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(config.globalHeaders["X-Content-Type-Options"]).toBe("nosniff");
});

test("Entra CSP allowances are narrow and wedding policy stays isolated", () => {
  const csp = config.globalHeaders["Content-Security-Policy"];
  expect(csp).toContain("frame-src 'self' https://login.microsoftonline.com");
  expect(csp).toContain("script-src 'self'; style-src 'self'");
  expect(csp).toContain("form-action 'none'");
  expect(csp).not.toMatch(/unsafe-inline|https:\/\/\*/);
  for (const route of config.routes.filter(({ route }) =>
    route.startsWith("/weddingsite"),
  )) {
    expect(route.headers["Content-Security-Policy"]).toBe(
      "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'none'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'",
    );
  }
});

test("API runtime and pass-through keep API out of SPA rewrites", () => {
  expect(config.platform.apiRuntime).toBe("node:22");
  expect(
    config.routes.some((r) => r.route.startsWith("/api") && r.rewrite),
  ).toBe(false);
});
