# Repository remediation — October 2026

Authenticates the single-user demo before token issuance, confines the backend to loopback, removes broad CORS, verifies report identity and upstream responses, moves configuration out of source and supplies an HTTPS-only access example. This remains a single-user synthetic-data demonstration, not production multitenant authorization.

## Validation

Run npm ci and npm test in step-2_embed_report_demo/files/backend. Tests use synthetic credentials and mocked Microsoft calls.

## Release and recovery

These changes are proposed through a review branch. Review behavior and prerequisites before merging or using operational scripts. Revert the change commit to recover ordinary code if necessary; **never restore exposed credentials or weaken access controls as a rollback shortcut**. No deployment, password rotation, repository visibility change or history rewrite is included.
