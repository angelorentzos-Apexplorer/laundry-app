"use client";

import { useEffect, useRef, useState } from "react";

type Suggestion = {
  display_name: string;
  address?: {
    postcode?: string;
  };
};

export default function AddressAutoComplete({
  defaultAddress = "",
  defaultPostalCode = "",
}: {
  defaultAddress?: string;
  defaultPostalCode?: string;
}) {
  const [query, setQuery] = useState(defaultAddress);
  const [postalCode, setPostalCode] = useState(defaultPostalCode);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(defaultAddress);
  }, [defaultAddress]);

  useEffect(() => {
    setPostalCode(defaultPostalCode);
  }, [defaultPostalCode]);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setOpen(false);
      return;
    }

    const controller = new AbortController();

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          q: query,
          format: "jsonv2",
          addressdetails: "1",
          limit: "5",
          countrycodes: "gr",
          "accept-language": "el",
        });

        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          {
            signal: controller.signal,
            headers: {
              "Accept-Language": "el",
            },
          }
        );

        if (!response.ok) return;

        const data: Suggestion[] = await response.json();
        setResults(data);
        setOpen(true);
      } catch {
        // ignore
      }
    }, 350);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(item: Suggestion) {
    setQuery(item.display_name || "");
    const detectedPostalCode = item.address?.postcode || "";
    setPostalCode(detectedPostalCode);
    setResults([]);
    setOpen(false);

    const postalInput = document.getElementById(
      "postalCode"
    ) as HTMLInputElement | null;

    if (postalInput && detectedPostalCode) {
      postalInput.value = detectedPostalCode;
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        id="address"
        name="address"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        className="w-full rounded-xl border px-4 py-3 outline-none transition focus:border-black"
        placeholder="Ξεκίνα να γράφεις διεύθυνση..."
      />

      <input type="hidden" name="addressResolved" value={query} />
      <input type="hidden" name="postalCodeResolved" value={postalCode} />

      {open && results.length > 0 && (
        <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border bg-white shadow-lg">
          {results.map((item, index) => (
            <button
              key={`${item.display_name}-${index}`}
              type="button"
              onClick={() => handleSelect(item)}
              className="block w-full border-b px-4 py-3 text-left text-sm hover:bg-gray-100"
            >
              <div>{item.display_name}</div>
              {item.address?.postcode && (
                <div className="mt-1 text-xs text-gray-500">
                  ΤΚ: {item.address.postcode}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}