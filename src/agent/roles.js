/**
 * Agent role definitions — tool sets per role.
 */

export const MANAGER_TOOLS = new Set([
  "close_position", "claim_fees", "swap_token", "update_config",
  "get_position_pnl", "get_my_positions", "set_position_note",
  "add_pool_note", "get_wallet_balance", "withdraw_liquidity",
  "add_liquidity", "list_strategies", "get_strategy",
  "set_active_strategy", "get_pool_detail", "get_token_info",
  "get_active_bin", "study_top_lpers",
]);

export const SCREENER_TOOLS = new Set([
  "deploy_position", "get_active_bin", "get_top_candidates",
  "check_smart_wallets_on_pool", "get_token_holders",
  "get_token_narrative", "get_token_info", "search_pools",
  "get_pool_memory", "add_pool_note", "add_to_blacklist",
  "update_config", "get_wallet_balance", "get_my_positions",
  "list_strategies", "get_strategy", "set_active_strategy",
  "swap_token", "add_liquidity", "study_top_lpers",
  "get_pool_detail",
]);

export const WRITE_TOOLS = new Set([
  "deploy_position",
  "claim_fees",
  "close_position",
  "swap_token",
  "withdraw_liquidity",
  "add_liquidity",
]);
