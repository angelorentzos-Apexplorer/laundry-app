"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewProductPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [category, setCategory] = useState("CLOTHES");
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    await fetch("/api/products", {
      method: "POST",
      body: JSON.stringify({
        name,
        unitPrice: parseFloat(unitPrice),
        category,
        isActive,
      }),
    });

    router.push("/products");
    router.refresh();
  }

  return (
    <main className="max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Νέο Προϊόν</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        <input
          placeholder="Όνομα"
          className="border p-2 w-full"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <input
          type="number"
          step="0.01"
          placeholder="Τιμή (€)"
          className="border p-2 w-full"
          value={unitPrice}
          onChange={(e) => setUnitPrice(e.target.value)}
          required
        />

        <select
          className="border p-2 w-full"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="CLOTHES">Ρούχα</option>
          <option value="CARPETS">Χαλιά</option>
        </select>

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
          className="bg-black text-white px-4 py-2 rounded"
        >
          Αποθήκευση
        </button>
      </form>
    </main>
  );
}