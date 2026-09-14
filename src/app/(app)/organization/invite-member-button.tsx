"use client";

import { UserPlus } from "lucide-react";

export function InviteMemberButton() {
  function revealInviteForm() {
    const section = document.getElementById("organization-settings");
    const details = section?.querySelector("details");
    if (details) details.open = true;
    window.setTimeout(() => section?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <button type="button" onClick={revealInviteForm} className="inline-flex items-center gap-2 rounded-md bg-accord-primary px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-accord-primary/30">
      <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />Invite member
    </button>
  );
}
