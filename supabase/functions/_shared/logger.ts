const LOG_LEVEL = Deno.env.get("LOG_LEVEL") || "info";

const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => {
    if (levels[LOG_LEVEL] <= 0) console.log(JSON.stringify({ level: "debug", msg, ...data, ts: new Date().toISOString() }));
  },
  info: (msg: string, data?: Record<string, unknown>) => {
    if (levels[LOG_LEVEL] <= 1) console.log(JSON.stringify({ level: "info", msg, ...data, ts: new Date().toISOString() }));
  },
  warn: (msg: string, data?: Record<string, unknown>) => {
    if (levels[LOG_LEVEL] <= 2) console.warn(JSON.stringify({ level: "warn", msg, ...data, ts: new Date().toISOString() }));
  },
  error: (msg: string, data?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: "error", msg, ...data, ts: new Date().toISOString() }));
  },
};
