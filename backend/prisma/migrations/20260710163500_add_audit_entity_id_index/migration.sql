CREATE INDEX idx_audit_log_entity_id
ON audit_log USING btree (entity_id);
