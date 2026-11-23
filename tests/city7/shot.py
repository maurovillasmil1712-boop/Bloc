#!/usr/bin/env python3
"""Screenshot Bloc City v7 from fixed viewpoints. Software WebGPU (SwiftShader) here, so judge looks, not speed.
Usage: python3 shot.py BASE_URL OUTDIR [name=query ...]   e.g. plaza="cam=-380,40,60,-380,8,-120&time=2026-06-21T17:00:00Z"
"""
import asyncio, sys, os, time
from playwright.async_api import async_playwright
ARGS_GPU = ['--enable-unsafe-webgpu', '--enable-features=Vulkan,WebGPU', '--use-vulkan=swiftshader', '--use-webgpu-adapter=swiftshader', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-vulkan-surface', '--ignore-gpu-blocklist']
async def main():
    base, out = sys.argv[1], sys.argv[2]
    shots = [a.split('=', 1) for a in sys.argv[3:]]
    os.makedirs(out, exist_ok=True)
    W, H = int(os.environ.get('W', 1280)), int(os.environ.get('H', 720))
    frames = int(os.environ.get('FRAMES', 6))
    async with async_playwright() as p:
        b = await p.chromium.launch(args=ARGS_GPU)
        for name, q in shots:
            pg = await b.new_page(viewport={'width': W, 'height': H})
            logs = []
            pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning', 'log') else None)
            pg.on('pageerror', lambda e: logs.append(f'pageerror: {e}'))
            t0 = time.time()
            await pg.goto(base + '/city/' + os.environ.get('PAGE', '') + '?test=1&' + q)
            try:
                await pg.wait_for_function(f'window.__city && window.__city.frames() >= {frames}', timeout=int(os.environ.get('TIMEOUT', 600)) * 1000, polling=1000)
            except Exception as e:
                logs.append('TIMEOUT ' + str(e)[:120])
            info = await pg.evaluate('() => window.__city ? {preset: window.__city.preset, webgpu: window.__city.webgpu, calls: window.__city.info().render.drawCalls, tris: window.__city.info().render.triangles, chunks: window.__city.city.stats.chunks} : null')
            data = None
            if os.environ.get('SNAP') == '1':
                try:
                    data = await pg.evaluate('async () => window.__city ? await window.__city.snap() : null')
                except Exception as e:
                    logs.append('snap failed ' + str(e)[:200])
            if data and data.startswith('data:image/png;base64,'):
                import base64
                open(os.path.join(out, name + '.png'), 'wb').write(base64.b64decode(data.split(',', 1)[1]))
            else:
                await pg.screenshot(path=os.path.join(out, name + '.png'), timeout=int(os.environ.get('SHOT_TIMEOUT', 180)) * 1000)
            print(f'{name}: {time.time() - t0:.0f}s {info}', flush=True)
            for l in logs[:12]: print('   ', l[:300], flush=True)
            await pg.close()
        await b.close()
asyncio.run(main())
