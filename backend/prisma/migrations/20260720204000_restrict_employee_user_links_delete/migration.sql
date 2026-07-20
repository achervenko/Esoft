ALTER TABLE "employee_users"
  DROP CONSTRAINT IF EXISTS "employee_users_employee_id_fkey";

ALTER TABLE "employee_users"
  DROP CONSTRAINT IF EXISTS "employee_users_user_id_fkey";

ALTER TABLE "employee_users"
  ADD CONSTRAINT "employee_users_employee_id_fkey"
  FOREIGN KEY ("employee_id")
  REFERENCES "employees"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "employee_users"
  ADD CONSTRAINT "employee_users_user_id_fkey"
  FOREIGN KEY ("user_id")
  REFERENCES "user"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;
