import { tr, type Field, type Text } from '../domain/types';
export const templates: { id: string; title: Text; body: Text; fields: Field[] }[] = [
  {
    id: 'annual',
    title: tr('Dossier de rentrée', 'Beginning-of-year dossier'),
    body: tr(
      'Vérifiez les informations de l’enfant et les contacts utiles.',
      'Review child information and useful contacts.',
    ),
    fields: [
      { id: 'child', label: tr('Nom de l’enfant', 'Child name'), type: 'text', required: true },
      {
        id: 'emergency',
        label: tr('Contact d’urgence', 'Emergency contact'),
        type: 'text',
        required: true,
      },
      {
        id: 'needs',
        label: tr('Un aménagement est-il nécessaire ?', 'Are accommodations needed?'),
        type: 'select',
        required: true,
        options: [tr('Non', 'No'), tr('Oui', 'Yes')],
      },
      {
        id: 'details',
        label: tr('Précisions pratiques', 'Practical details'),
        type: 'textarea',
        required: true,
        condition: { field: 'needs', value: '1' },
      },
    ],
  },
  {
    id: 'outing',
    title: tr('Autorisation de sortie', 'Outing permission'),
    body: tr(
      'Veuillez donner votre accord ou votre refus.',
      'Please give your approval or refusal.',
    ),
    fields: [
      {
        id: 'permission',
        label: tr('Participation', 'Participation'),
        type: 'consent',
        required: true,
      },
    ],
  },
  {
    id: 'contacts',
    title: tr('Contacts et personnes autorisées', 'Contacts and authorised collectors'),
    body: tr(
      'Vérifiez les personnes à contacter et les modalités de départ.',
      'Review contacts and collection arrangements.',
    ),
    fields: [
      {
        id: 'emergency',
        label: tr('Contact d’urgence', 'Emergency contact'),
        type: 'text',
        required: true,
      },
      {
        id: 'collectors',
        label: tr('Personnes autorisées à récupérer l’enfant', 'Authorised collectors'),
        type: 'textarea',
        required: true,
      },
    ],
  },
  {
    id: 'care',
    title: tr('Informations pratiques de santé', 'Practical care information'),
    body: tr(
      'Informations fictives utiles aux équipes responsables. Les justificatifs sont réservés au vérificateur désigné.',
      'Fictional information for responsible teams. Evidence is restricted to the designated reviewer.',
    ),
    fields: [
      {
        id: 'care',
        label: tr('Consignes pratiques', 'Practical instructions'),
        type: 'textarea',
        required: true,
      },
      {
        id: 'evidence',
        label: tr('Justificatif confidentiel fictif', 'Fictional confidential evidence'),
        type: 'file',
        required: false,
        restricted: true,
      },
    ],
  },
  {
    id: 'photo',
    title: tr('Autorisations photo', 'Photo permissions'),
    body: tr(
      'Ce formulaire recueille votre avis. Les choix applicables sont gérés séparément dans le profil de l’enfant.',
      'This form collects your response. Effective permissions are managed separately in the child profile.',
    ),
    fields: [
      {
        id: 'permission',
        label: tr('Diffusion dans le fil privé de la classe', 'Private class feed'),
        type: 'consent',
        required: true,
      },
    ],
  },
  {
    id: 'insurance',
    title: tr('Attestation d’assurance', 'Insurance certificate'),
    body: tr('Joignez un document fictif.', 'Attach a fictional document.'),
    fields: [
      {
        id: 'file',
        label: tr('Attestation fictive', 'Fictional certificate'),
        type: 'file',
        required: true,
      },
    ],
  },
  {
    id: 'legacy',
    title: tr('Document PDF à compléter', 'PDF document to complete'),
    body: tr(
      'Téléchargez le modèle, complétez-le hors de l’application et joignez votre fichier fictif.',
      'Download the template, complete it outside the app, and attach your fictional file.',
    ),
    fields: [
      { id: 'file', label: tr('PDF complété', 'Completed PDF'), type: 'file', required: true },
    ],
  },
];
