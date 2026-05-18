const core = require('@actions/core');
const exec = require('@actions/exec');
const github = require('@actions/github');

const { parseResults } = require('./src/parseResults');
const { analyzeFlakiness } = require('./src/analyzeFlakiness');
const { categorizeWithAI } = require('./src/categorizeWithAI');
const { postComment } = require('./src/postComment');

async function run() {
  try {
    const testCommand = core.getInput('test-command', { required: true });
    const runs = Math.max(1, parseInt(core.getInput('runs') || '3', 10));
    const githubToken = core.getInput('github-token', { required: true });
    const onFlaky = core.getInput('on-flaky') || 'warn';

    if (!['warn', 'fail'].includes(onFlaky)) {
      core.warning(`on-flaky value "${onFlaky}" is not recognized. Defaulting to "warn".`);
    }

    const octokit = github.getOctokit(githubToken);
    const context = github.context;

    // Split the test command into executable + args for @actions/exec
    const [cmd, ...args] = testCommand.split(/\s+/);

    const allRuns = [];

    for (let i = 1; i <= runs; i++) {
      core.info(`\n🔄 Run ${i}/${runs}: ${testCommand}`);

      await exec.exec(cmd, args, { ignoreReturnCode: true });

      const results = await parseResults();
      allRuns.push(results);

      const count = Object.keys(results).length;
      core.info(`✓ Run ${i} complete — parsed ${count} test result(s).`);
    }

    // Classify tests across all runs
    const analysis = analyzeFlakiness(allRuns);
    const { stable, flaky, alwaysFailing } = analysis;

    core.info(
      `\n📊 Results: ${stable.length} stable, ${flaky.length} flaky, ${alwaysFailing.length} always-failing`,
    );

    // AI categorization for each flaky test (failures are non-fatal)
    if (flaky.length > 0) {
      core.info('\n🤖 Categorizing flaky tests with GitHub Models (gpt-4o-mini)...');
      for (const test of flaky) {
        const { category, suggestion } = await categorizeWithAI(
          test.name,
          test.errorMessage,
          githubToken,
        );
        test.category = category;
        test.suggestion = suggestion;
        core.info(`  • ${test.name} → ${category}`);
      }
    }

    // Post PR comment (skipped silently outside PR context)
    if (context.payload.pull_request) {
      await postComment(octokit, context, analysis, runs);
      core.info('\n💬 PR comment posted.');
    } else {
      core.info('\nℹ️  Not running in a PR context — skipping comment.');
    }

    // Summary output for the Actions step summary
    await core.summary
      .addHeading('🛡️ FlakyGuard Results')
      .addTable([
        [{ data: 'Status', header: true }, { data: 'Count', header: true }],
        ['✅ Stable', String(stable.length)],
        ['⚠️ Flaky', String(flaky.length)],
        ['❌ Always Failing', String(alwaysFailing.length)],
      ])
      .write();

    // Honour on-flaky setting
    if (flaky.length > 0) {
      const msg = `FlakyGuard detected ${flaky.length} flaky test(s).`;
      if (onFlaky === 'fail') {
        core.setFailed(msg);
      } else {
        core.warning(msg);
      }
    }
  } catch (err) {
    core.setFailed(`FlakyGuard encountered an unexpected error: ${err.message}`);
  }
}

run();
