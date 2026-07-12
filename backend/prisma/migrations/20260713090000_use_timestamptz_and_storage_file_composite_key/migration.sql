DROP INDEX IF EXISTS "storage_files_object_key_key";

CREATE UNIQUE INDEX "uq_storage_files_bucket_object_key"
ON "storage_files"("bucket", "object_key");

ALTER TABLE "storage_files"
  ALTER COLUMN "created_at" DROP DEFAULT,
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6) USING "created_at" AT TIME ZONE 'Europe/Moscow',
  ALTER COLUMN "created_at" SET DEFAULT now(),
  ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(6) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "audit_log"
  ALTER COLUMN "created_at" DROP DEFAULT,
  ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(6) USING "created_at" AT TIME ZONE 'Europe/Moscow',
  ALTER COLUMN "created_at" SET DEFAULT now();

ALTER TABLE "user"
  ALTER COLUMN "createdAt" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(6) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "banExpires" TYPE TIMESTAMPTZ(6) USING "banExpires" AT TIME ZONE 'UTC',
  ALTER COLUMN "last_login_at" TYPE TIMESTAMPTZ(6) USING "last_login_at" AT TIME ZONE 'UTC';

ALTER TABLE "session"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(6) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(6) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "account"
  ALTER COLUMN "accessTokenExpiresAt" TYPE TIMESTAMPTZ(6) USING "accessTokenExpiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "refreshTokenExpiresAt" TYPE TIMESTAMPTZ(6) USING "refreshTokenExpiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(6) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';

ALTER TABLE "verification"
  ALTER COLUMN "expiresAt" TYPE TIMESTAMPTZ(6) USING "expiresAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" DROP DEFAULT,
  ALTER COLUMN "createdAt" TYPE TIMESTAMPTZ(6) USING "createdAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "createdAt" SET DEFAULT now(),
  ALTER COLUMN "updatedAt" TYPE TIMESTAMPTZ(6) USING "updatedAt" AT TIME ZONE 'UTC';
