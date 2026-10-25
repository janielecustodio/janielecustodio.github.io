#!/usr/bin/env python3
"""Collect TSE presidential results per municipality into one compact JSON for the map.

The TSE only publishes municipal results as one file per municipality (~5,570 files), which is too
much for a browser to poll. This script gathers them into eleicoes-2026/dados/mun-<eleicao>.json.
It reads the 27 per-state progress files first and refetches only municipalities whose count
changed since the previous run, so it is cheap to run every few minutes on election night.

It also appends a snapshot of the count (national total from the TSE's BR file, each state summed
from its municipalities, and votes abroad) to dados/serie-<eleicao>.json whenever the count moves,
so the page can chart how each candidate's share evolved and who took the newly counted votes.

Usage: python3 municipios.py 6258 [--out path] [--workers 16]
Standard library only.
"""
import argparse, concurrent.futures as cf, json, os, sys, time, urllib.request

BASE = 'https://resultados.tse.jus.br/oficial/ele2026/'
UFS = 'ac al am ap ba ce df es go ma mg ms mt pa pb pe pi pr rj rn ro rr rs sc se sp to'.split()


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'janielecustodio.com eleicoes-2026'})
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
        except Exception:
            pass
        time.sleep(2 ** i)
    raise RuntimeError('failed: ' + url)


def num(v):
    try:
        return int(str(v).replace('.', ''))
    except (TypeError, ValueError):
        return 0


def votes(j):
    """Valid nominal votes per candidate number, and candidate names."""
    out, names = {}, {}
    for agr in (j.get('carg') or [{}])[0].get('agr', []):
        for par in agr.get('par', []):
            for c in par.get('cand', []):
                if c.get('dvt') and not c['dvt'].startswith('Válido'):
                    continue
                out[c['n']] = out.get(c['n'], 0) + num(c.get('vap'))
                names[c['n']] = [c.get('nmu') or c.get('nm'), par.get('sg', '')]
    return out, names


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('eleicao')
    ap.add_argument('--out')
    ap.add_argument('--workers', type=int, default=16)
    a = ap.parse_args()
    e = a.eleicao
    e6 = e.zfill(6)
    out_path = a.out or os.path.join(os.path.dirname(__file__), '..', 'dados', f'mun-{e}.json')

    prev = {}
    if os.path.exists(out_path):
        with open(out_path) as f:
            prev = json.load(f)
    rows, names = prev.get('m', {}), prev.get('c', {})

    cfg = get(f'{BASE}{e}/config/mun-e{e6}-cm.json')
    if not cfg:
        print('config not published yet'); return
    muns = {}   # tse code -> (uf, ibge, name)
    for abr in cfg['abr']:
        if abr['cd'] == 'zz':
            continue
        for m in abr['mu']:
            muns[m['cd']] = (abr['cd'], m['cdi'], m['nm'])

    progress = {}
    with cf.ThreadPoolExecutor(8) as ex:
        for uf, ab in zip(UFS, ex.map(lambda uf: get(f'{BASE}{e}/dados/{uf}/{uf}-e{e6}-ab.json'), UFS)):
            for m in (ab or {}).get('abr', []):
                if m.get('tpabr') == 'mun':
                    progress[m['cdabr']] = m

    todo = []
    for cd, (uf, ibge, nm) in muns.items():
        p = progress.get(cd)
        if not p:
            continue
        # "2|": rows written before the stale-file check below get refetched once
        sig = f"2|{p['s']['st']}|{p.get('ht', '')}"
        r = rows.get(ibge)
        if r and r[-1] == sig:
            continue
        # progress numbers from the summary; votes need the municipality's own file
        rows[ibge] = [nm.title(), uf.upper(), num(p['e']['te']), num(p['e']['est']), num(p['e']['a']),
                      num(p['s']['st']), num(p['s']['ts']), r[7] if r else [], r[8] if r else 0, '']
        if num(p['s']['st']) > 0:
            todo.append((cd, uf, ibge, sig, num(p['s']['st'])))
        else:
            rows[ibge][-1] = sig

    if not todo and prev and all(r[-1] for r in rows.values()):
        print(f'{len(rows)} municipalities, nothing changed')
        snapshot(e, e6, rows, names, out_path)
        return

    def fetch(job):
        cd, uf, ibge, sig, st = job
        return job, get(f'{BASE}{e}/dados/{uf}/{uf}{cd}-c0001-e{e6}-u.json')

    done = stale = 0
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for (cd, uf, ibge, sig, st), j in ex.map(fetch, todo):
            if not j:
                continue
            # The CDN can still serve an older copy of the municipality's file than the state summary
            # describes (e.g. 0 votes with every section already counted). Keep what it has, but leave
            # the row unsigned so the next run fetches it again.
            if num((j.get('s') or {}).get('st')) < st:
                stale += 1
                sig = ''
                # progress as of that copy, so the row's "% counted" matches its votes
                je = j.get('e') or {}
                rows[ibge][3], rows[ibge][4], rows[ibge][5] = num(je.get('est')), num(je.get('a')), num(j['s'].get('st'))
            v, nm = votes(j)
            names.update(nm)
            top = sorted(v.items(), key=lambda kv: -kv[1])
            rows[ibge][7] = [[n, c] for n, c in top[:3]]
            rows[ibge][8] = sum(v.values())
            rows[ibge][-1] = sig
            done += 1

    doc = {'eleicao': e, 'gerado': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'campos': ['nome', 'uf', 'aptos', 'apurados', 'abstencoes', 'secoes_tot', 'secoes', 'top3 [numero, votos]', 'votos_validos', 'sig'],
           'c': names, 'm': rows}
    tmp = out_path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, out_path)
    print(f'{len(rows)} municipalities, {len(todo)} changed, {done} fetched ({stale} stale, retry next run) -> {out_path}')
    snapshot(e, e6, rows, names, out_path)


def snapshot(e, e6, rows, names, out_path):
    """Append {t, pst, v, uf, zz} to serie-<e>.json when the national count changed."""
    br = get(f'{BASE}{e}/dados/br/br-c0001-e{e6}-u.json')
    if not br:
        return
    v_br, nm = votes(br)
    names.update(nm)
    zz = get(f'{BASE}{e}/dados/zz/zz-c0001-e{e6}-u.json')
    v_zz = votes(zz)[0] if zz else {}
    uf = {}
    for r in rows.values():
        u = uf.setdefault(r[1], [0, 0, {}])
        u[0] += r[5]; u[1] += r[6]
        for n, c in r[7]:
            u[2][n] = u[2].get(n, 0) + c
    point = {'t': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'tse': f"{br.get('dt', '')} {br.get('ht', '')}".strip(),
             'pst': br['s']['pst'], 'pea': br['e'].get('pest', ''), 'v': v_br,
             'zz': [num(zz['s']['st']), num(zz['s']['ts']), v_zz] if zz else None, 'uf': uf}
    path = os.path.join(os.path.dirname(out_path), f'serie-{e}.json')
    doc = {'eleicao': e, 'c': {}, 'pontos': []}
    if os.path.exists(path):
        with open(path) as f:
            doc = json.load(f)
    last = doc['pontos'][-1] if doc['pontos'] else None
    if last and last['v'] == point['v'] and last['pst'] == point['pst']:
        return
    if not sum(v_br.values()):
        return   # nothing counted yet
    doc['c'].update({n: names[n] for n in v_br if n in names})
    doc['pontos'].append(point)
    tmp = path + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
    os.replace(tmp, path)
    print(f"snapshot {point['pst']}% -> {path}")


if __name__ == '__main__':
    sys.exit(main())
