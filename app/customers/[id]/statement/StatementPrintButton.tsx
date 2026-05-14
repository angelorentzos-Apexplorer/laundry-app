"use client";

export default function StatementPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-black px-4 py-3 text-white transition hover:bg-gray-800 active:scale-[0.98]"
    >
      Εκτύπωση / PDF
    </button>
  );
}