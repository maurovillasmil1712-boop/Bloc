/* Routes along the real road graph (v7.7), for "Drive to" waypoints and mission objectives: A* over plan.nodes and
   plan.edges, returning the polyline to follow. */
/* the road graph has small islands (dead-end stubs, lanes that join the grid without a node), so routes only use the
   biggest connected network; a point off it gets a straight last stretch */
function mainNet(plan) {
  if (plan._main) return plan._main;
  const N = plan.nodes, E = plan.edges, comp = new Int32Array(N.length).fill(-1), sizes = [];
  for (let i = 0; i < N.length; i++) {
    if (comp[i] >= 0 || !N[i].edges.length) continue;
    const k = sizes.length, st = [i]; comp[i] = k; let n = 0;
    while (st.length) { const c = st.pop(); n++; for (const ei of N[c].edges) { const e = E[ei], o = e.a === c ? e.b : e.a; if (comp[o] < 0) { comp[o] = k; st.push(o); } } }
    sizes.push(n);
  }
  const big = sizes.indexOf(Math.max(...sizes)), main = new Uint8Array(N.length);
  for (let i = 0; i < N.length; i++) main[i] = comp[i] === big ? 1 : 0;
  return (plan._main = main);
}
export function nearestNode(plan, x, z) {
  let best = -1, bd = 1e18; const main = mainNet(plan);
  for (const n of plan.nodes) { if (!n.edges.length || !main[n.id]) continue; const d = (n.x - x) * (n.x - x) + (n.z - z) * (n.z - z); if (d < bd) { bd = d; best = n.id; } }
  return best;
}
export function route(plan, x0, z0, x1, z1) {
  const N = plan.nodes, E = plan.edges, a = nearestNode(plan, x0, z0), b = nearestNode(plan, x1, z1);
  if (a < 0 || b < 0) return null;
  const g = new Map([[a, 0]]), from = new Map(), open = [[0, a]], done = new Set();
  const h = (i) => Math.hypot(N[i].x - N[b].x, N[i].z - N[b].z);
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
    const [, cur] = open.splice(bi, 1)[0];
    if (cur === b) break;
    if (done.has(cur)) continue; done.add(cur);
    for (const ei of N[cur].edges) {
      const e = E[ei], nx = e.a === cur ? e.b : e.a; if (done.has(nx)) continue;
      const cost = g.get(cur) + e.len * (e.kind === 'lane' ? 1.25 : 1);
      if (cost < (g.has(nx) ? g.get(nx) : 1e18)) { g.set(nx, cost); from.set(nx, [cur, ei]); open.push([cost + h(nx), nx]); }
    }
    if (done.size > 20000) break;
  }
  if (a !== b && !from.has(b)) return null;
  const pts = [[x0, z0]];
  const chain = []; for (let c = b; c !== a; c = from.get(c)[0]) chain.push(from.get(c));
  chain.reverse();
  for (const [n, ei] of chain) { const e = E[ei], p = e.a === n ? e.pts : e.pts.slice().reverse(); for (let i = 0; i < p.length; i += 1) pts.push(p[i]); }
  pts.push([x1, z1]);
  let total = 0; for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return { pts, total };
}
/* how far along the route you are: index of the nearest point and the distance still to go */
export function progress(r, x, z) {
  let bi = 0, bd = 1e18;
  for (let i = 0; i < r.pts.length; i++) { const p = r.pts[i], d = (p[0] - x) * (p[0] - x) + (p[1] - z) * (p[1] - z); if (d < bd) { bd = d; bi = i; } }
  let left = Math.sqrt(bd); for (let i = bi + 1; i < r.pts.length; i++) left += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
  return { i: bi, off: Math.sqrt(bd), left };
}
