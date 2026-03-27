import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_CONFIG_PATH = path.join(__dirname, "..", "..", "user-config.json");

const u = fs.existsSync(USER_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"))
  : {};

export const config = {
  // ─── Credentials ───────────────────────
  credentials: {
    rpcUrl:           u.credentials?.rpcUrl           || null,
    walletKey:        u.credentials?.walletKey        || null,
    heliusApiKey:     u.credentials?.heliusApiKey     || null,
    lpAgentApiKey:    u.credentials?.lpAgentApiKey || u.credentials?.lpagentApiKey || null,
    telegramBotToken: u.credentials?.telegramBotToken || null,
    telegramChatId:   u.credentials?.telegramChatId   || null,
    hiveMindUrl:      u.credentials?.hiveMindUrl      || null,
    hiveMindApiKey:   u.credentials?.hiveMindApiKey   || null,
  },

  // ─── LLM Settings ──────────────────────
  llm: {
    temperature:      u.llm?.temperature      ?? 0.373,
    maxTokens:        u.llm?.maxTokens        ?? 4096,
    maxSteps:         u.llm?.maxSteps         ?? 20,
    managementModel:  u.llm?.managementModel  ?? u.llm?.llmModel,
    screeningModel:   u.llm?.screeningModel   ?? u.llm?.llmModel,
    generalModel:     u.llm?.generalModel     ?? u.llm?.llmModel,
    llmBaseURL:       u.llm?.llmBaseURL       || null,
    llmApiKey:        u.llm?.llmApiKey        || null,
    llmModel:         u.llm?.llmModel         || null,
    llmFallbackModel: u.llm?.llmFallbackModel || "stepfun/step-3.5-flash:free",
  },

  // ─── Risk Limits ───────────────────────
  risk: {
    maxPositions:    u.risk?.maxPositions    ?? 3,
    maxDeployAmount: u.risk?.maxDeployAmount ?? 50,
  },

  // ─── Pool Screening Thresholds ───────────
  screening: {
    minFeeActiveTvlRatio: u.screening?.minFeeActiveTvlRatio ?? 0.05,
    minTvl:            u.screening?.minTvl            ?? 10_000,
    maxTvl:            u.screening?.maxTvl            ?? 150_000,
    minVolume:         u.screening?.minVolume         ?? 500,
    minOrganic:        u.screening?.minOrganic        ?? 60,
    minHolders:        u.screening?.minHolders        ?? 500,
    minMcap:           u.screening?.minMcap           ?? 150_000,
    maxMcap:           u.screening?.maxMcap           ?? 10_000_000,
    minBinStep:        u.screening?.minBinStep        ?? 80,
    maxBinStep:        u.screening?.maxBinStep        ?? 125,
    timeframe:         u.screening?.timeframe         ?? "5m",
    category:          u.screening?.category          ?? "trending",
    minTokenFeesSol:   u.screening?.minTokenFeesSol   ?? 30,
    maxBundlersPct:    u.screening?.maxBundlersPct    ?? 30,
    maxTop10Pct:       u.screening?.maxTop10Pct       ?? 60,
    blockedLaunchpads: u.screening?.blockedLaunchpads ?? [],
  },

  // ─── Position Management ────────────────
  management: {
    strategy:              u.management?.strategy              ?? "bid_ask",
    binsBelow:             u.management?.binsBelow             ?? 69,
    minClaimAmount:        u.management?.minClaimAmount        ?? 5,
    autoSwapAfterClaim:    u.management?.autoSwapAfterClaim    ?? false,
    outOfRangeBinsToClose: u.management?.outOfRangeBinsToClose ?? 10,
    outOfRangeWaitMinutes: u.management?.outOfRangeWaitMinutes ?? 30,
    minVolumeToRebalance:  u.management?.minVolumeToRebalance  ?? 1000,
    emergencyPriceDropPct: u.management?.emergencyPriceDropPct ?? -50,
    takeProfitFeePct:      u.management?.takeProfitFeePct      ?? 5,
    minFeePerTvl24h:       u.management?.minFeePerTvl24h       ?? 7,
    minSolToOpen:          u.management?.minSolToOpen          ?? 0.55,
    deployAmountSol:       u.management?.deployAmountSol       ?? 0.5,
    gasReserve:            u.management?.gasReserve            ?? 0.2,
    positionSizePct:       u.management?.positionSizePct       ?? 0.35,
  },

  // ─── Scheduling ─────────────────────────
  schedule: {
    managementIntervalMin:  u.schedule?.managementIntervalMin  ?? 10,
    screeningIntervalMin:   u.schedule?.screeningIntervalMin   ?? 30,
    healthCheckIntervalMin: u.schedule?.healthCheckIntervalMin ?? 60,
  },

  // ─── Runtime ────────────────────────────
  runtime: {
    dryRun:   u.runtime?.dryRun === true,
    logLevel: u.runtime?.logLevel || "info",
  },

  // ─── Common Token Mints ────────────────
  tokens: {
    SOL:  "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
};

export function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"));
  } catch {
    return {};
  }
}

export function writeConfig(data) {
  fs.writeFileSync(USER_CONFIG_PATH, JSON.stringify(data, null, 2));
}

/**
 * Compute the optimal deploy amount for a given wallet balance.
 * Scales position size with wallet growth (compounding).
 *
 * Formula: clamp(deployable × positionSizePct, floor=deployAmountSol, ceil=maxDeployAmount)
 */
export function computeDeployAmount(walletSol) {
  const reserve  = config.management.gasReserve      ?? 0.2;
  const pct      = config.management.positionSizePct ?? 0.35;
  const floor    = config.management.deployAmountSol;
  const ceil     = config.risk.maxDeployAmount;
  const deployable = Math.max(0, walletSol - reserve);
  const dynamic    = deployable * pct;
  const result     = Math.min(ceil, Math.max(floor, dynamic));
  return parseFloat(result.toFixed(2));
}

/**
 * Reload user-config.json and apply updated screening thresholds to the
 * in-memory config object. Called after threshold evolution so the next
 * agent cycle uses the evolved values without a restart.
 */
export function reloadScreeningThresholds() {
  if (!fs.existsSync(USER_CONFIG_PATH)) return;
  try {
    const fresh = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"));
    const s = config.screening;
    if (fresh.screening?.minFeeActiveTvlRatio != null) s.minFeeActiveTvlRatio = fresh.screening.minFeeActiveTvlRatio;
    if (fresh.screening?.minOrganic     != null) s.minOrganic     = fresh.screening.minOrganic;
    if (fresh.screening?.minHolders     != null) s.minHolders     = fresh.screening.minHolders;
    if (fresh.screening?.minMcap        != null) s.minMcap        = fresh.screening.minMcap;
    if (fresh.screening?.maxMcap        != null) s.maxMcap        = fresh.screening.maxMcap;
    if (fresh.screening?.minTvl         != null) s.minTvl         = fresh.screening.minTvl;
    if (fresh.screening?.maxTvl         != null) s.maxTvl         = fresh.screening.maxTvl;
    if (fresh.screening?.minVolume      != null) s.minVolume      = fresh.screening.minVolume;
    if (fresh.screening?.minBinStep     != null) s.minBinStep     = fresh.screening.minBinStep;
    if (fresh.screening?.maxBinStep     != null) s.maxBinStep     = fresh.screening.maxBinStep;
    if (fresh.screening?.timeframe      != null) s.timeframe      = fresh.screening.timeframe;
    if (fresh.screening?.category       != null) s.category       = fresh.screening.category;
  } catch { /* ignore */ }
}
