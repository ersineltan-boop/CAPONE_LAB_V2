"""Official BATA Europe women-only staging. No live catalog writes."""
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from threading import Lock, Event
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path('data/brands/bata-staging')
URL = 'https://www.bata.com/pt/woman/brand/bata/?start=0'


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    os.replace(temporary, path)


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def footwear_scope(item):
    if item.get('brand', '').upper() != 'BATA':
        return False
    if item.get('category1') == 'Woman' and item.get('category2') == 'Shoes':
        return item.get('gender-name') not in ['Men', 'Gentlemen', 'Boys']
    return item.get('gender-name') == 'Ladies' and item.get('category2') in [None, 'Collections'] and bool(re.search(r'\b(?:sneakers?|loafers?|ballerinas?|sandals?|boots?|moccasins?|pumps?|espadrilles?)\b', item.get('name', ''), re.I))


def same_source_style(listing_id, mpn):
    return isinstance(mpn, str) and bool(re.fullmatch(re.escape(listing_id) + r'(?:_[0-9]{2})?', mpn))


class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.items = []
        self.total = None
        self.next = None
        self.canonical = None
        self.schema = []
        self.script = False
        self.copy = ''
        self.divs = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'div':
            self.divs.append(a)
        tile = next((d for d in reversed(self.divs) if d.get('data-testid') == 'plp-product-tile'), None)
        if tag == 'a' and a.get('data-testid') == 'plp-product-link' and tile is not None:
            tile['_tileurl'] = urllib.parse.urljoin('https://www.bata.com', a['href'])
        if a.get('data-total-products'):
            self.total = int(a['data-total-products'])
        if a.get('data-testid') == 'plp-load-more':
            self.next = a.get('data-url')
        if 'analytics-product' in a.get('class', '').split() and a.get('data-producturl') and any(d.get('data-testid') == 'plp-product-tile' for d in self.divs):
            item = {k[5:]: v for k, v in a.items() if k.startswith('data-')}
            item['tileurl'] = tile.get('_tileurl')
            self.items.append(item)
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.script = True
            self.copy = ''

    def handle_data(self, data):
        if self.script:
            self.copy += data

    def handle_endtag(self, tag):
        if tag == 'div' and self.divs:
            self.divs.pop()
        if tag == 'script' and self.script:
            self.script = False
            try:
                value = json.loads(self.copy)
                if isinstance(value, dict) and value.get('@type') == 'Product':
                    self.schema.append(value)
            except json.JSONDecodeError:
                pass


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    now = dt.datetime.now(dt.timezone.utc)
    retry_path = ROOT / 'retry.json'
    if retry_path.exists() and dt.datetime.fromisoformat(json.loads(retry_path.read_text())['retryAt']) > now:
        raise RuntimeError('BATA shared staging retry window active')
    path = ROOT / 'progress.json'
    state = json.loads(path.read_text()) if path.exists() else {
        'checkedAt': now.isoformat(), 'status': 'PARTIAL', 'next': URL, 'total': None, 'parts': [], 'galleries': {}, 'excluded': []}
    if state['status'] == 'SOURCE_VERIFIED' or now - dt.datetime.fromisoformat(state['checkedAt']) > dt.timedelta(hours=24):
        archive = ROOT.with_name('bata-staging-epoch-' + str(time.time_ns()))
        ROOT.rename(archive)
        ROOT.mkdir(parents=True)
        state = {'checkedAt': now.isoformat(), 'status': 'PARTIAL', 'next': URL, 'total': None, 'parts': [], 'galleries': {}, 'excluded': []}
    state.pop('error', None)
    parts = []
    for part in state['parts']:
        values = json.loads((ROOT / part['file']).read_text())
        if digest(values) != part['sha256']:
            raise RuntimeError('Listing part checksum mismatch')
        parts.extend(values)
    for entry in state['galleries'].values():
        if digest(json.loads((ROOT / entry['file']).read_text())) != entry['sha256']:
            raise RuntimeError('Gallery checksum mismatch')
    requests = 0
    started = time.monotonic()
    request_lock = Lock()
    stopped = Event()

    def expire(_signum, _frame):
        raise TimeoutError('Absolute staging deadline')

    def get(url):
        nonlocal requests
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.netloc != 'www.bata.com':
            raise RuntimeError('Out-of-scope URL')
        with request_lock:
            if stopped.is_set():
                raise RuntimeError('Source stopped after access block')
            if requests >= 80 or time.monotonic() - started >= 175:
                raise TimeoutError('Bounded staging budget')
            requests += 1
            time.sleep(.5)
        request = urllib.request.Request(url, headers={'User-Agent': 'CAPONE-LAB-source-check/1.0'})
        try:
            response = urllib.request.urlopen(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        body = response.read(3_000_001)
        human = bool(re.search(b'verify (?:that )?you are human|checking your browser|captcha-delivery.com|just a moment', body, re.I))
        if response.code in [401, 403, 429] or human:
            delay = dt.timedelta(hours=1) if response.code == 429 and not human else dt.timedelta(days=7)
            checked = dt.datetime.now(dt.timezone.utc)
            with request_lock:
                if not stopped.is_set():
                    atomic(retry_path, {'checkedAt': checked.isoformat(), 'retryAt': (checked + delay).isoformat(), 'reason': f'HTTP {response.code}; human={human}'})
                stopped.set()
            raise RuntimeError('BATA access blocked; stopped without alternative routes')
        if response.code != 200 or len(body) > 3_000_000 or urllib.parse.urlparse(response.url).netloc != 'www.bata.com':
            raise RuntimeError('Invalid/truncated/redirected official response')
        page = Page(body.decode('utf-8'))
        page.resolved_url = response.url
        return page

    signal.signal(signal.SIGALRM, expire)
    signal.alarm(180)
    try:
        while state['next']:
            page = get(state['next'])
            if not page.items or page.total is None:
                raise RuntimeError('Missing source listing/count')
            if state['total'] is not None and state['total'] != page.total:
                raise RuntimeError('Source count changed during traversal')
            state['total'] = page.total
            known = {item['id'] for item in parts}
            urls = [item['id'] for item in page.items]
            if len(set(urls)) != len(urls) or known.intersection(urls):
                raise RuntimeError('Duplicate listing page/card')
            name = f'listing-{len(state["parts"]):03}.json'
            atomic(ROOT / name, page.items)
            state['parts'].append({'file': name, 'sha256': digest(page.items)})
            parts.extend(page.items)
            state['next'] = page.next
            atomic(path, state)
            print(f'listing {len(parts)}/{state["total"]}', flush=True)
        if len(parts) != state['total']:
            raise RuntimeError('Incomplete listing union')
        pending = []
        state['excluded'] = [item['id'] for item in parts if not footwear_scope(item)]
        for item in parts:
            key = item['id']
            if key in state['galleries'] or key in state['excluded']:
                continue
            if not footwear_scope(item):
                state['excluded'].append(key)
                atomic(path, state)
                continue
            pending.append(item)

        def fetch_product(item):
            if not item.get('tileurl'):
                raise RuntimeError('Missing own visible tile link')
            page = get(item['tileurl'])
            canonical = urllib.parse.urlparse(page.canonical or '')
            resolved = urllib.parse.urlparse(page.resolved_url)
            if (canonical.scheme, canonical.netloc, canonical.path) != (resolved.scheme, resolved.netloc, resolved.path) or len(page.schema) != 1:
                raise RuntimeError('Product canonical/schema identity mismatch')
            product = page.schema[0]
            if product.get('brand', {}).get('name', '').upper() != 'BATA' or not same_source_style(item['id'], product.get('mpn')):
                stopped.set()
                atomic(ROOT / ('identity-' + hashlib.sha256(item['id'].encode()).hexdigest()[:20] + '.json'), {'listing': item, 'product': product, 'canonical': page.canonical})
                raise RuntimeError('Product brand/identity mismatch')
            images = product.get('image')
            if not isinstance(images, list) or not images or any(not u.startswith('https://www.bata.com/dw/image/') for u in images):
                raise RuntimeError('Missing/unverified own gallery')
            return {'listing': item, 'product': product, 'url': page.resolved_url, 'canonical': page.canonical}

        with ThreadPoolExecutor(max_workers=2) as pool:
            for value in pool.map(fetch_product, pending):
                key = value['listing']['id']
                name = f'product-{hashlib.sha256(key.encode()).hexdigest()[:20]}.json'
                atomic(ROOT / name, value)
                state['galleries'][key] = {'file': name, 'sha256': digest(value)}
                atomic(path, state)
                print(f'galleries {len(state["galleries"])}/{state["total"] - len(state["excluded"])}', flush=True)
        final = get(URL)
        first = json.loads((ROOT / state['parts'][0]['file']).read_text())
        if final.total != state['total'] or final.items != first:
            raise RuntimeError('Final source epoch/count changed')
        if len(state['galleries']) + len(state['excluded']) != state['total']:
            raise RuntimeError('Source reconciliation incomplete')
        atomic(ROOT / 'catalog.json', {'status': 'SOURCE_VERIFIED', 'checkedAt': state['checkedAt'], 'sourceTotal': state['total'],
            'products': [json.loads((ROOT / entry['file']).read_text()) for entry in state['galleries'].values()],
            'excludedIds': state['excluded'], 'originalListings': parts})
        state['status'] = 'SOURCE_VERIFIED'
    except TimeoutError:
        state['status'] = 'PARTIAL'
    except Exception as error:
        state['status'] = 'PARTIAL'
        state['error'] = str(error)
        raise
    finally:
        signal.alarm(0)
        state['lastRunRequests'] = requests
        atomic(path, state)


if __name__ == '__main__':
    ROOT.parent.mkdir(parents=True, exist_ok=True)
    source_lock = open(ROOT.parent / 'bata-staging.lock', 'a')
    fcntl.flock(source_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    run_started = time.monotonic()
    previous = None
    for run in range(12 if '--complete' in sys.argv else 1):
        if time.monotonic() - run_started > 2160:
            break
        main()
        state = json.loads((ROOT / 'progress.json').read_text())
        print(f'chunk {run + 1}: {state["status"]}; galleries={len(state["galleries"])}', flush=True)
        if state['status'] == 'SOURCE_VERIFIED':
            break
        progress = (len(state['parts']), len(state['galleries']))
        if progress == previous:
            raise RuntimeError('No progress; stopped rather than retrying indefinitely')
        previous = progress
