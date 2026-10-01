DECISIONS

1. Unclear, clashing and unrealistic points

The assignment leaves a few important details open, so the following decisions were made:

- Same-problem tickets: "within a few minutes" was not defined. We chose a 10-minute window, require the same customer, and use normalized word-overlap similarity with a 0.30 threshold. The first matching ticket becomes the parent. The threshold was changed from 0.40 to 0.30 after testing the supplied SSO example.
- 200 ms response time: the requirement includes the external AI call, whose latency cannot be fully controlled. We use a configurable AI_TIMEOUT_MS value, with a default of 150 ms. If AI is slow or fails, the ticket is still saved and sent to manual review.
- AI latency testing: we tested progressively up to approximately 400 ms. We could not continue testing to determine the right time period because the OpenAI account had no remaining credits/tokens. Therefore, 400 ms is not treated as a provider latency limit or production benchmark. With a funded account, actual latency should be measured and the timeout adjusted accordingly. Thus not all tickets will go to manual review.
- Enterprise priority: enterprise tickets must be at least P1, so P0 and P1 are accepted while P2/P3 require manual review.
- Priority changes and SLA: the assignment does not specify what happens to the deadline after a priority change. We recalculate the deadline from the original created_at using the new priority's SLA.
- New tickets during pagination: offset pagination could cause duplicates or missed tickets. We use cursor pagination ordered by created_at and id.
- Invalid customer plan: the API only allows free, pro and enterprise, so the supplied platinum ticket is rejected rather than weakening the API contract.
- Customer text: customer content is untrusted and must not be allowed to change the AI's instructions or business rules.
- AI or checker failure: if the AI or checker fails, is too slow, or produces unusable output, the service must continue running and the ticket must be saved for manual review.
- Empty ticket: a ticket with no subject or body is saved but sent to manual review because there is not enough information to classify it unreliably.

2. What happens to each test ticket

T-1001:
Enterprise SSO login failure.
Result: account_access, P1, auto_accept.

Duplicate T-1001:
Rejected because the same external_id has already been saved.

T-1002:
Another SSO login failure from the same customer four minutes later.
Result: account_access, P1, auto_accept, linked to T-1001 because it matches the same-problem rule,T-1001 becpomes the parent ticket.

T-1003:
Contains instructions attempting to force the classification to P0 and billing.
Result: manual_review because customer instructions are untrusted and the content is suspicious.

T-1004:
Spanish duplicate billing/refund complaint.
Result: billing, P2, auto_accept. Spanish billing and refund terms are handled by the checker.

T-1005:
Empty subject and body.
Result: manual_review because there is insufficient information.

T-1006:
Uses the unsupported customer plan "platinum".
Result: rejected before normal ticket creation because only free, pro and enterprise are allowed.

T-1007:
Missing password-reset email with urgent wording.
Result: account_access, P1, auto_accept.

3. Where the service refuses to follow the AI, and why

The AI is not treated as the final authority.

The service refuses or overrides an AI result when:

- The output is incomplete, malformed, or uses values outside the allowed category or priority values.
- The summary is missing or exceeds 25 words.
- The AI result does not match the ticket content.
- The ticket contains suspicious instructions attempting to influence the classification.
- An enterprise ticket is classified below P1.
- The ticket does not contain enough information to classify it reliably.
- The AI times out, fails, or returns unusable output.

In these cases the ticket is saved and marked manual_review rather than allowing an unreliable AI result to be used.

Customer text is also explicitly treated as untrusted data, so instructions inside a ticket cannot change the AI's classification rules or the independent checker.

4. What I would watch after launch

To understand whether AI sorting is getting better or worse:

- AI success and failure rate
- AI timeout rate
- AI latency, especially p95/p99
- Token usage and cost
- Percentage of tickets sent to manual review
- Checker rejection rate
- Category and priority distributions
- Differences between AI classifications and agent corrections
- SLA breaches by priority

Agent corrections would be reviewed over time to identify repeated classification errors and determine whether the AI or checker needs improvement.

5. What was skipped because of time and what would be done with one more week

The core backend requirements were implemented. Because of the time limit, I kept some areas simple, particularly the same-problem detection and AI timeout handling.

With one more week, I would first determine a more reliable AI timeout using proper latency testing, so that normal AI responses are accepted while genuinely slow or failed requests still go to manual review. I would also improve same-problem detection and add more load and failure testing around the backend.

6. Example of a tool or suggestion that was wrong or poor

During development, a suggestion was made to add GET /tickets/:id because it seemed useful for testing and debugging.

After checking the assignment PDF again, I found that this endpoint was not actually required. It was removed instead of adding unnecessary API surface.

This reinforced the decision to use the assignment PDF as the source of truth and focus only on the required functionality.