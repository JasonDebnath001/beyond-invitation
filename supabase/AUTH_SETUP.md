# Supabase authentication setup

The application supports Google OAuth and email/password accounts. Registration asks only for an email address and password. Customers can optionally add their name in My Account. Phone authentication and SMS flows have been removed; checkout still collects a contact phone number for orders.

## Provider settings

The public Auth settings returned `google: true`, `email: true`, `mailer_autoconfirm: false` and `disable_signup: false` during this update on 2026-09-16. Email and Google login are enabled. Email confirmation is currently required. Administrative dashboard access is not available in this workspace.

### Email and password

1. Under **Supabase > Authentication > Sign In / Providers**, keep **Email** enabled.
2. For immediate registration and sign-in with no confirmation step, turn **Confirm email** OFF and save. The public `/auth/v1/settings` endpoint will then return `mailer_autoconfirm: true`. The app redirects as soon as Supabase returns a session.
3. If **Confirm email** stays ON, registration shows a check-your-inbox message and waits for the email link before the customer can sign in. The app supports this setting too.
4. Use an eight-character minimum password policy, matching the form. Passwords are stored and validated by Supabase Auth.

Phone provider settings no longer affect registration or sign-in. No SMS provider, synthetic email address, service-role key or database migration is needed. Existing phone-only accounts are not automatically converted into email accounts; any existing identity migration must use the customer's actual email address through an authorized administrative process.

See [Supabase's email/password guide](https://supabase.com/docs/guides/auth/passwords#with-email).

### Email delivery and password recovery

`/forgot-password` requests a reset link using `resetPasswordForEmail`. It shows a neutral response without revealing whether an account exists. The email link establishes a session through `/auth/callback`, then opens `/account` where the customer can set a new password. The public recovery form never updates passwords.

Confirmation emails and password reset links require email delivery. Supabase's default email service only sends to project team addresses and has a low sending limit. Configure custom SMTP in Supabase to deliver these messages to customers. Disabling Confirm email removes the signup email requirement; it does not remove the delivery requirement for password-reset emails. See [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

The default email templates using `{{ .ConfirmationURL }}` work with the existing PKCE callback when the link is opened in the browser that requested it. For links that also work in a different browser or device, configure these links in **Authentication > Email Templates**:

Confirm signup:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=email">Confirm your email</a>
```

Reset password:

```html
<a href="{{ .RedirectTo }}&amp;token_hash={{ .TokenHash }}&amp;type=recovery">Reset your password</a>
```

These templates use the callback URL supplied by this application's forms, which always includes a `?next=...` query. The server verifies the email token before issuing a session. Only email confirmation and recovery types are accepted; unsupported or expired links return a retryable sign-in error. See [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates).

### Google

1. Create a **Web application** OAuth client in Google Cloud / Google Auth Platform.
2. Add the website origins: `http://localhost:3000` for development and `https://www.beyondinvitation.co.in` for production.
3. Set the Google **Authorized redirect URI** to the callback shown in Supabase's Google provider panel. For this project it is `https://ldjcivtrbmxmkemjqqdi.supabase.co/auth/v1/callback`.
4. In **Supabase > Authentication > Sign In / Providers > Google**, enable Google and enter the Google Client ID and Client Secret. Keep the secret in Supabase; do not put it in browser code or a `NEXT_PUBLIC_` variable.
5. If the Google consent screen is in testing mode, add the accounts used for testing as test users.

The Google redirect goes to Supabase. The application's separate callback is `/auth/callback`, where the one-time code is exchanged for a session. Google users can set a password in My Account to also sign in with their email address. See [Supabase's Google setup](https://supabase.com/docs/guides/auth/social-login/auth-google).

### Redirect URL settings

Under **Authentication > URL Configuration**, set the production Site URL to `https://www.beyondinvitation.co.in` and add these redirect URLs:

```text
http://localhost:3000/auth/callback**
https://www.beyondinvitation.co.in/auth/callback**
```

The trailing pattern permits the callback's `?next=...` query. Add any preview origin explicitly. The application validates `next` to keep navigation on the website; external redirects and authentication loops are rejected.

## Environment

The existing public credentials are sufficient:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ldjcivtrbmxmkemjqqdi.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-existing-public-anon-or-publishable-key
```

Supabase Auth stores credentials in its managed Auth schema. Optional profile names are stored in `user_metadata.full_name`; metadata is display information, never authorization data.

## Application flow

- `/sign-in`: Google or email/password sign-in.
- `/sign-up`: email/password registration; immediate sign-in when Confirm email is OFF, or a check-your-inbox message when it is ON.
- `/forgot-password`: request a password-reset email.
- `/auth/callback`: exchange a PKCE code or verify a supported email token, then redirect to a same-site destination without caching credentials.
- `/account`: verified server-side session required; display email, optionally edit name, set/change password or sign out.
- Header controls update when the session changes; checkout prefills available profile details.
- Browsing, wishlist and guest checkout remain accessible. Guest wishlists stay on this device; signed-in wishlists sync through Supabase after applying [WISHLIST_SETUP.md](WISHLIST_SETUP.md).
- Order-history access and reseller self-service remain unavailable; they have not been connected to the new identities.

Auth uses `@supabase/ssr` cookie clients and request-scoped server clients. Middleware refreshes sessions, preserves refreshed cookies on referral redirects and prevents caching responses containing refreshed credentials. Account access uses `getUser()` rather than trusting a cookie's user object. The cached public Supabase catalogue client remains independent.

## Verification

Automated tests cover email normalization, password validation, safe redirects, Google PKCE callbacks, email token confirmation/recovery, session-cookie handling, account authorization, registration with confirmation enabled or disabled, email sign-in, recovery requests, profile/password updates and sign-out. The forms are checked for the absence of phone inputs and SMS calls. Existing catalogue, wishlist and payment tests remain in place.

Validation on 2026-09-16: all 35 tests, TypeScript and the production build passed. Lint passed with existing image warnings. Local HTTP checks confirmed email-only credential forms on sign-in/sign-up, an email-only recovery request form, protected account access and rejection of unsupported callback token types. The development server was restored on port 3000.

Live account creation and email delivery have not been exercised during this change. After choosing the confirmation setting and configuring any required email delivery, test registration, sign-in, sign-out and reset links with an email address you control. Google sign-in was previously confirmed working by the site owner.
