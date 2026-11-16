const responses = JSON.parse(process.env.STUDIA_TEST_AI_RESPONSES || '[]');
const originalFetch = global.fetch;

global.fetch = (input, options) => {
  if (!String(input).startsWith('https://generativelanguage.googleapis.com/'))
    return originalFetch(input, options);
  const answer = responses.shift();
  if (!answer) return Promise.resolve(new Response('No fake Gemini answer', { status: 500 }));
  if (answer.fakeStatus)
    return Promise.resolve(
      new Response(JSON.stringify(answer.fakeError), { status: answer.fakeStatus }),
    );
  if (answer.fakeNetworkError)
    return Promise.reject(new TypeError('fetch failed', { cause: { code: 'EACCES' } }));
  const {
    expectPromptParts = [],
    forbidPromptParts = [],
    expectInlineData = [],
    expectImageTurns = [],
    expectMaxPromptBytes = Infinity,
    fakeCandidate,
    ...modelAnswer
  } = answer;
  const request = JSON.parse(options.body);
  const contents = request.contents || [];
  const parts = contents.flatMap((content) => content.parts || []);
  const systemParts = request.systemInstruction?.parts || [];
  const prompt = [...systemParts, ...parts]
    .filter((part) => typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
  const inlineData = parts.filter((part) => part.inlineData).map((part) => part.inlineData);
  const imageTurns = contents.flatMap((content) =>
    (content.parts || [])
      .filter((part) => part.inlineData)
      .map((part) => ({ role: content.role, ...part.inlineData })),
  );
  if (
    expectPromptParts.some((part) => !prompt.includes(part)) ||
    forbidPromptParts.some((part) => prompt.includes(part)) ||
    Buffer.byteLength(prompt) > expectMaxPromptBytes ||
    expectInlineData.length !== inlineData.length ||
    expectInlineData.some(
      (expected, index) =>
        inlineData[index]?.mimeType !== expected.mimeType ||
        inlineData[index]?.data.length < (expected.minLength || 0) ||
        (expected.data && inlineData[index]?.data !== expected.data),
    ) ||
    expectImageTurns.length !== imageTurns.length ||
    expectImageTurns.some(
      (expected, index) =>
        imageTurns[index]?.role !== expected.role ||
        imageTurns[index]?.mimeType !== expected.mimeType ||
        (expected.data && imageTurns[index]?.data !== expected.data) ||
        (expected.textContains &&
          !contents
            .find(
              (content) =>
                content.role === expected.role &&
                content.parts?.some(
                  (part) =>
                    part.inlineData && (!expected.data || part.inlineData.data === expected.data),
                ),
            )
            ?.parts?.some((part) => part.text?.includes(expected.textContains))),
    )
  )
    return Promise.resolve(new Response('AI request content incomplete', { status: 500 }));
  return Promise.resolve(
    new Response(
      JSON.stringify({
        candidates: [
          fakeCandidate ?? { content: { parts: [{ text: JSON.stringify(modelAnswer) }] } },
        ],
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ),
  );
};
