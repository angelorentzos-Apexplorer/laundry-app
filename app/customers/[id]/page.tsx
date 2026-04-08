import { prisma } from "@/lib/prisma";
import { OrderStatus, ServiceType } from "@prisma/client";
import { notFound } from "next/navigation";

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("el-GR");
}

function serviceTypeLabel(serviceType: ServiceType) {
  switch (serviceType) {
    case "CLOTHES":
      return "Ρούχα";
    case "CARPETS":
      return "Χαλιά";
    default:
      return serviceType;
  }
}

function statusLabel(status: OrderStatus) {
  switch (status) {
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

function getButtonClass(isActive = false) {
  return [
    "rounded-xl border border-black px-4 py-3 transition duration-150",
    isActive
      ? "bg-black text-white"
      : "bg-white text-black hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white",
  ].join(" ");
}

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const customerId = Number(resolvedParams.id);
  const activeTab =
    resolvedSearchParams?.tab === "payments" ||
    resolvedSearchParams?.tab === "open"
      ? resolvedSearchParams.tab
      : "orders";

  if (!customerId || Number.isNaN(customerId)) {
    notFound();
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        include: {
          payments: {
            orderBy: { paymentDate: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const allOrders = customer.orders;

  const openOrders = allOrders.filter((order) =>
    ["NEW", "PROCESSING", "READY"].includes(order.status)
  );

  const allPayments = allOrders
    .flatMap((order) =>
      order.payments.map((payment) => ({
        ...payment,
        orderId: order.id,
        orderStatus: order.status,
        serviceType: order.serviceType,
      }))
    )
    .sort(
      (a, b) =>
        new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
    );

  const totalOrdersAmount = allOrders.reduce(
    (sum, order) => sum + (order.totalPrice ?? 0),
    0
  );

  const totalPaidAmount = allOrders.reduce(
    (sum, order) => sum + (order.paidAmount ?? 0),
    0
  );

  const totalRemainingAmount = totalOrdersAmount - totalPaidAmount;

  return (
    <main className="max-w-6xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{customer.fullName}</h1>
            <p className="text-gray-600">{customer.phone}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href={`/customers/${customer.id}/edit`}
              className={getButtonClass()}
            >
              Επεξεργασία πελάτη
            </a>

            <a
              href={`/orders/new?customerId=${customer.id}`}
              className={getButtonClass()}
            >
              Νέα παραγγελία
            </a>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-lg font-bold">Στοιχεία πελάτη</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="font-medium">Κωδικός πελάτη:</span> #{customer.id}
          </div>

          <div>
            <span className="font-medium">Ονοματεπώνυμο:</span>{" "}
            {customer.fullName}
          </div>

          <div>
            <span className="font-medium">Τηλέφωνο:</span> {customer.phone}
          </div>

          {"createdAt" in customer && (
            <div>
              <span className="font-medium">Ημερομηνία δημιουργίας:</span>{" "}
              {formatDate((customer as any).createdAt)}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Ανοιχτές παραγγελίες</h2>

          <a
            href={`/customers/${customer.id}?tab=open`}
            className={getButtonClass()}
          >
            Προβολή όλων
          </a>
        </div>

        {openOrders.length === 0 ? (
          <p className="text-gray-500">
            Δεν υπάρχουν ανοιχτές παραγγελίες προς παράδοση.
          </p>
        ) : (
          <div className="space-y-3">
            {openOrders.slice(0, 5).map((order) => {
              const remaining =
                (order.totalPrice ?? 0) - (order.paidAmount ?? 0);

              return (
                <a
                  key={order.id}
                  href={`/orders/${order.id}`}
                  className="block rounded-xl border bg-gray-50 p-4 transition hover:bg-gray-100"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="space-y-1">
                      <div className="text-lg font-bold">
                        Παραγγελία #{order.id}
                      </div>

                      <div className="text-sm text-gray-600">
                        Υπηρεσία: {serviceTypeLabel(order.serviceType)}
                      </div>

                      <div className="text-sm text-gray-600">
                        Κατάσταση: {statusLabel(order.status)}
                      </div>

                      <div className="text-sm text-gray-600">
                        Παράδοση: {formatDate(order.deliveryDate)}
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm md:min-w-[220px]">
                      <div>
                        <span className="font-medium">Σύνολο:</span>{" "}
                        {formatMoney(order.totalPrice)}
                      </div>
                      <div>
                        <span className="font-medium">Πληρωμένο:</span>{" "}
                        {formatMoney(order.paidAmount)}
                      </div>
                      <div>
                        <span className="font-medium">Υπόλοιπο:</span>{" "}
                        {formatMoney(remaining)}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6">
          <div className="text-sm text-gray-500">Συνολική αξία</div>
          <div className="mt-2 text-2xl font-bold">
            {formatMoney(totalOrdersAmount)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <div className="text-sm text-gray-500">Συνολικές πληρωμές</div>
          <div className="mt-2 text-2xl font-bold">
            {formatMoney(totalPaidAmount)}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <div className="text-sm text-gray-500">Υπόλοιπο πελάτη</div>
          <div className="mt-2 text-2xl font-bold">
            {formatMoney(totalRemainingAmount)}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <div className="flex flex-wrap gap-3">
          <a
            href={`/customers/${customer.id}?tab=orders`}
            className={getButtonClass(activeTab === "orders")}
          >
            Παραγγελίες
          </a>

          <a
            href={`/customers/${customer.id}?tab=open`}
            className={getButtonClass(activeTab === "open")}
          >
            Ανοιχτές / προς παράδοση
          </a>

          <a
            href={`/customers/${customer.id}?tab=payments`}
            className={getButtonClass(activeTab === "payments")}
          >
            Πληρωμές
          </a>
        </div>

        {activeTab === "orders" && (
          <div className="space-y-4">
            {allOrders.length === 0 ? (
              <p className="text-gray-500">Δεν υπάρχουν παραγγελίες.</p>
            ) : (
              <div className="space-y-3">
                {allOrders.map((order) => {
                  const remaining =
                    (order.totalPrice ?? 0) - (order.paidAmount ?? 0);

                  return (
                    <a
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="block rounded-xl border bg-gray-50 p-4 transition hover:bg-gray-100"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="text-lg font-bold">
                            Παραγγελία #{order.id}
                          </div>

                          <div className="text-sm text-gray-600">
                            Υπηρεσία: {serviceTypeLabel(order.serviceType)}
                          </div>

                          <div className="text-sm text-gray-600">
                            Κατάσταση: {statusLabel(order.status)}
                          </div>

                          <div className="text-sm text-gray-600">
                            Παράδοση: {formatDate(order.deliveryDate)}
                          </div>

                          <div className="text-sm text-gray-600">
                            Περιγραφή: {order.itemsDescription || "-"}
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm md:min-w-[220px]">
                          <div>
                            <span className="font-medium">Σύνολο:</span>{" "}
                            {formatMoney(order.totalPrice)}
                          </div>
                          <div>
                            <span className="font-medium">Πληρωμένο:</span>{" "}
                            {formatMoney(order.paidAmount)}
                          </div>
                          <div>
                            <span className="font-medium">Υπόλοιπο:</span>{" "}
                            {formatMoney(remaining)}
                          </div>
                          <div>
                            <span className="font-medium">Αποθήκευση:</span>{" "}
                            {order.storageChainNumber || "-"}
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "open" && (
          <div className="space-y-4">
            {openOrders.length === 0 ? (
              <p className="text-gray-500">
                Δεν υπάρχουν ανοιχτές παραγγελίες προς παράδοση.
              </p>
            ) : (
              <div className="space-y-3">
                {openOrders.map((order) => {
                  const remaining =
                    (order.totalPrice ?? 0) - (order.paidAmount ?? 0);

                  return (
                    <a
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="block rounded-xl border bg-gray-50 p-4 transition hover:bg-gray-100"
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="space-y-1">
                          <div className="text-lg font-bold">
                            Παραγγελία #{order.id}
                          </div>

                          <div className="text-sm text-gray-600">
                            Υπηρεσία: {serviceTypeLabel(order.serviceType)}
                          </div>

                          <div className="text-sm text-gray-600">
                            Κατάσταση: {statusLabel(order.status)}
                          </div>

                          <div className="text-sm text-gray-600">
                            Παράδοση: {formatDate(order.deliveryDate)}
                          </div>
                        </div>

                        <div className="grid gap-2 text-sm md:min-w-[220px]">
                          <div>
                            <span className="font-medium">Σύνολο:</span>{" "}
                            {formatMoney(order.totalPrice)}
                          </div>
                          <div>
                            <span className="font-medium">Πληρωμένο:</span>{" "}
                            {formatMoney(order.paidAmount)}
                          </div>
                          <div>
                            <span className="font-medium">Υπόλοιπο:</span>{" "}
                            {formatMoney(remaining)}
                          </div>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "payments" && (
          <div className="space-y-4">
            {allPayments.length === 0 ? (
              <p className="text-gray-500">Δεν υπάρχουν καταχωρημένες πληρωμές.</p>
            ) : (
              <div className="space-y-3">
                {allPayments.map((payment) => (
                  <div
                    key={payment.id}
                    className="rounded-xl border bg-gray-50 p-4"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-1">
                        <div className="text-lg font-bold">
                          {formatMoney(payment.amount)}
                        </div>

                        <div className="text-sm text-gray-600">
                          Ημερομηνία: {formatDate(payment.paymentDate)}
                        </div>

                        <div className="text-sm text-gray-600">
                          Παραγγελία:{" "}
                          <a
                            href={`/orders/${payment.orderId}`}
                            className="underline"
                          >
                            #{payment.orderId}
                          </a>
                        </div>

                        <div className="text-sm text-gray-600">
                          Υπηρεσία: {serviceTypeLabel(payment.serviceType)}
                        </div>

                        <div className="text-sm text-gray-600">
                          Κατάσταση παραγγελίας:{" "}
                          {statusLabel(payment.orderStatus)}
                        </div>
                      </div>

                      <div className="md:max-w-[320px] text-sm text-gray-700">
                        {payment.notes || "-"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}