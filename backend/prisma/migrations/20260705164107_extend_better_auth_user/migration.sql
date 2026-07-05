-- AlterTable
ALTER TABLE "user" ADD COLUMN     "first_name" VARCHAR(64),
ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "last_name" VARCHAR(64),
ADD COLUMN     "middle_name" VARCHAR(64),
ADD COLUMN     "position" VARCHAR(64);

-- Normalize roles created before the corporate role set was introduced.
UPDATE "user"
SET "role" = 'admin'
WHERE "username" = 'admin';

UPDATE "user"
SET "role" = 'operator'
WHERE "role" = 'user';

-- Comments for corporate user fields.
COMMENT ON COLUMN "user"."last_name" IS 'Фамилия пользователя';
COMMENT ON COLUMN "user"."first_name" IS 'Имя пользователя';
COMMENT ON COLUMN "user"."middle_name" IS 'Отчество пользователя';
COMMENT ON COLUMN "user"."position" IS 'Должность пользователя';
COMMENT ON COLUMN "user"."last_login_at" IS 'Дата и время последнего входа пользователя в систему';

-- Comments for Better Auth service fields used by the application.
COMMENT ON COLUMN "user"."role" IS 'Роль пользователя в системе';
COMMENT ON COLUMN "user"."banned" IS 'Признак блокировки пользователя: false — активен, true — заблокирован';
COMMENT ON COLUMN "user"."banReason" IS 'Причина блокировки пользователя';
COMMENT ON COLUMN "user"."createdAt" IS 'Дата и время создания учетной записи';
COMMENT ON COLUMN "user"."updatedAt" IS 'Дата и время последнего изменения учетной записи';

-- Corporate role set.
ALTER TABLE "user"
ADD CONSTRAINT "chk_user_role"
CHECK (
  "role" IN (
    'admin',
    'chief_engineer',
    'engineer',
    'operator',
    'auditor'
  )
);
