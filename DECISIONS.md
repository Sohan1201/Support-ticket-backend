Decisions

1. Scope and Technology

- Backend: Node.js + TypeScript + Express.
- Database: PostgreSQL with Prisma ORM.
- Validation: Zod.
- AI provider: OpenAI, configured through `OPENAI_API_KEY`.
- Tests: Vitest + Supertest.
- No frontend was implemented because the assignment is backend-focused.
- PostgreSQL runs through Docker Compose for reproducible local setup.

The implementation intentionally stays small and focused on the assignment requirements rather than adding infrastructure that is not required.

2. Duplicate External IDs

`external_id` is treated as an idempotency key.

A PostgreSQL UNIQUE constraint prevents the same external ID from being saved twice. A duplicate request is rejected rather than creating another ticket.

This is enforced at the database level rather than relying only on application-side checks, so concurrent requests cannot create duplicate records.

3. Same-Problem Tickets

The assignment says that tickets describing the same problem "within minutes" should link to the first ticket, but does not define either the exact time window or similarity method.

Decision:

- Same-problem window: 10 minutes.
- Same customer is required.
- Tickets are compared against earlier tickets in chronological order.
- Similarity uses normalized word overlap.
- A threshold of 0.30 was selected.
- The first matching earlier ticket becomes the parent.

This is deliberately deterministic and lightweight. Advanced semantic/vector similarity was not added because it would increase complexity without being necessary for the assignment.

The threshold was adjusted from 0.40 to 0.30 after testing the supplied SSO duplicate scenario.

4. AI 200 ms Requirement

The assignment requires the endpoint to respond within 200 ms including AI processing.

This is not fully controllable because external AI latency depends on the provider, network, account status, and model availability.

Decision:

- AI timeout is configurable through `AI_TIMEOUT_MS`.
- The current default is 150 ms, leaving some budget for application/database work.
- If AI times out, fails, or returns unusable output, the ticket is still saved and sent to `manual_review`.
- The service does not wait indefinitely for the AI provider.

### AI latency testing

We tested progressively up to approximately 400 ms. We could not continue testing to determine a reliable provider latency period because the OpenAI account had no remaining credits/tokens.

Therefore, 400 ms is **not** being claimed as an AI latency boundary or production benchmark.

A production deployment with a funded account should measure actual latency and tune `AI_TIMEOUT_MS` based on observed p95/p99 latency while preserving the endpoint's response-time requirement.

5. Customer Text Is Untrusted

Customer subject and body are treated strictly as ticket data.

The AI system prompt explicitly instructs the model not to follow instructions contained inside customer text.

Prompt-injection-like instructions are also detected independently by the checker and result in `manual_review`.

This protects against customer text attempting to alter the classification rules.

6. Independent AI Checker

The checker is separate from the AI classification step.

It validates:

- allowed category
- allowed priority
- summary presence
- summary length
- suspicious customer instructions
- enterprise priority rules
- category/ticket consistency
- insufficient ticket content

The checker can therefore reject an AI result even when the AI itself returned a syntactically valid response.

If there is uncertainty, the ticket goes to `manual_review`.

7. Enterprise Priority Rule

The assignment says enterprise customers must receive at least P1.

Decision:

- P0 and P1 are valid for enterprise customers.
- P2/P3 are flagged for manual review.
- The checker, rather than the AI, enforces this business rule.

This prevents the AI from overriding an explicit business requirement.

8. Invalid or Rubbish AI Output

AI output cannot be trusted merely because the provider returned a response.

AI output is validated before it is used.

Invalid structure, invalid enum values, missing/invalid fields, AI exceptions, or timeout conditions result in manual review rather than bringing down ticket creation.

AI failures are recorded in `ai_classifications` so that failures can be inspected later.

9. Empty Ticket

A ticket with both subject and body empty does not contain enough information for reliable classification.

Decision:

- Save the ticket.
- Do not reject the customer request merely because classification is impossible.
- Mark it `manual_review`.
- Record `insufficient_ticket_content`.

10. Seed Ticket Decisions

The supplied assignment scenarios are used as deterministic seed/test cases.

### T-1001

Enterprise customer with an SSO login failure.

Expected result:

- category: `account_access`
- priority: `P1`
- triage: `auto_accept`

### Duplicate T-1001

Same `external_id` as the first T-1001.

Expected result:

- rejected
- no second ticket saved

Reason: `external_id` is unique.

### T-1002

Enterprise customer with another SSO login failure four minutes after T-1001.

Expected result:

- classified as `account_access`
- priority `P1`
- linked to the earlier T-1001 ticket

Reason: same customer, same problem, within the selected 10-minute window.

### T-1003

Contains a prompt-injection instruction attempting to force a P0/billing classification.

Expected result:

- `manual_review`

Reason: customer instructions are untrusted and suspicious instructions must not override classification rules.

### T-1004

Spanish duplicate-billing/refund complaint.

Expected result:

- category: `billing`
- priority: `P2`
- `auto_accept`

Spanish billing/refund terms are included in the deterministic checker so the supplied scenario is not incorrectly treated as unrelated text.

### T-1005

Empty subject and body.

Expected result:

- `manual_review`

Reason: insufficient ticket content.

### T-1006

Uses customer plan `platinum`.

Expected result:

- rejected before normal ticket creation

Reason: the assignment's API contract only allows `free`, `pro`, and `enterprise`.

The seed records this as a rejected invalid input rather than weakening the API contract to permit an unsupported plan.

### T-1007

Free customer reporting a missing password-reset email with urgent wording.

Expected result:

- category: `account_access`
- priority: `P1`
- `auto_accept`

11. SLA Calculation

SLA durations:

- P0: 1 hour
- P1: 4 hours
- P2: 24 hours
- P3: 72 hours

The deadline is calculated from the ticket's original `created_at`.

If an agent changes priority during manual review, the deadline is recalculated using the original creation time and the new priority's SLA duration.

This behavior was not explicitly defined by the assignment, so it is documented here rather than left implicit.

12. SLA Statistics

`GET /stats` considers active unresolved tickets.

For each priority:

- `late`: current time is past the SLA deadline.
- `at_risk`: less than 20% of the total SLA time remains.
- `on_track`: neither late nor at risk.

Resolved tickets are excluded from active SLA statistics.

13. Status Transitions

Only these transitions are permitted:

```text
open -> in_progress
in_progress -> resolved
resolved -> open
Other transitions are rejected.

When a ticket becomes resolved, resolved_at is recorded. Reopening clears the resolved timestamp.

14. Concurrent Claims

Ticket claiming must be safe when two agents attempt to claim the same ticket simultaneously.

The claim operation uses an atomic database update requiring:

ticket is still open
claimed_by is still null

Only the request that successfully updates the row wins.

The other request receives a conflict response.

This avoids a check-then-update race condition.

15. Manual Triage Changes

Agents may change category and/or priority only when the ticket is already marked manual_review.

A written reason is mandatory.

After the agent resolves the manual-review decision, the ticket's triage decision becomes auto_accept because the classification has now been explicitly reviewed by an agent.

A ticket that was already automatically accepted cannot be changed through the manual-triage endpoint.

16. Pagination

The ticket list uses cursor pagination rather than offset pagination.

Ordering is:

created_at DESC
id DESC

The cursor contains both values.

This gives a stable traversal order when new tickets are created while an agent is paging through results and avoids the duplicate/missing-row behavior that can occur with offset pagination.

17. Filters

GET /tickets supports:

status
priority
category
triage decision

A maximum page size is enforced to avoid unnecessarily large responses.

18. AI Token Usage

AI token usage is stored with each AI classification when supplied by the provider.

This provides a basis for monitoring AI cost and usage after launch.

19. AI Failure and Service Availability

The ticket endpoint must remain usable even when AI is unavailable.

The service therefore treats AI as a classification dependency rather than a dependency for ticket persistence.

If AI fails or times out:

the ticket remains saved;
the failed AI attempt is recorded;
the ticket is placed into manual_review;
the API does not require a successful AI response to persist the ticket.
20. What We Deliberately Did Not Build

The following were not implemented because they were outside the assignment's core scope or would add complexity without improving the required behavior:

frontend/UI
authentication/authorization
Redis
message queues
Kubernetes
background workers
vector database
advanced semantic duplicate detection
production observability infrastructure
automated email/Slack notifications
full production deployment infrastructure

The assignment emphasizes a small, correct backend over a larger incomplete system.

21. Launch Monitoring for AI Sorting

For a real launch, the following should be monitored:

AI success/failure rate
AI timeout rate
AI latency, especially p95/p99
token usage/cost
percentage of tickets sent to manual review
checker rejection rate
category distribution
priority distribution
disagreement between AI output and agent corrections
SLA breaches by priority

Agent corrections should be reviewed periodically to identify systematic AI classification errors.

22. Testing Strategy

Tests use fake AI providers so they do not depend on external AI availability or consume API credits.

The important failure paths covered include:

normal auto-accept
enterprise priority violation
suspicious prompt injection
empty ticket
Spanish billing classification
category mismatch
same-problem linking
concurrent claiming
manual-review triage correction
invalid manual-review update
status/list/stats behavior through local testing

The full test suite is intended to remain deterministic and runnable without an OpenAI API key.

23. A Poor Suggestion We Corrected

During development, a suggestion was made to add GET /tickets/:id.

After checking the assignment requirements again, we found that this endpoint was not required.

It was removed rather than adding unnecessary API surface.

This reinforced the decision to use the assignment PDF as the source of truth and to avoid implementing features simply because they appear useful.

24. What Was Skipped Because of Time

The implementation prioritized:

correct ticket creation
AI/checker safety
duplicate handling
concurrency
agent workflows
pagination
SLA tracking
deterministic tests
required documentation

Additional production-grade infrastructure was intentionally skipped rather than leaving required functionality incomplete.

25. If One More Week Were Available

The next improvements would be:

run latency/load testing against a funded AI account;
add production observability and alerting;
improve duplicate detection with semantic similarity;
add authentication and agent authorization;
add a dedicated test database/environment;
add broader API integration/load tests;
add deployment and CI/CD;
investigate AI/agent disagreement data to improve the checker.

These are follow-up improvements, not prerequisites for the assignment's core backend.

26. Final Principle

When the assignment leaves behavior unspecified, the implementation chooses a deterministic, explainable rule and documents it.

When AI is uncertain, slow, unavailable, or suspicious, the system prefers manual review over silently trusting an unreliable classification.

The implementation prioritizes correctness, safety, concurrency behavior, and explainability over unnecessary system complexity.
