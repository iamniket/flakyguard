const HEADER = '<!-- flakyguard-report -->';

function runIcon(result) {
  if (result === null) return '➖';
  return result.passed ? '✅' : '❌';
}

function buildBody(analysis, runCount) {
  const { stable, flaky, alwaysFailing } = analysis;
  const lines = [];

  lines.push(HEADER);
  lines.push('## 🛡️ FlakyGuard Report');
  lines.push('');
  lines.push('| | Count |');
  lines.push('|---|---|');
  lines.push(`| ✅ Stable | ${stable.length} |`);
  lines.push(`| ⚠️ Flaky | ${flaky.length} |`);
  lines.push(`| ❌ Always Failing | ${alwaysFailing.length} |`);
  lines.push('');

  if (flaky.length === 0 && alwaysFailing.length === 0) {
    lines.push(`✅ All ${stable.length} tests passed consistently across ${runCount} run(s). No flaky tests detected!`);
    return lines.join('\n');
  }

  if (flaky.length > 0) {
    const runHeaders = Array.from({ length: runCount }, (_, i) => `Run ${i + 1}`).join(' | ');
    const runSeps = Array.from({ length: runCount }, () => '---').join(' | ');

    lines.push('### ⚠️ Flaky Tests Detected');
    lines.push('');
    lines.push(`| Test | ${runHeaders} | Category | Suggestion |`);
    lines.push(`|---|${runSeps}|---|---|`);

    for (const test of flaky) {
      const runCells = test.runs.map(runIcon).join(' | ');
      const name = `\`${test.name}\``;
      lines.push(`| ${name} | ${runCells} | ${test.category} | ${test.suggestion} |`);
    }

    lines.push('');
    lines.push('> ⚠️ Merge with caution — flaky tests detected.');
  }

  if (alwaysFailing.length > 0) {
    lines.push('');
    lines.push('### ❌ Always Failing Tests');
    lines.push('');
    for (const test of alwaysFailing) {
      lines.push(`- \`${test.name}\``);
    }
  }

  return lines.join('\n');
}

async function postComment(octokit, context, analysis, runCount) {
  const pr = context.payload.pull_request;
  if (!pr) return; // not a PR run — skip silently

  const { owner, repo } = context.repo;
  const issue_number = pr.number;
  const body = buildBody(analysis, runCount);

  // Update existing FlakyGuard comment rather than spamming new ones
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number,
    per_page: 100,
  });

  const existing = comments.find(
    (c) => c.body && c.body.startsWith(HEADER),
  );

  if (existing) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existing.id,
      body,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body,
    });
  }
}

module.exports = { postComment };
