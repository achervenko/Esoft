export function createSetupReport() {
  const entries = [];
  let failed = null;
  let printed = false;

  return {
    addStep(label, result) {
      const status = result.ok ? 'OK' : 'FAILED';
      entries.push({ label, status });

      if (!result.ok && !failed) {
        failed = result;
      }
    },
    print() {
      if (printed) {
        return;
      }

      printed = true;

      console.log('');
      console.log('Esoft Setup');
      console.log('');

      for (const entry of entries) {
        console.log(`${entry.label.padEnd(22, '.')} ${entry.status}`);
      }

      console.log('');

      if (failed) {
        console.log(`Setup failed: ${failed.message}`);
        console.log('Run `npm run doctor` for detailed diagnostics.');
        return;
      }

      console.log('Setup completed. You can start the application.');
    },
  };
}
