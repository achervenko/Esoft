-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'ARCHIVE', 'DELETE', 'STATUS_CHANGE', 'FILE_UPLOAD', 'FILE_DELETE', 'LOGIN', 'LOGOUT', 'USER_BLOCK', 'USER_PHOTO_DELETE', 'USER_PHOTO_UPLOAD', 'ROLE_CHANGE', 'SETUP_ADMIN_CREATED');

-- CreateEnum
CREATE TYPE "audit_module" AS ENUM ('calendar', 'equipment', 'events', 'users', 'ppe');

-- CreateEnum
CREATE TYPE "calendar_source" AS ENUM ('SYSTEM', 'IMPORT', 'MANUAL');

-- CreateEnum
CREATE TYPE "checklist_answer_type" AS ENUM ('BOOLEAN', 'INTEGER', 'DECIMAL', 'TEXT', 'DATE');

-- CreateEnum
CREATE TYPE "checklist_status" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'INVALIDATED');

-- CreateEnum
CREATE TYPE "checklist_result" AS ENUM ('PASSED', 'FAILED', 'WITH_REMARKS');

-- CreateEnum
CREATE TYPE "event_extension_code" AS ENUM ('EQUIPMENT');

-- CreateEnum
CREATE TYPE "event_source" AS ENUM ('MANUAL', 'PLANNED');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('CREATED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum

-- CreateEnum
CREATE TYPE "storage_document_type" AS ENUM ('passport', 'maintenance_instruction', 'equipment_photo', 'supporting_document');

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "time_zone" VARCHAR(32) NOT NULL DEFAULT 'Europe/Moscow (UTC+03:00)',
    "user_id" TEXT,
    "module" "audit_module" NOT NULL DEFAULT 'equipment',
    "action" "audit_action" NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" INTEGER,
    "entity_string_id" VARCHAR(128),
    "field_name" VARCHAR(128),
    "old_value" TEXT,
    "new_value" TEXT,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "username" TEXT,
    "displayUsername" TEXT,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "impersonatedBy" TEXT,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(6),
    "refreshTokenExpiresAt" TIMESTAMPTZ(6),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_modules" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "checklist_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_questions" (
    "id" SERIAL NOT NULL,
    "checklist_module_id" INTEGER,
    "question_text" TEXT NOT NULL,
    "answer_type" "checklist_answer_type" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,

    CONSTRAINT "checklist_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_templates" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "based_on_template_id" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT,
    "published_at" TIMESTAMPTZ(6),
    "published_by" TEXT,
    "archived_at" TIMESTAMPTZ(6),
    "archived_by" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_modules" (
    "id" SERIAL NOT NULL,
    "checklist_template_id" INTEGER NOT NULL,
    "checklist_module_id" INTEGER NOT NULL,
    "module_name_snapshot" VARCHAR(128) NOT NULL,
    "sort_order" INTEGER NOT NULL,

    CONSTRAINT "checklist_template_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_template_questions" (
    "id" SERIAL NOT NULL,
    "checklist_template_module_id" INTEGER NOT NULL,
    "checklist_question_id" INTEGER NOT NULL,
    "question_text_snapshot" TEXT NOT NULL,
    "answer_type_snapshot" "checklist_answer_type" NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "checklist_template_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklists" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "checklist_template_id" INTEGER NOT NULL,
    "assigned_user_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "status" "checklist_status" NOT NULL DEFAULT 'CREATED',
    "result" "checklist_result",
    "checklist_date" DATE,
    "started_at" TIMESTAMPTZ(6),
    "started_by" TEXT,
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" TEXT,
    "comment" TEXT,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancelled_by" TEXT,
    "cancellation_reason" TEXT,
    "invalidated_at" TIMESTAMPTZ(6),
    "invalidated_by" TEXT,
    "invalidation_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_details" (
    "id" SERIAL NOT NULL,
    "checklist_id" INTEGER NOT NULL,
    "checklist_template_question_id" INTEGER,
    "checklist_question_id" INTEGER,
    "module_name" TEXT NOT NULL,
    "module_sort_order" INTEGER NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_type" "checklist_answer_type" NOT NULL,
    "question_sort_order" INTEGER NOT NULL,
    "is_required" BOOLEAN NOT NULL,
    "answer_boolean" BOOLEAN,
    "answer_integer" INTEGER,
    "answer_decimal" DECIMAL(18,6),
    "answer_text" TEXT,
    "answer_date" DATE,
    "answered_at" TIMESTAMPTZ(6),
    "answered_by" TEXT,

    CONSTRAINT "checklist_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "iso" CHAR(2) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshops" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" SERIAL NOT NULL,
    "workshop_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_positions_name" CHECK ("name" = btrim("name") AND "name" <> '')
);

-- CreateTable
CREATE TABLE "employees" (
    "id" SERIAL NOT NULL,
    "last_name" VARCHAR(64) NOT NULL,
    "first_name" VARCHAR(64) NOT NULL,
    "middle_name" VARCHAR(64),
    "position_id" INTEGER NOT NULL,
    "position_assigned_at" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_users" (
    "user_id" TEXT NOT NULL,
    "employee_id" INTEGER NOT NULL,

    CONSTRAINT "employee_users_pkey" PRIMARY KEY ("employee_id","user_id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "extension_code" "event_extension_code",
    "source" "event_source" NOT NULL,
    "status" "event_status" NOT NULL DEFAULT 'CREATED',
    "original_planned_date" DATE,
    "planned_date" DATE NOT NULL,
    "fact_date" DATE,
    "created_by_employee_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_responsibles" (
    "event_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "pk_event_responsibles" PRIMARY KEY ("event_id","user_id")
);

-- CreateTable
CREATE TABLE "search_index" (
    "id" BIGSERIAL NOT NULL,
    "entity_type" VARCHAR(64) NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "subtitle" TEXT,
    "search_text" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_index_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_files" (
    "id" SERIAL NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "document_type" "storage_document_type" NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "is_immutable" BOOLEAN NOT NULL DEFAULT false,
    "owner_module" VARCHAR(64) NOT NULL,
    "owner_entity_type" VARCHAR(64) NOT NULL,
    "owner_entity_id" VARCHAR(128) NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "chk_storage_files_owner_module" CHECK ("owner_module" ~ '^[a-z0-9_-]{1,64}$'),
    CONSTRAINT "chk_storage_files_owner_entity_type" CHECK ("owner_entity_type" ~ '^[a-z0-9_-]{1,64}$'),
    CONSTRAINT "chk_storage_files_owner_entity_id" CHECK (length("owner_entity_id") BETWEEN 1 AND 128),
    CONSTRAINT "storage_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_photos" (
    "user_id" TEXT NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "large_object_key" VARCHAR(512) NOT NULL,
    "medium_object_key" VARCHAR(512) NOT NULL,
    "small_object_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "uploaded_by_user_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_photos_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "calendar_days" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "year" SMALLINT NOT NULL,
    "quarter" SMALLINT NOT NULL,
    "month" SMALLINT NOT NULL,
    "week" SMALLINT NOT NULL,
    "iso_week_year" SMALLINT NOT NULL,
    "day" SMALLINT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,
    "day_of_year" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_days_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_calendar_days_date_range" CHECK ("date" BETWEEN make_date(2000, 1, 1) AND make_date(2100, 12, 31)),
    CONSTRAINT "chk_calendar_days_year_range" CHECK ("year" BETWEEN 2000 AND 2100),
    CONSTRAINT "chk_calendar_days_year_matches_date" CHECK ("year" = EXTRACT(YEAR FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_quarter_range" CHECK ("quarter" BETWEEN 1 AND 4),
    CONSTRAINT "chk_calendar_days_quarter_matches_date" CHECK ("quarter" = EXTRACT(QUARTER FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_month_range" CHECK ("month" BETWEEN 1 AND 12),
    CONSTRAINT "chk_calendar_days_month_matches_date" CHECK ("month" = EXTRACT(MONTH FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_week_range" CHECK ("week" BETWEEN 1 AND 53),
    CONSTRAINT "chk_calendar_days_week_matches_date" CHECK ("week" = EXTRACT(WEEK FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_iso_week_year_range" CHECK ("iso_week_year" BETWEEN 1999 AND 2100),
    CONSTRAINT "chk_calendar_days_iso_week_year_matches_date" CHECK ("iso_week_year" = EXTRACT(ISOYEAR FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_day_range" CHECK ("day" BETWEEN 1 AND 31),
    CONSTRAINT "chk_calendar_days_day_matches_date" CHECK ("day" = EXTRACT(DAY FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_day_of_week_range" CHECK ("day_of_week" BETWEEN 1 AND 7),
    CONSTRAINT "chk_calendar_days_day_of_week_iso" CHECK ("day_of_week" = EXTRACT(ISODOW FROM "date")::SMALLINT),
    CONSTRAINT "chk_calendar_days_day_of_year_range" CHECK ("day_of_year" BETWEEN 1 AND 366),
    CONSTRAINT "chk_calendar_days_day_of_year_matches_date" CHECK ("day_of_year" = EXTRACT(DOY FROM "date")::SMALLINT)
);

-- CreateTable
CREATE TABLE "calendar_workdays" (
    "calendar_day_id" INTEGER NOT NULL,
    "is_working_day" BOOLEAN NOT NULL DEFAULT true,
    "is_holiday" BOOLEAN NOT NULL DEFAULT false,
    "is_preholiday" BOOLEAN NOT NULL DEFAULT false,
    "holiday_name" VARCHAR(160),
    "working_hours" DECIMAL(4,2) NOT NULL DEFAULT 8.00,
    "source" "calendar_source" NOT NULL DEFAULT 'SYSTEM',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_workdays_pkey" PRIMARY KEY ("calendar_day_id"),
    CONSTRAINT "chk_calendar_workdays_working_hours_range" CHECK ("working_hours" >= 0 AND "working_hours" <= 24),
    CONSTRAINT "chk_calendar_workdays_working_day_hours" CHECK ("is_working_day" = false OR "working_hours" > 0),
    CONSTRAINT "chk_calendar_workdays_non_working_day_hours" CHECK ("is_working_day" = true OR "working_hours" = 0),
    CONSTRAINT "chk_calendar_workdays_holiday_name_not_blank" CHECK ("holiday_name" IS NULL OR length(btrim("holiday_name")) > 0)
);

-- CreateIndex
CREATE INDEX "idx_audit_log_created_at" ON "audit_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_user_id" ON "audit_log"("user_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_module" ON "audit_log"("module");

-- CreateIndex
CREATE INDEX "idx_audit_log_entity" ON "audit_log"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_entity_string" ON "audit_log"("entity_type", "entity_string_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_entity_id" ON "audit_log"("entity_id");

-- CreateIndex
CREATE INDEX "idx_audit_log_field_name" ON "audit_log"("field_name");

-- CreateIndex
CREATE INDEX "idx_audit_log_action" ON "audit_log"("action");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_username_key" ON "user"("username");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "uq_account_provider_account" ON "account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklist_modules_name" ON "checklist_modules"("name");

-- CreateIndex
CREATE INDEX "idx_checklist_modules_is_active" ON "checklist_modules"("is_active");

-- CreateIndex
CREATE INDEX "idx_checklist_modules_sort_order" ON "checklist_modules"("sort_order");

-- CreateIndex
CREATE INDEX "idx_checklist_questions_module_id" ON "checklist_questions"("checklist_module_id");

-- CreateIndex
CREATE INDEX "idx_checklist_questions_module_sort_order" ON "checklist_questions"("checklist_module_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_checklist_questions_answer_type" ON "checklist_questions"("answer_type");

-- CreateIndex
CREATE INDEX "idx_checklist_questions_is_active" ON "checklist_questions"("is_active");

-- CreateIndex
CREATE INDEX "idx_checklist_templates_is_active" ON "checklist_templates"("is_active");

-- CreateIndex
CREATE INDEX "idx_checklist_templates_is_published" ON "checklist_templates"("is_published");

-- CreateIndex
CREATE INDEX "idx_checklist_templates_based_on_id" ON "checklist_templates"("based_on_template_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklist_template_modules_module" ON "checklist_template_modules"("checklist_template_id", "checklist_module_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklist_template_modules_sort" ON "checklist_template_modules"("checklist_template_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklist_template_questions_question" ON "checklist_template_questions"("checklist_template_module_id", "checklist_question_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklist_template_questions_sort" ON "checklist_template_questions"("checklist_template_module_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_checklists_template_id" ON "checklists"("checklist_template_id");

-- CreateIndex
CREATE INDEX "idx_checklists_status" ON "checklists"("status");

-- CreateIndex
CREATE INDEX "idx_checklists_assigned_user_status" ON "checklists"("assigned_user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklists_event_assigned_user" ON "checklists"("event_id", "assigned_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklists_event_sort" ON "checklists"("event_id", "sort_order");

-- CreateIndex
CREATE INDEX "idx_checklist_details_checklist_id" ON "checklist_details"("checklist_id");

-- CreateIndex
CREATE INDEX "idx_checklist_details_template_question_id" ON "checklist_details"("checklist_template_question_id");

-- CreateIndex
CREATE INDEX "idx_checklist_details_question_id" ON "checklist_details"("checklist_question_id");

-- CreateIndex
CREATE INDEX "idx_checklist_details_answered_by" ON "checklist_details"("answered_by");

-- CreateIndex
CREATE UNIQUE INDEX "uq_checklist_details_order" ON "checklist_details"("checklist_id", "module_sort_order", "question_sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_key" ON "countries"("iso");

-- CreateIndex
CREATE UNIQUE INDEX "workshops_name_key" ON "workshops"("name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sections_workshop_name" ON "sections"("workshop_id", "name");

-- CreateIndex
CREATE INDEX "idx_employees_full_name" ON "employees"("last_name", "first_name", "middle_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_positions_name_normalized" ON "positions" (lower("name"));

-- CreateIndex
CREATE INDEX "idx_employees_position_id" ON "employees"("position_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_employee_users_user" ON "employee_users"("user_id");

-- CreateIndex
CREATE INDEX "idx_employee_users_employee_id" ON "employee_users"("employee_id");

-- CreateIndex
CREATE INDEX "idx_events_planned_date" ON "events"("planned_date");

-- CreateIndex
CREATE INDEX "idx_events_status_planned_date" ON "events"("status", "planned_date");

-- CreateIndex
CREATE INDEX "idx_events_extension_code" ON "events"("extension_code");

-- CreateIndex
CREATE INDEX "idx_events_created_by_employee_id" ON "events"("created_by_employee_id");

-- CreateIndex
CREATE INDEX "idx_event_responsibles_user_event" ON "event_responsibles"("user_id", "event_id");

-- CreateIndex
CREATE INDEX "idx_search_index_entity_type" ON "search_index"("entity_type");

-- CreateIndex
CREATE UNIQUE INDEX "uq_search_index_entity" ON "search_index"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "idx_storage_files_bucket" ON "storage_files"("bucket");

-- CreateIndex
CREATE INDEX "idx_storage_files_created_at" ON "storage_files"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_storage_files_uploaded_by_user_id" ON "storage_files"("uploaded_by_user_id");

-- CreateIndex
CREATE INDEX "idx_storage_files_deleted_at" ON "storage_files"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_storage_files_primary" ON "storage_files"("owner_module", "owner_entity_type", "owner_entity_id", "document_type", "is_primary");

-- CreateIndex
CREATE INDEX "idx_storage_files_owner" ON "storage_files"("owner_module", "owner_entity_type", "owner_entity_id", "deleted_at");

-- CreateIndex
CREATE INDEX "idx_storage_files_owner_entity_id" ON "storage_files"("owner_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_storage_files_bucket_object_key" ON "storage_files"("bucket", "object_key");

-- CreateIndex
CREATE INDEX "idx_user_photos_uploaded_by_user_id" ON "user_photos"("uploaded_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_calendar_days_date" ON "calendar_days"("date");

-- CreateIndex
CREATE INDEX "idx_calendar_days_year" ON "calendar_days"("year");

-- CreateIndex
CREATE INDEX "idx_calendar_days_year_month" ON "calendar_days"("year", "month");

-- CreateIndex
CREATE INDEX "idx_calendar_days_iso_week" ON "calendar_days"("iso_week_year", "week");

-- CreateIndex
CREATE INDEX "idx_calendar_workdays_is_working_day" ON "calendar_workdays"("is_working_day");

-- CreateIndex
CREATE INDEX "idx_calendar_workdays_is_holiday" ON "calendar_workdays"("is_holiday");

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "fk_audit_log_user" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_modules" ADD CONSTRAINT "checklist_modules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_modules" ADD CONSTRAINT "checklist_modules_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_questions" ADD CONSTRAINT "checklist_questions_checklist_module_id_fkey" FOREIGN KEY ("checklist_module_id") REFERENCES "checklist_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_archived_by_fkey" FOREIGN KEY ("archived_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_based_on_template_id_fkey" FOREIGN KEY ("based_on_template_id") REFERENCES "checklist_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_modules" ADD CONSTRAINT "checklist_template_modules_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_modules" ADD CONSTRAINT "checklist_template_modules_checklist_module_id_fkey" FOREIGN KEY ("checklist_module_id") REFERENCES "checklist_modules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_questions" ADD CONSTRAINT "checklist_template_questions_checklist_template_module_id_fkey" FOREIGN KEY ("checklist_template_module_id") REFERENCES "checklist_template_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_template_questions" ADD CONSTRAINT "checklist_template_questions_checklist_question_id_fkey" FOREIGN KEY ("checklist_question_id") REFERENCES "checklist_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_checklist_template_id_fkey" FOREIGN KEY ("checklist_template_id") REFERENCES "checklist_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_started_by_fkey" FOREIGN KEY ("started_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklists" ADD CONSTRAINT "checklists_invalidated_by_fkey" FOREIGN KEY ("invalidated_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_details" ADD CONSTRAINT "checklist_details_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_details" ADD CONSTRAINT "checklist_details_checklist_template_question_id_fkey" FOREIGN KEY ("checklist_template_question_id") REFERENCES "checklist_template_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_details" ADD CONSTRAINT "checklist_details_checklist_question_id_fkey" FOREIGN KEY ("checklist_question_id") REFERENCES "checklist_questions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_details" ADD CONSTRAINT "checklist_details_answered_by_fkey" FOREIGN KEY ("answered_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_users" ADD CONSTRAINT "employee_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "fk_employees_position" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_users" ADD CONSTRAINT "employee_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_employee_id_fkey" FOREIGN KEY ("created_by_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_responsibles" ADD CONSTRAINT "event_responsibles_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_responsibles" ADD CONSTRAINT "event_responsibles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_files" ADD CONSTRAINT "storage_files_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_photos" ADD CONSTRAINT "user_photos_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_workdays" ADD CONSTRAINT "calendar_workdays_calendar_day_id_fkey" FOREIGN KEY ("calendar_day_id") REFERENCES "calendar_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Manual PostgreSQL objects

-- ==================================================
-- Manual PostgreSQL objects
-- Generated from historical Prisma migrations
-- ==================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION app_next_identity_id(
    p_table  REGCLASS,
    p_column TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_sequence_name TEXT;
    v_max_id BIGINT;
    v_last_value BIGINT;
    v_is_called BOOLEAN;
BEGIN
    v_sequence_name := pg_get_serial_sequence(p_table::TEXT, p_column);
    IF v_sequence_name IS NULL THEN
        RAISE EXCEPTION 'No serial/identity sequence found for %.%', p_table, p_column;
    END IF;
    EXECUTE format('SELECT COALESCE(MAX(%I), 0) FROM %s', p_column, p_table)
      INTO v_max_id;
    EXECUTE format('SELECT last_value, is_called FROM %s', v_sequence_name::REGCLASS)
      INTO v_last_value, v_is_called;
    RETURN GREATEST(v_max_id + 1, v_last_value + CASE WHEN v_is_called THEN 1 ELSE 0 END);
END;
$$;

COMMENT ON FUNCTION app_next_identity_id(REGCLASS, TEXT)
IS 'Reads a suggested next identity value without changing or reserving the sequence';

CREATE OR REPLACE FUNCTION app_sync_identity_after_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_table REGCLASS;
    v_column TEXT;
BEGIN
    v_column := COALESCE(TG_ARGV[0], 'id');
    v_table := format('%I.%I', TG_TABLE_SCHEMA, TG_TABLE_NAME)::REGCLASS;

    PERFORM app_sync_identity_sequence(v_table, v_column);

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION app_sync_identity_after_insert()
IS 'Statement-level trigger helper that keeps identity sequence aligned after manual ID inserts';

CREATE OR REPLACE FUNCTION app_sync_identity_sequence(
    p_table  REGCLASS,
    p_column TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
    v_sequence_name TEXT;
    v_max_id        BIGINT;
    v_last_value    BIGINT;
    v_is_called     BOOLEAN;
BEGIN
    -- Shared with the BEFORE statement trigger; held until commit/rollback.
    PERFORM pg_advisory_xact_lock(p_table::OID::INTEGER, hashtext(p_column));
    v_sequence_name := pg_get_serial_sequence(p_table::TEXT, p_column);

    IF v_sequence_name IS NULL THEN
        RAISE EXCEPTION 'No serial/identity sequence found for %.%', p_table, p_column;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_sequence
        WHERE seqrelid = v_sequence_name::REGCLASS AND seqincrement = 1 AND seqcache = 1
    ) THEN
        RAISE EXCEPTION 'Identity synchronization requires INCREMENT 1 and CACHE 1 for %', v_sequence_name;
    END IF;

    EXECUTE format(
        'SELECT COALESCE(MAX(%1$I), 0) FROM %2$s',
        p_column,
        p_table
    )
    INTO v_max_id;
    EXECUTE format('SELECT last_value, is_called FROM %s', v_sequence_name::REGCLASS)
      INTO v_last_value, v_is_called;
    -- Advance using atomic nextval only. Never reset an allocated value, even
    -- if another transaction reserved it without inserting a committed row.
    WHILE v_last_value < v_max_id OR (v_last_value = v_max_id AND NOT v_is_called) LOOP
        v_last_value := nextval(v_sequence_name::REGCLASS);
        v_is_called := true;
    END LOOP;
    RETURN v_last_value + CASE WHEN v_is_called THEN 1 ELSE 0 END;
END;
$$;

COMMENT ON FUNCTION app_sync_identity_sequence(REGCLASS, TEXT)
IS 'Advances a unit-increment sequence using nextval only; never rewinds allocated values';

CREATE OR REPLACE FUNCTION app_lock_identity_writes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    PERFORM pg_advisory_xact_lock(TG_RELID::INTEGER, hashtext(TG_ARGV[0]));
    RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION prevent_physical_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION
        'Физическое удаление записей из таблицы "%" запрещено. Используйте поле is_active.',
        TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION validate_checklist_template_question_module()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    template_module_id INTEGER;
    question_module_id INTEGER;
BEGIN
    SELECT checklist_module_id
    INTO template_module_id
    FROM checklist_template_modules
    WHERE id = NEW.checklist_template_module_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist template module % not found',
            NEW.checklist_template_module_id;
    END IF;

    SELECT checklist_module_id
    INTO question_module_id
    FROM checklist_questions
    WHERE id = NEW.checklist_question_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist question % not found',
            NEW.checklist_question_id;
    END IF;

    IF template_module_id IS DISTINCT FROM question_module_id THEN
        RAISE EXCEPTION
            'Checklist question % belongs to module %, not template module %',
            NEW.checklist_question_id,
            question_module_id,
            template_module_id;
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION set_checklist_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_key_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_published IS TRUE AND NEW.is_published IS NOT TRUE THEN
        RAISE EXCEPTION
            'Published checklist template % cannot be reverted to draft',
            OLD.id;
    END IF;

    IF OLD.is_published IS TRUE
       AND NEW.based_on_template_id IS DISTINCT FROM OLD.based_on_template_id THEN
        RAISE EXCEPTION
            'Published checklist template % key fields cannot be changed',
            OLD.id;
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_structure_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_TABLE_NAME = 'checklist_template_modules' THEN
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            PERFORM raise_if_checklist_template_is_published(
                OLD.checklist_template_id
            );
        END IF;

        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            PERFORM raise_if_checklist_template_is_published(
                NEW.checklist_template_id
            );
        END IF;
    ELSE
        IF TG_OP IN ('UPDATE', 'DELETE') THEN
            PERFORM raise_if_checklist_template_is_published(
                get_checklist_template_id_by_module(
                    OLD.checklist_template_module_id
                )
            );
        END IF;

        IF TG_OP IN ('INSERT', 'UPDATE') THEN
            PERFORM raise_if_checklist_template_is_published(
                get_checklist_template_id_by_module(
                    NEW.checklist_template_module_id
                )
            );
        END IF;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END
$$;

CREATE OR REPLACE FUNCTION raise_if_checklist_template_is_published(
    checklist_template_id INTEGER
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    published_template_id INTEGER;
BEGIN
    SELECT id
    INTO published_template_id
    FROM checklist_templates
    WHERE id = checklist_template_id
      AND is_published = true;

    IF FOUND THEN
        RAISE EXCEPTION
            'Published checklist template % structure cannot be changed',
            published_template_id;
    END IF;
END
$$;

CREATE OR REPLACE FUNCTION get_checklist_template_id_by_module(
    checklist_template_module_id INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    target_template_id INTEGER;
BEGIN
    SELECT checklist_template_id
    INTO target_template_id
    FROM checklist_template_modules
    WHERE id = checklist_template_module_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Checklist template module % not found',
            checklist_template_module_id;
    END IF;

    RETURN target_template_id;
END
$$;

CREATE OR REPLACE FUNCTION prevent_published_checklist_template_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.is_published IS TRUE THEN
        RAISE EXCEPTION
            'Published checklist template % cannot be deleted; archive it instead',
            OLD.id;
    END IF;

    RETURN OLD;
END
$$;

CREATE VIEW admin_audit_log_full AS
SELECT
    al.id,
    al.created_at,
    al.user_id,
    u.username,
    u.name AS user_name,
    emp.id AS employee_id,
    concat_ws(
        ' ',
        emp.last_name,
        emp.first_name,
        emp.middle_name
    ) AS employee_full_name,
    al.action,
    al.module,
    al.entity_type,
    al.entity_id,
    al.entity_string_id,
    al.field_name,
    al.old_value,
    al.new_value,
    al.time_zone
FROM audit_log al
LEFT JOIN "user" u
    ON u.id = al.user_id
LEFT JOIN employee_users eu
    ON eu.user_id = u.id
LEFT JOIN employees emp
    ON emp.id = eu.employee_id;

CREATE TRIGGER trg_checklist_modules_set_updated_at
BEFORE UPDATE ON checklist_modules
FOR EACH ROW
EXECUTE FUNCTION set_checklist_updated_at();

CREATE TRIGGER trg_checklist_questions_set_updated_at
BEFORE UPDATE ON checklist_questions
FOR EACH ROW
EXECUTE FUNCTION set_checklist_updated_at();

CREATE TRIGGER trg_checklist_templates_set_updated_at
BEFORE UPDATE ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION set_checklist_updated_at();

CREATE TRIGGER trg_validate_checklist_template_question_module
BEFORE INSERT OR UPDATE OF checklist_template_module_id, checklist_question_id
ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION validate_checklist_template_question_module();

CREATE TRIGGER trg_prevent_published_checklist_template_key_update
BEFORE UPDATE OF
    is_published,
    based_on_template_id
ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_key_update();

CREATE TRIGGER trg_prevent_published_template_module_insert
BEFORE INSERT ON checklist_template_modules
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_module_update
BEFORE UPDATE ON checklist_template_modules
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_module_delete
BEFORE DELETE ON checklist_template_modules
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_question_insert
BEFORE INSERT ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_question_update
BEFORE UPDATE ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_template_question_delete
BEFORE DELETE ON checklist_template_questions
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_structure_change();

CREATE TRIGGER trg_prevent_published_checklist_template_delete
BEFORE DELETE ON checklist_templates
FOR EACH ROW
EXECUTE FUNCTION prevent_published_checklist_template_delete();
ALTER TABLE "countries" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "workshops" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "sections" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

CREATE TRIGGER trg_prevent_countries_delete BEFORE DELETE ON "countries" FOR EACH ROW EXECUTE FUNCTION prevent_physical_delete();
CREATE TRIGGER trg_prevent_workshops_delete BEFORE DELETE ON "workshops" FOR EACH ROW EXECUTE FUNCTION prevent_physical_delete();
CREATE TRIGGER trg_prevent_sections_delete BEFORE DELETE ON "sections" FOR EACH ROW EXECUTE FUNCTION prevent_physical_delete();

-- Shared ordering for equipment and PPE registries.
CREATE COLLATION app_registry_order (provider = icu, locale = 'ru-u-kn-true-ks-level1', deterministic = false);

CREATE FUNCTION app_search_normalize(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
AS $$ SELECT regexp_replace(replace(lower(value), chr(1105), chr(1077)), '[[:space:]]+', ' ', 'g') $$;
CREATE INDEX idx_search_employee_name_trgm ON employees USING gin (app_search_normalize(last_name || ' ' || first_name || CASE WHEN middle_name IS NULL THEN '' ELSE ' ' || middle_name END) gin_trgm_ops) WHERE is_active = true;
CREATE INDEX idx_search_position_name_trgm ON positions USING gin (app_search_normalize(name) gin_trgm_ops) WHERE is_active = true;

CREATE TABLE "setup_rate_limits" (
    "key" VARCHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL,
    "reset_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "setup_rate_limits_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "chk_setup_rate_limits_attempts" CHECK ("attempts" BETWEEN 1 AND 6)
);

CREATE INDEX "idx_setup_rate_limits_reset_at" ON "setup_rate_limits" ("reset_at");


-- Staged uploads survive process failure and are cleaned up after expiry.
CREATE TABLE "storage_uploads" (
    "id" UUID NOT NULL,
    "bucket" VARCHAR(63) NOT NULL,
    "object_key" VARCHAR(512) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(128) NOT NULL,
    "size_bytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "document_type" "storage_document_type" NOT NULL,
    "owner_module" VARCHAR(64) NOT NULL,
    "owner_entity_type" VARCHAR(64) NOT NULL,
    "uploaded_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    "expires_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + interval '24 hours'),
    "uploaded_at" TIMESTAMPTZ(6),
    CONSTRAINT "chk_storage_uploads_owner_module" CHECK ("owner_module" ~ '^[a-z0-9_-]{1,64}$'),
    CONSTRAINT "chk_storage_uploads_owner_entity_type" CHECK ("owner_entity_type" ~ '^[a-z0-9_-]{1,64}$'),
    CONSTRAINT "storage_uploads_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_storage_uploads_user" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_storage_uploads_object_key" ON "storage_uploads"("object_key");
CREATE INDEX "idx_storage_uploads_expires_at" ON "storage_uploads"("expires_at");
