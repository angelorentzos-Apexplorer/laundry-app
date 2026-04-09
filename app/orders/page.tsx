import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency, formatDate } from "@/lib/format";
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

export default async function OrdersPage() {
  const orders = await prisma.order.findMany({
    include: { customer: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Παραγγελίες</h1>
          <p className="text-gray-600">Όλες οι παραγγελίες του καθαριστηρίου</p>
        </div>

        <Link
          href="/orders/new"
          className="rounded-xl bg-black px-4 py-2 text-white"
        >
          + Νέα Παραγγελία
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">Πελάτης</th>
              <th className="p-4">Τύπος</th>
              <th className="p-4">Σύνολο</th>
              <th className="p-4">Ημερ/νία Παράδοσης</th>
              <th className="p-4">Νο Αποθηκευσης</th>
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
                  {order.totalPrice != null ? formatCurrency(order.totalPrice) : "-"}
                </td>
                <td className="p-4">{formatDate(order.deliveryDate)}</td>
                <td className="p-4">{order.storageChainNumber || "-"}</td>
                <td className="p-4">
                  {statusLabels[order.status] || order.status}
                </td>
              </tr>
            ))}

            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  Δεν υπάρχουν παραγγελίες ακόμη
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}