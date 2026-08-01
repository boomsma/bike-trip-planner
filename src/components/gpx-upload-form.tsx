"use client";

import { useActionState } from "react";
import type { UploadGpxState } from "@/app/trips/[tripId]/actions";

export function GpxUploadForm({
  action,
}: {
  action: (state: UploadGpxState, formData: FormData) => Promise<UploadGpxState>;
}) {
  const [state, formAction, pending] = useActionState<UploadGpxState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 w-full">
      <label className="flex flex-col gap-1 text-sm">
        Upload one or more GPX files (automatically chained into one route by
        matching nearby track endpoints — upload order doesn&apos;t matter)
        <input
          type="file"
          name="files"
          accept=".gpx,application/gpx+xml"
          multiple
          required
          className="border rounded px-3 py-2"
        />
      </label>
      {state.error && (
        <p className="text-red-600 text-sm" role="alert">
          {state.error}
        </p>
      )}
      {state.warning && (
        <p className="text-amber-600 text-sm" role="alert">
          {state.warning}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded px-3 py-2 self-start disabled:opacity-50"
      >
        {pending ? "Uploading…" : "Upload GPX"}
      </button>
    </form>
  );
}
