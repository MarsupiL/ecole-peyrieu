import { createContext, useContext } from 'react';
import type { FileWrite } from '../data/repository';
import type { State, Adult, Entry, Locale, Kind } from '../domain/types';
export interface AppContext {
  s: State;
  a: Adult;
  locale: Locale;
  t: (fr: string, en: string) => string;
  run: (fn: (s: State) => State, message?: string, files?: FileWrite[]) => Promise<void>;
  go: (route: string) => void;
  open: (e: Entry) => void;
  toast: (text: string) => void;
}
export const Context = createContext<AppContext | null>(null);
export const useApp = () => {
  const c = useContext(Context);
  if (!c) throw new Error('context');
  return c;
};
export const kindNames: Record<Kind, [string, string]> = {
  post: ['Actualités', 'News'],
  form: ['Démarches', 'Forms'],
  evaluation: ['Progrès', 'Progress'],
  poll: ['Consultations', 'Surveys'],
  event: ['Agenda', 'Calendar'],
  topic: ['Parents délégués', 'Parent representatives'],
  conversation: ['Messages', 'Messages'],
  request: ['Absences et départs', 'Absence & collection'],
};
export const roles: Record<string, [string, string]> = {
  guardian: ['Parent', 'Parent'],
  teacher: ['Enseignant', 'Teacher'],
  director: ['Direction', 'Director'],
  service: ['Périscolaire', 'Extended-day staff'],
  representative: ['Parent délégué', 'Representative'],
};
export const services: Record<string, [string, string]> = {
  canteen: ['Cantine', 'School meals'],
  care: ['Garderie', 'Childcare'],
  transport: ['Transport', 'Transport'],
};
export const statusNames: Record<string, [string, string]> = {
  notStarted: ['À commencer', 'Not started'],
  overdue: ['En retard', 'Overdue'],
  draft: ['Brouillon', 'Draft'],
  published: ['Publié', 'Published'],
  open: ['Ouvert', 'Open'],
  closed: ['Fermé', 'Closed'],
  archived: ['Archivé', 'Archived'],
  pending: ['En attente', 'Pending'],
  confirmed: ['Confirmé', 'Confirmed'],
  declined: ['Refusé', 'Declined'],
  completed: ['Terminé', 'Completed'],
  resolved: ['Résolu', 'Resolved'],
  cancelled: ['Annulé', 'Cancelled'],
  requested: ['Demandé', 'Requested'],
  cancellationRequested: ['Annulation demandée', 'Cancellation requested'],
  submitted: ['Transmis', 'Submitted'],
  reviewed: ['Vérifié', 'Reviewed'],
  reported: ['Signalé par le parent', 'Parent reported'],
  needsCorrection: ['À corriger', 'Needs correction'],
  active: ['Actif', 'Active'],
  invited: ['Invité', 'Invited'],
  suspended: ['Suspendu', 'Suspended'],
  expired: ['Expiré', 'Expired'],
  revoked: ['Révoqué', 'Revoked'],
  scheduled: ['Programmé', 'Scheduled'],
  allowed: ['Autorisé', 'Allowed'],
  refused: ['Refusé', 'Refused'],
  awaiting: ['Sans réponse', 'Awaiting response'],
  withdrawn: ['Retiré', 'Withdrawn'],
  approved: ['Approuvé', 'Approved'],
  returned: ['À reprendre', 'Returned'],
  none: ['Sans revue', 'No review'],
  available: ['Disponible', 'Available'],
  full: ['Complet', 'Full'],
  deadline: ['Délai dépassé', 'Past deadline'],
};
export const errors: Record<string, [string, string]> = {
  storageConflict: [
    'Une autre fenêtre a modifié la démo. Copiez votre saisie puis rechargez cette page avant de réessayer.',
    'Another window changed the demo. Preserve your input, then reload.',
  ],
  staleEntry: [
    'Ce contenu a été modifié depuis son ouverture. Copiez votre saisie puis rouvrez l’éditeur.',
    'This content changed while the editor was open.',
  ],
  invalidPreferences: [
    'Vérifiez les horaires et les préférences de notification.',
    'Check notification preferences and hours.',
  ],
  protectedAccount: [
    'Votre compte de direction est protégé contre le retrait de ses propres accès.',
    'Your director account cannot remove its own access.',
  ],
  invalidBirthDate: [
    'Indiquez une date de naissance valide, antérieure ou égale à aujourd’hui.',
    'Enter a valid date of birth on or before today.',
  ],
  invalidMembership: [
    'Vérifiez les rôles, les liens et les affectations.',
    'Check roles, links and assignments.',
  ],
  invalidRepresentative: [
    'Choisissez un parent vérifié ayant un enfant dans cette classe.',
    'Choose a verified parent with a child in this class.',
  ],
  invalidMandate: [
    'La fin du mandat doit être comprise entre aujourd’hui et la fin de l’année scolaire.',
    'The mandate must end between today and the end of the school year.',
  ],
  profilePhotoSize: [
    'Choisissez une photo non vide de 5 Mo maximum.',
    'Choose a non-empty photo up to 5 MB.',
  ],
  profilePhotoType: [
    'Choisissez une image JPEG, PNG ou WebP valide.',
    'Choose a valid JPEG, PNG or WebP image.',
  ],

  useRevision: [
    'Cette réponse est déjà transmise. Confirmez une révision pour conserver son historique.',
    'This response is already submitted. Confirm a revision to preserve its history.',
  ],
  denied: ['Accès refusé pour ce profil.', 'This persona cannot access this item.'],
  required: ['Complétez les champs obligatoires.', 'Please complete the required fields.'],
  confirmRequired: [
    'Confirmez la vérification des réponses.',
    'Confirm that you reviewed your answers.',
  ],
  deadline: [
    'Le délai est dépassé. Demandez une réouverture.',
    'The deadline has passed. Request reopening.',
  ],
  owner: [
    'Seul le premier répondant peut modifier cette réponse. Signalez une correction.',
    'Only the original respondent can edit. Flag a correction instead.',
  ],
  photoBlocked: [
    'Publication bloquée : une autorisation photo manque ou est refusée.',
    'Publication blocked: a photo permission is missing or refused.',
  ],
  pollLocked: [
    'Les réponses ont commencé. Le mode, le public et les choix sont verrouillés.',
    'Responses have started. Identity mode, audience and options are locked.',
  ],
  invalidDate: ['Vérifiez les dates de début et de fin.', 'Check the start and end dates.'],
  invalidCapacity: [
    'La capacité doit être un entier positif ou nul.',
    'Capacity must be a non-negative integer.',
  ],
  invalidFields: [
    'Vérifiez les identifiants et les conditions des questions.',
    'Check field IDs and conditions.',
  ],
  invalidFile: ['Le fichier est absent ou inaccessible.', 'The file is missing or inaccessible.'],
  fileSize: [
    'Choisissez un fichier non vide de 10 Mo maximum.',
    'Choose a non-empty file no larger than 10 MB.',
  ],
  fileType: [
    'Formats autorisés : PDF, JPEG, PNG, WebP. Le contenu doit correspondre au format.',
    'Allowed formats: PDF, JPEG, PNG, WebP. Contents must match the file type.',
  ],
  full: ['Cette séance fictive est complète.', 'This sample session is full.'],
  duplicate: ['Un enregistrement identique existe déjà.', 'A matching record already exists.'],
  reopenReason: [
    'Indiquez un motif et une nouvelle échéance future.',
    'Enter a reason and a new future deadline.',
  ],
  invalidImport: [
    'Vérifiez les noms, dates et classes importés.',
    'Check imported names, dates and classes.',
  ],
};
export function formatDate(value: string | undefined, locale: Locale, withTime = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'fr' ? 'fr-FR' : 'en-GB', {
    dateStyle: 'medium',
    ...(withTime ? { timeStyle: 'short' } : {}),
    timeZone: 'Europe/Paris',
  }).format(new Date(value.length === 10 ? `${value}T12:00:00Z` : value));
}
