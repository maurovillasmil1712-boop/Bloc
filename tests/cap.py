"""Screenshot every main screen of a local Bloc server.
Usage: python3 cap.py BASE OUTDIR [light|dark] [phone|desktop|both]"""
import sys, os, json, datetime as dt, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
OUT = sys.argv[2]
THEME = sys.argv[3] if len(sys.argv) > 3 else 'light'
WHICH = sys.argv[4] if len(sys.argv) > 4 else 'both'
os.makedirs(OUT, exist_ok=True)
PW = 'Bloc-local-2026!'
T0 = dt.datetime(2026, 11, 24, 10, 32, tzinfo=dt.timezone(dt.timedelta(hours=1)))

ASSIST_REPLY = {
    'reply': "Your Math mock is tomorrow at 9:00, so tonight matters more than the Historia sources. "
             "I'd push the Cold War block to 18:30 so you get a break after the calculus paper, and add a short "
             "formula review before bed.\n\nFor the calculus paper: do Section A untimed first, then Section B against the clock.",
    'actions': [
        {'n': 1, 'type': 'move', 'kind': 'plan', 'id': 'pl-2', 'date': '2026-11-24', 'at': '18:30'},
        {'n': 2, 'type': 'add_block', 'date': '2026-11-24', 'at': '21:30', 'dur': 30, 'subject': 'math', 'title': 'Formula sheet review'},
    ],
    'skipped': [],
    'usage': {'used': 4, 'limit': 15, 'photos': 0, 'photoLimit': 1, 'extra': False, 'resets_at': 0},
}


def settle(page, ms=900):
    page.wait_for_timeout(ms)


def snap(page, name, full=False):
    path = os.path.join(OUT, name + '.png')
    page.screenshot(path=path, full_page=full)
    return path


def tab(page, t):
    btn = page.locator('#tabbar [data-tab="%s"]' % t)
    if btn.count() and btn.first.is_visible():
        btn.first.click()
    else:
        page.locator('#top-nav [data-tab="%s"]' % t).first.click()
    settle(page)


def close_sheet(page):
    page.keyboard.press('Escape')
    settle(page, 500)


def run(p, kind):
    b = p.chromium.launch()
    if kind == 'phone':
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                     timezone_id='Europe/Madrid', locale='en-GB', color_scheme=THEME)
    else:
        ctx = b.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1,
                                     timezone_id='Europe/Madrid', locale='en-GB', color_scheme=THEME)
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.' + m.type + ': ' + m.text) if m.type in ('error',) else None)
    page.clock.install(time=T0)
    page.clock.resume()
    pre = kind[0]

    # log in screen (logged out)
    page.goto(BASE + '/')
    settle(page, 1500)
    snap(page, pre + '00-auth-level')
    lv = page.locator('[data-act="auth-level"][data-level="ib"]')
    if lv.count():
        lv.first.click(); settle(page, 1200)
        snap(page, pre + '01-auth-names')

    # log in as Mauro through the API (shares the context's cookies)
    r = ctx.request.post(BASE + '/api/login', data=json.dumps({'user': 'mauro', 'password': PW}),
                         headers={'X-MyIB': '1', 'Content-Type': 'application/json'})
    GET_ASSIST = {'on': True, 'ready': True, 'usage': {'used': 3, 'limit': 15, 'photos': 0, 'photoLimit': 1, 'extra': False, 'resets_at': 0}}
    page.route('**/api/assist', lambda route: route.fulfill(status=200, content_type='application/json',
               body=json.dumps(ASSIST_REPLY if route.request.method == 'POST' else GET_ASSIST)))
    def me_route(route):
        r = route.fetch()
        try:
            d = r.json()
            if d.get('assist'): d['assist']['ready'] = True
            route.fulfill(response=r, body=json.dumps(d))
        except Exception:
            route.fulfill(response=r)
    page.route('**/api/me', me_route)
    page.goto(BASE + '/?app=1#today')
    settle(page, 2500)
    snap(page, pre + '02-today')
    if kind == 'phone':
        snap(page, pre + '02-today-full', full=True)

    for i, t in enumerate(['timetable', 'calendar', 'tasks', 'subjects', 'pet']):
        tab(page, t)
        snap(page, '%s%02d-%s' % (pre, 3 + i, t))
        if kind == 'phone' and t in ('tasks', 'calendar', 'subjects'):
            snap(page, '%s%02d-%s-full' % (pre, 3 + i, t), full=True)

    # chats
    page.locator('#chat-btn').click(); settle(page, 1500)
    agree = page.locator('[data-act="chat-agree"]')
    if agree.count() and agree.first.is_visible():
        snap(page, pre + '09-chat-rules')
        agree.first.click(); settle(page, 1500)
    snap(page, pre + '10-chats')
    conv = page.locator('[data-act="chat-open"]').first
    if conv.count():
        conv.click(); settle(page, 1500)
        snap(page, pre + '11-chat-thread')
    lu = page.locator('[data-act="chat-open"][data-id="dm:luca:mauro"]')
    if kind == 'phone':
        page.goto(BASE + '/?app=1#chat'); settle(page, 1800)
        lu = page.locator('[data-act="chat-open"][data-id="dm:luca:mauro"]')
    if lu.count():
        lu.first.click(); settle(page, 1500)
        snap(page, pre + '11b-chat-dm')
    page.goto(BASE + '/?app=1#today'); settle(page, 2000)

    # assistant
    ab = page.locator('#assist-btn')
    if ab.count() and ab.is_visible():
        ab.click(); settle(page, 1200)
        snap(page, pre + '12-assist-empty')
        box = page.locator('#dlg textarea, #dlg input[type="text"]').first
        if box.count():
            box.fill('Mock tomorrow, what should I do tonight?')
            page.keyboard.press('Enter')
            settle(page, 2000)
            snap(page, pre + '13-assist-reply')
        close_sheet(page)

    # settings
    page.locator('#settings-btn').click(); settle(page, 1200)
    snap(page, pre + '14-settings')
    if kind == 'phone':
        snap(page, pre + '14-settings-full', full=True)
    close_sheet(page)

    # calendar day with the hourly plan
    tab(page, 'calendar')
    d = page.locator('[data-act="cal-sel"][data-date="2026-11-24"]').first
    if d.count():
        d.dispatch_event('click'); settle(page, 1200)
        snap(page, pre + '15-calendar-day')
        if kind == 'phone':
            snap(page, pre + '15-calendar-day-full', full=True)
    # new task sheet
    tab(page, 'tasks')
    nt = page.locator('[data-act="task-new"]').first
    if nt.count() and nt.is_visible():
        nt.click(); settle(page, 1000)
        snap(page, pre + '16-task-sheet')
        close_sheet(page)
    # focus timer
    tab(page, 'today')
    fs = page.locator('[data-act="focus-start"]').first
    if fs.count():
        fs.scroll_into_view_if_needed(); fs.dispatch_event('click'); settle(page, 1500)
        snap(page, pre + '17-focus')
        fc = page.locator('[data-act="focus-cancel"]').first
        if fc.count() and fc.is_visible(): fc.click(); settle(page, 600)

    with open(os.path.join(OUT, pre + '-errors.txt'), 'w') as f:
        f.write('\n'.join(errors))
    ctx.close()
    b.close()


with sync_playwright() as p:
    for k in (['phone', 'desktop'] if WHICH == 'both' else [WHICH]):
        run(p, k)
print('done', OUT)
