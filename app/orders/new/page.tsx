"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ServiceType, ProductType } from "@prisma/client";

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

type ReceiptRow = {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  itemSerialNumber: number | null;
};

type ReceiptData = {
  orderId: number;
  customerName: string;
  customerPhone: string;
  serviceType: ServiceType;
  markingNumber: string;
  pickupDate: string;
  deliveryDate: string;
  totalItems: number;
  totalPrice: number;
  rows: ReceiptRow[];
  createdAt: string;
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

function formatGreekDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("el-GR");
}

function getTodayForInput() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPreviewBase(serviceType: ServiceType) {
  return serviceType === "CARPETS" ? 22000 : 1000;
}

function getPreviewSerial(serviceType: ServiceType, index: number) {
  return getPreviewBase(serviceType) + index;
}

export default function NewOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerSearchRef = useRef<HTMLDivElement | null>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  const [customerId, setCustomerId] = useState<string>(
    searchParams.get("customerId") || ""
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  const [serviceType, setServiceType] = useState<ServiceType>("CLOTHES");
  const [itemsDescription, setItemsDescription] = useState("");
  const [squareMeters, setSquareMeters] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [pickupDate, setPickupDate] = useState(getTodayForInput());
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");

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

  useEffect(() => {
    async function loadData() {
      try {
        const customersRes = await fetch("/api/customers/list");
        if (customersRes.ok) {
          const customersData = await customersRes.json();
          setCustomers(customersData);
        }
      } catch (error) {
        console.error("Customers load error:", error);
      }

      try {
        const productsRes = await fetch("/api/products/list");
        if (productsRes.ok) {
          const productsData = await productsRes.json();
          setProducts(productsData);
        }
      } catch (error) {
        console.error("Products load error:", error);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!customerId || customers.length === 0) return;

    const selectedCustomer = customers.find((c) => String(c.id) === customerId);
    if (!selectedCustomer) return;

    setCustomerSearch(
      `${selectedCustomer.fullName || "Χωρίς όνομα"}${
        selectedCustomer.phone ? ` - ${selectedCustomer.phone}` : ""
      }`
    );
  }, [customerId, customers]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!customerSearchRef.current) return;
      if (!customerSearchRef.current.contains(event.target as Node)) {
        setCustomerDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => p.category === serviceType && p.isActive);
  }, [products, serviceType]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();

    if (q.length < 3) return [];

    return customers
      .filter((customer) => {
        const fullName = (customer.fullName || "").toLowerCase();
        const phone = (customer.phone || "").toLowerCase();
        return fullName.includes(q) || phone.includes(q);
      })
      .slice(0, 10);
  }, [customerSearch, customers]);

  function updateRow(index: number, updated: Partial<Row>) {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...updated };
      next[index].lineTotal = next[index].quantity * next[index].unitPrice;
      return next;
    });
  }

  function handleProductChange(index: number, rawProductId: string) {
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

    updateRow(index, {
      productId,
      unitPrice: product.unitPrice,
      itemSerialNumber: getPreviewSerial(serviceType, index),
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

  function handleSelectCustomer(customer: Customer) {
    setCustomerId(String(customer.id));
    setCustomerSearch(
      `${customer.fullName || "Χωρίς όνομα"}${
        customer.phone ? ` - ${customer.phone}` : ""
      }`
    );
    setCustomerDropdownOpen(false);
  }

  useEffect(() => {
    setRows([
      {
        productId: "",
        quantity: 1,
        unitPrice: 0,
        lineTotal: 0,
        itemSerialNumber: null,
      },
    ]);
  }, [serviceType]);

  const productsTotal = rows.reduce((sum, row) => sum + row.lineTotal, 0);

  const totalItems = rows.reduce((sum, row) => {
    if (row.productId === "") return sum;
    return sum + row.quantity;
  }, 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerId) {
      alert("Επίλεξε πελάτη.");
      return;
    }

    setLoading(true);

    const validRows = rows.filter(
      (row) => row.productId !== "" && row.quantity > 0 && row.unitPrice >= 0
    );

    const payload = {
      customerId: Number(customerId),
      serviceType,
      itemsDescription: itemsDescription || null,
      quantity: totalItems > 0 ? totalItems : null,
      squareMeters: squareMeters ? Number(squareMeters) : null,
      totalPrice: productsTotal > 0 ? productsTotal : null,
      paidAmount: paidAmount ? Number(paidAmount) : null,
      pickupDate: pickupDate || null,
      deliveryDate: deliveryDate || null,
      notes: notes || null,
      rows: validRows.map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
        unitPrice: row.unitPrice,
        lineTotal: row.lineTotal,
      })),
    };

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      setLoading(false);
      alert("Προέκυψε σφάλμα κατά την αποθήκευση της παραγγελίας.");
      return;
    }

    const createdOrder = await res.json();

    const selectedCustomer = customers.find((c) => String(c.id) === customerId);

    const receiptRows: ReceiptRow[] = (createdOrder.orderItems || []).map(
      (row: any) => {
        const matchedProduct = products.find((p) => p.id === row.productId);

        return {
          productId: Number(row.productId),
          productName: matchedProduct?.name || `Προϊόν #${row.productId}`,
          quantity: row.quantity,
          unitPrice: row.unitPrice,
          lineTotal: row.lineTotal,
          itemSerialNumber: row.itemSerialNumber,
        };
      }
    );

    setReceipt({
      orderId: createdOrder.id,
      customerName: selectedCustomer?.fullName || "Χωρίς όνομα",
      customerPhone: selectedCustomer?.phone || "-",
      serviceType,
      markingNumber: itemsDescription || "-",
      pickupDate: pickupDate || "",
      deliveryDate: deliveryDate || "",
      totalItems,
      totalPrice: productsTotal,
      rows: receiptRows,
      createdAt: createdOrder.createdAt || new Date().toISOString(),
    });

    setLoading(false);
  }

  function handlePrintReceipt() {
    window.print();
  }

  return (
    <main className="max-w-4xl space-y-6">
      <div className="no-print">
        <h1 className="text-2xl font-bold">Νέα Παραγγελία</h1>
        <p className="text-gray-600">
          Καταχώρηση παραγγελίας για ρούχα ή χαλιά
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="no-print space-y-6 rounded-2xl border bg-white p-6"
      >
        <div className="space-y-2" ref={customerSearchRef}>
          <label className="block text-sm font-medium">Πελάτης</label>
          <input
            value={customerSearch}
            onChange={(e) => {
              setCustomerSearch(e.target.value);
              setCustomerDropdownOpen(true);
              setCustomerId("");
            }}
            onFocus={() => {
              if (customerSearch.trim().length >= 3) {
                setCustomerDropdownOpen(true);
              }
            }}
            placeholder="Πληκτρολόγησε 3 γράμματα ή τηλέφωνο..."
            className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
          />

          {customerDropdownOpen && customerSearch.trim().length >= 3 && (
            <div className="max-h-72 overflow-auto rounded-xl border bg-white shadow-lg">
              {filteredCustomers.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-500">
                  Δεν βρέθηκαν πελάτες.
                </div>
              ) : (
                filteredCustomers.map((customer) => (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => handleSelectCustomer(customer)}
                    className="block w-full border-b px-4 py-3 text-left text-sm hover:bg-gray-100"
                  >
                    <div className="font-medium">
                      {customer.fullName || "Χωρίς όνομα"}
                    </div>
                    <div className="text-xs text-gray-500">
                      {customer.phone || "-"}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
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
                <label className="mb-1 block text-sm font-medium">Προϊόν</label>
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
                <label className="mb-1 block text-sm font-medium">Αριθμός</label>
                <input
                  value={
                    row.productId !== ""
                      ? String(getPreviewSerial(serviceType, index))
                      : ""
                  }
                  readOnly
                  placeholder="Αυτόματο"
                  className="w-full rounded-xl border bg-gray-50 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Ποσότητα</label>
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
                <label className="mb-1 block text-sm font-medium">Σύνολο</label>
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
              name="quantity"
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
              name="squareMeters"
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
              placeholder="Προαιρετικό"
              className="w-full rounded-xl border px-4 py-3"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">
              Ημερομηνία παραλαβής
            </label>
            <input
              value={pickupDate}
              onChange={(e) => setPickupDate(e.target.value)}
              type="date"
              className="w-full rounded-xl border px-4 py-3"
            />
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

        <button
          disabled={loading}
          className="rounded-xl bg-black px-5 py-3 text-white disabled:opacity-50"
        >
          {loading ? "Αποθήκευση..." : "Αποθήκευση παραγγελίας"}
        </button>
      </form>

      {receipt && (
        <div className="no-print flex flex-wrap gap-3 rounded-2xl border bg-green-50 p-4">
          <button
            type="button"
            onClick={handlePrintReceipt}
            className="rounded-xl bg-black px-5 py-3 text-white"
          >
            Εκτύπωση δελτίου παραλαβής
          </button>

          <button
            type="button"
            onClick={() => router.push(`/orders/${receipt.orderId}`)}
            className="rounded-xl border border-black px-5 py-3"
          >
            Μετάβαση στην παραγγελία
          </button>

          <button
            type="button"
            onClick={() => router.push(`/customers/${customerId}`)}
            className="rounded-xl border border-black px-5 py-3"
          >
            Επιστροφή στον πελάτη
          </button>
        </div>
      )}

      {receipt && (
        <section className="print-receipt mt-8 rounded-2xl border bg-white p-4 text-[12px] leading-tight">
          <div className="mb-3 text-center">
            <img
              src="/logo.png"
              alt="Logo"
              className="mx-auto mb-2 h-12 w-auto object-contain"
            />
            <h2 className="text-base font-bold">ΔΕΛΤΙΟ ΠΑΡΑΛΑΒΗΣ</h2>
            <p className="text-[11px] text-gray-600">Laundry Admin</p>
          </div>

          <div className="space-y-1 text-[11px]">
            <div>
              <span className="font-medium">Αρ. παραγγελίας:</span> #
              {receipt.orderId}
            </div>
            <div>
              <span className="font-medium">Ημερομηνία καταχώρησης:</span>{" "}
              {formatGreekDate(receipt.createdAt)}
            </div>
            <div>
              <span className="font-medium">Πελάτης:</span>{" "}
              {receipt.customerName}
            </div>
            <div>
              <span className="font-medium">Τηλέφωνο:</span>{" "}
              {receipt.customerPhone}
            </div>
            <div>
              <span className="font-medium">Υπηρεσία:</span>{" "}
              {receipt.serviceType === "CLOTHES" ? "Ρούχα" : "Χαλιά"}
            </div>
            <div>
              <span className="font-medium">Τεμάχια:</span>{" "}
              {receipt.totalItems}
            </div>
            <div>
              <span className="font-medium">Αρ. μαρκαρίσματος:</span>{" "}
              {receipt.markingNumber}
            </div>
            <div>
              <span className="font-medium">Ημερομηνία παραλαβής:</span>{" "}
              {formatGreekDate(receipt.pickupDate)}
            </div>
            <div>
              <span className="font-medium">Ημερομηνία παράδοσης:</span>{" "}
              {formatGreekDate(receipt.deliveryDate)}
            </div>
            <div>
              <span className="font-medium">Συνολικό ποσό:</span>{" "}
              {receipt.totalPrice.toFixed(2)} €
            </div>
          </div>

          <div className="my-3 border-t border-dashed border-black" />

          <div>
            <h3 className="mb-2 text-sm font-bold">Είδη</h3>

            {receipt.rows.length === 0 ? (
              <div className="text-[11px] text-gray-500">
                Δεν υπάρχουν καταχωρημένα είδη.
              </div>
            ) : (
              <div className="space-y-2">
                {receipt.rows.map((row, index) => (
                  <div
                    key={`${row.productId}-${index}`}
                    className="rounded-lg border p-2 text-[11px]"
                  >
                    <div className="font-medium">{row.productName}</div>
                    <div className="text-[10px] text-gray-600">
                      Αριθμός: {row.itemSerialNumber ?? "-"}
                    </div>
                    <div className="mt-1 flex justify-between">
                      <span>Ποσ.: {row.quantity}</span>
                      <span>{row.lineTotal.toFixed(2)} €</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="my-3 border-t border-dashed border-black" />

          <div className="mt-6 grid grid-cols-2 gap-4 pt-6">
            <div className="border-t pt-1 text-center text-[10px]">
              Υπογραφή πελάτη
            </div>
            <div className="border-t pt-1 text-center text-[10px]">
              Υπογραφή καταστήματος
            </div>
          </div>
        </section>
      )}

      <style jsx global>{`
        .print-receipt {
          display: none;
        }

        @media print {
          html,
          body {
            background: white !important;
            width: 58mm;
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
          }

          .no-print,
          header,
          nav,
          aside,
          [role="navigation"],
          .navbar,
          .navibar,
          .sidebar {
            display: none !important;
          }

          .print-receipt {
            display: block !important;
            width: 58mm !important;
            max-width: 58mm !important;
            min-width: 58mm !important;
            margin: 0 !important;
            padding: 2mm !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            font-size: 11px !important;
            line-height: 1.25 !important;
            color: #000 !important;
          }

          .print-receipt * {
            color: #000 !important;
          }

          .print-receipt img {
            display: block !important;
            margin: 0 auto 6px auto !important;
            max-width: 120px !important;
            max-height: 45px !important;
            width: auto !important;
            height: auto !important;
          }

          .print-receipt h2 {
            font-size: 15px !important;
            margin: 0 0 4px 0 !important;
          }

          .print-receipt h3 {
            font-size: 12px !important;
            margin: 0 0 4px 0 !important;
          }

          main {
            max-width: 58mm !important;
            width: 58mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          @page {
            size: 58mm auto;
            margin: 0;
          }
        }
      `}</style>
    </main>
  );
}