import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@prisma/client";
import { notFound } from "next/navigation";

function formatMoney(value: number | null | undefined) {
  if (value == null) return "-";
  return `${value.toFixed(2)} €`;
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("el-GR");
}

function categoryLabel(category: ProductType) {
  switch (category) {
    case "CLOTHES":
      return "Ρούχα";
    case "CARPETS":
      return "Χαλιά";
    default:
      return category;
  }
}

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-4 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const productId = Number(resolvedParams.id);

  if (!productId || Number.isNaN(productId)) {
    notFound();
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    notFound();
  }

  return (
    <main className="max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <p className="text-gray-600">Καρτέλα προϊόντος #{product.id}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href={`/products/${product.id}/edit`} className={getButtonClass()}>
              Επεξεργασία
            </Link>
            <Link href="/products" className={getButtonClass()}>
              Επιστροφή στη λίστα
            </Link>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-6 space-y-4">
        <h2 className="text-lg font-bold">Στοιχεία προϊόντος</h2>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <span className="font-medium">Κωδικός:</span> #{product.id}
          </div>

          <div>
            <span className="font-medium">Όνομα:</span> {product.name}
          </div>

          <div>
            <span className="font-medium">Κατηγορία:</span>{" "}
            {categoryLabel(product.category)}
          </div>

          <div>
            <span className="font-medium">Τιμή:</span>{" "}
            {formatMoney(product.unitPrice)}
          </div>

          <div>
            <span className="font-medium">Κατάσταση:</span>{" "}
            {product.isActive ? "Ενεργό" : "Ανενεργό"}
          </div>

          <div>
            <span className="font-medium">Δημιουργήθηκε:</span>{" "}
            {formatDate(product.createdAt)}
          </div>

          <div className="md:col-span-2">
            <span className="font-medium">Σημειώσεις:</span>{" "}
            {product.notes || "-"}
          </div>
        </div>
      </section>
    </main>
  );
}