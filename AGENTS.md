# AgentRouter Proxy

OpenAI-compatible proxy for AgentRouter API with auth spoofing to bypass client restrictions.

## Architecture

- **Proxy URL**: https://routerproxy.vercel.app
- **Repo**: https://github.com/larsontrey720/routerproxy
- **Target API**: https://agentrouter.org/v1
- **Runtime**: Vercel Edge Functions

## The Auth Spoofing Secret

AgentRouter blocks unauthorized clients. The magic headers that bypass this:

```
User-Agent: codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464
Originator: codex_cli_rs
```

Both headers are required. Without them, you get `unauthorized_client_error`.

## Vercel Deployment Lessons Learned

### Problem 1: "Services" Framework Detection

Vercel auto-detects projects based on file structure and can incorrectly classify them as "services" instead of serverless functions.

**Symptoms:**
- Error: `service, or change the project framework setting`
- Build succeeds but deployment fails
- Project shows as "services" in Vercel dashboard

**Solutions:**

1. **Use the Vercel API to set framework to null:**
```bash
curl -X PATCH "https://api.vercel.com/v9/projects/{PROJECT_ID}?teamId={TEAM_ID}" \
  -H "Authorization: Bearer {VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"framework": null}'
```

2. **Clean project recreation:**
   - Delete the Vercel project: `echo "y" | vercel project rm {project-name}`
   - Remove local `.vercel` directory
   - Redeploy: `vercel --prod --yes`

3. **File structure matters:**
   - Use `api/chat/completions.ts` (nested) not `api/index.ts`
   - Vercel recognizes nested routes as functions
   - Add `export const config = { runtime: 'edge' };` at the top

4. **vercel.json rewrites:**
```json
{
  "rewrites": [
    { "source": "/v1/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/api/$1" }
  ]
}
```

### Problem 2: Alibaba WAF Blocking Serverless IPs

**The real blocker:**

AgentRouter uses Alibaba Cloud WAF (Web Application Firewall). Vercel Edge Function IPs are flagged as bot/suspicious traffic.

**Symptoms:**
- HTML response with CAPTCHA challenge
- Contains `aliyun_waf` in the HTML
- Works from local machine, fails from Vercel

**Why it happens:**
- Vercel uses shared IP pools for Edge Functions
- These IPs have low reputation scores
- WAF sees serverless infrastructure as automated bot traffic

**Workarounds:**
1. Deploy to VPS with dedicated IP (DigitalOcean, Linode)
2. Use platform with better IP reputation (Railway, Fly.io, Render)
3. Run locally as a service

### Problem 3: Project State Corruption

Vercel caches project settings aggressively. Sometimes you need a clean slate.

**Nuclear option:**
```bash
# Delete everything
echo "y" | vercel project rm {project-name}
rm -rf .vercel
rm /home/workspace/.vercel/project.json  # global project link

# Fresh deploy
vercel --prod --yes
```

### Problem 4: Node.js vs Edge Runtime

Edge runtime is preferred for API proxies:
- Faster cold starts
- No `FUNCTION_INVOCATION_TIMEOUT` (5 min limit)
- Global distribution

**Edge function config:**
```typescript
export const config = {
  runtime: 'edge',
};
```

**Node.js runtime issues:**
- `FUNCTION_INVOCATION_FAILED` errors
- `FUNCTION_INVOCATION_TIMEOUT` on long requests
- Requires different fetch handling

## What Works Locally

Direct requests from a clean IP work perfectly:

```bash
curl -X POST https://agentrouter.org/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {API_KEY}" \
  -H "User-Agent: codex_cli_rs/0.101.0 (Mac OS 26.0.1; arm64) Apple_Terminal/464" \
  -H "Originator: codex_cli_rs" \
  -d '{"model": "deepseek-v4-flash", "messages": [{"role": "user", "content": "Hello"}]}'
```

## Key Takeaways

1. **Auth spoofing requires specific headers** - not just any User-Agent
2. **Vercel framework detection is flaky** - API patch may be needed
3. **Serverless IP reputation matters** - WAFs block known serverless ranges
4. **Edge runtime is better for proxies** - fewer timeout issues
5. **Clean recreations often fix mysterious errors** - don't fight corrupted state

## Files

```
routerproxy/
├── api/
│   └── chat/
│       └── completions.ts    # Main proxy handler (Edge runtime)
├── package.json              # Minimal - just name
├── vercel.json               # Rewrites for routing
└── AGENTS.md                 # This file
```

## Future Improvements

- Deploy to Railway or Fly.io for better IP reputation
- Add request/response logging for debugging
- Implement retry logic for transient failures
- Add support for streaming responses
