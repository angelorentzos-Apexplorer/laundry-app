"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductType } from "@prisma/client";

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [category, setCategory] = useState<ProductType>("CLOTHES");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert("Συμπλήρωσε όνομα προϊόντος.");
      return;
    }

    if (!unitPrice || Number.isNaN(Number(unitPrice))) {
      alert("Συμπλήρωσε σωστή τιμή.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          unitPrice: Number(unitPrice),
          category,
          isActive,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.error || "Αποτυχία αποθήκευσης προϊόντος.");
        setLoading(false);
        return;
      }

      router.push("/products");
      router.refresh();
    } catch (error) {
      console.error("Create product error:", error);
      alert("Προέκυψε σφάλμα κατά την αποθήκευση.");
      setLoading(false);
    }
  }

  return (
    <main className="max-w-xl space-y-6">
      <section className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Νέο Προϊόν</h1>
        <p className="text-gray-600">Καταχώρηση προϊόντος και τιμής</p>
      </section>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">Όνομα</label>
          <input
            placeholder="π.χ. Πουκάμισο, Χαλί, Σεντόνι"
            className="w-full rounded-xl border px-4 py-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Τιμή (€)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="π.χ. 5.00"
            className="w-full rounded-xl border px-4 py-3"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Κατηγορία</label>
          <select
            className="w-full rounded-xl border px-4 py-3"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProductType)}
          >
            <option value="CLOTHES">Ρούχα</option>
            <option value="CARPETS">Χαλιά</option>
            <option value="LINEN">Ιματισμός</option>
          </select>
        </div>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Ενεργό
        </label>

        <button
          type="submit"
          disabled={loading}
          className="rounded-xl bg-black px-4 py-3 text-white disabled:opacity-50"
        >
          {loading ? "Αποθήκευση..." : "Αποθήκευση"}
        </button>
      </form>
    </main>
  );
}