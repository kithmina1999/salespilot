# 🔍 Issue Diagnosis: "Invalid or missing API key" in WhatsApp Bot

## Problem
When a customer asks the WhatsApp bot for the Product List, the bot returns an **"Invalid or missing API key"** error instead of the actual products.

## Root Cause

The OpenClaw agent's skills (e.g. `search-products`, `get-product-details`) use **`$API_KEY`** as a shell variable in their `curl` commands:

```bash
curl -X GET "$API_BASE_URL/api/products" -H "X-API-Key: $API_KEY"
```

**The problem is that OpenClaw is sending the literal string `$API_KEY` instead of resolving it to the actual key value** (`AIzaSyAK3bfWREGQxxKvSXI4eFtD9FHAxyxP4Eo`). This causes the middleware in [auth.go](file:///c:/Users/rkksg/Documents/golang-projects/openclaw-sale-agent-bot-whatsapp/middleware/auth.go) to reject the request with `401 Unauthorized`.

## Evidence

### ❌ With literal `$API_KEY` → Fails
![API returns "Invalid or missing API key" when using literal $API_KEY](C:\Users\rkksg\.gemini\antigravity\brain\b94280eb-88e8-40ec-ae61-4457de842d59\api_invalid_key_error_1774281098838.png)

### ✅ With actual key value → Works
![API returns products successfully with the real key](C:\Users\rkksg\.gemini\antigravity\brain\b94280eb-88e8-40ec-ae61-4457de842d59\api_success_response_1774281130040.png)

## Configuration Verified

| File | `API_KEY` value | Status |
|------|----------------|--------|
| [.env](file:///c:/Users/rkksg/Documents/golang-projects/openclaw-sale-agent-bot-whatsapp/.env) | `AIzaSyAK3bfWREGQxxKvSXI4eFtD9FHAxyxP4Eo` | ✅ Set correctly |
| `~/.openclaw/openclaw.json` | `AIzaSyAK3bfWREGQxxKvSXI4eFtD9FHAxyxP4Eo` | ✅ Set correctly |
| [openclaw/openclaw.json](file:///c:/Users/rkksg/.openclaw/openclaw.json) | `AIzaSyAK3bfWREGQxxKvSXI4eFtD9FHAxyxP4Eo` | ✅ Set correctly |
| Go server ([config.go](file:///c:/Users/rkksg/Documents/golang-projects/openclaw-sale-agent-bot-whatsapp/config/config.go)) | Reads from env, fallback: `stylebot-dev-key-2024` | ✅ Loads correctly |
| API server (health check) | — | ✅ Running on port 8080 |

> [!IMPORTANT]
> The keys are all configured correctly. The issue is that **OpenClaw is not substituting `$API_KEY` with its actual value** when the agent executes the `curl` commands from the skills.

## Likely Fix Options

1. **Check OpenClaw env variable resolution** — The [env](file:///c:/Users/rkksg/Documents/golang-projects/openclaw-sale-agent-bot-whatsapp/.env) section in [openclaw.json](file:///c:/Users/rkksg/.openclaw/openclaw.json) defines `API_KEY`, but OpenClaw may not be injecting it into the shell environment when running skill commands. Check if OpenClaw requires a different syntax (e.g., `{{API_KEY}}` or `${env.API_KEY}`) instead of `$API_KEY`.

2. **Hardcode the key in skills** (quick workaround) — Replace `$API_KEY` with the actual key value in each SKILL.md file. Not ideal but will work immediately.

3. **Check OpenClaw daemon status** — The `openclaw onboard --install-daemon` command has been running for a while. It may need to be restarted after config changes for the env vars to take effect.
