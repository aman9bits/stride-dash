'use client'

import posthog from 'posthog-js'

export function initPosthog() {
  if (typeof window === 'undefined') return
  if (posthog.__loaded) return

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: 'https://app.posthog.com',
    capture_pageview: false,
    capture_pageleave: false,
    person_profiles: 'identified_only',
  })
}

export function identifyUser(candidateId: string, email: string, cohortId: string) {
  posthog.identify(candidateId, { email, cohort_id: cohortId })
}

export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties)
}

export { posthog }
