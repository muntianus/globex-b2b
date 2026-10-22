# Security Policy

globex-b2b is an internal PerfOps microservice (default port 4010).

- **Report a vulnerability:** open a private security advisory on this repo
  (GitHub → Security → Advisories) or contact the owner listed in
  [`muntianus/.github`](https://github.com/muntianus/.github/blob/main/SECURITY.md).
- **Secrets:** none are required. Never commit `.env`; only `.env.example`
  (placeholder values) is tracked. CI runs gitleaks via the org security gate.
- The API is unauthenticated and can create SKUs and reserve stock. Keep it on loopback / behind Caddy; buyer INNs are business identifiers, not secrets, but do not log full order payloads.
