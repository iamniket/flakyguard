/**
 * Compares test results across N runs and classifies each test as:
 * - stable     : passed in every run it appeared in
 * - flaky      : passed in ≥1 run AND failed in ≥1 run
 * - alwaysFailing : failed in every run it appeared in
 */
function analyzeFlakiness(allRuns) {
  const testNames = new Set();
  for (const run of allRuns) {
    for (const name of Object.keys(run)) {
      testNames.add(name);
    }
  }

  const stable = [];
  const flaky = [];
  const alwaysFailing = [];

  for (const name of testNames) {
    // One slot per run; undefined = test absent from that run's report
    const runResults = allRuns.map((run) => run[name] ?? null);
    const seenResults = runResults.filter((r) => r !== null);

    if (seenResults.length === 0) continue;

    const passCount = seenResults.filter((r) => r.passed).length;
    const failCount = seenResults.filter((r) => r.failed).length;
    const errorMessage = seenResults.find((r) => r.errorMessage)?.errorMessage ?? null;

    if (passCount > 0 && failCount > 0) {
      flaky.push({ name, runs: runResults, errorMessage, category: 'Unknown', suggestion: '' });
    } else if (failCount > 0 && passCount === 0) {
      alwaysFailing.push({ name, runs: runResults, errorMessage });
    } else {
      stable.push({ name, runs: runResults });
    }
  }

  return { stable, flaky, alwaysFailing };
}

module.exports = { analyzeFlakiness };
