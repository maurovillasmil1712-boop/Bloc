"""Bloc City screenshots. Usage: python3 dcap.py BASE OUTDIR [desktop|phone] [sky]"""
import sys, os, json, time
from playwright.sync_api import sync_playwright
BASE=sys.argv[1].rstrip('/'); OUT=sys.argv[2]; KIND=sys.argv[3] if len(sys.argv)>3 else 'desktop'; SKY=sys.argv[4] if len(sys.argv)>4 else 'live'
os.makedirs(OUT, exist_ok=True)
PW='Bloc-local-2026!'
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    if KIND=='phone':
        ctx=b.new_context(viewport={'width':844,'height':390},device_scale_factor=2,is_mobile=True,has_touch=True,timezone_id='Europe/Madrid',locale='en-GB')
    else:
        ctx=b.new_context(viewport={'width':1280,'height':720},device_scale_factor=1,timezone_id='Europe/Madrid',locale='en-GB')
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    page.on('console', lambda m: errs.append('console.'+m.type+': '+m.text) if m.type in ('error','warning') else None)
    ctx.request.post(BASE+'/api/login', data=json.dumps({'user':'mauro','password':PW}), headers={'X-MyIB':'1','Content-Type':'application/json'})
    page.goto(BASE+'/?app=1#today'); page.wait_for_timeout(1500)
    page.evaluate("(s)=>{localStorage.setItem('bloc:city:sky', s); localStorage.setItem('bloc:city:snd','off')}", SKY)
    page.goto(BASE+'/?app=1#pet'); page.wait_for_timeout(1500)
    page.locator('[data-act="pet-pane"][data-id="city"]').first.click(); page.wait_for_timeout(1500)
    t0=time.time()
    page.locator('[data-act="city-go"]').first.click()
    page.wait_for_selector('.bc-root canvas.bc-gl', timeout=30000)
    page.wait_for_timeout(2500)
    print('loaded in %.1fs' % (time.time()-t0))
    k=KIND[0]
    page.screenshot(path=f'{OUT}/{k}-drive-start-{SKY}.png')
    page.keyboard.down('KeyW'); page.wait_for_timeout(2500)
    page.screenshot(path=f'{OUT}/{k}-drive-go-{SKY}.png')
    page.keyboard.down('KeyD'); page.wait_for_timeout(900); page.keyboard.up('KeyD')
    page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/{k}-drive-turn-{SKY}.png')
    page.keyboard.up('KeyW')
    fps = page.evaluate("""() => new Promise(r => { let n=0; const t0=performance.now(); function f(){ n++; if (performance.now()-t0<2000) requestAnimationFrame(f); else r(n/2); } requestAnimationFrame(f); })""")
    print('fps (software GL)', fps)
    page.keyboard.press('KeyM'); page.wait_for_timeout(600)
    page.screenshot(path=f'{OUT}/{k}-drive-map.png')
    page.keyboard.press('KeyM'); page.wait_for_timeout(300)
    page.locator('.bc-btn.x').click(); page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/{k}-drive-end.png')
    page.locator('.bc-card button').click(); page.wait_for_timeout(1500)
    page.screenshot(path=f'{OUT}/{k}-drive-back.png')
    print('\n'.join(errs) or 'no errors')
