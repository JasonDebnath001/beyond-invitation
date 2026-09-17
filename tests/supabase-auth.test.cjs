const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { NextResponse, NextRequest } = require("next/server");

function load(file, imports = {}, globals = {}) {
  const source = ts.transpileModule(readFileSync(path.join(__dirname, "..", file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, URL, Headers, Error, console, process: { env: {} },
    require(name) { if (Object.hasOwn(imports, name)) return imports[name]; throw new Error(`Unexpected dependency: ${name}`); },
    ...globals,
  });
  return exports;
}
const plain = (value) => JSON.parse(JSON.stringify(value));
const auth = load("lib/auth.ts");

test("login redirects reject external, encoded, malformed and authentication-loop targets", () => {
  for (const value of [null, "https://evil.test", "//evil.test", "/\\evil.test", "/%2f%2fevil.test", "/%5cevil.test", "/%0a/evil.test", "/%", "/auth/callback", "/sign-in", "/sign-up"]) {
    assert.equal(auth.safeAuthRedirect(value), "/account", value);
  }
  assert.equal(auth.safeAuthRedirect("/checkout?from=cart"), "/checkout?from=cart");
  assert.equal(auth.safeAuthRedirect("/products/313082"), "/products/313082");
});

test("email normalization and password validation reject invalid credentials", () => {
  assert.equal(auth.normalizeAuthEmail("  Person+shop@Example.COM  "), "person+shop@example.com");
  for (const value of ["", "9876543210", "invalid", "a@@example.com", "a b@example.com", "a@example", "a@", "a".repeat(250) + "@example.com"]) {
    assert.throws(() => auth.normalizeAuthEmail(value), /valid email address/);
  }
  assert.throws(() => auth.validateAuthPassword("short"));
  assert.throws(() => auth.validateAuthPassword("a".repeat(129)));
  assert.doesNotThrow(() => auth.validateAuthPassword("a-long-password"));
});

test("OAuth callback exchanges the code, confines the redirect and never exposes errors or codes", async () => {
  let calls = [];
  let fail = false;
  const route = load("app/auth/callback/route.ts", {
    "next/server": { NextResponse }, "@/lib/auth": auth,
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => ({ auth: {
      exchangeCodeForSession: async (code) => { calls.push(code); return { error: fail ? new Error("sensitive callback detail") : null }; },
    } }) },
  });
  let response = await route.GET(new Request("https://shop.test/auth/callback?code=test-code&next=%2Fcheckout"));
  assert.equal(response.headers.get("location"), "https://shop.test/checkout");
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.deepEqual(calls, ["test-code"]);
  response = await route.GET(new Request("https://shop.test/auth/callback?code=test-code&next=%2F%2Fevil.test"));
  assert.equal(response.headers.get("location"), "https://shop.test/account");
  fail = true;
  response = await route.GET(new Request("https://shop.test/auth/callback?code=secret-code"));
  assert.match(response.headers.get("location"), /sign-in\?error=callback/);
  assert.ok(!response.headers.get("location").includes("secret-code"));
  const before = calls.length;
  await route.GET(new Request("https://shop.test/auth/callback?error=access_denied&code=unused"));
  assert.equal(calls.length, before);
});

test("session refresh forwards cookies to the request and prevents caching refreshed tokens", async () => {
  let verified = 0;
  const { refreshAuthSession } = load("lib/supabase/session.ts", {
    "next/server": { NextResponse }, "./auth-config": { getSupabaseAuthConfig: () => ({ url: "https://project.test", key: "public-key" }) },
    "@supabase/ssr": { createServerClient: (_url, _key, options) => ({ auth: {
      getUser: async () => {
        verified++;
        options.cookies.setAll([{ name: "sb-test-auth-token", value: "refreshed", options: { path: "/", sameSite: "lax" } }], { "Cache-Control": "private, no-store", Expires: "0" });
        return { data: { user: { id: "verified-user" } }, error: null };
      },
    } }) },
  });
  const request = new NextRequest("http://localhost/account");
  const response = await refreshAuthSession(request);
  assert.equal(verified, 1);
  assert.equal(request.cookies.get("sb-test-auth-token").value, "refreshed");
  assert.equal(response.cookies.get("sb-test-auth-token").value, "refreshed");
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.equal(response.headers.get("expires"), "0");
});

test("referral redirects preserve refreshed auth cookies and no-store headers", async () => {
  const { middleware } = load("middleware.ts", {
    "next/server": { NextResponse },
    "@/lib/supabase/session": { refreshAuthSession: async () => {
      const response = NextResponse.next();
      response.cookies.set("sb-session", "refreshed");
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } },
  });
  const response = await middleware(new NextRequest("https://shop.test/catalog?via=abcd1234"));
  assert.equal(response.cookies.get("sb-session").value, "refreshed");
  assert.equal(response.cookies.get("bi_pref").value, "ABCD1234");
  assert.match(response.headers.get("cache-control"), /no-store/);
});

test("server account page rejects unverified sessions instead of trusting cookie user data", async () => {
  const React = require("react");
  let verifiedUser = null;
  const page = load("app/account/page.tsx", {
    "react/jsx-runtime": require("react/jsx-runtime"), "next/link": () => null,
    "next/navigation": { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    "lucide-react": { LifeBuoy: () => null, ArrowUpRight: () => null },
    "@/lib/account": {
      displayName: () => "Test User", initials: () => "TU", hasEmailIdentity: () => true,
      fetchRecentWebsiteOrders: async () => [], fetchSavedProducts: async () => [],
      fetchAccountCounts: async () => ({ paidOrders: 0, savedDesigns: 0 }),
    },
    ...Object.fromEntries(["AccountMotion", "AccountShell", "AccountHeader", "AccountStats", "AccountOrders", "AccountSaved", "ProfileForm", "PasswordForm", "SignOutButtons"].map((name) => [`@/components/account/${name}`, () => null])),
    "@/components/account/AccountUI": { cardClass: "", linkClass: "", secondaryClass: "", SectionHeading: () => null },
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: verifiedUser }, error: null }) } }) },
  });
  await assert.rejects(page.default(), /redirect:\/sign-in/);
  verifiedUser = { id: "user", email: "test@example.com", created_at: "2026-09-01T00:00:00Z", user_metadata: { full_name: "Test User" } };
  assert.ok(React.isValidElement(await page.default()));
});

test("email confirmation and recovery links verify tokens and reject expired or unsupported links", async () => {
  const calls = [];
  let expired = false;
  const route = load("app/auth/callback/route.ts", {
    "next/server": { NextResponse }, "@/lib/auth": auth,
    "@/lib/supabase/auth-server": { getSupabaseAuthServerClient: async () => ({ auth: {
      verifyOtp: async (args) => { calls.push(plain(args)); return { error: expired ? new Error("expired token detail") : null }; },
      exchangeCodeForSession: async () => { throw new Error("must not exchange unsupported email link"); },
    } }) },
  });
  for (const type of ["email", "recovery"]) {
    const response = await route.GET(new Request(`https://shop.test/auth/callback?token_hash=test-token&type=${type}&next=%2Faccount`));
    assert.deepEqual(calls.at(-1), { token_hash: "test-token", type });
    assert.equal(response.headers.get("location"), "https://shop.test/account");
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  }
  const external = await route.GET(new Request("https://shop.test/auth/callback?token_hash=test-token&type=email&next=%2F%2Fevil.test"));
  assert.equal(external.headers.get("location"), "https://shop.test/account");
  for (const query of ["token_hash=secret&type=sms&code=unused", "token_hash=secret", "type=recovery", "token_hash=secret&type=email&error=expired"]) {
    const before = calls.length;
    const response = await route.GET(new Request(`https://shop.test/auth/callback?${query}`));
    assert.match(response.headers.get("location"), /sign-in\?error=callback/);
    assert.ok(!response.headers.get("location").includes("secret"));
    assert.equal(calls.length, before);
  }
  expired = true;
  const response = await route.GET(new Request("https://shop.test/auth/callback?token_hash=secret&type=recovery"));
  assert.equal(response.headers.get("location"), "https://shop.test/sign-in?error=callback&next=%2Faccount");
});

test("email forms register, sign in, recover passwords and update profiles without phone authentication", async () => {
  const { JSDOM } = require("jsdom");
  const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: "http://localhost:3000" });
  global.window = dom.window; global.document = dom.window.document; global.IS_REACT_ACT_ENVIRONMENT = true;
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { act } = React;
  const calls = [];
  const destinations = [];
  const session = { user: { id: "user" } };
  let signupResult = { data: { session }, error: null };
  let loginResult = { data: { session }, error: null };
  let recoveryError = null;
  const forbiddenSms = async () => { calls.push(["sms"]); throw new Error("SMS must never be requested"); };
  const client = { auth: {
    signUp: async (args) => { calls.push(["signup", plain(args)]); return signupResult; },
    signInWithPassword: async (args) => { calls.push(["password", plain(args)]); return loginResult; },
    signInWithOAuth: async (args) => { calls.push(["google", plain(args)]); return { error: null }; },
    resetPasswordForEmail: async (email, options) => { calls.push(["recovery", email, plain(options)]); return { error: recoveryError }; },
    verifyOtp: forbiddenSms, resend: forbiddenSms, signInWithOtp: forbiddenSms,
    updateUser: async (args) => { calls.push(["update", plain(args)]); return { error: null }; },
    signOut: async (args) => { calls.push(["signout", plain(args)]); return { error: null }; },
  } };
  const globals = { window: dom.window, fetch: async () => ({ ok: true, json: async () => ({ external: { google: true, phone: false } }) }) };
  const imports = {
    react: React, "react/jsx-runtime": require("react/jsx-runtime"), "@/lib/auth": auth,
    "next/link": ({ children, ...props }) => React.createElement("a", props, children),
    "next/navigation": { useRouter: () => ({ replace: (url) => destinations.push(url), refresh() {} }) },
    "@/lib/supabase/client": { getSupabaseBrowserClient: () => client },
    "@/lib/supabase/auth-config": { getSupabaseAuthConfig: () => ({ url: "https://project.test", key: "public-key" }) },
    "lucide-react": { Mail: () => null, ShieldCheck: () => null, LogOut: () => null },
    "./AccountUI": { inputClass: "", labelClass: "", primaryClass: "", secondaryClass: "", focusClass: "" },
  };
  const Form = load("components/AuthForm.tsx", imports, globals).default;
  const Profile = load("components/account/ProfileForm.tsx", imports, globals).default;
  const Password = load("components/account/PasswordForm.tsx", imports, globals).default;
  const SignOut = load("components/account/SignOutButtons.tsx", imports, globals).default;
  const Reset = load("components/PasswordResetForm.tsx", imports, globals).default;
  let root;
  const mount = async (Component, props = {}) => {
    if (root) await act(async () => root.unmount());
    root = createRoot(document.getElementById("root"));
    await act(async () => root.render(React.createElement(Component, props)));
    assert.equal(document.querySelector('input[type="tel"], input[autocomplete="one-time-code"]'), null);
  };
  const mountForm = (mode) => mount(Form, { mode, next: "/checkout" });
  const set = async (selector, value) => {
    const element = document.querySelector(selector);
    assert.ok(element, selector);
    await act(async () => {
      Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(element, value);
      element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
    });
  };
  const submit = async (selector = "form") => act(async () => document.querySelector(selector).dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })));
  const enterCredentials = async () => {
    await set('[name="email"]', "  Test@Example.COM  ");
    await set('[name="password"]', "test-password-123");
  };
  try {
    await mountForm("sign-up");
    assert.equal(document.querySelectorAll("input").length, 2);
    await enterCredentials(); await submit();
    assert.deepEqual(calls.at(-1), ["signup", { email: "test@example.com", password: "test-password-123", options: { emailRedirectTo: "http://localhost:3000/auth/callback?next=%2Fcheckout" } }]);
    assert.deepEqual(destinations, ["/checkout"]);
    assert.equal(document.querySelector('[name="password"]').value, "");

    signupResult = { data: { session: null }, error: null };
    await mountForm("sign-up"); await enterCredentials(); await submit();
    assert.equal(destinations.length, 1);
    assert.match(document.querySelector('[role="status"]').textContent, /Check your inbox/);
    assert.equal(document.querySelector('[role="alert"]'), null);
    assert.equal(document.querySelector('[name="password"]').value, "");
    signupResult = { data: { session: null }, error: { code: "user_already_exists" } };
    await mountForm("sign-up"); await enterCredentials(); await submit();
    assert.equal(destinations.length, 1);
    assert.match(document.querySelector('[role="alert"]').textContent, /Try signing in/);

    await mountForm("sign-in"); await enterCredentials(); await submit();
    assert.deepEqual(calls.at(-1), ["password", { email: "test@example.com", password: "test-password-123" }]);
    assert.equal(destinations.length, 2);
    for (const [error, message] of [
      [{ code: "invalid_credentials" }, /email address or password is incorrect/],
      [{ code: "email_not_confirmed" }, /confirm your email/],
      [null, /could not be completed/],
    ]) {
      loginResult = { data: { session: null }, error };
      await mountForm("sign-in"); await enterCredentials(); await submit();
      assert.equal(destinations.length, 2);
      assert.match(document.querySelector('[role="alert"]').textContent, message);
    }
    await mountForm("sign-in"); await enterCredentials();
    await set('[name="email"]', "9876543210");
    const beforeInvalid = calls.length; await submit();
    assert.equal(calls.length, beforeInvalid);
    assert.match(document.querySelector('[role="alert"]').textContent, /valid email address/);

    await mountForm("sign-in");
    await act(async () => [...document.querySelectorAll("button")].find((button) => button.textContent.includes("Continue with Google")).click());
    assert.deepEqual(calls.at(-1), ["google", { provider: "google", options: { redirectTo: "http://localhost:3000/auth/callback?next=%2Fcheckout" } }]);

    // Recovery requests a link; it never changes a password on this public form.
    await mount(Reset);
    assert.equal(document.querySelector('input[type="password"]'), null);
    const updatesBeforeRecovery = calls.filter(([name]) => name === "update").length;
    await set('[name="email"]', "Test@Example.COM"); await submit();
    assert.deepEqual(calls.at(-1), ["recovery", "test@example.com", { redirectTo: "http://localhost:3000/auth/callback?next=%2Faccount" }]);
    assert.match(document.querySelector('[role="status"]').textContent, /If an account exists/);
    const afterRecovery = calls.length; await submit();
    assert.equal(calls.length, afterRecovery);
    assert.equal(calls.filter(([name]) => name === "update").length, updatesBeforeRecovery);
    recoveryError = { code: "over_email_send_rate_limit" };
    await mount(Reset); await set('[name="email"]', "test@example.com"); await submit();
    assert.match(document.querySelector('[role="alert"]').textContent, /wait a few minutes/);
    assert.equal(document.querySelector('[role="status"]'), null);

    // Profile name is optional, and password updates require the protected account page.
    await mount(Profile, { profile: { name: "", email: "test@example.com" }, providers: ["Email"] });
    assert.equal(document.querySelector('input[type="email"]').value, "test@example.com");
    assert.equal(document.querySelector('input[type="email"]').readOnly, true);
    await set('input[autocomplete="name"]', "  Test Person  "); await submit('[data-testid="profile-form"]');
    assert.deepEqual(calls.at(-1), ["update", { data: { full_name: "Test Person" } }]);
    await mount(Password);
    await set('[name="password"]', "new-test-password");
    await set('[name="confirmPassword"]', "different-password");
    const beforeMismatch = calls.length; await submit('[data-testid="password-form"]');
    assert.equal(calls.length, beforeMismatch);
    assert.match(document.querySelector('[role="alert"]').textContent, /do not match/);
    await set('[name="confirmPassword"]', "new-test-password");
    await submit('[data-testid="password-form"]');
    assert.deepEqual(calls.at(-1), ["update", { password: "new-test-password" }]);
    assert.match(document.querySelector('[role="status"]').textContent, /password has been updated/);
    await mount(SignOut);
    assert.equal(document.querySelector('[data-testid="sign-out"]').textContent, "Sign out");
    await act(async () => document.querySelector('[data-testid="sign-out"]').click());
    assert.deepEqual(calls.at(-1), ["signout", { scope: "local" }]);
    assert.equal(destinations.at(-1), "/");
    await act(async () => document.querySelector('[data-testid="sign-out-all"]').click());
    assert.deepEqual(calls.at(-1), ["signout", { scope: "global" }]);
    assert.equal(destinations.at(-1), "/");
    assert.equal(calls.some(([name]) => name === "sms"), false);
    assert.equal(calls.some(([, args]) => args && typeof args === "object" && "phone" in args), false);
  } finally {
    if (root) await act(async () => root.unmount());
    dom.window.close(); delete global.window; delete global.document; delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
