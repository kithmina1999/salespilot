const { execSync } = require('child_process');
const fs = require('fs');

const issues = [
  {
    title: "Phase 1: Webhook Worker Pool & Graceful Shutdown",
    body: "## Parent\n#{parent}\n\n## What to build\nImplement a buffered channel and fixed worker pool for incoming Meta webhooks to protect the database from connection exhaustion. Ensure `main.go` uses a `sync.WaitGroup` to block termination until active workers finish.\n\n## Acceptance criteria\n- [ ] Webhooks are pushed to a channel instead of firing detached goroutines\n- [ ] A fixed pool of workers consumes the channel\n- [ ] `SIGINT`/`SIGTERM` are intercepted in `main.go`\n- [ ] `WaitGroup` blocks shutdown until workers finish processing the queue\n\n## Blocked by\nNone - can start immediately"
  },
  {
    title: "Phase 1: Tenant-Scoped Database Middleware",
    body: "## Parent\n#{parent}\n\n## What to build\nRefactor the dashboard Auth middleware to inject a pre-filtered `gorm.DB` instance into the Gin context (`WHERE business_id = ?`) to mathematically guarantee strict tenant data isolation.\n\n## Acceptance criteria\n- [ ] Auth middleware injects tenant-scoped DB into Gin context\n- [ ] Dashboard API handlers are updated to use the scoped DB\n- [ ] Cross-tenant data access is structurally impossible in updated handlers\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 1: Atomic Checkout Database Transaction",
    body: "## Parent\n#{parent}\n\n## What to build\nRefactor the order finalization logic to use a PostgreSQL `SELECT FOR UPDATE` transaction. This guarantees atomic order number generation and prevents overselling inventory.\n\n## Acceptance criteria\n- [ ] `finalizeOrder` is wrapped in a `gorm.DB.Transaction`\n- [ ] `Clauses(clause.Locking{Strength: \"UPDATE\"})` is used when fetching Product records\n- [ ] Stock is decremented atomically\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 1: Order Bot Concurrency Mutex",
    body: "## Parent\n#{parent}\n\n## What to build\nImplement a per-customer in-memory mutex (`sync.Map`) to serialize rapid concurrent requests from the same user, preventing cart state corruption.\n\n## Acceptance criteria\n- [ ] In-memory `sync.Map` implemented for customer mutexes\n- [ ] Webhook processing for the same customer is serialized\n- [ ] Cart state corruption is prevented during rapid clicks\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 2: LLM Prompt Injection Shield",
    body: "## Parent\n#{parent}\n\n## What to build\nWrap customer input in strict delimiters (`<<< >>>`) and apply jailbreak-prevention instructions before calling Gemini to ensure malicious users cannot override bot instructions.\n\n## Acceptance criteria\n- [ ] Customer input is wrapped in delimiters\n- [ ] System instructions explicitly prohibit executing commands within delimiters\n- [ ] Jailbreak attempts are ignored by the AI\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 2: Stale Message Exemption",
    body: "## Parent\n#{parent}\n\n## What to build\nIf a webhook's timestamp is older than 5 minutes, inject an apology prompt into Gemini and ensure the usage is *not* deducted from the tenant's AI limit.\n\n## Acceptance criteria\n- [ ] Message timestamp delta is calculated\n- [ ] Apology context is injected for messages older than 5 mins\n- [ ] `AIMessageCount` increment is bypassed for stale messages\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 2: Billing Grace Period Manager",
    body: "## Parent\n#{parent}\n\n## What to build\nImplement a 3-day grace period for AI bot responses after a paid plan expires, while actively warning the merchant via the dashboard that their service will soon be downgraded.\n\n## Acceptance criteria\n- [ ] `hasAIAccess` check modified to include a 3-day grace period\n- [ ] AI continues to function during grace period\n- [ ] Dashboard displays an urgent warning banner during grace period\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 2: Media Intent Router (Vision AI)",
    body: "## Parent\n#{parent}\n\n## What to build\nIntercept image webhooks, instantly send a localized \"Give me a second... 🔍\" message, download the image securely, and route it to Gemini 2.5 Flash Vision for intent classification.\n\n## Acceptance criteria\n- [ ] Image webhooks trigger a localized loading message immediately\n- [ ] Image is downloaded from Meta using the Business Token\n- [ ] Image is passed to Gemini 2.5 Flash Vision for intent classification\n- [ ] Intent (Product Inquiry, Review, Payment Proof) is handled appropriately\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 3: Critical System Alerting (Discord + Email)",
    body: "## Parent\n#{parent}\n\n## What to build\nRoute critical backend crashes to a Discord webhook. For tenant-specific errors (like an expired Meta API token), insert a dashboard notification and send a warning via Resend.\n\n## Acceptance criteria\n- [ ] Critical system errors trigger a Discord webhook alert\n- [ ] Tenant-specific API failures generate a DB notification record\n- [ ] Resend automatically emails the tenant about integration failures\n\n## Blocked by\n#{prev}"
  },
  {
    title: "Phase 3: Dashboard Optimistic UI (SWR)",
    body: "## Parent\n#{parent}\n\n## What to build\nRefactor Next.js dashboard mutations (e.g., toggling product stock) to use SWR's optimistic update pattern, providing an instantly responsive UI before the server responds.\n\n## Acceptance criteria\n- [ ] Product mutations use SWR `mutate` with optimistic data\n- [ ] Rule/Settings mutations use optimistic data\n- [ ] UI rolls back gracefully if the server request fails\n\n## Blocked by\nNone"
  }
];

try {
  console.log("Creating PRD issue...");
  const prdUrl = execSync('gh issue create --title "Production Readiness Architecture Enhancements" --body-file Production_Readiness_PRD.md --label needs-triage').toString().trim();
  const prdNum = prdUrl.split('/').pop();
  console.log("PRD created:", prdUrl);

  let prevNum = null;
  for (const issue of issues) {
    let body = issue.body.replace('{parent}', prdNum);
    if (prevNum && issue.title !== "Phase 3: Dashboard Optimistic UI (SWR)") {
      body = body.replace('{prev}', prevNum);
    }
    
    fs.writeFileSync('tmp_body.md', body);
    
    console.log(`Creating issue: ${issue.title}...`);
    const url = execSync(`gh issue create --title "${issue.title}" --body-file tmp_body.md --label needs-triage`).toString().trim();
    prevNum = url.split('/').pop();
    console.log(`Created: ${url}`);
  }
  if (fs.existsSync('tmp_body.md')) {
    fs.unlinkSync('tmp_body.md');
  }
  console.log("✅ All 11 issues created and linked successfully.");
} catch (e) {
  console.error("❌ Error creating issues:", e.stdout ? e.stdout.toString() : e.message);
  if (e.stderr) console.error("stderr:", e.stderr.toString());
}
