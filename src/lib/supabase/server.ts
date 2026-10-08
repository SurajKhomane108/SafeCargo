import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

export function hasServerSupabaseConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE);
}

export function createServerRoleSupabase() {
  if (typeof window !== "undefined") {
    throw new Error(
      "[SafeCargo] createServerRoleSupabase() must only be called on the server. " +
        "SUPABASE_SERVICE_ROLE_KEY must never reach the browser."
    );
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    return null;
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export type ServerSupabase = ReturnType<typeof createServerRoleSupabase>;
