CREATE TABLE "employee_positions" (
    "employee_id" INTEGER NOT NULL,
    "position_id" INTEGER NOT NULL,
    "assigned_at" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_positions_pkey" PRIMARY KEY ("employee_id", "position_id"),
    CONSTRAINT "employee_positions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "employee_positions_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "idx_employee_positions_position" ON "employee_positions"("position_id");
