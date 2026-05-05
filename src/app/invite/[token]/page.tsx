import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/server'
import LandingPage from '@/components/auth/LandingPage'

interface Props {
  params: Promise<{ token: string }>
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params

  // Validate token
  const { data: invite, error } = await supabaseAdmin
    .from('invite_tokens')
    .select('*')
    .eq('token', token)
    .single()

  if (error || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invalid invite</h1>
          <p className="text-gray-500 text-sm">This invite link isn't valid. Check the link in your message and try again.</p>
        </div>
      </div>
    )
  }

  if (invite.is_expired || new Date(invite.expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Invite expired</h1>
          <p className="text-gray-500 text-sm">This invite link has expired. Reply to the message you received and we'll send a fresh one.</p>
        </div>
      </div>
    )
  }

  // Log the click
  await supabaseAdmin
    .from('invite_tokens')
    .update({ invite_clicked_at: new Date().toISOString() })
    .eq('token', token)

  return <LandingPage email={invite.email} token={token} />
}
