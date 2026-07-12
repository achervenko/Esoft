UPDATE "user"
SET "role" = 'operator'
WHERE "role" IS NOT NULL
  AND "role" NOT IN ('admin', 'chief_engineer', 'engineer', 'operator');
