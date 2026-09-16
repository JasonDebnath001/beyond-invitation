/** Keep post-login navigation on this website, including encoded inputs. */
export function safeAuthRedirect(value?: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//"))
    return "/account";
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.startsWith("//") || /[\\\u0000-\u0020]/.test(decoded))
      return "/account";
    const url = new URL(value, "https://storefront.invalid");
    if (
      url.origin !== "https://storefront.invalid" ||
      /^\/(?:auth|sign-in|sign-up)(?:\/|$)/.test(url.pathname)
    )
      return "/account";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/account";
  }
}

export function normalizeAuthEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address.");
  }
  return email;
}

export function validateAuthPassword(password: string) {
  if (password.length < 8)
    throw new Error("Use a password with at least 8 characters.");
  if (password.length > 128)
    throw new Error("Use a password with no more than 128 characters.");
}

export function authErrorMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "";
  const messages: Record<string, string> = {
    invalid_credentials: "The email address or password is incorrect.",
    email_not_confirmed: "Please confirm your email address using the link in your inbox before signing in.",
    email_address_invalid: "Enter a valid email address.",
    email_address_not_authorized: "We could not send an email to this address. Please contact us for help.",
    over_email_send_rate_limit: "Please wait a few minutes before requesting another email.",
    over_request_rate_limit:
      "Too many attempts. Please wait a moment and try again.",
    email_provider_disabled:
      "Email sign-in is temporarily unavailable. Please try again later.",
    provider_disabled:
      "This sign-in option is temporarily unavailable. Please try again later.",
    weak_password:
      "Choose a stronger password with letters, numbers and symbols.",
    user_already_exists:
      "An account already uses these details. Try signing in instead.",
    email_exists: "This email address is already linked to an account.",
    signup_disabled:
      "New accounts are temporarily unavailable. Please try again later.",
    same_password: "Choose a different password from your current password.",
    reauthentication_needed:
      "Please sign in again before changing your password.",
  };
  if (messages[code]) return messages[code];
  if (code) return "We could not complete that request. Please try again.";
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}
