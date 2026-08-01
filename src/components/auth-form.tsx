"use client";

import { useActionState } from "react";
import type { AuthState } from "@/app/login/actions";

export function AuthForm({
  action,
  submitLabel,
}: {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 w-full max-w-sm">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          className="border rounded px-3 py-2"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          minLength={6}
          className="border rounded px-3 py-2"
        />
      </label>
      {state.error && (
        <p className="text-red-600 text-sm" role="alert">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-black text-white rounded px-3 py-2 disabled:opacity-50"
      >
        {pending ? "…" : submitLabel}
      </button>
    </form>
  );
}
