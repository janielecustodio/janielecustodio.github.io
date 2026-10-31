#!/usr/bin/env python3
"""Backtest of the final-result projection, rebuilt from the election-night history in git.

The election-night job committed dados/mun-<eleicao>.json every few minutes, so git holds the count as
it stood at each moment. For each of those snapshots this script recomputes:

  raw  - each candidate's share of the votes counted so far (official BR file, from dados/serie-<eleicao>.json)
  uf   - the page's projection: in each state, votes x electorate / counted electorate, summed
  mun  - the same rule applied per municipality (municipalities with nothing counted yet take their
         state's counted rate), summed

Votes abroad are added to both projections scaled by sections (the series keeps sections, not
electorate, for abroad). Rows the CDN served stale (sections counted but 0 votes; fixed in the
collector at about 20:36 BRT) count as not yet counted.

Writes dados/backtest-<eleicao>.json. Run from the repository root:
  python3 eleicoes-2026/scripts/backtest.py 6258
Standard library only.
"""
import json, os, subprocess, sys

DIR = 'eleicoes-2026/dados'


def git(*a):
    return subprocess.run(['git', *a], capture_output=True, text=True, check=True).stdout


def shares(v):
    t = sum(v.values())
    return {n: round(x / t * 100, 3) for n, x in v.items()} if t else None


def main():
    e = sys.argv[1] if len(sys.argv) > 1 else '6258'
    path = f'{DIR}/mun-{e}.json'
    serie = json.load(open(f'{DIR}/serie-{e}.json'))
    pontos = serie['pontos']
    final = pontos[-1]
    if final['pst'] != '100,00':
        sys.exit('the count is not finished in serie-%s.json' % e)
    out = []
    for h in git('log', '--reverse', '--format=%h', 'HEAD', '--', path).split():
        d = json.loads(git('show', f'{h}:{path}'))
        g = d['gerado']
        sp = [p for p in pontos if p['t'] <= g]
        if not sp:
            continue
        sp = sp[-1]
        cands = list(sp['v'])
        uf, mun = {}, {n: 0.0 for n in cands}
        for r in d['m'].values():
            u = uf.setdefault(r[1], {'e': 0, 'ea': 0, 'unc': 0, 'v': {n: 0 for n in cands}})
            u['e'] += r[2]
            if not r[3] or (r[5] > 0 and r[8] == 0):   # nothing counted, or a stale copy
                u['unc'] += r[2]
                continue
            u['ea'] += r[3]
            vv = dict(r[7])
            for n in cands:
                u['v'][n] += vv.get(n, 0)
                mun[n] += vv.get(n, 0) * r[2] / r[3]
        proj = {n: 0.0 for n in cands}
        for u in uf.values():
            if not u['ea']:
                continue
            for n in cands:
                proj[n] += u['v'][n] * u['e'] / u['ea']
                mun[n] += u['unc'] * u['v'][n] / u['ea']
        st, ts, zv = sp['zz']
        for n in cands:
            z = zv.get(n, 0) * (ts / st if st else 0)
            proj[n] += z
            mun[n] += z
        pt = {'t': g, 'pst': float(sp['pst'].replace(',', '.')), 'raw': shares(sp['v']), 'uf': shares(proj), 'mun': shares(mun)}
        if out and out[-1]['t'] == pt['t']:
            continue
        out.append(pt)
    doc = {'eleicao': e, 'c': serie['c'], 'final': shares(final['v']), 'final_t': final['t'], 'pontos': out}
    with open(f'{DIR}/backtest-{e}.json', 'w') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(out)} points -> {DIR}/backtest-{e}.json')


if __name__ == '__main__':
    main()
