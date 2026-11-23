"""Click through the main flows and fail loudly on any script error. Usage: python3 smoke.py BASE"""
import sys, json, datetime as dt
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1].rstrip('/')
PW = 'Bloc-local-2026!'
T0 = dt.datetime(2026, 11, 24, 10, 32, tzinfo=dt.timezone(dt.timedelta(hours=1)))
errors, results = [], []
REPLY = {'reply': 'Moving the Cold War block to 18:30.', 'actions': [{'n': 1, 'type': 'move', 'kind': 'plan', 'id': 'pl-2', 'date': '2026-11-24', 'at': '18:30'}],
         'skipped': [], 'usage': {'used': 5, 'limit': 15, 'photos': 0, 'photoLimit': 1, 'extra': False, 'resets_at': 0}}


def ok(name, cond):
    results.append(('PASS' if cond else 'FAIL') + '  ' + name)


def run(width, height, mobile):
    with sync_playwright() as p:
        b = p.chromium.launch()
        ctx = b.new_context(viewport={'width': width, 'height': height}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile,
                            timezone_id='Europe/Madrid', locale='en-GB')
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
        page.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' and '503' not in m.text else None)
        page.clock.install(time=T0); page.clock.resume()
        ctx.request.post(BASE + '/api/login', data=json.dumps({'user': 'mauro', 'password': PW}), headers={'X-MyIB': '1', 'Content-Type': 'application/json'})

        def me_route(route):
            r = route.fetch(); d = r.json()
            if d.get('assist'): d['assist']['ready'] = True
            route.fulfill(response=r, body=json.dumps(d))
        page.route('**/api/me', me_route)
        page.route('**/api/assist', lambda route: route.fulfill(status=200, content_type='application/json', body=json.dumps(
            REPLY if route.request.method == 'POST' else {'on': True, 'ready': True, 'usage': REPLY['usage']})))
        page.goto(BASE + '/?s=1#today'); page.wait_for_timeout(2500)
        tag = '[%dpx] ' % width
        ok(tag + 'app loaded (mode-app)', 'mode-app' in (page.get_attribute('body', 'class') or ''))
        ok(tag + 'Today shows the date in one line', page.locator('#view h1.display').inner_text().startswith('Tuesday 24 November'))
        ok(tag + 'countdown list rendered', page.locator('.count-list li').count() >= 3)
        ok(tag + 'font is Schibsted Grotesk', 'Schibsted' in page.evaluate("getComputedStyle(document.body).fontFamily"))
        ok(tag + 'font file loaded', page.evaluate("document.fonts.check('16px \"Schibsted Grotesk\"')"))

        # quick add a task on Today
        q = page.locator('#quick-title')
        q.fill('Smoke test task #math'); q.press('Enter'); page.wait_for_timeout(900)
        ok(tag + 'quick add created the task', page.get_by_text('Smoke test task').count() >= 1)
        # tick it off, then untick it
        row = page.locator('.task', has_text='Smoke test task').first
        row.locator('.check input').check(force=True); page.wait_for_timeout(1200)
        tl = page.locator('.task', has_text='Smoke test task')
        ok(tag + 'ticking a task marks it done', tl.count() == 0 or 'done' in (tl.first.get_attribute('class') or ''))

        # tabs
        for t in ['timetable', 'calendar', 'tasks', 'subjects', 'pet', 'today']:
            sel = ('#tabbar' if mobile else '#top-nav') + ' [data-tab="%s"]' % t
            page.locator(sel).first.click(); page.wait_for_timeout(500)
            ok(tag + 'tab ' + t, page.locator('#view').get_attribute('data-view') == t)
        # highlighter on the current tab label
        cur = page.locator(('#tabbar' if mobile else '#top-nav') + ' [aria-current="page"] span').first
        hl = cur.evaluate("e => getComputedStyle(e).backgroundImage + ' ' + getComputedStyle(e, '::before').backgroundColor")
        ok(tag + 'current tab label is highlighted', 'linear-gradient' in hl or 'rgb(255, 225, 77)' in hl)

        # assistant: approve a suggested move, then undo
        page.locator('#assist-btn').click(); page.wait_for_timeout(800)
        box = page.locator('#dlg textarea').first
        box.fill('Move my Historia block')
        if mobile: page.locator('#dlg [data-act="assist-send"]').first.click()
        else: box.press('Enter')
        page.wait_for_timeout(1500)
        ap = page.locator('[data-act="assist-approve"]').first
        ok(tag + 'assistant card shows Approve', ap.count() == 1)
        if ap.count():
            ap.click(); page.wait_for_timeout(1200)
            ok(tag + 'approve marks the card done', page.locator('.as-card.done').count() >= 1)
        page.keyboard.press('Escape'); page.wait_for_timeout(500)

        # settings: dark theme, then highlighter colour, then back
        page.locator('#settings-btn').click(); page.wait_for_timeout(800)
        page.locator('[data-act="set-theme"]', has_text='Dark').first.click(); page.wait_for_timeout(600)
        ok(tag + 'dark theme applies', page.evaluate("document.documentElement.getAttribute('data-theme')") == 'dark')
        page.locator('[data-act="set-accent"][data-accent="pink"]').first.click(); page.wait_for_timeout(500)
        ok(tag + 'highlighter colour applies', page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--hl').trim().toLowerCase()") in ('#f598c6', '#ffaad3'))
        page.locator('[data-act="set-accent"][data-accent=""]').first.click(); page.wait_for_timeout(300)
        page.locator('[data-act="set-theme"]', has_text='Auto').first.click(); page.wait_for_timeout(300)
        page.keyboard.press('Escape'); page.wait_for_timeout(400)

        # chat: send a message to Luca
        page.goto(BASE + '/?s=2#chat'); page.wait_for_timeout(1500)
        agree = page.locator('[data-act="chat-agree"]')
        if agree.count() and agree.first.is_visible(): agree.first.click(); page.wait_for_timeout(800)
        page.locator('[data-act="chat-open"][data-id="dm:luca:mauro"]').first.click(); page.wait_for_timeout(1200)
        ta = page.locator('.cm-compose textarea').first
        ta.fill('smoke test message')
        if mobile: page.locator('.cm-send').first.click()
        else: ta.press('Enter')
        page.wait_for_timeout(1500)
        ok(tag + 'chat message sent', page.get_by_text('smoke test message').count() >= 1)

        # focus timer start and cancel
        page.goto(BASE + '/?s=3#today'); page.wait_for_timeout(1500)
        if page.locator('[data-act="focus-start"]').count():
            page.locator('[data-act="focus-start"]').first.dispatch_event('click'); page.wait_for_timeout(1200)
        ok(tag + 'focus timer runs', page.locator('[data-act="focus-pause"]').count() >= 1)
        c = page.locator('[data-act="focus-cancel"]').first
        if c.count(): c.dispatch_event('click'); page.wait_for_timeout(800)

        # calendar: pick a day, open the new event sheet
        page.goto(BASE + '/?s=4#calendar'); page.wait_for_timeout(1500)
        page.locator('[data-act="cal-sel"][data-date="2026-11-26"]').first.dispatch_event('click'); page.wait_for_timeout(800)
        ok(tag + 'day panel follows the picked day', 'Thursday 26 November' in page.locator('.daypanel h2').first.inner_text())
        page.locator('[data-act="ev-new"]').first.click(); page.wait_for_timeout(800)
        ok(tag + 'event sheet opens', page.locator('#dlg[open]').count() == 1)
        page.keyboard.press('Escape'); page.wait_for_timeout(400)

        # garden (v6.1): the pane opens, a seed plants, the shop sells, the city waits
        page.goto(BASE + '/?s=6#pet'); page.wait_for_timeout(1500)
        page.locator('[data-act="pet-pane"][data-id="garden"]').first.dispatch_event('click'); page.wait_for_timeout(2500)
        ok(tag + 'garden shows plots', page.locator('.farm-plots .plot').count() >= 4)
        before = page.locator('.farm-plots .plot:not(.empty):not(.locked)').count()
        pf = page.locator('[data-act="farm-plantfirst"]:not([aria-disabled])')
        if pf.count():
            pf.first.dispatch_event('click'); page.wait_for_timeout(1800)
            ok(tag + 'a seed plants', page.locator('.farm-plots .plot:not(.empty):not(.locked)').count() == before + 1)
        else:
            ok(tag + 'a seed plants (garden full, skipped)', True)
        page.locator('[data-act="farm-shop"]').first.dispatch_event('click'); page.wait_for_timeout(900)
        ok(tag + 'shop opens', page.locator('#dlg[open] .shop-row').count() >= 5)
        page.keyboard.press('Escape'); page.wait_for_timeout(400)
        page.locator('[data-act="farm-index"]').first.dispatch_event('click'); page.wait_for_timeout(700)
        ok(tag + 'index opens', page.locator('#dlg[open] .ix').count() == 19)
        page.keyboard.press('Escape'); page.wait_for_timeout(400)
        page.locator('[data-act="pet-pane"][data-id="city"]').first.dispatch_event('click'); page.wait_for_timeout(1500)
        ok(tag + 'city shows the drive button', page.locator('[data-act="city-go"]').count() == 1)
        page.locator('[data-act="pet-pane"][data-id="puppy"]').first.dispatch_event('click'); page.wait_for_timeout(1000)
        ok(tag + 'puppy pane comes back', page.locator('.pet-stage').count() >= 1)

        # clean up the smoke task
        page.goto(BASE + '/?s=5#tasks'); page.wait_for_timeout(1500)
        b.close()


run(390, 844, True)
run(1440, 900, False)
print('\n'.join(results))
print('ERRORS:', len(errors))
for e in errors[:20]:
    print(' ', e)
