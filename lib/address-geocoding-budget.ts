import "server-only";

import { isIP } from "node:net";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const STATE_KEY = Symbol.for("beyond-invitation.address-geocoding-budget.v1");
type Budget = { started: number; count: number };
type BudgetState = {
  ips: Map<string, Budget>;
  minute: Budget;
  day: Budget;
};

export class AddressGeocodingBudgetError extends Error {
  readonly status = 429;
  readonly code = "GEOCODING_RATE_LIMITED";
  constructor() {
    super("Too many address lookups. Please try again later or select standard delivery.");
    this.name = "AddressGeocodingBudgetError";
  }
}

/** Shared by separate route bundles and hot reloads in the same server process. */
function getState(): BudgetState {
  const shared = globalThis as unknown as Record<symbol, BudgetState | undefined>;
  return shared[STATE_KEY] ??= {
    ips: new Map(),
    minute: { started: 0, count: 0 },
    day: { started: 0, count: 0 },
  };
}

/** Per-process cost guard for every public geocoding caller, not a distributed firewall. */
export function claimAddressGeocodingBudget(request: Request): void {
  const state = getState();
  const now = Date.now();
  if (now - state.minute.started >= MINUTE)
    state.minute = { started: now, count: 0 };
  if (now - state.day.started >= DAY)
    state.day = { started: now, count: 0 };
  for (const [key, value] of state.ips)
    if (now - value.started >= MINUTE) state.ips.delete(key);

  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim();
  const direct = request.headers.get("x-real-ip")?.trim();
  const ip = forwarded && forwarded.length <= 45 && isIP(forwarded)
    ? forwarded
    : direct && direct.length <= 45 && isIP(direct)
      ? direct
      : "unknown";
  const existing = state.ips.get(ip);
  const configuredDailyLimit = Number(process.env.GEOCODING_DAILY_LIMIT);
  const dailyLimit = Number.isSafeInteger(configuredDailyLimit) &&
    configuredDailyLimit >= 1 && configuredDailyLimit <= 100_000
    ? configuredDailyLimit : 1000;
  if (state.minute.count >= 60 || state.day.count >= dailyLimit ||
      (existing?.count ?? 0) >= 10 || (!existing && state.ips.size >= 200))
    throw new AddressGeocodingBudgetError();

  state.minute.count++;
  state.day.count++;
  state.ips.set(ip, {
    started: existing?.started ?? now,
    count: (existing?.count ?? 0) + 1,
  });
}
