"use client";

import { useState } from "react";

type HiddenMoneyBoxProps = {
  title: string;
  value: string;
};

export default function HiddenMoneyBox({ title, value }: HiddenMoneyBoxProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="rounded-2xl border bg-gray-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-gray-500">{title}</p>

          <p className="mt-2 text-3xl font-bold">
            {visible ? value : "••••••"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          className="rounded-xl border border-black bg-white px-3 py-2 text-sm text-black transition hover:bg-gray-100 active:scale-[0.98]"
          aria-label={visible ? "Απόκρυψη ποσού" : "Εμφάνιση ποσού"}
          title={visible ? "Απόκρυψη ποσού" : "Εμφάνιση ποσού"}
        >
          {visible ? "🙈" : "👁️"}
        </button>
      </div>
    </div>
  );
}