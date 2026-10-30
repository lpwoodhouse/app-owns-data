"use strict";
const crypto = require("node:crypto");
const express = require("express");
const fetch = require("node-fetch");

function readConfig(env = process.env) {
  const fields = {
    tenantId: "POWERBI_TENANT_ID", clientId: "POWERBI_CLIENT_ID",
    clientSecret: "POWERBI_CLIENT_SECRET", workspaceId: "POWERBI_WORKSPACE_ID",
    reportId: "POWERBI_REPORT_ID", datasetId: "POWERBI_DATASET_ID",
    username: "EMBED_USERNAME", password: "EMBED_PASSWORD"
  };
  const config = {};
  for (const [key, name] of Object.entries(fields)) {
    const value = env[name];
    if (!value || /[<>\r\n]/.test(value)) throw new Error("Missing or placeholder configuration: " + name);
    config[key] = value;
  }
  if (config.username.includes(":")) throw new Error("EMBED_USERNAME cannot contain a colon");
  if (config.password.length < 32) throw new Error("EMBED_PASSWORD must contain at least 32 characters");
  for (const key of ["tenantId", "clientId", "workspaceId", "reportId", "datasetId"]) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config[key]))
      throw new Error("Invalid identifier configuration: " + fields[key]);
  }
  return config;
}

function sameSecret(a, b) {
  const digest = value => crypto.createHash("sha256").update(value).digest();
  return crypto.timingSafeEqual(digest(a), digest(b));
}

function createApp(config, fetchImpl = fetch) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.get("/embed-info", (req, res, next) => {
    const header = req.get("authorization") || "";
    let decoded = "";
    if (/^Basic [A-Za-z0-9+/]+=*$/i.test(header)) {
      decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    }
    if (!sameSecret(decoded, config.username + ":" + config.password)) {
      res.set("WWW-Authenticate", 'Basic realm="Power BI demo", charset="UTF-8"');
      return res.status(401).json({ error: "Authentication required" });
    }
    next();
  }, async (req, res) => {
    async function upstream(url, options) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetchImpl(url, { ...options, signal: controller.signal });
        if (!response.ok) throw new Error("Upstream request failed");
        return await response.json();
      } finally {
        clearTimeout(timer);
      }
    }
    try {
      const aad = await upstream(
        "https://login.microsoftonline.com/" + config.tenantId + "/oauth2/v2.0/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: config.clientId, client_secret: config.clientSecret,
            grant_type: "client_credentials",
            scope: "https://analysis.windows.net/powerbi/api/.default"
          })
        });
      if (typeof aad.access_token !== "string" || !aad.access_token) throw new Error("Invalid upstream result");
      const reportUrl = "https://api.powerbi.com/v1.0/myorg/groups/" +
        config.workspaceId + "/reports/" + config.reportId;
      const headers = { Authorization: "Bearer " + aad.access_token };
      const report = await upstream(reportUrl, { headers });
      if (report.id !== config.reportId || report.datasetId !== config.datasetId ||
          typeof report.embedUrl !== "string" ||
          new URL(report.embedUrl).origin !== "https://app.powerbi.com") {
        throw new Error("Report does not match configured resource");
      }
      const token = await upstream(reportUrl + "/GenerateToken", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ accessLevel: "View" })
      });
      if (typeof token.token !== "string" || !token.token ||
          !Number.isFinite(Date.parse(token.expiration)) ||
          Date.parse(token.expiration) <= Date.now()) throw new Error("Invalid upstream result");
      res.json({ embedUrl: report.embedUrl, reportId: report.id,
        embedToken: token.token, expiration: token.expiration });
    } catch {
      // Do not return or log upstream responses, credentials or tokens.
      res.status(502).json({ error: "Unable to obtain embed information" });
    }
  });
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  createApp(readConfig()).listen(port, "127.0.0.1", () => {
    console.log("Power BI demo listening on loopback port " + port);
  });
}
module.exports = { createApp, readConfig };
