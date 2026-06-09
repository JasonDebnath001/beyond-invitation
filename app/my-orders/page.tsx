import Link from "next/link";
import Image from "next/image";
import { currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { fetchCustomerOrdersByEmail } from "@/lib/erpnext";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatPrice(value: number) {
  return value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value?: string) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getStatusClass(status: string) {
  const value = status.toLowerCase();

  if (value.includes("paid") || value.includes("completed")) {
    return "bg-green-50 text-green-700 border-green-200";
  }

  if (value.includes("pending") || value.includes("draft")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (value.includes("cancel")) {
    return "bg-red-50 text-red-700 border-red-200";
  }

  return "bg-cream text-ink-light border-gold/20";
}

export default async function MyOrdersPage() {
  const user = await currentUser();

  if (!user) {
    redirect("/sign-in?redirect_url=/my-orders");
  }

  const email = user.primaryEmailAddress?.emailAddress;

  if (!email) {
    return (
      <main className="min-h-screen bg-paper px-4 py-12">
        <div className="mx-auto max-w-4xl rounded-3xl border border-gold/20 bg-white p-8 text-center shadow-sm">
          <p className="text-sm uppercase tracking-[0.25em] text-gold">
            My Orders
          </p>

          <h1 className="mt-3 font-serif text-4xl font-semibold text-maroon">
            Email address missing
          </h1>

          <p className="mt-4 text-ink-light">
            We could not find an email address on your account. Please add an
            email address to view your ERPNext order history.
          </p>
        </div>
      </main>
    );
  }

  const orders = await fetchCustomerOrdersByEmail(email);

  return (
    <main className="min-h-screen bg-paper px-4 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-gold">
              My Orders
            </p>

            <h1 className="mt-3 font-serif text-4xl font-semibold text-maroon md:text-5xl">
              Your Order History
            </h1>

            <p className="mt-3 max-w-2xl text-sm text-ink-light">
              Orders are fetched directly from ERPNext using your signed-in
              email address.
            </p>
          </div>

          <Link
            href="/collections/wedding-card"
            className="w-fit rounded-full border border-maroon px-5 py-3 text-sm font-semibold text-maroon transition hover:bg-maroon hover:text-white"
          >
            Continue Shopping
          </Link>
        </div>

        {orders.length === 0 ? (
          <section className="rounded-3xl border border-gold/20 bg-white p-8 text-center shadow-sm">
            <h2 className="font-serif text-3xl font-semibold text-maroon">
              No orders found
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm text-ink-light">
              We could not find any ERPNext Sales Orders connected to{" "}
              <span className="font-medium text-ink">{email}</span>.
            </p>

            <Link
              href="/collections/wedding-card"
              className="mt-6 inline-flex rounded-full bg-maroon px-6 py-3 text-sm font-semibold text-white transition hover:bg-maroon-dark"
            >
              Start Shopping
            </Link>
          </section>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => (
              <article
                key={order.name}
                className="overflow-hidden rounded-3xl border border-gold/20 bg-white shadow-sm"
              >
                <div className="border-b border-gold/15 p-5 md:p-6">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-ink-light">
                        Order ID
                      </p>

                      <h2 className="mt-1 font-serif text-2xl font-semibold text-maroon">
                        {order.name}
                      </h2>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            order.status,
                          )}`}
                        >
                          {order.status}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClass(
                            order.paymentStatus,
                          )}`}
                        >
                          Payment: {order.paymentStatus}
                        </span>
                      </div>
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-3 lg:text-right">
                      <div>
                        <p className="text-ink-light">Ordered On</p>
                        <p className="font-semibold text-ink">
                          {formatDate(order.transactionDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-ink-light">Delivery Date</p>
                        <p className="font-semibold text-ink">
                          {formatDate(order.deliveryDate)}
                        </p>
                      </div>

                      <div>
                        <p className="text-ink-light">Total</p>
                        <p className="font-semibold text-maroon">
                          ₹{formatPrice(order.grandTotal)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-5 md:p-6">
                  <div className="space-y-4">
                    {order.items.map((item) => (
                      <div
                        key={`${order.name}-${item.itemCode}`}
                        className="flex gap-4 rounded-2xl border border-gold/10 bg-cream/30 p-3"
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-white">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={item.itemName}
                              fill
                              className="object-cover"
                              sizes="80px"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xl">
                              ✉️
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/products/${item.slug}`}
                            className="font-semibold text-ink transition hover:text-maroon"
                          >
                            {item.itemName}
                          </Link>

                          <p className="mt-1 text-xs text-ink-light">
                            Item Code: {item.itemCode}
                          </p>

                          <p className="mt-2 text-sm text-ink-light">
                            Qty: {item.qty} × ₹{formatPrice(item.rate)}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-semibold text-maroon">
                            ₹{formatPrice(item.amount)}
                          </p>

                          <Link
                            href={`/products/${item.slug}`}
                            className="mt-2 inline-flex text-xs font-semibold text-maroon hover:text-maroon-dark"
                          >
                            Buy again
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>

                  <details className="mt-5 rounded-2xl border border-gold/15 bg-white">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-maroon">
                      View order details
                    </summary>

                    <div className="space-y-3 border-t border-gold/15 px-4 py-4 text-sm text-ink-light">
                      {order.contactEmail && (
                        <p>
                          <span className="font-semibold text-ink">
                            Email:
                          </span>{" "}
                          {order.contactEmail}
                        </p>
                      )}

                      {order.contactMobile && (
                        <p>
                          <span className="font-semibold text-ink">
                            Mobile:
                          </span>{" "}
                          {order.contactMobile}
                        </p>
                      )}

                      {order.addressDisplay && (
                        <p>
                          <span className="font-semibold text-ink">
                            Address:
                          </span>{" "}
                          {order.addressDisplay}
                        </p>
                      )}

                      {order.razorpayOrderId && (
                        <p>
                          <span className="font-semibold text-ink">
                            Razorpay Order:
                          </span>{" "}
                          {order.razorpayOrderId}
                        </p>
                      )}

                      {order.razorpayPaymentId && (
                        <p>
                          <span className="font-semibold text-ink">
                            Razorpay Payment:
                          </span>{" "}
                          {order.razorpayPaymentId}
                        </p>
                      )}

                      {order.notes && (
                        <p>
                          <span className="font-semibold text-ink">
                            Notes:
                          </span>{" "}
                          {order.notes}
                        </p>
                      )}
                    </div>
                  </details>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}