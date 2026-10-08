import { uid, type ClassGroup, type State } from '../domain/types';

export const schoolClasses = (year: string): ClassGroup[] => [
  { id: 'ps', name: 'PS / MS / GS', year, archived: false },
  { id: 'cp', name: 'CP / CE1', year, archived: false },
  { id: 'ce', name: 'CE1 / CE2', year, archived: false },
  { id: 'ce2cm1', name: 'CE2 / CM1', year, archived: false },
  { id: 'cm', name: 'CM1 / CM2', year, archived: false },
];

const compact = (name: string) => name.replace(/\s/g, '').toUpperCase();

// Update the original demo groups once, keeping record IDs, assignments and local edits.
export function upgradeClassRoster(s: State): State {
  if (s.seedVersion !== 1) return s;
  const n = structuredClone(s);
  for (const group of n.classes) {
    if (group.year !== n.year || group.archived) continue;
    if (group.id === 'ps' && compact(group.name) === 'PS/MS') group.name = 'PS / MS / GS';
    if (group.id === 'cp' && compact(group.name) === 'GS/CP') group.name = 'CP / CE1';
  }
  if (!n.classes.some((g) => g.year === n.year && !g.archived && compact(g.name) === 'CE2/CM1')) {
    const newGroup = schoolClasses(n.year).find((g) => g.id === 'ce2cm1')!;
    if (n.classes.some((g) => g.id === newGroup.id)) newGroup.id = uid();
    const index = n.classes.findIndex((g) => g.id === 'cm' && g.year === n.year && !g.archived);
    n.classes.splice(index < 0 ? n.classes.length : index, 0, newGroup);
  }
  n.seedVersion = 2;
  n.revision++;
  return n;
}
