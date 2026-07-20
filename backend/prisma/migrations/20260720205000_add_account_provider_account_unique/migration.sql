ALTER TABLE "account"
ADD CONSTRAINT "uq_account_provider_account"
UNIQUE ("providerId", "accountId");
