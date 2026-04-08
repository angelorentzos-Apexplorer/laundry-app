import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import AddressAutocomplete from "./AddressAutoComplete";

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-5 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
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

async function createCustomer(formData: FormData) {
  "use server";

  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const rawPhone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const postalCode = String(formData.get("postalCode") || "").trim();
  const companyName = String(formData.get("companyName") || "").trim();
  const vatNumber = String(formData.get("vatNumber") || "").trim();
  const notes = String(formData.get("notes") || "").trim();

  const saveMode = String(formData.get("saveMode") || "customer").trim();

  const phone = normalizeGreekPhone(rawPhone);

  if (!firstName || !lastName || !phone) return;

  const fullName = `${firstName} ${lastName}`.trim();

  const customer = await prisma.customer.create({
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
    select: { id: true },
  });

  if (saveMode === "order") {
    redirect(`/orders/new?customerId=${customer.id}`);
  }

  redirect(`/customers/${customer.id}`);
}

export default function NewCustomerPage() {
  return (
    <main className="max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-white p-6">
        <h1 className="text-2xl font-bold">Νέος Πελάτης</h1>
        <p className="text-gray-600">Καταχώρηση νέου πελάτη</p>
      </div>

      <form
        action={createCustomer}
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
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium">
              Διεύθυνση
            </label>
            <AddressAutocomplete />
          </div>

          <div className="space-y-2">
            <label htmlFor="companyName" className="block text-sm font-medium">
              Επωνυμία Εταιρείας
            </label>
            <input
              id="companyName"
              name="companyName"
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
              className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            name="saveMode"
            value="customer"
            className={getButtonClass()}
          >
            Αποθήκευση
          </button>

          <button
            type="submit"
            name="saveMode"
            value="order"
            className={getButtonClass()}
          >
            Αποθήκευση και παραγγελία
          </button>
        </div>
      </form>
    </main>
  );
}