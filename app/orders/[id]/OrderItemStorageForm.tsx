"use client";

import { useActionState, useEffect, useState } from "react";

type StorageActionState = {
  ok: boolean;
  error: string | null;
};

const initialState: StorageActionState = {
  ok: false,
  error: null,
};

export default function OrderItemStorageForm({
  orderItemId,
  defaultValue,
  action,
}: {
  orderItemId: number;
  defaultValue: string;
  action: (
    prevState: StorageActionState,
    formData: FormData
  ) => Promise<StorageActionState>;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [showErrorModal, setShowErrorModal] = useState(false);

  useEffect(() => {
    if (state.error) {
      setShowErrorModal(true);
    }
  }, [state.error]);

  return (
    <>
      <form action={formAction} className="mt-1 flex items-center gap-2">
        <input type="hidden" name="orderItemId" value={orderItemId} />
        <input
          name="storageChainNumber"
          defaultValue={defaultValue}
          placeholder="π.χ. A-12"
          className="w-full rounded-xl border border-black bg-white px-3 py-2 text-sm outline-none transition focus:border-black"
        />
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl border border-black bg-white px-3 py-2 text-sm text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white disabled:opacity-60"
        >
          ΟΚ
        </button>
      </form>

      {showErrorModal && state.error ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">Μη διαθέσιμος αριθμός αλυσίδας</h3>
            <p className="mt-3 text-sm text-gray-700">{state.error}</p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowErrorModal(false)}
                className="rounded-xl border border-black bg-white px-4 py-2 text-black transition duration-150 hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white"
              >
                Κλείσιμο
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}