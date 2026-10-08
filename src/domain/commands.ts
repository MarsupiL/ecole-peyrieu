import { uid, type State, type Adult } from './types';
import { active } from './policy';

export class RuleError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
export function requireRule(ok: unknown, code = 'denied'): asserts ok {
  if (!ok) throw new RuleError(code);
}
export function change(
  s: State,
  actor: string,
  action: string,
  resource: string,
  fn: (next: State, a: Adult) => void,
): State {
  const next = structuredClone(s);
  const a = next.adults.find((a) => a.id === actor);
  if (!a || !active(next, a)) throw new RuleError('denied');
  fn(next, a);
  next.revision++;
  const auditActor =
    action === 'pollResponse' && next.entries.some((e) => e.id === resource && e.anonymous)
      ? 'anonymous'
      : actor;
  next.audit.push({ id: uid(), actor: auditActor, action, resource, at: next.clock });
  return next;
}
