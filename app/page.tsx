import Link from "next/link";
import { prisma } from "@/lib/prisma";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-3 py-2 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
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

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = String(resolvedSearchParams?.q || "").trim();

  const numericQuery = Number(q);
  const isNumeric = q !== "" && !Number.isNaN(numericQuery);

  const now = new Date();
  const dayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const [
    totalOrders,
    newOrders,
    readyOrders,
    customersCount,
    ordersTodayCount,
    ordersWeekCount,
    paymentsTodayAgg,
    paymentsMonthAgg,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { status: "READY" } }),
    prisma.customer.count(),
    prisma.order.count({
      where: {
        createdAt: {
          gte: dayStart,
        },
      },
    }),
    prisma.order.count({
      where: {
        createdAt: {
          gte: weekStart,
        },
      },
    }),
    prisma.orderPayment.aggregate({
      where: {
        paymentDate: {
          gte: dayStart,
        },
      },
      _sum: {
        amount: true,
      },
    }),
    prisma.orderPayment.aggregate({
      where: {
        paymentDate: {
          gte: monthStart,
        },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  const cards = [
    { title: "Σύνολο Παραγγελιών", value: totalOrders, href: "/orders" },
    { title: "Νέες Παραγγελίες", value: newOrders, href: "/orders" },
    { title: "Έτοιμες", value: readyOrders, href: "/orders" },
    { title: "Πελάτες", value: customersCount, href: "/customers" },
  ];

  const receiptsToday = paymentsTodayAgg._sum.amount ?? 0;
  const receiptsMonth = paymentsMonthAgg._sum.amount ?? 0;

  let customerResults: Array<{
    id: number;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    phone: string | null;
  }> = [];

  let orderResults: Array<{
    id: number;
    storageChainNumber: string | null;
    itemsDescription: string | null;
    status: string;
    customer: {
      id: number;
      firstName: string | null;
      lastName: string | null;
      fullName: string | null;
      phone: string | null;
    };
    orderItems: Array<{
      id: number;
      itemSerialNumber: number | null;
      product: {
        id: number;
        name: string;
      } | null;
    }>;
  }> = [];

  if (q) {
    [customerResults, orderResults] = await Promise.all([
      prisma.customer.findMany({
        where: {
          OR: [
            { lastName: { contains: q } },
            { fullName: { contains: q } },
            { phone: { contains: q } },
          ],
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          fullName: true,
          phone: true,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
      prisma.order.findMany({
        where: {
          OR: [
            ...(isNumeric ? [{ id: numericQuery }] : []),
            ...(isNumeric
              ? [
                  {
                    orderItems: {
                      some: {
                        itemSerialNumber: numericQuery,
                      },
                    },
                  },
                ]
              : []),
            { storageChainNumber: { contains: q } },
            { itemsDescription: { contains: q } },
            { notes: { contains: q } },
            {
              customer: {
                fullName: { contains: q },
              },
            },
            {
              customer: {
                lastName: { contains: q },
              },
            },
            {
              customer: {
                phone: { contains: q },
              },
            },
          ],
        },
        select: {
          id: true,
          storageChainNumber: true,
          itemsDescription: true,
          status: true,
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              fullName: true,
              phone: true,
            },
          },
          orderItems: {
            select: {
              id: true,
              itemSerialNumber: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { id: "asc" },
          },
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    ]);
  }

  const hasResults = customerResults.length > 0 || orderResults.length > 0;

  return (
    <main className="space-y-8">
      <section className="space-y-5 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Laundry App</h1>
            <p className="text-gray-600">Αναζήτηση Παραγγελίας</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/customers/new" className={getButtonClass()}>
              Νέος πελάτης
            </Link>
            <Link href="/orders/new" className={getButtonClass()}>
              Νέα παραγγελία
            </Link>
            <Link href="/customers" className={getButtonClass()}>
              Πελάτες
            </Link>
          </div>
        </div>

        <form action="/" method="GET" className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Πληκτρολόγησε επώνυμο, τηλέφωνο, Νο αποθήκευσης, περιγραφή ή 4ψήφιο αριθμό..."
            className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
          />

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Αναζήτηση
            </button>

            {q ? (
              <Link href="/" className={getButtonClass()}>
                Καθαρισμός
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="space-y-5 rounded-2xl border bg-white p-6">
        <div>
          <h2 className="text-2xl font-bold">Αποτελέσματα αναζήτησης</h2>
          <p className="mt-2 text-gray-600">
            {q
              ? `Αποτελέσματα για: ${q}`
              : "Πληκτρολόγησε κάτι στην αναζήτηση για να εμφανιστούν αποτελέσματα."}
          </p>
        </div>

        {!q ? null : !hasResults ? (
          <div className="rounded-xl border bg-gray-50 p-5 text-gray-600">
            Δεν υπάρχουν αποτελέσματα.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Πελάτες</h3>

              {customerResults.length === 0 ? (
                <div className="rounded-xl border bg-gray-50 p-4 text-gray-600">
                  Δεν βρέθηκαν πελάτες.
                </div>
              ) : (
                <div className="space-y-3">
                  {customerResults.map((customer) => (
                    <Link
                      key={customer.id}
                      href={`/customers/${customer.id}`}
                      className="block rounded-xl border bg-gray-50 p-4 transition hover:bg-gray-100"
                    >
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-lg font-bold">
                            {customer.fullName ||
                              `${customer.firstName || ""} ${customer.lastName || ""}`.trim() ||
                              `Πελάτης #${customer.id}`}
                          </div>
                          <div className="text-sm text-gray-600">
                            Τηλέφωνο: {customer.phone || "-"}
                          </div>
                        </div>

                        <div className="text-sm text-gray-600">
                          ID πελάτη: #{customer.id}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Παραγγελίες</h3>

              {orderResults.length === 0 ? (
                <div className="rounded-xl border bg-gray-50 p-4 text-gray-600">
                  Δεν βρέθηκαν παραγγελίες.
                </div>
              ) : (
                <div className="space-y-3">
                  {orderResults.map((order) => {
                    const matchedItem =
                      isNumeric && order.orderItems.length > 0
                        ? order.orderItems.find(
                            (item) => item.itemSerialNumber === numericQuery
                          )
                        : null;

                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="block rounded-xl border bg-gray-50 p-4 transition hover:bg-gray-100"
                      >
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="text-lg font-bold">
                              Παραγγελία #{order.id}
                            </div>
                            <div className="text-sm text-gray-600">
                              Πελάτης:{" "}
                              {order.customer.fullName ||
                                `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() ||
                                `Πελάτης #${order.customer.id}`}
                            </div>
                            <div className="text-sm text-gray-600">
                              Τηλέφωνο: {order.customer.phone || "-"}
                            </div>
                            <div className="text-sm text-gray-600">
                              Περιγραφή: {order.itemsDescription || "-"}
                            </div>

                            {matchedItem && (
                              <div className="text-sm text-gray-600">
                                Βρέθηκε από αριθμό προϊόντος:{" "}
                                <span className="font-medium">
                                  {matchedItem.itemSerialNumber}
                                </span>
                                {matchedItem.product?.name
                                  ? ` • ${matchedItem.product.name}`
                                  : ""}
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-sm text-gray-600">
                            <div>Κατάσταση: {order.status}</div>
                            <div>
                              Νο Αποθήκευσης: {order.storageChainNumber || "-"}
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Εφαρμογή παραγγελιοληψίας για καθαριστήριο ρούχων και χαλιών.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <p className="text-sm text-gray-500">{card.title}</p>
            <p className="mt-2 text-3xl font-bold">{card.value}</p>
          </Link>
        ))}
      </div>

      <section className="space-y-5 rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Σύνοψη Analytics</h2>
            <p className="text-gray-600">
              Γρήγορη εικόνα για παραλαβές και εισπράξεις.
            </p>
          </div>

          <Link href="/analytics" className={getButtonClass()}>
            Αναλυτικά στοιχεία
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Παραλαβές σήμερα</p>
            <p className="mt-2 text-3xl font-bold">{ordersTodayCount}</p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Παραλαβές εβδομάδας</p>
            <p className="mt-2 text-3xl font-bold">{ordersWeekCount}</p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Εισπράξεις σήμερα</p>
            <p className="mt-2 text-3xl font-bold">
              {formatMoney(receiptsToday)}
            </p>
          </div>

          <div className="rounded-2xl border bg-gray-50 p-5">
            <p className="text-sm text-gray-500">Εισπράξεις μήνα</p>
            <p className="mt-2 text-3xl font-bold">
              {formatMoney(receiptsMonth)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link
          href="/orders/new"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-xl font-semibold">Νέα Παραγγελία</h2>
          <p className="mt-2 text-gray-600">
            Καταχώρησε νέα παραλαβή ρούχων ή χαλιών.
          </p>
        </Link>

        <Link
          href="/products"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-xl font-semibold">Προϊόντα</h2>
          <p className="mt-2 text-gray-600">Διαχείριση προϊόντων και τιμών.</p>
        </Link>

        <Link
          href="/customers/new"
          className="rounded-2xl border bg-white p-6 shadow-sm transition hover:shadow-md"
        >
          <h2 className="text-xl font-semibold">Νέος Πελάτης</h2>
          <p className="mt-2 text-gray-600">
            Πρόσθεσε νέο πελάτη με στοιχεία επικοινωνίας.
          </p>
        </Link>
      </div>
    </main>
  );
}