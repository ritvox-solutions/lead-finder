/**
 * Deterministic date/time formatting for display.
 *
 * `toLocaleString`/`toLocaleTimeString` are NOT safe here: Node's ICU and the
 * browser's ICU render the same `en-US` options differently (e.g. "PM" vs
 * "pm"), which breaks React hydration. These helpers hand-format every field
 * so the output is byte-identical on server and client.
 */

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Hour on a 12-hour clock, plus uppercase AM/PM marker. */
function h12(d: Date): { h: string; ampm: "AM" | "PM" } {
  const h24 = d.getHours();
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  return { h: String(h), ampm };
}

/** e.g. "5:42:51 PM" */
export function formatTime(iso: string): string {
  const d = new Date(iso);
  const { h, ampm } = h12(d);
  return `${h}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${ampm}`;
}

/** e.g. "8/16/2026, 5:42:51 PM" */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const { h, ampm } = h12(d);
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}, ${h}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())} ${ampm}`;
}
