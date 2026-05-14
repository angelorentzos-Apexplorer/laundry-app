import { prisma } from "@/lib/prisma";
import { OrderStatus, ServiceType } from "@prisma/client";
import { notFound } from "next/navigation";
import StatementPrintButton from "./StatementPrintButton";

export const dynamic = "force-dynamic";

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("el-GR");
}

function getDateStart(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getDateEnd(value: string) {
  const d = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function serviceTypeLabel(serviceType: ServiceType) {
  switch (serviceType) {
    case "CLOTHES":
      return "Ρούχα";
    case "CARPETS":
      return "Χαλιά";
    case "LINEN":
      return "Ιματισμός";
    default:
      return serviceType;
  }
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case "DRAFT":
      return "Προσωρινή";
    case "NEW":
      return "Νέα";
    case "PROCESSING":
      return "Σε επεξεργασία";
    case "READY":
      return "Έτοιμη";
    case "DELIVERED":
      return "Παραδόθηκε";
    case "PAID":
      return "Εξοφλημένη";
    default:
      return status;
  }
}

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-4 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

type Movement = {
  date: Date;
  type: string;
  orderId: number;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

export default async function CustomerStatementPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ from?: string; to?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const customerId = Number(resolvedParams.id);
  if (!customerId || Number.isNaN(customerId)) notFound();

  const from = String(resolvedSearchParams?.from || "").trim();
  const to = String(resolvedSearchParams?.to || "").trim();

  const fromDate = from ? getDateStart(from) : null;
  const toDate = to ? getDateEnd(to) : null;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        where: { isDeleted: false },
        include: {
          payments: {
            orderBy: { paymentDate: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!customer) notFound();

  const finalOrders = customer.orders.filter(
    (order) => order.status !== ("DRAFT" as OrderStatus)
  );

  const openOrders = finalOrders.filter((order) => {
    const remaining = (order.totalPrice ?? 0) - (order.paidAmount ?? 0);

    return (
      order.status !== "DELIVERED" ||
      order.paymentStatus !== "PAID" ||
      remaining > 0
    );
  });

  const deliveredOrders = finalOrders.filter(
    (order) => order.deliveryStatus === "DELIVERED"
  );

  const totalOrdersAmount = finalOrders.reduce(
    (sum, order) => sum + (order.totalPrice ?? 0),
    0
  );

  const totalPaidAmount = finalOrders.reduce(
    (sum, order) => sum + (order.paidAmount ?? 0),
    0
  );

  const totalRemainingAmount = totalOrdersAmount - totalPaidAmount;

  const rawMovements: Omit<Movement, "balance">[] = [];

  for (const order of customer.orders) {
    const isDraft = order.status === ("DRAFT" as OrderStatus);

    if (isDraft) {
      rawMovements.push({
        date: order.createdAt,
        type: "Προσωρινή παραγγελία",
        orderId: order.id,
        description: `${serviceTypeLabel(order.serviceType)} • ${statusLabel(order.status)}`,
        debit: 0,
        credit: 0,
      });
      continue;
    }

    rawMovements.push({
      date: order.pickupDate || order.createdAt,
      type: "Παραλαβή",
      orderId: order.id,
      description: `${serviceTypeLabel(order.serviceType)} • ${order.itemsDescription || "-"}`,
      debit: order.totalPrice ?? 0,
      credit: 0,
    });

    if (order.deliveryDate) {
      rawMovements.push({
        date: order.deliveryDate,
        type: "Παράδοση",
        orderId: order.id,
        description: `Παράδοση παραγγελίας • ${statusLabel(order.status)}`,
        debit: 0,
        credit: 0,
      });
    }

    for (const payment of order.payments) {
      rawMovements.push({
        date: payment.paymentDate,
        type: "Πληρωμή",
        orderId: order.id,
        description: payment.notes || "Πληρωμή παραγγελίας",
        debit: 0,
        credit: payment.amount,
      });
    }
  }

  const filteredRawMovements = rawMovements
    .filter((movement) => {
      const time = movement.date.getTime();
      if (fromDate && time < fromDate.getTime()) return false;
      if (toDate && time > toDate.getTime()) return false;
      return true;
    })
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let runningBalance = 0;

  const movements: Movement[] = filteredRawMovements.map((movement) => {
    runningBalance += movement.debit - movement.credit;
    return { ...movement, balance: runningBalance };
  });

  const periodText =
    from || to
      ? `${from ? formatDate(from) : "Αρχή"} - ${to ? formatDate(to) : "Σήμερα"}`
      : "Όλη η περίοδος";

  return (
    <main className="statement-page space-y-6">
      <section className="no-print rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Καρτέλα κίνησης πελάτη</h1>
            <p className="text-gray-600">
              {customer.fullName} • {customer.phone || "-"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href={`/customers/${customer.id}`} className={getButtonClass()}>
              Επιστροφή στον πελάτη
            </a>
            <StatementPrintButton />
          </div>
        </div>
      </section>

      <section className="no-print rounded-2xl border bg-white p-6">
        <form method="GET" className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Από ημερομηνία
            </label>
            <input
              type="date"
              name="from"
              defaultValue={from}
              className="w-full rounded-xl border px-4 py-3"
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
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="flex items-end gap-3 md:col-span-2">
            <button type="submit" className={getButtonClass()}>
              Εφαρμογή
            </button>

            {(from || to) && (
              <a
                href={`/customers/${customer.id}/statement`}
                className={getButtonClass()}
              >
                Καθαρισμός
              </a>
            )}
          </div>
        </form>
      </section>

      <section className="statement-report rounded-2xl border bg-white p-8">
        <div className="statement-header mb-6 flex items-start justify-between border-b pb-4">
          <div className="flex items-start gap-4">
            <img
              src="/logo.png"
              alt="Logo"
              className="statement-logo h-16 w-auto object-contain"
            />

            <div>
              <h1 className="text-xl font-bold">ΚΑΡΤΕΛΑ ΚΙΝΗΣΗΣ ΠΕΛΑΤΗ</h1>
              <p className="mt-1 text-sm text-gray-600">
                Περίοδος: {periodText}
              </p>
              <p className="text-sm text-gray-600">
                Ημερομηνία έκδοσης: {formatDate(new Date())}
              </p>
            </div>
          </div>

          <div className="statement-business text-right text-sm">
            <div className="font-bold">Laundry Admin</div>
            <div>Καθαριστήριο</div>
            <div>Τηλ.: -</div>
            <div>ΑΦΜ: -</div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border bg-gray-50 p-4">
            <h2 className="mb-2 font-bold">Στοιχεία πελάτη</h2>
            <div className="text-sm">Κωδικός: #{customer.id}</div>
            <div className="text-sm">Ονοματεπώνυμο: {customer.fullName || "-"}</div>
            <div className="text-sm">Τηλέφωνο: {customer.phone || "-"}</div>
            <div className="text-sm">Διεύθυνση: {customer.address || "-"}</div>
          </div>

          <div className="rounded-xl border bg-gray-50 p-4">
            <h2 className="mb-2 font-bold">Σύνοψη</h2>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Σύνολο αξίας:</div>
              <div className="text-right font-medium">{formatMoney(totalOrdersAmount)}</div>

              <div>Σύνολο πληρωμών:</div>
              <div className="text-right font-medium">{formatMoney(totalPaidAmount)}</div>

              <div>Ανοιχτό υπόλοιπο:</div>
              <div className="text-right font-bold">{formatMoney(totalRemainingAmount)}</div>

              <div>Ανοιχτές παραγγελίες:</div>
              <div className="text-right font-medium">{openOrders.length}</div>

              <div>Παραδομένες:</div>
              <div className="text-right font-medium">{deliveredOrders.length}</div>
            </div>
          </div>
        </div>

        <h2 className="mb-3 text-lg font-bold">Αναλυτικές κινήσεις</h2>

        <div className="overflow-x-auto">
          <table className="statement-table w-full min-w-[900px] text-sm">
            <thead>
              <tr>
                <th>Ημερομηνία</th>
                <th>Κίνηση</th>
                <th>Παραγγελία</th>
                <th>Περιγραφή</th>
                <th className="text-right">Χρέωση</th>
                <th className="text-right">Πίστωση</th>
                <th className="text-right">Υπόλοιπο</th>
              </tr>
            </thead>

            <tbody>
              {movements.map((movement, index) => (
                <tr key={`${movement.orderId}-${movement.type}-${index}`}>
                  <td>{formatDate(movement.date)}</td>
                  <td>{movement.type}</td>
                  <td>#{movement.orderId}</td>
                  <td>{movement.description}</td>
                  <td className="text-right">
                    {movement.debit > 0 ? formatMoney(movement.debit) : "-"}
                  </td>
                  <td className="text-right">
                    {movement.credit > 0 ? formatMoney(movement.credit) : "-"}
                  </td>
                  <td className="text-right font-medium">
                    {formatMoney(movement.balance)}
                  </td>
                </tr>
              ))}

              {movements.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    Δεν υπάρχουν κινήσεις για το επιλεγμένο διάστημα.
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan={4} className="text-right font-bold">
                  Σύνολα
                </td>
                <td className="text-right font-bold">
                  {formatMoney(
                    movements.reduce((sum, movement) => sum + movement.debit, 0)
                  )}
                </td>
                <td className="text-right font-bold">
                  {formatMoney(
                    movements.reduce((sum, movement) => sum + movement.credit, 0)
                  )}
                </td>
                <td className="text-right font-bold">
                  {formatMoney(runningBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-10 text-sm">
          <div className="pt-10 text-center">
            <div className="border-t pt-2">Υπογραφή πελάτη</div>
          </div>

          <div className="pt-10 text-center">
            <div className="border-t pt-2">Υπογραφή / Σφραγίδα καταστήματος</div>
          </div>
        </div>
      </section>
    </main>
  );
}