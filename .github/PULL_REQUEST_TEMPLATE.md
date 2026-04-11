## Summary

<!-- Describe what this PR does and why. Link related issues. -->

## Type of Change

- [ ] `feat` — New feature
- [ ] `fix` — Bug fix
- [ ] `refactor` — Code refactoring (no behavior change)
- [ ] `perf` — Performance improvement
- [ ] `security` — Security fix or hardening
- [ ] `docs` — Documentation update
- [ ] `test` — Adding or updating tests
- [ ] `chore` — Maintenance, dependencies, CI

## Security Checklist

- [ ] This change does NOT log any sensitive data (messages, keys, phone numbers, addresses)
- [ ] This change does NOT store any user data on the server beyond what is specified in the architecture
- [ ] This change does NOT expose metadata (who talks to whom, timing, frequency)
- [ ] This change does NOT weaken the E2E encryption guarantees
- [ ] This change does NOT add custom cryptographic code (only audited libraries)
- [ ] Push notifications remain content-free (silent push only)

## Testing

- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing performed
- [ ] Crypto operations verified against test vectors

## Local Checks

```bash
pnpm run prettier --write .   # Pass
pnpm run lint                  # Pass
pnpm run typecheck             # Pass
pnpm run build                 # Pass
pnpm run test                  # Pass
```

## Screenshots

<!-- If applicable, add screenshots or recordings. -->
