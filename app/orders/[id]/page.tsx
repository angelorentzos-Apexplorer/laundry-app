import { prisma } from "@/lib/prisma";
import { sendReadyNotification } from "@/lib/notifications";
import { OrderStatus, ServiceType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import OrderItemStorageForm from "./OrderItemStorageForm";
import OrderStatusActions from "./OrderStatusActions";

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("el-GR");
}

function formatDateForInput(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
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

function deliveryStatusLabel(status: "PENDING" | "DELIVERED") {
  switch (status) {
    case "PENDING":
      return "Σε αναμονή";
    case "DELIVERED":
      return "Παραδόθηκε";
    default:
      return status;
  }
}

function paymentStatusLabel(status: "UNPAID" | "PAID") {
  switch (status) {
    case "UNPAID":
      return "Ανεξόφλητη";
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

const ACTIVE_STORAGE_STATUSES: OrderStatus[] = [
  "NEW",
  "PROCESSING",
  "READY",
  "PAID",
];

type StorageActionState = {
  ok: boolean;
  error: string | null;
};

type GroupedOrderItem = {
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  serials: Array<{
    id: number;
    itemSerialNumber: number | null;
    storageChainNumber: string | null;
  }>;
};

function groupOrderItems(
  orderItems: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    itemSerialNumber: number | null;
    storageChainNumber: string | null;
    product: {
      id: number;
      name: string;
    } | null;
  }>
): GroupedOrderItem[] {
  const map = new Map<string, GroupedOrderItem>();

  for (const item of orderItems) {
    const key = item.product?.id != null ? String(item.product.id) : `unknown-${item.id}`;

    if (!map.has(key)) {
      map.set(key, {
        productId: item.product?.id ?? null,
        productName: item.product?.name || "-",
        quantity: 0,
        unitPrice: item.unitPrice ?? null,
        lineTotal: 0,
        serials: [],
      });
    }

    const group = map.get(key)!;
    group.quantity += item.quantity ?? 1;
    group.lineTotal += item.lineTotal ?? 0;
    group.serials.push({
      id: item.id,
      itemSerialNumber: item.itemSerialNumber,
      storageChainNumber: item.storageChainNumber,
    });
  }

  return Array.from(map.values());
}

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const orderId = Number(resolvedParams.id);

  if (!orderId || Number.isNaN(orderId)) {
    notFound();
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      payments: {
        orderBy: { paymentDate: "desc" },
      },
      orderItems: {
        include: {
          product: true,
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const customerPagePath = `/customers/${order.customer.id}`;

  async function updateOrderItemStorageChainNumber(
    _prevState: StorageActionState,
    formData: FormData
  ): Promise<StorageActionState> {
    "use server";

    const orderItemId = Number(formData.get("orderItemId"));
    const storageChainNumberRaw = String(
      formData.get("storageChainNumber") || ""
    ).trim();

    if (!orderItemId || Number.isNaN(orderItemId)) {
      return { ok: false, error: "Μη έγκυρο προϊόν παραγγελίας." };
    }

    const normalizedStorageChainNumber =
      storageChainNumberRaw.trim().toUpperCase() || null;

    const currentItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      select: {
        id: true,
        orderId: true,
      },
    });

    if (!currentItem || currentItem.orderId !== orderId) {
      return { ok: false, error: "Το προϊόν δεν ανήκει στην τρέχουσα παραγγελία." };
    }

    if (normalizedStorageChainNumber) {
      const existingItem = await prisma.orderItem.findFirst({
        where: {
          id: { not: orderItemId },
          storageChainNumber: normalizedStorageChainNumber,
          order: {
            status: {
              in: ACTIVE_STORAGE_STATUSES,
            },
          },
        },
        select: {
          id: true,
          orderId: true,
        },
      });

      if (existingItem) {
        return {
          ok: false,
          error: `Ο αριθμός αλυσίδας "${normalizedStorageChainNumber}" χρησιμοποιείται ήδη στο προϊόν #${existingItem.id} της παραγγελίας #${existingItem.orderId}.`,
        };
      }
    }

    await prisma.orderItem.update({
      where: { id: orderItemId },
      data: {
        storageChainNumber: normalizedStorageChainNumber,
      },
    });

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);

    return { ok: true, error: null };
  }

  async function addPayment(formData: FormData) {
    "use server";

    const amountRaw = String(formData.get("amount") || "").trim();
    const paymentDateRaw = String(formData.get("paymentDate") || "").trim();
    const paymentNotesRaw = String(formData.get("paymentNotes") || "").trim();

    const shouldReturnToCustomer =
      String(formData.get("returnToCustomer") || "") === "1";

    if (!amountRaw || Number.isNaN(Number(amountRaw))) return;

    const amount = Number(amountRaw);
    if (amount <= 0) return;

    const paymentDate =
      paymentDateRaw && !Number.isNaN(Date.parse(paymentDateRaw))
        ? new Date(paymentDateRaw)
        : new Date();

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        paidAmount: true,
        totalPrice: true,
      },
    });

    if (!currentOrder) return;

    const currentPaidAmount = currentOrder.paidAmount ?? 0;
    const newPaidAmount = currentPaidAmount + amount;

    let nextStatus: OrderStatus | undefined;
    let nextPaymentStatus: "PAID" | undefined;

    if (
      currentOrder.totalPrice != null &&
      newPaidAmount >= currentOrder.totalPrice
    ) {
      nextStatus = "PAID";
      nextPaymentStatus = "PAID";
    }

    await prisma.$transaction([
      prisma.orderPayment.create({
        data: {
          order: {
            connect: { id: orderId },
          },
          amount,
          paymentDate,
          notes: paymentNotesRaw || null,
        },
      }),
      prisma.order.update({
        where: { id: orderId },
        data: {
          paidAmount: newPaidAmount,
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(nextPaymentStatus ? { paymentStatus: nextPaymentStatus } : {}),
        },
      }),
    ]);

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);

    if (shouldReturnToCustomer) {
      redirect(customerPagePath);
    }
  }

  async function updateFinancials(formData: FormData) {
    "use server";

    const totalPriceRaw = String(formData.get("totalPrice") || "").trim();
    const paidAmountRaw = String(formData.get("paidAmount") || "").trim();
    const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();

    const shouldReturnToCustomer =
      String(formData.get("returnToCustomer") || "") === "1";

    const totalPrice =
      totalPriceRaw && !Number.isNaN(Number(totalPriceRaw))
        ? Number(totalPriceRaw)
        : null;

    const paidAmount =
      paidAmountRaw && !Number.isNaN(Number(paidAmountRaw))
        ? Number(paidAmountRaw)
        : null;

    const deliveryDate =
      deliveryDateRaw && !Number.isNaN(Date.parse(deliveryDateRaw))
        ? new Date(deliveryDateRaw)
        : null;

    let nextStatus: OrderStatus | undefined;
    let nextPaymentStatus: "PAID" | "UNPAID" | undefined;

    if (
      totalPrice != null &&
      paidAmount != null &&
      paidAmount >= totalPrice
    ) {
      nextStatus = "PAID";
      nextPaymentStatus = "PAID";
    } else if (paidAmount != null) {
      nextPaymentStatus = "UNPAID";
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        totalPrice,
        paidAmount,
        deliveryDate,
        ...(nextStatus ? { status: nextStatus } : {}),
        ...(nextPaymentStatus ? { paymentStatus: nextPaymentStatus } : {}),
      },
    });

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);

    if (shouldReturnToCustomer) {
      redirect(customerPagePath);
    }
  }

  async function updateStatus(formData: FormData) {
    "use server";

    const statusRaw = String(formData.get("status") || "").trim();
    const sendReadySms =
      String(formData.get("sendReadySms") || "0").trim() === "1";

    if (
      statusRaw !== "NEW" &&
      statusRaw !== "PROCESSING" &&
      statusRaw !== "READY" &&
      statusRaw !== "DELIVERED" &&
      statusRaw !== "PAID"
    ) {
      return;
    }

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        deliveryDate: true,
        customer: {
          select: {
            fullName: true,
            phone: true,
          },
        },
      },
    });

    if (!currentOrder) return;

    if (statusRaw === "DELIVERED") {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: {
            status: "DELIVERED",
            deliveryStatus: "DELIVERED",
          },
        }),
        prisma.orderItem.updateMany({
          where: {
            orderId,
            storageChainNumber: {
              not: null,
            },
          },
          data: {
            storageChainNumber: null,
          },
        }),
      ]);
    } else {
      await prisma.order.update({
        where: { id: orderId },
        data: {
          status: statusRaw as OrderStatus,
          ...(statusRaw === "NEW" ||
          statusRaw === "PROCESSING" ||
          statusRaw === "READY"
            ? { deliveryStatus: "PENDING" as const }
            : {}),
          ...(statusRaw === "PAID" ? { paymentStatus: "PAID" as const } : {}),
        },
      });
    }

    if (
      statusRaw === "READY" &&
      currentOrder.status !== "READY" &&
      sendReadySms
    ) {
      try {
        const notifyResult = await sendReadyNotification({
          customerName: currentOrder.customer.fullName,
          customerPhone: currentOrder.customer.phone,
          orderId,
          deliveryDate: currentOrder.deliveryDate,
        });

        console.log("READY notification result:", notifyResult);
      } catch (error) {
        console.error("READY notification failed:", error);
      }
    }

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);
  }

  async function markDeliveredAndPaid(formData: FormData) {
    "use server";

    const totalPriceRaw = String(formData.get("totalPrice") || "").trim();
    if (!totalPriceRaw || Number.isNaN(Number(totalPriceRaw))) return;

    const totalPrice = Number(totalPriceRaw);
    if (totalPrice < 0) return;

    await prisma.$transaction([
      prisma.order.update({
        where: { id: orderId },
        data: {
          totalPrice,
          paidAmount: totalPrice,
          deliveryStatus: "DELIVERED",
          paymentStatus: "PAID",
          status: "PAID",
        },
      }),
      prisma.orderItem.updateMany({
        where: {
          orderId,
          storageChainNumber: {
            not: null,
          },
        },
        data: {
          storageChainNumber: null,
        },
      }),
    ]);

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);
  }

  const remainingAmount =
    order.totalPrice != null
      ? order.totalPrice - (order.paidAmount ?? 0)
      : null;

  const groupedOrderItems = groupOrderItems(order.orderItems);

  return (
    <main className="max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Παραγγελία #{order.id}</h1>
            <p className="text-gray-600">
              {order.customer.fullName} • {order.customer.phone}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href={`/orders/${order.id}/edit`} className={getButtonClass()}>
              Επεξεργασία παραγγελίας
            </a>

            <a href={customerPagePath} className={getButtonClass()}>
              Επιστροφή στον πελάτη
            </a>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium">
                Διαδικαστικό: {deliveryStatusLabel(order.deliveryStatus)}
              </div>

              <div className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium">
                Οικονομικό: {paymentStatusLabel(order.paymentStatus)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-3 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Στοιχεία παραγγελίας</h2>

        <div>
          <span className="font-medium">Αριθμός παραγγελίας:</span> #{order.id}
        </div>

        <div>
          <span className="font-medium">Πελάτης:</span> {order.customer.fullName}
        </div>

        <div>
          <span className="font-medium">Τηλέφωνο:</span> {order.customer.phone}
        </div>

        <div>
          <span className="font-medium">Υπηρεσία:</span>{" "}
          {serviceTypeLabel(order.serviceType)}
        </div>

        <div>
          <span className="font-medium">Αριθμός μαρκαρίσματος:</span>{" "}
          {order.itemsDescription || "-"}
        </div>

        <div>
          <span className="font-medium">Τεμάχια:</span> {order.quantity ?? "-"}
        </div>

        <div>
          <span className="font-medium">Τετραγωνικά:</span>{" "}
          {order.squareMeters ?? "-"}
        </div>

        <div>
          <span className="font-medium">Ημερομηνία παραλαβής:</span>{" "}
          {formatDate(order.pickupDate)}
        </div>

        <div>
          <span className="font-medium">Ημερομηνία παράδοσης:</span>{" "}
          {formatDate(order.deliveryDate)}
        </div>

        <div>
          <span className="font-medium">Σημειώσεις:</span> {order.notes || "-"}
        </div>

        <div>
          <span className="font-medium">Δημιουργήθηκε:</span>{" "}
          {formatDate(order.createdAt)}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Προϊόντα παραγγελίας</h2>

        {groupedOrderItems.length === 0 ? (
          <p className="text-gray-500">Δεν υπάρχουν καταχωρημένα προϊόντα.</p>
        ) : (
          <div className="space-y-4">
            {groupedOrderItems.map((group, groupIndex) => (
              <div
                key={`${group.productId ?? "x"}-${groupIndex}`}
                className="rounded-xl border bg-gray-50 p-4"
              >
                <div className="mb-4 grid gap-3 md:grid-cols-4">
                  <div>
                    <div className="text-sm text-gray-500">Προϊόν</div>
                    <div className="font-medium">{group.productName}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Τεμάχια</div>
                    <div className="font-medium">{group.quantity}</div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Τιμή μονάδας</div>
                    <div className="font-medium">
                      {formatMoney(group.unitPrice)}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-gray-500">Σύνολο είδους</div>
                    <div className="font-medium">
                      {formatMoney(group.lineTotal)}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm font-medium">Μοναδικοί αριθμοί / αλυσίδες</div>

                  {group.serials.map((serialItem, serialIndex) => (
                    <div
                      key={serialItem.id}
                      className="grid gap-3 rounded-xl border bg-white p-3 md:grid-cols-[140px_1fr]"
                    >
                      <div>
                        <div className="text-sm text-gray-500">Μοναδικός αριθμός</div>
                        <div className="font-medium">
                          {serialItem.itemSerialNumber ?? "-"}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm text-gray-500">Αριθμός αλυσίδας</div>
                        <OrderItemStorageForm
                          orderItemId={serialItem.id}
                          defaultValue={serialItem.storageChainNumber || ""}
                          action={updateOrderItemStorageChainNumber}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Οικονομικά στοιχεία</h2>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm text-gray-500">Συνολικό ποσό</div>
            <div className="text-xl font-bold">{formatMoney(order.totalPrice)}</div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm text-gray-500">Πληρωμένο ποσό</div>
            <div className="text-xl font-bold">{formatMoney(order.paidAmount)}</div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm text-gray-500">Υπόλοιπο</div>
            <div className="text-xl font-bold">
              {remainingAmount == null ? "-" : formatMoney(remainingAmount)}
            </div>
          </div>
        </div>

        <form action={addPayment} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Ποσό πληρωμής</label>
            <input
              name="amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="π.χ. 20"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Ημερομηνία πληρωμής
            </label>
            <input
              name="paymentDate"
              type="date"
              defaultValue={formatDateForInput(new Date())}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Σημείωση πληρωμής</label>
            <input
              name="paymentNotes"
              placeholder="π.χ. 2η προκαταβολή ή εξόφληση"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Καταχώρηση νέας πληρωμής
            </button>

            <button
              type="submit"
              name="returnToCustomer"
              value="1"
              className={getButtonClass()}
            >
              Καταχώρηση πληρωμής και επιστροφή στον πελάτη
            </button>
          </div>
        </form>

        <form action={updateFinancials} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Συνολικό ποσό</label>
            <input
              name="totalPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={order.totalPrice ?? ""}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Πληρωμένο ποσό</label>
            <input
              name="paidAmount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={order.paidAmount ?? ""}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium">Ημερομηνία παράδοσης</label>
            <input
              name="deliveryDate"
              type="date"
              defaultValue={formatDateForInput(order.deliveryDate)}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Αποθήκευση οικονομικών στοιχείων & ημερομηνίας παράδοσης
            </button>

            <button
              type="submit"
              name="returnToCustomer"
              value="1"
              className={getButtonClass()}
            >
              Αποθήκευση και επιστροφή στον πελάτη
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Καρτέλα πληρωμών</h2>

        {order.payments.length === 0 ? (
          <p className="text-gray-500">Δεν υπάρχουν καταχωρημένες πληρωμές.</p>
        ) : (
          <div className="space-y-3">
            {order.payments.map((payment) => (
              <div
                key={payment.id}
                className="rounded-xl border bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium">{formatMoney(payment.amount)}</div>
                  <div className="text-sm text-gray-600">
                    {formatDate(payment.paymentDate)}
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-700">
                  {payment.notes || "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Κατάσταση παραγγελίας</h2>

        <div className="rounded-xl bg-gray-50 p-4">
          <div className="text-sm text-gray-500">Τρέχουσα κατάσταση</div>
          <div className="text-xl font-bold">{statusLabel(order.status)}</div>
        </div>

        <OrderStatusActions
          currentStatus={order.status}
          action={updateStatus}
        />
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Παράδοση και εξόφληση</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm text-gray-500">Κατάσταση παράδοσης</div>
            <div className="text-xl font-bold">
              {deliveryStatusLabel(order.deliveryStatus)}
            </div>
          </div>

          <div className="rounded-xl bg-gray-50 p-4">
            <div className="text-sm text-gray-500">Κατάσταση εξόφλησης</div>
            <div className="text-xl font-bold">
              {paymentStatusLabel(order.paymentStatus)}
            </div>
          </div>
        </div>

        <form action={markDeliveredAndPaid} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Τελική τιμή παραγγελίας
            </label>
            <input
              name="totalPrice"
              type="number"
              min="0"
              step="0.01"
              defaultValue={order.totalPrice ?? ""}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Παράδοση και εξόφληση
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}