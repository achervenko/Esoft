export function createReport() {
  const sections = [];
  const sectionMap = new Map();
  const counts = {
    error: 0,
    ok: 0,
    skip: 0,
    started: 0,
    stopped: 0,
    warn: 0,
  };

  return {
    get errorCount() {
      return counts.error;
    },
    add(section, status, message) {
      this.addSection(section);
      sectionMap.get(section).push({ message, status });

      const key = status.toLowerCase();

      if (Object.hasOwn(counts, key)) {
        counts[key] += 1;
      }
    },
    addSection(section) {
      if (sectionMap.has(section)) {
        return;
      }

      const entries = [];
      sections.push({ entries, name: section });
      sectionMap.set(section, entries);
    },
    print() {
      console.log('');
      console.log('Project Doctor');

      for (const section of sections) {
        console.log('');
        console.log(section.name);

        for (const entry of section.entries) {
          console.log(`  [${entry.status}] ${entry.message}`);
        }
      }

      console.log('');
      console.log(
        `Result: ${counts.ok} passed, ${counts.error} error, ${counts.warn} warnings, ${counts.skip} skipped, ${counts.started} started, ${counts.stopped} stopped`,
      );
    },
  };
}
