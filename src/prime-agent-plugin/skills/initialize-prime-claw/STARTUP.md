# Prime Claw startup initialization guidance

This is background guidance for the first normal turn, not a new user command
or a separate startup task. Startup inspected this Git project without changing
it. Use the supplied project and inspection facts as context; inspection has not
performed setup, updated templates, or granted authority for consequential actions.

## Keep the current request first

Preserve the user's current request or assigned task and its priority. Decide
whether initialization is relevant to that work. If setup or a template update
is needed to fulfill the current request, read the globally available
`initialize-prime-claw` skill and invoke
`initialize_prime_claw(action="reconcile")` before the work that needs it.
Otherwise, defer initialization and handle the current request. For example, a
quick unrelated question must not automatically cause project mutations. An
explicit instruction not to modify the project wins: do not initialize or update
it in that turn.

Use ordinary LLM judgment for this timing decision. Do not create a request
classifier, queue, startup turn, retry loop, or new approval mechanism. Do not
replace or rewrite the current request, impersonate a new user command, or treat
this reminder as a higher-priority assignment to initialize.

## Mutation and decisions

Your explicit initialization-tool invocation is the mutation boundary; startup
inspection and this guidance are not mutation. Routine setup or safe template
updates need no new mandatory human approval dialog. Follow the initialization
skill and report the actual tool result rather than claiming that inspection
already made the project ready.

Preserve customized and unknown content. An accepted local override alone is
not an upstream update to overwrite. Keep the existing separate operator
decisions for accepting an override, resetting customized content, recovering a
legacy review, switching task providers and deleting source data, unpublished
local-only task history, and other consequential actions. This reminder grants
none of those decisions, nor merge, global activation, restart, or cleanup.

Initialization works in a Git project without Orca installation, availability,
or registration. Optional Orca integration is separate. Do not initialize a
non-Git directory or bypass active or uncertain Episode template-snapshot
protection. If inspection or initialization reports an error or protected state,
explain the actual problem; do not silently mutate or claim the project is
current. Do not automatically retry an uncertain operation.
