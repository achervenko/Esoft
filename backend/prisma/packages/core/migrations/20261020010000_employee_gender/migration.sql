CREATE TYPE "gender" AS ENUM ('MALE', 'FEMALE');
ALTER TABLE "employees" ADD COLUMN "gender" "gender";
