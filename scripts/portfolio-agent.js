// Local agent setup only. No command in this client starts model inference.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const root = path.resolve(__dirname, "..");
const configDir = path.join(root, "agent-config");
const statePath = path.join(root, ".agents", "portfolio-agent.json");
const config = JSON.parse(fs.readFileSync(path.join(configDir, "profiles.json"), "utf8"));
const shared = fs.readFileSync(path.join(configDir, "instructions.md"), "utf8").trim();

function object(properties) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}
const string = { type: "string" };
const strings = { type: "array", items: string };
const schemas = {
  resume: object({
    headline: string, summary: string,
    skills: { type: "array", items: object({ category: string, items: strings }) },
    experience: { type: "array", items: object({ title: string, employer: string, location: string, dates: string, bullets: strings }) },
    education: strings,
  }),
  files: object({ files: {
    type: "array", items: object({
      path: { type: "string", enum: ["wedding-site/src/components/Location/Location.js", "wedding-site/src/components/Location/Location.css"] },
      content: string,
    }),
  } }),
};

function settings(profileName) {
  const profile = config.profiles[profileName];
  if (!profile) throw new Error(`Unknown profile: ${profileName}`);
  return {
    model: profile.model,
    instructions: `${shared}\n\nCurrent task profile: ${profileName}\n${profile.instructions}`,
    reasoning: { effort: profile.effort, summary: "auto" },
    text: {
      format: profile.format === "text" ? { type: "text" } : { type: "json_schema", schema: schemas[profile.format] },
      verbosity: profile.verbosity,
    },
    service_tier: "default",
    tools: [],
    multi_agent: { enabled: false },
  };
}

function definition() {
  return {
    name: config.name,
    metadata: { repository: "mcnair-portfolio-site", configuration_version: config.version },
    ...settings(config.defaultProfile),
  };
}

function validate() {
  assert(shared.length > 0);
  for (const name of Object.keys(config.profiles)) {
    const profile = config.profiles[name];
    assert(["none", "openai_hosted"].includes(profile.environment));
    assert(["low", "medium", "high"].includes(profile.verbosity));
    assert(["text", "resume", "files"].includes(profile.format));
    const supported = profile.model === "gpt-6.1-sol"
      ? ["low", "medium", "high", "xhigh", "max"]
      : profile.model === "gpt-6-luna" ? ["none", "low", "medium", "high", "xhigh", "max"] : [];
    assert(supported.includes(profile.effort), `Unsupported effort/model in ${name}`);
    settings(name);
  }
  return definition();
}

function localEnvironment() {
  const values = {};
  const envPath = path.join(root, ".env.local");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?(OPENAI_API_KEY|OPENAI_PROJECT_ID)\s*=\s*(.*?)\s*$/);
      if (match) {
        let value = match[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        else value = value.replace(/\s+#.*$/, "");
        values[match[1]] = value;
      }
    }
  }
  // Reuse this repository's existing local project selection without tracking it.
  const legacyStatePath = path.join(root, ".agents", "session.json");
  const legacyProject = fs.existsSync(legacyStatePath)
    ? JSON.parse(fs.readFileSync(legacyStatePath, "utf8")).project_id : undefined;
  return {
    key: values.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
    project: values.OPENAI_PROJECT_ID || process.env.OPENAI_PROJECT_ID || legacyProject,
  };
}

async function request(endpoint, method = "GET", body) {
  const { key, project } = localEnvironment();
  if (!key) throw new Error("No OPENAI_API_KEY found in .env.local or the environment.");
  const headers = { Authorization: `Bearer ${key}`, "OpenAI-Beta": "agents=v1" };
  if (project) headers["OpenAI-Project"] = project;
  if (body) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`https://api.openai.com/v1${endpoint}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error("Agent management request failed or timed out. No automatic retry was made; check saved agents before retrying registration.");
  }
  if (!response.ok) {
    // Include only a redacted diagnostic message, never payloads or headers.
    const diagnostic = await response.json().catch(() => ({}));
    const message = String(diagnostic.error?.message || "Check key permissions and project access.")
      .split(key).join("[REDACTED]").replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]").slice(0, 800);
    throw new Error(`Agent management ${method} ${endpoint.split("?")[0]} returned HTTP ${response.status}: ${message}`);
  }
  return response.json();
}

function writeLocal(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
}

function state() {
  if (!fs.existsSync(statePath)) throw new Error("Register the agent first.");
  const saved = JSON.parse(fs.readFileSync(statePath, "utf8"));
  if (!/^agent_[A-Za-z0-9_-]+$/.test(saved.agent_id)) throw new Error("Invalid saved agent ID.");
  return saved;
}

function verifyAgent(agent) {
  const expected = definition();
  for (const field of ["name", "model", "instructions", "reasoning", "text", "service_tier", "tools"]) {
    assert.deepEqual(agent[field], expected[field], `Saved configuration differs: ${field}`);
  }
  assert.equal(agent.multi_agent.enabled, false, "Saved agent has delegation enabled.");
}

async function main() {
  const [, , command = "validate", profileName, taskFile] = process.argv;
  const desired = validate();
  if (command === "validate") {
    console.log(`Validated ${config.name} and ${Object.keys(config.profiles).length} task profiles. No API requests.`);
    return;
  }
  if (command === "register") {
    let agent;
    if (fs.existsSync(statePath)) agent = await request(`/agents/${state().agent_id}`);
    else {
      // Search before creation so a failed local save does not create duplicates on retry.
      let cursor;
      do {
        const page = await request(`/agents?limit=100${cursor ? `&after=${encodeURIComponent(cursor)}` : ""}`);
        agent = page.data.find(item => item.name === config.name && item.metadata?.repository === desired.metadata.repository);
        if (agent || !page.has_more) break;
        cursor = page.last_id;
        if (!cursor) throw new Error("Cannot safely paginate saved agents.");
      } while (cursor);
      if (!agent) agent = await request("/agents", "POST", desired);
    }
    writeLocal(statePath, { agent_id: agent.id, name: agent.name, model: agent.model, configuration_version: config.version });
    verifyAgent(await request(`/agents/${agent.id}`));
    console.log(JSON.stringify({ agent_id: agent.id, name: agent.name, verified: true, inference_started: false }));
    return;
  }
  if (command === "check") {
    const agent = await request(`/agents/${state().agent_id}`);
    verifyAgent(agent);
    console.log(JSON.stringify({ agent_id: agent.id, name: agent.name, model: agent.model, verified: true, inference_started: false }));
    return;
  }
  if (command === "prepare") {
    const profile = config.profiles[profileName];
    if (!profile || !taskFile) throw new Error("Usage: node scripts/portfolio-agent.js prepare <profile> <task-file>");
    const input = fs.readFileSync(path.resolve(taskFile), "utf8");
    if (!input.trim()) throw new Error("Task input is empty.");
    if (/\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/.test(input)) throw new Error("Task input appears to contain a secret. Remove credentials before preparing it.");
    const payload = { agent_id: state().agent_id, agent: settings(profileName), environment: { type: profile.environment }, input };
    const output = path.join(root, ".agents", `request-${profileName}.json`);
    writeLocal(output, payload);
    console.log(`Prepared a fresh-session request at ${output}. Nothing submitted; submitting it will incur usage charges.`);
    return;
  }
  throw new Error("Commands: validate, register, check, prepare <profile> <task-file>");
}

main().catch(error => {
  // Assertion details may contain prompts; report the concise message only.
  console.error(String(error.message).replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]"));
  process.exitCode = 1;
});
