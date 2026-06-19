import type Database from "better-sqlite3";

/**
 * Paid-equivalent pricing per model: what the SAME model (or its nearest
 * equivalent) costs per million tokens on paid APIs. Used by the analytics
 * "Est. savings" stat so it reflects realistic savings rather than pricing
 * every token like a frontier model.
 *
 * Source: OpenRouter public pricing API (paid, non-:free variants),
 * snapshot 2026-06-05; closed models use their official API prices.
 * `null` = no paid equivalent exists (stealth/preview models) — analytics
 * falls back to a modest default.
 *
 * Format: [platform, model_id, $/M input, $/M output]
 */
type PricingRow = [string, string, number | null, number | null];

export const MODEL_PRICING: PricingRow[] = [
	// Cerebras
	["cerebras", "gpt-oss-120b", 0.039, 0.18],
	["cerebras", "llama3.1-8b", 0.02, 0.03],
	["cerebras", "qwen-3-235b-a22b-instruct-2507", 0.071, 0.1],
	["cerebras", "zai-glm-4.7", 0.4, 1.75],
	// legacy ids (older DBs)
	["cerebras", "qwen-3-coder-480b", 0.22, 1.8],
	["cerebras", "llama-4-maverick-17b-128e-instruct", 0.15, 0.6],
	["cerebras", "qwen3-235b", 0.455, 1.82],

	// Cloudflare Workers AI
	["cloudflare", "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b", 0.29, 0.29],
	["cloudflare", "@cf/google/gemma-4-26b-a4b-it", 0.06, 0.33],
	["cloudflare", "@cf/ibm-granite/granite-4.0-h-micro", 0.017, 0.112],
	["cloudflare", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", 0.1, 0.32],
	["cloudflare", "@cf/meta/llama-4-scout-17b-16e-instruct", 0.08, 0.3],
	["cloudflare", "@cf/moonshotai/kimi-k2.6", 0.684, 3.42],
	["cloudflare", "@cf/nvidia/nemotron-3-120b-a12b", 0.09, 0.45],
	["cloudflare", "@cf/openai/gpt-oss-120b", 0.039, 0.18],
	["cloudflare", "@cf/qwen/qwen3-30b-a3b-fp8", 0.09, 0.45],
	["cloudflare", "@cf/zai-org/glm-4.7-flash", 0.06, 0.4],
	["cloudflare", "@cf/meta/llama-3.1-70b-instruct", 0.4, 0.4], // legacy

	// Cohere (official API prices; Reasoning shares Command A pricing)
	["cohere", "command-a-03-2025", 2.5, 10.0],
	["cohere", "command-a-reasoning-08-2025", 2.5, 10.0],
	["cohere", "command-r-08-2024", 0.15, 0.6],
	["cohere", "command-r-plus-08-2024", 2.5, 10.0],

	// GitHub Models (OpenAI official prices)
	["github", "gpt-4o", 2.5, 10.0],
	["github", "openai/gpt-4.1", 2.0, 8.0],
	["github", "openai/gpt-5", 1.25, 10.0], // legacy

	// Google AI Studio (official prices)
	["google", "gemini-2.5-flash", 0.3, 2.5],
	["google", "gemini-2.5-flash-lite", 0.1, 0.4],
	["google", "gemini-2.5-pro", 1.25, 10.0],
	["google", "gemini-3-flash-preview", 0.5, 3.0],
	["google", "gemini-3.1-flash-lite-preview", 0.25, 1.5],
	["google", "gemini-3.1-pro-preview", 2.0, 12.0],
	["google", "gemini-3.5-flash", 1.5, 9.0],
	["google", "gemma-4-26b-a4b-it", 0.06, 0.33],
	["google", "gemma-4-31b-it", 0.12, 0.37],

	// Groq (compound is an agentic pipeline — estimated at its underlying
	// gpt-oss models' prices)
	["groq", "groq/compound", 0.039, 0.18],
	["groq", "groq/compound-mini", 0.029, 0.14],
	["groq", "llama-3.1-8b-instant", 0.02, 0.03],
	["groq", "llama-3.3-70b-versatile", 0.1, 0.32],
	["groq", "meta-llama/llama-4-scout-17b-16e-instruct", 0.08, 0.3],
	["groq", "llama-4-scout-17b-16e-instruct", 0.08, 0.3], // legacy id
	["groq", "openai/gpt-oss-120b", 0.039, 0.18],
	["groq", "openai/gpt-oss-20b", 0.029, 0.14],
	["groq", "openai/gpt-oss-safeguard-20b", 0.075, 0.3],
	["groq", "qwen/qwen3-32b", 0.08, 0.28],

	// Hugging Face Inference
	["huggingface", "Qwen/Qwen3-Coder-Next", 0.11, 0.8],
	["huggingface", "deepseek-ai/DeepSeek-V4-Flash", 0.098, 0.197],
	["huggingface", "moonshotai/Kimi-K2.6", 0.684, 3.42],
	[
		"huggingface",
		"accounts/fireworks/models/llama-v3p3-70b-instruct",
		0.1,
		0.32,
	], // legacy

	// Kilo (Poolside Laguna is stealth — no paid equivalent)
	["kilo", "nvidia/nemotron-3-super-120b-a12b:free", 0.09, 0.45],
	["kilo", "poolside/laguna-m.1:free", null, null],
	["kilo", "poolside/laguna-xs.2:free", null, null],
	["kilo", "stepfun/step-3.7-flash:free", 0.2, 1.15],

	// LLM7
	["llm7", "codestral-latest", 0.3, 0.9],

	// Mistral (official La Plateforme prices; Magistral per official page)
	["mistral", "codestral-latest", 0.3, 0.9],
	["mistral", "devstral-latest", 0.4, 2.0],
	["mistral", "magistral-medium-latest", 2.0, 5.0],
	["mistral", "ministral-8b-latest", 0.15, 0.15],
	["mistral", "mistral-large-latest", 0.5, 1.5],
	["mistral", "mistral-medium-latest", 1.5, 7.5],
	["mistral", "mistral-small-latest", 0.15, 0.6],

	// Moonshot / MiniMax (legacy platforms, may exist in older DBs)
	["moonshot", "kimi-latest", 0.684, 3.42],
	["minimax", "MiniMax-M1", 0.4, 2.2],

	// NVIDIA NIM
	["nvidia", "deepseek-ai/deepseek-v4-flash", 0.098, 0.197],
	["nvidia", "deepseek-ai/deepseek-v4-pro", 0.435, 0.87],
	["nvidia", "google/gemma-4-31b-it", 0.12, 0.37],
	["nvidia", "meta/llama-3.1-70b-instruct", 0.4, 0.4],
	["nvidia", "meta/llama-3.3-70b-instruct", 0.1, 0.32],
	["nvidia", "meta/llama-4-maverick-17b-128e-instruct", 0.15, 0.6],
	["nvidia", "minimaxai/minimax-m2.7", 0.279, 1.2],
	["nvidia", "mistralai/mistral-large-3-675b-instruct-2512", 0.5, 1.5],
	["nvidia", "moonshotai/kimi-k2.6", 0.684, 3.42],
	["nvidia", "nvidia/nemotron-3-nano-30b-a3b", 0.05, 0.2],
	["nvidia", "nvidia/nemotron-3-super-120b-a12b", 0.09, 0.45],
	["nvidia", "qwen/qwen3-coder-480b-a35b-instruct", 0.22, 1.8],
	["nvidia", "z-ai/glm-5.1", 0.98, 3.08],

	// Ollama (local models priced at their cloud-API equivalents — that's
	// what running them elsewhere would cost)
	["ollama", "cogito-2.1:671b", 1.25, 1.25],
	["ollama", "deepseek-v3.2", 0.229, 0.343],
	["ollama", "devstral-2:123b", 0.4, 2.0],
	["ollama", "gemma4:31b", 0.12, 0.37],
	["ollama", "glm-4.7", 0.4, 1.75],
	["ollama", "gpt-oss:120b", 0.039, 0.18],
	["ollama", "gpt-oss:20b", 0.029, 0.14],
	["ollama", "kimi-k2-thinking", 0.6, 2.5],
	["ollama", "mistral-large-3:675b", 0.5, 1.5],
	["ollama", "qwen3-coder-next", 0.11, 0.8],
	["ollama", "qwen3-coder:480b", 0.22, 1.8],

	// OpenCode Zen (big-pickle is stealth — no equivalent; V24 rows priced at
	// the OpenRouter paid variants, snapshot 2026-06-07)
	["opencode", "big-pickle", null, null],
	["opencode", "deepseek-v4-flash-free", 0.098, 0.197],
	["opencode", "mimo-v2.5-free", 0.14, 0.28],
	["opencode", "minimax-m3-free", 0.3, 1.2],
	["opencode", "nemotron-3-super-free", 0.09, 0.45],
	["opencode", "nemotron-3-ultra-free", 0.5, 2.5],

	// OpenRouter :free pools (priced at the same model's paid variant)
	// V23 additions snapshot the OpenRouter pricing API on 2026-06-07.
	[
		"openrouter",
		"cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
		null,
		null,
	], // free-only route
	["openrouter", "google/gemma-4-26b-a4b-it:free", 0.06, 0.33],
	["openrouter", "google/gemma-4-31b-it:free", 0.12, 0.37],
	["openrouter", "meta-llama/llama-3.2-3b-instruct:free", 0.05, 0.34],
	["openrouter", "moonshotai/kimi-k2.6:free", 0.684, 3.42],
	["openrouter", "nvidia/nemotron-3-ultra-550b-a55b:free", 0.5, 2.5],
	["openrouter", "nvidia/nemotron-nano-12b-v2-vl:free", null, null], // no paid variant listed
	// LFM 2.5 1.2B has no paid listing; tiny-model estimate
	["openrouter", "liquid/lfm-2.5-1.2b-instruct:free", 0.01, 0.04],
	["openrouter", "liquid/lfm-2.5-1.2b-thinking:free", 0.01, 0.04],
	["openrouter", "meta-llama/llama-3.3-70b-instruct:free", 0.1, 0.32],
	["openrouter", "nousresearch/hermes-3-llama-3.1-405b:free", 1.0, 1.0],
	["openrouter", "nvidia/nemotron-3-nano-30b-a3b:free", 0.05, 0.2],
	[
		"openrouter",
		"nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
		0.05,
		0.2,
	],
	["openrouter", "nvidia/nemotron-3-super-120b-a12b:free", 0.09, 0.45],
	["openrouter", "nvidia/nemotron-nano-9b-v2:free", 0.04, 0.16],
	["openrouter", "openai/gpt-oss-120b:free", 0.039, 0.18],
	["openrouter", "openai/gpt-oss-20b:free", 0.029, 0.14],
	["openrouter", "openrouter/owl-alpha", null, null], // stealth
	["openrouter", "poolside/laguna-m.1:free", null, null],
	["openrouter", "poolside/laguna-xs.2:free", null, null],
	["openrouter", "qwen/qwen3-coder:free", 0.22, 1.8],
	["openrouter", "qwen/qwen3-next-80b-a3b-instruct:free", 0.09, 1.1],
	["openrouter", "z-ai/glm-4.5-air:free", 0.125, 0.85],
	// legacy ids
	["openrouter", "deepseek/deepseek-v3.1:free", 0.21, 0.79],
	["openrouter", "moonshotai/kimi-k2:free", 0.57, 2.3],

	// Pollinations (serves gpt-oss-20b)
	["pollinations", "openai-fast", 0.029, 0.14],

	// SambaNova rows were removed in V23 (platform dropped — free tier retired).

	// Zhipu (4.5-flash estimated at the 4.7-flash rate — no paid 4.5-flash;
	// 4.6v-flash priced at OpenRouter's paid z-ai/glm-4.6v)
	["zhipu", "glm-4.5-flash", 0.06, 0.4],
	["zhipu", "glm-4.6v-flash", 0.3, 0.9],
	["zhipu", "glm-4.7-flash", 0.06, 0.4],
];

/** Fallback $/M for models with no mapping (custom endpoints, stealth). */
export const FALLBACK_INPUT_PER_M = 0.2;
export const FALLBACK_OUTPUT_PER_M = 0.8;

/**
 * Adds the pricing columns (idempotent) and refreshes prices for every
 * known model. Runs on every boot — it's ~100 UPDATEs in one transaction
 * and keeps prices current when this map is updated in a release.
 */
export function applyModelPricing(db: Database.Database): void {
	const columns = db.prepare("PRAGMA table_info(models)").all() as {
		name: string;
	}[];
	if (!columns.some((c) => c.name === "paid_input_per_m")) {
		db.prepare("ALTER TABLE models ADD COLUMN paid_input_per_m REAL").run();
	}
	if (!columns.some((c) => c.name === "paid_output_per_m")) {
		db.prepare("ALTER TABLE models ADD COLUMN paid_output_per_m REAL").run();
	}

	const update = db.prepare(`
    UPDATE models SET paid_input_per_m = ?, paid_output_per_m = ?
    WHERE platform = ? AND model_id = ?
  `);
	const applyAll = db.transaction(() => {
		for (const [platform, modelId, input, output] of MODEL_PRICING) {
			update.run(input, output, platform, modelId);
		}
	});
	applyAll();
}
