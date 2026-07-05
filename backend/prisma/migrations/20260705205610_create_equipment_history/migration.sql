-- CreateEnum
CREATE TYPE "equipment_change_type" AS ENUM ('CREATE', 'UPDATE', 'STATUS_CHANGE', 'RESPONSIBLE_CHANGE', 'SECTION_CHANGE', 'WRITE_OFF');

COMMENT ON TYPE "equipment_change_type" IS 'Тип изменения в истории оборудования';

-- CreateTable
CREATE TABLE "equipment_history" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "equipment_id" INTEGER NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" TEXT,
    "change_type" "equipment_change_type" NOT NULL,
    "field_name" VARCHAR(64),
    "old_value" TEXT,
    "new_value" TEXT,
    "comment" TEXT,

    CONSTRAINT "equipment_history_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "equipment_history" IS 'История изменений оборудования';
COMMENT ON COLUMN "equipment_history"."id" IS 'Уникальный идентификатор записи истории';
COMMENT ON COLUMN "equipment_history"."equipment_id" IS 'Оборудование, к которому относится изменение';
COMMENT ON COLUMN "equipment_history"."changed_at" IS 'Дата и время изменения';
COMMENT ON COLUMN "equipment_history"."changed_by" IS 'Пользователь системы, выполнивший изменение';
COMMENT ON COLUMN "equipment_history"."change_type" IS 'Тип изменения';
COMMENT ON COLUMN "equipment_history"."field_name" IS 'Наименование измененного поля';
COMMENT ON COLUMN "equipment_history"."old_value" IS 'Старое значение поля';
COMMENT ON COLUMN "equipment_history"."new_value" IS 'Новое значение поля';
COMMENT ON COLUMN "equipment_history"."comment" IS 'Комментарий к изменению';

-- CreateIndex
CREATE INDEX "idx_equipment_history_equipment_id" ON "equipment_history"("equipment_id");

-- CreateIndex
CREATE INDEX "idx_equipment_history_changed_at" ON "equipment_history"("changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_equipment_history_changed_by" ON "equipment_history"("changed_by");

-- CreateIndex
CREATE INDEX "idx_equipment_history_change_type" ON "equipment_history"("change_type");

-- AddForeignKey
ALTER TABLE "equipment_history" ADD CONSTRAINT "equipment_history_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_history" ADD CONSTRAINT "equipment_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
