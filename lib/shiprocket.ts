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

export interface ShiprocketGeoPoint {
  latitude: number;
  longitude: number;
}

export interface ShiprocketQuickRateInput {
  deliveryPincode: string;
  deliveryLocation: ShiprocketGeoPoint;
  weightKg: number;
  cod?: boolean;
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
  /** Exact delivery coordinates and method required by Shiprocket Hyperlocal. */
  latitude?: number;
  longitude?: number;
  shipping_method?: "HL";
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

/** Customer-safe fields from the read-only tracking endpoint. */
export interface ShiprocketTracking {
  available: boolean;
  status: string | null;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  estimatedDeliveryAt: string | null;
  deliveredAt: string | null;
  events: { date: string; status: string; location: string | null }[];
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
async function configuredPickupLocation() {
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
  return { location, summary: { id, name: pickupLocation, pincode } };
}

export async function getShiprocketPickupLocation(): Promise<ShiprocketPickupLocation> {
  return (await configuredPickupLocation()).summary;
}

function decimalNumber(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isGeoPoint(value: unknown): value is ShiprocketGeoPoint {
  const point = record(value);
  return !!point && typeof point.latitude === "number" && Number.isFinite(point.latitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    typeof point.longitude === "number" && Number.isFinite(point.longitude) &&
    point.longitude >= -180 && point.longitude <= 180;
}

/** Quick needs the saved pickup's exact coordinates; a pincode is not a location substitute. */
export async function getShiprocketQuickPickupLocation(): Promise<ShiprocketPickupLocation & ShiprocketGeoPoint> {
  const { location, summary } = await configuredPickupLocation();
  const point = { latitude: decimalNumber(location.lat), longitude: decimalNumber(location.long) };
  if (!isGeoPoint(point)) {
    throw new ShiprocketError("QUICK_PICKUP_LOCATION_MISSING",
      "Save valid latitude and longitude for the configured Shiprocket pickup location before checking Quick delivery.");
  }
  return { ...summary, ...point };
}

/** Documented read-only Quick/Hyperlocal quote. This never creates an order or assigns a rider. */
export async function getShiprocketQuickRates(input: ShiprocketQuickRateInput) {
  if (!validPincode(input?.deliveryPincode) || !isGeoPoint(input?.deliveryLocation) ||
      typeof input?.weightKg !== "number" || !Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg > 1000 ||
      (input.cod !== undefined && typeof input.cod !== "boolean")) {
    throw new ShiprocketError("INVALID_INPUT", "Provide a valid delivery pincode, exact delivery coordinates and shipment weight between 0 and 1,000 kg.");
  }
  const pickupLocation = await getShiprocketQuickPickupLocation();
  const deliveryLocation = { latitude: input.deliveryLocation.latitude, longitude: input.deliveryLocation.longitude };
  const cod = input.cod ?? false;
  const query = new URLSearchParams({
    pickup_postcode: pickupLocation.pincode,
    delivery_postcode: input.deliveryPincode,
    weight: String(input.weightKg),
    cod: cod ? "1" : "0",
    is_new_hyperlocal: "1",
    lat_from: String(pickupLocation.latitude),
    long_from: String(pickupLocation.longitude),
    lat_to: String(deliveryLocation.latitude),
    long_to: String(deliveryLocation.longitude),
  });
  const response = await authenticatedGet(`/courier/serviceability/?${query}`);
  if (response.status !== true || response.error || response.errors || !Array.isArray(response.data) ||
      response.data.length > 100 || (response.currency !== undefined && response.currency !== "INR")) throw invalidResponse();
  const couriers = response.data.map((value) => {
    const courier = record(value);
    const rate = decimalNumber(courier?.rates);
    const name = typeof courier?.courier_name === "string" ? courier.courier_name.trim() : "";
    if (rate === undefined || rate < 0 || rate > 21_474_836.47 || !name || name.length > 160 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw invalidResponse();
    }
    // Quick's documented response does not supply a courier ID or a pickup ETA.
    return { name, rate };
  }).sort((a, b) => a.rate - b.rate || a.name.localeCompare(b.name));
  return { pickupLocation, deliveryPincode: input.deliveryPincode, deliveryLocation, weightKg: input.weightKg,
    cod, currency: "INR" as const, couriers };
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
  if ((input.latitude !== undefined || input.longitude !== undefined) && !isGeoPoint(input))
    orderInputError("Provide both delivery latitude and longitude as valid numeric coordinates.");
  if (input.shipping_method !== undefined && (input.shipping_method !== "HL" || !isGeoPoint(input)))
    orderInputError("Hyperlocal shipments require the HL shipping method and exact delivery coordinates.");
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
  courierId?: number | null;
  awb?: string | null;
  courierName?: string | null;
  shippingMethod?: string | null;
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
  return {
    orderId, shipmentId: positiveId(shipment.id)!, merchantOrderId, total, deliveryPincode,
    ...(status ? { status } : {}),
    ...(Object.hasOwn(shipment, "courier_id") ? { courierId: positiveId(shipment.courier_id) ?? null } : {}),
    ...(Object.hasOwn(shipment, "awb") ? { awb: safeAwb(shipment.awb) } : {}),
    ...(Object.hasOwn(shipment, "courier") ? { courierName: trackingText(shipment.courier, 100) } : {}),
    ...(Object.hasOwn(order, "shipping_method") ? {
      shippingMethod: order.shipping_method === "HL" || order.shipping_method === "SR" ? order.shipping_method : null,
    } : {}),
  };
}

/** Reads the current account catalog; names never determine whether a courier is hyperlocal. */
export async function getShiprocketQuickCouriers(): Promise<Array<{ id: number; name: string }>> {
  const response = await authenticatedGet("/courier/courierListWithCounts");
  if (response.error || response.errors || !Array.isArray(response.courier_data) || response.courier_data.length > 5000)
    throw invalidResponse();
  const ids = new Set<number>();
  const couriers: Array<{ id: number; name: string }> = [];
  for (const value of response.courier_data) {
    const courier = record(value);
    if (!courier) throw invalidResponse();
    if (![true, 1, "1"].includes(courier.is_hyperlocal as boolean | number | string)) continue;
    const id = positiveId(courier.id);
    const name = typeof courier.name === "string" ? courier.name.trim() : "";
    if (!id || ids.has(id) || !name || name.length > 160 || /[\u0000-\u001f\u007f]/.test(String(courier.name)))
      throw invalidResponse();
    ids.add(id);
    couriers.push({ id, name });
  }
  return couriers.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
}

function safeAwb(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(value.trim())
    ? value.trim() : null;
}

function unknownQuickAssignment(httpStatus?: number): ShiprocketOrderError {
  return new ShiprocketOrderError(
    "QUICK_BOOKING_UNKNOWN",
    "Shiprocket may have accepted this Quick booking. Refresh its status or check Shiprocket before booking again.",
    "unknown", httpStatus,
  );
}

/** Sends one explicit Quick assignment. An accepted response does not confirm a rider or pickup. */
export async function assignShiprocketQuickCourier(shipmentId: number, courierId: number): Promise<{ accepted: true; awb: string | null }> {
  if (typeof shipmentId !== "number" || !positiveId(shipmentId) || typeof courierId !== "number" || !positiveId(courierId))
    orderInputError("Provide valid numeric shipment and Quick courier IDs.");
  let state: AuthState;
  let token: string;
  try {
    // Fetch on every attempt: no stale selection or standard-courier fallback can reach the write.
    const couriers = await getShiprocketQuickCouriers();
    if (!couriers.some((courier) => courier.id === courierId))
      throw new ShiprocketOrderError("QUICK_COURIER_UNAVAILABLE", "Select a current Shiprocket Quick courier before booking.", "rejected");
    state = getAuthState();
    token = await tokenFor(state);
  } catch (error) {
    if (error instanceof ShiprocketOrderError) throw error;
    if (error instanceof ShiprocketError)
      throw new ShiprocketOrderError(error.code, error.message, "rejected", error.httpStatus);
    throw new ShiprocketOrderError("QUICK_NOT_SUBMITTED", "The Quick booking could not be prepared.", "rejected");
  }

  let response: Response;
  let result: Record<string, unknown> | undefined;
  try {
    response = await fetch(`${API_BASE}/courier/assign/awb`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_id: shipmentId, courier_id: courierId }),
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    try { result = record(await response.json()); } catch { /* HTTP status can still prove a rejection. */ }
  } catch {
    throw unknownQuickAssignment();
  }
  // Do not retry a write, including a 401. A later independent attempt may authenticate again.
  if (response.status === 401 && state.token === token) {
    state.token = undefined;
    state.expiresAt = 0;
  }
  const providerStatus = numeric(result?.status_code) ?? numeric(result?.status);
  if (response.status === 408 || response.status === 409 || response.status >= 500 ||
      providerStatus === 408 || providerStatus === 409 || (providerStatus !== undefined && providerStatus >= 500))
    throw unknownQuickAssignment(response.status);
  const nested = record(result?.response);
  const data = record(nested?.data) ?? record(result?.data);
  if ((result?.response !== undefined && !nested) ||
      (nested?.data !== undefined && !record(nested.data)) ||
      (result?.data !== undefined && !record(result.data))) throw unknownQuickAssignment(response.status);
  // Every returned identifier must describe the shipment/courier requested. Never trust a mismatched AWB.
  for (const part of [result, nested, data]) {
    if (!part) continue;
    for (const [field, expected] of [["shipment_id", shipmentId], ["courier_id", courierId], ["courier_company_id", courierId]] as const) {
      if (part[field] !== undefined && positiveId(part[field]) !== expected)
        throw unknownQuickAssignment(response.status);
    }
  }
  const assignmentStatus = numeric(result?.awb_assign_status);
  const hasError = (value: unknown) => value !== undefined && value !== null && value !== false && value !== "" &&
    (!Array.isArray(value) || value.length > 0) && (!record(value) || Object.keys(record(value)!).length > 0);
  const explicitlyRejected = !response.ok || (providerStatus !== undefined && providerStatus >= 400) ||
    assignmentStatus === 0 || [result, nested, data].some((part) =>
      part?.success === false || part?.status === false || part?.status === 0 || part?.status === "0" || part?.status === "error" ||
      hasError(part?.error) || hasError(part?.errors));
  const awb = safeAwb(data?.awb_code ?? result?.awb_code);
  if (explicitlyRejected) {
    if (result?.success === true || assignmentStatus === 1 || hasError(data?.awb_code) || hasError(result?.awb_code))
      throw unknownQuickAssignment(response.status);
    const status = providerStatus !== undefined && providerStatus >= 400 ? providerStatus : response.status;
    throw new ShiprocketOrderError("QUICK_BOOKING_REJECTED", requestError(status).message, "rejected", status);
  }
  if (assignmentStatus === 1) {
    if (!data || positiveId(data.shipment_id) !== shipmentId || positiveId(data.courier_company_id ?? data.courier_id) !== courierId || !awb)
      throw unknownQuickAssignment(response.status);
    return { accepted: true, awb };
  }
  // Hyperlocal's documented success is asynchronous and contains no AWB. Readback confirms booking later.
  if (result?.success === true && result.awb_assign_status === undefined && !awb && data?.awb_code === undefined && result.awb_code === undefined)
    return { accepted: true, awb: null };
  throw unknownQuickAssignment(response.status);
}

function trackingText(value: unknown, limit = 160): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

/** Domestic carrier timestamps without an offset are interpreted in India time. */
function trackingDate(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 40) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour = "00", minute = "00", second = "00", fraction = "", zone = "+05:30"] = match;
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number(year) < 1970 || calendar.getUTCFullYear() !== Number(year) ||
      calendar.getUTCMonth() !== Number(month) - 1 || calendar.getUTCDate() !== Number(day) ||
      Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction}${zone}`);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function trackingLink(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 1000 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    const hosts = ["shiprocket.co", "www.shiprocket.co", "onlinetracker.shiprocket.co",
      "shiprocket.in", "www.shiprocket.in", "my.shiprocket.in"];
    return url.protocol === "https:" && !url.username && !url.password && !url.port && hosts.includes(url.hostname)
      ? url.href : null;
  } catch { return null; }
}

/** Only reads tracking; never assigns a courier, books a pickup or changes an order. */
export async function getShiprocketTracking(shipmentId: number, expectedOrderId: number): Promise<ShiprocketTracking> {
  if (typeof shipmentId !== "number" || !positiveId(shipmentId) ||
      typeof expectedOrderId !== "number" || !positiveId(expectedOrderId))
    throw new ShiprocketError("INVALID_INPUT", "Provide valid numeric shipment and order IDs.");
  const response = await authenticatedGet(`/courier/track/shipment/${shipmentId}`);
  const data = record(response.tracking_data);
  if (!data || response.error || response.errors || data.success === false ||
      (numeric(data.status_code) ?? 0) >= 400) throw invalidResponse();
  const trackStatus = numeric(data.track_status);
  const empty: ShiprocketTracking = {
    available: false, status: null, courierName: null, awb: null, trackingUrl: null,
    estimatedDeliveryAt: null, deliveredAt: null, events: [],
  };
  if (trackStatus === 0) {
    // The documented "no activities found" response uses an error string even
    // for shipments whose first carrier scan is still pending. Other errors fail closed.
    if ((data.error && (typeof data.error !== "string" || !/no (?:activities|activity|tracking)\b.*\bfound\b/i.test(data.error))) ||
        data.errors || (data.shipment_track !== undefined && (!Array.isArray(data.shipment_track) || data.shipment_track.length > 0)) ||
        (data.shipment_track_activities !== undefined && data.shipment_track_activities !== null &&
          (!Array.isArray(data.shipment_track_activities) || data.shipment_track_activities.length > 0))) throw invalidResponse();
    return empty;
  }
  if (trackStatus !== 1 || data.error || data.errors || !Array.isArray(data.shipment_track) || data.shipment_track.length !== 1)
    throw invalidResponse();
  const shipment = record(data.shipment_track[0]);
  // The tracking record's `id` is different from `shipment_id` in Shiprocket's API.
  if (!shipment || positiveId(shipment.shipment_id) !== shipmentId || positiveId(shipment.order_id) !== expectedOrderId)
    throw invalidResponse();
  if (data.shipment_track_activities !== undefined && data.shipment_track_activities !== null &&
      !Array.isArray(data.shipment_track_activities)) throw invalidResponse();
  const activities: unknown[] = Array.isArray(data.shipment_track_activities) ? data.shipment_track_activities : [];
  const events = activities.slice(0, 500).flatMap((activity) => {
    const event = record(activity);
    const date = trackingDate(event?.date);
    const status = trackingText(event?.activity);
    return date && status ? [{ date, status, location: trackingText(event?.location) }] : [];
  }).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const awb = typeof shipment.awb_code === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{1,99}$/.test(shipment.awb_code.trim())
    ? shipment.awb_code.trim() : null;
  return {
    available: true,
    status: trackingText(shipment.current_status, 100),
    courierName: trackingText(shipment.courier_name, 100) ?? trackingText(data.courier_name, 100),
    awb,
    trackingUrl: trackingLink(data.track_url),
    estimatedDeliveryAt: trackingDate(data.etd) ?? trackingDate(shipment.edd),
    deliveredAt: trackingDate(shipment.delivered_date),
    events,
  };
}
