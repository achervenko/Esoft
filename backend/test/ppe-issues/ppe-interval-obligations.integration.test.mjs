import { after } from 'node:test';
import { createPpeIssueTestEnvironment } from './ppe-issues.integration.setup.mjs';
import { registerTests as periodTests } from './ppe-issues-periods.integration.test.mjs';
import { registerTests as futureNormTests } from './ppe-issues-future-norms.integration.test.mjs';
import { registerTests as obligationTests } from './ppe-issues-obligations.integration.test.mjs';
import { registerTests as cancellationTests } from './ppe-issues-cancellation.integration.test.mjs';
import { registerTests as transactionTests } from './ppe-issues-transactions-concurrency.integration.test.mjs';

const env = await createPpeIssueTestEnvironment();
after(() => env.cleanup());

try {
  periodTests(env);
  futureNormTests(env);
  obligationTests(env);
  cancellationTests(env);
  transactionTests(env);
} catch (error) {
  await env.cleanup();
  throw error;
}
