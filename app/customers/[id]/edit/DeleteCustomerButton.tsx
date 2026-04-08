"use client";

import { useState } from "react";

function getDangerButtonClass() {
  return "rounded-xl border border-red-600 bg-white px-5 py-3 text-red-600 transition duration-150 hover:bg-red-50 active:scale-[0.98] active:bg-red-600 active:text-white";
}

function getButtonClass() {
  return "rounded-xl border border-black bg-white px-5 py-3 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white";
}

export default function DeleteCustomerButton({
  action,
}: {
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={getDangerButtonClass()}
      >
        Διαγραφή εγγραφής
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">Επιβεβαίωση διαγραφής</h3>
            <p className="mt-3 text-sm text-gray-700">
              Είσαι σίγουρος ότι θέλεις να διαγράψεις τον πελάτη; Η ενέργεια δεν
              αναιρείται.
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={getButtonClass()}
              >
                Ακύρωση
              </button>

              <form action={action}>
                <button type="submit" className={getDangerButtonClass()}>
                  Ναι, διαγραφή
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}