# Power BI single-user embedding demonstration

This sample grants **one configured demo user access to one configured report**. It is not a multi-user or multi-tenant authorization system. Use synthetic data in an isolated environment. For production, implement application identity, report entitlement checks and any required row-level security before issuing embed tokens.

## Requirements

- Node.js 22 or a later supported LTS release, NGINX and a trusted HTTPS certificate.
- Power BI/Fabric capacity and licensing appropriate to the intended use.
- An Entra service principal permitted by the Fabric tenant setting and allowed access to the selected workspace.
- For the service-principal flow, do not add delegated Power BI API permissions simply to follow this sample; see [Microsoft's service-principal guide](https://learn.microsoft.com/en-us/power-bi/developer/embedded/embed-service-principal).
- IDs and a client secret collected using [step 1](../step-1_obtain_values/README.md).

## Backend setup

Use the checked-in files under files/backend; do not paste credentials into server.js.

```bash
cd files/backend
npm ci
cp .env.example .env
chmod 600 .env
# Edit .env privately; replace every placeholder.
npm test
npm start
```

Keep .env and the backend outside NGINX's public document root. The backend refuses missing/placeholder settings and weak demo passwords, and binds only to 127.0.0.1. It authenticates every /embed-info request before contacting Microsoft, grants only the configured report, validates upstream responses, uses request timeouts and returns no token-bearing error logs. It does not enable CORS.

Use a unique random EMBED_PASSWORD of at least 32 characters, stored privately. It is an application password, separate from POWERBI_CLIENT_SECRET. Do not reuse a Microsoft account password.

## HTTPS reverse proxy and browser

Copy files/frontend/index.html to your chosen document root and adapt files/nginx-config/default-https_version. Change example.com and certificate paths to your own deployment. Create the NGINX password file with the same EMBED_USERNAME and EMBED_PASSWORD; htpasswd prompts rather than placing the password in shell history:

```bash
sudo htpasswd -c /etc/nginx/powerbi.htpasswd DEMO_USERNAME
sudo chmod 640 /etc/nginx/powerbi.htpasswd
sudo nginx -t
```

Ensure the NGINX worker group can read that password file without making it world-readable. Use -c only when creating a new file. Apply the tested NGINX configuration through your normal deployment process. The browser authenticates over HTTPS and sends the same Basic credentials through the proxy; the backend independently verifies them.

The HTTP configuration file is intentionally a redirect-only example. Never serve Basic credentials or embed tokens over plaintext HTTP. Do not expose backend port 3000. A reverse proxy alone does not provide per-report or per-tenant authorization.

## Verification before any deployment

```bash
npm test
# Unauthorized request must return 401 and must not obtain a Power BI token:
curl -i http://127.0.0.1:3000/embed-info
```

Use a real authorized browser only after private configuration and TLS checks. Never capture tokens in screenshots or logs. Local tests mock Microsoft endpoints; they do not validate your tenant, capacity, credentials, NGINX installation or report permissions.

See [Microsoft's authentication and embedding sequence](https://learn.microsoft.com/en-us/power-bi/guidance/powerbi-implementation-planning-usage-scenario-embed-for-your-customers).
