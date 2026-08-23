import { AppShell } from "@/components/layout/app-shell";
import { createSupabaseServerAuthClient } from "@/lib/auth/supabase-server";
import { getAccordAuthProfile } from "@/lib/auth/user-profile";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerAuthClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

  return (
    <AppShell account={data.user ? getAccordAuthProfile(data.user) : null}>
      {children}
    </AppShell>
  );
}
