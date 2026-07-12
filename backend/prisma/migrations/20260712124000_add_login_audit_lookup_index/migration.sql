CREATE INDEX IF NOT EXISTS "idx_audit_log_module_action_user_created_at"
ON "audit_log" ("module", "action", "user_id", "created_at" DESC);
