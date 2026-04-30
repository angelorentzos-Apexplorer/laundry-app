import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Πελάτες</h1>
          <p className="text-gray-600">Λίστα πελατών</p>
        </div>

        <Link
          href="/customers/new"
          className="rounded-xl bg-black px-4 py-2 text-white"
        >
          + Νέος Πελάτης
        </Link>
      </div>

      {/* SEARCH BAR */}
      <form
        method="GET"
        className="flex flex-col gap-3 md:flex-row"
      >
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Αναζήτηση με όνομα ή τηλέφωνο..."
          className="w-full rounded-xl border px-4 py-3 outline-none focus:border-black"
        />

        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-xl border border-black px-4 py-2"
          >
            Αναζήτηση
          </button>

          {q && (
            <Link
              href="/customers"
              className="rounded-xl border px-4 py-2"
            >
              Καθαρισμός
            </Link>
          )}
        </div>
      </form>

      {/* TABLE */}
      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 text-left">
            <tr>
              <th className="p-4">Όνομα</th>
              <th className="p-4">Τηλέφωνο</th>
              <th className="p-4">Διεύθυνση</th>
            </tr>
          </thead>

          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t">
                <td className="p-4 font-medium">
                  <Link
                    href={`/customers/${customer.id}`}
                    className="underline"
                  >
                    {customer.fullName || "Χωρίς όνομα"}
                  </Link>
                </td>

                <td className="p-4">{customer.phone || "-"}</td>

                <td className="p-4">{customer.address || "-"}</td>
              </tr>
            ))}

            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500">
                  Δεν βρέθηκαν πελάτες
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}