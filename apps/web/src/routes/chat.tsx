import { createFileRoute } from '@tanstack/react-router'
import { ChatPanel } from '@/components/chat/ChatPanel'

/**
 * Public, unauthenticated patient chat page. Mobile-first: the panel fills the
 * viewport on phones and sits in a centered card on larger screens. Not under
 * the `_auth` guard — patients are not staff users.
 */
function ChatPage() {
  return (
    <div className="flex h-screen w-full items-stretch justify-center bg-muted sm:items-center sm:p-4">
      <div className="h-full w-full overflow-hidden bg-background shadow-sm sm:h-[720px] sm:max-h-[92vh] sm:max-w-md sm:rounded-2xl sm:border sm:border-border/60">
        <ChatPanel />
      </div>
    </div>
  )
}

export const Route = createFileRoute('/chat')({
  component: ChatPage,
})
