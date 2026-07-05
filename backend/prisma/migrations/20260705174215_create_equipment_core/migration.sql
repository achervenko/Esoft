-- CreateEnum
CREATE TYPE "equipment_status" AS ENUM ('active', 'reserve', 'repair', 'maintenance', 'written_off');

COMMENT ON TYPE "equipment_status" IS 'Статусы единицы оборудования';

-- CreateTable
CREATE TABLE "manufacturers" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workshops" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "workshops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "workshop_id" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name" VARCHAR(128) NOT NULL,

    CONSTRAINT "operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "last_name" VARCHAR(64) NOT NULL,
    "first_name" VARCHAR(64) NOT NULL,
    "middle_name" VARCHAR(64),
    "position" VARCHAR(64) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_users" (
    "employee_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "employee_users_pkey" PRIMARY KEY ("employee_id","user_id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" INTEGER GENERATED ALWAYS AS IDENTITY NOT NULL,
    "inventory_number" VARCHAR(64) NOT NULL,
    "serial_number" VARCHAR(128),
    "name" VARCHAR(128) NOT NULL,
    "brand" VARCHAR(128),
    "model" VARCHAR(128),
    "specifications" TEXT,
    "manufacturer_id" INTEGER,
    "country_id" INTEGER,
    "manufacture_year" SMALLINT,
    "commissioning_date" DATE,
    "section_id" INTEGER NOT NULL,
    "responsible_employee_id" INTEGER,
    "status" "equipment_status" NOT NULL DEFAULT 'active',
    "operation_id" INTEGER,
    "notes" TEXT,

    CONSTRAINT "chk_equipment_manufacture_year" CHECK ("manufacture_year" IS NULL OR "manufacture_year" BETWEEN 1900 AND 2100),
    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

COMMENT ON TABLE "employees" IS 'Справочник работников предприятия';
COMMENT ON COLUMN "employees"."id" IS 'Уникальный идентификатор работника';
COMMENT ON COLUMN "employees"."last_name" IS 'Фамилия работника';
COMMENT ON COLUMN "employees"."first_name" IS 'Имя работника';
COMMENT ON COLUMN "employees"."middle_name" IS 'Отчество работника';
COMMENT ON COLUMN "employees"."position" IS 'Должность работника';

COMMENT ON TABLE "employee_users" IS 'Связь работников предприятия с пользователями системы';
COMMENT ON COLUMN "employee_users"."employee_id" IS 'Работник предприятия';
COMMENT ON COLUMN "employee_users"."user_id" IS 'Пользователь системы Better Auth';

COMMENT ON TABLE "manufacturers" IS 'Справочник производителей оборудования';
COMMENT ON COLUMN "manufacturers"."id" IS 'Уникальный идентификатор производителя';
COMMENT ON COLUMN "manufacturers"."name" IS 'Наименование производителя';

COMMENT ON TABLE "countries" IS 'Справочник стран изготовления оборудования';
COMMENT ON COLUMN "countries"."id" IS 'Уникальный идентификатор страны';
COMMENT ON COLUMN "countries"."name" IS 'Наименование страны';

COMMENT ON TABLE "workshops" IS 'Справочник цехов или подразделений';
COMMENT ON COLUMN "workshops"."id" IS 'Уникальный идентификатор цеха или подразделения';
COMMENT ON COLUMN "workshops"."name" IS 'Наименование цеха или подразделения';

COMMENT ON TABLE "sections" IS 'Справочник участков внутри цехов или подразделений';
COMMENT ON COLUMN "sections"."id" IS 'Уникальный идентификатор участка';
COMMENT ON COLUMN "sections"."workshop_id" IS 'Цех или подразделение, к которому относится участок';
COMMENT ON COLUMN "sections"."name" IS 'Наименование участка';

COMMENT ON TABLE "operations" IS 'Справочник операций, выполняемых оборудованием';
COMMENT ON COLUMN "operations"."id" IS 'Уникальный идентификатор операции';
COMMENT ON COLUMN "operations"."name" IS 'Наименование операции';

COMMENT ON TABLE "equipment" IS 'Реестр оборудования';
COMMENT ON COLUMN "equipment"."id" IS 'Внутренний идентификатор оборудования';
COMMENT ON COLUMN "equipment"."inventory_number" IS 'Учетный или инвентарный номер оборудования';
COMMENT ON COLUMN "equipment"."serial_number" IS 'Заводской номер оборудования';
COMMENT ON COLUMN "equipment"."name" IS 'Наименование оборудования';
COMMENT ON COLUMN "equipment"."brand" IS 'Марка оборудования';
COMMENT ON COLUMN "equipment"."model" IS 'Модель оборудования';
COMMENT ON COLUMN "equipment"."specifications" IS 'Основные характеристики оборудования';
COMMENT ON COLUMN "equipment"."manufacturer_id" IS 'Производитель оборудования';
COMMENT ON COLUMN "equipment"."country_id" IS 'Страна изготовления оборудования';
COMMENT ON COLUMN "equipment"."manufacture_year" IS 'Год изготовления оборудования';
COMMENT ON COLUMN "equipment"."commissioning_date" IS 'Дата ввода оборудования в эксплуатацию';
COMMENT ON COLUMN "equipment"."section_id" IS 'Участок, на котором находится оборудование';
COMMENT ON COLUMN "equipment"."responsible_employee_id" IS 'Ответственный работник за оборудование';
COMMENT ON COLUMN "equipment"."status" IS 'Текущий статус оборудования';
COMMENT ON COLUMN "equipment"."operation_id" IS 'Операция, выполняемая оборудованием';
COMMENT ON COLUMN "equipment"."notes" IS 'Примечание';

-- CreateIndex
CREATE UNIQUE INDEX "manufacturers_name_key" ON "manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "countries_name_key" ON "countries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "workshops_name_key" ON "workshops"("name");

-- CreateIndex
CREATE INDEX "idx_sections_workshop_id" ON "sections"("workshop_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_sections_workshop_name" ON "sections"("workshop_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "operations_name_key" ON "operations"("name");

-- CreateIndex
CREATE INDEX "idx_employees_full_name" ON "employees"("last_name", "first_name", "middle_name");

-- CreateIndex
CREATE UNIQUE INDEX "uq_employee_users_employee" ON "employee_users"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_employee_users_user" ON "employee_users"("user_id");

-- CreateIndex
CREATE INDEX "idx_employee_users_employee_id" ON "employee_users"("employee_id");

-- CreateIndex
CREATE INDEX "idx_employee_users_user_id" ON "employee_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_inventory_number_key" ON "equipment"("inventory_number");

-- CreateIndex
CREATE INDEX "idx_equipment_inventory_number" ON "equipment"("inventory_number");

-- CreateIndex
CREATE INDEX "idx_equipment_serial_number" ON "equipment"("serial_number");

-- CreateIndex
CREATE INDEX "idx_equipment_status" ON "equipment"("status");

-- CreateIndex
CREATE INDEX "idx_equipment_section_id" ON "equipment"("section_id");

-- CreateIndex
CREATE INDEX "idx_equipment_responsible_employee_id" ON "equipment"("responsible_employee_id");

-- CreateIndex
CREATE INDEX "idx_equipment_operation_id" ON "equipment"("operation_id");

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_workshop_id_fkey" FOREIGN KEY ("workshop_id") REFERENCES "workshops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_users" ADD CONSTRAINT "employee_users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_users" ADD CONSTRAINT "employee_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_manufacturer_id_fkey" FOREIGN KEY ("manufacturer_id") REFERENCES "manufacturers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "operations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
