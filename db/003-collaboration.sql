BEGIN;
ALTER TABLE synapse_projects ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;
CREATE TABLE IF NOT EXISTS synapse_members (
 id uuid PRIMARY KEY,
 project_id uuid NOT NULL REFERENCES synapse_projects(id) ON DELETE CASCADE,
 email text NOT NULL CHECK (email = lower(email)),
 role text NOT NULL CHECK (role IN ('editor','reader')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
 invited_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
 accepted_at timestamptz,
 UNIQUE(project_id,email)
);
CREATE INDEX IF NOT EXISTS synapse_members_email ON synapse_members(email,project_id);
COMMIT;
