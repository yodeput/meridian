/**
 * LLM API client — OpenAI-compatible (OpenRouter, local proxy, etc).
 * Supports retry on 502/503/529 with fallback model.
 */

import OpenAI from "openai";
import { config } from "../core/config.js";
import { log } from "../core/logger.js";

const client = new OpenAI({
  baseURL: config.llm.llmBaseURL || "https://openrouter.ai/api/v1",
  apiKey: config.llm.llmApiKey,
  timeout: 5 * 60 * 1000,
});

const FALLBACK_MODEL = config.llm.llmFallbackModel;
const DEFAULT_MODEL = config.llm.llmModel || "openrouter/healer-alpha";

/**
 * Send a chat completion request to the LLM.
 * Retries once on 502/503/529 with the fallback model.
 *
 * When tools are provided, returns the full message object (with content + tool_calls).
 * When no tools, returns the content string directly.
 *
 * @param {object} opts
 * @param {string} opts.role - "MANAGER" | "SCREENER" | "GENERAL"
 * @param {string} opts.systemPrompt
 * @param {Array} opts.messages
 * @param {Array} [opts.tools]
 * @param {number} [opts.maxTokens] - Override max_tokens
 * @returns {Promise<object|string>} Full message object when tools present, otherwise string.
 */
export async function chat({ role, systemPrompt, messages, tools, maxTokens }) {
  const modelKey = role === "MANAGER" ? "managementModel"
    : role === "SCREENER" ? "screeningModel"
    : "generalModel";
  const model = config.llm[modelKey] || DEFAULT_MODEL;

  const payload = {
    model,
    messages: [{ role: "system", content: systemPrompt }, ...messages],
    max_tokens: maxTokens ?? (config.llm.maxTokens || 4096),
    temperature: config.llm.temperature ?? 0.373,
  };

  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = "auto";
  }

  try {
    const response = await client.chat.completions.create(payload);
    const choice = response.choices?.[0];
    if (!choice) return tools ? {} : "";
    return tools ? choice.message : (choice.message?.content || "");
  } catch (error) {
    const status = error?.status;
    if (status === 502 || status === 503 || status === 529) {
      log("llm_retry", `${model} returned ${status}, falling back to ${FALLBACK_MODEL}`);
      payload.model = FALLBACK_MODEL;
      try {
        const response = await client.chat.completions.create(payload);
        const choice = response.choices?.[0];
        if (!choice) return tools ? {} : "";
        return tools ? choice.message : (choice.message?.content || "");
      } catch (retryError) {
        log("llm_error", `Fallback ${FALLBACK_MODEL} also failed: ${retryError.message}`);
        throw retryError;
      }
    }
    log("llm_error", `${model} failed: ${error.message}`);
    throw error;
  }
}
