import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

function getButtonClass(isActive = false) {
  return [
    "rounded-xl border border-black px-4 py-3 text-black transition duration-150",
    isActive
      ? "bg-black text-white"
      : "bg-white text-black hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white",
  ].join(" ");
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getPeriodMeta(period: string) {
  const now = new Date();

  if (period === "today") {
    return {
      label: "Σήμερα",
      start: startOfDay(now),
      end: endOfDay(now),
    };
  }

  if (period === "week") {
    return {
      label: "Εβδομάδα",
      start: startOfWeek(now),
      end: endOfDay(now),
    };
  }

  if (period === "month") {
    return {
      label: "Μήνας",
      start: startOfMonth(now),
      end: endOfDay(now),
    };
  }

  return null;
}

export default async function AnalyticsPeriodPage({
  params,
  searchParams,
}: {
  params: Promise<{ period: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const meta = getPeriodMeta(resolvedParams.period);
  if (!meta) notFound();

  const activeView =
    resolvedSearchParams?.view === "customers" ? "customers" : "products";

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: meta.start,
          lte: meta.end,
        },
      },
      select: {
        id: true,
        orderItems: {
          select: {
            quantity: true,
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.orderPayment.findMany({
      where: {
        paymentDate: {
          gte: meta.start,
          lte: meta.end,
        },
      },
      select: {
        id: true,
        amount: true,
        order: {
          select: {
            customer: {
              select: {
                id: true,
                fullName: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    }),
  ]);

  const productMap = new Map<
    string,
    {
      productName: string;
      pieces: number;
    }
  >();

  for (const order of orders) {
    for (const item of order.orderItems) {
      const productName = item.product?.name || "Χωρίς όνομα προϊόντος";
      const existing = productMap.get(productName);

      if (existing) {
        existing.pieces += item.quantity ?? 0;
      } else {
        productMap.set(productName, {
          productName,
          pieces: item.quantity ?? 0,
        });
      }
    }
  }

  const productRows = Array.from(productMap.values()).sort(
    (a, b) => b.pieces - a.pieces
  );

  const customerMap = new Map<
    number,
    {
      customerId: number;
      customerName: string;
      phone: string;
      amount: number;
      paymentsCount: number;
    }
  >();

  for (const payment of payments) {
    const customer = payment.order.customer;
    const customerName =
      customer.fullName ||
      `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
      `Πελάτης #${customer.id}`;

    const existing = customerMap.get(customer.id);

    if (existing) {
      existing.amount += payment.amount;
      existing.paymentsCount += 1;
    } else {
      customerMap.set(customer.id, {
        customerId: customer.id,
        customerName,
        phone: customer.phone || "-",
        amount: payment.amount,
        paymentsCount: 1,
      });
    }
  }

  const customerRows = Array.from(customerMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  const totalPieces = productRows.reduce((sum, row) => sum + row.pieces, 0);
  const totalReceipts = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics - {meta.label}</h1>
            <p className="text-gray-600">
              Σύνοψη και ανάλυση για την περίοδο: {meta.label}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/analytics" className={getButtonClass()}>
              Επιστροφή στα analytics
            </Link>
            <Link href="/" className={getButtonClass()}>
              Αρχική
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-2xl font-bold">Σύνοψη περιόδου</h2>
          <p className="text-gray-600">
            Γρήγορη εικόνα για την επιλεγμένη χρονική περίοδο.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Παραγγελίες</p>
            <p className="mt-2 text-3xl font-bold">{orders.length}</p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Σύνολο τεμαχίων</p>
            <p className="mt-2 text-3xl font-bold">{totalPieces}</p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Εισπράξεις</p>
            <p className="mt-2 text-3xl font-bold">{formatMoney(totalReceipts)}</p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Πληρωμές</p>
            <p className="mt-2 text-3xl font-bold">{payments.length}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/analytics/${resolvedParams.period}?view=products`}
            className={getButtonClass(activeView === "products")}
          >
            Ανάλυση παραλαβών ανά προϊόν
          </Link>

          <Link
            href={`/analytics/${resolvedParams.period}?view=customers`}
            className={getButtonClass(activeView === "customers")}
          >
            Εισπράξεις ανά πελάτη
          </Link>
        </div>

        {activeView === "products" ? (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Παραλαβές ανά προϊόν</h2>
              <p className="text-gray-600">
                Πόσα τεμάχια παραλήφθηκαν ανά προϊόν στην περίοδο {meta.label}.
              </p>
            </div>

            {productRows.length === 0 ? (
              <div className="rounded-xl border bg-gray-50 p-4 text-gray-600">
                Δεν υπάρχουν παραλαβές προϊόντων για την περίοδο αυτή.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-sm text-gray-500">
                      <th className="px-4 py-2">Προϊόν</th>
                      <th className="px-4 py-2">Τεμάχια</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productRows.map((row) => (
                      <tr key={row.productName} className="rounded-xl border bg-gray-50">
                        <td className="rounded-l-xl px-4 py-3">{row.productName}</td>
                        <td className="rounded-r-xl px-4 py-3 font-medium">
                          {row.pieces}
                        </td>
                      </tr>
                    ))}
                    <tr className="rounded-xl border bg-white">
                      <td className="rounded-l-xl px-4 py-3 font-bold">Σύνολο</td>
                      <td className="rounded-r-xl px-4 py-3 font-bold">
                        {totalPieces}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold">Εισπράξεις ανά πελάτη</h2>
              <p className="text-gray-600">
                Ποιοι πελάτες πλήρωσαν στην περίοδο {meta.label}.
              </p>
            </div>

            {customerRows.length === 0 ? (
              <div className="rounded-xl border bg-gray-50 p-4 text-gray-600">
                Δεν υπάρχουν εισπράξεις πελατών για την περίοδο αυτή.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-y-2">
                  <thead>
                    <tr className="text-left text-sm text-gray-500">
                      <th className="px-4 py-2">Πελάτης</th>
                      <th className="px-4 py-2">Τηλέφωνο</th>
                      <th className="px-4 py-2">Πληρωμές</th>
                      <th className="px-4 py-2">Σύνολο</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerRows.map((row) => (
                      <tr key={row.customerId} className="rounded-xl border bg-gray-50">
                        <td className="rounded-l-xl px-4 py-3">
                          <Link
                            href={`/customers/${row.customerId}`}
                            className="underline"
                          >
                            {row.customerName}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{row.phone}</td>
                        <td className="px-4 py-3">{row.paymentsCount}</td>
                        <td className="rounded-r-xl px-4 py-3 font-medium">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                    <tr className="rounded-xl border bg-white">
                      <td className="rounded-l-xl px-4 py-3 font-bold">Σύνολο</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 font-bold">{payments.length}</td>
                      <td className="rounded-r-xl px-4 py-3 font-bold">
                        {formatMoney(totalReceipts)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-xl font-bold">Τελική σύνοψη</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Σύνολο τεμαχίων</p>
            <p className="mt-2 text-3xl font-bold">{totalPieces}</p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Σύνολο εισπράξεων</p>
            <p className="mt-2 text-3xl font-bold">{formatMoney(totalReceipts)}</p>
          </div>
        </div>
      </section>
    </main>
  );
}