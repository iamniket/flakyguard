# 🛡️ FlakyGuard

[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-FlakyGuard-blue?logo=github)](https://github.com/marketplace/actions/flakyguard)

FlakyGuard detects flaky tests in your Java projects by running the test suite multiple times and comparing results. It automatically categorises each flaky test using AI (GitHub Models / gpt-4o-mini) and posts a structured report as a PR comment — no external API keys required.

---

## Quick Start

Add FlakyGuard as a step **after** your normal build:

```yaml
- name: Run FlakyGuard
  uses: your-username/flakyguard@v1
  with:
    test-command: 'mvn test'
    runs: 3
    on-flaky: 'warn'
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `test-command` | ✅ | — | Command to run your tests (e.g. `mvn test`, `mvn verify`) |
| `runs` | ❌ | `3` | How many times to re-run the suite (minimum 1) |
| `github-token` | ✅ | — | `${{ secrets.GITHUB_TOKEN }}` — used for PR comments and GitHub Models AI |
| `on-flaky` | ❌ | `warn` | `warn` = post comment, keep build green · `fail` = post comment **and** fail the step |

---

## How It Works

1. **Runs your test command** N times, capturing surefire XML reports after each run.
2. **Parses** `target/surefire-reports/*.xml` — supports JUnit 4/5 and TestNG (both produce Surefire XML).
3. **Compares** pass/fail status across runs:
   - **Stable** — same result every run
   - **Flaky** — passed in ≥ 1 run **and** failed in ≥ 1 run
   - **Always Failing** — failed in every run
4. **Categorises** each flaky test via GitHub Models (`gpt-4o-mini`) — free, no API key needed.
5. **Posts** a Markdown comment on the PR and writes a step summary.

---

## Example PR Comment

> _Screenshot placeholder — add `docs/pr-comment-screenshot.png` after your first run._

```
## 🛡️ FlakyGuard Report

| | Count |
|---|---|
| ✅ Stable | 142 |
| ⚠️ Flaky | 3 |
| ❌ Always Failing | 1 |

### ⚠️ Flaky Tests Detected

| Test | Run 1 | Run 2 | Run 3 | Category | Suggestion |
|---|---|---|---|---|---|
| LoginTest.verifyToken | ✅ | ❌ | ✅ | Timing/Async Issue | Add an explicit wait before the token assertion |

> ⚠️ Merge with caution — flaky tests detected.
```

---

## Supported Frameworks

| Framework | Report Location |
|---|---|
| Maven + JUnit 4 / 5 | `target/surefire-reports/*.xml` |
| Maven + TestNG | `target/surefire-reports/testng*.xml` |

---

## AI Flakiness Categories

| Category | Typical cause |
|---|---|
| Timing/Async Issue | Thread sleeps, missing waits, race on async callbacks |
| Test Data Dependency | Shared/polluted DB state between tests |
| Environment/Resource Issue | Missing env vars, file-system side effects |
| Race Condition | Concurrent access to shared mutable state |
| Network Instability | External HTTP calls, DNS resolution |
| Unknown | Could not determine — check the error message manually |

---

## Full Workflow Example

```yaml
name: CI

on:
  pull_request:

jobs:
  build-and-flaky-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up JDK 17
        uses: actions/setup-java@v4
        with:
          java-version: '17'
          distribution: 'temurin'
          cache: 'maven'

      - name: Run FlakyGuard
        uses: your-username/flakyguard@v1
        with:
          test-command: 'mvn test -B'
          runs: 3
          on-flaky: 'warn'
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

---

## License

[MIT](LICENSE) © FlakyGuard contributors
