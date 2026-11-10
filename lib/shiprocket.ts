import "server-only";

// Live Shiprocket API. Order creation is separate from courier/AWB/pickup booking.
const API_BASE = "https://apiv2.shiprocket.in/v1/external";
const TOKEN_LIFETIME_MS = 9 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;

export class ShiprocketError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus?: number,
  ) {
    super(message);
    this.name = "ShiprocketError";
  }
}

export interface ShiprocketPickupLocation {
  id: number;
  name: string;
  pincode: string;
}

export interface ShiprocketRateInput {
  deliveryPincode: string;
  weightKg: number;
  cod?: boolean;
  lengthCm?: number;
  breadthCm?: number;
  heightCm?: number;
}

export interface ShiprocketCourierRate {
  id: number;
  name: string;
  /** Shiprocket's estimated rate in INR, not a committed checkout charge. */
  rate: number;
  estimatedDeliveryDays: number | null;
}

export interface ShiprocketOrderItem {
  name: string;
  sku: string;
  units: number;
  /** Price per unit in rupees, inclusive of GST. */
  selling_price: number;
  discount?: number;
  tax?: number;
  hsn?: string | number;
}

/** Domestic custom-order payload; the caller supplies its stable merchant reference. */
export interface ShiprocketOrderPayload {
  order_id: string;
  order_date: string;
  pickup_location: string;
  channel_id?: number;
  billing_customer_name: string;
  billing_last_name?: string;
  billing_address: string;
  billing_address_2?: string;
  billing_city: string;
  billing_pincode: string;
  billing_state: string;
  billing_country: "India";
  billing_email: string;
  billing_phone: string;
  shipping_is_billing: boolean;
  shipping_customer_name?: string;
  shipping_last_name?: string;
  shipping_address?: string;
  shipping_address_2?: string;
  shipping_city?: string;
  shipping_pincode?: string;
  shipping_state?: string;
  shipping_country?: "India";
  shipping_email?: string;
  shipping_phone?: string;
  order_items: ShiprocketOrderItem[];
  payment_method: "Prepaid" | "COD";
  shipping_charges?: number;
  giftwrap_charges?: number;
  transaction_charges?: number;
  total_discount?: number;
  sub_total: number;
  length: number;
  breadth: number;
  height: number;
  weight: number;
}

export interface ShiprocketCreatedOrder {
  orderId: number;
  shipmentId: number;
  status?: string;
}

/** Unknown outcomes must be reconciled with Shiprocket before another submission. */
export class ShiprocketOrderError extends ShiprocketError {
  constructor(
    code: string,
    message: string,
    public readonly outcome: "rejected" | "unknown",
    httpStatus?: number,
  ) {
    super(code, message, httpStatus);
    this.name = "ShiprocketOrderError";
  }
}

interface AuthState {
  email: string;
  password: string;
  token?: string;
  expiresAt: number;
  pending?: Promise<string>;
}

let authState: AuthState | undefined;

function getConfiguration() {
  const email = process.env.SHIPROCKET_EMAIL?.trim();
  const password = process.env.SHIPROCKET_PASSWORD;
  const pickupLocation = process.env.SHIPROCKET_PICKUP_LOCATION?.trim();
  if (!email || !password?.trim() || !pickupLocation) {
    throw new ShiprocketError(
      "CONFIG_MISSING",
      "Set SHIPROCKET_EMAIL, SHIPROCKET_PASSWORD and SHIPROCKET_PICKUP_LOCATION in your server environment.",
    );
  }
  return { email, password, pickupLocation };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function numeric(value: unknown): number | undefined {
  if (
    typeof value !== "number" &&
    (typeof value !== "string" || !value.trim())
  ) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function invalidResponse(): ShiprocketError {
  return new ShiprocketError(
    "INVALID_RESPONSE",
    "Shiprocket returned an unexpected response.",
  );
}

function requestError(status: number): ShiprocketError {
  if (status === 401) {
    return new ShiprocketError(
      "AUTH_FAILED",
      "Shiprocket authentication failed. Check the API user's email and password.",
      status,
    );
  }
  if (status === 403) {
    return new ShiprocketError(
      "ACCESS_DENIED",
      "Shiprocket denied access. Check the API user's permissions and account verification in Shiprocket.",
      status,
    );
  }
  if (status === 429) {
    return new ShiprocketError(
      "RATE_LIMITED",
      "Shiprocket's request limit was reached. Try again later.",
      status,
    );
  }
  return new ShiprocketError(
    "REQUEST_FAILED",
    "Shiprocket could not complete the request. Check the account setup and try again.",
    status,
  );
}

async function request(
  path: string,
  options: RequestInit,
): Promise<Record<string, unknown>> {
  let response: Response;
  let body: unknown;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw requestError(response.status);
    body = await response.json();
  } catch (error) {
    if (error instanceof ShiprocketError) throw error;
    if (error instanceof SyntaxError) throw invalidResponse();
    // Never propagate fetch errors or provider bodies: they may contain secrets/PII.
    throw new ShiprocketError(
      "NETWORK_ERROR",
      "The Shiprocket request failed or timed out. Check the connection and try again.",
    );
  }

  const result = record(body);
  if (!result) throw invalidResponse();
  const providerStatus = numeric(result.status_code) ?? numeric(result.status);
  if (providerStatus !== undefined && providerStatus >= 400)
    throw requestError(providerStatus);
  if (
    result.status === false ||
    result.status === 0 ||
    result.status === "error" ||
    result.success === false
  ) {
    throw new ShiprocketError(
      "REQUEST_FAILED",
      "Shiprocket rejected the request. Check the account setup and API permissions.",
    );
  }
  return result;
}

async function tokenFor(state: AuthState): Promise<string> {
  if (state.token && Date.now() < state.expiresAt) return state.token;
  if (state.pending) return state.pending;
  state.pending = (async () => {
    const response = await request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: state.email, password: state.password }),
    });
    if (typeof response.token !== "string" || !response.token.trim())
      throw invalidResponse();
    state.token = response.token;
    state.expiresAt = Date.now() + TOKEN_LIFETIME_MS;
    return state.token;
  })();
  try {
    return await state.pending;
  } finally {
    state.pending = undefined;
  }
}

function getAuthState(): AuthState {
  const config = getConfiguration();
  if (
    !authState ||
    authState.email !== config.email ||
    authState.password !== config.password
  ) {
    authState = {
      email: config.email,
      password: config.password,
      expiresAt: 0,
    };
  }
  return authState;
}

async function authenticatedGet(
  path: string,
): Promise<Record<string, unknown>> {
  const state = getAuthState();
  const token = await tokenFor(state);
  const get = (bearer: string) =>
    request(path, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearer}`,
        Accept: "application/json",
      },
    });
  try {
    return await get(token);
  } catch (error) {
    if (!(error instanceof ShiprocketError) || error.httpStatus !== 401)
      throw error;
    // Another request may already have replaced the expired token.
    if (state.token === token) {
      state.token = undefined;
      state.expiresAt = 0;
    }
    return get(await tokenFor(state));
  }
}

function validPincode(value: unknown): value is string {
  return typeof value === "string" && /^[1-9]\d{5}$/.test(value);
}

/** Resolve the configured nickname exactly; never silently choose another warehouse. */
export async function getShiprocketPickupLocation(): Promise<ShiprocketPickupLocation> {
  const { pickupLocation } = getConfiguration();
  const response = await authenticatedGet("/settings/company/pickup");
  const addresses = record(response.data)?.shipping_address;
  if (!Array.isArray(addresses)) throw invalidResponse();
  const matches = addresses
    .map(record)
    .filter((item) => item?.pickup_location === pickupLocation);
  if (matches.length !== 1) {
    throw new ShiprocketError(
      "PICKUP_NOT_FOUND",
      "SHIPROCKET_PICKUP_LOCATION must exactly match one saved pickup location in Shiprocket.",
    );
  }
  const location = matches[0]!;
  const id = numeric(location.id);
  const pincode =
    typeof location.pin_code === "number" ||
    typeof location.pin_code === "string"
      ? String(location.pin_code)
      : "";
  if (!id || !Number.isInteger(id) || id < 0 || !validPincode(pincode))
    throw invalidResponse();
  return { id, name: pickupLocation, pincode };
}

/** Read-only estimate. Call with packed shipment weight (kg) and dimensions (cm). */
export async function getShiprocketRates(input: ShiprocketRateInput) {
  if (!validPincode(input?.deliveryPincode)) {
    throw new ShiprocketError(
      "INVALID_INPUT",
      "Enter a valid six-digit Indian delivery pincode.",
    );
  }
  if (
    typeof input.weightKg !== "number" ||
    !Number.isFinite(input.weightKg) ||
    input.weightKg <= 0
  ) {
    throw new ShiprocketError(
      "INVALID_INPUT",
      "Shipment weight must be a positive number in kilograms.",
    );
  }
  if (input.cod !== undefined && typeof input.cod !== "boolean") {
    throw new ShiprocketError(
      "INVALID_INPUT",
      "The COD option must be a boolean.",
    );
  }
  const dimensions = [input.lengthCm, input.breadthCm, input.heightCm];
  if (
    dimensions.some((value) => value !== undefined) &&
    !dimensions.every(
      (value) =>
        typeof value === "number" && Number.isFinite(value) && value > 0,
    )
  ) {
    throw new ShiprocketError(
      "INVALID_INPUT",
      "Provide all three packed dimensions as positive numbers in centimetres.",
    );
  }

  const pickupLocation = await getShiprocketPickupLocation();
  const cod = input.cod ?? false;
  const query = new URLSearchParams({
    pickup_postcode: pickupLocation.pincode,
    delivery_postcode: input.deliveryPincode,
    weight: String(input.weightKg),
    cod: cod ? "1" : "0",
  });
  if (input.lengthCm !== undefined) {
    query.set("length", String(input.lengthCm));
    query.set("breadth", String(input.breadthCm));
    query.set("height", String(input.heightCm));
  }
  const response = await authenticatedGet(`/courier/serviceability/?${query}`);
  const available = record(response.data)?.available_courier_companies;
  if (!Array.isArray(available)) throw invalidResponse();
  if (response.currency !== undefined && response.currency !== "INR")
    throw invalidResponse();
  const enabledCouriers = available.filter((value) => {
    const courier = record(value);
    const blocked = (flag: unknown) =>
      flag === true || flag === 1 || flag === "1";
    return !blocked(courier?.blocked) && !blocked(courier?.odablock);
  });
  const couriers: ShiprocketCourierRate[] = enabledCouriers.map((value) => {
    const courier = record(value);
    const id = numeric(courier?.courier_company_id);
    const rate = numeric(courier?.rate);
    const days = numeric(courier?.estimated_delivery_days);
    if (
      !id ||
      !Number.isInteger(id) ||
      id < 0 ||
      rate === undefined ||
      rate < 0 ||
      typeof courier?.courier_name !== "string" ||
      !courier.courier_name.trim()
    )
      throw invalidResponse();
    return {
      id,
      name: courier.courier_name,
      rate,
      estimatedDeliveryDays: days !== undefined && days >= 0 ? days : null,
    };
  });

  return {
    pickupLocation,
    deliveryPincode: input.deliveryPincode,
    weightKg: input.weightKg,
    cod,
    currency: "INR" as const,
    couriers: couriers.sort((a, b) => a.rate - b.rate || a.id - b.id),
  };
}

function positiveId(value: unknown): number | undefined {
  const id = numeric(value);
  return id !== undefined && Number.isSafeInteger(id) && id > 0 ? id : undefined;
}

function orderInputError(message: string): never {
  throw new ShiprocketOrderError("INVALID_INPUT", message, "rejected");
}

function validateOrderPayload(input: ShiprocketOrderPayload): void {
  if (!record(input)) orderInputError("Provide complete shipment order details.");
  const text = (value: unknown) => typeof value === "string" && !!value.trim();
  if (!text(input.order_id) || input.order_id.length > 50)
    orderInputError("Use a stable merchant order reference of at most 50 characters.");
  const date = typeof input.order_date === "string" ? input.order_date : "";
  const dateValue = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}(?:[ T](?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?)?$/.test(date) ||
    !Number.isFinite(dateValue.getTime()) ||
    dateValue.toISOString().slice(0, 10) !== date.slice(0, 10)
  ) orderInputError("Use a valid order date in YYYY-MM-DD format, with an optional time.");
  if (!text(input.pickup_location)) orderInputError("Select a saved pickup location.");
  if (input.channel_id !== undefined && !positiveId(input.channel_id))
    orderInputError("Use a valid Shiprocket channel ID.");
  for (const field of ["billing_customer_name", "billing_address", "billing_city", "billing_state"] as const) {
    if (!text(input[field])) orderInputError("Complete the billing name and address details.");
  }
  const email = (value: unknown) => typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const phone = (value: unknown) => typeof value === "string" && /^\d{10}$/.test(value);
  if (input.billing_country !== "India" || !validPincode(input.billing_pincode))
    orderInputError("Provide an Indian billing address with a valid six-digit pincode.");
  if (!email(input.billing_email) || !phone(input.billing_phone))
    orderInputError("Provide a valid billing email and ten-digit phone number.");
  if (typeof input.shipping_is_billing !== "boolean")
    orderInputError("Specify whether the shipping and billing addresses are the same.");
  if (!input.shipping_is_billing) {
    for (const field of ["shipping_customer_name", "shipping_address", "shipping_city", "shipping_state"] as const) {
      if (!text(input[field])) orderInputError("Complete the separate shipping name and address details.");
    }
    if (input.shipping_country !== "India" || !validPincode(input.shipping_pincode))
      orderInputError("Provide an Indian shipping address with a valid six-digit pincode.");
    if (!email(input.shipping_email) || !phone(input.shipping_phone))
      orderInputError("Provide a valid shipping email and ten-digit phone number.");
  }
  const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (!Array.isArray(input.order_items) || !input.order_items.length)
    orderInputError("Include at least one order item.");
  for (const item of input.order_items) {
    if (!record(item) || !text(item.name) || !text(item.sku) ||
        !Number.isSafeInteger(item.units) || item.units <= 0 || !amount(item.selling_price))
      orderInputError("Each order item needs a name, SKU, positive whole quantity and valid unit price.");
    if ((item.discount !== undefined && !amount(item.discount)) ||
        (item.tax !== undefined && (!amount(item.tax) || item.tax > 100)))
      orderInputError("Order-item discounts and tax must be valid nonnegative amounts.");
  }
  if (!["Prepaid", "COD"].includes(input.payment_method))
    orderInputError("Use Prepaid or COD as the payment method.");
  if (!amount(input.sub_total) || input.sub_total <= 0)
    orderInputError("Provide a positive order subtotal in rupees.");
  for (const field of ["shipping_charges", "giftwrap_charges", "transaction_charges", "total_discount"] as const) {
    if (input[field] !== undefined && !amount(input[field]))
      orderInputError("Order charges and discounts must be finite nonnegative rupee amounts.");
  }
  if (![input.length, input.breadth, input.height].every((value) => amount(value) && value > 0.5))
    orderInputError("All three packed dimensions must exceed 0.5 centimetres.");
  if (!amount(input.weight) || input.weight <= 0)
    orderInputError("Packed shipment weight must be a positive number in kilograms.");
}

function unknownOrderOutcome(httpStatus?: number, duplicate = false) {
  return new ShiprocketOrderError(
    duplicate ? "ORDER_DUPLICATE" : "ORDER_OUTCOME_UNKNOWN",
    duplicate
      ? "Shiprocket reports an existing merchant order reference. Reconcile the existing order before submitting again."
      : "Shiprocket may have created the order. Check and reconcile it in Shiprocket before submitting again.",
    "unknown",
    httpStatus,
  );
}

function safeOrderStatus(value: unknown): string | undefined {
  const statuses = new Set([
    "NEW", "INVOICED", "READY TO SHIP", "PICKUP SCHEDULED", "SHIPPED", "DELIVERED",
    "IN TRANSIT", "OUT FOR DELIVERY", "PENDING", "PICKUP QUEUE", "PICKED UP", "FULFILLED",
  ]);
  return typeof value === "string" && statuses.has(value.toUpperCase()) ? value.toUpperCase() : undefined;
}

/** Creates the order once. Never assigns an AWB, selects a courier, or requests pickup. */
export async function createShiprocketOrder(input: ShiprocketOrderPayload): Promise<ShiprocketCreatedOrder> {
  validateOrderPayload(input);
  let state: AuthState;
  let token: string;
  let body: string;
  try {
    if (input.pickup_location !== getConfiguration().pickupLocation)
      orderInputError("The shipment pickup must match SHIPROCKET_PICKUP_LOCATION.");
    // Serialize before any mutation so local failures cannot be mistaken for an unknown outcome.
    body = JSON.stringify(input);
    state = getAuthState();
    token = await tokenFor(state);
  } catch (error) {
    if (error instanceof ShiprocketOrderError) throw error;
    if (error instanceof ShiprocketError)
      throw new ShiprocketOrderError(error.code, error.message, "rejected", error.httpStatus);
    throw new ShiprocketOrderError("ORDER_NOT_SUBMITTED", "The order could not be prepared for Shiprocket.", "rejected");
  }

  let response: Response;
  let result: Record<string, unknown> | undefined;
  try {
    response = await fetch(`${API_BASE}/orders/create/adhoc`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    try { result = record(await response.json()); } catch { /* Status still determines explicit rejection below. */ }
  } catch {
    throw unknownOrderOutcome();
  }
  // Even authentication rejection is not retried here: each invocation sends at most one create request.
  if (response.status === 401 && state.token === token) {
    state.token = undefined;
    state.expiresAt = 0;
  }
  const providerStatus = result ? numeric(result.status_code) ?? numeric(result.status) : undefined;
  const diagnostic = JSON.stringify({ message: result?.message, error: result?.error, errors: result?.errors });
  const duplicate = /duplicate|already\s+(?:exists?|used|taken|created)|order[_\s-]*id.{0,100}(?:unique|exists|taken)/i.test(diagnostic);
  if (duplicate || response.status === 409 || providerStatus === 409)
    throw unknownOrderOutcome(response.status, true);
  if (response.status >= 500 || response.status === 408 || providerStatus === 408 || (providerStatus !== undefined && providerStatus >= 500))
    throw unknownOrderOutcome(response.status);
  const explicitlyRejected = !response.ok ||
    (providerStatus !== undefined && providerStatus >= 400) ||
    result?.success === false || result?.status === false || result?.status === 0 || result?.status === "error" ||
    (record(result?.errors) !== undefined && Object.keys(record(result?.errors)!).length > 0);
  if (explicitlyRejected) {
    // IDs alongside an error may mean that creation partly succeeded.
    if (positiveId(result?.order_id) || positiveId(result?.shipment_id))
      throw unknownOrderOutcome(response.status);
    const status = providerStatus !== undefined && providerStatus >= 400 ? providerStatus : response.status;
    const failure = requestError(status);
    throw new ShiprocketOrderError("ORDER_REJECTED", failure.message, "rejected", status);
  }
  const orderId = positiveId(result?.order_id);
  const shipmentId = positiveId(result?.shipment_id);
  if (!orderId || !shipmentId) throw unknownOrderOutcome(response.status);
  const status = safeOrderStatus(result?.status);
  return { orderId, shipmentId, ...(status ? { status } : {}) };
}

/** Read-only reconciliation by Shiprocket ID; callers must match the merchant reference, total and pincode. */
export async function getShiprocketOrder(orderId: number): Promise<ShiprocketCreatedOrder & {
  merchantOrderId: string;
  total: number;
  deliveryPincode: string;
}> {
  if (!positiveId(orderId) || typeof orderId !== "number")
    throw new ShiprocketError("INVALID_INPUT", "Provide a positive numeric Shiprocket order ID.");
  const response = await authenticatedGet(`/orders/show/${orderId}`);
  const order = record(response.data);
  if (!order || positiveId(order.id) !== orderId) throw invalidResponse();
  const shipments = Array.isArray(order.shipments) ? order.shipments : [order.shipments];
  const matches = shipments.map(record).filter((shipment) => positiveId(shipment?.order_id) === orderId);
  if (matches.length !== 1 || !positiveId(matches[0]?.id)) throw invalidResponse();
  const shipment = matches[0]!;
  const cancelled = (value: unknown) => typeof value === "string" && /cancel/i.test(value);
  if ([5, 18, 27, 29, 54].includes(numeric(order.status_code) ?? -1) ||
      [8, 16, 45].includes(numeric(shipment.status_code) ?? numeric(shipment.status) ?? -1) ||
      cancelled(order.status) || cancelled(shipment.status))
    throw new ShiprocketError("ORDER_CANCELLED", "This Shiprocket order or shipment is cancelled or pending cancellation and cannot be linked.");
  const merchantOrderId = order.channel_order_id;
  const total = numeric(order.total);
  const deliveryPincode = String(order.delivery_code || order.customer_pincode || "");
  if (typeof merchantOrderId !== "string" || !merchantOrderId.trim() || merchantOrderId.length > 50 ||
      total === undefined || total <= 0 || !validPincode(deliveryPincode) ||
      (order.currency !== undefined && order.currency !== "INR")) throw invalidResponse();
  const status = safeOrderStatus(order.status);
  return { orderId, shipmentId: positiveId(shipment.id)!, merchantOrderId, total, deliveryPincode, ...(status ? { status } : {}) };
}
