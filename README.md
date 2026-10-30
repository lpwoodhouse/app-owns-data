# Power BI App Owns Data demonstration

An isolated **single-user** example for one configured report, with a Node backend and HTTPS reverse proxy. It is not a production multi-user or multi-tenant access-control implementation.

1. [Collect private configuration](step-1_obtain_values/README.md).
2. [Configure and test the authenticated demo](step-2_embed_report_demo/README.md).

The backend authenticates before requesting tokens, binds only to loopback and reads credentials from a protected environment file. Keep credentials out of Git and public web roots. Deployment, tenant permissions and data access require independent validation.
