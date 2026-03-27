import { buildSystemPrompt } from "./prompt.js";
import { executeTool } from "./tools/executor.js";
import { tools } from "./tools/definitions.js";
import { MANAGER_TOOLS, SCREENER_TOOLS } from "./roles.js";
import { chat } from "../adapters/llm.js";
import { getWalletBalances } from "../adapters/wallet.js";
import { getMyPositions } from "../adapters/dlmm.js";
import { log } from "../core/logger.js";
import { config } from "../core/config.js";
import { getStateSummary } from "../core/state.js";
import { getLessonsForPrompt, getPerformanceSummary } from "../core/lessons.js";

function getToolsForRole(agentType) {
  if (agentType === "MANAGER")  return tools.filter(t => MANAGER_TOOLS.has(t.function.name));
  if (agentType === "SCREENER") return tools.filter(t => SCREENER_TOOLS.has(t.function.name));
  return tools;
}

/**
 * Core ReAct agent loop.
 *
 * @param {string} goal - The task description for the agent
 * @param {number} maxSteps - Safety limit on iterations (default 20)
 * @returns {string} - The agent's final text response
 */
export async function agentLoop(goal, maxSteps = config.llm.maxSteps, sessionHistory = [], agentType = "GENERAL", model = null, maxOutputTokens = null) {
  // Build dynamic system prompt with current portfolio state
  const [portfolio, positions] = await Promise.all([getWalletBalances(), getMyPositions()]);
  const stateSummary = getStateSummary();
  const lessons = getLessonsForPrompt({ agentType });
  const perfSummary = getPerformanceSummary();
  const systemPrompt = buildSystemPrompt(agentType, portfolio, positions, stateSummary, lessons, perfSummary);

  const messages = [
    ...sessionHistory,          // inject prior conversation turns
    { role: "user", content: goal },
  ];

  const toolsArg = getToolsForRole(agentType);

  let emptyStreak = 0;
  for (let step = 0; step < maxSteps; step++) {
    log("agent", `Step ${step + 1}/${maxSteps}`);

    try {
      // chat() returns the full message object when tools are provided
      const msg = await chat({
        role: agentType,
        systemPrompt,
        messages,
        tools: toolsArg,
        maxTokens: maxOutputTokens,
      });

      if (!msg || (!msg.content && !msg.tool_calls)) {
        emptyStreak++;
        if (emptyStreak >= 3) {
          log("error", `Bad API response: ${emptyStreak} consecutive empty messages, aborting`);
          throw new Error("API returned empty message");
        }
        log("agent", `Empty API response (streak ${emptyStreak}/3), retrying...`);
        continue;
      }
      messages.push(msg);

      // If the model didn't call any tools, it's done
      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        if (!msg.content) {
          emptyStreak++;
          if (emptyStreak >= 3) {
            log("error", `Empty content: ${emptyStreak} consecutive empty responses, aborting`);
            throw new Error("API returned empty message");
          }
          messages.pop();
          log("agent", `Empty response (streak ${emptyStreak}/3), retrying...`);
          continue;
        }
        log("agent", "Final answer reached");
        log("agent", msg.content);
        return { content: msg.content, userMessage: goal };
      }

      // Execute each tool call in parallel
      emptyStreak = 0;
      const toolResults = await Promise.all(msg.tool_calls.map(async (toolCall) => {
        const functionName = toolCall.function.name;
        let functionArgs;

        try {
          functionArgs = JSON.parse(toolCall.function.arguments);
        } catch (parseError) {
          log("error", `Failed to parse args for ${functionName}: ${parseError.message}`);
          functionArgs = {};
        }

        const result = await executeTool(functionName, functionArgs);

        return {
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        };
      }));

      messages.push(...toolResults);
    } catch (error) {
      log("error", `Agent loop error at step ${step}: ${error.message}`);

      // If it's a rate limit, wait and retry
      if (error.status === 429) {
        log("agent", "Rate limited, waiting 30s...");
        await sleep(30000);
        continue;
      }

      // For other errors, break the loop
      throw error;
    }
  }

  log("agent", "Max steps reached without final answer");
  return { content: "Max steps reached. Review logs for partial progress.", userMessage: goal };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
