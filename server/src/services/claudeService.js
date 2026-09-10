const fetch = (...args) =>
  import('node-fetch').then(({ default: f }) => f(...args));

const SYSTEM_PROMPT = `You are an expert boxing coach analyzing a student's form via computer vision data.
Scores are 0-100. Be concise, direct, encouraging, and use boxing terminology.
Give 1-2 actionable tips max. Keep response under 60 words. Sound like a real boxing coach.`;

exports.callClaude = async (apiKey, userMessage) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw Object.assign(new Error(err.error?.message || 'Claude API error'), { status: response.status });
  }

  const data = await response.json();
  return data.content?.[0]?.text || 'Keep pushing — great work!';
};
