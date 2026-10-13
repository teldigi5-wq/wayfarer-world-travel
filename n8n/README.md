# Wayfarer real AI beta — n8n + Groq

> **Supplier integration update (October 2026):** The retired Amadeus adapter was replaced with a separate protected server-only **SerpApi Google Flights / Hotels** search endpoint on this unmerged feature branch. Search prices are **not** verified seat/room inventory and may be cached. The existing Groq n8n agents are research assistants, not the source of these prices.

This **optional, disabled-by-default** beta adds actual Groq model calls orchestrated by an importable n8n workflow to the original deterministic Wayfarer planner. It does not replace the separate `wayfarer-journey-ai` Vercel deployment. Main and both production sites remain unchanged until this PR is reviewed, configured and deployed.

## Important: live supplier data is separate from Groq

The three Groq agents produce helpful itinerary ideas, not current airline seats, hotel availability, restaurant menus or local transit fares. The feature-branch `POST /api/travel-offers` is a **separate**, beta-code-gated Vercel server function calling SerpApi's Google Flights/Hotels search engines when `SERPAPI_API_KEY`, `WAYFARER_AI_BETA_TOKEN` and `WAYFARER_TRAVEL_ENABLED=true` are configured on **Preview**. Flight/hotel prices can be provider-derived search indications; unverified booking availability is not inferred. Food/transport price feeds are **not yet connected**.

**Important:** The returned provider search results are displayed beside the AI reports; this version does **not yet feed the supplier offers back into the n8n reasoning loop or persist AI itinerary revisions**. Do not claim the Groq agents automatically fetched or verified specific priced offers. See [SerpApi configuration and validation](../README.md#serpapi-google-travel-search--private-gated-beta).

## What is implemented

`index.html` and `ai-panel.mjs` present an opt-in AI Journey Research panel after a trip is built. `api/ai-plan.mjs` is a Vercel Node.js Function that validates the trip, checks a private beta access code, and forwards requests to an **HTTPS** n8n production webhook using separate server-only header authentication. n8n workflow `wayfarer-groq-agents.json` has eight nodes:

1. Authenticated Webhook receives a limited travel-planning payload.
2. Code node validates the trip and formats the destination query.
3. HTTP Request retrieves an encyclopedia excerpt from Wikipedia, if available. Failure is tolerated.
4. **Groq Destination Agent** reviews destination context.
5. **Groq Flight & Stay Agent** provides research guidance without inventing availability.
6. **Groq Journey Composer Agent** combines the earlier reports into pacing and budget guidance.
7. Code node verifies output shape and extracts the three agent reports.
8. Respond to Webhook returns JSON to Wayfarer.

Each named Groq agent makes a **real, separate** model request. The workflow uses the Groq chat-completions API with model `openai/gpt-oss-20b`; the model can be changed to one enabled for your Groq account. The encyclopedia lookup is a real external data request. This is a first phase of orchestration, **not** a flight or hotel inventory integration, automated booking agent, live routing agent, real-time visa verification system, or autonomous tool-calling travel research network. Model suggestions remain advisory.

## Configure n8n (manual owner steps)

1. Run n8n on an internet-reachable HTTPS instance that you control and are licensed to operate. Your own computer is sufficient for **local development only while it is running**; it is not always-on public hosting. Do not expose an unprotected n8n editor.
2. Import `n8n/wayfarer-groq-agents.json` via n8n's **Import from file** menu.
3. In GroqCloud, generate an API key. **Never paste it into GitHub, Wayfarer's frontend, or Vercel's public environment variables.**
4. In n8n, create an **HTTP Header Auth** credential: header name `Authorization`; value `Bearer <YOUR_GROQ_KEY>`. Select that credential on **all three Groq HTTP Request nodes**. Do not put the key directly in their request parameters.
5. Generate a long random webhook secret (at least 16 characters). In n8n create a **Webhook Header Auth** credential with header name `X-Wayfarer-Secret` and value the secret. Select this credential on the **Incoming Trip** Webhook.
6. Test the workflow in n8n using its test URL first. Verify the full three-agent output and Wikipedia-failure fallback, and examine execution-data retention settings.
7. Activate/publish the workflow and copy the actual **production** webhook URL, which ends in `/webhook/wayfarer-groq-plan`. It is NOT the `/webhook-test/` URL.

## Configure Vercel (manual owner steps)

For the `wayfarer-world-travel` project, add these **server-side** environment variables only to an authorized test/preview environment:

| Name | Meaning |
| --- | --- |
| `WAYFARER_AI_ENABLED` | `true` only when ready to test. Otherwise absent/false. |
| `WAYFARER_AI_BETA_TOKEN` | A strong, separate Wayfarer beta access code. Give only to approved testers. |
| `N8N_WEBHOOK_URL` | HTTPS n8n **production** webhook URL. |
| `N8N_WEBHOOK_AUTH` | The same long secret used in n8n **Webhook Header Auth** credential. |

The Groq key stays **inside n8n credentials**, not Vercel. No `NEXT_PUBLIC_` or client-exposed secrets are used. The beta access code is not a Groq key; it is submitted by a tester in the UI for each run and is never saved to browser storage. This is a controlled beta gate, **not** complete production user authentication or abuse prevention.

### Test safely

```sh
npm run check
npm test
```

Tests use Node.js built-ins, no dependency installation, payment method or Groq calls. They cover method/permission checks, invalid input, upstream response filtering, and secret non-disclosure. After deploying a **preview only**, build a test trip, enter the Wayfarer beta code and confirm three distinct AI reports. Test an invalid code, a disconnected n8n host, bad trip dates, timeout, and depleted Groq quota. Verify the exact Vercel preview functions and browser network console. Keep production disabled until the complete test passes.

### Security and cost constraints

- Never expose the raw n8n webhook publicly to website visitors. Vercel acts as the narrow proxy; n8n enforces a **different** header secret. Configure execution log retention and do not place passport numbers or personal identifiers in prompts.
- Beta access controls do **not** enforce per-user rate limits or costs. Add authentication, abuse controls, and quota limits before public traffic. If a beta code leaks, rotate it immediately.
- Groq has free-plan limits and may return HTTP 429; free calls are not an unlimited or guaranteed service. Review current Groq terms and model availability before enabling.
- Community n8n may be free to self-host subject to its Sustainable Use License. If monetizing Wayfarer, check permitted SaaS/backend use carefully, especially whether users can modify workflows; obtain licensing clarification if needed. Always-on hosting and third-party data APIs may cost money.
- This code includes **no actual airfares, live hotels, route travel times, verified visa requirements, checkout or booking**. Wikipedia gives background, not up-to-date travel operational truth.
- Users continue to get the existing deterministic planner when the AI feature is disabled or fails. Existing saved trips remain local.
- The other `wayfarer-journey-ai` Vercel site is a separate deployment and is **not automatically connected** by this PR.

References: [n8n Groq credentials](https://docs.n8n.io/integrations/builtin/credentials/groq/), [Groq chat API](https://console.groq.com/docs/api-reference), [Groq rate limits](https://console.groq.com/docs/rate-limits), [n8n licensing](https://support.n8n.io/article/can-i-use-your-license-for-my-use-case).

## Troubleshooting: agent ran but Assemble AI Reports fails

If the canvas shows green Groq HTTP request nodes but the **Assemble AI Reports** Code node reports `Groq agent reply missing: Journey Composer Agent`, the webhook and Groq HTTP requests were accepted; this does **not** mean Groq produced usable answer text. Inspect the Journey Composer Agent's **OUTPUT → JSON** and check `choices[0].message.content`, `choices[0].finish_reason`, and `usage.completion_tokens`. In particular, `finish_reason: "length"` with empty content typically indicates the response exhausted its token budget before generating a final answer. Don't copy private tokens or verbose reasoning traces into support screenshots.

**Fix an already imported n8n workflow in place:** open each Groq HTTP Request node, scroll to **Send Body → JSON**, and change the `JSON.stringify({...})` expression's request fields to include:

```js
model: "openai/gpt-oss-20b",
reasoning_effort: "low",
include_reasoning: false,
max_completion_tokens: 1200,
```

Retain the existing `temperature` and `messages` expressions, credentials, URL, and JSON.stringify wrapper. Groq's GPT-OSS defaults to medium reasoning effort. `low` reduces reasoning-token demand, and the larger completion budget allows more room for final user-facing text. This remains bounded and may increase token usage per test. Change and save **all three** Groq nodes. Do **not** re-import an updated JSON file on top of your credentialed workflow without backing it up first, because imported nodes can lose local credential selections. Run a **new** single-event test by choosing Execute Workflow, waiting for its test webhook listener, then POSTing the sample trip again. Check all three final text fields before publishing.

Groq references: https://console.groq.com/docs/model/openai/gpt-oss-20b and https://console.groq.com/docs/reasoning .
