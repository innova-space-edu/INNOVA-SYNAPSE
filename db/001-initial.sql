-- Dedicated SYNAPSE database, NOT the intranet's existing PostgreSQL schema.
CREATE TABLE IF NOT EXISTS synapse_projects (
  id uuid PRIMARY KEY,
  owner_email text NOT NULL,
  document jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_synapse_projects_owner ON synapse_projects (owner_email, updated_at DESC);
CREATE TABLE IF NOT EXISTS synapse_snapshots (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES synapse_projects(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_synapse_snapshots_project ON synapse_snapshots (project_id, owner_email, created_at DESC);
