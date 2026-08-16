import { ImapFlow } from "imapflow";
import "dotenv/config";

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing ${key} in .env`);
  return v;
}

export interface ScannedReply {
  from: string;
  subject: string;
  snippet: string;
  /** Business name we think this reply is about (heuristic from subject). */
  businessName: string;
  positive: boolean;
  positiveReasons: string[];
  messageId: string;
}

const POSITIVE_HINTS = [
  "yes",
  "interested",
  "let's do it",
  "lets do it",
  "go ahead",
  "sounds good",
  "love it",
  "how much",
  "price",
  "pricing",
  "quote",
  "send details",
  "more info",
  "book",
  "schedule",
  "start",
  "when can",
  "tell me more",
  "what would it cost",
  "count me in",
  "happy to",
];

const NEGATIVE_HINTS = ["no thanks", "not interested", "stop", "unsubscribe", "not now", "don't contact"];

/** Only scan replies to OUR outreach (subject starts with Re: + our pitch prefix). */
const REPLY_SUBJECT = /^Re(?:\:\s*|\s+)(?:Quick note about your website|Fw:)/i;

/** Trim outbound noise: reply-lines, signatures, quoted blocks. */
function snippetFrom(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];
  for (const line of lines) {
    if (/^(On .*wrote:|>+ |-----Original Message|From:|Sent:|To:|Cc:|Subject:)/i.test(line)) break;
    kept.push(line);
  }
  return kept.join(" ").replace(/\s+/g, " ").trim().slice(0, 500);
}

function detectBusiness(subject: string): string {
  const m = subject.match(/Re:\s*(?:\[[^\]]*\]\s*)?([^,]*?)$/i);
  return m ? m[1].trim().replace(/^Quick note about your website,\s*/i, "") : "unknown";
}

function classify(text: string): { positive: boolean; reasons: string[] } {
  const lower = ` ${text.toLowerCase()} `;
  const neg = NEGATIVE_HINTS.some((h) => lower.includes(` ${h}`));
  const pos = POSITIVE_HINTS.filter((h) => lower.includes(` ${h}`));
  return { positive: !neg && pos.length > 0, reasons: pos };
}

// 60s hard cap so a stalled/giant-mailbox never hangs the CLI.
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: NodeJS.Timeout;
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, rej) => {
        t = setTimeout(() => rej(new Error(`${label} timed out after ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    clearTimeout(t!);
  }
}

/**
 * Connect to Gmail IMAP and scan recent messages (default: last 100 in INBOX)
 * for replies to outreach. Returns replies that look positive.
     * Bounded by a 60s hard timeout so it always terminates.
     */
    export async function scanInbox(max: number = 100): Promise<ScannedReply[]> {
      const client = new ImapFlow({
        host: "imap.gmail.com",
        port: 993,
        secure: true,
        auth: { user: env("GMAIL_USER"), pass: env("GMAIL_APP_PASSWORD") },
        logger: false,
      });

      // ImapFlow emits 'error' on connection-level failures (e.g. ETIMEOUT,
      // ECONNREFUSED). With no 'error' listener, Node throws an unhandled error
      // event that crashes the whole agent process. Attach the listener the
      // instant the client is constructed (before `connect()` is ever called) so
      // there is never a window where a connection error escapes into the event
      // loop uncaught. Route the first error into the promise chain and ignore
      // any subsequent ones after we've already settled.
      let rejectConnectionFn: ((e: unknown) => void) | undefined;
      let settled = false;
      const rejectConnection = (e: unknown) => {
        if (settled) return;
        settled = true;
        rejectConnectionFn?.(e instanceof Error ? e : new Error(String(e)));
      };
      const connErrPromise = new Promise<never>((_, rej) => {
        rejectConnectionFn = rej as (e: unknown) => void;
      });
      client.on("error", rejectConnection);

      const scanPromise = (async () => {
        const results: ScannedReply[] = [];
        try {
          await client.connect();
        } catch (e) {
          rejectConnection(e);
          throw e;
        }
        try {
          const lock = await client.getMailboxLock("INBOX");
          try {
            const meta = await client.fetch(
              { seq: `*:${Math.max(1, max)}` },
              { source: false, envelope: true }
            );
            for await (const msg of meta) {
              const env = msg.envelope;
              if (!env) continue;
              const subject = env.subject ?? "";
              if (!REPLY_SUBJECT.test(subject)) continue;
              const { positive, reasons } = classify(subject);
              results.push({
                from: env.from?.[0]?.address ?? "unknown",
                subject,
                snippet: subject,
                businessName: detectBusiness(subject),
                positive,
                positiveReasons: reasons,
                messageId: env.messageId ?? "",
              });
            }
          } finally {
            lock.release();
          }
        } finally {
          try {
            await client.logout();
          } catch {
            /* IMAP connection already dropped; safe to ignore. */
          }
        }
        return results;
      })();

      return withTimeout(Promise.race([scanPromise, connErrPromise]), 60000, "check-replies");
    }

    export { POSITIVE_HINTS };