# Decisions

## 1. AI Provider

The production service uses an external AI provider through an API key stored in an environment variable.

The AI provider is isolated behind an `AiProvider` interface so that production can use a real provider while automated tests use a fake provider.

Tests never call the real AI service.

---

## 2. Customer Text Is Untrusted

Ticket subject and body are treated strictly as customer-provided data.

Instructions contained inside customer text are not treated as system instructions.

The AI prompt explicitly separates system instructions from customer ticket content, and the application independently validates the AI result.

---

## 3. AI Output Is Not Trusted Automatically

Every AI response passes through an independent checker before it becomes authoritative ticket state.

The checker validates:

- required fields
- allowed category values
- allowed priority values
- summary format
- summary length
- enterprise priority requirements

If the checker is uncertain, the ticket is sent to manual review.

---

## 4. AI Failure or Timeout

If the AI provider:

- fails
- times out
- returns an empty response
- returns malformed output
- produces an unusable result

the ticket is still saved.

The ticket is marked for `manual_review` rather than causing the service to fail.

---

## 5. 200 ms Requirement

The brief requires `POST /tickets` to respond within 200 ms including the AI step.

An external AI API cannot be guaranteed to respond within a fixed 200 ms budget under all network and provider conditions.

Decision:

- enforce a strict AI timeout
- never allow a slow AI request to block the service indefinitely
- save the ticket and mark it for manual review when the AI exceeds the timeout
- measure and monitor actual request latency

The 200 ms requirement is therefore treated as a target/budget rather than an unconditional guarantee.

---

## 6. Duplicate external_id

`external_id` uniquely identifies an incoming ticket.

The database enforces uniqueness so that duplicate requests cannot create two tickets even if requests arrive concurrently.

Application-level checks are used for a clear response, but the database constraint is the final protection.

---

## 7. Same Problem

Tickets from the same customer received within a short time window may represent the same underlying problem.

The service compares normalized ticket content and uses a limited time window.

If a new ticket is determined to represent the same problem, it is linked to the first ticket using `parent_ticket_id`.

The exact similarity threshold will be implemented and tested as part of the ticket-ingestion logic.

---

## 8. Enterprise Priority

Enterprise tickets must be at least P1.

P0 and P1 satisfy this rule.

P2 and P3 do not.

If the AI assigns an enterprise ticket P2 or P3, the checker does not silently change the AI result. It sends the ticket to manual review.

---

## 9. SLA Deadline

SLA deadlines are calculated from the ticket's `created_at` time.

Priority determines the allowed response time:

- P0: 1 hour
- P1: 4 hours
- P2: 24 hours
- P3: 72 hours

If priority is changed later, the deadline is recalculated using the ticket's original `created_at` and the new priority.

---

## 10. Agent Claims

Claiming a ticket must be atomic.

If two agents attempt to claim the same unclaimed ticket concurrently, the database operation must allow only one claim to succeed.

The losing request receives a clear conflict response.

---

## 11. Ticket Status

Allowed transitions are:

- `open` → `in_progress`
- `in_progress` → `resolved`
- `resolved` → `open`

All other transitions are rejected.

---

## 12. Pagination

Ticket listing will use cursor-based pagination rather than offset pagination.

The cursor will use stable ordering so that tickets arriving while an agent is paging through results do not cause duplicates or missed records.

---

## 13. Empty Ticket Content

An empty subject/body is not rejected solely by request validation.

The assignment intentionally provides an empty ticket as test data, so the system should preserve it and allow the AI/checker workflow to determine whether it can be classified safely.

If the AI cannot reliably classify it, it goes to manual review.

---

## 14. Invalid Customer Plan

Only these plans are accepted:

- free
- pro
- enterprise

An unknown plan such as `platinum` is rejected as invalid input.

---

## 15. AI Token Usage

The service records token usage returned by the AI provider for each AI classification attempt when available.

This allows AI usage and cost to be monitored after deployment.

---

## 16. Test AI

Automated tests use a fake AI provider.

The fake provider returns deterministic classifications so tests do not depend on:

- network availability
- AI provider availability
- model changes
- API costs
- nondeterministic model responses

At least one test verifies automatic acceptance and another verifies manual review.

---

## 17. Launch Monitoring

After launch, I would monitor:

- AI request latency
- AI timeout rate
- AI failure rate
- percentage of tickets sent to manual review
- distribution of predicted categories
- distribution of predicted priorities
- agent corrections to AI classifications
- SLA breaches
- SLA at-risk tickets
- AI token usage/cost

A particularly useful quality signal would be how often agents change an AI classification after manual review.

---

## 18. Time Constraints

The implementation prioritizes:

1. correct ticket ingestion
2. safe AI handling
3. independent AI checking
4. concurrency correctness
5. SLA behavior
6. tests for important failure cases

Lower-priority enhancements may be skipped if they cannot be completed without reducing correctness or test coverage.

---

## 19. AI/Tool Mistakes

During development, any incorrect suggestion from an AI assistant or development tool will be verified against the assignment requirements, compiler, tests, and runtime behavior before being accepted.

An example of such a mistake will be recorded here before submission if one materially affects implementation.