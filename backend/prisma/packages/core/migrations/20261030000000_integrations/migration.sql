BEGIN;
CREATE TABLE "api_key" (
  "id" TEXT PRIMARY KEY,
  "configId" TEXT NOT NULL DEFAULT 'default',
  "name" TEXT,
  "start" TEXT,
  "referenceId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  "prefix" TEXT,
  "key" TEXT NOT NULL,
  "refillInterval" INTEGER,
  "refillAmount" INTEGER,
  "lastRefillAt" TIMESTAMPTZ(6),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "rateLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
  "rateLimitTimeWindow" INTEGER NOT NULL DEFAULT 60000,
  "rateLimitMax" INTEGER NOT NULL DEFAULT 120,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "remaining" INTEGER,
  "lastRequest" TIMESTAMPTZ(6),
  "expiresAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL,
  "permissions" TEXT,
  "metadata" TEXT
);
CREATE INDEX "api_key_configId_idx" ON "api_key"("configId");
CREATE INDEX "api_key_referenceId_idx" ON "api_key"("referenceId");
CREATE INDEX "api_key_key_idx" ON "api_key"("key");

CREATE TABLE integration_sources (
 id UUID PRIMARY KEY, code VARCHAR(100) NOT NULL, name VARCHAR(200) NOT NULL,
 system_type VARCHAR(50) NOT NULL, base_url VARCHAR(2000) NOT NULL, authorization_encrypted TEXT NOT NULL,
 actor_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 is_active BOOLEAN NOT NULL DEFAULT true, created_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ(6) NOT NULL,
 CONSTRAINT uq_integration_sources_code UNIQUE(code),
 CONSTRAINT uq_integration_sources_id_actor UNIQUE(id,actor_user_id)
);
CREATE TABLE integration_flows (
 source_id UUID NOT NULL REFERENCES integration_sources(id) ON DELETE RESTRICT ON UPDATE CASCADE, flow_code VARCHAR(100) NOT NULL,
 is_active BOOLEAN NOT NULL DEFAULT true, config_version INTEGER NOT NULL CHECK(config_version>0), config JSONB NOT NULL,
 last_success_at TIMESTAMPTZ(6), last_error_at TIMESTAMPTZ(6), last_error_code VARCHAR(100),
 PRIMARY KEY(source_id,flow_code), CHECK(jsonb_typeof(config)='object')
);
CREATE TABLE integration_events (
 id BIGSERIAL PRIMARY KEY, source_id UUID NOT NULL, flow_code VARCHAR(100) NOT NULL, event_id UUID NOT NULL,
 object_id VARCHAR(255) NOT NULL, type VARCHAR(100) NOT NULL, version VARCHAR(255) NOT NULL,
 request_hash VARCHAR(64) NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
 status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','PROCESSING','PROCESSED','FAILED','SKIPPED')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), retry_attempts INTEGER NOT NULL DEFAULT 0 CHECK(retry_attempts>=0),
 manual_retry_count INTEGER NOT NULL DEFAULT 0 CHECK(manual_retry_count>=0), next_attempt_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 lease_owner VARCHAR(100), lease_token UUID, lease_until TIMESTAMPTZ(6), started_at TIMESTAMPTZ(6), processed_at TIMESTAMPTZ(6),
 result_code VARCHAR(100), result_summary JSONB,
 last_error_code VARCHAR(100), received_at TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
 CONSTRAINT integration_events_flow_fkey FOREIGN KEY(source_id,flow_code) REFERENCES integration_flows(source_id,flow_code) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT uq_integration_events_identity UNIQUE(source_id,flow_code,event_id),
 CHECK((status='PROCESSING' AND lease_owner IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR
       (status<>'PROCESSING' AND lease_owner IS NULL AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX idx_integration_events_pending ON integration_events(status,next_attempt_at,id);
CREATE INDEX idx_integration_events_lease ON integration_events(status,lease_until,id);
CREATE TABLE integration_attempts (
 lease_token UUID PRIMARY KEY, event_id BIGINT NOT NULL REFERENCES integration_events(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 started_at TIMESTAMPTZ(6) NOT NULL, finished_at TIMESTAMPTZ(6),
 outcome VARCHAR(30) NOT NULL DEFAULT 'PROCESSING' CHECK(outcome IN ('PROCESSING','PROCESSED','SKIPPED','RETRY','FAILED','LEASE_EXPIRED')),
 error_code VARCHAR(100)
);
CREATE INDEX idx_integration_attempts_event ON integration_attempts(event_id,started_at);

CREATE TABLE integration_source_actors (
 source_id UUID PRIMARY KEY,
 actor_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT uq_integration_source_actors_pair UNIQUE(source_id,actor_user_id),
 CONSTRAINT integration_source_actors_source_fkey FOREIGN KEY(source_id,actor_user_id)
  REFERENCES integration_sources(id,actor_user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE TABLE system_actor_permissions (
 source_id UUID NOT NULL, actor_user_id TEXT NOT NULL, permission VARCHAR(100) NOT NULL,
 PRIMARY KEY(source_id,actor_user_id,permission),
 CONSTRAINT system_actor_permissions_source_actor_fkey FOREIGN KEY(source_id,actor_user_id)
  REFERENCES integration_source_actors(source_id,actor_user_id) ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE FUNCTION link_integration_source_actor() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 INSERT INTO integration_source_actors(source_id,actor_user_id) VALUES(NEW.id,NEW.actor_user_id);
 RETURN NEW;
END $$;
CREATE TRIGGER link_integration_source_actor AFTER INSERT ON integration_sources
 FOR EACH ROW EXECUTE FUNCTION link_integration_source_actor();
COMMIT;
