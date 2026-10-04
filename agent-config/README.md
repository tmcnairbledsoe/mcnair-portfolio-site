# Portfolio agent

Reusable OpenAI Agents API configuration for this repository. This is a local development tool, not part of the website or its deployment.

The existing `OPENAI_API_KEY` in ignored `.env.local` is reused without changing it. `OPENAI_PROJECT_ID` is optional; the client falls back to the existing project selection in ignored `.agents/session.json`, then to the key's project. Secrets and account-specific agent IDs remain outside tracked configuration. Never upload `.env` files to the hosted workspace.

## Setup and verification

From the repository root, with Node.js 20 or newer:

```powershell
node scripts/portfolio-agent.js validate
node scripts/portfolio-agent.js register
node scripts/portfolio-agent.js check
```

Registration creates a reusable agent and verifies the saved settings. It does not create a session, allocate a sandbox, or run model inference. Its ID is stored in ignored `.agents/portfolio-agent.json`. Registration reuses a matching agent rather than duplicating it; it reports configuration drift rather than overwriting a saved agent.

## Task profiles

| Profile | Model / effort | Purpose |
| --- | --- | --- |
| maintenance | GPT-6.1 Sol / medium | Local repair in an OpenAI-hosted sandbox; patch and verification report |
| review | GPT-6.1 Sol / medium | Read-only review of supplied current code |
| resume | GPT-6 Luna / low | Fact-preserving resume rewriting with a JSON schema |
| photo-edit | GPT-6 Luna / low | Remove the three top location photos; return two complete source files |

All profiles disable web search and delegation, and select the default service tier. Browser tests are not available in the review profile's `none` environment; findings must distinguish static evidence from behavior requiring browser validation. Maintenance has the hosted environment's default tools. Add outside research only for tasks that require it.

## Prepare a task without paying for a run

Create a text file containing the current request, baseline revision, acceptance criteria, and relevant source/diff or resume. For maintenance, specify how to obtain the current source in the separate hosted workspace; a sandbox cannot see the local checkout automatically. Use a reachable commit or a separately uploaded non-secret source archive for uncommitted changes.

```powershell
node scripts/portfolio-agent.js prepare review .agents/my-review-task.txt
```

This writes ignored `.agents/request-review.json`, ready for `POST /v1/agents/sessions`. **It does not send it.** Submitting that request starts paid work and requires the user's authorization. Each prepared request starts a fresh session, uses the saved agent ID, and supplies the full task-specific settings. Do not append unrelated tasks to an existing session.

The JSON profiles are local session overrides; only maintenance is the reusable agent's saved default. The schemas constrain structure, not factual accuracy or semantic correctness. Validate resume facts against the source and validate photo results contain exactly both unique allowed paths before applying them. Handle failed/cancelled turns and refusals before consuming outputs. Do not treat an idle session as proof of task success. Download maintenance artifacts before removing its session.

No quality, latency, or cost comparison has been run. Before changing defaults, compare current prompts, revised prompts, and revised profiles on the fixed eight-case pilot described in the review, with two repetitions each (48 task runs). Measure task success, scope violations, input/cached/output/reasoning tokens, tool and sandbox charges, retries, and end-to-end latency. Require exact fact preservation, scoped changes, and relevant checks passing. This evaluation remains approval-gated.

API contracts: [agent configuration](https://developers.openai.com/api/docs/guides/agents-api/configuration), [create agent](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/agents/methods/create), [session lifecycle](https://developers.openai.com/api/docs/guides/agents-api/sessions).
