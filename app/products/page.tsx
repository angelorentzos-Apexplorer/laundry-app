import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-4 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function categoryLabel(category: string) {
  switch (category) {
    case "CLOTHES":
      return "Ρούχα";
    case "CARPETS":
      return "Χαλιά";
    default:
      return category;
  }
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = String(resolvedSearchParams?.q || "").trim();

  const products = await prisma.product.findMany({
    where: q
      ? {
          name: {
            contains: q,
            mode: "insensitive",
          },
        }
      : undefined,
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-5xl space-y-6">
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Προϊόντα</h1>
            <p className="text-gray-600">Διαχείριση προϊόντων και τιμών</p>
          </div>

          <Link href="/products/new" className={getButtonClass()}>
            + Νέο Προϊόν
          </Link>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <form method="GET" className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Αναζήτηση με όνομα προϊόντος..."
            className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
          />

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Αναζήτηση
            </button>

            {q ? (
              <Link href="/products" className={getButtonClass()}>
                Καθαρισμός
              </Link>
            ) : null}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white">
        {products.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            {q ? "Δεν βρέθηκαν προϊόντα." : "Δεν υπάρχουν προϊόντα."}
          </div>
        ) : (
          <div className="divide-y">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/products/${product.id}`}
                className="block p-4 transition hover:bg-gray-50"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-medium">
                      {product.name || "Χωρίς όνομα"}
                    </div>

                    <div className="mt-1 text-sm text-gray-500">
                      {categoryLabel(product.category)}{" "}
                      {product.isActive ? "" : "• Ανενεργό"}
                    </div>
                  </div>

                  <div className="font-semibold">
                    {formatMoney(product.unitPrice)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}