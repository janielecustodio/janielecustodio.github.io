#!/usr/bin/env python3
"""Collect TSE presidential results per municipality into one compact JSON for the map.

The TSE only publishes municipal results as one file per municipality (~5,570 files), which is too
much for a browser to poll. This script gathers them into eleicoes-2026/dados/mun-<eleicao>.json.
It reads the 27 per-state progress files first and refetches only municipalities whose count
changed since the previous run, so it is cheap to run every few minutes on election night.

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
        sig = f"{p['s']['st']}|{p.get('ht', '')}"
        r = rows.get(ibge)
        if r and r[-1] == sig:
            continue
        # progress numbers from the summary; votes need the municipality's own file
        rows[ibge] = [nm.title(), uf.upper(), num(p['e']['te']), num(p['e']['est']), num(p['e']['a']),
                      num(p['s']['st']), num(p['s']['ts']), r[7] if r else [], r[8] if r else 0, '']
        if num(p['s']['st']) > 0:
            todo.append((cd, uf, ibge, sig))
        else:
            rows[ibge][-1] = sig

    def fetch(job):
        cd, uf, ibge, sig = job
        return job, get(f'{BASE}{e}/dados/{uf}/{uf}{cd}-c0001-e{e6}-u.json')

    done = 0
    with cf.ThreadPoolExecutor(a.workers) as ex:
        for (cd, uf, ibge, sig), j in ex.map(fetch, todo):
            if not j:
                continue
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
    print(f'{len(rows)} municipalities, {len(todo)} changed, {done} fetched -> {out_path}')


if __name__ == '__main__':
    sys.exit(main())
