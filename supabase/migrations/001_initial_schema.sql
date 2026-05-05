-- ─────────────────────────────────────────────────────────────────────────────
-- Stride Dash — Initial Schema Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Candidates ──────────────────────────────────────────────────────────────

CREATE TABLE candidates (
  candidate_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id          UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email                 TEXT NOT NULL UNIQUE,
  name                  TEXT,

  -- Current situation
  current_role_title    TEXT,
  current_company       TEXT,
  current_company_type  TEXT CHECK (current_company_type IN ('service_co','product','startup','mnc','unknown')),
  total_experience_years NUMERIC(4,1),
  primary_skills        TEXT[] DEFAULT '{}',
  current_location      TEXT,

  -- Search preferences (hard filters at matching time)
  target_company_types  TEXT[] DEFAULT '{}',
  target_role_type      TEXT CHECK (target_role_type IN ('ic','manager','both')),
  target_function_change TEXT CHECK (target_function_change IN ('same','adjacent','open')),
  location_preference   TEXT[] DEFAULT '{}',
  remote_preference     TEXT CHECK (remote_preference IN ('remote','hybrid','office','flexible')),
  salary_floor_lpa      NUMERIC(6,2),

  -- Soft context (Sonnet reads at matching time)
  trigger_state         TEXT CHECK (trigger_state IN ('fleeing','laid_off','passively_open')),
  what_is_broken        TEXT,
  career_aspiration     TEXT,
  hard_constraints      TEXT,

  -- Learned from reactions (append-only)
  learned_preferences   TEXT DEFAULT '',
  dismissed_job_ids     TEXT[] DEFAULT '{}',
  applied_job_ids       TEXT[] DEFAULT '{}',

  -- Metadata
  profile_completeness  NUMERIC(3,2) DEFAULT 0,
  onboarding_complete   BOOLEAN DEFAULT FALSE,
  onboarding_turn       INTEGER DEFAULT 0,
  cohort_id             TEXT DEFAULT 'shine-learning-apr-2026',
  last_matching_run     TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_candidates_auth_user ON candidates(auth_user_id);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_own_row" ON candidates
  FOR ALL USING (auth.uid() = auth_user_id);

-- ─── Jobs ─────────────────────────────────────────────────────────────────────

CREATE TABLE jobs (
  job_id              TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  jd_text             TEXT,
  skills_raw          TEXT,
  min_exp             NUMERIC(4,1),
  max_exp             NUMERIC(4,1),
  industry            TEXT,
  locations_raw       TEXT,
  published_date      TIMESTAMPTZ,
  company_name        TEXT,
  company_type        TEXT CHECK (company_type IN ('service_co','product','startup','mnc','unknown')),
  locations           TEXT[] DEFAULT '{}',
  is_pan_india        BOOLEAN DEFAULT FALSE,
  job_age_days        INTEGER,
  salary_min_lpa      NUMERIC(6,2),
  salary_max_lpa      NUMERIC(6,2),
  salary_confidence   TEXT CHECK (salary_confidence IN ('hardcoded','fallback','unknown')),
  ingested_at         TIMESTAMPTZ DEFAULT NOW(),
  is_active           BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_jobs_exp ON jobs(min_exp, max_exp) WHERE is_active = TRUE;
CREATE INDEX idx_jobs_company_type ON jobs(company_type) WHERE is_active = TRUE;
CREATE INDEX idx_jobs_published ON jobs(published_date) WHERE is_active = TRUE;
CREATE INDEX idx_jobs_locations ON jobs USING GIN(locations);

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs_read_authenticated" ON jobs
  FOR SELECT USING (auth.role() = 'authenticated');

-- ─── Recommendations ─────────────────────────────────────────────────────────

CREATE TABLE recommendations (
  rec_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id        UUID REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  job_id              TEXT REFERENCES jobs(job_id),
  why_it_fits         TEXT[] DEFAULT '{}',
  uncertainty_flags   TEXT[] DEFAULT '{}',
  filter_summary      TEXT,
  runner_up_reason    TEXT,
  rank_in_batch       INTEGER CHECK (rank_in_batch BETWEEN 1 AND 4),
  batch_date          DATE,
  reaction_type       TEXT CHECK (reaction_type IN ('apply','dismiss','ask_why')),
  reaction_at         TIMESTAMPTZ,
  dismiss_reason      TEXT,
  apply_reason        TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recs_candidate_date ON recommendations(candidate_id, batch_date);
CREATE INDEX idx_recs_reaction ON recommendations(candidate_id, reaction_type);

ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "recs_own" ON recommendations
  FOR ALL USING (
    candidate_id IN (
      SELECT candidate_id FROM candidates WHERE auth_user_id = auth.uid()
    )
  );

-- ─── Onboarding Turns ────────────────────────────────────────────────────────

CREATE TABLE onboarding_turns (
  turn_id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id            UUID REFERENCES candidates(candidate_id) ON DELETE CASCADE,
  session_id              UUID NOT NULL,
  turn_number             INTEGER NOT NULL,
  system_question         TEXT NOT NULL,
  candidate_response      TEXT,
  clarification_sent      TEXT,
  clarification_response  TEXT,
  extracted_fields        JSONB,
  extraction_confidence   JSONB,
  needs_clarification     BOOLEAN DEFAULT FALSE,
  response_length_chars   INTEGER,
  min_confidence          NUMERIC(3,2),
  blocking_field_low_conf BOOLEAN,
  clarification_was_needed BOOLEAN,
  clarification_resolved  BOOLEAN,
  parsing_model           TEXT,
  parsing_latency_ms      INTEGER,
  parsing_input_tokens    INTEGER,
  parsing_output_tokens   INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_candidate ON onboarding_turns(candidate_id, turn_number);
CREATE INDEX idx_onboarding_session ON onboarding_turns(session_id);
CREATE INDEX idx_onboarding_low_conf ON onboarding_turns(min_confidence) WHERE min_confidence < 0.6;

ALTER TABLE onboarding_turns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "onboarding_turns_own_read" ON onboarding_turns
  FOR SELECT USING (
    candidate_id IN (SELECT candidate_id FROM candidates WHERE auth_user_id = auth.uid())
  );

-- ─── Invite Tokens ───────────────────────────────────────────────────────────

CREATE TABLE invite_tokens (
  token               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT NOT NULL,
  cohort_id           TEXT NOT NULL,
  candidate_id        UUID REFERENCES candidates(candidate_id),
  invite_sent_at      TIMESTAMPTZ DEFAULT NOW(),
  invite_clicked_at   TIMESTAMPTZ,
  signup_completed_at TIMESTAMPTZ,
  is_expired          BOOLEAN DEFAULT FALSE,
  expires_at          TIMESTAMPTZ DEFAULT NOW() + INTERVAL '14 days'
);

CREATE INDEX idx_invite_token ON invite_tokens(token);
CREATE INDEX idx_invite_email ON invite_tokens(email);

-- No RLS — service role only

-- ─── NPS Responses ───────────────────────────────────────────────────────────

CREATE TABLE nps_responses (
  response_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id      UUID REFERENCES candidates(candidate_id),
  score             INTEGER CHECK (score BETWEEN 0 AND 10),
  reason            TEXT,
  measurement_day   INTEGER CHECK (measurement_day IN (14, 30)),
  submitted_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nps_own_write" ON nps_responses
  FOR INSERT WITH CHECK (
    candidate_id IN (SELECT candidate_id FROM candidates WHERE auth_user_id = auth.uid())
  );

-- ─── Matching Runs Log ───────────────────────────────────────────────────────

CREATE TABLE matching_runs (
  run_id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          UUID REFERENCES candidates(candidate_id),
  pool_size_prefilter   INTEGER,
  pool_size_postfilter  INTEGER,
  job_ids_selected      TEXT[],
  low_fit_count         INTEGER DEFAULT 0,
  step1_input_tokens    INTEGER,
  step1_output_tokens   INTEGER,
  step2_input_tokens    INTEGER,
  step2_output_tokens   INTEGER,
  duration_ms           INTEGER,
  run_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_matching_runs_date ON matching_runs(run_at);

-- ─── Helper: updated_at trigger ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidates_updated_at
  BEFORE UPDATE ON candidates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
