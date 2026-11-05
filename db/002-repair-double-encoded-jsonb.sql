-- Explicit, one-off repair; run ONLY after a verified pg_dump backup.
-- Targets only SYNAPSE records that were accidentally stored as jsonb strings.
-- Any invalid entry raises an exception and rolls back ALL changes.
BEGIN;
DO $repair$
DECLARE
  item record;
  parsed jsonb;
  project_count integer := 0;
  snapshot_count integer := 0;
BEGIN
  FOR item IN
    SELECT id, document
    FROM synapse_projects
    WHERE jsonb_typeof(document) = 'string'
    FOR UPDATE
  LOOP
    BEGIN
      parsed := (item.document #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Proyecto % contiene JSON no convertible; no se modificó ningún registro', item.id;
    END;

    IF jsonb_typeof(parsed) IS DISTINCT FROM 'object'
       OR (parsed->>'id') IS DISTINCT FROM item.id::text
       OR jsonb_typeof(parsed->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(parsed->'mainFile') IS DISTINCT FROM 'string'
       OR jsonb_typeof(parsed->'files') IS DISTINCT FROM 'array'
       OR jsonb_typeof(parsed->'createdAt') IS DISTINCT FROM 'string'
       OR jsonb_typeof(parsed->'updatedAt') IS DISTINCT FROM 'string' THEN
      RAISE EXCEPTION 'Proyecto % no pasa validación estructural; transacción cancelada', item.id;
    END IF;
    IF btrim(parsed->>'name') = ''
       OR jsonb_array_length(parsed->'files') = 0
       OR jsonb_array_length(parsed->'files') > 150 THEN
      RAISE EXCEPTION 'Proyecto % tiene nombre o archivos inválidos; transacción cancelada', item.id;
    END IF;
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(parsed->'files') AS file(item)
      WHERE jsonb_typeof(file.item) IS DISTINCT FROM 'object'
         OR jsonb_typeof(file.item->'path') IS DISTINCT FROM 'string'
         OR jsonb_typeof(file.item->'content') IS DISTINCT FROM 'string'
         OR ((file.item->>'encoding') IS DISTINCT FROM 'utf8' AND (file.item->>'encoding') IS DISTINCT FROM 'base64')
    ) OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(parsed->'files') AS file(item)
      WHERE file.item->>'path' = parsed->>'mainFile'
        AND file.item->>'encoding' = 'utf8'
    ) THEN
      RAISE EXCEPTION 'Proyecto % tiene una lista de archivos no válida; transacción cancelada', item.id;
    END IF;

    UPDATE synapse_projects SET document = parsed WHERE id = item.id;
    project_count := project_count + 1;
  END LOOP;

  FOR item IN
    SELECT id, payload
    FROM synapse_snapshots
    WHERE jsonb_typeof(payload) = 'string'
    FOR UPDATE
  LOOP
    BEGIN
      parsed := (item.payload #>> '{}')::jsonb;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Instantánea % contiene JSON no convertible; transacción cancelada', item.id;
    END;

    IF jsonb_typeof(parsed) IS DISTINCT FROM 'object'
       OR jsonb_typeof(parsed->'name') IS DISTINCT FROM 'string'
       OR jsonb_typeof(parsed->'mainFile') IS DISTINCT FROM 'string'
       OR jsonb_typeof(parsed->'files') IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Instantánea % no pasa validación estructural; transacción cancelada', item.id;
    END IF;
    IF jsonb_array_length(parsed->'files') < 1
       OR jsonb_array_length(parsed->'files') > 150
       OR NOT EXISTS (
         SELECT 1 FROM jsonb_array_elements(parsed->'files') AS file(item)
         WHERE file.item->>'path' = parsed->>'mainFile'
       )
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements(parsed->'files') AS file(item)
         WHERE jsonb_typeof(file.item) IS DISTINCT FROM 'object'
            OR jsonb_typeof(file.item->'path') IS DISTINCT FROM 'string'
            OR jsonb_typeof(file.item->'content') IS DISTINCT FROM 'string'
            OR ((file.item->>'encoding') IS DISTINCT FROM 'utf8' AND (file.item->>'encoding') IS DISTINCT FROM 'base64')
       )
    THEN
      RAISE EXCEPTION 'Instantánea % contiene archivos inválidos; transacción cancelada', item.id;
    END IF;

    UPDATE synapse_snapshots SET payload = parsed WHERE id = item.id;
    snapshot_count := snapshot_count + 1;
  END LOOP;

  RAISE NOTICE 'Reparados % proyectos y % instantáneas; el respaldo original permanece intacto', project_count, snapshot_count;
END
$repair$;
COMMIT;
