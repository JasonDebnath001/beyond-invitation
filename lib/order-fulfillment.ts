import "server-only";

import { randomUUID } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpay, getRazorpayPaymentContext } from "@/lib/razorpay";
import {
  createShiprocketOrder,
  getShiprocketOrder,
  getShiprocketPickupLocation,
  getShiprocketQuickPickupLocation,
  getShiprocketQuickRates,
  getShiprocketQuickCouriers,
  assignShiprocketQuickCourier,
  ShiprocketOrderError,
  type ShiprocketOrderPayload,
} from "@/lib/shiprocket";
import type { FulfillmentOrder, FulfillmentState, ShipmentPackage, QuickBookingState, QuickFulfillmentQuote } from "@/lib/fulfillment-types";

export type { FulfillmentOrder, ShipmentPackage } from "@/lib/fulfillment-types";

export class FulfillmentError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 422) {
    super(message);
    this.name = "FulfillmentError";
  }
}

type Json = Record<string, unknown>;
type OrderRow = {
  id: string;
  created_at: string;
  paid_at: string | null;
  payment_status: "pending" | "paid";
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: Json;
  notes: string;
  items: { itemCode: string; name: string; quantity: number; price: number; weightGrams?: number }[];
  amount_paise: number;
  currency: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
};

const ORDER_COLUMNS = "id,created_at,paid_at,payment_status,customer_name,customer_email,customer_phone,shipping_address,notes,items,amount_paise,currency,razorpay_order_id,razorpay_payment_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STATES: FulfillmentState[] = ["not_created", "creating", "created", "failed", "needs_review"];
const QUICK_STATES: QuickBookingState[] = ["not_booked", "booking", "pending", "booked", "failed", "needs_review"];
const object = (value: unknown): Json => value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
const string = (value: unknown) => typeof value === "string" ? value : "";
const positiveId = (value: unknown): number | null => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;

function validateId(id: string) {
  if (!UUID.test(id)) throw new FulfillmentError("INVALID_ORDER", "Invalid website order reference.", 400);
}

/** Numeric, stable and at most 39 digits; Shiprocket allows at most 50 characters. */
export function merchantOrderId(id: string): string {
  validateId(id);
  return BigInt(`0x${id.replace(/-/g, "")}`).toString();
}

export function validateShipmentPackage(input: unknown): ShipmentPackage {
  const value = object(input);
  for (const key of ["weightKg", "lengthCm", "breadthCm", "heightCm"] as const) {
    const amount = value[key];
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount > 1000 ||
        (key === "weightKg" ? amount <= 0 : amount <= 0.5)) {
      throw new FulfillmentError("INVALID_PACKAGE", "Enter the actual packed weight in kg and all three dimensions in cm. Dimensions must exceed 0.5 cm; values cannot exceed 1,000.", 400);
    }
  }
  return { weightKg: value.weightKg as number, lengthCm: value.lengthCm as number, breadthCm: value.breadthCm as number, heightCm: value.heightCm as number };
}

function fulfillmentState(row: OrderRow): FulfillmentState {
  const saved = row.shipping_address.fulfillment;
  if (saved === undefined || saved === null) return "not_created";
  const state = object(saved).state;
  // An unfamiliar persisted state must never reopen shipment creation.
  return STATES.includes(state as FulfillmentState) ? state as FulfillmentState : "needs_review";
}

function deliveryService(row: OrderRow): "standard" | "quick" {
  const service = object(row.shipping_address.shippingQuote).service;
  if (service === undefined || service === "standard") return "standard";
  if (service === "quick") return "quick";
  throw new FulfillmentError("INVALID_SERVICE", "The saved delivery service needs review.", 409);
}

function quickDestination(row: OrderRow) {
  const point = object(object(row.shipping_address.shippingQuote).deliveryLocation);
  const { latitude, longitude } = point;
  if (typeof latitude !== "number" || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== "number" || !Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    throw new FulfillmentError("QUICK_LOCATION_MISSING", "The saved Quick delivery map location is missing or invalid. Review this order before shipping.", 409);
  return { latitude, longitude };
}

function quickBookingState(row: OrderRow): QuickBookingState {
  const saved = object(row.shipping_address.fulfillment).quickBooking;
  if (saved === undefined || saved === null) return "not_booked";
  const state = object(saved).state;
  return QUICK_STATES.includes(state as QuickBookingState) ? state as QuickBookingState : "needs_review";
}

function eligibilityError(row: OrderRow): FulfillmentError | null {
  if (row.payment_status !== "paid" || !row.paid_at)
    return new FulfillmentError("NOT_PAID", "Only a captured, paid website order can be sent to Shiprocket.", 409);
  const mode = row.shipping_address.paymentMode;
  if (mode === "test") return new FulfillmentError("TEST_ORDER", "Test payments cannot create live Shiprocket shipments.", 409);
  if (mode !== "live" || !string(row.shipping_address.paymentKeyId).startsWith("rzp_live_"))
    return new FulfillmentError("UNKNOWN_PAYMENT_MODE", "This older order has no verified live payment environment. It needs manual review before shipping.", 409);
  try {
    const context = getRazorpayPaymentContext();
    if (context.mode !== "live") return new FulfillmentError("TEST_ENVIRONMENT", "Live shipment creation is disabled while Razorpay test credentials are active.", 409);
    if (context.keyId !== row.shipping_address.paymentKeyId)
      return new FulfillmentError("PAYMENT_ACCOUNT_CHANGED", "Use the Razorpay account/key that accepted this order before creating its shipment.", 409);
  } catch {
    return new FulfillmentError("PAYMENT_CONFIG", "Razorpay must be configured before confirming shipment eligibility.", 503);
  }
  return null;
}

function view(row: OrderRow): FulfillmentOrder {
  const address = row.shipping_address;
  const saved = object(address.fulfillment);
  const state = fulfillmentState(row);
  const eligibility = eligibilityError(row);
  const quote = object(address.shippingQuote);
  const quick = quote.service === "quick";
  const booking = object(saved.quickBooking);
  let deliveryLocation = null;
  try { if (quick) deliveryLocation = quickDestination(row); } catch { /* Invalid locations cannot be booked. */ }
  let parcel: ShipmentPackage | null = null;
  try { if (saved.package) parcel = validateShipmentPackage(saved.package); } catch { /* Remains unavailable. */ }
  const mode = address.paymentMode === "test" || address.paymentMode === "live" ? address.paymentMode : "unknown";
  return {
    id: row.id, createdAt: row.created_at, paidAt: row.paid_at, paymentStatus: row.payment_status,
    paymentMode: mode, amountPaise: row.amount_paise, currency: row.currency,
    customer: { name: row.customer_name, email: row.customer_email, phone: row.customer_phone },
    address: {
      addressLine1: string(address.addressLine1), addressLine2: string(address.addressLine2),
      city: string(address.city), state: string(address.state), pincode: string(address.pincode), country: string(address.country),
    },
    notes: row.notes,
    items: row.items.map(({ itemCode, name, quantity, price }) => ({ itemCode, name, quantity, price })),
    shippingAmountPaise: Number.isSafeInteger(quote.amountPaise) ? quote.amountPaise as number : null,
    deliveryService: quick ? "quick" : "standard", deliveryLocation,
    fulfillment: {
      state, merchantOrderId: merchantOrderId(row.id), package: parcel,
      shiprocketOrderId: positiveId(saved.shiprocketOrderId), shipmentId: positiveId(saved.shipmentId),
      updatedAt: string(saved.updatedAt) || null, error: string(saved.error) || null,
      quickBooking: quick ? {
        state: quickBookingState(row), courierId: positiveId(booking.courierId), courierName: string(booking.courierName) || null,
        awb: string(booking.awb) || null, estimatedRatePaise: Number.isSafeInteger(booking.estimatedRatePaise) ? booking.estimatedRatePaise as number : null,
        updatedAt: string(booking.updatedAt) || null, error: string(booking.error) || null,
      } : null,
    },
    canCreateShipment: !eligibility && (state === "not_created" || state === "failed"),
    canReconcileShipment: !eligibility && !!parcel && ["creating", "needs_review", "failed"].includes(state),
    canBookQuickPickup: !eligibility && quick && !!deliveryLocation && !!parcel && state === "created" &&
      !!positiveId(saved.shiprocketOrderId) && !!positiveId(saved.shipmentId) && ["not_booked", "failed"].includes(quickBookingState(row)),
    blockedReason: eligibility?.message ?? (state === "creating" || state === "needs_review"
      ? "A creation attempt may already exist in Shiprocket. Check it there and link its order ID; do not create a second shipment." : null),
  };
}

async function readOrder(id: string): Promise<OrderRow> {
  validateId(id);
  const { data, error } = await getSupabaseAdminClient().from("website_orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new FulfillmentError("STORAGE_ERROR", "Order storage is unavailable. Please try again later.", 503);
  if (!data) throw new FulfillmentError("NOT_FOUND", "Website order not found.", 404);
  return data as OrderRow;
}

export async function listFulfillmentOrders(options: { limit?: number; before?: string } = {}): Promise<FulfillmentOrder[]> {
  const limit = options.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || (options.before && !Number.isFinite(Date.parse(options.before))))
    throw new FulfillmentError("INVALID_PAGE", "Invalid orders page.", 400);
  let query = getSupabaseAdminClient().from("website_orders").select(ORDER_COLUMNS).eq("payment_status", "paid").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (options.before) query = query.lt("created_at", options.before);
  const { data, error } = await query;
  if (error) throw new FulfillmentError("STORAGE_ERROR", "Order storage is unavailable. Please try again later.", 503);
  return (data as OrderRow[]).map(view);
}

/** Postgres compares the whole JSONB snapshot atomically: exactly one contender can claim it.
 * Payment confirmation never rewrites shipping_address. An uncertain attempt stays locked;
 * there is deliberately no expiring lease that could cause a second provider POST.
 */
async function replaceFulfillment(row: OrderRow, fulfillment: Json): Promise<OrderRow> {
  const { data, error } = await getSupabaseAdminClient().from("website_orders")
    .update({ shipping_address: { ...row.shipping_address, fulfillment } })
    .eq("id", row.id).eq("payment_status", "paid")
    .eq("shipping_address", JSON.stringify(row.shipping_address))
    .select(ORDER_COLUMNS).maybeSingle();
  if (error) throw new FulfillmentError("STORAGE_ERROR", "Shipment progress could not be saved. Refresh the order before taking another action.", 503);
  if (!data) throw new FulfillmentError("ORDER_CHANGED", "This order was changed by another request. Refresh it before continuing.", 409);
  return data as OrderRow;
}

async function verifyCapturedPayment(row: OrderRow) {
  const blocked = eligibilityError(row);
  if (blocked) throw blocked;
  if (!row.razorpay_payment_id || !row.razorpay_order_id)
    throw new FulfillmentError("PAYMENT_MISSING", "The saved payment references are incomplete.", 409);
  let payment;
  try { payment = await getRazorpay().payments.fetch(row.razorpay_payment_id); }
  catch { throw new FulfillmentError("PAYMENT_UNAVAILABLE", "Could not verify the captured payment with Razorpay. No shipment was created.", 503); }
  if (payment.id !== row.razorpay_payment_id || payment.order_id !== row.razorpay_order_id ||
      Number(payment.amount) !== row.amount_paise || payment.currency !== row.currency ||
      payment.status !== "captured" || payment.captured !== true || payment.amount_refunded !== 0)
    throw new FulfillmentError("PAYMENT_NOT_ELIGIBLE", "The payment is not fully captured, has been refunded, or does not match this order. Review it before shipping.", 409);
}

function buildPayload(row: OrderRow, parcel: ShipmentPackage, pickup: string): ShiprocketOrderPayload {
  const address = row.shipping_address;
  const quote = object(address.shippingQuote);
  let subtotalPaise = 0;
  let productWeightKg = 0;
  if (!Array.isArray(row.items) || !row.items.length || row.items.length > 100)
    throw new FulfillmentError("INVALID_SNAPSHOT", "The saved order items need review.");
  for (const item of row.items) {
    if (!item.itemCode || !item.name || !Number.isSafeInteger(item.quantity) || item.quantity < 1 ||
        typeof item.price !== "number" || !Number.isFinite(item.price) || item.price <= 0)
      throw new FulfillmentError("INVALID_SNAPSHOT", "The saved product prices or quantities need review.");
    subtotalPaise += Math.round(item.price * 100) * item.quantity;
    if (typeof item.weightGrams === "number" && Number.isFinite(item.weightGrams) && item.weightGrams > 0)
      productWeightKg += item.weightGrams * item.quantity / 1000;
  }
  if (parcel.weightKg + 0.000001 < productWeightKg)
    throw new FulfillmentError("PACKAGE_TOO_LIGHT", "Packed weight cannot be less than the saved product weight. Check the parcel or catalogue weights.");
  const shippingPaise = quote.amountPaise;
  if (row.currency !== "INR" || !Number.isSafeInteger(subtotalPaise) ||
      typeof shippingPaise !== "number" || !Number.isSafeInteger(shippingPaise) || shippingPaise < 0 ||
      subtotalPaise !== quote.subtotalPaise || quote.totalPaise !== row.amount_paise ||
      subtotalPaise + shippingPaise !== row.amount_paise || quote.pincode !== address.pincode)
    throw new FulfillmentError("TOTAL_MISMATCH", "The saved product, shipping and payment totals do not agree. Review this order before shipping.");
  if (!/^[1-9]\d{5}$/.test(string(address.pincode)) || string(address.country).toLowerCase() !== "india" ||
      !string(address.addressLine1).trim() || !string(address.city).trim() || !string(address.state).trim())
    throw new FulfillmentError("ADDRESS_INVALID", "The saved Indian delivery address is incomplete.");
  const digits = row.customer_phone.replace(/[\s()+-]/g, "");
  const phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  if (!/^[6-9]\d{9}$/.test(phone))
    throw new FulfillmentError("PHONE_INVALID", "The saved customer mobile number must be a valid 10-digit Indian number.");
  const created = new Date(row.created_at);
  if (!Number.isFinite(created.getTime())) throw new FulfillmentError("DATE_INVALID", "The saved order date is invalid.");
  const [firstName, ...lastName] = row.customer_name.trim().split(/\s+/);
  const quick = deliveryService(row) === "quick" ? quickDestination(row) : null;
  return {
    ...(quick ? { latitude: quick.latitude, longitude: quick.longitude, shipping_method: "HL" as const } : {}),
    order_id: merchantOrderId(row.id),
    // Shiprocket accepts local YYYY-MM-DD HH:mm. This store ships within India.
    order_date: new Date(created.getTime() + 330 * 60_000).toISOString().slice(0, 19).replace("T", " "),
    pickup_location: pickup,
    billing_customer_name: firstName,
    billing_last_name: lastName.join(" "),
    billing_address: string(address.addressLine1), billing_address_2: string(address.addressLine2),
    billing_city: string(address.city), billing_pincode: string(address.pincode),
    billing_state: string(address.state), billing_country: "India",
    billing_email: row.customer_email, billing_phone: phone, shipping_is_billing: true,
    order_items: row.items.map((item) => ({ name: item.name, sku: item.itemCode, units: item.quantity, selling_price: item.price })),
    payment_method: "Prepaid", sub_total: subtotalPaise / 100, shipping_charges: shippingPaise / 100,
    weight: parcel.weightKg, length: parcel.lengthCm, breadth: parcel.breadthCm, height: parcel.heightCm,
  };
}

function providerOrderMatches(row: OrderRow, existing: Awaited<ReturnType<typeof getShiprocketOrder>>) {
  return existing.merchantOrderId === merchantOrderId(row.id) &&
    existing.deliveryPincode === row.shipping_address.pincode &&
    Math.round(existing.total * 100) === row.amount_paise &&
    (deliveryService(row) !== "quick" || existing.shippingMethod === undefined || existing.shippingMethod === "HL");
}

/** Staff creates the provider order once the cards are ready and the parcel is measured.
 * No AWB assignment or pickup scheduling is performed by this operation.
 */
export async function createOrderShipment(id: string, packageInput: unknown): Promise<FulfillmentOrder> {
  const row = await readOrder(id);
  const blocked = eligibilityError(row);
  if (blocked) throw blocked;
  const state = fulfillmentState(row);
  if (state === "created") return view(row);
  if (state !== "not_created" && state !== "failed")
    throw new FulfillmentError("RECONCILIATION_REQUIRED", "An earlier request may already have created this order in Shiprocket. Reconcile it instead of retrying creation.", 409);
  const parcel = validateShipmentPackage(packageInput);
  // Validate the entire snapshot before any external write or durable claim.
  const payload = buildPayload(row, parcel, "pending-pickup");
  await verifyCapturedPayment(row);
  try { payload.pickup_location = (await (deliveryService(row) === "quick" ? getShiprocketQuickPickupLocation() : getShiprocketPickupLocation())).name; }
  catch { throw new FulfillmentError("PICKUP_UNAVAILABLE", "The configured Shiprocket pickup location could not be verified. No shipment was created.", 503); }
  if (deliveryService(row) === "quick") await quickRate(row, parcel);
  const started = new Date().toISOString();
  const attempt: Json = {
    version: 1, state: "creating", attemptId: randomUUID(), merchantOrderId: payload.order_id,
    package: parcel, startedAt: started, updatedAt: started,
  };
  const claimed = await replaceFulfillment(row, attempt);
  let result;
  try {
    result = await createShiprocketOrder(payload);
  } catch (error) {
    const rejected = error instanceof ShiprocketOrderError && error.outcome === "rejected";
    const message = rejected
      ? "Shiprocket rejected the order. Check its address, package, pickup location and account settings before retrying."
      : "Shiprocket may have received this request. Check the merchant reference in Shiprocket and reconcile its order ID; do not create another shipment.";
    await replaceFulfillment(claimed, { ...attempt, state: rejected ? "failed" : "needs_review", updatedAt: new Date().toISOString(), error: message });
    throw new FulfillmentError(rejected ? "SHIPROCKET_REJECTED" : "SHIPROCKET_UNCERTAIN", message, rejected ? 422 : 409);
  }
  let recorded: OrderRow;
  try {
    // Save the provider's IDs before checking its stored totals. A delayed read
    // must never lose a successful creation or invite another create request.
    recorded = await replaceFulfillment(claimed, {
      ...attempt, state: "needs_review", shiprocketOrderId: result.orderId, shipmentId: result.shipmentId,
      updatedAt: new Date().toISOString(),
      error: `Shiprocket order ${result.orderId} exists. Its stored total and destination still need verification; reconcile this order ID before courier selection.`,
    });
  } catch {
    // Never replay a successful provider write after a local storage failure.
    throw new FulfillmentError("SHIPMENT_SAVE_PENDING", `Shiprocket created order ${result.orderId} (shipment ${result.shipmentId}), but its references could not be saved. Refresh and reconcile that order ID; do not create it again.`, 503);
  }
  let existing;
  try { existing = await getShiprocketOrder(result.orderId); }
  catch {
    throw new FulfillmentError("SHIPMENT_VERIFICATION_PENDING", `Shiprocket created order ${result.orderId}, but its saved details could not yet be verified. Refresh and reconcile that order ID; do not create another order.`, 503);
  }
  if (!providerOrderMatches(row, existing) || existing.shipmentId !== result.shipmentId) {
    const message = `Shiprocket order ${result.orderId} was created, but its total, destination or shipment reference does not match. Review its details in Shiprocket before linking it or selecting a courier.`;
    await replaceFulfillment(recorded, { ...object(recorded.shipping_address.fulfillment), updatedAt: new Date().toISOString(), error: message });
    throw new FulfillmentError("SHIPMENT_MISMATCH", message, 409);
  }
  try {
    return view(await replaceFulfillment(recorded, {
      ...object(recorded.shipping_address.fulfillment), state: "created", updatedAt: new Date().toISOString(), error: null,
    }));
  } catch {
    throw new FulfillmentError("SHIPMENT_SAVE_PENDING", `Shiprocket order ${result.orderId} was verified, but its final status could not be saved. Refresh and reconcile this order ID.`, 503);
  }
}

export async function reconcileOrderShipment(id: string, shiprocketOrderId: unknown): Promise<FulfillmentOrder> {
  const providerId = positiveId(shiprocketOrderId);
  if (!providerId) throw new FulfillmentError("INVALID_SHIPROCKET_ID", "Enter the numeric Shiprocket order ID.", 400);
  const row = await readOrder(id);
  const blocked = eligibilityError(row);
  if (blocked) throw blocked;
  const saved = object(row.shipping_address.fulfillment);
  const state = fulfillmentState(row);
  if (state === "created") {
    if (saved.shiprocketOrderId !== providerId) throw new FulfillmentError("ALREADY_LINKED", "This website order is already linked to a different Shiprocket order.", 409);
    return view(row);
  }
  if (!["creating", "needs_review", "failed"].includes(state))
    throw new FulfillmentError("NO_ATTEMPT", "There is no shipment creation attempt to reconcile.", 409);
  validateShipmentPackage(saved.package);
  await verifyCapturedPayment(row);
  let existing;
  try { existing = await getShiprocketOrder(providerId); }
  catch { throw new FulfillmentError("LOOKUP_FAILED", "This Shiprocket order could not be verified, is cancelled, or has ambiguous shipments. Check it in Shiprocket.", 422); }
  if (!providerOrderMatches(row, existing))
    throw new FulfillmentError("SHIPMENT_MISMATCH", "The Shiprocket merchant reference, delivery pincode or total does not match this website order.", 409);
  return view(await replaceFulfillment(row, {
    ...saved, state: "created", shiprocketOrderId: existing.orderId, shipmentId: existing.shipmentId,
    updatedAt: new Date().toISOString(), error: null,
  }));
}

function quickOrderContext(row: OrderRow) {
  const blocked = eligibilityError(row);
  if (blocked) throw blocked;
  if (deliveryService(row) !== "quick")
    throw new FulfillmentError("NOT_QUICK_ORDER", "This order uses standard delivery and cannot book a Quick pickup.", 409);
  quickDestination(row);
  const saved = object(row.shipping_address.fulfillment);
  const providerId = positiveId(saved.shiprocketOrderId);
  const shipmentId = positiveId(saved.shipmentId);
  if (fulfillmentState(row) !== "created" || !providerId || !shipmentId)
    throw new FulfillmentError("SHIPMENT_REQUIRED", "Create and verify the Shiprocket order before booking its local pickup.", 409);
  return { saved, providerId, shipmentId, parcel: validateShipmentPackage(saved.package) };
}

async function quickRate(row: OrderRow, parcel: ShipmentPackage): Promise<QuickFulfillmentQuote> {
  const deliveryLocation = quickDestination(row);
  let rates;
  try {
    rates = await getShiprocketQuickRates({ deliveryPincode: string(row.shipping_address.pincode), deliveryLocation, weightKg: parcel.weightKg, cod: false });
  } catch {
    throw new FulfillmentError("QUICK_UNAVAILABLE", "Quick availability could not be checked for this packed parcel. Try checking rates again.", 503);
  }
  const options = rates.couriers.filter((courier) => typeof courier.rate === "number" && Number.isFinite(courier.rate) && courier.rate >= 0)
    .sort((a, b) => a.rate - b.rate);
  if (!options.length)
    throw new FulfillmentError("QUICK_UNSERVICEABLE", "Shiprocket Quick cannot currently serve this location and packed weight. No pickup was booked.", 422);
  const amountPaise = Math.round(options[0].rate * 100);
  if (!Number.isSafeInteger(amountPaise)) throw new FulfillmentError("QUICK_UNAVAILABLE", "The Quick estimate could not be verified.", 503);
  return { amountPaise, currency: "INR", courierName: options[0].name, weightKg: parcel.weightKg };
}

async function quickCouriers() {
  try {
    const couriers = await getShiprocketQuickCouriers();
    if (!couriers.length) throw new Error("No hyperlocal couriers");
    return couriers;
  } catch {
    throw new FulfillmentError("QUICK_COURIERS_UNAVAILABLE", "Quick courier options are unavailable. Check your Shiprocket account and try again.", 503);
  }
}

async function readLinkedQuickOrder(row: OrderRow, providerId: number, shipmentId: number) {
  let existing;
  try { existing = await getShiprocketOrder(providerId); }
  catch { throw new FulfillmentError("QUICK_LOOKUP_FAILED", "The linked Shiprocket order could not be checked. Check its booking status before taking another action.", 503); }
  if (!providerOrderMatches(row, existing) || existing.orderId !== providerId || existing.shipmentId !== shipmentId)
    throw new FulfillmentError("SHIPMENT_MISMATCH", "The linked Shiprocket order, destination, total or shipment does not match. Review it in Shiprocket before booking.", 409);
  return existing;
}

export async function quoteQuickPickup(id: string): Promise<{ order: FulfillmentOrder; quote: QuickFulfillmentQuote; couriers: { id: number; name: string }[] }> {
  const row = await readOrder(id);
  const { parcel } = quickOrderContext(row);
  const [quote, couriers] = await Promise.all([quickRate(row, parcel), quickCouriers()]);
  return { order: view(row), quote, couriers };
}

/** Claim once before assignment: Quick AWB allocation may dispatch a rider immediately.
 * An accepted asynchronous response is pending, never evidence of a confirmed booking.
 */
export async function bookQuickPickup(id: string, courierInput: unknown, expectedRateInput: unknown): Promise<FulfillmentOrder> {
  const row = await readOrder(id);
  const { saved, providerId, shipmentId, parcel } = quickOrderContext(row);
  if (!["not_booked", "failed"].includes(quickBookingState(row)))
    throw new FulfillmentError("QUICK_RECONCILIATION_REQUIRED", "A Quick booking may already exist. Use Check booking; do not book another pickup.", 409);
  const courierId = positiveId(courierInput);
  if (!courierId || typeof expectedRateInput !== "number" || !Number.isSafeInteger(expectedRateInput) || expectedRateInput < 0)
    throw new FulfillmentError("INVALID_QUICK_BOOKING", "Check the current Quick estimate and select a courier before booking.", 400);
  await verifyCapturedPayment(row);
  const [quote, couriers, existing] = await Promise.all([
    quickRate(row, parcel), quickCouriers(), readLinkedQuickOrder(row, providerId, shipmentId),
  ]);
  const courier = couriers.find((candidate) => candidate.id === courierId);
  if (!courier) throw new FulfillmentError("INVALID_QUICK_COURIER", "Select a currently available Quick courier or vehicle.", 400);
  if (quote.amountPaise !== expectedRateInput)
    throw new FulfillmentError("QUICK_RATE_CHANGED", "The Quick estimate changed. Check rates again and review the new estimate before booking.", 409);
  if (existing.awb || existing.courierId) {
    await replaceFulfillment(row, { ...saved, quickBooking: {
      ...object(saved.quickBooking), state: "needs_review", updatedAt: new Date().toISOString(),
      error: "Shiprocket already shows a courier assignment. Use Check booking to verify it before any further action.",
    } });
    throw new FulfillmentError("QUICK_ALREADY_ASSIGNED", "Shiprocket already shows a courier assignment. Use Check booking to verify it.", 409);
  }
  const now = new Date().toISOString();
  const booking: Json = {
    state: "booking", attemptId: randomUUID(), courierId, courierName: courier.name,
    estimatedRatePaise: quote.amountPaise, startedAt: now, updatedAt: now,
  };
  const claimed = await replaceFulfillment(row, { ...saved, quickBooking: booking });
  try {
    await assignShiprocketQuickCourier(shipmentId, courierId);
  } catch (error) {
    const rejected = error instanceof ShiprocketOrderError && error.outcome === "rejected";
    const message = rejected
      ? "Shiprocket rejected the Quick booking. Check the order and courier before checking rates again."
      : "Shiprocket may have received the booking. Use Check booking or review it in Shiprocket; do not book another pickup.";
    await replaceFulfillment(claimed, { ...saved, quickBooking: { ...booking, state: rejected ? "failed" : "needs_review", updatedAt: new Date().toISOString(), error: message } });
    throw new FulfillmentError(rejected ? "QUICK_REJECTED" : "QUICK_UNCERTAIN", message, rejected ? 422 : 409);
  }
  try {
    return view(await replaceFulfillment(claimed, { ...saved, quickBooking: {
      ...booking, state: "pending", updatedAt: new Date().toISOString(),
      error: "Booking was accepted. Use Check booking to confirm the courier and tracking number.",
    } }));
  } catch {
    throw new FulfillmentError("QUICK_SAVE_PENDING", "Shiprocket accepted the booking, but its progress could not be saved. Refresh and use Check booking; do not book again.", 503);
  }
}

/** Read-only at the provider. Never dispatches or retries a rider assignment. */
export async function refreshQuickBooking(id: string): Promise<FulfillmentOrder> {
  const row = await readOrder(id);
  const { saved, providerId, shipmentId } = quickOrderContext(row);
  const booking = object(saved.quickBooking);
  const [existing, couriers] = await Promise.all([readLinkedQuickOrder(row, providerId, shipmentId), quickCouriers()]);
  const selectedId = positiveId(booking.courierId);
  const actual = couriers.find((courier) => courier.id === existing.courierId);
  const now = new Date().toISOString();
  const conflict = (existing.courierId && (!actual || (selectedId && selectedId !== existing.courierId))) || (existing.awb && !actual) ||
    (string(booking.awb) && existing.awb && booking.awb !== existing.awb);
  if (conflict) {
    const message = "The courier or tracking number in Shiprocket differs from this booking. Review it in Shiprocket; another pickup will not be created.";
    await replaceFulfillment(row, { ...saved, quickBooking: { ...booking, state: "needs_review", updatedAt: now, error: message } });
    throw new FulfillmentError("QUICK_BOOKING_MISMATCH", message, 409);
  }
  if (actual && existing.awb) {
    return view(await replaceFulfillment(row, { ...saved, quickBooking: {
      ...booking, state: "booked", courierId: actual.id, courierName: existing.courierName || actual.name,
      awb: existing.awb, updatedAt: now, error: null,
    } }));
  }
  if (["not_booked", "failed"].includes(quickBookingState(row)) && !existing.courierId) return view(row);
  return view(await replaceFulfillment(row, { ...saved, quickBooking: {
    ...booking,
    // An uncertain or unpersisted attempt remains locked even if the provider
    // has not yet populated its asynchronous AWB. Never reopen booking here.
    state: quickBookingState(row) === "booked" ? "needs_review" :
      ["not_booked", "failed"].includes(quickBookingState(row)) ? "pending" : quickBookingState(row),
    ...(actual && !selectedId ? { courierId: actual.id, courierName: actual.name } : {}),
    updatedAt: now, error: "Shiprocket has not confirmed a courier and tracking number yet. Check again or review the existing order in Shiprocket.",
  } }));
}
