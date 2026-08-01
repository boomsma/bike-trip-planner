"use client";

import { useActionState, useState } from "react";
import type { UpdateTripDetailsState } from "@/app/trips/[tripId]/actions";

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function TripDetailsForm({
  action,
  initialNumCyclists,
  initialStartDate,
  initialEndDate,
  initialNumDays,
}: {
  action: (
    state: UpdateTripDetailsState,
    formData: FormData,
  ) => Promise<UpdateTripDetailsState>;
  initialNumCyclists: number;
  initialStartDate: Date | null;
  initialEndDate: Date | null;
  initialNumDays: number | null;
}) {
  const [state, formAction, pending] = useActionState<UpdateTripDetailsState, FormData>(
    action,
    { error: null },
  );
  const [planningMode, setPlanningMode] = useState<"dates" | "duration">(
    initialStartDate ? "dates" : "duration",
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <label className="flex flex-col gap-1 text-sm">
        Number of cyclists
        <input
          type="number"
          name="numCyclists"
          min={1}
          defaultValue={initialNumCyclists}
          required
          className="border rounded px-3 py-2"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm mb-1">Dates</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="planningMode"
            value="dates"
            checked={planningMode === "dates"}
            onChange={() => setPlanningMode("dates")}
          />
          I know the exact dates
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="planningMode"
            value="duration"
            checked={planningMode === "duration"}
            onChange={() => setPlanningMode("duration")}
          />
          I just know how many days
        </label>
      </fieldset>

      {planningMode === "dates" ? (
        <div className="flex gap-2">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Start date
            <input
              type="date"
              name="startDate"
              defaultValue={toDateInputValue(initialStartDate)}
              required
              className="border rounded px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            End date
            <input
              type="date"
              name="endDate"
              defaultValue={toDateInputValue(initialEndDate)}
              required
              className="border rounded px-3 py-2"
            />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Number of days
          <input
            type="number"
            name="numDays"
            min={1}
            defaultValue={initialNumDays ?? undefined}
            required
            className="border rounded px-3 py-2"
          />
        </label>
      )}

      {state.error && (
        <p className="text-red-600 text-sm" role="alert">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded px-3 py-2 self-start disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
