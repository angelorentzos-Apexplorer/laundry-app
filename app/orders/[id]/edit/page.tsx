import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { OrderStatus, ServiceType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-5 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
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

type EditableGroupedOrderItem = {
  productId: number | null;
  productName: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number;
  serials: Array<{
    id: number;
    itemSerialNumber: number | null;
  }>;
};

function groupOrderItems(
  orderItems: Array<{
    id: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    itemSerialNumber: number | null;
    product: {
      id: number;
      name: string;
    } | null;
  }>
): EditableGroupedOrderItem[] {
  const map = new Map<string, EditableGroupedOrderItem>();

  for (const item of orderItems) {
    const key =
      item.product?.id != null ? String(item.product.id) : `unknown-${item.id}`;

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
    });
  }

  return Array.from(map.values());
}

export default async function EditOrderPage({
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
  const groupedOrderItems = groupOrderItems(order.orderItems);

  async function updateOrder(formData: FormData) {
  "use server";

  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      status: true,
    },
  });

  if (!existingOrder) {
    notFound();
  }

  const itemsDescription = String(formData.get("itemsDescription") || "").trim();
  const squareMetersRaw = String(formData.get("squareMeters") || "").trim();
  const totalPriceRaw = String(formData.get("totalPrice") || "").trim();
  const paidAmountRaw = String(formData.get("paidAmount") || "").trim();
  const pickupDateRaw = String(formData.get("pickupDate") || "").trim();
  const deliveryDateRaw = String(formData.get("deliveryDate") || "").trim();
  const notes = String(formData.get("notes") || "").trim();
  const statusRaw = String(formData.get("status") || "").trim();

  const squareMeters =
    squareMetersRaw && !Number.isNaN(Number(squareMetersRaw))
      ? Number(squareMetersRaw)
      : null;

  const totalPrice =
    totalPriceRaw && !Number.isNaN(Number(totalPriceRaw))
      ? Number(totalPriceRaw)
      : null;

  const paidAmount =
    paidAmountRaw && !Number.isNaN(Number(paidAmountRaw))
      ? Number(paidAmountRaw)
      : null;

  const pickupDate =
    pickupDateRaw && !Number.isNaN(Date.parse(pickupDateRaw))
      ? new Date(pickupDateRaw)
      : null;

  const deliveryDate =
    deliveryDateRaw && !Number.isNaN(Date.parse(deliveryDateRaw))
      ? new Date(deliveryDateRaw)
      : null;

  let nextStatus: OrderStatus = existingOrder.status;

  if (
    statusRaw === "NEW" ||
    statusRaw === "PROCESSING" ||
    statusRaw === "READY" ||
    statusRaw === "DELIVERED" ||
    statusRaw === "PAID"
  ) {
    nextStatus = statusRaw as OrderStatus;
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      itemsDescription: itemsDescription || null,
      squareMeters,
      totalPrice,
      paidAmount,
      pickupDate,
      deliveryDate,
      notes: notes || null,
      status: nextStatus,
    },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/orders/${orderId}/edit`);
  revalidatePath(customerPagePath);

  redirect(`/orders/${orderId}`);
}
  return (
    <main className="max-w-5xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Επεξεργασία Παραγγελίας #{order.id}</h1>
            <p className="text-gray-600">
              {order.customer.fullName} • {order.customer.phone}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/orders/${order.id}`} className={getButtonClass()}>
              Επιστροφή στην παραγγελία
            </Link>
            <Link href={customerPagePath} className={getButtonClass()}>
              Επιστροφή στον πελάτη
            </Link>
          </div>
        </div>
      </div>

      <form
        action={updateOrder}
        className="space-y-6 rounded-2xl border bg-white p-6"
      >
        <section className="space-y-4">
          <h2 className="text-lg font-bold">Βασικά στοιχεία</h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Πελάτης</label>
              <input
                value={order.customer.fullName || ""}
                readOnly
                className="w-full rounded-xl border bg-gray-50 px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Υπηρεσία</label>
              <input
                value={serviceTypeLabel(order.serviceType)}
                readOnly
                className="w-full rounded-xl border bg-gray-50 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Αριθμός μαρκαρίσματος
            </label>
            <input
              name="itemsDescription"
              defaultValue={order.itemsDescription || ""}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Τετραγωνικά</label>
              <input
                name="squareMeters"
                type="number"
                min="0"
                step="0.1"
                defaultValue={order.squareMeters ?? ""}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Κατάσταση</label>
              <select
                name="status"
                defaultValue={order.status}
                className="w-full rounded-xl border px-4 py-3"
              >
                <option value="NEW">Νέα</option>
                <option value="PROCESSING">Σε επεξεργασία</option>
                <option value="READY">Έτοιμη</option>
                <option value="DELIVERED">Παραδόθηκε</option>
                <option value="PAID">Εξοφλημένη</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Ημερομηνία παραλαβής
              </label>
              <input
                name="pickupDate"
                type="date"
                defaultValue={formatDateForInput(order.pickupDate)}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Ημερομηνία παράδοσης
              </label>
              <input
                name="deliveryDate"
                type="date"
                defaultValue={formatDateForInput(order.deliveryDate)}
                className="w-full rounded-xl border px-4 py-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Σημειώσεις</label>
            <textarea
              name="notes"
              rows={4}
              defaultValue={order.notes || ""}
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">Οικονομικά</h2>

          <div className="grid gap-4 md:grid-cols-2">
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
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold">Προϊόντα παραγγελίας</h2>

          {groupedOrderItems.length === 0 ? (
            <div className="rounded-xl border bg-gray-50 p-4 text-gray-500">
              Δεν υπάρχουν καταχωρημένα προϊόντα.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedOrderItems.map((group, index) => (
                <div
                  key={`${group.productId ?? "x"}-${index}`}
                  className="rounded-xl border bg-gray-50 p-4"
                >
                  <div className="grid gap-3 md:grid-cols-4">
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
                        {group.unitPrice != null ? `${group.unitPrice.toFixed(2)} €` : "-"}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500">Σύνολο είδους</div>
                      <div className="font-medium">{group.lineTotal.toFixed(2)} €</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-sm font-medium">Μοναδικοί αριθμοί</div>
                    <div className="flex flex-wrap gap-2">
                      {group.serials.map((serial) => (
                        <div
                          key={serial.id}
                          className="rounded-xl border bg-white px-3 py-2 text-sm"
                        >
                          {serial.itemSerialNumber ?? "-"}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={getButtonClass()}>
            Αποθήκευση αλλαγών
          </button>

          <Link href={`/orders/${order.id}`} className={getButtonClass()}>
            Ακύρωση
          </Link>
        </div>
      </form>
    </main>
  );
}