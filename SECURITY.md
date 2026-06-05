# Security Policy

## Supported Versions

OmniMesh is in pre-release. Only the latest `main` branch and the most recent
release tag receive security fixes.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | yes                |
| latest  | yes                |
| older   | no                 |

## Reporting a Vulnerability

**Please do not file a public issue for security-sensitive bugs.**

Email: **elpraise20@gmail.com**

You should receive an acknowledgement within **72 hours**. We aim to confirm
the report, develop a fix, and ship a release within **90 days** of the
initial report.

When reporting, please include:

- A clear, minimal reproduction (commands, environment, OS/arch)
- The expected vs. actual behaviour
- The impact you observed (memory disclosure? RCE? auth bypass?)
- Any suggestions for remediation

## Scope

The following are in scope for OmniMesh security reports:

- Authentication and authorization in the mesh control plane (shared secret,
  pairing tokens, `~/.omni/secret` handling)
- QVAC P2P transport (Hyperswarm firewall bypass, malicious provider keys,
  model asset validation, ASR/TTS path traversal)
- OpenAI-compat endpoint on port 11434 (token leakage, SSRF, arbitrary model
  fetch)
- mDNS advertisements (peer spoofing, secret leakage in TXT records)
- Bun `--compile` binary integrity (build-time injection, supply chain)
- Mobile (Expo) IPC, file storage, AppState lifecycle leaks

Out of scope:

- Issues in `@qvac/sdk` itself (file with the QVAC team)
- Issues in Bun, Biome, or other upstream dependencies
- Rate-limiting / DoS against your own deployment

## Disclosure

We follow **coordinated disclosure** with a **90-day** window. We will credit
the reporter in the release notes unless asked to remain anonymous. We
request that you do not disclose the bug publicly until we have shipped a
fix or the 90-day window has elapsed, whichever is earlier.

## Safe Harbour

We will not pursue legal action against researchers acting in good faith who
comply with this policy: only test against systems you own or are
authorized to test, do not exfiltrate data, do not attempt to disrupt
service.
