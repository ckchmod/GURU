# Milestone Protocol

## Purpose

This protocol makes milestone completion explicit, auditable, and safe.

## Required sequence

Follow this order exactly:

1. Update docs and project memory.
2. Run the affected tests.
3. Inspect `git status` and `git diff`.
4. Commit with a clear, scoped, conventional message.
5. Push only if `git remote get-url origin` succeeds.

Short form: `update docs/memory → run tests → inspect git status/diff → commit → push only if remote configured`.

## Remote gate

- Use `git remote get-url origin` as the push gate.
- If `origin` is missing, stop and report `REMOTE_URL_REQUIRED`.
- Never fabricate a remote, and never push without a real `origin` URL.

## Stop conditions

Stop the milestone flow when any of the following are true:

- Tests fail.
- `git status` or `git diff` has not been reviewed.
- `origin` is missing or unreadable.
- `REMOTE_URL_REQUIRED` is reported.

## Safety rules

- Never commit secrets, PHI, raw restricted resources, model weights, caches, `.agent-artifacts/evidence`, or unrelated files.
- Do not auto-commit or auto-push from helper scripts.
- Keep helper scripts read-only except for reporting.

## Audit expectation

Readiness checks should be able to prove both:

- the sequence above is documented, and
- the remote gate blocks cleanly when `origin` is absent.
