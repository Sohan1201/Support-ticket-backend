DECISIONS

1. Scope and technology

The project uses Node.js, TypeScript, Express, PostgreSQL, Prisma, Zod, OpenAI, Vitest/Supertest and Docker Compose.

The implementation was kept small and focused on the assignment instead of adding unnecessary infrastructure or features.

2. Duplicate tickets

external_id is treated as an idempotency key and is UNIQUE in PostgreSQL. A duplicate external_id is rejected, including when concurrent requests occur.

3. Same-problem tickets

The assignment says tickets describing the same problem within "a few minutes" should be linked, but does not define the exact window or similarity method.

Decision:
- 10-minute window
- Same customer required
- Compare against earlier tickets
- Normalize text and use word-overlap similarity
- Threshold: 0.30
- Link to the first matching earlier ticket

This was chosen because it is deterministic and explainable. Advanced semantic/vector similarity was not added. The threshold was reduced from 0.40 to 0.30 after testing the supplied SSO scenario.

4. AI response time

The assignment requires POST /tickets to respond within 200 ms including AI.

External AI latency cannot be fully controlled, so AI_TIMEOUT_MS is configurable and defaults to 150 ms. If AI is slow, fails, or returns unusable output, the ticket is still saved and sent to manual review.

We tested progressively up to approximately 400 ms. We could not continue testing to determine the right time period because the OpenAI account had no remaining credits/tokens. Therefore, 400 ms is not claimed as a provider latency limit or production benchmark. A funded production account should be used to measure actual latency and tune the timeout.

5. Customer text and AI safety

Customer subject and body are untrusted data. The AI is explicitly instructed not to follow instructions contained in customer text.

The checker independently looks for suspicious prompt-injection instructions and sends those tickets to manual review.

The checker is separate from the AI and validates:
- allowed category and priority
- summary presence and maximum length
- enterprise priority rules
- whether the classification matches the ticket
- insufficient ticket content
- suspicious customer instructions

If the checker is uncertain, the ticket goes to manual review.

6. Enterprise priority

Enterprise tickets must be at least P1.

P0 and P1 are therefore acceptable. P2 and P3 are sent to manual review. This rule is enforced by the checker rather than being left to the AI.

7. AI failure and rubbish output

AI failure, timeout, invalid output, or other unusable results must not bring down the service.

The ticket is saved, the AI attempt is recorded, and the ticket is marked manual_review.

8. Empty tickets

A ticket with both subject and body empty is still saved but marked manual_review with insufficient_ticket_content.

9. Seed ticket outcomes

T-1001:
Enterprise SSO login failure.
Result: account_access, P1, auto_accept.

Duplicate T-1001:
Rejected because external_id is already present.

T-1002:
Another SSO failure from the same customer four minutes later.
Result: account_access, P1, auto_accept, linked to T-1001.

T-1003:
Contains instructions attempting to force P0/billing classification.
Result: manual_review because customer instructions are untrusted.

T-1004:
Spanish duplicate billing/refund complaint.
Result: billing, P2, auto_accept. Spanish billing/refund terms are handled by the checker.

T-1005:
Empty subject and body.
Result: manual_review because there is insufficient information.

T-1006:
Uses unsupported customer plan "platinum".
Result: rejected before normal ticket creation because the API only accepts free, pro and enterprise.

T-1007:
Missing password-reset email with urgent wording.
Result: account_access, P1, auto_accept.

10. SLA

SLA durations:
P0 = 1 hour
P1 = 4 hours
P2 = 24 hours
P3 = 72 hours

The deadline is calculated from the original created_at.

If priority changes after arrival, the deadline is recalculated from the original created_at using the new priority's SLA. This was left unspecified by the assignment, so the behavior is explicitly documented here.

GET /stats reports late, at-risk and on-track tickets for each priority. Resolved tickets are excluded.

11. Agent behaviour

Allowed status transitions are:

open -> in_progress
in_progress -> resolved
resolved -> open

Other transitions are rejected.

Claiming uses an atomic database update requiring the ticket to still be open and unclaimed. Therefore, when two agents claim simultaneously, only one succeeds.

Manual triage changes are allowed only for tickets in manual_review. A written reason is required. After an agent resolves the review, the triage decision becomes auto_accept.

12. Pagination

GET /tickets uses cursor pagination.

Results are ordered by created_at DESC and id DESC, and both values are included in the cursor. This provides stable traversal when new tickets arrive and avoids the duplicate/missing-row problems associated with offset pagination.

Filters are provided for status, priority, category and triage_decision.

13. AI usage and monitoring

AI token usage is recorded when provided by the AI service.

After launch, we would monitor:
- AI success/failure rate
- timeout rate
- latency, especially p95/p99
- token usage and cost
- manual-review rate
- checker rejection rate
- category and priority distribution
- disagreement between AI classifications and agent corrections
- SLA breaches

Agent corrections should be reviewed to identify recurring AI classification problems.

14. Testing

Tests use a fake AI and never depend on the real AI service or API credits.

The important cases covered include:
- accepted AI classifications
- manual review
- enterprise priority violations
- prompt injection
- empty tickets
- Spanish billing
- category mismatch
- same-problem linking
- concurrent claims
- manual triage changes
- invalid manual triage requests