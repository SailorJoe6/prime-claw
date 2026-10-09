# Phase 3a versioned storage: disposable step-1 mount smoke

Date: 2026-10-09. Scope: `prime-claw-zwg.6` step 1 **only**, per Joe's
Bead comment `01a12304-ece6-721b-801b-12f421989ee4`. `openshell
--version` returned `0.0.116`. The [exact-version Docker driver mount contract](https://github.com/NVIDIA/OpenShell/blob/v0.0.116/crates/openshell-driver-docker/README.md#driver-config-mounts)
allows existing named volumes with `subpath` and `read_only: false`.
The locally cached disposable image was
`ghcr.io/nvidia/openshell-community/sandboxes/base:latest` (ID
`aeef1c63f00e`), **not** the production `prime-claw` image/policy.
No providers were attached (`--no-auto-providers`).

## Inputs and commands

An initial proposed sandbox name was rejected before creation (`name exceeds
maximum length (31 > 19)`); these shorter names succeeded. All resources are
disposable, isolated and retained pending explicit disposition.

```sh
docker volume create --label purpose=prime-claw-step1-smoke pc-step1-20261009234243-one
docker run --name pc-step1-20261009234243-seed --network none \
  --mount type=volume,source=pc-step1-20261009234243-one,target=/seed \
  alpine:latest sh -c 'set -eu; mkdir -p /seed/pgdata /seed/brain /seed/home-root/.prime; printf pg-seed-ok > /seed/pgdata/marker; printf brain-seed-ok > /seed/brain/marker; printf root-seed-ok > /seed/home-root/AGENTS.md; chmod 777 /seed/pgdata /seed/brain /seed/home-root /seed/home-root/.prime'
```

The seed container is retained, exited. Marker values were synthetic.
The seed command set `0777` on empty test subdirectories solely to isolate
mount behavior from ownership; **not** a production permission model.
The two sandbox creates used this same single-volume config:

```json
{
  "docker": {
    "mounts": [
      {
        "type": "volume",
        "source": "pc-step1-20261009234243-one",
        "subpath": "pgdata",
        "target": "/sandbox/pgdata",
        "read_only": false
      },
      {
        "type": "volume",
        "source": "pc-step1-20261009234243-one",
        "subpath": "brain",
        "target": "/sandbox/brain",
        "read_only": false
      },
      {
        "type": "volume",
        "source": "pc-step1-20261009234243-one",
        "subpath": "home-root",
        "target": "/sandbox/home-root",
        "read_only": false
      }
    ]
  }
}
```

```sh
openshell sandbox create -g openshell --name pcs1-261009234243 \
  --from ghcr.io/nvidia/openshell-community/sandboxes/base:latest \
  --no-auto-providers --no-tty --detach \
  --driver-config-json '{"docker":{"mounts":[{"type":"volume","source":"pc-step1-20261009234243-one","subpath":"pgdata","target":"/sandbox/pgdata","read_only":false},{"type":"volume","source":"pc-step1-20261009234243-one","subpath":"brain","target":"/sandbox/brain","read_only":false},{"type":"volume","source":"pc-step1-20261009234243-one","subpath":"home-root","target":"/sandbox/home-root","read_only":false}]}}' -o json
openshell sandbox exec -g openshell -n pcs1-261009234243 --no-tty -- sh -lc 'set -eu; test ! -e /sandbox/AGENTS.md && test ! -L /sandbox/AGENTS.md; test ! -e /sandbox/.prime && test ! -L /sandbox/.prime; printf pg-write-ok > /sandbox/pgdata/from-sandbox; printf brain-write-ok > /sandbox/brain/from-sandbox; ln -s home-root/AGENTS.md /sandbox/AGENTS.md; ln -s home-root/.prime /sandbox/.prime; printf state-write-ok > /sandbox/.prime/from-sandbox; test -L /sandbox/AGENTS.md && test "$(readlink /sandbox/AGENTS.md)" = home-root/AGENTS.md; test "$(cat /sandbox/AGENTS.md)" = root-seed-ok; test -L /sandbox/.prime && test "$(readlink /sandbox/.prime)" = home-root/.prime; test "$(cat /sandbox/.prime/from-sandbox)" = state-write-ok; printf "pg=%s brain=%s root=%s dotprime=%s symlink-file=%s symlink-dir=%s
" "$(cat /sandbox/pgdata/from-sandbox)" "$(cat /sandbox/brain/from-sandbox)" "$(cat /sandbox/AGENTS.md)" "$(cat /sandbox/.prime/from-sandbox)" "$(readlink /sandbox/AGENTS.md)" "$(readlink /sandbox/.prime)"'
openshell sandbox create -g openshell --name pcs1b-261009234243 \
  --from ghcr.io/nvidia/openshell-community/sandboxes/base:latest \
  --no-auto-providers --no-tty --detach \
  --driver-config-json '{"docker":{"mounts":[{"type":"volume","source":"pc-step1-20261009234243-one","subpath":"pgdata","target":"/sandbox/pgdata","read_only":false},{"type":"volume","source":"pc-step1-20261009234243-one","subpath":"brain","target":"/sandbox/brain","read_only":false},{"type":"volume","source":"pc-step1-20261009234243-one","subpath":"home-root","target":"/sandbox/home-root","read_only":false}]}}' -o json
openshell sandbox exec -g openshell -n pcs1b-261009234243 --no-tty -- sh -lc 'set -eu; test "$(cat /sandbox/pgdata/from-sandbox)" = pg-write-ok; test "$(cat /sandbox/brain/from-sandbox)" = brain-write-ok; test "$(cat /sandbox/home-root/.prime/from-sandbox)" = state-write-ok; test ! -e /sandbox/AGENTS.md && test ! -L /sandbox/AGENTS.md; test ! -e /sandbox/.prime && test ! -L /sandbox/.prime; printf "before-bootstrap=volume-persisted-root-links-absent
"; for pass in 1 2; do test -L /sandbox/AGENTS.md || ln -s home-root/AGENTS.md /sandbox/AGENTS.md; test -L /sandbox/.prime || ln -s home-root/.prime /sandbox/.prime; test "$(readlink /sandbox/AGENTS.md)" = home-root/AGENTS.md; test "$(readlink /sandbox/.prime)" = home-root/.prime; test "$(cat /sandbox/AGENTS.md)" = root-seed-ok; test "$(cat /sandbox/.prime/from-sandbox)" = state-write-ok; printf "bootstrap-pass-%s=ok
" "$pass"; done'
```

The mount check on **each** test container used targeted
`docker inspect --format` limited to `HostConfig.Mounts` type, named source,
target, volume subpath and read-only flag. Both returned:

```text
volume|pc-step1-20261009234243-one|/sandbox/pgdata|pgdata|false;volume|pc-step1-20261009234243-one|/sandbox/brain|brain|false;volume|pc-step1-20261009234243-one|/sandbox/home-root|home-root|false;
```

## Observed results

- First sandbox `pcs1-261009234243` (OpenShell ID `d704b020-dd7b-4767-bc25-7fa48cb195f8`),
  phase `Ready`: three writable Docker mounts from `pc-step1-20261009234243-one` to
  `/sandbox/pgdata`, `/sandbox/brain`, `/sandbox/home-root` with matching
  pre-created subpaths. Unprivileged user `998:998`, home and cwd `/sandbox`,
  read the synthetic preseed and wrote markers to all three paths. The
  `/sandbox/AGENTS.md -> home-root/AGENTS.md` file link and
  `/sandbox/.prime -> home-root/.prime` directory link resolved and worked.
- Second sandbox `pcs1b-261009234243` (OpenShell ID `3c8deb90-5475-4a3f-a9a1-e23210831f0b`), phase
  `Ready`: same three mount records; read first-sandbox writes. Its root
  links were **absent** before bootstrap while mounted data persisted.
  Bootstrap created both links and a repeated bootstrap pass reused them;
  both passes verified exact targets/content and exited `0`.

```text
pg=pg-write-ok brain=brain-write-ok root=root-seed-ok dotprime=state-write-ok symlink-file=home-root/AGENTS.md symlink-dir=home-root/.prime
before-bootstrap=volume-persisted-root-links-absent
bootstrap-pass-1=ok
bootstrap-pass-2=ok
```

Resources **retained**, with no stop/delete/cleanup: named volume
`pc-step1-20261009234243-one` (local driver), exited seed container `pc-step1-20261009234243-seed`,
and the two Ready disposable sandboxes above. No `prime-claw` v1 file was
read, inventoried or copied. No multi-volume fallback was attempted because
all three one-volume subpath mounts succeeded.

## Recommendation and limits for Joe's review

Use **one existing named volume** with pre-created `pgdata`, `brain`, and
`home-root` subpaths mounted below `/sandbox`, not over `/sandbox` itself.
Any later accepted root-file or root-directory links must be created in an
idempotent, **fail-closed** bootstrap on each new sandbox after its mounts
exist. Reject collisions or wrong pre-existing link targets. Do not infer
that links in one container writable layer persist to the next container.

This base-image smoke does **not** prove PostgreSQL/WAL recovery, production
image/policy/numeric ownership, complete agent-state coverage, independent
backup or volume-loss recovery, or real credential isolation. No v1 read,
preseed of real data, `prime-claw-v2`, source/index/routed write, Qwen action,
cleanup or merge is approved at this step. **Stop for Joe's step-1 topology
and next-step decision.** Incident `prime-claw-5v7.10` stays OPEN and `.5`,
parent and `.4` BLOCKED under their separate gates.
