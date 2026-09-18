import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAccordCompanyExists(
  supabase: SupabaseClient,
  slug: string,
  name: string
) {
  return supabase.from("accord_companies").upsert(
    {
      slug,
      name,
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "slug",
      ignoreDuplicates: true
    }
  );
}
