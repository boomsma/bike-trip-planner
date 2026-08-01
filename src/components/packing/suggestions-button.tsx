"use client";

import { useState, useTransition } from "react";
import type { GenerateSuggestionsResult } from "@/app/trips/[tripId]/packing/actions";

const SOURCE_LABEL: Record<string, string> = {
  forecast: "using the weather forecast",
  "historical-average": "using typical weather for that time of year",
};

export function SuggestionsButton({
  action,
}: {
  action: () => Promise<GenerateSuggestionsResult>;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) {
        setError(res.error);
        return;
      }
      const sourceNote = res.weatherSource ? ` (${SOURCE_LABEL[res.weatherSource]})` : "";
      setMessage(
        res.addedCount === 0
          ? `No new suggestions${sourceNote} — either nothing matched, or they're already on your list.`
          : `Added ${res.addedCount} suggested item${res.addedCount === 1 ? "" : "s"}${sourceNote}.`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="bg-black text-white rounded px-3 py-2 self-start disabled:opacity-50"
      >
        {pending ? "Thinking…" : "Get smart suggestions"}
      </button>
      {message && <p className="text-sm text-gray-500">{message}</p>}
      {error && (
        <p className="text-red-600 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
