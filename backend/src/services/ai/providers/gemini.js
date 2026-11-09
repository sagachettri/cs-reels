import { env } from '../../../config/env.js';
import { ApiError } from '../../../utils/ApiError.js';

// Provider contract: generate({ system, messages, json, temperature }) -> string
export async function generate({ system, messages, json = false, temperature = 0.4 }) {
  if (!env.ai.geminiApiKey) {
    throw new ApiError(503, 'AI_NOT_CONFIGURED', 'AI features are not configured on the server (missing GEMINI_API_KEY).');
  }

  const url = `${env.ai.geminiBaseUrl}/models/${encodeURIComponent(env.ai.geminiModel)}:generateContent`;
  const body = {
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature,
      ...(json ? { responseMimeType: 'application/json' } : {}),
    },
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.ai.geminiApiKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(env.ai.timeoutMs),
    });
  } catch (error) {
    console.error('Gemini request failed:', error.message);
    throw new ApiError(504, 'AI_TIMEOUT', 'The AI service did not respond in time. Please try again.');
  }

  if (response.status === 429) {
    throw new ApiError(429, 'AI_RATE_LIMITED', 'The AI service is busy right now. Please try again in a minute.');
  }
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`Gemini error (${response.status}):`, text.slice(0, 300));
    throw new ApiError(502, 'AI_UNAVAILABLE', 'The AI service is unavailable right now. Please try again later.');
  }

  const data = await response.json();
  const text = (data.candidates?.[0]?.content?.parts || []).map((part) => part.text || '').join('').trim();
  if (!text) {
    throw new ApiError(502, 'AI_EMPTY_RESPONSE', 'The AI service returned no answer. Please try again.');
  }
  return text;
}
