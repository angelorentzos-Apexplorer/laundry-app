import Link from "next/link";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
function formatMoney(v: number) {
  return `${v.toFixed(2)} €`;
}

export default async function ProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-5xl space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Προϊόντα</h1>
        <Link
          href="/products/new"
          className="bg-black text-white px-4 py-2 rounded"
        >
          + Νέο Προϊόν
        </Link>
      </div>

      {products.length === 0 ? (
        <div className="text-gray-500">Δεν υπάρχουν προϊόντα</div>
      ) : (
        <div className="border rounded">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/products/${p.id}`}
              className="flex justify-between p-4 border-b hover:bg-gray-50"
            >
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-500">
                  {p.category} {p.isActive ? "" : "(Ανενεργό)"}
                </div>
              </div>

              <div className="font-semibold">
                {formatMoney(p.unitPrice)}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}