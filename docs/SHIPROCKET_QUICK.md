# Shiprocket Quick

Shiprocket Quick is integrated through **Hyperlocal in the shared [Shiprocket API documentation](https://apidocs.shiprocket.in/)**. It uses the existing server API credentials; a separate documentation site or new credential pair is not required by this integration.

## Customer checkout

1. Enter the delivery pincode in the cart and select **Shiprocket Quick**.
2. Open the map, select the exact delivery point (or use the device location), and confirm the pin. The map uses Leaflet and OpenStreetMap tiles with visible attribution; no map API key is needed.
3. The server checks Quick availability for the pickup coordinates, delivery coordinates, pincode and total catalogue item weight. The customer pays the returned Quick estimate **plus INR 50 once per order**.
4. The pincode, delivery choice and confirmed point carry into checkout. Changing the pincode or address requires reconfirming the map pin. The server refreshes the quote before payment; a changed charge must be reviewed before proceeding.

Quick means local delivery **after the invitations are produced and packed**. Selecting it does not promise delivery within hours of payment. An unavailable Quick quote never silently becomes standard delivery or free shipping. The customer can select standard delivery instead.

The saved server quote includes `service: "quick"` and the delivery coordinates. Quotes without a service are standard delivery, preserving older orders. The Quick response does not provide a courier ID, vehicle or pickup ETA; the website does not invent these. A confirmed map pin is the customer's chosen destination, not an independently geocoded or verified address.

## Staff fulfillment

1. Open `/admin/orders`, select a paid **live** Quick order, finish production and packing, and enter the measured parcel weight and dimensions.
2. Select **Create Shiprocket Order**. The server rechecks the payment and Quick serviceability at the actual packed weight. It creates the order with `shipping_method: "HL"` and the saved destination coordinates. Creation does not itself book a rider.
3. Check the current Quick estimate and available account courier options. Select the suitable local courier or vehicle, then explicitly book the pickup when the package is ready. This action may dispatch a rider and incur a provider charge.
4. Shiprocket can accept the request asynchronously. **Pending** means accepted, not a confirmed rider. Use **Check booking** to read the existing provider order. A booking is confirmed only when its merchant reference, pincode, total, shipment, selected hyperlocal courier and AWB match.

The quote is a **generic Quick estimate**, not a vehicle-specific guaranteed price. Account courier options are loaded from Shiprocket's current catalog and filtered by its `is_hyperlocal` flag. A catalog entry does not guarantee route coverage, vehicle capacity or rider availability. Staff must choose a suitable vehicle; Shiprocket confirms the assignment. Availability of Porter or any particular partner is not guaranteed. The final provider charge can differ from the estimate or the customer's fixed checkout fee. Booking never charges the customer again.

The staff booking estimate shows the raw provider amount; the customer's shipping charge already includes the INR 50 addition. Booking refreshes the raw estimate and refuses a changed amount until staff checks rates again.

## Access and configuration

Existing settings are reused:

```dotenv
SHIPROCKET_EMAIL=your-api-user-email
SHIPROCKET_PASSWORD=your-api-user-password
SHIPROCKET_PICKUP_LOCATION=exact-saved-pickup-nickname
ADMIN_USER_IDS=verified-supabase-user-uuid
```

Save the exact pickup latitude and longitude in Shiprocket. A pincode alone cannot supply these. The API user needs permissions for pickup locations, rates, courier catalog, order reads/creation, AWB assignment and tracking. See [shipping configuration](SHIPPING.md) for payment verification and staff access. No database migration is required; the accepted delivery service/location and booking state use the existing order JSONB snapshot.

Test Razorpay orders remain visible but cannot create live Shiprocket orders or book riders. The external Shiprocket API is live; this is not a shipping sandbox. Quick writes require the same staff authentication and same-origin checks as standard fulfillment.

## Duplicate prevention and recovery

Order creation uses the existing durable fulfillment claim. Quick booking has an additional atomic claim in `fulfillment.quickBooking` before sending one AWB assignment POST. Payment retries never dispatch riders.

- **Not booked / Failed:** an initial booking or explicitly rejected attempt can be submitted after fresh checks.
- **Booking / Pending / Needs review:** a request might have been accepted. No second assignment, automatic retry or lock expiry is allowed. Check the existing booking or investigate in Shiprocket.
- **Booked:** matching courier and AWB were read back. This does not assert that a rider has arrived or that the parcel was delivered; customer tracking supplies those updates.

A timeout, malformed reply or failure saving an accepted request leaves a durable state requiring review. **Check booking** only reads and reconciles the existing provider order; it does not dispatch another rider. It can also link a matching hyperlocal assignment made in the Shiprocket dashboard. Mismatched courier or shipment details remain blocked for investigation.

## Tracking

Quick uses the same saved shipment ID and customer tracking access as standard deliveries: **My Orders** for signed-in customers and the private tracking link for guests. Shiprocket's rider and delivery statuses appear when available. Tracking is refreshed on demand with a short server cache; it does not send email/SMS or create a background webhook subscription.

## Read-only checks

```powershell
npm run shiprocket:quick:check
npm run shiprocket:quick:check -- --pincode <delivery-pincode> --latitude <delivery-latitude> --longitude <delivery-longitude> --weight <packed-kg>
```

The first command validates credentials and saved pickup coordinates. Supplying a destination additionally checks a real route. It logs no credentials, full addresses or coordinate values. The displayed rate is before the INR 50 customer markup. Authentication and GET lookups are its only provider requests.

On 11 November 2026, a read-only diagnostic returned a Shiprocket Quick rate using the existing account and pickup coordinates. The company catalog also returned hyperlocal options. This confirms rate/catalog access, not a successful real rider booking. Automated tests mock all shipment and booking writes.

## Provider contract

- [Quick rates](https://apidocs.shiprocket.in/#f9f4f63f-370b-474b-86d7-56184ec6cfe1): `GET /v1/external/courier/serviceability/` with `is_new_hyperlocal=1`, `lat_from`, `long_from`, `lat_to`, `long_to`, pickup/delivery postcodes, weight and prepaid mode. `only_local=1` alone is not the Quick request.
- [Hyperlocal creation](https://apidocs.shiprocket.in/#239e82c3-29bc-4155-b124-d6f6884fb924): `POST /orders/create/adhoc` with `shipping_method: "HL"`, destination `latitude`/`longitude` and normal order/package fields. `checkout_shipping_method: "SR_QUICK"` is for SRF users and is not used here.
- Courier selection: `GET /courier/courierListWithCounts`, accepting only current entries flagged hyperlocal. IDs are never hardcoded or taken from the customer quote.
- [AWB assignment](https://apidocs.shiprocket.in/#a74b0f30-fbff-4a84-8411-49f1369cee8f): one `POST /courier/assign/awb` with explicit shipment and courier IDs. Its asynchronous success is treated as pending until verified by order readback.
- Tracking: the existing read-only `/courier/track/shipment/{shipment_id}` endpoint.
