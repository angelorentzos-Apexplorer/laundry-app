import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export default async function CustomersPage() {
  const customers = await prisma.customer.findMany({
    orderBy: { createdAt: 'desc' },
  })

  return (
    <main className="space-y-6">
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
  <Link href={`/customers/${customer.id}`} className="underline">
    {customer.fullName}
  </Link>
</td>
                <td className="p-4">{customer.phone}</td>
                <td className="p-4">{customer.address || '-'}</td>
              </tr>
            ))}

            {customers.length === 0 && (
              <tr>
                <td colSpan={3} className="p-6 text-center text-gray-500">
                  Δεν υπάρχουν πελάτες ακόμη
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}