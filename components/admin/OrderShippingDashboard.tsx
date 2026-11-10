"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Check, CircleAlert, LayoutGrid, LoaderCircle, Package, RefreshCw, Search, Truck } from "lucide-react";
import type { FulfillmentOrder, FulfillmentState, ShipmentPackage } from "@/lib/fulfillment-types";
import workspace from "./ItemDashboard.module.css";
import styles from "./OrderShipping.module.css";

const states: Record<FulfillmentState, string> = {
  not_created: "Ready to prepare",
  creating: "Creating order",
  created: "Created in Shiprocket",
  failed: "Needs attention",
  needs_review: "Check Shiprocket",
};

function money(amount: number, currency = "INR") {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount / 100);
}

function orderDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";
}

function OrderShell({ children }: { children: ReactNode }) {
  return <div className={workspace.app}>
    <aside className={workspace.sidebar}>
      <Link href="/admin" className={workspace.brand}>
        <Image src="/logo.png" alt="" width={44} height={44} className={workspace.brandMark} />
        <span>Beyond Invitation<small>ADMIN WORKSPACE</small></span>
      </Link>
      <div className={workspace.sidebarLabel}>WORKSPACE</div>
      <Link href="/admin" className={workspace.navButton}><LayoutGrid size={18} />All items</Link>
      <Link href="/admin/blogs" className={workspace.navButton}><BookOpen size={18} />Blogs</Link>
      <Link href="/admin/orders" className={workspace.navActive} aria-current="page"><Package size={18} />Orders</Link>
      <div className={workspace.sidebarNote}><Truck size={19} /><p>Prepare each paid order<br />for its next journey.</p></div>
      <div className={workspace.adminLabel}>ADMIN WORKSPACE <span>/admin</span></div>
    </aside>
    <div className={workspace.workspace}>
      <header className={workspace.topbar}>
        <span>Workspace <span className={workspace.slash}>/</span> <strong>Order shipping</strong></span>
        <Link href="/account" className={styles.accountLink}>My account</Link>
      </header>
      <main className={`${workspace.content} ${styles.content}`}>{children}</main>
    </div>
  </div>;
}

function ModeBadge({ mode }: { mode: FulfillmentOrder["paymentMode"] }) {
  return <span className={`${styles.badge} ${mode === "live" ? styles.live : styles.test}`}>
    {mode === "live" ? "Live payment" : mode === "test" ? "Test payment" : "Payment mode unknown"}
  </span>;
}

type PackageFields = Record<keyof ShipmentPackage, string>;

function OrderDetails({ order, onUpdate, onReload, canManageShipments }: {
  order: FulfillmentOrder;
  onUpdate: (order: FulfillmentOrder) => void;
  onReload: () => Promise<boolean>;
  canManageShipments: boolean;
}) {
  const [measurements, setMeasurements] = useState<PackageFields>(() => ({
    weightKg: order.fulfillment.package ? String(order.fulfillment.package.weightKg) : "",
    lengthCm: order.fulfillment.package ? String(order.fulfillment.package.lengthCm) : "",
    breadthCm: order.fulfillment.package ? String(order.fulfillment.package.breadthCm) : "",
    heightCm: order.fulfillment.package ? String(order.fulfillment.package.heightCm) : "",
  }));
  const [providerOrderId, setProviderOrderId] = useState("");
  const [busy, setBusy] = useState<"create" | "reconcile" | "refresh" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mustRefresh, setMustRefresh] = useState(false);
  const inFlight = useRef(false);
  const mutation = useRef<AbortController | null>(null);
  useEffect(() => () => mutation.current?.abort(), []);

  async function refreshStatus() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy("refresh");
    const refreshed = await onReload();
    if (refreshed) setMustRefresh(false);
    setBusy(null);
    inFlight.current = false;
  }

  async function submit(action: "create" | "reconcile", body: unknown) {
    if (inFlight.current || !canManageShipments) return;
    inFlight.current = true;
    setBusy(action);
    setError("");
    setSuccess("");
    const controller = new AbortController();
    mutation.current = controller;
    const deadline = setTimeout(() => controller.abort(), 45_000);
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.id)}/${action === "create" ? "shipping" : "reconcile"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "The order could not be updated. Please refresh its status.");
      if (!result.order || result.order.id !== order.id) throw new Error("The result could not be confirmed. Refresh the order status.");
      onUpdate(result.order);
      setMustRefresh(false);
      setSuccess(action === "create" ? "Order created in Shiprocket. It is ready for courier selection there." : "Existing Shiprocket order linked successfully.");
    } catch (caught) {
      setError(controller.signal.aborted
        ? "The request did not finish in time. Refresh the status and check Shiprocket before trying again."
        : caught instanceof Error ? caught.message : "The order could not be updated.");
      setMustRefresh(true);
      const refreshed = await onReload();
      if (refreshed) setMustRefresh(false);
    } finally {
      clearTimeout(deadline);
      setBusy(null);
      inFlight.current = false;
    }
  }

  function createShipment(event: FormEvent) {
    event.preventDefault();
    if (!canManageShipments || !order.canCreateShipment || mustRefresh) return;
    const packed: ShipmentPackage = {
      weightKg: Number(measurements.weightKg),
      lengthCm: Number(measurements.lengthCm),
      breadthCm: Number(measurements.breadthCm),
      heightCm: Number(measurements.heightCm),
    };
    if (Object.values(measurements).some((value) => !value.trim()) ||
        Object.values(packed).some((value) => !Number.isFinite(value) || value > 1000) ||
        packed.weightKg <= 0 || [packed.lengthCm, packed.breadthCm, packed.heightCm].some((value) => value <= 0.5)) {
      setError("Enter the measured weight and all three dimensions of the packed parcel.");
      return;
    }
    void submit("create", { package: packed });
  }

  const isCreated = order.fulfillment.state === "created";
  return <section className={styles.detail} aria-label="Selected order">
    <div className={styles.detailHeading}>
      <div><span className={styles.eyebrow}>ORDER DETAILS</span><h2>{order.customer.name}</h2></div>
      <ModeBadge mode={order.paymentMode} />
    </div>
    <dl className={styles.orderMeta}>
      <div><dt>Website order</dt><dd className={styles.identifier}>{order.id}</dd></div>
      <div><dt>Payment</dt><dd>{order.paymentStatus === "paid" ? "Paid" : "Pending"} · {money(order.amountPaise, order.currency)}</dd></div>
      <div><dt>Placed</dt><dd>{orderDate(order.createdAt)}</dd></div>
      <div><dt>Shipping status</dt><dd>{states[order.fulfillment.state]}</dd></div>
    </dl>
    <div className={styles.recipientGrid}>
      <div><h3>Delivery address</h3><p>{order.address.addressLine1}<br />{order.address.addressLine2 && <>{order.address.addressLine2}<br /></>}{order.address.city}, {order.address.state} {order.address.pincode}<br />{order.address.country}</p></div>
      <div><h3>Contact</h3><p>{order.customer.phone}<br /><span className={styles.email}>{order.customer.email}</span></p></div>
    </div>
    <div className={styles.items}>
      {order.items.map((item, index) => <div key={`${item.itemCode}-${index}`}>
        <span><strong>{item.name}</strong><small>{item.itemCode} · {item.quantity} pcs</small></span>
        <strong>{money(Math.round(item.price * item.quantity * 100), order.currency)}</strong>
      </div>)}
      {order.shippingAmountPaise !== null && <div><span>Shipping collected</span><strong>{money(order.shippingAmountPaise, order.currency)}</strong></div>}
    </div>
    {order.notes && <div className={styles.notes}><h3>Customer notes</h3><p>{order.notes}</p></div>}

    {error && <p className={styles.error} role="alert"><CircleAlert size={18} />{error}</p>}
    {success && <p className={styles.success} role="status"><Check size={18} />{success}</p>}
    {mustRefresh && <button type="button" className={styles.secondary} disabled={!!busy} onClick={() => void refreshStatus()}><RefreshCw size={16} />Refresh order status</button>}

    {isCreated ? <div className={styles.created}>
      <div><Check size={20} /><h3>Created in Shiprocket</h3></div>
      <dl><div><dt>Shiprocket order ID</dt><dd>{order.fulfillment.shiprocketOrderId}</dd></div><div><dt>Shipment ID</dt><dd>{order.fulfillment.shipmentId}</dd></div></dl>
      <p>Select the courier and arrange pickup in Shiprocket when the parcel is ready.</p>
      <a href="https://app.shiprocket.in/" target="_blank" rel="noreferrer" className={styles.secondary}>Open Shiprocket</a>
    </div> : <>
      {order.blockedReason && <p className={styles.notice}>{order.blockedReason}</p>}
      {order.fulfillment.error && <p className={styles.notice}>{order.fulfillment.error}</p>}
      <form className={styles.packageForm} onSubmit={createShipment}>
        <h3>Packed parcel measurements</h3>
        <p>Measure the final parcel, including its packaging.</p>
        {!canManageShipments && <p className={styles.help}>You can view orders without signing in. <Link href="/sign-in?next=%2Fadmin%2Forders">Sign in to create or link shipments.</Link></p>}
        <p className={styles.notice}>The final courier charge may change with packed measurements. The customer’s payment stays unchanged.</p>
        <fieldset disabled={!canManageShipments || !!busy || !order.canCreateShipment || mustRefresh} className={styles.measurements}>
          {([
            ["weightKg", "Weight (kg)", "0.001"],
            ["lengthCm", "Length (cm)", "0.51"],
            ["breadthCm", "Width (cm)", "0.51"],
            ["heightCm", "Height (cm)", "0.51"],
          ] as const).map(([key, label, minimum]) => <label key={key}>{label}<input type="number" inputMode="decimal" min={minimum} max="1000" step="any" required value={measurements[key]} onChange={(event) => setMeasurements((current) => ({ ...current, [key]: event.target.value }))} /></label>)}
        </fieldset>
        <button type="submit" disabled={!canManageShipments || !!busy || !order.canCreateShipment || mustRefresh} className={styles.primary}>
          {busy === "create" ? <LoaderCircle size={17} className={styles.spin} /> : <Package size={17} />}
          {busy === "create" ? "Creating order…" : "Create Shiprocket Order"}
        </button>
        <p className={styles.help}>This creates the shipping order. Courier selection and pickup are arranged separately.</p>
      </form>
      {canManageShipments && order.canReconcileShipment && <form className={styles.reconcile} onSubmit={(event) => {
        event.preventDefault();
        if (!/^\d+$/.test(providerOrderId) || !Number.isSafeInteger(Number(providerOrderId)) || Number(providerOrderId) <= 0) {
          setError("Enter the numeric Shiprocket order ID shown in your Shiprocket dashboard.");
          return;
        }
        void submit("reconcile", { shiprocketOrderId: Number(providerOrderId) });
      }}>
        <h3>Already created in Shiprocket?</h3>
        <p>Find the order with reference <strong className={styles.identifier}>{order.fulfillment.merchantOrderId}</strong> and enter its Shiprocket order ID. The details will be checked before linking it.</p>
        <label>Shiprocket order ID<input type="text" inputMode="numeric" value={providerOrderId} onChange={(event) => setProviderOrderId(event.target.value.replace(/\D/g, ""))} disabled={!!busy} required /></label>
        <button type="submit" className={styles.secondary} disabled={!!busy}>{busy === "reconcile" ? "Checking order…" : "Verify and link existing order"}</button>
      </form>}
    </>}
  </section>;
}

export default function OrderShippingDashboard({ canManageShipments = false }: { canManageShipments?: boolean }) {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [moreAvailable, setMoreAvailable] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const load = useCallback(async (before?: string): Promise<boolean> => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const deadline = setTimeout(() => controller.abort(), 20_000);
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ limit: "50" });
      if (before) query.set("before", before);
      const response = await fetch(`/api/admin/orders?${query}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setOrders([]);
          setSelectedId(null);
        }
        throw new Error(result.error || "Orders could not be loaded.");
      }
      if (!Array.isArray(result.orders)) throw new Error("Orders could not be loaded. Please retry.");
      if (requestRef.current !== controller) return false;
      const incoming = result.orders as FulfillmentOrder[];
      setOrders((current) => before ? [...current, ...incoming.filter((item) => !current.some((saved) => saved.id === item.id))] : incoming);
      setSelectedId((current) => current && (before || incoming.some((item) => item.id === current)) ? current : incoming[0]?.id ?? null);
      setMoreAvailable(incoming.length === 50);
      return true;
    } catch (caught) {
      if (requestRef.current !== controller) return false;
      setError(controller.signal.aborted ? "Orders took too long to load. Please retry." : caught instanceof Error ? caught.message : "Orders could not be loaded.");
      return false;
    } finally {
      clearTimeout(deadline);
      if (requestRef.current === controller) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); return () => { requestRef.current?.abort(); requestRef.current = null; }; }, [load]);
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return orders.filter((order) => (mode === "all" || order.paymentMode === mode) &&
      (!needle || [order.id, order.customer.name, order.customer.email, order.address.pincode, order.fulfillment.merchantOrderId].some((value) => value.toLowerCase().includes(needle))));
  }, [orders, mode, search]);
  useEffect(() => {
    setSelectedId((current) => filtered.some((order) => order.id === current) ? current : filtered[0]?.id ?? null);
  }, [filtered]);
  // Apply the filter in this render too, before the selection effect runs.
  const selected = filtered.find((order) => order.id === selectedId) ?? filtered[0];
  const ready = orders.filter((order) => order.canCreateShipment).length;
  const created = orders.filter((order) => order.fulfillment.state === "created").length;

  return <OrderShell>
    <div className={styles.heading}><div><span className={styles.eyebrow}>FROM ORDER TO DELIVERY</span><h1>Order shipping</h1><p>Review paid orders and prepare their parcels for Shiprocket.</p></div>
      <button type="button" disabled={loading} onClick={() => void load()} className={styles.secondary}><RefreshCw size={17} className={loading ? styles.spin : undefined} />Refresh</button>
    </div>
    <>
      <div className={styles.stats}><div><span>Orders loaded</span><strong>{orders.length}</strong></div><div><span>Ready to prepare</span><strong>{ready}</strong></div><div><span>Created in Shiprocket</span><strong>{created}</strong></div></div>
      {error && <div className={styles.error} role="alert"><CircleAlert size={18} /><span>{error}</span><button type="button" onClick={() => void load()} disabled={loading}>Retry</button></div>}
      <div className={styles.toolbar}><label className={styles.search}><Search size={18} /><input aria-label="Search orders" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, order or pincode" /></label><label className={styles.modeFilter}>Payments<select value={mode} onChange={(event) => setMode(event.target.value)}><option value="all">All modes</option><option value="live">Live</option><option value="test">Test</option><option value="unknown">Unknown</option></select></label></div>
      {loading && !orders.length ? <div className={styles.empty} role="status"><LoaderCircle className={styles.spin} size={25} /><p>Loading paid orders…</p></div> : !orders.length ? <div className={styles.empty}><Package size={30} /><h2>{error ? "Orders are unavailable" : "No paid orders yet"}</h2><p>{error ? "Refresh the list once access and the connection are available." : "Paid website orders will appear here. Test payments remain clearly marked and cannot be sent for shipping."}</p></div> : <div className={styles.columns}>
        <section className={styles.orderList} aria-label="Paid orders">
          {!filtered.length && <p className={styles.noResults}>No orders match these filters.</p>}
          {filtered.map((order) => <button type="button" key={order.id} onClick={() => setSelectedId(order.id)} aria-pressed={selected?.id === order.id} className={`${styles.orderCard} ${selected?.id === order.id ? styles.selected : ""}`}>
            <div className={styles.orderCardTop}><strong>{order.customer.name}</strong><span>{money(order.amountPaise, order.currency)}</span></div>
            <small className={styles.identifier}>{order.id.slice(0, 8).toUpperCase()} · {orderDate(order.createdAt)}</small>
            <div className={styles.badges}><ModeBadge mode={order.paymentMode} /><span className={`${styles.badge} ${order.fulfillment.state === "created" ? styles.live : styles.neutral}`}>{states[order.fulfillment.state]}</span></div>
            <span className={styles.destination}>{order.address.city} · {order.address.pincode}</span>
          </button>)}
          {moreAvailable && <button type="button" className={styles.secondary} disabled={loading} onClick={() => void load(orders[orders.length - 1]?.createdAt)}>{loading ? "Loading…" : "Load older orders"}</button>}
        </section>
        {selected ? <OrderDetails key={selected.id} order={selected} canManageShipments={canManageShipments} onReload={() => load()} onUpdate={(updated) => setOrders((current) => current.map((order) => order.id === updated.id ? updated : order))} /> : <div className={styles.empty}><Package size={26} /><p>Select an order to view its delivery details.</p></div>}
      </div>}
    </>
  </OrderShell>;
}
