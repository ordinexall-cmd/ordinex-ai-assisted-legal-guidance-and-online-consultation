# Ordinex — Credits & licenses (repository note)

> **Website note:** The in-app page at `/licenses` is a plain-language “built with” credits summary for users and panel. This file points to the formal artifacts.

| Artifact | Purpose |
|----------|---------|
| [`/licenses`](../../src/pages/LicensesPage.tsx) (in app) | Human-readable credits |
| [`LICENSE`](../../LICENSE) | MIT for Ordinex code + narrative third-party credits |
| [`THIRD_PARTY_NOTICES.md`](../../THIRD_PARTY_NOTICES.md) | Machine-generated list of every lockfile package + license |

Regenerate the full package list:

```bash
npm run licenses:generate
```

SaaS processors (PayMongo, Groq, etc.) are disclosed in [`PRIVACY_POLICY.md`](./PRIVACY_POLICY.md), not as open-source packages.

Public Philippine legal research sites (Official Gazette, DOJ, Supreme Court e-Library, LawPhil) are credited on `/licenses` as research sources for AI case analysis grounding — not as npm packages in `THIRD_PARTY_NOTICES.md`.
