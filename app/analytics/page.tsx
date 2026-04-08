import Link from "next/link";
import { prisma } from "@/lib/prisma";

function getButtonClass(isActive = false) {
  return [
    "rounded-xl border border-black px-4 py-3 transition duration-150",
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

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
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

function formatDateForInput(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<{
    period?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const period = String(resolvedSearchParams?.period || "").trim();
  const fromRaw = String(resolvedSearchParams?.from || "").trim();
  const toRaw = String(resolvedSearchParams?.to || "").trim();

  const now = new Date();

  const parsedFrom = parseDateInput(fromRaw);
  const parsedTo = parseDateInput(toRaw);

  let rangeLabel = "Σύνοψη περιόδων";
  let rangeStart: Date;
  let rangeEnd: Date;
  let activePreset: "today" | "week" | "month" | "custom" = "today";

  if (parsedFrom && parsedTo) {
    rangeStart = startOfDay(parsedFrom);
    rangeEnd = endOfDay(parsedTo);
    rangeLabel = `Από ${fromRaw} έως ${toRaw}`;
    activePreset = "custom";
  } else if (period === "week") {
    rangeStart = startOfWeek(now);
    rangeEnd = endOfDay(now);
    rangeLabel = "Εβδομάδα";
    activePreset = "week";
  } else if (period === "month") {
    rangeStart = startOfMonth(now);
    rangeEnd = endOfDay(now);
    rangeLabel = "Μήνας";
    activePreset = "month";
  } else {
    rangeStart = startOfDay(now);
    rangeEnd = endOfDay(now);
    rangeLabel = "Σήμερα";
    activePreset = "today";
  }

  const [orders, payments] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        createdAt: true,
        orderItems: {
          select: {
            quantity: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    prisma.orderPayment.findMany({
      where: {
        paymentDate: {
          gte: rangeStart,
          lte: rangeEnd,
        },
      },
      select: {
        id: true,
        amount: true,
        paymentDate: true,
      },
      orderBy: { paymentDate: "desc" },
    }),
  ]);

  const ordersCount = orders.length;
  const piecesCount = orders.reduce(
    (sum, order) =>
      sum + order.orderItems.reduce((s, item) => s + (item.quantity ?? 0), 0),
    0
  );
  const receiptsTotal = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const paymentsCount = payments.length;

  const detailBaseHref =
    activePreset === "custom"
      ? `/analytics/custom?from=${fromRaw}&to=${toRaw}`
      : `/analytics/${activePreset}`;

  return (
    <main className="space-y-8">
      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics</h1>
            <p className="text-gray-600">
              Επίλεξε preset περίοδο ή δικό σου διάστημα ημερομηνιών.
            </p>
          </div>

          <Link href="/" className={getButtonClass()}>
            Επιστροφή στην αρχική
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/analytics?period=today"
            className={getButtonClass(activePreset === "today")}
          >
            Σήμερα
          </Link>

          <Link
            href="/analytics?period=week"
            className={getButtonClass(activePreset === "week")}
          >
            Εβδομάδα
          </Link>

          <Link
            href="/analytics?period=month"
            className={getButtonClass(activePreset === "month")}
          >
            Μήνας
          </Link>
        </div>

        <form action="/analytics" method="GET" className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <label htmlFor="from" className="block text-sm font-medium">
              Από
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={fromRaw || formatDateForInput(rangeStart)}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="to" className="block text-sm font-medium">
              Έως
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={toRaw || formatDateForInput(rangeEnd)}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="flex items-end gap-3 md:col-span-2">
            <button type="submit" className={getButtonClass()}>
              Προβολή αποτελεσμάτων
            </button>

            <Link href="/analytics?period=today" className={getButtonClass()}>
              Καθαρισμός
            </Link>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div>
          <h2 className="text-2xl font-bold">{rangeLabel}</h2>
          <p className="mt-2 text-gray-600">
            Σύνοψη για την επιλεγμένη χρονική περίοδο.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead>
              <tr className="text-left text-sm text-gray-500">
                <th className="px-4 py-2">Περίοδος</th>
                <th className="px-4 py-2">Παραγγελίες</th>
                <th className="px-4 py-2">Τεμάχια</th>
                <th className="px-4 py-2">Εισπράξεις</th>
                <th className="px-4 py-2">Πληρωμές</th>
              </tr>
            </thead>
            <tbody>
              <tr className="rounded-xl border bg-gray-50">
                <td className="rounded-l-xl px-4 py-3 font-medium">
                  <Link href={detailBaseHref} className="underline">
                    {rangeLabel}
                  </Link>
                </td>
                <td className="px-4 py-3">{ordersCount}</td>
                <td className="px-4 py-3">{piecesCount}</td>
                <td className="px-4 py-3">{formatMoney(receiptsTotal)}</td>
                <td className="rounded-r-xl px-4 py-3">{paymentsCount}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex flex-wrap gap-3">
          <Link
            href={`${detailBaseHref}?view=products`}
            className={getButtonClass()}
          >
            Ανάλυση παραλαβών ανά προϊόν
          </Link>

          <Link
            href={`${detailBaseHref}?view=customers`}
            className={getButtonClass()}
          >
            Εισπράξεις ανά πελάτη
          </Link>
        </div>
      </section>
    </main>
  );
}