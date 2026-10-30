"""Bounded official listing staging; never publishes or activates a brand."""
import datetime as dt
import hashlib
import json
import math
import os
import re
import signal
import time
import urllib.error
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ORIGIN = 'https://www.jonak-paris.com'
URL = ORIGIN + '/collection/woman-shoes.html'
ROOT = Path('data/brands/jonak-staging')


def atomic(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + '.tmp')
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    os.replace(temporary, path)


class Listing(HTMLParser):
    def __init__(self, html):
        super().__init__()
        match = re.search(r'var data_layer_products\s*=\s*', html)
        if not match:
            raise ValueError('Missing official product metadata')
        self.metadata, _ = json.JSONDecoder().raw_decode(html[match.end():])
        self.total = None
        self.size = None
        self.cards = []
        self.current = None
        self.depth = 0
        self.feed(html)
        if self.total is None or not self.size:
            raise ValueError('Missing source count/pagination')
        if len(self.cards) != len(self.metadata):
            raise ValueError('Card/metadata count mismatch')

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'input' and a.get('id') in ['totalElems', 'nb_prod']:
            value = int(a['value'])
            if a['id'] == 'totalElems':
                self.total = value
            else:
                self.size = value
        if tag == 'div' and a.get('data-prod') and self.current is None:
            self.current = {'id': a['data-prod'], 'images': [], 'url': None}
            self.depth = 0
        if self.current is None:
            return
        if tag == 'div':
            self.depth += 1
        if tag == 'a' and 'linkImgWrapper' in a.get('class', ''):
            href = a.get('href', '')
            if not href.startswith('/p/'):
                raise ValueError('Unexpected product URL')
            self.current['url'] = ORIGIN + href
        if tag == 'img' and 'imgProd' in a.get('class', ''):
            image = a.get('data-src') or a.get('src')
            if image and image.startswith('/phototheque/'):
                image = ORIGIN + image
                if image not in self.current['images']:
                    self.current['images'].append(image)

    def handle_endtag(self, tag):
        if tag != 'div' or self.current is None:
            return
        self.depth -= 1
        if self.depth == 0:
            card = self.current
            metadata = self.metadata.get(card['id'])
            if not metadata or not card['url'] or not card['images']:
                raise ValueError('Incomplete product card/gallery')
            card['sourceMetadata'] = metadata
            self.cards.append(card)
            self.current = None


def main():
    ROOT.mkdir(parents=True, exist_ok=True)
    retry_path = ROOT / 'retry.json'
    if retry_path.exists():
        retry = json.loads(retry_path.read_text())
        if dt.datetime.fromisoformat(retry['retryAt']) > dt.datetime.now(dt.timezone.utc):
            raise RuntimeError('Source retry window still active')
    started = time.monotonic()
    checked = dt.datetime.now(dt.timezone.utc).isoformat()
    requests = 0
    parts = []

    def get(url):
        nonlocal requests
        if requests >= 20 or time.monotonic() - started >= 180:
            raise RuntimeError('Bounded request/time budget exhausted')
        requests += 1
        time.sleep(1)
        request = urllib.request.Request(url, headers={'User-Agent': 'CAPONE-LAB-source-check/1.0'})
        try:
            response = urllib.request.urlopen(request, timeout=min(45, max(1, 180 - (time.monotonic() - started))))
        except urllib.error.HTTPError as error:
            response = error
        raw = response.read(24_000_001)
        human = bool(re.search(b'verify (?:that )?you are human|checking your browser|captcha-delivery.com|just a moment', raw, re.I))
        if response.code in [401, 403, 429] or human:
            now = dt.datetime.now(dt.timezone.utc)
            delay = dt.timedelta(hours=1) if response.code == 429 and not human else dt.timedelta(days=7)
            atomic(retry_path, {'checkedAt': now.isoformat(), 'retryAt': (now + delay).isoformat(), 'reason': f'HTTP {response.code}; humanVerification={human}'})
            raise RuntimeError('Source access blocked; stopped')
        if response.code != 200 or len(raw) > 24_000_000:
            raise RuntimeError(f'Invalid/truncated listing response: HTTP {response.code}; bytes={len(raw)}')
        return raw

    all_cards = []
    def expire(_signum, _frame):
        raise TimeoutError('Absolute 180-second staging deadline reached')

    signal.signal(signal.SIGALRM, expire)
    signal.alarm(180)
    try:
        first = Listing(get(URL).decode('utf-8'))
        if not 0 < first.total <= 48 * 18 or first.size != 48:
            raise ValueError('Unexpected source total/page size')
        pages = math.ceil(first.total / first.size)
        for number in sorted({1, pages}):
            listing = first if number == 1 else Listing(get(URL + f'?page={number}').decode('utf-8'))
            if listing.total != first.total or listing.size != first.size:
                raise ValueError('Source totals changed')
            expected = min(number * first.size, first.total)
            if len(listing.cards) != expected:
                raise ValueError('Incomplete source page')
            encoded = json.dumps(listing.cards, ensure_ascii=False, sort_keys=True).encode()
            checksum = hashlib.sha256(encoded).hexdigest()
            part = ROOT / f'page-{number:03}.json'
            atomic(part, listing.cards)
            parts.append({'path': part.name, 'sha256CanonicalJson': checksum, 'count': len(listing.cards)})
            if number > 1 and listing.cards[:len(first.cards)] != first.cards:
                raise ValueError('Cumulative listing prefix changed')
            all_cards = listing.cards
            atomic(ROOT / 'progress.json', {'status': 'PARTIAL', 'checkedAt': checked, 'requests': requests, 'parts': parts})
            print(f'page {number}/{pages}: {len(all_cards)}/{first.total}', flush=True)
        final = Listing(get(URL).decode('utf-8'))
        if final.total != first.total or final.cards != first.cards:
            raise ValueError('Source changed during traversal')
        if len({card['id'] for card in all_cards}) != first.total or len({card['url'] for card in all_cards}) != first.total:
            raise ValueError('Duplicate/incomplete source union')
        atomic(ROOT / 'catalog.json', {'brand': 'JONAK', 'scopeUrl': URL, 'sourceTotal': first.total, 'checkedAt': checked, 'status': 'LISTING_VERIFIED', 'products': all_cards, 'note': 'Staging only. No NEW inference, no brand activation, no live publication.'})
        atomic(ROOT / 'progress.json', {'status': 'LISTING_VERIFIED', 'checkedAt': checked, 'sourceTotal': first.total, 'requests': requests, 'parts': parts, 'published': False})
    except Exception as error:
        atomic(ROOT / 'progress.json', {'status': 'PARTIAL', 'checkedAt': checked, 'requests': requests, 'parts': parts, 'error': str(error), 'published': False})
        raise
    finally:
        signal.alarm(0)


if __name__ == '__main__':
    main()
