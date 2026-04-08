"use client";

import { useRef, useState } from "react";
import { OrderStatus } from "@prisma/client";

function getButtonClass(isActive = false) {
  return [
    "rounded-xl border border-black px-4 py-3 transition duration-150",
    isActive
      ? "bg-black text-white"
      : "bg-white text-black hover:bg-gray-100 active:scale-[0.98] active:bg-black active:text-white",
  ].join(" ");
}

export default function OrderStatusActions({
  currentStatus,
  action,
}: {
  currentStatus: OrderStatus;
  action: (formData: FormData) => Promise<void>;
}) {
  const [showReadyConfirm, setShowReadyConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
  const sendReadySmsRef = useRef<HTMLInputElement | null>(null);
  const statusRef = useRef<HTMLInputElement | null>(null);

  function submitStatus(status: OrderStatus, sendSms = false) {
    if (!formRef.current || !sendReadySmsRef.current || !statusRef.current) return;

    statusRef.current.value = status;
    sendReadySmsRef.current.value = sendSms ? "1" : "0";
    formRef.current.requestSubmit();
  }

  return (
    <>
      <form ref={formRef} action={action} className="flex flex-wrap gap-3">
        <input ref={statusRef} type="hidden" name="status" defaultValue="" />
        <input ref={sendReadySmsRef} type="hidden" name="sendReadySms" defaultValue="0" />

        <button
          type="button"
          onClick={() => submitStatus("NEW")}
          className={getButtonClass(currentStatus === "NEW")}
        >
          Νέα
        </button>

        <button
          type="button"
          onClick={() => submitStatus("PROCESSING")}
          className={getButtonClass(currentStatus === "PROCESSING")}
        >
          Σε επεξεργασία
        </button>

        <button
          type="button"
          onClick={() => setShowReadyConfirm(true)}
          className={getButtonClass(currentStatus === "READY")}
        >
          Έτοιμη
        </button>

        <button
          type="button"
          onClick={() => submitStatus("DELIVERED")}
          className={getButtonClass(currentStatus === "DELIVERED")}
        >
          Παραδόθηκε
        </button>

        <button
          type="button"
          onClick={() => submitStatus("PAID")}
          className={getButtonClass(currentStatus === "PAID")}
        >
          Εξοφλημένη
        </button>
      </form>

      {showReadyConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold">Επιβεβαίωση SMS</h3>
            <p className="mt-3 text-sm text-gray-700">
              Να σταλεί SMS επιβεβαίωσης παραλαβής στον πελάτη;
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowReadyConfirm(false);
                  submitStatus("READY", false);
                }}
                className={getButtonClass()}
              >
                Όχι
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowReadyConfirm(false);
                  submitStatus("READY", true);
                }}
                className={getButtonClass(true)}
              >
                Ναι, αποστολή SMS
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}