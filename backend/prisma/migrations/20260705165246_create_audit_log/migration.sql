-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'STATUS_CHANGE', 'FILE_UPLOAD', 'FILE_DELETE', 'LOGIN', 'LOGOUT', 'USER_BLOCK', 'ROLE_CHANGE');

COMMENT ON TYPE "audit_action" IS 'Тип действия в журнале аудита';

-- CreateTable
CREATE TABLE "audit_log" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT,
    "action" "audit_action" NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" TEXT,
    "summary" TEXT NOT NULL,
    "changes" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "audit_log" IS 'Журнал аудита: кто, когда и что сделал в системе';
COMMENT ON COLUMN "audit_log"."id" IS 'Уникальный идентификатор записи журнала аудита';
COMMENT ON COLUMN "audit_log"."created_at" IS 'Дата и время события';
COMMENT ON COLUMN "audit_log"."user_id" IS 'Пользователь, выполнивший действие. Ссылка на таблицу Better Auth "user"';
COMMENT ON COLUMN "audit_log"."action" IS 'Тип действия';
COMMENT ON COLUMN "audit_log"."entity_type" IS 'Тип объекта, над которым выполнено действие';
COMMENT ON COLUMN "audit_log"."entity_id" IS 'Идентификатор объекта, над которым выполнено действие';
COMMENT ON COLUMN "audit_log"."summary" IS 'Краткое описание действия';
COMMENT ON COLUMN "audit_log"."changes" IS 'Измененные поля в формате JSONB: старое и новое значение';

-- CreateIndex
CREATE INDEX "idx_audit_log_created_at" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_user_id" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_action" ON "audit_log"("action");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "fk_audit_log_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
