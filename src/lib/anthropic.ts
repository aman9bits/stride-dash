import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

export const MODELS = {
  // Used for onboarding parsing (Turn 1 — emotional nuance) and Step 2 explanation generation
  sonnet: 'claude-sonnet-4-6',
  // Used for onboarding parsing (Turns 2-6), Step 1 rough ranking, reaction inference
  haiku: 'claude-haiku-4-5-20251001',
} as const
