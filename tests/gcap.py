"""Garden and City screenshots. Usage: python3 gcap.py BASE OUTDIR [phone|desktop]"""
import sys, os, json
from playwright.sync_api import sync_playwright
BASE=sys.argv[1].rstrip('/'); OUT=sys.argv[2]; KIND=sys.argv[3] if len(sys.argv)>3 else 'phone'
USER=sys.argv[4] if len(sys.argv)>4 else 'mauro'
os.makedirs(OUT, exist_ok=True)
PW='Bloc-local-2026!'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    if KIND=='phone':
        ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True,timezone_id='Europe/Madrid',locale='en-GB')
    else:
        ctx=b.new_context(viewport={'width':1440,'height':900},device_scale_factor=1,timezone_id='Europe/Madrid',locale='en-GB')
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    page.on('console', lambda m: errs.append('console.'+m.type+': '+m.text) if m.type=='error' else None)
    ctx.request.post(BASE+'/api/login', data=json.dumps({'user':USER,'password':PW}), headers={'X-MyIB':'1','Content-Type':'application/json'})
    page.goto(BASE+'/?app=1#today'); page.wait_for_timeout(2000)
    page.evaluate("()=>{localStorage.setItem('myib:petpane:%s','garden')}" % USER)
    page.goto(BASE+'/?app=1#pet'); page.wait_for_timeout(2000)
    page.locator('[data-act="pet-pane"][data-id="garden"]').first.click(); page.wait_for_timeout(3000)
    k=KIND[0]
    page.screenshot(path=f'{OUT}/{k}-garden.png', full_page=True)
    # tap first empty plot
    e=page.locator('.plot.empty').first
    if e.count(): e.click(); page.wait_for_timeout(700); page.screenshot(path=f'{OUT}/{k}-plant-sheet.png'); page.keyboard.press('Escape'); page.wait_for_timeout(400)
    page.locator('[data-act="farm-shop"]').first.click(); page.wait_for_timeout(700); page.screenshot(path=f'{OUT}/{k}-shop.png'); page.keyboard.press('Escape'); page.wait_for_timeout(400)
    page.locator('[data-act="farm-places"]').first.click(); page.wait_for_timeout(700); page.screenshot(path=f'{OUT}/{k}-places.png'); page.keyboard.press('Escape'); page.wait_for_timeout(400)
    page.locator('[data-act="farm-index"]').first.click(); page.wait_for_timeout(700); page.screenshot(path=f'{OUT}/{k}-index.png'); page.keyboard.press('Escape'); page.wait_for_timeout(400)
    page.locator('[data-act="pet-pane"][data-id="city"]').first.click(); page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/{k}-city.png', full_page=True)
    page.locator('[data-act="pet-pane"][data-id="puppy"]').first.click(); page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/{k}-puppy.png')
    print('\n'.join(errs) or 'no errors')
