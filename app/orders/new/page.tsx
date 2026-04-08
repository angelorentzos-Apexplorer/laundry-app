import { Suspense } from "react";
import NewOrderPageClient from "./NewOrderPageClient";

export default function NewOrderPage() {
  return (
    <Suspense fallback={<div className="p-6">Φόρτωση...</div>}>
      <NewOrderPageClient />
    </Suspense>
  );
}