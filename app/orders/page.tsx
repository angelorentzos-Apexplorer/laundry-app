import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
import { OrderStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  NEW: "Νέα",
  PROCESSING: "Σε επεξεργασία",
  READY: "Έτοιμη",
  DELIVERED: "Παραδόθηκε",
  PAID: "Πληρώθηκε",
};

const serviceLabels: Record<string, string> = {
  CLOTHES: "Ρούχα",
  CARPETS: "Χαλιά",
};

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-4 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

function getDateStart(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDateEnd(value: string) {
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    status?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const q = String(resolvedSearchParams?.q || "").trim();
  const status = String(resolvedSearchParams?.status || "").trim();
  const from = String(resolvedSearchParams?.from || "").trim();
  const to = String(resolvedSearchParams?.to || "").trim();

  const fromDate = from ? getDateStart(from) : null;
  const toDate = to ? getDateEnd(to) : null;

  const validStatuses = Object.values(OrderStatus) as string[];
  const selectedStatus = validStatuses.includes(status) ? status : "";

  const orders = await prisma.order.findMany({
    where: {
      ...(selectedStatus
        ? {
            status: selectedStatus as OrderStatus,
          }
        : {}),

      ...(fromDate || toDate
        ? {
            createdAt: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),

      ...(q
        ? {
            customer: {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { firstName: { contains: q, mode: "insensitive" } },
                { lastName: { contains: q, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Παραγγελίες</h1>
            <p className="text-gray-600">Όλες οι παραγγελίες του καθαριστηρίου</p>
          </div>

          <Link href="/orders/new" className={getButtonClass()}>
            + Νέα Παραγγελία
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <form className="grid gap-4 md:grid-cols-5" method="GET">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">
              Αναζήτηση πελάτη
            </label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Όνομα ή επώνυμο πελάτη..."
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Κατάσταση</label>
            <select
              name="status"
              defaultValue={selectedStatus}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            >
              <option value="">Όλες</option>
              <option value="NEW">Νέα</option>
              <option value="PROCESSING">Σε επεξεργασία</option>
              <option value="READY">Έτοιμη</option>
              <option value="DELIVERED">Παραδόθηκε</option>
              <option value="PAID">Πληρώθηκε</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Από ημερομηνία
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Έως ημερομηνία
            </label>
            <input
              type="date"
              name="to"
              defaultValue={to}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="flex flex-wrap gap-3 md:col-span-5">
            <button type="submit" className={getButtonClass()}>
              Εφαρμογή φίλτρων
            </button>

            {(q || selectedStatus || from || to) && (
              <Link href="/orders" className={getButtonClass()}>
                Καθαρισμός
              </Link>
            )}
          </div>
        </form>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">Πελάτης</th>
              <th className="p-4">Τύπος</th>
              <th className="p-4">Σύνολο</th>
              <th className="p-4">Ημερ/νία Παραλαβής</th>
              <th className="p-4">Ημερ/νία Παράδοσης</th>
              <th className="p-4">Νο Αποθήκευσης</th>
              <th className="p-4">Κατάσταση</th>
            </tr>
          </thead>

          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t">
                <td className="p-4 font-medium">
                  <Link href={`/orders/${order.id}`} className="underline">
                    #{order.id}
                  </Link>
                </td>

                <td className="p-4">{order.customer.fullName || "-"}</td>

                <td className="p-4">
                  {serviceLabels[order.serviceType] || order.serviceType}
                </td>

                <td className="p-4">
                  {order.totalPrice != null
                    ? formatCurrency(order.totalPrice)
                    : "-"}
                </td>

                <td className="p-4">{formatDate(order.createdAt)}</td>

                <td className="p-4">{formatDate(order.deliveryDate)}</td>

                <td className="p-4">{order.storageChainNumber || "-"}</td>

                <td className="p-4">
                  {statusLabels[order.status] || order.status}
                </td>
              </tr>
            ))}

            {orders.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-gray-500">
                  Δεν βρέθηκαν παραγγελίες.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}