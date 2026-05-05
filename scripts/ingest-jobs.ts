/**
 * Stride Dash — Job Ingestion Script
 * Usage: npx tsx scripts/ingest-jobs.ts --file /path/to/jobs.csv
 *
 * Expected CSV columns (all optional except job_id and title):
 *   job_id, title, company_name, locations_raw, published_date,
 *   min_exp, max_exp, jd_text, skills_raw, industry,
 *   company_type (startup|product|mnc|service_co|unknown)
 */

import { createClient } from '@supabase/supabase-js'
import { parse } from 'csv-parse/sync'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

// ─── Parse arguments ──────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const fileIndex = args.indexOf('--file')
if (fileIndex === -1 || !args[fileIndex + 1]) {
  console.error('Usage: npx tsx scripts/ingest-jobs.ts --file /path/to/jobs.csv')
  process.exit(1)
}
const filePath = resolve(args[fileIndex + 1])

// ─── Company type inference (keyword heuristic) ───────────────────────────────

const PRODUCT_KEYWORDS = [
  'saas', 'platform', 'product-led', 'b2b', 'b2c', 'app', 'software', 'tech',
  'flipkart', 'swiggy', 'zomato', 'razorpay', 'meesho', 'groww', 'cred', 'cleartax',
  'paytm', 'phonepe', 'freshworks', 'zoho', 'browserstack', 'postman', 'chargebee',
]
const SERVICE_KEYWORDS = [
  'tcs', 'infosys', 'wipro', 'hcl', 'cognizant', 'accenture', 'capgemini', 'tech mahindra',
  'mphasis', 'hexaware', 'ltimindtree', 'birlasoft', 'consulting', 'services',
]
const MNC_KEYWORDS = [
  'google', 'microsoft', 'amazon', 'apple', 'meta', 'ibm', 'oracle', 'sap',
  'salesforce', 'adobe', 'cisco', 'intel', 'qualcomm', 'dell',
]

function inferCompanyType(companyName: string | null, jdText: string | null): string {
  const text = `${companyName ?? ''} ${jdText?.slice(0, 500) ?? ''}`.toLowerCase()

  for (const kw of MNC_KEYWORDS) {
    if (text.includes(kw)) return 'mnc'
  }
  for (const kw of SERVICE_KEYWORDS) {
    if (text.includes(kw)) return 'service_co'
  }
  for (const kw of PRODUCT_KEYWORDS) {
    if (text.includes(kw)) return 'product'
  }
  return 'unknown'
}

// ─── Location normalization ───────────────────────────────────────────────────

const CITY_ALIASES: Record<string, string> = {
  'bengaluru': 'Bangalore',
  'blr': 'Bangalore',
  'hyd': 'Hyderabad',
  'mum': 'Mumbai',
  'bombay': 'Mumbai',
  'chennai': 'Chennai',
  'madras': 'Chennai',
  'pune': 'Pune',
  'delhi': 'Delhi',
  'ncr': 'Delhi',
  'gurgaon': 'Delhi',
  'gurugram': 'Delhi',
  'noida': 'Delhi',
}

function normalizeLocations(raw: string | null): { locations: string[]; is_pan_india: boolean } {
  if (!raw) return { locations: [], is_pan_india: false }

  const lower = raw.toLowerCase()
  if (lower.includes('pan india') || lower.includes('pan-india') || lower.includes('anywhere in india')) {
    return { locations: [], is_pan_india: true }
  }

  const cities: string[] = []
  const parts = raw.split(/[,;|\/]/).map(p => p.trim())

  for (const part of parts) {
    const key = part.toLowerCase()
    const normalized = CITY_ALIASES[key]
    if (normalized) {
      cities.push(normalized)
    } else if (part.length > 2) {
      // Capitalize first letter of each word
      cities.push(part.replace(/\b\w/g, c => c.toUpperCase()))
    }
  }

  return { locations: [...new Set(cities)], is_pan_india: false }
}

// ─── Main ingestion ───────────────────────────────────────────────────────────

async function run() {
  console.log(`Reading ${filePath}...`)
  const raw = readFileSync(filePath, 'utf-8')

  const rows: Record<string, string>[] = parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  })

  console.log(`Parsed ${rows.length} rows`)

  let upserted = 0
  let skipped = 0
  const errors: string[] = []
  const now = new Date()

  for (const row of rows) {
    const jobId = row['job_id']?.trim()
    const title = row['title']?.trim()

    if (!jobId || !title) {
      skipped++
      continue
    }

    const publishedDate = row['published_date'] ? new Date(row['published_date']) : null
    const jobAgeDays = publishedDate
      ? Math.floor((now.getTime() - publishedDate.getTime()) / (1000 * 60 * 60 * 24))
      : null

    // Skip jobs older than 90 days
    if (jobAgeDays !== null && jobAgeDays > 90) {
      skipped++
      continue
    }

    const locRaw = row['locations_raw'] ?? null
    const { locations, is_pan_india } = normalizeLocations(locRaw)

    const companyName = row['company_name']?.trim() || null
    const jdText = row['jd_text']?.trim() || null

    const companyTypeRaw = row['company_type']?.trim()
    const validTypes = ['startup', 'product', 'mnc', 'service_co', 'unknown']
    const company_type = validTypes.includes(companyTypeRaw)
      ? companyTypeRaw
      : inferCompanyType(companyName, jdText)

    const record = {
      job_id: jobId,
      title,
      company_name: companyName,
      company_type,
      jd_text: jdText,
      skills_raw: row['skills_raw']?.trim() || null,
      industry: row['industry']?.trim() || null,
      locations_raw: locRaw,
      locations,
      is_pan_india,
      min_exp: row['min_exp'] ? parseFloat(row['min_exp']) : null,
      max_exp: row['max_exp'] ? parseFloat(row['max_exp']) : null,
      published_date: publishedDate?.toISOString() ?? null,
      job_age_days: jobAgeDays,
      // Salary: not in Google Jobs feed — set at matching time via SALARY_BANDS
      salary_min_lpa: null,
      salary_max_lpa: null,
      salary_confidence: 'unknown',
      is_active: true,
      ingested_at: now.toISOString(),
    }

    const { error } = await supabase
      .from('jobs')
      .upsert(record, { onConflict: 'job_id' })

    if (error) {
      errors.push(`${jobId}: ${error.message}`)
    } else {
      upserted++
    }
  }

  console.log(`\n✓ Upserted: ${upserted}`)
  console.log(`  Skipped:  ${skipped}`)
  if (errors.length > 0) {
    console.log(`  Errors:   ${errors.length}`)
    errors.slice(0, 10).forEach(e => console.log(`    → ${e}`))
  }

  // Mark jobs not in this CSV as inactive (soft delete)
  // Only do this if the CSV is a full replacement, not a delta feed
  const fullReplace = args.includes('--full-replace')
  if (fullReplace) {
    const ingestedIds = rows.map(r => r['job_id']).filter(Boolean)
    const { error: deactivateErr } = await supabase
      .from('jobs')
      .update({ is_active: false })
      .eq('is_active', true)
      .not('job_id', 'in', `(${ingestedIds.join(',')})`)

    if (deactivateErr) {
      console.log(`  Deactivate error: ${deactivateErr.message}`)
    } else {
      console.log(`  Deactivated stale jobs (--full-replace mode)`)
    }
  }
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
