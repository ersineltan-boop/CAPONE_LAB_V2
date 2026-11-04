"""Bounded official women's catalogue staging; never writes the live dataset."""
import datetime as dt
import fcntl
import hashlib
import json
import os
import re
import signal
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path('data/brands/bobbies-staging')
URL = 'https://www.bobbies.com/en/30011797-view-all'

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()

def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    os.replace(tmp, path)

def retry_delay(status, human=False):
    if human or status in [401, 403]:
        return dt.timedelta(days=7)
    if status == 429:
        return dt.timedelta(hours=1)
    return None

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.cards, self.pages, self.products = [], set(), []
        self.current, self.canonical, self.script, self.copy = None, None, False, ''
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'article' and 'product-miniature' in a.get('class', '').split():
            self.current = {'id': a.get('data-id-product'), 'attributeId': a.get('data-id-product-attribute')}
            self.cards.append(self.current)
        if tag == 'a':
            href = a.get('href', '')
            if self.current is not None and re.fullmatch(r'https://www.bobbies.com/en/[0-9]+-[^/]+\.html', href):
                if 'url' in self.current and self.current['url'] != href:
                    raise ValueError('Ambiguous own product card')
                self.current['url'] = href
            if href.startswith(URL + '?page='):
                number = href.removeprefix(URL + '?page=')
                if not number.isdigit() or not 1 <= int(number) <= 100:
                    raise ValueError('Unexpected pagination')
                self.pages.add(int(number))
        if tag == 'link' and a.get('rel') == 'canonical':
            self.canonical = a.get('href')
        if tag == 'script' and a.get('type') == 'application/ld+json':
            self.script, self.copy = True, ''
    def handle_data(self, data):
        if self.script:
            self.copy += data
    def handle_endtag(self, tag):
        if tag == 'article':
            self.current = None
        if tag == 'script' and self.script:
            self.script = False
            value = json.loads(self.copy)
            if isinstance(value, dict) and value.get('@type') == 'Product':
                self.products.append(value)

def detail(card, page):
    if len(page.products) != 1 or page.canonical != card['url']:
        raise ValueError('Own PDP identity/canonical mismatch')
    product = page.products[0]
    offer = product.get('offers', {})
    if product.get('brand', {}).get('name', '').lower() != 'bobbies' or offer.get('url') != card['url'] or not card['url'].split('/')[-1].startswith(card['id'] + '-'):
        raise ValueError('Own brand/offer identity mismatch')
    images = offer.get('image')
    if not isinstance(images, list) or not images or any(not isinstance(u, str) or not u.startswith('https://images.bobbies.com/') for u in images):
        raise ValueError('Own full gallery missing')
    if not product.get('sku') or product.get('sku') != offer.get('sku'):
        raise ValueError('Own SKU mismatch')
    return {'listing': card, 'product': product, 'url': card['url'], 'canonical': page.canonical, 'images': images}

def main():
    now = dt.datetime.now(dt.timezone.utc)
    retry = ROOT / 'retry.json'
    if retry.exists() and dt.datetime.fromisoformat(json.loads(retry.read_text())['retryAt']) > now:
        raise RuntimeError('Shared source retry window active')
    path = ROOT / 'progress.json'
    state = json.loads(path.read_text()) if path.exists() else {'checkedAt': now.isoformat(), 'status': 'PARTIAL', 'parts': [], 'products': {}, 'lastPage': None}
    if state['status'] == 'SOURCE_VERIFIED' or now - dt.datetime.fromisoformat(state['checkedAt']) > dt.timedelta(hours=24):
        raise RuntimeError('Completed/stale epoch: explicitly archive before a new collection')
    cards = []
    for part in state['parts']:
        values = json.loads((ROOT / part['file']).read_text())
        if digest(values) != part['sha256']:
            raise RuntimeError('Listing checksum mismatch')
        cards.extend(values)
    for value in state['products'].values():
        if digest(json.loads((ROOT / value['file']).read_text())) != value['sha256']:
            raise RuntimeError('Gallery checksum mismatch')
    requests, started = 0, time.monotonic()
    def expire(*_):
        raise TimeoutError('Absolute chunk deadline')
    def get(url, retries=1):
        nonlocal requests
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'https' or parsed.netloc != 'www.bobbies.com' or not parsed.path.startswith('/en/'):
            raise ValueError('Out-of-scope URL')
        if requests >= 80 or time.monotonic() - started > 175:
            raise TimeoutError('Chunk request/time budget reached')
        requests += 1
        time.sleep(.5)
        try:
            response = urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'CAPONE-LAB-source-check/1.0'}), timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        except urllib.error.URLError as error:
            if retries and isinstance(error.reason, (TimeoutError, OSError)):
                return get(url, retries - 1)
            raise
        with response:
            body = response.read(3000001)
            human = bool(re.search(b'verify (?:that )?you are human|checking your browser|captcha-delivery.com|just a moment', body, re.I))
            if response.code in [401, 403, 429] or human:
                checked = dt.datetime.now(dt.timezone.utc)
                delay = retry_delay(response.code, human)
                atomic(retry, {'checkedAt': checked.isoformat(), 'retryAt': (checked + delay).isoformat(), 'reason': f'HTTP {response.code}; human={human}'})
                raise RuntimeError('Access block; source stopped without alternatives')
            if response.code != 200 or response.url != url or len(body) > 3000000:
                raise ValueError('Invalid/truncated/redirected source response')
            return Page(body.decode('utf-8'))
    signal.signal(signal.SIGALRM, expire)
    signal.alarm(180)
    try:
        while state['lastPage'] is None or len(state['parts']) < state['lastPage']:
            number = len(state['parts']) + 1
            page = get(URL if number == 1 else URL + '?page=' + str(number))
            last = max(page.pages | {number})
            if state['lastPage'] is None:
                state['lastPage'] = last
            if last != state['lastPage'] or not page.cards or len(page.cards) > 20 or number < last and len(page.cards) != 20:
                raise ValueError('Source pagination/count changed or incomplete')
            known = {c['id'] for c in cards}
            ids = [c['id'] for c in page.cards]
            if len(set(ids)) != len(ids) or known.intersection(ids) or any(not c.get('url') or not c.get('id') for c in page.cards):
                raise ValueError('Duplicate/missing own card identity')
            name = f'listing-{number:03}.json'
            atomic(ROOT / name, page.cards)
            state['parts'].append({'file': name, 'sha256': digest(page.cards)})
            cards.extend(page.cards)
            atomic(path, state)
            print(f'listing pages {number}/{last}; identities={len(cards)}', flush=True)
        for card in cards:
            if card['id'] in state['products']:
                continue
            value = detail(card, get(card['url']))
            name = 'product-' + card['id'] + '.json'
            atomic(ROOT / name, value)
            state['products'][card['id']] = {'file': name, 'sha256': digest(value)}
            atomic(path, state)
            print(f'galleries {len(state["products"])}/{len(cards)}', flush=True)
        replay = get(URL)
        if replay.cards != json.loads((ROOT / state['parts'][0]['file']).read_text()) or max(replay.pages | {1}) != state['lastPage']:
            raise ValueError('First-page epoch replay changed')
        atomic(ROOT / 'catalog.json', {'status': 'SOURCE_VERIFIED', 'checkedAt': state['checkedAt'], 'sourceTotal': len(cards), 'countEvidence': 'exhausted own pagination plus unique-card union, not an explicit source total', 'products': [json.loads((ROOT / v['file']).read_text()) for v in state['products'].values()]})
        state['status'] = 'SOURCE_VERIFIED'
    except TimeoutError:
        state['status'] = 'PARTIAL'
    except Exception as error:
        state['error'] = str(error)
        raise
    finally:
        signal.alarm(0)
        state['lastRunRequests'] = requests
        atomic(path, state)

if __name__ == '__main__':
    ROOT.mkdir(parents=True, exist_ok=True)
    lock = open(ROOT.parent / 'bobbies-staging.lock', 'a')
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    started = time.monotonic()
    previous = None
    for _ in range(10 if '--complete' in sys.argv else 1):
        main()
        state = json.loads((ROOT / 'progress.json').read_text())
        if state['status'] == 'SOURCE_VERIFIED' or time.monotonic() - started > 1320:
            break
        current = (len(state['parts']), len(state['products']))
        if current == previous:
            raise RuntimeError('No progress: stop this work block')
        previous = current
