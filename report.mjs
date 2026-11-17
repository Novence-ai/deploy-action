// Turns the CLI's --json envelope into step outputs and a job summary.
// Usage: novence deploy --json | node report.mjs <cli exit code>
import { appendFileSync } from "node:fs";

const exitCode = Number(process.argv[2] ?? 0);

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

/** The envelope is the last JSON object on stdout; anything before it is ignored. */
function parseEnvelope(text) {
  const start = text.lastIndexOf("\n{") + 1;
  for (const candidate of [text.slice(start), text]) {
    try {
      const value = JSON.parse(candidate.trim());
      if (value && typeof value === "object") return value;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

const result = parseEnvelope(raw) ?? {};
const status = typeof result.status === "string" ? result.status : exitCode === 0 ? "live" : "failed";

/** Outputs are single-line; strip anything that could start a new key. */
const clean = (value) => (typeof value === "string" ? value.replace(/[\r\n]/g, "") : "");

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    [
      `url=${clean(result.url)}`,
      `preview-url=${clean(result.previewUrl)}`,
      `deployment-id=${clean(result.deploymentId)}`,
      `status=${clean(status)}`,
      "",
    ].join("\n")
  );
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = [];
  if (result.ok) {
    lines.push(`### Deployed to Novence`, "", `**Live:** ${clean(result.url)}`);
    if (result.previewUrl) lines.push(`**Preview:** ${clean(result.previewUrl)}`);
    const counts = [`${Number(result.files) || 0} files uploaded`];
    if (Number(result.removed) > 0) counts.push(`${Number(result.removed)} removed`);
    lines.push("", counts.join(", "));
    if (result.checks?.skipped) lines.push("", "Quality checks were skipped.");
    else if (result.checks?.passed === true) lines.push("", "Quality checks passed.");
  } else if (result.pending) {
    lines.push(
      `### Novence deploy still ${clean(status)}`,
      "",
      "The files are uploaded and the deploy carries on; it had not gone live when the wait ran out.",
      result.url ? `It will be live at ${clean(result.url)}.` : ""
    );
  } else {
    lines.push(`### Novence deploy failed`, "", clean(result.error) || "The deploy did not complete. See the step log.");
  }
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.filter((l) => l !== undefined).join("\n") + "\n");
}
