-- Drop redundant indexes already covered by primary key or unique constraints.
DROP INDEX IF EXISTS "idx_employee_users_employee_id";
DROP INDEX IF EXISTS "idx_employee_users_user_id";
DROP INDEX IF EXISTS "idx_equipment_inventory_number";
