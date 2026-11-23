"""Seed a local Bloc server with a realistic IB student (Mauro, the admin) plus classmates and chats.
Usage: python3 seed.py http://127.0.0.1:8788
Browser time in the captures is Tue 24 Nov 2026, 10:32 Madrid."""
import json, sys, datetime as dt, random
import requests

BASE = sys.argv[1].rstrip('/')
H = {'X-MyIB': '1', 'Accept': 'application/json', 'Content-Type': 'application/json'}
PW = 'Bloc-local-2026!'


def sess():
    s = requests.Session()
    s.trust_env = False  # local server: skip the proxy
    s.headers.update(H)
    return s


def post(s, path, body):
    r = s.post(BASE + path, data=json.dumps(body))
    if r.status_code >= 400:
        print('  !', path, r.status_code, r.text[:200])
    return r


def ms(y, mo, d, h=0, mi=0):
    # Madrid is UTC+1 in November
    return int(dt.datetime(y, mo, d, h, mi, tzinfo=dt.timezone(dt.timedelta(hours=1))).timestamp() * 1000)


# ---------- accounts ----------
mauro = sess()
r = post(mauro, '/api/signup', {'user': 'mauro', 'password': PW, 'code': 'LOCALADMIN2026'})
if r.status_code == 409:
    post(mauro, '/api/login', {'user': 'mauro', 'password': PW})

others = {}
for uid in ['luca', 'simon', 'carlota', 'jorge']:
    s = sess()
    r = post(s, '/api/signup', {'user': uid, 'password': PW})
    if r.status_code == 409:
        post(s, '/api/login', {'user': uid, 'password': PW})
    others[uid] = s

# an account outside the class, Bachillerato level
lucia = sess()
r = post(lucia, '/api/join', {'user': 'lucia.m', 'name': 'Lucía', 'password': PW})
if r.status_code == 409:
    post(lucia, '/api/login', {'user': 'lucia.m', 'password': PW})

# ---------- Mauro's planner ----------
start = mauro.get(BASE + '/api/starter').json()['starter']
cur = mauro.get(BASE + '/api/state').json()
P = start
P['settings']['level'] = 'ib'
P['settings']['guide'] = 'done'

tasks = [
    ('t-his-src', 'Historia Paper 1: practise the Cold War source questions', 'his', '2026-11-24', None, 45, False),
    ('t-len-reread', 'Reread my El Roto essay and mark the weak paragraphs', 'len', '2026-11-24', None, 30, True),
    ('t-math-calc', 'Math mock: two calculus past papers, timed', 'math', '2026-11-25', None, 90, False),
    ('t-ges-data', 'Gestión IA: write up the data analysis section', 'ges', '2026-11-26', '17:30', 60, False),
    ('t-tdc-outline', 'TDC essay: outline for prescribed title 3', 'tdc', '2026-11-27', None, 40, False),
    ('t-cas-refl', 'CAS reflection on coaching the under-12s', 'cas', '2026-11-28', None, 20, False),
    ('t-mono-mail', 'Email Sofía about the Monografía draft feedback', 'mono', '2026-11-23', None, 10, False),
    ('t-eng-orals', 'English: record a practice individual oral', 'eng', '2026-11-30', None, 25, False),
    ('t-cs-pseudo', 'CS: pseudocode exercises, sorting algorithms', 'cs', '2026-11-26', None, 35, False),
    ('t-print', 'Print the mock exam timetable', None, '2026-11-24', None, 5, True),
]
for tid, title, subj, due, at, est, done in tasks:
    P['tasks'].append({'id': tid, 'title': title, 'subject': subj, 'due': due, 'at': at, 'est': est, 'notes': '',
                       'done': done, 'doneAt': '2026-11-24' if done else None, 'created': '2026-11-20'})
P['tasks'].append({'id': 't-vocab', 'title': 'Spanish vocab flashcards', 'subject': 'len', 'due': '2026-11-16', 'est': 15,
                   'notes': '', 'done': False, 'created': '2026-11-16', 'rep': [0, 1, 2, 3, 4], 'until': '2026-12-18',
                   'doneOn': ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-23']})
# finish the old September/October tasks so the list looks lived in
for t in P['tasks']:
    if t['id'] in ('t-tdc-exh', 't-mono-conc', 't-math-rev'):
        t['done'] = True
        t['doneAt'] = t['due']

P['plans'] = [
    {'id': 'pl-1', 'date': '2026-11-24', 'at': '16:00', 'dur': 90, 'subject': 'math', 'title': 'Calculus past paper'},
    {'id': 'pl-2', 'date': '2026-11-24', 'at': '18:00', 'dur': 60, 'subject': 'his', 'title': 'Cold War sources'},
    {'id': 'pl-3', 'date': '2026-11-25', 'at': '16:30', 'dur': 60, 'subject': 'len', 'title': 'Paper 1 commentary'},
    {'id': 'pl-4', 'date': '2026-11-26', 'at': '16:00', 'dur': 45, 'subject': 'cs', 'title': 'Sorting algorithms'},
]

# mock exams inside the mock window, with times
P['events'] += [
    {'id': 'mk-math1', 'type': 'exam', 'subject': 'math', 'title': 'Mock', 'detail': 'Paper 1', 'start': '2026-11-25', 'end': None,
     'at': '09:00', 'dur': 90, 'note': 'Gym. Calculator not allowed.', 'done': False},
    {'id': 'mk-his2', 'type': 'exam', 'subject': 'his', 'title': 'Mock', 'detail': 'Paper 2', 'start': '2026-11-26', 'end': None,
     'at': '09:00', 'dur': 105, 'note': '', 'done': False},
    {'id': 'mk-len1', 'type': 'exam', 'subject': 'len', 'title': 'Mock', 'detail': 'Paper 1', 'start': '2026-11-27', 'end': None,
     'at': '11:25', 'dur': 135, 'note': '', 'done': False},
    {'id': 'mk-ges', 'type': 'exam', 'subject': 'ges', 'title': 'Mock', 'detail': 'Paper 2', 'start': '2026-12-01', 'end': None,
     'at': '09:00', 'dur': 105, 'note': '', 'done': False},
]

random.seed(7)
sessions = []
day = dt.date(2026, 11, 10)
i = 0
while day <= dt.date(2026, 11, 23):
    if day.weekday() != 5:
        for subj in random.sample(['math', 'his', 'len', 'ges', 'tdc', 'cs', 'mono', 'eng'], 2):
            i += 1
            sessions.append({'id': 's-%d' % i, 'subject': subj, 'date': day.isoformat(), 'minutes': random.choice([25, 25, 30, 45, 50, 60])})
    day += dt.timedelta(days=1)
P['sessions'] = sessions

P['pet'] = {'id': 'pet-churro', 'name': 'Churro', 'born': ms(2026, 10, 2, 17, 0), 'bornDate': '2026-10-02',
            'food': 78, 'water': 64, 'fun': 81, 'at': ms(2026, 11, 24, 9, 50), 'used': 14, 'stage': 2,
            'last': ms(2026, 11, 23, 19, 10), 'grave': 0, 'rev': 0}

r = mauro.put(BASE + '/api/state', data=json.dumps({'state': P, 'rev': cur.get('rev', 0), 'user': 'mauro'}))
print('planner', r.status_code, r.text[:120])

# ---------- admin config: assistant on, Siri link ----------
post(mauro, '/api/admin/config', {'assist': {'on': True, 'limit': 15, 'extra': 60, 'cap': 70, 'budget': 9000, 'photos': 1, 'photosExtra': 5, 'price': 2}})

# ---------- chats ----------
r = post(mauro, '/api/chat/dm', {'user': 'luca'})
try:
    conv = r.json().get('conv') or r.json().get('id')
except Exception:
    conv = None
print('dm', r.status_code, r.text[:160])
if conv:
    lines = [
        (mauro, 'did you get the Historia sources for Thursday?'),
        (others['luca'], 'yes, Fernan sent them on Classroom'),
        (others['luca'], 'the Yalta one is the hardest'),
        (mauro, 'ok I put a block for it at 6 today'),
        (others['luca'], 'library after school? I need to do the calculus papers too'),
    ]
    for who, body in lines:
        if who is not mauro:
            post(who, '/api/chat/accept', {'conv': conv})
        post(who, '/api/chat/send', {'conv': conv, 'body': body})

r = post(mauro, '/api/chat/group', {'name': 'Sociales 2 IB', 'users': ['luca', 'simon', 'carlota', 'jorge']})
print('group', r.status_code, r.text[:160])
try:
    g = r.json().get('conv') or r.json().get('id')
except Exception:
    g = None
if g:
    for uid in ['simon', 'carlota', 'jorge', 'luca']:
        post(others[uid], '/api/chat/accept', {'conv': g})
    for who, body in [(others['carlota'], 'is the Math mock calculator or no calculator?'),
                      (mauro, 'Paper 1, so no calculator'),
                      (others['simon'], 'gym at 9, bring your ID card'),
                      (others['jorge'], 'who has the TDC titles pdf')]:
        post(who, '/api/chat/send', {'conv': g, 'body': body})
print('seeded')
