-- AlterTable: add structured name fields (keep "name" for better-auth)
ALTER TABLE "User" ADD COLUMN     "title" TEXT,
ADD COLUMN     "givenName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "familyName" TEXT NOT NULL DEFAULT '';

-- Backfill existing rows best-effort (Western assumption: given → family).
-- A leading "Dr"/"Dr." honorific is lifted into "title"; the first remaining
-- token becomes "givenName" and the rest becomes "familyName". Rows where the
-- stored name is in Hungarian family-first order will be split the wrong way
-- and must be corrected by an admin in the panel.
UPDATE "User" AS u SET
  "title"      = CASE WHEN u."name" ~* '^dr\.?(\s|$)' THEN 'Dr.' ELSE NULL END,
  "givenName"  = split_part(s.stripped, ' ', 1),
  "familyName" = btrim(regexp_replace(s.stripped, '^\S+\s*', ''))
FROM (
  SELECT id, btrim(regexp_replace("name", '^[Dd]r\.?\s+', '')) AS stripped
  FROM "User"
) AS s
WHERE s.id = u.id;
