import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import AddressAutoComplete from "../../new/AddressAutoComplete";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-5 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

function getDangerButtonClass() {
  return "rounded-xl border border-red-600 bg-white px-5 py-3 text-red-600 transition duration-150 hover:bg-red-50 active:scale-[0.98] active:bg-red-600 active:text-white";
}

function normalizeGreekPhone(rawPhone: string) {
  const cleaned = rawPhone.replace(/[^\d+]/g, "").trim();

  if (!cleaned) return "";

  if (cleaned.startsWith("+30")) {
    return cleaned;
  }

  if (cleaned.startsWith("0030")) {
    return `+${cleaned.slice(2)}`;
  }

  if (cleaned.startsWith("30") && cleaned.length >= 12) {
    return `+${cleaned}`;
  }

  return `+30${cleaned.replace(/^0+/, "")}`;
}

function stripGreekPhonePrefix(phone: string | null | undefined) {
  if (!phone) return "";

  const cleaned = phone.trim();

  if (cleaned.startsWith("+30")) return cleaned.slice(3);
  if (cleaned.startsWith("0030")) return cleaned.slice(4);
  if (cleaned.startsWith("30")) return cleaned.slice(2);

  return cleaned;
}

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const customerId = Number(resolvedParams.id);

  if (!customerId || Number.isNaN(customerId)) {
    notFound();
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      orders: {
        select: { id: true },
        take: 1,
      },
    },
  });

  if (!customer) {
    notFound();
  }

  async function updateCustomer(formData: FormData) {
    "use server";

    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const rawPhone = String(formData.get("phone") || "").trim();
    const address = String(formData.get("address") || "").trim();
    const postalCode = String(formData.get("postalCode") || "").trim();
    const companyName = String(formData.get("companyName") || "").trim();
    const vatNumber = String(formData.get("vatNumber") || "").trim();
    const notes = String(formData.get("notes") || "").trim();

    const phone = normalizeGreekPhone(rawPhone);

    if (!firstName || !lastName || !phone) return;

    const fullName = `${firstName} ${lastName}`.trim();

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName,
        lastName,
        fullName,
        phone,
        address: address || null,
        postalCode: postalCode || null,
        companyName: companyName || null,
        vatNumber: vatNumber || null,
        notes: notes || null,
      },
    });

    revalidatePath(`/customers/${customerId}`);
    revalidatePath(`/customers/${customerId}/edit`);
    revalidatePath("/customers");

    redirect(`/customers/${customerId}`);
  }

  async function deleteCustomer() {
    "use server";

    const existingCustomer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        orders: {
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!existingCustomer) {
      notFound();
    }

    if (existingCustomer.orders.length > 0) {
      redirect(`/customers/${customerId}/edit?error=has-orders`);
    }

    await prisma.customer.delete({
      where: { id: customerId },
    });

    revalidatePath("/customers");
    redirect("/customers");
  }

  const phoneWithoutPrefix = stripGreekPhonePrefix(customer.phone);
  const hasOrders = customer.orders.length > 0;

  return (
    <main className="max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Επεξεργασία Πελάτη</h1>
        <p className="text-gray-600">Ενημέρωση στοιχείων πελάτη</p>
      </div>

      <form
        action={updateCustomer}
        className="space-y-6 rounded-2xl border bg-white p-6"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="firstName" className="block text-sm font-medium">
              Όνομα
            </label>
            <input
              id="firstName"
              name="firstName"
              required
              defaultValue={customer.firstName || ""}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="lastName" className="block text-sm font-medium">
              Επώνυμο
            </label>
            <input
              id="lastName"
              name="lastName"
              required
              defaultValue={customer.lastName || ""}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium">
              Τηλέφωνο
            </label>

            <div className="flex items-center overflow-hidden rounded-xl border">
              <div className="border-r bg-gray-50 px-4 py-3 text-sm font-medium text-gray-700">
                +30
              </div>
              <input
                id="phone"
                name="phone"
                required
                inputMode="numeric"
                defaultValue={phoneWithoutPrefix}
                placeholder="69XXXXXXXX"
                className="w-full px-4 py-3 outline-none"
              />
            </div>

            <p className="text-xs text-gray-500">
              Πληκτρολόγησε τον αριθμό χωρίς το +30.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="postalCode" className="block text-sm font-medium">
              ΤΚ
            </label>
            <input
              id="postalCode"
              name="postalCode"
              defaultValue={customer.postalCode || ""}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium">
              Διεύθυνση
            </label>
            <AddressAutoComplete
              defaultAddress={customer.address || ""}
              defaultPostalCode={customer.postalCode || ""}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="companyName" className="block text-sm font-medium">
              Επωνυμία Εταιρείας
            </label>
            <input
              id="companyName"
              name="companyName"
              defaultValue={customer.companyName || ""}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="vatNumber" className="block text-sm font-medium">
              ΑΦΜ
            </label>
            <input
              id="vatNumber"
              name="vatNumber"
              defaultValue={customer.vatNumber || ""}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="notes" className="block text-sm font-medium">
              Σημειώσεις
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={4}
              defaultValue={customer.notes || ""}
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button type="submit" className={getButtonClass()}>
            Αποθήκευση αλλαγών
          </button>

          <a href={`/customers/${customerId}`} className={getButtonClass()}>
            Επιστροφή στον πελάτη
          </a>
        </div>
      </form>

      <section className="space-y-4 rounded-2xl border bg-white p-6">
        <div>
          <h2 className="text-lg font-bold">Διαγραφή πελάτη</h2>
          <p className="text-sm text-gray-600">
            Η διαγραφή επιτρέπεται μόνο αν ο πελάτης δεν έχει παραγγελίες.
          </p>
        </div>

        {hasOrders ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Δεν μπορεί να διαγραφεί αυτός ο πελάτης γιατί υπάρχουν συνδεδεμένες παραγγελίες.
          </div>
        ) : (
          <form action={deleteCustomer}>
            <button type="submit" className={getDangerButtonClass()}>
              Διαγραφή εγγραφής
            </button>
          </form>
        )}
      </section>
    </main>
  );
}