-- ─────────────────────────────────────────────────────────────────────────────
-- Stride Dash — RPC Helper Functions
-- Run this in Supabase Dashboard → SQL Editor after 001_initial_schema.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── Append dismissed job (idempotent) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION append_dismissed_job(
  p_candidate_id UUID,
  p_job_id TEXT
) RETURNS void AS $$
BEGIN
  UPDATE candidates
  SET
    dismissed_job_ids = array_append(dismissed_job_ids, p_job_id),
    updated_at = NOW()
  WHERE candidate_id = p_candidate_id
    AND NOT (dismissed_job_ids @> ARRAY[p_job_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Append applied job (idempotent) ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION append_applied_job(
  p_candidate_id UUID,
  p_job_id TEXT
) RETURNS void AS $$
BEGIN
  UPDATE candidates
  SET
    applied_job_ids = array_append(applied_job_ids, p_job_id),
    updated_at = NOW()
  WHERE candidate_id = p_candidate_id
    AND NOT (applied_job_ids @> ARRAY[p_job_id]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── Update job ages (called inline before each matching run) ─────────────────

CREATE OR REPLACE FUNCTION update_job_ages() RETURNS void AS $$
BEGIN
  UPDATE jobs
  SET job_age_days = EXTRACT(DAY FROM (NOW() - published_date))::INTEGER
  WHERE is_active = TRUE
    AND published_date IS NOT NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
