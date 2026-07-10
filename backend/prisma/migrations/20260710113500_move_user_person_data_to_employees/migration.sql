-- Move corporate person data from Better Auth "user" to employees.
-- A user account must point to one employee through employee_users.
-- One employee may have many user accounts.

WITH normalized_users AS (
  SELECT DISTINCT
    COALESCE(NULLIF(TRIM(u."last_name"), ''), split_part(u."name", ' ', 1), u."username", 'Пользователь') AS "last_name",
    COALESCE(NULLIF(TRIM(u."first_name"), ''), NULLIF(split_part(u."name", ' ', 2), ''), u."username", 'Пользователь') AS "first_name",
    NULLIF(COALESCE(NULLIF(TRIM(u."middle_name"), ''), NULLIF(split_part(u."name", ' ', 3), '')), '') AS "middle_name",
    COALESCE(NULLIF(TRIM(u."position"), ''), 'Не указана') AS "position"
  FROM "user" u
  WHERE NOT EXISTS (
    SELECT 1
    FROM "employee_users" eu
    WHERE eu."user_id" = u."id"
  )
)
INSERT INTO "employees" ("last_name", "first_name", "middle_name", "position")
SELECT nu."last_name", nu."first_name", nu."middle_name", nu."position"
FROM normalized_users nu
WHERE NOT EXISTS (
  SELECT 1
  FROM "employees" e
  WHERE e."last_name" = nu."last_name"
    AND e."first_name" = nu."first_name"
    AND COALESCE(e."middle_name", '') = COALESCE(nu."middle_name", '')
    AND e."position" = nu."position"
);

WITH users_without_employee AS (
  SELECT
    u."id" AS "user_id",
    e."id" AS "employee_id",
    ROW_NUMBER() OVER (
      PARTITION BY u."id"
      ORDER BY e."id" DESC
    ) AS rn
  FROM "user" u
  JOIN "employees" e
    ON e."last_name" = COALESCE(NULLIF(TRIM(u."last_name"), ''), split_part(u."name", ' ', 1), u."username", 'Пользователь')
   AND e."first_name" = COALESCE(NULLIF(TRIM(u."first_name"), ''), NULLIF(split_part(u."name", ' ', 2), ''), u."username", 'Пользователь')
   AND COALESCE(e."middle_name", '') = COALESCE(NULLIF(COALESCE(NULLIF(TRIM(u."middle_name"), ''), NULLIF(split_part(u."name", ' ', 3), '')), ''), '')
   AND e."position" = COALESCE(NULLIF(TRIM(u."position"), ''), 'Не указана')
  WHERE NOT EXISTS (
    SELECT 1
    FROM "employee_users" eu
    WHERE eu."user_id" = u."id"
  )
)
INSERT INTO "employee_users" ("employee_id", "user_id")
SELECT "employee_id", "user_id"
FROM users_without_employee
WHERE rn = 1
ON CONFLICT ("user_id") DO NOTHING;

-- Existing schema allowed only one account per employee. Allow many accounts.
DROP INDEX IF EXISTS "uq_employee_users_employee";
CREATE INDEX IF NOT EXISTS "idx_employee_users_employee_id" ON "employee_users"("employee_id");

-- Better Auth user is now account data only. FIO and position live in employees.
UPDATE "user"
SET "name" = COALESCE(NULLIF(TRIM("displayUsername"), ''), NULLIF(TRIM("username"), ''), "email")
WHERE "name" IS DISTINCT FROM COALESCE(NULLIF(TRIM("displayUsername"), ''), NULLIF(TRIM("username"), ''), "email");

ALTER TABLE "user"
DROP COLUMN IF EXISTS "last_name",
DROP COLUMN IF EXISTS "first_name",
DROP COLUMN IF EXISTS "middle_name",
DROP COLUMN IF EXISTS "position";

COMMENT ON TABLE "employee_users" IS 'Связь сотрудников предприятия с учетными записями пользователей системы';
COMMENT ON COLUMN "employee_users"."employee_id" IS 'Сотрудник предприятия';
COMMENT ON COLUMN "employee_users"."user_id" IS 'Учетная запись пользователя Better Auth';
