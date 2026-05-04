## Problem Statement

As tenants scale their SalesPilot bots, managing 100+ automated response rules becomes increasingly difficult. The current architecture separates rules into "Global" and "Custom", which creates a rigid, unsafe environment where backend updates to global rules can unexpectedly alter a tenant's bot behavior. Furthermore, the UI relies on simple grouping (or accordions) which fails to scale, causing navigation friction. There is also no robust feedback loop for unanswered questions, no safe way to bulk-translate rules into local languages (Sinhala/Tamil) without risking AI hallucinations, and no environment to safely test how overlapping rules will react before deploying them to real customers.

## Solution

Rule Management 2.0 overhauls the architecture to support enterprise-scale rule management. "Global rules" will be deprecated in favor of a "Template Library" that businesses clone and own. The UI will shift to an "Inbox-style" Data Table with custom categories/tags for seamless filtering. To plug knowledge gaps, an "Unanswered Questions" inbox will allow tenants to convert AI failures directly into new rules. For bilingual support, visual badges will warn of missing translations, allowing single-click AI translation or a safe, "Review-and-Approve" bulk translation flow. Finally, a Sandbox Simulator will be introduced to test overlapping rules, while backend conflict resolution will leverage the Gemini LLM to synthesize multi-rule answers (deducting from the Premium AI quota).

## User Stories

1. As a tenant, I want to copy predefined rule templates into my account, so that I can quickly set up my bot without writing rules from scratch.
2. As a tenant, I want full ownership of my copied templates, so that platform-wide updates don't unexpectedly change my bot's behavior.
3. As a tenant, I want to categorize my rules using custom text tags (e.g., "Shipping", "Refunds"), so that I can organize them according to my specific business niche.
4. As a tenant, I want to view my rules in a paginated, searchable data table with a category sidebar, so that I can easily navigate 100+ rules.
5. As a tenant, I want to see an "Unanswered Questions" inbox, so that I know exactly what my bot failed to answer.
6. As a tenant, I want to click "Create Rule" on an unanswered question, so that I can instantly plug knowledge gaps with the exact keywords the customer used.
7. As a tenant, I want the bot to intelligently merge multiple rules if my customer asks a multi-part question, so that the customer gets a natural, complete answer.
8. As a tenant, I want to test my rules in a Sandbox Simulator, so that I can see exactly how the bot will respond and whether it costs a System or AI token before it goes live.
9. As a tenant, I want to see a warning badge on rules that are missing translations for my supported languages, so that I can ensure my bilingual customers get localized responses.
10. As a tenant, I want to click an "Auto-Translate" wand on a single rule, so that AI can instantly translate the English response into natural Sinhala/Tamil.
11. As a tenant, I want to bulk-translate missing rules using a Review Modal, so that I can verify the AI translations are accurate before saving them to production.
12. As a platform admin, I want multi-rule synthesization to count as an AI Message, so that complex LLM processing is properly monetized.

## Implementation Decisions

- **Data Model Changes**: 
  - Drop the concept of Global Rules (`BusinessID = NULL` acting globally).
  - Add a `Category` string field to the `models.Rule` struct.
  - Create a new `models.RuleTemplate` struct (or adapt Global rules to be strictly seed data) to serve as the Template Library.
- **UI Architecture**: 
  - Deprecate accordions. Implement `shadcn/ui` Data Table with pagination, search, and a side-navigation menu for Category filtering.
- **Conflict Resolution**: 
  - Update `pipeline.go` (specifically `matchFAQ` and Semantic Search). If multiple rules return high confidence, feed the top 3 into the Gemini LLM to synthesize the final response, returning `true` for `isAI` to ensure it deducts from the AI quota.
- **Embedding Generation**: 
  - Embeddings will continue to be generated synchronously during the HTTP Request to ensure immediate UI feedback.
  - Generate 1 common embedding per rule by concatenating `Keywords` + `English Response`. The vector math will naturally handle cross-lingual queries.
- **Bilingual Prompts**: 
  - The Auto-Translate backend endpoint will use a strict system prompt enforcing natural, culturally contextual translations rather than word-for-word literal translations.

## Testing Decisions

- **What Makes a Good Test**: Tests should verify the external behavior of the rule endpoints and pipeline logic, not the internal state of the DB or internal helper functions.
- **Modules to Test**:
  - `Rule Management API`: Verifying CRUD operations, category assignment, and template cloning.
  - `Pipeline Conflict Resolution`: Mocking the LLM response to ensure multiple high-confidence rules trigger the synthesis branch and are correctly billed as AI Messages.
  - `Auto-Translate Endpoint`: Verifying it returns localized strings and doesn't mutate existing languages.
- **Prior Art**: Refer to `pipeline_test.go` and `intent_scorer_test.go` for existing patterns on mocking Gemini and evaluating confidence score logic.

## Out of Scope

- Fully asynchronous background queues for rule embedding (sticking to synchronous + UI Progress Bar for MVP).
- Auto-saving bulk translations without human review.
- Allowing customers to upload custom embedding vectors.

## Further Notes

- The Sandbox Simulator requires a new backend route `POST /api/business/simulate` that imports `pipeline.go` logic but skips the final Meta HTTP request.
