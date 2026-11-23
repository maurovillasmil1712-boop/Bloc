/* Bloc starting planners.
   IB_DEFAULTS: Sociales 2 IB (2º BI B, 2026–27), filled in from the school timetable and calendar.
   IB_BLANK: IB students outside the class. Empty timetable rows and the IB core, ready to fill in.
   LEVELS: what the first log in screen offers (IB, Bachillerato, ESO, University): the words the
   app uses for each, its subject list, and the empty planner a new account starts from.
   Each account keeps its own planner; Settings → "Reset to Starting Data" puts the matching one back. */
(function () {
  'use strict';

  function ev(id, type, subject, title, detail, start, end, note) {
    return { id, type, subject, title, detail: detail || '', start, end: end || null, note: note || '', done: false };
  }

  var IB_SCHEDULE = 'IB May 2027 exam schedule: ';
  var SCHOOL = 'From the school calendar.';

  /* School day as printed on the Untis timetable for 2º BI B. */
  var PERIODS = [
    { id: 'p1', start: '08:15', end: '09:15', kind: 'class', label: '' },
    { id: 'p2', start: '09:15', end: '10:10', kind: 'class', label: '' },
    { id: 'p3', start: '10:10', end: '11:05', kind: 'class', label: '' },
    { id: 'br', start: '11:05', end: '11:25', kind: 'break', label: 'Break' },
    { id: 'p4', start: '11:25', end: '12:20', kind: 'class', label: '' },
    { id: 'p5', start: '12:20', end: '13:15', kind: 'class', label: '' },
    { id: 'p6', start: '13:15', end: '14:10', kind: 'class', label: '' },
    { id: 'p7', start: '14:10', end: '15:05', kind: 'class', label: '' }
  ];

  window.IB_DEFAULTS = {
    version: 3,
    profile: { name: '' },
    settings: { theme: 'auto', weekend: false, lastBackup: null, accent: '' },

    subjects: [
      { id: 'eng',  name: 'English',             short: 'English',    color: '#F28C28', group: 'ib',    level: '', teacher: 'Gerard O.', goal: 0, notes: '' },
      { id: 'math', name: 'Math',                short: 'Math',       color: '#EDB21A', group: 'ib',    level: '', teacher: 'Ignacio',   goal: 0, notes: '' },
      { id: 'sas',  name: 'SAS',                 short: 'SAS',        color: '#1E9E6A', group: 'ib',    level: '', teacher: 'Sergio T',  goal: 0, notes: 'Sistemas Ambientales y Sociedades (S. Ambi on the timetable).' },
      { id: 'len',  name: 'Lengua',              short: 'Lengua',     color: '#3B6FD4', group: 'ib',    level: '', teacher: 'Adrián',    goal: 0, notes: '' },
      { id: 'ges',  name: 'Gestión Empresarial', short: 'Gestión',    color: '#3D5591', group: 'ib',    level: '', teacher: 'Fernan',    goal: 0, notes: '' },
      { id: 'his',  name: 'Historia',            short: 'Historia',   color: '#5DAA3A', group: 'ib',    level: '', teacher: 'Fernan',    goal: 0, notes: '' },
      { id: 'tdc',  name: 'TDC',                 short: 'TDC',        color: '#7D756C', group: 'core',  level: '', teacher: 'Pedro A',   goal: 0, notes: '' },
      { id: 'mono', name: 'Monografía',          short: 'Monografía', color: '#E0527D', group: 'core',  level: '', teacher: '',          goal: 0, notes: '' },
      { id: 'cas',  name: 'CAS',                 short: 'CAS',        color: '#3E9BD6', group: 'core',  level: '', teacher: '',          goal: 0, notes: '' },
      { id: 'tut',  name: 'Tutoría',             short: 'Tutoría',    color: '#A9714B', group: 'other', level: '', teacher: 'Gerard O.', goal: 0, notes: '' }
    ],

    periods: PERIODS,

    /* key = periodId|day (0 = Monday) */
    slots: {
      'p1|0': { subject: 'tdc' },  'p1|2': { subject: 'ges' },  'p1|3': { subject: 'sas' },  'p1|4': { subject: 'len' },
      'p2|0': { subject: 'len' },  'p2|1': { subject: 'len' },  'p2|2': { subject: 'eng' },  'p2|3': { subject: 'eng' },  'p2|4': { subject: 'tdc' },
      'p3|0': { subject: 'len' },  'p3|1': { subject: 'sas' },  'p3|2': { subject: 'eng' },  'p3|3': { subject: 'tdc' },  'p3|4': { subject: 'eng' },
      'p4|0': { subject: 'eng' },  'p4|1': { subject: 'math' }, 'p4|2': { subject: 'sas' },  'p4|3': { subject: 'len' },  'p4|4': { subject: 'ges' },
      'p5|0': { subject: 'his' },  'p5|1': { subject: 'ges' },  'p5|2': { subject: 'math' }, 'p5|3': { subject: 'ges' },  'p5|4': { subject: 'ges' },
      'p6|0': { subject: 'math' }, 'p6|1': { subject: 'his' },  'p6|2': { subject: 'math' }, 'p6|3': { subject: 'his' },  'p6|4': { subject: 'math' },
      'p7|0': { subject: 'tut' }
    },

    events: [
      ev('tdc-exh',        'deadline', 'tdc',  'Exhibition', '',                         '2026-09-24'),
      ev('mono-conc',      'deadline', 'mono', '',           'Draft up to the conclusion', '2026-09-29'),
      ev('math-ia-rev',    'deadline', 'math', 'IA',         'Review',                   '2026-10-09'),
      ev('mono-full',      'deadline', 'mono', '',           'Complete draft',           '2026-10-19'),
      ev('math-ia-full',   'deadline', 'math', 'IA',         'Complete draft',           '2026-11-06'),
      ev('len-essay-last', 'deadline', 'len',  'Essay',      'Last draft',               '2026-11-13'),
      ev('mock-1',         'mock',     null,   'First mock exams', '',                   '2026-11-25', '2026-12-04'),
      ev('ges-ia-full',    'deadline', 'ges',  'IA',         'Complete draft',           '2026-12-11'),
      ev('tdc-essay-full', 'deadline', 'tdc',  'Essay',      'Complete draft',           '2026-12-13'),
      ev('sas-ia-full',    'deadline', 'sas',  'IA',         'Complete draft',           '2026-12-14'),
      ev('mono-pres',      'deadline', 'mono', '',           'Presentation',             '2026-12-16'),
      ev('mono-last',      'deadline', 'mono', '',           'Last draft',               '2026-12-20'),
      ev('grades-4',       'grades',   null,   'Grades',     '4th term',                 '2026-12-21'),
      ev('xmas',           'holiday',  null,   'Christmas break', '',                    '2026-12-23', '2027-01-11'),
      ev('math-ia-last',   'deadline', 'math', 'IA',         'Last draft',               '2027-01-15'),
      ev('tdc-essay-last', 'deadline', 'tdc',  'Essay',      'Last draft',               '2027-01-22'),
      ev('cas-portfolio',  'deadline', 'cas',  'Portfolio',  'Final submission',         '2027-02-03'),
      ev('ges-ia-last',    'deadline', 'ges',  'IA',         'Last draft',               '2027-02-07'),
      ev('mono-final',     'deadline', 'mono', '',           'Final submission',         '2027-02-14'),
      ev('len-essay-final','deadline', 'len',  'Essay',      'Final submission',         '2027-02-14'),
      ev('sas-ia-last',    'deadline', 'sas',  'IA',         'Last draft',               '2027-02-15'),
      ev('math-ia-final',  'deadline', 'math', 'IA',         'Final submission',         '2027-02-19'),
      ev('tdc-essay-final','deadline', 'tdc',  'Essay',      'Final submission',         '2027-02-25'),
      ev('ges-ia-final',   'deadline', 'ges',  'IA',         'Final submission',         '2027-02-26'),
      ev('mock-2',         'mock',     null,   'Second mock exams', '',                  '2027-03-01', '2027-03-15'),
      ev('easter',         'holiday',  null,   'Easter break', '',                       '2027-03-19', '2027-03-29'),
      ev('sas-ia-final',   'deadline', 'sas',  'IA',         'Final submission',         '2027-03-22'),
      ev('grades-5',       'grades',   null,   'Grades',     '5th term',                 '2027-04-08'),
      ev('ges-p13',        'exam',     'ges',  'Exam',       'Papers 1 & 3',             '2027-04-27', null, IB_SCHEDULE + 'afternoon session.'),
      ev('ges-p2',         'exam',     'ges',  'Exam',       'Paper 2',                  '2027-04-28', null, IB_SCHEDULE + 'morning session.'),
      ev('sas-p1',         'exam',     'sas',  'Exam',       'Paper 1',                  '2027-04-30', null, SCHOOL),
      ev('sas-p2',         'exam',     'sas',  'Exam',       'Paper 2',                  '2027-05-03', null, SCHOOL),
      ev('his-p12',        'exam',     'his',  'Exam',       'Papers 1 & 2',             '2027-05-03', null, IB_SCHEDULE + 'afternoon session.'),
      ev('eng-p12',        'exam',     'eng',  'Exam',       'Paper 1 + Paper 2 reading', '2027-05-06', null, IB_SCHEDULE + 'afternoon session.'),
      ev('eng-p2l',        'exam',     'eng',  'Exam',       'Paper 2 listening',        '2027-05-07', null, IB_SCHEDULE + 'morning session.'),
      ev('len-p1',         'exam',     'len',  'Exam',       'Paper 1',                  '2027-05-12', null, IB_SCHEDULE + 'afternoon session.'),
      ev('len-p2',         'exam',     'len',  'Exam',       'Paper 2',                  '2027-05-13', null, IB_SCHEDULE + 'morning session.'),
      ev('math-p1',        'exam',     'math', 'Exam',       'Paper 1',                  '2027-05-13', null, IB_SCHEDULE + 'afternoon session.'),
      ev('math-p2',        'exam',     'math', 'Exam',       'Paper 2',                  '2027-05-14', null, IB_SCHEDULE + 'morning session.')
    ],

    tasks: [],
    sessions: [],
    papers: [],
    timer: null
  };

  /* Last day of school for each IB year, shown under the exam countdown on Today. */
  window.IB_SCHOOL_END = [
    ['2º BI', '2027-05-14'],
    ['1º BI', '2027-06-20']
  ];

  /* Everyone else: the IB core, the same school-day rows (tap a time to change it) and nothing else yet.
     guide: 'new' shows the welcome sheet and the setup checklist on Today. */
  window.IB_BLANK = {
    version: 3,
    profile: { name: '' },
    settings: { theme: 'auto', weekend: false, lastBackup: null, accent: '', guide: 'new' },
    subjects: [
      { id: 'tok', name: 'Theory of Knowledge', short: 'TOK', color: '#7D756C', group: 'core', level: '', teacher: '', goal: 0, notes: '' },
      { id: 'ee',  name: 'Extended Essay',      short: 'EE',  color: '#E0527D', group: 'core', level: '', teacher: '', goal: 0, notes: '' },
      { id: 'cas', name: 'CAS',                 short: 'CAS', color: '#3E9BD6', group: 'core', level: '', teacher: '', goal: 0, notes: '' }
    ],
    periods: PERIODS,
    slots: {},
    events: [],
    tasks: [],
    sessions: [],
    papers: [],
    timer: null
  };

  /* a Spanish secondary school day (ESO and Bachillerato): tap a time to change it */
  var PERIODS_ES = [
    { id: 'p1', start: '08:30', end: '09:25', kind: 'class', label: '' },
    { id: 'p2', start: '09:25', end: '10:20', kind: 'class', label: '' },
    { id: 'p3', start: '10:20', end: '11:15', kind: 'class', label: '' },
    { id: 'br', start: '11:15', end: '11:45', kind: 'break', label: 'Break' },
    { id: 'p4', start: '11:45', end: '12:40', kind: 'class', label: '' },
    { id: 'p5', start: '12:40', end: '13:35', kind: 'class', label: '' },
    { id: 'p6', start: '13:35', end: '14:30', kind: 'class', label: '' }
  ];
  /* university: hour by hour, mornings and afternoons */
  var PERIODS_UNI = ['09:00', '10:00', '11:00', '12:00', '13:00', '15:00', '16:00', '17:00'].map(function (t, i) {
    var h = Number(t.slice(0, 2)) + 1;
    return { id: 'u' + (i + 1), start: t, end: (h < 10 ? '0' : '') + h + ':00', kind: 'class', label: '' };
  });
  function blank(periods) {
    return { version: 3, profile: { name: '' }, settings: { theme: 'auto', weekend: false, lastBackup: null, accent: '', guide: 'new' },
      subjects: [], periods: periods, slots: {}, events: [], tasks: [], sessions: [], papers: [], timer: null };
  }

  /* pick: [group name, [[full name, short name], ...]]; common: names ticked for you the first time */
  window.LEVELS = {
    ib: {
      name: 'IB Diploma', short: 'IB', sub: 'International Baccalaureate', group: 'IB subjects', one: 'IB subject',
      exams: 'IB exams', sl: true, blank: window.IB_BLANK, common: []
    },
    bach: {
      name: 'Bachillerato', short: 'Bachillerato', sub: 'Nacional, 1º and 2º', group: 'Subjects', one: 'Subject',
      exams: 'Next exam', blank: blank(PERIODS_ES),
      common: ['Lengua Castellana y Literatura', 'Inglés'],
      pick: [
        ['Common', [['Lengua Castellana y Literatura', 'Lengua'], ['Inglés', 'Inglés'], ['Filosofía', 'Filosofía'], ['Historia de España', 'Historia'], ['Historia de la Filosofía', 'H. Filosofía'], ['Educación Física', 'Ed. Física']]],
        ['Ciencias y Tecnología', [['Matemáticas', 'Mates'], ['Física', 'Física'], ['Química', 'Química'], ['Biología', 'Biología'], ['Geología y Ciencias Ambientales', 'Geología'], ['Dibujo Técnico', 'Dibujo'], ['Tecnología e Ingeniería', 'Tecnología']]],
        ['Humanidades y Ciencias Sociales', [['Matemáticas Aplicadas a las CCSS', 'Mates CCSS'], ['Economía', 'Economía'], ['Empresa y Diseño de Modelos de Negocio', 'Empresa'], ['Geografía', 'Geografía'], ['Historia del Arte', 'H. Arte'], ['Latín', 'Latín'], ['Griego', 'Griego'], ['Literatura Universal', 'Lit. Universal'], ['Historia del Mundo Contemporáneo', 'H. Mundo']]],
        ['Artes', [['Dibujo Artístico', 'Dibujo Art.'], ['Cultura Audiovisual', 'Audiovisual'], ['Análisis Musical', 'Música'], ['Artes Escénicas', 'Escénicas'], ['Diseño', 'Diseño']]],
        ['Optativas', [['Francés', 'Francés'], ['Alemán', 'Alemán'], ['Psicología', 'Psicología'], ['Tecnologías de la Información', 'TIC'], ['Anatomía Aplicada', 'Anatomía'], ['Religión', 'Religión']]]
      ]
    },
    eso: {
      name: 'ESO', short: 'ESO', sub: '1º to 4º', group: 'Subjects', one: 'Subject',
      exams: 'Next exam', blank: blank(PERIODS_ES),
      common: ['Lengua Castellana y Literatura', 'Matemáticas', 'Inglés', 'Geografía e Historia', 'Educación Física'],
      pick: [
        ['Common', [['Lengua Castellana y Literatura', 'Lengua'], ['Matemáticas', 'Mates'], ['Inglés', 'Inglés'], ['Geografía e Historia', 'Geo e Historia'], ['Educación Física', 'Ed. Física']]],
        ['Ciencias', [['Biología y Geología', 'Biología'], ['Física y Química', 'Física y Química'], ['Tecnología y Digitalización', 'Tecnología'], ['Digitalización', 'Digitalización']]],
        ['Artes y más', [['Música', 'Música'], ['Educación Plástica, Visual y Audiovisual', 'Plástica'], ['Francés', 'Francés'], ['Alemán', 'Alemán'], ['Latín', 'Latín'], ['Economía y Emprendimiento', 'Economía'], ['Valores Cívicos y Éticos', 'Valores'], ['Religión', 'Religión']]]
      ]
    },
    uni: {
      name: 'University', short: 'University', sub: 'Degree or master’s', group: 'Courses', one: 'Course',
      exams: 'Next exam', blank: blank(PERIODS_UNI), common: [],
      pick: [
        ['Common first-year courses', [['Calculus', 'Calculus'], ['Linear Algebra', 'Algebra'], ['Statistics', 'Statistics'], ['Programming', 'Programming'], ['Physics', 'Physics'], ['Chemistry', 'Chemistry'], ['Biology', 'Biology'],
          ['Microeconomics', 'Micro'], ['Macroeconomics', 'Macro'], ['Accounting', 'Accounting'], ['Marketing', 'Marketing'], ['Introduction to Law', 'Law'], ['Psychology', 'Psychology'], ['Academic Writing', 'Writing']]]
      ]
    }
  };
})();
