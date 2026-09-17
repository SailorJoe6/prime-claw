# Shared ChatGPT conversation: Hermes, OpenShell, and sandbox topology

- **Source:** https://chatgpt.com/share/6aac3644-15b0-83e8-8e6d-1f276d756f69
- **Captured:** 2026-09-17
- **Role in this repository:** External decision input, preserved verbatim for architectural review
- **Trust note:** This is an AI-generated conversation. Its technical claims are not project decisions and require verification against primary sources.

The source page renders citations as ChatGPT citation markers. Those markers are preserved below even when the shared page does not expose a stable inline URL in the transcript text.

## Assistant

Yes. After digging into the current Hermes docs/source, the precise answer is:

**Hermes does manage the lifecycle of its Docker execution sandbox — but the user defines the sandbox configuration.** I overstated what that meant when I talked about Hermes “spinning up sandboxes” as though the agent itself were dynamically deciding to create infrastructure.

The docs are very explicit about the mechanics. With:

```yaml
terminal:
  backend: docker
  docker_image: ...
```

Hermes itself runs the equivalent of `docker run` **on first use**, then routes terminal/file/code-execution calls into that persistent container with `docker exec`. It labels the container as Hermes-managed, finds/reuses it on later Hermes processes, restarts it if necessary, and handles its lifecycle. citeturn490782search0turn849388search0

But that's quite different from:

> “The LLM decides it needs another sandbox and creates one.”

The normal relationship is closer to:

```text
USER / ADMIN
    │
    │ configures profile
    │ backend=docker
    │ image=X
    │ mounts=Y
    │ network=Z
    │ shared_container_key=company-a
    ▼
Hermes runtime
    │
    │ lazily ensures configured sandbox exists
    ▼
Persistent Docker container
    │
    ▼
Agent tools execute here
```

So your intuition is basically right.

## And the profile docs make the distinction explicit

Hermes goes out of its way to say that **profiles, workspaces and sandboxes are three different things**:

- profile = agent identity/state/config
- workspace = starting working directory
- sandbox = enforced filesystem/execution isolation

A profile does not itself provide sandboxing. citeturn683012search1turn683012search3

Crucially, though, **each profile has its own `config.yaml`**, including its terminal-backend configuration. citeturn683012search1

So suppose Stu has:

```text
Company A
    marketing profile
    ops profile
    coding profile

Company B
    marketing profile
    ops profile

Company C
    ops profile
    coding profile
```

Hermes now supports this:

```yaml
# Company A profiles
terminal:
  backend: docker
  docker_shared_container_key: company-a
```

```yaml
# Company B profiles
terminal:
  backend: docker
  docker_shared_container_key: company-b
```

```yaml
# Company C profiles
terminal:
  backend: docker
  docker_shared_container_key: company-c
```

Profiles with the same shared-container key intentionally use the **same long-lived Docker sandbox**. Profiles without that shared key remain isolated. Hermes documentation explicitly describes this as allowing trusted profiles to collaborate in one workspace. citeturn490782search0turn490782search8

So Stu's description:

> “one Hermes instance, 3 sandboxes, a set of agents in each sandbox”

maps extraordinarily neatly onto:

```text
                  Hermes installation

       Company A        Company B        Company C
        sandbox          sandbox          sandbox
           │                │                │
      shared key A     shared key B     shared key C
       /    |    \        /   \           /    \
    profile profile profile profile     profile profile
```

He directly confirms “one sandbox for each company” and “multiple agents for each company, all operating within that company sandbox.” citeturn257878search2

### But there is one thing we cannot establish

Stu **never says in those posts what sandbox backend he is using**.

So my earlier statement that these are definitely Hermes Docker sandboxes was unjustified.

They could be.

In fact, the present Hermes feature set fits his description extremely well, and the shared-container-key feature request appeared on August 12, just four days before his August 16 explanation. citeturn490782search8turn257878search2

But that's circumstantial. I can't honestly say:

> “Stu is using `terminal.backend: docker` with three shared-container keys.”

We don't know that from his posts.

---

# There's another important thing I learned

Hermes does **not appear to have a normal Docker-backend setting saying “attach this profile to arbitrary existing container `foo`.”**

The Docker backend's lifecycle assumes **Hermes-managed containers**. It identifies them through labels such as:

```text
hermes-agent=1
hermes-task-id=...
hermes-profile=...
```

and searches for/reuses containers matching those identities. citeturn849388search0

The user controls things like:

```text
image
volumes
network
resource limits
environment
shared-container identity
persistence
```

but Hermes creates/reuses the concrete container.

That's an architectural choice.

Compare the SSH backend:

```yaml
terminal:
  backend: ssh
  ssh_host: my-existing-machine
```

There, **you provision the execution environment** and Hermes simply attaches to it. citeturn490782search0

Docker is different:

```text
user specifies desired sandbox configuration
              ↓
Hermes realizes that configuration
              ↓
Hermes-managed Docker container
```

---

# So I need to revise one part of our NemoHermes discussion

This becomes more nuanced.

I previously said:

> OpenShell would interfere with Hermes's ability to “spin up its own nested execution containers.”

That statement is mechanically true **if we want to use Hermes's native `terminal.backend: docker`.**

Hermes genuinely needs access to Docker/Podman to implement that backend. Its own Docker image even ships `docker-cli`, specifically so you *can* optionally mount the host Docker socket and have Hermes drive Docker. citeturn519803search0

But I gave the impression that Hermes agents were dynamically provisioning arbitrary sandboxes as part of normal agent behavior.

That's wrong.

A much better description is:

> **Hermes's configured execution backend lazily instantiates and maintains the sandbox the administrator configured for that profile.**

That's much less alarming.

---

# And your point about Stu is exactly right

For Stu's scenario:

```text
3 companies today
3 companies tomorrow
3 companies six months from now
```

there is absolutely no obvious reason for his agents to need an API like:

```text
create_sandbox()
destroy_sandbox()
```

He likely configured the three organizational boundaries once.

Afterward Hermes merely needs to ensure:

```text
company A tools → A execution environment
company B tools → B execution environment
company C tools → C execution environment
```

The fact that Hermes may execute `docker run` behind the scenes to realize that configuration is largely an implementation detail.

It isn't the same capability as allowing the AI to manage infrastructure.

---

# Which leads to a more interesting OpenShell question

Suppose we want the equivalent architecture using OpenShell:

```text
                one organizational system

         ┌──────────┼──────────┐
         │          │          │
      Company A  Company B  Company C
      OpenShell  OpenShell  OpenShell
         │          │          │
     A agents    B agents    C agents
```

Your argument is:

> Why can't **I** create those three OpenShell sandboxes once, and then have Hermes use them?

Architecturally, I agree. That's arguably preferable.

The issue isn't a conceptual incompatibility between Hermes and OpenShell.

It's merely that **stock Hermes's Docker backend doesn't work that way**. Its Docker backend expects to own the concrete container lifecycle.

So there are two quite different questions:

### 1. Does Hermes require agents to have arbitrary sandbox-creation authority?

**No. Absolutely not.**

The sandbox topology can be entirely administrator-defined.

### 2. Does Hermes's current built-in Docker backend expect the Hermes runtime to have authority to create its configured Docker container?

**Yes.**

That's what the implementation currently does. citeturn849388search0

Those aren't contradictory.

---

## In fact, OpenShell may expose a missing abstraction in Hermes

What I'd ideally want is something like:

```yaml
terminal:
  backend: external

  endpoint: company-a-sandbox
```

or:

```yaml
terminal:
  backend: openshell
  sandbox: company-a
```

where the sandbox is already provisioned and Hermes merely gets:

```text
exec(command)
read_file()
write_file()
process_status()
...
```

It doesn't get:

```text
create sandbox
change sandbox policy
mount arbitrary host paths
change security configuration
destroy other sandboxes
```

That would preserve Stu's architecture while keeping OpenShell as the security authority:

```text
                      USER
                       │
          provisions security domains
                       │
               OpenShell control plane
                 /        |        \
                /         |         \
           Company A   Company B   Company C
              ▲           ▲           ▲
              │ exec      │ exec      │ exec
              │           │           │
       ───────────── Hermes ─────────────
          profiles mapped to domains
```

That strikes me as **better security architecture than Hermes's native Docker backend**, not a degraded version of Hermes.

---

### One last wrinkle

There *is* a Hermes mechanism that is almost this already: **SSH**.

If you provision three execution environments yourself:

```text
company-a.example
company-b.example
company-c.example
```

profiles can point their terminal configuration at those environments. Hermes doesn't need lifecycle authority over them at all. citeturn490782search0

So the conceptual distinction of:

> **admin provisions sandbox, Hermes merely uses sandbox**

already exists in Hermes.

It just isn't how its **Docker backend** happens to be implemented.

So I'd revise our earlier conclusion quite substantially:

> **OpenShell's refusal to give Hermes sandbox-lifecycle authority is probably not inherently at odds with Stu's one-sandbox-per-company pattern.**
>
> The potential incompatibility is only with the implementation of Hermes's native Docker terminal backend — and that could potentially be solved by an OpenShell terminal backend/adapter rather than by weakening OpenShell.

And now I'm rather interested in whether **NemoHermes already has some mechanism for mapping Hermes profiles or tool execution into pre-provisioned OpenShell sandboxes**. If NVIDIA has already solved that layer, then much of the conflict I described in the previous answer simply disappears.

## Joe

Research that

## Assistant

I researched it, and the answer is fairly crisp:

**No — as of September 17, 2026, NemoHermes does not appear to have a built-in mechanism that lets one Hermes runtime map different Hermes profiles to different pre-provisioned OpenShell sandboxes.**

The pieces are tantalizingly close, but NVIDIA’s reference architecture currently draws the boundary at **one Hermes runtime inside one OpenShell sandbox**.

### What NVIDIA actually implements

NVIDIA describes the responsibilities explicitly:

- **Hermes** = agent/runtime/tools.
- **OpenShell** = sandbox lifecycle, filesystem/process/network policy and execution environment.
- **NemoClaw** = host-side integration/orchestration that creates and manages those sandboxes. citeturn754700search9turn630456search2

And `nemohermes onboard` doesn't create an empty execution sandbox that an external Hermes later attaches to. It creates a sandbox **containing a Hermes runtime**, writes that Hermes instance's config into `/sandbox/.hermes`, and launches its Hermes gateway there. citeturn630456search1turn630456search2

So the reference topology is:

```text
OpenShell
│
├── Sandbox A
│    └── Hermes A
│
├── Sandbox B
│    └── Hermes B
│
└── Sandbox C
     └── Hermes C
```

NVIDIA's multiple-sandbox documentation reinforces this. Every Hermes sandbox gets its **own dashboard port** and **its own OpenAI-compatible API port**. `nemohermes <name> exec` then addresses that particular registered sandbox. citeturn754700search1turn754700search0

That's pretty strong evidence that NVIDIA currently thinks of the pair as:

> **OpenShell sandbox ↔ Hermes runtime**

rather than:

> one Hermes runtime ↔ N OpenShell execution targets.

---

## Hermes profiles don't change that

This is the subtle bit.

You can certainly have Hermes profiles inside NemoHermes. NVIDIA even persists the dashboard Hermes profile under:

```text
/sandbox/.hermes/profiles/dashboard-home/
```

so profiles remain a real Hermes concept inside the sandbox. citeturn630456search0

But those profiles are all **inside the same OpenShell security domain**:

```text
OpenShell Sandbox A
│
└── Hermes
     ├── profile: architect
     ├── profile: coder
     ├── profile: reviewer
     └── profile: research
```

NemoClaw does not add an abstraction like:

```yaml
profiles:
  acme-coder:
    openshell_sandbox: acme

  foo-coder:
    openshell_sandbox: foo
```

I searched specifically for such a mapping and couldn't find one in either the documented NemoHermes integration or the Hermes-side integration.

---

# And upstream Hermes has another limitation that matters

Hermes itself currently supports **one terminal backend at a time**.

There's an open Hermes feature issue specifically requesting:

> local + N named remotes

because today all `terminal()` calls route through the single configured backend: local, SSH, Docker, Modal, Daytona, etc. citeturn869982search9

That means stock Hermes doesn't yet naturally support:

```text
terminal(target="company-a", ...)
terminal(target="company-b", ...)
terminal(target="company-c", ...)
```

within one running agent environment.

That is actually the missing abstraction we were hypothesizing.

There also isn't an `openshell` terminal backend in Hermes' currently documented backend list. The supported ones are local, Docker, SSH, Singularity, Modal, Daytona and Vercel Sandbox. citeturn670153search0turn869982search7

So my hypothetical:

```yaml
terminal:
  backend: openshell
  sandbox: company-a
```

really **is hypothetical** today.

---

# What does the NemoClaw Hermes plugin expose?

I dug into that too, because this was the place I thought NVIDIA might have hidden the solution.

NVIDIA says its built-in Hermes plugin provides:

- sandbox status tools
- runtime/environment grounding
- managed-tool broker patches
- an `on_session_start` hook. citeturn754700search2turn754700search0

It does **not** document a capability like:

```text
openshell_exec(sandbox="foo", command="...")
```

or access to the host sandbox registry.

In fact NVIDIA tells you explicitly to perform lifecycle, policy, status and execution operations from the **host-side** `nemohermes` CLI. citeturn754700search0

So there isn't a secret OpenShell remote-execution facility already wired into Hermes that I can find.

---

# Interestingly, OpenShell itself already provides exactly the primitive we'd need

From the host:

```bash
nemohermes company-a exec -- ...
```

or lower level:

```bash
openshell sandbox exec -n company-a -- ...
```

will execute a command in an already-existing sandbox. citeturn754700search0turn754700search11

So this part exists:

```text
                 OpenShell
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
      sandbox A   sandbox B   sandbox C
         ▲           ▲           ▲
         │ exec      │ exec      │ exec
```

What's missing is simply a safe bridge from:

```text
Hermes terminal/tool API
```

to:

```text
host OpenShell exec API
```

without handing Hermes control of the OpenShell control plane.

---

# There are actually two good ways to fill that gap

### Option A — an OpenShell Hermes terminal backend

Conceptually this is the cleanest:

```text
Hermes profile
      │
      ▼
terminal backend: openshell
      │
      ▼
narrow host broker
      │
      ▼
existing OpenShell sandbox
```

Configuration could eventually look like:

```yaml
terminal:
  backend: openshell
  sandbox: company-a
```

or, once Hermes gets named terminal targets:

```yaml
terminal:
  backends:
    company-a:
      type: openshell
      sandbox: company-a

    company-b:
      type: openshell
      sandbox: company-b
```

The broker would permit:

```text
exec
read/write permitted workspace
process status
cancel
```

but not:

```text
create sandbox
destroy sandbox
change policy
change mounts
read credentials
change image
```

That preserves exactly the security boundary we want.

---

## Option B — make the broker an MCP server

And NemoClaw already provides a particularly nice security framework for this.

NemoClaw supports **managed authenticated Streamable HTTP MCP servers**, where OpenShell stores the credential externally and can enforce JSON-RPC method-level network policy. citeturn754700search4

So you could have:

```text
              Hermes Prime
                   │
              MCP tools
                   │
                   ▼
       workspace-executor broker
             HOST SIDE
         /         |         \
        ▼          ▼          ▼
   OpenShell A OpenShell B OpenShell C
```

Tools might be:

```text
workspace_exec("company-a", command)
workspace_read("company-a", path)
workspace_write("company-a", path, content)
workspace_status("company-a", job)
workspace_cancel("company-a", job)
```

The broker would have a hardcoded/administrator-defined mapping:

```text
company-a → openshell sandbox UUID X
company-b → openshell sandbox UUID Y
company-c → openshell sandbox UUID Z
```

Hermes couldn't invent a fourth sandbox.

That is very attractive from a security perspective.

---

# There's a third architecture we shouldn't dismiss

Since each NemoHermes sandbox already exposes an **OpenAI-compatible Hermes API**, and each one gets a different forwarded port, we could run:

```text
                   Hermes HQ
                      │
        ┌─────────────┼─────────────┐
        │             │             │
        ▼             ▼             ▼
     Hermes A      Hermes B      Hermes C
    OpenShell A   OpenShell B   OpenShell C
```

The outer Hermes becomes the organizational orchestrator and delegates to complete Hermes runtimes rather than merely executing shell commands.

NVIDIA explicitly provisions an API endpoint for every Hermes sandbox, normally starting at port 8642 and selecting another port for subsequent sandboxes. citeturn754700search1turn630456search14

That could potentially give you:

```text
HQ Hermes
  │
  ├── Company A agent organization
  │       └── separate OpenShell trust domain
  │
  ├── Company B agent organization
  │       └── separate OpenShell trust domain
  │
  └── Company C agent organization
          └── separate OpenShell trust domain
```

But it's no longer **one Hermes instance** in Stu's sense. It's hierarchical federation.

Also, shared Kanban/memory becomes a design question rather than something you get automatically.

---

# So this changes my view of Stu + NemoHermes slightly

Native Hermes can approximate:

```text
ONE Hermes
│
├── sandbox A
├── sandbox B
└── sandbox C
```

using its own execution backend infrastructure.

Stock NemoHermes currently gives us:

```text
OpenShell
│
├── sandbox A + Hermes A
├── sandbox B + Hermes B
└── sandbox C + Hermes C
```

There is **not currently a stock mode** that gives us:

```text
                   ONE Hermes
                       │
            profiles / agents / Kanban
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
 pre-created       pre-created     pre-created
 OpenShell A       OpenShell B     OpenShell C
```

That's the architecture we'd have to add.

### But importantly, it's not a major architectural fight with NemoClaw.

It's a **missing adapter**.

OpenShell already has the right host primitive: execute into an existing named sandbox. Hermes already has a pluggable terminal/execution architecture. NemoClaw already has a secure managed-tool/MCP framework. citeturn754700search4turn869982search9

So I'd describe the gap as roughly:

```text
            missing ~~~~~~~~~~~
Hermes  ───────────────────────► OpenShell exec
               adapter
```

rather than needing to weaken OpenShell or redesign Hermes.

And this actually makes me more enthusiastic about the overall approach, because the security model stays extremely clean:

> **You create the companies/security domains. Hermes can operate inside them. Hermes cannot create new trust domains or enlarge its own authority.**

For the system we're contemplating, I think that's exactly what we would want. memcite

## Joe

You're going off the deep end in architecture astronaut mode, with all this broker stuff you're suggesting.  Dial back your creativity a bit.  

Now, when you say: 

- With it's native docker backend, Hermes manages creation of the sandboxes but the user defines them
- with it's SSH backend, the user creates the sandboxes and Hermes just attaches to them. 

I'm willing to bet that for any backend, Hermes "creates" just means it manages the lifecycle for the user because it can, but the user still defines the sandboxes.  In any case, there is only ONE HERMES!   The sandboxes are smaller things, that the ONE hermes *uses* to create isolation boundaries between teams of agents.  That's my guess.  

That being said, it seems to me we could use OpenShell to both (a) create the ONE main Hermes runtime (in a sandbox) and (b) create as many sandboxes as we wish, giving Hermes SSH access to them and defining them in Hermes as SSH backends.  That would require no extra dev work.  

One final thought.  I'm confused by what you said "Hermes itself currently supports **one terminal backend at a time**" that's confusing because it sounds as-if it rules out Stu's actual architecture.

## Assistant

Yes. Your model is basically right, and my “one terminal backend at a time” statement was misleading because I scoped it incorrectly.

The important fact from the Hermes docs is:

> **Terminal configuration is per profile.**

The multi-profile gateway docs explicitly say that `terminal.backend`, `terminal.cwd`, Docker volumes, `docker_shared_container_key`, **SSH targets**, etc. are resolved **per profile on every routed turn**. citeturn580141search2

So one Hermes installation can absolutely look like this:

```text
ONE HERMES
│
├─ Company A
│  ├─ manager profile ─┐
│  ├─ coder profile   ├── backend → Sandbox A
│  └─ ops profile ────┘
│
├─ Company B
│  ├─ manager profile ─┐
│  └─ coder profile ───┴── backend → Sandbox B
│
└─ Company C
   ├─ manager profile ─┐
   ├─ coder profile   ├── backend → Sandbox C
   └─ ops profile ────┘
```

That is completely compatible with Stu's description.

Hermes even recommends, for its own Docker deployment, **one container hosting all profiles** rather than a Hermes installation/container per profile. citeturn580141search4

So yes: **ONE HERMES, many agent profiles, potentially many execution sandboxes.**

### What “one backend” really means

For any particular profile, its config looks conceptually like:

```yaml
terminal:
  backend: ssh
  ...
```

or:

```yaml
terminal:
  backend: docker
  ...
```

That profile has one active execution backend.

But another profile in the very same Hermes installation can have a completely different configuration:

```text
profile A1 → SSH → machine/sandbox A
profile A2 → SSH → machine/sandbox A

profile B1 → SSH → machine/sandbox B
profile B2 → SSH → machine/sandbox B

profile C1 → Docker → shared-container-key C
```

Hermes explicitly says profiles each have their own `config.yaml`, including terminal configuration. citeturn580141search0turn580141search2

So that removes the apparent contradiction with Stu entirely.

---

## And I think your interpretation of “Hermes creates the sandbox” is better

I was putting too much architectural significance on that phrase.

For Docker, the user/admin says essentially:

```text
Use Docker
Use this image
Use these mounts
Use these limits
Use this shared-container identity
```

and Hermes happens to perform the `docker run`, find/reuse the container, and keep it alive. citeturn580141search1

That's **lifecycle automation**, not Hermes deciding what security topology should exist.

With SSH, Hermes can't provision the remote computer because that's outside the scope of SSH, so you provision it and give Hermes a target:

```yaml
terminal:
  backend: ssh
```

plus host/user/key information. citeturn580141search1

Other backends vary in how much lifecycle automation they provide, but I agree with your larger point: **the administrator chooses/configures the execution environment; the fact that Hermes can instantiate some backend types is mostly convenience.**

---

# Your OpenShell idea

This now looks considerably simpler than what I was making it.

Conceptually:

```text
                     OpenShell
                         │
             ┌───────────┴───────────┐
             │                       │
      MAIN HERMES SANDBOX       Worker sandboxes
             │                  /      |       \
             │                 A       B        C
             │                 ▲       ▲        ▲
             │                 │       │        │
             └────── SSH ──────┴───────┴────────┘
```

Inside the main sandbox:

```text
ONE Hermes
│
├─ Company A profiles → SSH backend → OpenShell sandbox A
├─ Company B profiles → SSH backend → OpenShell sandbox B
└─ Company C profiles → SSH backend → OpenShell sandbox C
```

**That requires no Hermes code changes.**

Hermes already has the abstraction we need: per-profile SSH terminal backends.

And OpenShell already exposes its sandboxes over SSH. In fact:

```bash
openshell sandbox connect foo
```

is an SSH connection, and:

```bash
openshell sandbox ssh-config foo
```

emits an ordinary OpenSSH `Host` block specifically so other SSH clients can connect to that sandbox. citeturn637418search1turn637418search3

OpenShell's own examples literally do:

```bash
openshell sandbox ssh-config "$SANDBOX_NAME" > "$SSH_CONFIG"
ssh -F "$SSH_CONFIG" "$SSH_HOST" ...
```

to execute commands in a sandbox. citeturn550202search0

So your idea lines up surprisingly well with both projects' existing interfaces.

---

## There is one wrinkle, but it's configuration rather than development

An OpenShell sandbox isn't exposed as a conventional:

```text
10.0.0.42:22
```

SSH server that you just hand to Hermes.

OpenShell deliberately routes SSH through its gateway. The generated SSH config contains a `ProxyCommand` that invokes OpenShell's `ssh-proxy`; that proxy obtains an authorized SSH session through the OpenShell gateway. OpenShell does this so it doesn't need to expose the sandbox workload directly. citeturn550202search3turn550202search5

So the target from Hermes would probably be something like:

```yaml
# Company A agent profile
terminal:
  backend: ssh
```

with:

```text
TERMINAL_SSH_HOST=openshell-company-a
```

and an SSH config containing the block generated by:

```bash
openshell sandbox ssh-config company-a
```

Hermes uses the normal OpenSSH client for its SSH backend, so SSH config/ProxyCommand machinery is exactly the sort of thing OpenSSH already understands. citeturn580141search1

The main Hermes sandbox would therefore need access to the OpenShell CLI/proxy and whatever OpenShell authentication is necessary to establish those SSH sessions.

That's a deployment/configuration question—not a Hermes integration project.

---

# And this maps very neatly onto Stu

If Stu used Docker, his layout could be:

```text
ONE HERMES

Company A profiles
  terminal.backend: docker
  docker_shared_container_key: company-a
                │
                ▼
          Docker sandbox A

Company B profiles
  terminal.backend: docker
  docker_shared_container_key: company-b
                │
                ▼
          Docker sandbox B
```

The shared-container feature is explicitly intended for exactly this: several trusted profiles collaborating in **one long-lived container**. citeturn580141search5

If we substitute SSH/OpenShell:

```text
ONE HERMES

Company A profiles
  terminal.backend: ssh
  ssh_host: openshell-company-a
                │
                ▼
         OpenShell sandbox A

Company B profiles
  terminal.backend: ssh
  ssh_host: openshell-company-b
                │
                ▼
         OpenShell sandbox B
```

That's essentially the same Hermes topology.

Only the sandbox implementation changes.

---

So I think we can throw away a fair amount of my previous architectural speculation.

The much simpler working hypothesis is:

> **Run one Hermes installation inside an OpenShell sandbox. Give each Hermes profile the appropriate SSH terminal backend. Profiles belonging to the same team/company point at the same separately provisioned OpenShell sandbox.**

OpenShell creates/enforces the isolation boundaries. Hermes organizes agents and decides which configured profile executes work. SSH is the already-existing seam between them.

And importantly, **nothing in the Hermes docs I've now checked rules that architecture out. Quite the opposite: the per-profile terminal configuration seems designed to support precisely this kind of arrangement.** citeturn580141search2

---

If you want, I can:

- Explain how Hermes manages sandboxes with Docker vs SSH backends
- Clarify what 'one terminal backend at a time' means per profile
- Discuss integrating OpenShell sandboxes with Hermes SSH backends

