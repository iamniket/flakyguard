const https = require('https');

const VALID_CATEGORIES = new Set([
  'Timing/Async Issue',
  'Test Data Dependency',
  'Environment/Resource Issue',
  'Race Condition',
  'Network Instability',
  'Unknown',
]);

const SYSTEM_PROMPT =
  'You are a test-flakiness expert. Respond only with a valid JSON object — no markdown, no extra text.';

function buildUserPrompt(testName, errorMessage) {
  return `Analyze this flaky test and classify it.

Test name: ${testName}
Error: ${errorMessage || '(no error message captured)'}

Return JSON with exactly these two fields:
{
  "category": "<one of: Timing/Async Issue | Test Data Dependency | Environment/Resource Issue | Race Condition | Network Instability | Unknown>",
  "suggestion": "<one plain-English sentence describing the most likely fix>"
}`;
}

function httpsPost(hostname, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname, path, method: 'POST', headers }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(raw);
        } else {
          reject(new Error(`GitHub Models HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function categorizeWithAI(testName, errorMessage, githubToken) {
  const fallback = { category: 'Unknown', suggestion: 'Unable to generate suggestion — AI call failed.' };

  try {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(testName, errorMessage) },
      ],
      max_tokens: 150,
      temperature: 0,
    });

    const raw = await httpsPost(
      'models.inference.ai.azure.com',
      '/chat/completions',
      {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${githubToken}`,
        'Content-Length': Buffer.byteLength(payload),
      },
      payload,
    );

    const apiResponse = JSON.parse(raw);
    const content = apiResponse?.choices?.[0]?.message?.content;
    if (!content) return fallback;

    const parsed = JSON.parse(content);
    const category = VALID_CATEGORIES.has(parsed.category) ? parsed.category : 'Unknown';
    const suggestion = typeof parsed.suggestion === 'string' && parsed.suggestion.trim()
      ? parsed.suggestion.trim()
      : 'No suggestion available.';

    return { category, suggestion };
  } catch {
    return fallback;
  }
}

module.exports = { categorizeWithAI };
