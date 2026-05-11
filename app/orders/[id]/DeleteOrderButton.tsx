"use client";

export default function DeleteOrderButton() {
  return (
    <button
      type="submit"
      onClick={(e) => {
        const confirmed = window.confirm(
          "Είστε σίγουροι ότι θέλετε να διαγράψετε την εγγραφή;"
        );

        if (!confirmed) {
          e.preventDefault();
        }
      }}
      className="rounded-xl border border-red-600 bg-white px-4 py-3 text-red-600 transition duration-150 hover:bg-red-50 active:scale-[0.98] active:bg-red-600 active:text-white"
    >
      Διαγραφή παραγγελίας
    </button>
  );
}