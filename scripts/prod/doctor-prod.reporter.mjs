import { redactSensitiveText } from '../infrastructure/security/redaction.mjs';

export function createProductionDoctorReporter({ output = console } = {}) {
  return {
    check(index, total, check) {
      output.log(`[${index}/${total}] ${check.label}`);
      output.log(toStatus(check.result));

      if (!check.result.ok) {
        output.log(redactSensitiveText(check.result.message));
      }
    },
    summary(result) {
      const checks = result.details.checks;
      const skipped = checks.filter(
        (check) => check.result.code === 'PROD_DOCTOR_CHECK_SKIPPED',
      ).length;
      const passed = checks.filter(
        (check) =>
          check.result.ok && check.result.code !== 'PROD_DOCTOR_CHECK_SKIPPED',
      ).length;
      const failed = checks.length - passed;

      output.log(
        result.ok
          ? 'Production environment is ready.'
          : 'Production environment is not ready.',
      );
      output.log(
        skipped === 0
          ? `${passed} checks passed, ${failed} failed.`
          : `${passed} checks passed, ${failed - skipped} failed, ${skipped} skipped.`,
      );
    },
  };
}

function toStatus(result) {
  if (result.code === 'PROD_DOCTOR_CHECK_SKIPPED') {
    return 'SKIPPED';
  }

  return result.ok ? 'OK' : 'FAILED';
}
