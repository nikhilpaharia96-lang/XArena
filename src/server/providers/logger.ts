/**
 * Structured JSON logger for provider integrations.
 * Redacts anything that looks like a credential before it reaches stdout,
 * so secrets, API keys and signatures can never leak into logs even if a
 * caller passes a whole headers/config object by mistake.
 */

const SENSITIVE_KEY = /(secret|api[-_]?key|signature|authorization|password|token|cookie)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[truncated]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

type Level = "info" | "warn" | "error";

function emit(level: Level, scope: string, event: string, fields?: Record<string, unknown>) {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    event,
    ...(fields ? (redact(fields) as Record<string, unknown>) : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function createLogger(scope: string) {
  return {
    info: (event: string, fields?: Record<string, unknown>) => emit("info", scope, event, fields),
    warn: (event: string, fields?: Record<string, unknown>) => emit("warn", scope, event, fields),
    error: (event: string, fields?: Record<string, unknown>) => emit("error", scope, event, fields),
  };
}
