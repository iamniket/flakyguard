const { XMLParser } = require('fast-xml-parser');
const { glob } = require('glob');
const fs = require('fs');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['testcase', 'testsuite'].includes(name),
  allowBooleanAttributes: true,
});

async function parseResults() {
  const results = {};

  const files = await glob('**/target/surefire-reports/**/*.xml', {
    ignore: ['**/node_modules/**'],
    absolute: true,
  });

  for (const file of files) {
    let content;
    try {
      content = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }

    let parsed;
    try {
      parsed = parser.parse(content);
    } catch {
      continue;
    }

    // Handle both <testsuite> root and <testsuites><testsuite> root (TestNG wraps in testsuites)
    let suites = [];
    if (parsed.testsuites?.testsuite) {
      suites = Array.isArray(parsed.testsuites.testsuite)
        ? parsed.testsuites.testsuite
        : [parsed.testsuites.testsuite];
    } else if (parsed.testsuite) {
      suites = Array.isArray(parsed.testsuite)
        ? parsed.testsuite
        : [parsed.testsuite];
    }

    for (const suite of suites) {
      const testcases = Array.isArray(suite.testcase)
        ? suite.testcase
        : suite.testcase
          ? [suite.testcase]
          : [];

      for (const tc of testcases) {
        const className = tc['@_classname'] || suite['@_name'] || 'Unknown';
        const testName = tc['@_name'] || 'unknown';
        const fullName = `${className}.${testName}`;

        const failureNode = tc.failure;
        const errorNode = tc.error;
        const failed = !!(failureNode || errorNode);

        const errorMessage =
          (typeof failureNode === 'object' ? failureNode['#text'] || failureNode['@_message'] : failureNode) ||
          (typeof errorNode === 'object' ? errorNode['#text'] || errorNode['@_message'] : errorNode) ||
          null;

        results[fullName] = {
          name: fullName,
          passed: !failed,
          failed,
          errorMessage: errorMessage ? String(errorMessage).trim().slice(0, 500) : null,
        };
      }
    }
  }

  return results;
}

module.exports = { parseResults };
