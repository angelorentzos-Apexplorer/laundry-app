"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ProductType, ServiceType } from "@prisma/client";

type Customer = {
  id: number;
  fullName: string | null;
  phone: string | null;
};

type Product = {
  id: number;
  name: string;
  category: ProductType;
  unitPrice: number;
  isActive: boolean;
};

type Row = {
  productId: number | "";
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  itemSerialNumber: number | null;
};

type OrderResponse = {
  id: number;
  customerId: number;
  serviceType: ServiceType;
  itemsDescription: string | null;
  squareMeters: number | null;
  paidAmount: number | null;
  deliveryDate: string | null;
  notes: string | null;
  storageChainNumber: string | null;
  orderItems: Array<{
    id: number;
    productId: number;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    itemSerialNumber: number | null;
  }>;
};

function serviceLabel(value: ServiceType) {
  switch (value) {
    case "CLOTHES":
      return "Ρούχα";
    case "CARPETS":
      return "Χαλιά";
    default:
      return value;
  }
}

function dateForInput(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

export default function EditOrderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const orderId = Number(params.id);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [customerId, setCustomerId] = useState("");
  const [serviceType, setServiceType] = useState<ServiceType>("CLOTHES");
  const [itemsDescription, setItemsDescription] = useState("");
  const [squareMeters, setSquareMeters] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [storageChainNumber, setStorageChainNumber] = useState("");

  const [rows, setRows] = useState<Row[]>([
    {
      productId: "",
      quantity: 1,
      unitPrice: 0,
      lineTotal: 0,
      itemSerialNumber: null,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [orderRes, customersRes, productsRes] = await Promise.all([
          fetch(`/api/orders/${orderId}`),
          fetch("/api/customers/list"),
          fetch("/api/products/list"),
        ]);

        if (!orderRes.ok) throw new Error("Order load failed");
        if (!customersRes.ok) throw new Error("Customers load failed");
        if (!productsRes.ok) throw new Error("Products load failed");

        const order: OrderResponse = await orderRes.json();
        const customersData = await customersRes.json();
        const productsData = await productsRes.json();

        setCustomers(customersData);
        setProducts(productsData);

        setCustomerId(String(order.customerId));
        setServiceType(order.serviceType);
        setItemsDescription(order.itemsDescription || "");
        setSquareMeters(
          order.squareMeters != null ? String(order.squareMeters) : ""
        );
        setPaidAmount(order.paidAmount != null ? String(order.paidAmount) : "");
        setDeliveryDate(dateForInput(order.deliveryDate));
        setNotes(order.notes || "");
        setStorageChainNumber(order.storageChainNumber || "");

        if (order.orderItems.length > 0) {
          setRows(
            order.orderItems.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
              itemSerialNumber: item.itemSerialNumber ?? null,
            }))
          );
        } else {
          setRows([
            {
              productId: "",
              quantity: 1,
              unitPrice: 0,
              lineTotal: 0,
              itemSerialNumber: null,
            },
          ]);
        }
      } catch (error) {
        console.error(error);
        alert("Αποτυχία φόρτωσης παραγγελίας.");
      } finally {
        setInitialLoading(false);
      }
    }

    if (orderId) {
      loadData();
    }
  }, [orderId]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => p.category === serviceType && p.isActive);
  }, [products, serviceType]);

  function updateRow(index: number, updated: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      next[index].lineTotal = next[index].quantity * next[index].unitPrice;
      return next;
    });
  }

  async function reserveItemSerialNumber(): Promise<number | null> {
    try {
      const res = await fetch("/api/order-item-serial", {
        method: "POST",
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data.itemSerialNumber ?? null;
    } catch (error) {
      console.error("reserveItemSerialNumber error:", error);
      return null;
    }
  }

  async function handleProductChange(index: number, rawProductId: string) {
    if (!rawProductId) {
      updateRow(index, {
        productId: "",
        unitPrice: 0,
        lineTotal: 0,
        itemSerialNumber: null,
      });
      return;
    }

    const productId = Number(rawProductId);
    const product = filteredProducts.find((p) => p.id === productId);
    if (!product) return;

    let serialToUse = rows[index]?.itemSerialNumber ?? null;

    if (!serialToUse) {
      serialToUse = await reserveItemSerialNumber();

      if (!serialToUse) {
        alert("Δεν ήταν δυνατή η δημιουργία μοναδικού αριθμού.");
        return;
      }
    }

    updateRow(index, {
      productId,
      unitPrice: product.unitPrice,
      itemSerialNumber: serialToUse,
    });
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        productId: "",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
        itemSerialNumber: null,
      },
    ]);
  }

  function removeRow(index: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0
        ? next
        : [
            {
              productId: "",
              quantity: 1,
              unitPrice: 0,
              lineTotal: 0,
              itemSerialNumber: null,
            },
          ];
    });
  }

  const productsTotal = rows.reduce((sum, row) => sum + row.lineTotal, 0);

  const totalItems = rows.reduce((sum, row) => {
    if (row.productId === "") return sum;
    return sum + row.quantity;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerId) return;

    setLoading(true);

    const validRows = rows.filter(
      (row) =>
        row.productId !== "" &&
        row.quantity > 0 &&
        row.unitPrice >= 0 &&
        row.itemSerialNumber !== null
    );

    const payload = {
      customerId: Number(customerId),
      serviceType,
      itemsDescription: itemsDescription || null,
      quantity: totalItems > 0 ? totalItems : null,
      squareMeters: squareMeters ? Number(squareMeters) : null,
      totalPrice: productsTotal > 0 ? productsTotal : null,
      paidAmount: paidAmount ? Number(paidAmount) : null,
      deliveryDate: deliveryDate || null,
      notes: notes || null,
      storageChainNumber: storageChainNumber || null,
      rows: validRows,
    };

    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setLoading(false);
      alert("Προέκυψε σφάλμα κατά την ενημέρωση της παραγγελίας.");
      return;
    }

    router.push(`/orders/${orderId}`);
    router.refresh();
  }

  if (initialLoading) {
    return (
      <main className="max-w-4xl">
        <div className="rounded-2xl border bg-white p-6">Φόρτωση...</div>
      </main>
    );
  }

  return (
    <main className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Επεξεργασία Παραγγελίας</h1>
        <p className="text-gray-600">
          Μπορείς να προσθέσεις επιπλέον ρούχα ή να διορθώσεις ποσότητες
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-6 rounded-2xl border bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Πελάτης</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className="w-full rounded-xl border px-6 py-4"
          >
            <option value="">Επιλογή πελάτη</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.fullName || "Χωρίς όνομα"} - {customer.phone || "-"}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Υπηρεσία</label>
          <select
            value={serviceType}
            onChange={(e) => setServiceType(e.target.value as ServiceType)}
            required
            className="w-full rounded-xl border px-4 py-3"
          >
            <option value="CLOTHES">Ρούχα</option>
            <option value="CARPETS">Χαλιά</option>
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Αριθμός μαρκαρίσματος
          </label>
          <input
            value={itemsDescription}
            onChange={(e) => setItemsDescription(e.target.value)}
            placeholder="π.χ. Μ-1024 ή 4587"
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <section className="space-y-4 rounded-2xl border p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              Προϊόντα {serviceLabel(serviceType)}
            </h2>

            <button
              type="button"
              onClick={addRow}
              className="rounded-xl border border-black px-4 py-2 text-sm"
            >
              + Προσθήκη προϊόντος
            </button>
          </div>

          {rows.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-xl border p-3 md:grid-cols-[1.6fr_120px_110px_140px_120px]"
            >
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Προϊόν
                </label>
                <select
                  value={row.productId}
                  onChange={(e) => handleProductChange(index, e.target.value)}
                  className="w-full rounded-xl border px-4 py-3"
                >
                  <option value="">Επιλογή προϊόντος</option>
                  {filteredProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.unitPrice.toFixed(2)} €)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Αριθμός
                </label>
                <input
                  value={row.itemSerialNumber ?? ""}
                  readOnly
                  placeholder="Αυτόματο"
                  className="w-full rounded-xl border bg-gray-50 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Ποσότητα
                </label>
                <input
                  type="number"
                  min="1"
                  value={row.quantity}
                  onChange={(e) =>
                    updateRow(index, {
                      quantity: Number(e.target.value) || 1,
                    })
                  }
                  className="w-full rounded-xl border px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Τιμή μονάδας
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={row.unitPrice}
                  readOnly
                  className="w-full rounded-xl border bg-gray-50 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Σύνολο
                </label>
                <div className="rounded-xl border bg-gray-50 px-4 py-3">
                  {row.lineTotal.toFixed(2)} €
                </div>
              </div>

              <div className="md:col-span-5">
                <button
                  type="button"
                  onClick={() => removeRow(index)}
                  className="text-sm text-red-600"
                >
                  Αφαίρεση γραμμής
                </button>
              </div>
            </div>
          ))}

          <div className="text-right text-lg font-bold">
            Σύνολο προϊόντων: {productsTotal.toFixed(2)} €
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Τεμάχια</label>
            <input
              value={totalItems > 0 ? totalItems : ""}
              type="number"
              readOnly
              className="w-full rounded-xl border bg-gray-50 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Τετραγωνικά
            </label>
            <input
              value={squareMeters}
              onChange={(e) => setSquareMeters(e.target.value)}
              type="number"
              min="0"
              step="0.1"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Συνολικό ποσό
            </label>
            <input
              value={productsTotal > 0 ? productsTotal.toFixed(2) : ""}
              readOnly
              className="w-full rounded-xl border bg-gray-50 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">
              Πληρωμένο ποσό
            </label>
            <input
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Ημερομηνία παράδοσης
          </label>
          <input
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            type="date"
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Αριθμός αλυσίδας αποθήκης
          </label>
          <input
            value={storageChainNumber}
            onChange={(e) => setStorageChainNumber(e.target.value)}
            placeholder="π.χ. A-12 ή 25"
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Σημειώσεις</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className="w-full rounded-xl border px-4 py-3"
          />
        </div>

        <div className="flex gap-3">
          <button
            disabled={loading}
            className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
          >
            {loading ? "Αποθήκευση..." : "Αποθήκευση αλλαγών"}
          </button>

          <button
            type="button"
            onClick={() => router.push(`/orders/${orderId}`)}
            className="rounded-xl border border-black px-5 py-3"
          >
            Ακύρωση
          </button>
        </div>
      </form>
    </main>
  );
}