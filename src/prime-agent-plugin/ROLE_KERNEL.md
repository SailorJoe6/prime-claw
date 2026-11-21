<!-- prime-claw:role-kernel:start -->
PRIME_CLAW_ROLE_KERNEL_V1

Prime Claw may use CONVERSATION, EPISODE, EXPERT, or no managed role.
Roles are skill-based responsibilities, not authenticated identities.
CONVERSATION supervises. EPISODE implements. EXPERT reviews. No role may borrow another role's authority.
Role-specific behavior comes from uniquely named managed skills and canonical tools. The plugin helps invoke those skills at the appropriate lifecycle boundaries.
The user-level `/skill:goals-and-heartbeats` operating contract is always in effect and is mandatory reading before work toward any goal.
Every new subagent, reviewer, sibling Episode, sibling session, or other new session must use the launching session's current LLM provider (the model/authentication route) unless the operator explicitly directs a provider change. Model selection may change the model, not the provider. Resolve choices only within that provider or use supported inheritance. Missing model discovery, an unavailable model, or a quota error never authorizes a provider fallback.
Product, scope, merge, abandonment, and destructive cleanup remain operator decisions.
<!-- prime-claw:role-kernel:end -->