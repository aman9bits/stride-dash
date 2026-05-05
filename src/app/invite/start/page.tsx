export default function InviteStartPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Stride Dash</h1>
        </div>

        <div className="mb-10">
          <p className="text-xl font-semibold text-gray-900 leading-snug mb-3">
            3 jobs, curated for you.
          </p>
          <p className="text-gray-500 text-base leading-relaxed">
            Not 300. Not a search box. Jobs matched to your specific situation — with a written explanation of exactly why each one fits.
          </p>
        </div>

        <div className="bg-gray-50 rounded-2xl p-5">
          <p className="text-sm font-semibold text-gray-900 mb-1">This is a private pilot</p>
          <p className="text-sm text-gray-500 leading-relaxed">
            Stride Dash is invite-only right now. If you received an invite link, check your email — it should contain a personal sign-in link.
          </p>
          <p className="text-sm text-gray-500 mt-3 leading-relaxed">
            Want access? Join the Shine Learning community — invites go out weekly.
          </p>
        </div>

        <p className="mt-8 text-xs text-gray-400 text-center">
          Private pilot for Shine Learning community.
        </p>
      </div>
    </div>
  )
}
