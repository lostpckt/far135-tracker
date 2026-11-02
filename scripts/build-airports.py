#!/usr/bin/env python3
"""Rebuild src/data/airports.txt: 3-character airport codes -> ICAO codes.

Source: OurAirports (public domain), https://ourairports.com/data/
Run from far135-react/:   python3 scripts/build-airports.py [airports.csv]
With no argument it downloads the current airports.csv.

One line per code: the US FAA identifier or worldwide IATA code, then its ICAO code
(or codes, when one 3-character code matches several airports), space-separated.
Plain text rather than JSON so the bundled copy needs no escaping.
A US field with no official ICAO entry uses its K/P code from gps_code.
Codes with no ICAO match (e.g. L52, 0Q3) are left out, so the app accepts them as typed.
"""
import csv, io, re, sys, urllib.request

URL = 'https://davidmegginson.github.io/ourairports-data/airports.csv'
OUT = 'src/data/airports.txt'

if len(sys.argv) > 1:
    text = open(sys.argv[1], encoding='utf-8').read()
else:
    text = urllib.request.urlopen(URL, timeout=60).read().decode('utf-8')

icao_re = re.compile(r'[A-Z]{4}')
three = re.compile(r'[A-Z0-9]{3}')
codes = {}
for r in csv.DictReader(io.StringIO(text)):
    if r['type'] == 'closed':
        continue
    ic = r['icao_code'] if icao_re.fullmatch(r['icao_code'] or '') else ''
    if not ic and r['iso_country'] == 'US' and re.fullmatch(r'[KP][A-Z]{3}', r['gps_code'] or ''):
        ic = r['gps_code']
    if ic:
        codes[ic] = r

out = {}
for ic, r in codes.items():
    keys = [r['iata_code']] + ([r['local_code']] if r['iso_country'] == 'US' else [])
    for k in keys:
        if k and three.fullmatch(k) and k != ic:
            out.setdefault(k, set()).add(ic)

lines = [' '.join([k, *sorted(v)]) for k, v in sorted(out.items())]
with open(OUT, 'w') as f:
    f.write('\n'.join(lines) + '\n')
print(f'{OUT}: {len(lines)} codes, {sum(1 for v in out.values() if len(v) > 1)} with more than one match')
