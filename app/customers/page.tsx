import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-4 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const q = String(resolvedSearchParams?.q || "").trim();

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { fullName: { contains: q, mode: "insensitive" } },
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : undefined,

    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
    ],
  });

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <section className="rounded-2xl border bg-white p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Πελάτες</h1>
            <p className="text-gray-600">Λίστα πελατών</p>
          </div>

          <Link href="/customers/new" className={getButtonClass()}>
            + Νέος Πελάτης
          </Link>
        </div>
      </section>

      {/* SEARCH */}
      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <form method="GET" className="flex flex-col gap-3 md:flex-row">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Αναζήτηση με όνομα ή τηλέφωνο..."
            className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
          />

          <div className="flex flex-wrap gap-3">
            <button type="submit" className={getButtonClass()}>
              Αναζήτηση
            </button>

            {q && (
              <Link href="/customers" className={getButtonClass()}>
                Καθαρισμός
              </Link>
            )}
          </div>
        </form>
      </section>

      {/* TABLE */}
      <section className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-4">Όνομα</th>
              <th className="p-4">Τηλέφωνο</th>
              <th className="p-4">Διεύθυνση</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => {
              const displayName =
                `${customer.lastName || ""} ${customer.firstName || ""}`.trim() ||
                customer.fullName ||
                "-";

              return (
                <tr key={customer.id} className="border-t">
                  <td className="p-4 font-medium">
                    <Link
                      href={`/customers/${customer.id}`}
                      className="underline"
                    >
                      {displayName}
                    </Link>
                  </td>

                  <td className="p-4">{customer.phone || "-"}</td>

                  <td className="p-4">{customer.address || "-"}</td>
                </tr>
              );
            })}

            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500">
                  Δεν βρέθηκαν πελάτες
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}