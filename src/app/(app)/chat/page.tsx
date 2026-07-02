import { PageHeader } from "@/components/ui/page-header";
import { ChatWorkspace } from "./chat-workspace";

export default function ChatPage() {
  return (
    <div className="space-y-7">
      <PageHeader
        title="Governed Chat"
        description="Talk to approved models through Accord. Prompts are scanned before submission, policy decisions are visible, and logs store metadata by default."
      />
      <ChatWorkspace />
    </div>
  );
}
