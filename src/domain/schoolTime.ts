/** School wall-clock inputs are Europe/Paris; persisted values and timed ICS events are UTC. */
export function parisInput(instant?: string): string {
  if (!instant || !Number.isFinite(Date.parse(instant))) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
export function parisInstant(input: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input)) return '';
  // Paris is UTC+1 or UTC+2 for this demo's contemporary school years.
  // A repeated fall-back time resolves to the later occurrence; nonexistent spring times are invalid.
  const base = Date.parse(`${input}:00Z`);
  for (const offset of [1, 2]) {
    const candidate = new Date(base - offset * 3600000).toISOString();
    if (parisInput(candidate) === input) return candidate;
  }
  return '';
}
