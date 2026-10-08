import {
  newEntry,
  tr,
  type State,
  type Adult,
  type Child,
  type Entry,
  type PhotoUse,
  type Service,
} from '../domain/types';
import { schoolClasses } from './classes';
export function seed(at = new Date().toISOString()): State {
  const date = new Date(at);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  date.setUTCHours(8, 0, 0, 0);
  const now = date.toISOString();
  const day = (n: number, h = 8) => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() + n);
    d.setUTCHours(h);
    return d.toISOString();
  };
  const y = date.getUTCFullYear() - (date.getUTCMonth() < 8 ? 1 : 0);
  const year = `${y}–${y + 1}`;
  const adult = (
    id: string,
    name: string,
    roles: Adult['roles'],
    classes: string[] = [],
    children: string[] = [],
    services: Service[] = [],
  ): Adult => ({
    id,
    name,
    roles,
    classes,
    children,
    services,
    status: 'active',
    representativeClasses: [],
    mandateEnd: `${y + 1}-08-31`,
    reviewers: [],
    locale: 'fr',
    contact: `${id}@example.invalid`,
    quietStart: 20,
    quietEnd: 7,
    eventReminder: 24,
    taskReminders: true,
    notificationCategories: [
      'post',
      'form',
      'evaluation',
      'poll',
      'event',
      'topic',
      'conversation',
      'request',
    ],
    availableStart: 8,
    availableEnd: 18,
    year,
  });
  const adults = [
    adult('alice', 'Alice Martin', ['guardian'], [], ['c1', 'c2']),
    adult('thomas', 'Thomas Martin', ['guardian'], [], ['c1', 'c2']),
    adult('ines', 'Inès Morel', ['guardian', 'representative'], [], ['c3']),
    adult('luc', 'Luc Petit', ['guardian'], [], ['c4']),
    adult('emma', 'Emma Laurent', ['teacher'], ['ce', 'cp']),
    adult('hugo', 'Hugo Simon', ['teacher'], ['ce']),
    adult('leonie', 'Léonie Bernard', ['teacher'], ['ps', 'cm']),
    adult('director', 'Camille Roussel', ['director']),
    adult('nora', 'Nora Dubois', ['service'], [], [], ['canteen', 'care']),
    adult('sam', 'Sam Leroy', ['service'], [], [], ['canteen', 'care']),
    adult('bus', 'Alex Rivière', ['service'], [], [], ['transport']),
  ];
  adults[2].representativeClasses = ['ce'];
  adults[7].reviewers = ['c1', 'c2', 'c3', 'c4'];
  const names = [
    'Louise Martin',
    'Jules Martin',
    'Mila Morel',
    'Noé Petit',
    'Lina Fontaine',
    'Gabriel Robin',
    'Adèle Masson',
    'Sacha Perrin',
    'Rose Garnier',
    'Léon Duval',
    'Iris Chevalier',
    'Adam Mercier',
  ];
  const classIds = ['ce', 'cp', 'ce', 'cm', 'ps', 'ps', 'cp', 'cm', 'ce', 'cp', 'cm', 'ps'];
  const children: Child[] = names.map((name, i) => {
    const guardians = i < 2 ? ['alice', 'thomas'] : i === 2 ? ['ines'] : i === 3 ? ['luc'] : [];
    return {
      id: `c${i + 1}`,
      name,
      dob: `${y - 7}-03-${String(i + 10).padStart(2, '0')}`,
      classId: classIds[i],
      guardians,
      services: ['canteen', 'care', 'transport'],
      year,
      emergency: 'Contact fictif · 00 00 00 00 00',
      collectors: 'Responsables légaux / Legal guardians',
      care:
        i === 0
          ? tr(
              'Allergie fictive aux noisettes. Consulter les consignes validées.',
              'Fictional hazelnut allergy. Refer to the reviewed care instructions.',
            )
          : tr('Aucune information signalée.', 'No information reported.'),
      reviewedCare:
        i === 0
          ? tr(
              'Exemple : repas sans noisettes ; référent à contacter.',
              'Example: hazelnut-free meal; contact the designated staff member.',
            )
          : tr('Aucune consigne particulière.', 'No special instructions.'),
      careStatus: 'reviewed',
      diet: tr('Aucune autre restriction médicale.', 'No other medical restriction.'),
      familyDiet: tr('Aucune préférence signalée.', 'No preference reported.'),
      support: tr(
        'Aménagements à confirmer avec la famille.',
        'Accommodations to confirm with the family.',
      ),
      vaccination: 'awaiting',
      evidence: [],
      consents: Object.fromEntries(
        (['class', 'school', 'print', 'website', 'social'] as PhotoUse[]).map((use) => [
          use,
          Object.fromEntries(
            guardians.map((g) => [
              g,
              use === 'class'
                ? 'allowed'
                : use === 'school'
                  ? g === 'thomas'
                    ? 'refused'
                    : 'allowed'
                  : 'awaiting',
            ]),
          ),
        ]),
      ) as Child['consents'],
      consentVersion: 1,
    };
  });
  const entries: Entry[] = [];
  const add = (
    id: string,
    kind: Entry['kind'],
    title: [string, string],
    body: [string, string],
    author: string,
    patch: Partial<Entry> = {},
  ) => {
    const e = {
      ...newEntry(kind, author, year, now),
      id,
      title: tr(...title),
      body: tr(...body),
      status: 'published' as const,
      ...patch,
    };
    entries.push(e);
    return e;
  };
  add(
    'welcome',
    'post',
    ['Une nouvelle semaine à l’école', 'A new week at school'],
    [
      'Au programme : lectures partagées, découverte des arbres et préparation de notre sortie. Retrouvez ici les nouvelles de la classe.',
      'This week: shared reading, discovering trees and preparing our outing. Follow the latest classroom news here.',
    ],
    'emma',
    { audience: { type: 'class', ids: ['ce'] }, pinned: true },
  );
  add(
    'library',
    'post',
    ['La bibliothèque voyage dans les classes', 'The library comes to the classroom'],
    [
      'Chaque enfant pourra choisir un livre à emporter vendredi. Pensez au petit sac en tissu.',
      'Each child can choose a book to take home on Friday. Please bring a small cloth bag.',
    ],
    'director',
  );
  add(
    'canteen-news',
    'post',
    ['Le menu de la semaine', 'This week’s lunch menu'],
    [
      'Légumes de saison et découverte des saveurs. Les réservations restent à gérer sur Mon Espace Famille.',
      'Seasonal vegetables and new flavours. Real bookings are still managed in Mon Espace Famille.',
    ],
    'nora',
    { audience: { type: 'service', ids: ['canteen'] } },
  );
  add(
    'private-cm',
    'post',
    ['Atelier des grands', 'Older pupils’ workshop'],
    ['Préparation de l’atelier de sciences.', 'Preparing the science workshop.'],
    'leonie',
    { audience: { type: 'class', ids: ['cm'] } },
  );
  const annual = add(
    'annual',
    'form',
    ['Dossier de rentrée', 'Beginning-of-year dossier'],
    [
      'Vérifiez les informations de votre enfant. Une réponse par enfant, partagée avec ses responsables autorisés.',
      'Review your child’s information. One response per child, shared with their authorised guardians.',
    ],
    'director',
    {
      deadline: day(5, 16),
      unit: 'child',
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
  );
  add(
    'outing',
    'form',
    ['Sortie nature · votre autorisation', 'Nature outing · your permission'],
    [
      'Une promenade pour découvrir les arbres. Merci de donner votre accord ou votre refus.',
      'A walk to discover local trees. Please give your approval or refusal.',
    ],
    'emma',
    {
      audience: { type: 'class', ids: ['ce'] },
      deadline: day(3, 16),
      unit: 'child',
      link: 'nature',
      fields: [
        {
          id: 'permission',
          label: tr('Participation à la sortie', 'Outing participation'),
          type: 'consent',
          required: true,
        },
        {
          id: 'note',
          label: tr('Un message pour l’équipe', 'A note for the team'),
          type: 'textarea',
          required: false,
        },
      ],
    },
  );
  add(
    'insurance',
    'form',
    ['Attestation d’assurance', 'School insurance certificate'],
    [
      'Téléchargez le modèle fictif, complétez-le hors de l’application et joignez votre fichier exemple.',
      'Download the fictional template, complete it outside the app and attach your sample file.',
    ],
    'director',
    {
      deadline: day(-1, 16),
      unit: 'child',
      fields: [
        {
          id: 'file',
          label: tr('Fichier exemple complété', 'Completed sample file'),
          type: 'file',
          required: true,
        },
      ],
    },
  );
  add(
    'individual',
    'form',
    ['Vos coordonnées personnelles', 'Your personal contact details'],
    [
      'Réponse individuelle, non partagée avec un autre responsable.',
      'An individual response, not shared with another guardian.',
    ],
    'director',
    {
      audience: { type: 'individual', ids: ['alice', 'thomas'] },
      unit: 'adult',
      responders: ['alice', 'thomas'],
      deadline: day(7, 16),
      fields: [
        {
          id: 'contact',
          label: tr('Votre adresse de contact fictive', 'Your fictional contact address'),
          type: 'text',
          required: true,
        },
      ],
    },
  );
  add(
    'report',
    'evaluation',
    ['La lecture prend son envol', 'Reading takes flight'],
    [
      'Louise lit avec plus d’aisance et participe volontiers aux échanges. Prochaine étape : raconter une histoire avec ses propres mots.',
      'Louise is reading more fluently and joining in discussions. Next step: retelling a story in her own words.',
    ],
    'emma',
    { childId: 'c1', subject: 'reading', requireAck: true },
  );
  add(
    'draft-report',
    'evaluation',
    ['Premiers repères en mathématiques', 'First steps in mathematics'],
    ['Brouillon d’observation à compléter.', 'Draft observation to complete.'],
    'emma',
    { childId: 'c2', status: 'draft', subject: 'maths', responsible: ['emma', 'director'] },
  );
  add(
    'other-report',
    'evaluation',
    ['Carnet de sciences', 'Science journal'],
    [
      'Observation fictive réservée à une autre famille.',
      'Fictional observation for another family.',
    ],
    'leonie',
    { childId: 'c4', subject: 'science' },
  );
  add(
    'survey',
    'poll',
    ['Quel atelier pour les familles ?', 'Which family workshop?'],
    [
      'Un avis par adulte. Réponses anonymes pour l’organisateur. Un commentaire peut vous identifier. Une synthèse sera publiée.',
      'One response per adult. Answers are anonymous to the organiser. Comments can identify you. A reviewed summary will be published.',
    ],
    'director',
    {
      status: 'open',
      deadline: day(6, 16),
      unit: 'adult',
      anonymous: true,
      pollType: 'single',
      summaryPlanned: true,
      options: [
        tr('Lecture et histoires', 'Reading and stories'),
        tr('Jardinage', 'Gardening'),
        tr('Jeux coopératifs', 'Cooperative games'),
      ],
    },
  );
  add(
    'snack',
    'poll',
    ['Le goûter de la rencontre', 'Snacks for the class gathering'],
    ['Une réponse partagée par enfant, identifiée.', 'One shared, identified response per child.'],
    'ines',
    {
      audience: { type: 'class', ids: ['ce'] },
      status: 'open',
      deadline: day(4),
      unit: 'child',
      anonymous: false,
      pollType: 'single',
      summaryPlanned: true,
      options: [tr('Fruits', 'Fruit'), tr('Pain et chocolat', 'Bread and chocolate')],
    },
  );
  add(
    'topic',
    'topic',
    ['Préparons notre rencontre de classe', 'Let’s plan our class gathering'],
    [
      'Cet espace est réservé aux parents de la classe. Qu’aimeriez-vous aborder ?',
      'This space is for class parents. What would you like to discuss?',
    ],
    'ines',
    {
      audience: { type: 'class', ids: ['ce'] },
      status: 'open',
      link: 'snack',
      messages: [
        {
          id: 'tm1',
          author: 'alice',
          text: 'Un temps pour parler des livres / Time to talk about books',
          at: now,
          files: [],
        },
      ],
    },
  );
  add(
    'escalation',
    'conversation',
    ['Synthèse · rencontre de classe', 'Summary · class gathering'],
    [
      'Synthèse relue : proposition d’un atelier lecture. Aucun historique du canal parents n’est joint.',
      'Reviewed summary: a reading workshop proposal. No parent-channel history is included.',
    ],
    'ines',
    { participants: ['ines', 'emma'], link: 'topic', status: 'open' },
  );
  add(
    'teacher-chat',
    'conversation',
    ['Une question sur la sortie', 'A question about the outing'],
    ['Conversation privée avec Emma Laurent.', 'Private conversation with Emma Laurent.'],
    'alice',
    {
      participants: ['alice', 'emma'],
      status: 'open',
      messages: [
        {
          id: 'm1',
          author: 'emma',
          text: 'Le départ est prévu après l’accueil. / We will leave after morning registration.',
          at: now,
          files: [],
        },
      ],
      reads: { emma: now },
    },
  );
  add(
    'team-chat',
    'conversation',
    ['Accueil du soir', 'After-school care'],
    ['Boîte partagée : Nora Dubois et Sam Leroy.', 'Shared inbox: Nora Dubois and Sam Leroy.'],
    'alice',
    {
      participants: ['alice'],
      team: 'care',
      status: 'open',
      messages: [
        {
          id: 'm2',
          author: 'alice',
          text: 'Une question sur l’accueil du soir. / A question about after-school care.',
          at: now,
          files: [],
        },
      ],
    },
  );
  add(
    'absence',
    'request',
    ['Absence · Jules', 'Absence · Jules'],
    ['Avis adressé à l’école et à la cantine.', 'Notice sent to the school and canteen.'],
    'alice',
    {
      childId: 'c2',
      requestType: 'absence',
      status: 'pending',
      teams: ['school', 'canteen'],
      start: day(1),
      end: day(1, 15),
      teamAcks: { school: { actor: 'emma', at: now } },
    },
  );
  add(
    'collection',
    'request',
    ['Départ exceptionnel · Louise', 'Collection change · Louise'],
    [
      'Proposition fictive : collecte par une tante à 16 h.',
      'Fictional request: collection by an aunt at 4 pm.',
    ],
    'alice',
    {
      childId: 'c1',
      requestType: 'collection',
      status: 'pending',
      teams: ['care'],
      start: day(1, 14),
      requestDetails: 'Tante fictive / Fictional aunt',
    },
  );
  add(
    'nature',
    'event',
    ['À la découverte des arbres', 'Discovering trees'],
    [
      'Une matinée au grand air avec la classe. Prévoir des chaussures adaptées.',
      'A morning outdoors with the class. Please bring suitable shoes.',
    ],
    'emma',
    {
      audience: { type: 'class', ids: ['ce'] },
      start: day(4),
      end: day(4, 10),
      location: 'Parc fictif / Fictional park',
      link: 'outing',
      capacity: 2,
    },
  );
  add(
    'meeting',
    'event',
    ['Rencontre des familles', 'Family gathering'],
    ['Un moment pour échanger avec l’équipe.', 'A chance to meet the team.'],
    'director',
    { start: day(7, 15), end: day(7, 16), location: 'École · Démo / School · Demo' },
  );
  add(
    'book-day',
    'event',
    ['Journée du livre', 'Book day'],
    ['Apportez votre histoire préférée.', 'Bring your favourite story.'],
    'director',
    { start: day(9).slice(0, 10), end: day(10).slice(0, 10), allDay: true },
  );
  add(
    'changed-event',
    'event',
    ['Atelier déplacé', 'Rescheduled workshop'],
    ['L’horaire a changé.', 'The time has changed.'],
    'emma',
    { audience: { type: 'class', ids: ['cp'] }, start: day(8, 12), end: day(8, 13), sequence: 1 },
  );
  add(
    'cancelled-event',
    'event',
    ['Jeux en plein air', 'Outdoor games'],
    ['Séance annulée.', 'Session cancelled.'],
    'director',
    { status: 'cancelled', start: day(6, 12), end: day(6, 13), sequence: 1 },
  );
  const s: State = {
    schema: 1,
    seedVersion: 2,
    revision: 0,
    clock: now,
    year,
    adults,
    children,
    classes: schoolClasses(year),
    entries,
    submissions: [
      {
        id: 'submitted-annual',
        formId: annual.id,
        childId: 'c2',
        author: 'alice',
        draft: false,
        answers: {
          contact: 'alice@example.invalid',
          emergency: 'Contact fictif · 00 00 00 00 00',
          needs: '0',
        },
        at: now,
        formVersion: 1,
        history: [],
        status: 'reviewed',
        snapshot: {
          child: 'Jules Martin',
          contact: 'alice@example.invalid',
          emergency: 'Contact fictif · 00 00 00 00 00',
        },
        confirmation: true,
      },
    ],
    votes: [],
    voteReceipts: [],
    attachments: [],
    bookings: [
      {
        id: 'b1',
        childId: 'c1',
        service: 'canteen',
        date: day(2).slice(0, 10),
        session: 'midday',
        status: 'confirmed',
        author: 'alice',
        at: now,
        history: [],
      },
    ],
    notices: [
      {
        id: 'n1',
        actor: 'alice',
        kind: 'conversation',
        resourceId: 'teacher-chat',
        at: now,
        key: 'initial-message',
        read: false,
        queued: false,
      },
      {
        id: 'n2',
        actor: 'alice',
        kind: 'evaluation',
        resourceId: 'report',
        at: now,
        key: 'initial-report',
        read: false,
        queued: false,
      },
    ],
    tasks: [],
    audit: [],
    feedback: [],
    drafts: {},
    feedTokens: {},
    archive: [],
  };
  s.attachments.push(
    {
      id: 'sample-photo',
      name: 'sample-image.png',
      type: 'image/png',
      size: 10000,
      owner: 'emma',
      entryId: 'welcome',
      restricted: false,
      at: now,
    },
    {
      id: 'sample-evidence',
      name: 'justificatif-fictif.pdf',
      type: 'application/pdf',
      size: 4000,
      owner: 'alice',
      childId: 'c1',
      restricted: true,
      at: now,
    },
    {
      id: 'sample-work',
      name: 'travail-classe-fictif.pdf',
      type: 'application/pdf',
      size: 4000,
      owner: 'emma',
      entryId: 'report',
      restricted: false,
      at: now,
    },
  );
  const welcome = s.entries.find((e) => e.id === 'welcome')!;
  welcome.photoFile = 'sample-photo';
  welcome.photoChildren = ['c1'];
  welcome.photoUse = 'class';
  s.children[0].evidence = ['sample-evidence'];
  s.entries.find((e) => e.id === 'report')!.attachments = ['sample-work'];
  return s;
}
