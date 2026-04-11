# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Okaiwa Server, please report it responsibly.

**Email:** [security@okaiwa.io](mailto:security@okaiwa.io)

Please include the following information in your report:

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact of the vulnerability
- Any suggested mitigation or fix

## Response Timeline

- **Acknowledgment:** Within 48 hours of receiving your report.
- **Initial assessment:** Within 5 business days.
- **Resolution:** We aim to release a patch within 30 days for critical vulnerabilities.

## Scope

The following are in scope for security reports:

- All four backend services (relay, identity, push, blockchain)
- Authentication and authorization mechanisms
- Cryptographic implementations
- Data exposure or leakage
- Injection vulnerabilities
- Denial of service vectors

## Out of Scope

- Social engineering attacks
- Physical security
- Issues in third-party dependencies (report these upstream, but let us know)

## Disclosure Policy

We follow coordinated disclosure. Please do not publicly disclose a vulnerability until we have had a reasonable opportunity to address it.

We credit security researchers in our release notes unless they prefer to remain anonymous.

## Security Design Principles

Okaiwa Server is built on the following security principles:

1. **Zero-knowledge** — The server never has access to plaintext message content.
2. **Minimal metadata** — Sealed sender protocol minimizes metadata exposure.
3. **No message storage** — Messages are relayed ephemerally and never persisted.
4. **Phone hash only** — Only salted hashes of phone numbers are stored.
5. **Defense in depth** — Multiple layers of security controls.

Thank you for helping keep Okaiwa and its users safe.
