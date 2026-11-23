import json, sys, requests, time
BASE='http://127.0.0.1:8789'
H={'X-MyIB':'1','Accept':'application/json','Content-Type':'application/json'}
PW='Bloc-local-2026!'
def sess(u):
    s=requests.Session(); s.trust_env=False; s.headers.update(H)
    r=s.post(BASE+'/api/login',data=json.dumps({'user':u,'password':PW})); assert r.status_code<400, r.text
    return s
def P(s,path,body,ok=True):
    r=s.post(BASE+path,data=json.dumps(body))
    if ok and r.status_code>=400: print('  !',path,body,r.status_code,r.text[:300])
    return r
m=sess('mauro'); l=sess('luca')
r=m.get(BASE+'/api/farm?cat=1'); d=r.json(); print('GET farm', r.status_code, 'coins',d['farm']['coins'],'sun',d['farm']['sun'],'fuel',d['farm']['fuel'],'fresh',d.get('fresh'),'stars',d['stars'],'study',d['study'], 'loc', d['loc'], 'wx', {k:d['wx'][k] for k in ('rain','golden','night','weekend')})
print('shop', d['shop'])
print('species', len(d['cat']['species']), 'trials', [(t['id'],t['len'],t['gold']) for t in d['cat']['trials']])
r=m.get(BASE+'/api/farm/plot?g=me'); pl=r.json()['plot']; print('plot', pl['open'], len(pl['plots']), pl['houses'])
r=P(m,'/api/farm/act',{'a':'plant','g':'me','i':0,'s':'basil'}); print('plant', r.status_code, r.json().get('msg'), r.json()['farm']['sun'], r.json()['plot']['plots'][0])
r=P(m,'/api/farm/act',{'a':'water','g':'me','i':0}); print('water', r.status_code, r.json().get('got'), r.json()['plot']['plots'][0]['ready'])
r=P(m,'/api/farm/act',{'a':'harvest','g':'me','i':0},ok=False); print('harvest early', r.status_code, r.text[:80])
r=P(m,'/api/farm/act',{'a':'buy','s':'tomato','n':1}); print('buy', r.status_code, r.json().get('msg'), r.json()['farm']['coins'], r.json()['farm']['seeds'])
r=P(m,'/api/farm/act',{'a':'house'},ok=False); print('house', r.status_code, r.text[:120])
r=P(m,'/api/farm/act',{'a':'star'},ok=False); print('star', r.status_code, r.text[:160])
# shared garden
r=P(m,'/api/garden/new',{'name':'Sociales 2','users':['luca']}); gid=r.json().get('id'); print('garden', r.status_code, gid)
r=P(l,'/api/garden/answer',{'garden':gid,'join':True}); print('join', r.status_code)
r=m.get(BASE+'/api/farm/plot?g='+gid); print('shared plot', r.status_code, r.json()['plot']['open'], r.json()['plot']['houses'])
r=P(m,'/api/farm/act',{'a':'plant','g':gid,'i':2,'s':'radish'}); print('plant shared', r.status_code)
r=l.get(BASE+'/api/farm'); print('luca farm', r.json()['farm']['sun'], r.json()['farm']['coins'])
r=P(l,'/api/farm/act',{'a':'water','g':gid,'i':2}); print('luca water', r.status_code, r.json().get('got'))
r=P(l,'/api/farm/act',{'a':'harvest','g':gid,'i':2},ok=False); print('luca harvest (not his)', r.status_code, r.text[:60])
r=P(m,'/api/farm/act',{'a':'move','g':gid,'to':'beach'},ok=False); print('move locked', r.status_code, r.text[:60])
r=m.get(BASE+'/api/farm/now'); print('now', r.status_code, r.json())
r=P(m,'/api/farm/drive',{'a':'start'}); dj=r.json(); print('drive start', r.status_code, dj.get('run'), dj.get('fuel'), [ (h['id'],h['loc']) for h in dj.get('homes',[])])
time.sleep(2)
r=P(m,'/api/farm/drive',{'a':'end','run':dj['run']['id'],'secs':2,'notes':[1,2,3,4],'crates':[0],'jumps':[0],'visits':['luca'],'trial':{'id':'beach','ms':5000}}); print('drive end', r.status_code, r.json().get('result'), r.json()['farm']['fuel'], r.json()['farm']['coins'])
r=l.get(BASE+'/api/farm'); print('luca after visit', r.json()['farm']['coins'], r.json()['farm']['log'][:1])
