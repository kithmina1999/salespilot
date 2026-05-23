## Rule Management 2.0 (Epic)

### Vertical Slices (Tracer Bullets)
- [ ] **Slice 1: Database Foundation & Template Library** (Add Category to Rule, create RuleTemplate model, build /api/rules/clone-template endpoint)
- [ ] **Slice 2: The Rules Inbox Data Table** (Rip out accordions, implement shadcn Data Table with search, pagination, category sidebar)
- [ ] **Slice 3: Knowledge Gaps / Unanswered Questions** (Add UnmatchedMessage tab, Create Rule button to plug gaps)
- [ ] **Slice 4: Bilingual Badges & Single Rule Auto-Translate** (Table language badges, /api/rules/translate endpoint, Magic Wand UI button)
- [ ] **Slice 5: Bulk Review-and-Approve Translation** (Translate All Missing button, Side-by-side Review Modal)
- [ ] **Slice 6: Multi-Rule LLM Synthesis & Premium Billing** (Update pipeline to synthesize top 3 rules using Gemini, flag as AI message)
- [ ] **Slice 7: The Sandbox Simulator** (Build /api/business/simulate endpoint, Chat UI simulator next to rules table)

Please see `docs/prd-rule-management-v2.md` for the full Product Requirements Document.
