"""Bloc City views from set places. Usage: python3 dcap2.py BASE OUTDIR"""
import sys, os, json, time
from playwright.sync_api import sync_playwright
BASE=sys.argv[1].rstrip('/'); OUT=sys.argv[2]
PW='Bloc-local-2026!'
import os as _os
ALL=[ # name, sky, x, z, heading
 ('beach-sunset','sunset',1200,700,3.14159),
 ('downtown-day','live',0,-120,3.14159),
 ('bridge-sunset','sunset',1180,-316,1.5708),
 ('oldtown-night','night',-760,3.5,1.5708),
 ('island-sunset','sunset',1640,-316,1.5708),
]
WANT=_os.environ.get('SHOTS','').split(',')
SHOTS=[x for x in ALL if not WANT[0] or x[0] in WANT]
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':1280,'height':720},device_scale_factor=1,timezone_id='Europe/Madrid',locale='en-GB')
    page=ctx.new_page(); errs=[]
    page.on('pageerror', lambda e: errs.append('pageerror: '+str(e)))
    ctx.request.post(BASE+'/api/login', data=json.dumps({'user':'mauro','password':PW}), headers={'X-MyIB':'1','Content-Type':'application/json'})
    page.goto(BASE+'/?app=1#today'); page.wait_for_timeout(1200)
    for name, sky, x, z, h in SHOTS:
        page.evaluate("(s)=>{localStorage.setItem('bloc:city:sky', s); localStorage.setItem('bloc:city:snd','off'); localStorage.setItem('bloc:city:debug','1')}", sky)
        page.goto(BASE+'/?app=1#pet'); page.wait_for_timeout(1200)
        page.locator('[data-act="pet-pane"][data-id="city"]').first.click(); page.wait_for_timeout(1200)
        page.locator('[data-act="city-go"]').first.click()
        page.wait_for_selector('.bc-root canvas.bc-gl', timeout=30000); page.wait_for_timeout(1500)
        page.evaluate("([x,z,h])=>{const c=window.__blocCity.car; c.x=x; c.z=z; c.h=h; c.vx=0; c.vz=0; const cp=window.__blocCity.camPos; cp.set(x-Math.sin(h)*12, 6, z-Math.cos(h)*12);}", [x,z,h])
        page.wait_for_timeout(2500)
        page.screenshot(path=f'{OUT}/city-{name}.png')
        page.locator('.bc-btn.x').click(); page.wait_for_timeout(800)
        page.locator('.bc-card button').click(); page.wait_for_timeout(800)
    print('\n'.join(errs) or 'no errors')
