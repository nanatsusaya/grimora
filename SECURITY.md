# Security Policy

Grimora treats security and privacy as architectural drivers (see
[ADR 0010 — Security & Privacy by Design](docs/adr/0010-security-and-privacy-by-design.md)).
This policy describes how to report a vulnerability responsibly.

## Reporting a vulnerability

**Please do _not_ open a public GitHub issue for security vulnerabilities.** A public issue
discloses the problem to everyone before a fix exists.

Instead, use **GitHub Private Vulnerability Reporting** (coordinated disclosure):

1. Go to the repository's **Security** tab → **Report a vulnerability**, or open
   <https://github.com/nanatsusaya/grimora/security/advisories/new> directly.
2. This creates a **private** security advisory visible only to you and the maintainers.

Please include, as far as you can:

- a description of the vulnerability and its potential impact,
- steps to reproduce (proof-of-concept, affected component/route, preconditions),
- affected version / commit, and any suggested remediation.

## What to expect

Grimora is currently maintained by a single individual, so responses are best-effort:

- **Acknowledgement:** we aim to confirm receipt within **5 working days**.
- **Triage & updates:** we will assess severity, keep you updated on progress, and agree on a
  coordinated disclosure timeline before any public write-up.
- **Credit:** with your consent, we are happy to credit you in the advisory once a fix ships.

Fixes are delivered through the normal update mechanism (a patch on the supported version below).

## Supported versions

Grimora is **pre-release** (`0.0.0`); there are no tagged releases yet. Security fixes land on the
latest `main` branch, which is the only supported version for now. This table will be expanded once
versioned releases and distributable apps exist (which is also when the EU Cyber Resilience Act's
product obligations begin to attach — see ADR 0010 §7).

| Version | Supported |
| --- | --- |
| `main` (latest) | ✅ |
| any older commit | ❌ |

## Scope

This policy covers the Grimora source in this repository. Vulnerabilities in third-party
dependencies should be reported to the respective upstream project; if a dependency issue affects
Grimora specifically, feel free to report it here as well so we can pin/patch.
