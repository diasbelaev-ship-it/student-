const { setTimeout: sleep } = require('node:timers/promises');

class GeminiError extends Error {
  constructor(status, message, diagnostic) {
    super(message);
    this.status = status;
    this.diagnostic = diagnostic;
  }
}

async function checkResponse(response) {
  if (response.ok) return;

  const status = response.status;
  const error = (await response.json().catch(() => null))?.error;
  const details = Array.isArray(error?.details) ? error.details : [];
  const keyRejected = details.some((detail) => detail?.reason === 'API_KEY_INVALID');
  if (status === 401 || status === 403 || keyRejected)
    throw new GeminiError(
      502,
      'Gemini отклонил доступ. Проверьте серверный API-ключ и доступ к модели.',
      status,
    );
  if (status === 429)
    throw new GeminiError(
      503,
      'Gemini временно ограничил запросы. Подождите и проверьте квоту API.',
      status,
    );
  if (status === 404)
    throw new GeminiError(
      502,
      'Модель Gemini не найдена. Проверьте GEMINI_MODEL на сервере.',
      status,
    );
  if (status === 504)
    throw new GeminiError(
      504,
      'Gemini отвечает слишком долго. Сократите запрос или попробуйте ещё раз.',
      status,
    );
  if (status >= 500)
    throw new GeminiError(503, 'Сервис Gemini временно недоступен. Попробуйте ещё раз.', status);
  throw new GeminiError(
    502,
    'Gemini отклонил запрос. Попробуйте уточнить сообщение или заменить изображение.',
    status,
  );
}

async function generateWithGemini({ systemInstruction, conversation, cancelSignal }) {
  const model = encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const signal = AbortSignal.any([AbortSignal.timeout(30000), cancelSignal]);
  const options = {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemInstruction }] },
      contents: conversation,
      generationConfig: { responseMimeType: 'application/json' },
    }),
    signal,
  };
  let response = await fetch(url, options);
  // Retry once within the same deadline when Gemini explicitly reports temporary unavailability.
  if (response.status === 503 && !response.headers.has('Retry-After')) {
    await response.body?.cancel();
    await sleep(350 + Math.random() * 250, undefined, { signal });
    response = await fetch(url, options);
  }
  await checkResponse(response);

  const result = await response.json();
  const candidate = result.candidates?.[0];
  const reason = candidate?.finishReason;
  if (reason === 'MAX_TOKENS')
    throw new GeminiError(
      502,
      'Gemini не успел завершить ответ. Разбейте запрос на несколько коротких.',
      reason,
    );
  if (
    result.promptFeedback?.blockReason ||
    (reason && reason !== 'STOP' && reason !== 'FINISH_REASON_UNSPECIFIED')
  )
    throw new GeminiError(
      502,
      'Gemini не смог завершить ответ на этот запрос. Измените формулировку или вложение.',
      'blocked or incomplete',
    );
  const parts = candidate?.content?.parts;
  if (!Array.isArray(parts))
    throw new GeminiError(502, 'Gemini не прислал ответ. Попробуйте ещё раз.', 'no candidate');
  const text = parts
    .filter((part) => !part?.thought && typeof part?.text === 'string')
    .map((part) => part.text)
    .join('')
    .trim();
  const json = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1] ?? text;
  return JSON.parse(json);
}

module.exports = { generateWithGemini, GeminiError };
