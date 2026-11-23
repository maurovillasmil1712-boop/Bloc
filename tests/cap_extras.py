"""Sheets and secondary screens. Usage: python3 cap_extras.py BASE OUTDIR [light|dark]"""
import sys, os, json, datetime as dt
from playwright.sync_api import sync_playwright

BASE = sys.argv[1].rstrip('/')
OUT = sys.argv[2]
THEME = sys.argv[3] if len(sys.argv) > 3 else 'light'
os.makedirs(OUT, exist_ok=True)
PW = 'Bloc-local-2026!'
T0 = dt.datetime(2026, 11, 24, 10, 32, tzinfo=dt.timezone(dt.timedelta(hours=1)))
errors = []


def settle(page, ms=900):
    page.wait_for_timeout(ms)


def snap(page, name, full=False):
    page.screenshot(path=os.path.join(OUT, name + '.png'), full_page=full)


def esc(page):
    page.keyboard.press('Escape'); settle(page, 500)


def login(ctx, page, user):
    ctx.request.post(BASE + '/api/login', data=json.dumps({'user': user, 'password': PW}),
                     headers={'X-MyIB': '1', 'Content-Type': 'application/json'})


def click_text(page, text):
    loc = page.get_by_text(text, exact=True)
    if loc.count():
        loc.first.click(); settle(page, 1000); return True
    return False


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        timezone_id='Europe/Madrid', locale='en-GB', color_scheme=THEME)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: errors.append('console.error: ' + m.text) if m.type == 'error' else None)
    page.clock.install(time=T0); page.clock.resume()
    login(ctx, page, 'mauro')
    page.goto(BASE + '/?x=1#calendar'); settle(page, 2500)

    ev = page.locator('[data-act="ev-new"]').first
    if ev.count():
        ev.click(); settle(page); snap(page, 'e01-event-sheet'); esc(page)
    lm = page.locator('[data-act="cal-mode"]').nth(1)
    if lm.count():
        lm.click(); settle(page); snap(page, 'e02-calendar-list'); lm = page.locator('[data-act="cal-mode"]').first; lm.click(); settle(page)

    page.goto(BASE + '/?x=2#tasks'); settle(page, 2000)
    t = page.locator('[data-act="task-open"]').first
    if t.count():
        t.click(); settle(page); snap(page, 'e03-task-sheet'); esc(page)

    page.goto(BASE + '/?x=3#subjects'); settle(page, 2000)
    s = page.locator('[data-act="subj-open"]').first
    if s.count():
        s.click(); settle(page); snap(page, 'e04-subject-sheet'); esc(page)

    page.goto(BASE + '/?x=4#pet'); settle(page, 2000)
    w = page.locator('[data-act="pet-wardrobe"]').first
    if w.count():
        w.click(); settle(page); snap(page, 'e05-wardrobe'); esc(page)

    page.goto(BASE + '/?x=5#today'); settle(page, 2000)
    page.locator('#settings-btn').click(); settle(page)
    if click_text(page, 'Bloc Plus'):
        snap(page, 'e06-plus')
    esc(page)
    page.locator('#settings-btn').click(); settle(page)
    if click_text(page, 'Connect Siri'):
        snap(page, 'e07-siri')
    esc(page)
    page.locator('#settings-btn').click(); settle(page)
    if click_text(page, 'Reminders'):
        snap(page, 'e08-reminders')
    esc(page)

    page.goto(BASE + '/?open=extra'); settle(page, 2500)
    snap(page, 'e09-extra')
    esc(page)
    ctx.close()

    # a brand-new outside account (Bachillerato): the setup guide
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                        timezone_id='Europe/Madrid', locale='en-GB', color_scheme=THEME)
    page = ctx.new_page()
    page.on('pageerror', lambda e: errors.append('pageerror(lucia): ' + str(e)))
    page.clock.install(time=T0); page.clock.resume()
    page.goto(BASE + '/'); settle(page, 1200)
    lv = page.locator('[data-act="auth-level"][data-level="bach"]')
    if lv.count():
        lv.first.click(); settle(page, 1000); snap(page, 'e10-auth-other')
    login(ctx, page, 'lucia.m')
    page.goto(BASE + '/?x=6#today'); settle(page, 2500)
    snap(page, 'e11-free-today')
    esc(page)
    snap(page, 'e12-free-today-after-welcome')
    ctx.close()
    b.close()

with open(os.path.join(OUT, 'e-errors.txt'), 'w') as f:
    f.write('\n'.join(errors))
print('done', len(errors), 'errors')
