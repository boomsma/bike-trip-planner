import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Service-role client for trusted server-only operations (e.g. Storage writes)
// that don't go through a user's RLS-scoped session. Never import this from
// client components or expose SUPABASE_SERVICE_ROLE_KEY to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
