UPDATE "user"
SET "role" = 'auditor'
WHERE "username" = 'auditor'
   OR "email" = 'auditor@esoft.local';
