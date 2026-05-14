import { prisma } from "@/lib/prisma";
import { sendReadyNotification } from "@/lib/notifications";
import { OrderStatus, Prisma, ServiceType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import OrderItemStorageForm from "./OrderItemStorageForm";
import OrderStatusActions from "./OrderStatusActions";
import DeleteOrderButton from "./DeleteOrderButton";

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("el-GR");
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";

  return new Date(value).toLocaleString("el-GR", {
    dateStyle: "short",
    timeStyle: "short",
  });
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

async function getNextSerial(
  tx: Prisma.TransactionClient,
  serviceType: ServiceType
) {
  const sequenceKey =
    serviceType === "CARPETS"
      ? "order_item_serial_carpets"
      : serviceType === "LINEN"
        ? "order_item_serial_linen"
        : "order_item_serial_clothes";

  const startValue =
    serviceType === "CARPETS" ? 22000 : serviceType === "LINEN" ? 50000 : 1000;

  const existing = await tx.appSequence.findUnique({
    where: { key: sequenceKey },
  });

  if (!existing) {
    await tx.appSequence.create({
      data: {
        key: sequenceKey,
        value: startValue,
      },
    });

    return startValue;
  }

  const nextValue = existing.value + 1;

  await tx.appSequence.update({
    where: { key: sequenceKey },
    data: { value: nextValue },
  });

  return nextValue;
}

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

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      isDeleted: false,
    },
    include: {
      customer: true,
      payments: {
        orderBy: { paymentDate: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "desc" },
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
            isDeleted: false,
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

    const currentOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        isDeleted: false,
      },
      select: {
        status: true,
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
          orderId,
          amount,
          paymentDate,
          notes: paymentNotesRaw || "Καταχώρηση πληρωμής",
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

      ...(nextStatus && currentOrder.status !== nextStatus
        ? [
            prisma.orderStatusHistory.create({
              data: {
                orderId,
                status: nextStatus,
                notes: "Η παραγγελία εξοφλήθηκε μέσω καταχώρησης πληρωμής.",
              },
            }),
          ]
        : []),
    ]);

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);
    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/orders");

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

    const currentOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        isDeleted: false,
      },
      select: {
        status: true,
        paidAmount: true,
      },
    });

    if (!currentOrder) return;

    const previousPaidAmount = currentOrder.paidAmount ?? 0;
    const nextPaidAmount = paidAmount ?? 0;
    const paymentDifference = nextPaidAmount - previousPaidAmount;

    let nextStatus: OrderStatus | undefined;
    let nextPaymentStatus: "PAID" | "UNPAID" | undefined;

    if (totalPrice != null && paidAmount != null && paidAmount >= totalPrice) {
      nextStatus = "PAID";
      nextPaymentStatus = "PAID";
    } else if (paidAmount != null) {
      nextPaymentStatus = "UNPAID";
    }

    await prisma.$transaction([
      ...(paymentDifference > 0
        ? [
            prisma.orderPayment.create({
              data: {
                orderId,
                amount: paymentDifference,
                paymentDate: new Date(),
                notes: "Ενημέρωση πληρωμένου ποσού από οικονομικά στοιχεία.",
              },
            }),
          ]
        : []),

      prisma.order.update({
        where: { id: orderId },
        data: {
          totalPrice,
          paidAmount,
          deliveryDate,
          ...(nextStatus ? { status: nextStatus } : {}),
          ...(nextPaymentStatus ? { paymentStatus: nextPaymentStatus } : {}),
        },
      }),

      ...(nextStatus && currentOrder.status !== nextStatus
        ? [
            prisma.orderStatusHistory.create({
              data: {
                orderId,
                status: nextStatus,
                notes: "Η παραγγελία χαρακτηρίστηκε εξοφλημένη από οικονομικά στοιχεία.",
              },
            }),
          ]
        : []),
    ]);

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);
    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/orders");

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

    const nextStatus = statusRaw as OrderStatus;

    const currentOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        isDeleted: false,
      },
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
    if (currentOrder.status === nextStatus) return;
    if (currentOrder.status === "DRAFT") return;

    if (nextStatus === "DELIVERED") {
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

        prisma.orderStatusHistory.create({
          data: {
            orderId,
            status: "DELIVERED",
            notes: "Η παραγγελία παραδόθηκε.",
          },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: orderId },
          data: {
            status: nextStatus,
            ...(nextStatus === "NEW" ||
            nextStatus === "PROCESSING" ||
            nextStatus === "READY"
              ? { deliveryStatus: "PENDING" as const }
              : {}),
            ...(nextStatus === "PAID" ? { paymentStatus: "PAID" as const } : {}),
          },
        }),

        prisma.orderStatusHistory.create({
          data: {
            orderId,
            status: nextStatus,
            notes: "Αλλαγή κατάστασης παραγγελίας.",
          },
        }),
      ]);
    }

    if (nextStatus === "READY" && sendReadySms) {
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
    revalidatePath("/orders");
  }

  async function markDeliveredAndPaid(formData: FormData) {
    "use server";

    const totalPriceRaw = String(formData.get("totalPrice") || "").trim();
    if (!totalPriceRaw || Number.isNaN(Number(totalPriceRaw))) return;

    const totalPrice = Number(totalPriceRaw);
    if (totalPrice < 0) return;

    const currentOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        isDeleted: false,
      },
      select: {
        status: true,
        paidAmount: true,
      },
    });

    if (!currentOrder) return;
    if (currentOrder.status === "DRAFT") return;

    const currentPaidAmount = currentOrder.paidAmount ?? 0;
    const remainingToPay = Math.max(0, totalPrice - currentPaidAmount);

    await prisma.$transaction([
      ...(remainingToPay > 0
        ? [
            prisma.orderPayment.create({
              data: {
                orderId,
                amount: remainingToPay,
                paymentDate: new Date(),
                notes: "Εξόφληση κατά την παράδοση.",
              },
            }),
          ]
        : []),

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

      ...(currentOrder.status !== "PAID"
        ? [
            prisma.orderStatusHistory.create({
              data: {
                orderId,
                status: "PAID",
                notes: "Παράδοση και εξόφληση παραγγελίας.",
              },
            }),
          ]
        : []),
    ]);

    revalidatePath(`/orders/${orderId}`);
    revalidatePath(customerPagePath);
    revalidatePath("/");
    revalidatePath("/analytics");
    revalidatePath("/orders");
  }

  async function finalizeDraftOrder() {
    "use server";

    const currentOrder = await prisma.order.findFirst({
      where: {
        id: orderId,
        isDeleted: false,
        status: "DRAFT" as OrderStatus,
      },
      include: {
        orderItems: true,
      },
    });

    if (!currentOrder) return;

    const nextStatus: OrderStatus =
      currentOrder.totalPrice != null &&
      currentOrder.paidAmount != null &&
      currentOrder.paidAmount >= currentOrder.totalPrice
        ? "PAID"
        : "NEW";

    await prisma.$transaction(async (tx) => {
      if (currentOrder.serviceType === "LINEN") {
        for (const item of currentOrder.orderItems) {
          if (item.itemSerialNumber == null) {
            const serial = await getNextSerial(tx, currentOrder.serviceType);

            await tx.orderItem.update({
              where: { id: item.id },
              data: {
                itemSerialNumber: serial,
              },
            });
          }
        }
      } else {
        for (const item of currentOrder.orderItems) {
          await tx.orderItem.delete({
            where: { id: item.id },
          });

          for (let i = 0; i < item.quantity; i++) {
            const serial = await getNextSerial(tx, currentOrder.serviceType);

            await tx.orderItem.create({
              data: {
                orderId,
                productId: item.productId,
                quantity: 1,
                unitPrice: item.unitPrice,
                lineTotal: item.unitPrice,
                itemSerialNumber: serial,
              },
            });
          }
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: nextStatus,
          paymentStatus: nextStatus === "PAID" ? "PAID" : "UNPAID",
          deliveryStatus: "PENDING",
        },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId,
          status: nextStatus,
          notes: "Οριστικοποίηση προσωρινής παραγγελίας.",
        },
      });
    });

    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/orders");
    revalidatePath("/");
    revalidatePath(customerPagePath);
  }

  async function deleteOrder() {
    "use server";

    const currentOrder = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        isDeleted: true,
      },
    });

    if (!currentOrder || currentOrder.isDeleted) {
      notFound();
    }

    if (currentOrder.status === "PAID" || currentOrder.status === "DELIVERED") {
      return;
    }

    await prisma.order.update({
      where: { id: orderId },
      data: {
        isDeleted: true,
      },
    });

    revalidatePath("/orders");
    revalidatePath("/");
    revalidatePath(customerPagePath);

    redirect("/orders");
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
            {order.status === ("DRAFT" as OrderStatus) ? (
              <form action={finalizeDraftOrder}>
                <button
                  type="submit"
                  className="rounded-xl bg-black px-4 py-3 text-white transition duration-150 hover:bg-gray-800 active:scale-[0.98]"
                >
                  Οριστικοποίηση παραγγελίας
                </button>
              </form>
            ) : null}

            <a href={`/orders/${order.id}/edit`} className={getButtonClass()}>
              Επεξεργασία παραγγελίας
            </a>

            {order.status !== "PAID" && order.status !== "DELIVERED" ? (
              <form action={deleteOrder}>
                <DeleteOrderButton />
              </form>
            ) : null}

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

      {order.status === ("DRAFT" as OrderStatus) ? (
        <section className="rounded-2xl border bg-yellow-50 p-4 text-sm text-yellow-900">
          Η παραγγελία είναι προσωρινή. Οι μοναδικοί αριθμοί προϊόντων θα δημιουργηθούν όταν πατήσεις οριστικοποίηση.
        </section>
      ) : null}

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

                  {group.serials.map((serialItem) => (
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

        {order.status !== ("DRAFT" as OrderStatus) ? (
          <form action={addPayment} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Ποσό πληρωμής</label>
              <div className="relative">
                <input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="π.χ. 20"
                  className="w-full rounded-xl border px-4 py-3 pr-10"
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
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
        ) : null}

        <form action={updateFinancials} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Συνολικό ποσό</label>
            <div className="relative">
              <input
                name="totalPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={order.totalPrice ?? ""}
                className="w-full rounded-xl border px-4 py-3 pr-10"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                €
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Πληρωμένο ποσό</label>
            <div className="relative">
              <input
                name="paidAmount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={order.paidAmount ?? ""}
                className="w-full rounded-xl border px-4 py-3 pr-10"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                €
              </span>
            </div>
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

        {order.status !== ("DRAFT" as OrderStatus) ? (
          <OrderStatusActions
            currentStatus={order.status}
            action={updateStatus}
          />
        ) : (
          <p className="text-sm text-gray-500">
            Η αλλαγή κατάστασης θα ενεργοποιηθεί μετά την οριστικοποίηση.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <h2 className="text-lg font-bold">Ιστορικό κατάστασης</h2>

        {order.statusHistory.length === 0 ? (
          <p className="text-gray-500">
            Δεν υπάρχει ακόμη ιστορικό αλλαγών κατάστασης.
          </p>
        ) : (
          <div className="space-y-3">
            {order.statusHistory.map((entry) => (
              <div
                key={entry.id}
                className="rounded-xl border bg-gray-50 p-4"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div className="font-medium">
                    {statusLabel(entry.status)}
                  </div>

                  <div className="text-sm text-gray-600">
                    {formatDateTime(entry.createdAt)}
                  </div>
                </div>

                <div className="mt-2 text-sm text-gray-700">
                  {entry.notes || "-"}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {order.status !== ("DRAFT" as OrderStatus) ? (
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
                Τελική τιμή παραγγελίας (€)
              </label>

              <div className="relative">
                <input
                  name="totalPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={order.totalPrice ?? ""}
                  className="w-full rounded-xl border px-4 py-3 pr-10"
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                  €
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className={getButtonClass()}>
                Παράδοση και εξόφληση
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </main>
  );
}
