import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-accord-mist">
      <div className="flex">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <TopNav />
          <main className="mx-auto w-full max-w-7xl px-4 py-7 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
