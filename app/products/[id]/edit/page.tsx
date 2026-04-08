import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductType } from "@prisma/client";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-4 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

export default async function EditProductPage({
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

  async function updateProduct(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const categoryRaw = String(formData.get("category") || "").trim();
    const unitPriceRaw = String(formData.get("unitPrice") || "").trim();
    const notes = String(formData.get("notes") || "").trim();
    const isActive = String(formData.get("isActive") || "") === "on";

    if (!name) return;
    if (!unitPriceRaw || Number.isNaN(Number(unitPriceRaw))) return;
    if (categoryRaw !== "CLOTHES" && categoryRaw !== "CARPETS") return;

    const unitPrice = Number(unitPriceRaw);
    if (unitPrice < 0) return;

    await prisma.product.update({
      where: { id: productId },
      data: {
        name,
        category: categoryRaw as ProductType,
        unitPrice,
        notes: notes || null,
        isActive,
      },
    });

    revalidatePath("/products");
    revalidatePath(`/products/${productId}`);
    revalidatePath(`/products/${productId}/edit`);
    redirect(`/products/${productId}`);
  }

  return (
    <main className="max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Επεξεργασία προϊόντος</h1>
            <p className="text-gray-600">
              Επεξεργασία στοιχείων για το προϊόν #{product.id}
            </p>
          </div>

          <Link href={`/products/${product.id}`} className={getButtonClass()}>
            Επιστροφή στην καρτέλα προϊόντος
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-6 space-y-5">
        <form action={updateProduct} className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="name" className="block text-sm font-medium">
                Όνομα προϊόντος
              </label>
              <input
                id="name"
                name="name"
                defaultValue={product.name}
                required
                className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="category" className="block text-sm font-medium">
                Κατηγορία
              </label>
              <select
                id="category"
                name="category"
                defaultValue={product.category}
                className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
              >
                <option value="CLOTHES">Ρούχα</option>
                <option value="CARPETS">Χαλιά</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="unitPrice" className="block text-sm font-medium">
                Τιμή (€)
              </label>
              <input
                id="unitPrice"
                name="unitPrice"
                type="number"
                min="0"
                step="0.01"
                defaultValue={product.unitPrice}
                required
                className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
              />
            </div>

            <div className="flex items-end">
              <label className="flex items-center gap-3 rounded-xl border px-4 py-3">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={product.isActive}
                />
                <span>Ενεργό προϊόν</span>
              </label>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label htmlFor="notes" className="block text-sm font-medium">
                Σημειώσεις
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                defaultValue={product.notes || ""}
                className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Αποθήκευση
            </button>

            <Link href={`/products/${product.id}`} className={getButtonClass()}>
              Ακύρωση
            </Link>
          </div>
        </form>
      </section>
    </main>
  );
}