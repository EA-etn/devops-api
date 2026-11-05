# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report it privately through
[GitHub private vulnerability reporting](https://github.com/EA-etn/devsecops-pipeline/security/advisories/new).
You will get an answer within a few days.

## Supported versions

| Version | Supported |
|---|---|
| Latest release | ✅ |
| `main` | ✅ |
| Older releases | ❌ |

## How images are protected

Every published image is scanned with Trivy, ships with an SBOM and SLSA provenance, and is
signed with Cosign (keyless). Verify any image before running it:

```bash
cosign verify ghcr.io/ea-etn/demo-api:<tag> \
  --certificate-identity-regexp '^https://github.com/EA-etn/devsecops-pipeline/\.github/workflows/ci\.yml@refs/(heads/main|tags/v.*)$' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```
