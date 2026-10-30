"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { createApp, readConfig } = require("./server");
const id = "00000000-0000-0000-0000-000000000001";
const config = { tenantId:id, clientId:id, clientSecret:"synthetic-test-client-secret",
 workspaceId:id, reportId:id, datasetId:id, username:"demo-test",
 password:"synthetic-test-password-no-real-access" };
const auth = "Basic " + Buffer.from(config.username + ":" + config.password).toString("base64");
async function serve(t, upstream) {
 const server = createApp(config, upstream).listen(0,"127.0.0.1");
 await once(server,"listening");
 t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
 return "http://127.0.0.1:" + server.address().port;
}
test("missing and incorrect credentials never contact Microsoft", async t => {
 let calls=0;
 const url=await serve(t,async()=>{ calls++; throw Error("must not call"); });
 for (const header of ["", "Bearer synthetic", "Basic "+Buffer.from("bad:bad").toString("base64")]) {
  const res=await fetch(url+"/embed-info",{headers:{Authorization:header}});
  assert.equal(res.status,401); assert.equal(res.headers.get("cache-control"),"no-store");
  assert.match(res.headers.get("www-authenticate"),/^Basic/);
 }
 assert.equal(calls,0);
});
test("upstream errors return no response body, credential or token details", async t => {
 const url=await serve(t,async()=>({ok:false,json:async()=>({secret:"do-not-expose"})}));
 const res=await fetch(url+"/embed-info",{headers:{Authorization:auth}});
 assert.equal(res.status,502);
 assert.deepEqual(await res.json(),{error:"Unable to obtain embed information"});
});
test("report identity mismatch stops token issuance", async t => {
 let calls=0;
 const url=await serve(t,async()=>({ok:true,json:async()=>++calls===1?{access_token:"synthetic"}:{id:"unexpected",datasetId:id,embedUrl:"https://app.powerbi.com/reportEmbed"}}));
 const res=await fetch(url+"/embed-info",{headers:{Authorization:auth}});
 assert.equal(res.status,502); assert.equal(calls,2);
});
test("authorized configured report returns only embed fields with no CORS grant", async t => {
 const responses=[{access_token:"synthetic-aad-token"},{id,datasetId:id,embedUrl:"https://app.powerbi.com/reportEmbed"},
 {token:"synthetic-embed-token",expiration:new Date(Date.now()+60000).toISOString()}];
 const calls=[];
 const url=await serve(t,async(u,o)=>{calls.push([u,o]);return {ok:true,json:async()=>responses.shift()};});
 const res=await fetch(url+"/embed-info",{headers:{Authorization:auth}});
 assert.equal(res.status,200);assert.equal(res.headers.get("access-control-allow-origin"),null);
 const body=await res.json();assert.equal(body.embedToken,"synthetic-embed-token");
 assert.equal(body.reportId,id);assert.equal(body.access_token,undefined);
 assert.deepEqual(JSON.parse(calls[2][1].body),{accessLevel:"View"});
});
test("expired embed tokens are rejected", async t => {
 const responses=[{access_token:"synthetic"},{id,datasetId:id,embedUrl:"https://app.powerbi.com/reportEmbed"},
 {token:"synthetic",expiration:"2000-01-01T00:00:00Z"}];
 const url=await serve(t,async()=>({ok:true,json:async()=>responses.shift()}));
 const res=await fetch(url+"/embed-info",{headers:{Authorization:auth}});
 assert.equal(res.status,502);
});
test("startup refuses missing, placeholder or weak configuration", () => {
 assert.throws(()=>readConfig({}),/Missing/);
 const env={POWERBI_TENANT_ID:id,POWERBI_CLIENT_ID:id,POWERBI_CLIENT_SECRET:"synthetic-client-secret",
 POWERBI_WORKSPACE_ID:id,POWERBI_REPORT_ID:id,POWERBI_DATASET_ID:id,EMBED_USERNAME:"demo-test",EMBED_PASSWORD:"short"};
 assert.throws(()=>readConfig(env),/32/);
 env.EMBED_PASSWORD=config.password;assert.equal(readConfig(env).reportId,id);
 env.POWERBI_CLIENT_SECRET="<CLIENT_SECRET>";assert.throws(()=>readConfig(env),/placeholder/);
});
