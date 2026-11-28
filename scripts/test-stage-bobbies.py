import copy
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
spec = importlib.util.spec_from_file_location('bobbies', Path(__file__).with_name('stage-bobbies.py'))
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)
fixture = json.loads(Path(__file__).with_name('fixtures').joinpath('bobbies-product.json').read_text())

def page(product=None, canonical=None):
    p = b.Page('')
    p.canonical = canonical or fixture['canonical']
    p.products = [copy.deepcopy(product or fixture['product'])]
    return p

class BobbiesStaging(unittest.TestCase):
    def test_full_own_gallery_not_single_schema_thumbnail(self):
        value = b.detail(fixture['listing'], page())
        self.assertEqual(value['images'], fixture['product']['offers']['image'])
        self.assertEqual(len(value['images']), 10)
        self.assertNotIn(fixture['product']['image'], value['images'])
    def test_rejects_cross_product_or_brand(self):
        for field in ['brand', 'url', 'sku']:
            p = page()
            if field == 'brand': p.products[0]['brand']['name'] = 'OTHER'
            else: p.products[0]['offers'][field] = 'wrong'
            with self.assertRaises(ValueError): b.detail(fixture['listing'], p)
        with self.assertRaises(ValueError): b.detail(fixture['listing'], page(canonical='https://www.bobbies.com/en/other.html'))
    def test_never_substitutes_or_invents_gallery(self):
        for images in [[], None, ['https://example.com/similar.jpg']]:
            p = page(); p.products[0]['offers']['image'] = images
            with self.assertRaises(ValueError): b.detail(fixture['listing'], p)
    def test_only_real_article_cards_and_bounded_source_pagination(self):
        p = b.Page('<a href="https://www.bobbies.com/en/1-other.html">recommendation</a><article class="product-miniature" data-id-product="4000785429"><a href="'+fixture['url']+'">own</a></article><a href="'+b.URL+'?page=22">22</a>')
        self.assertEqual(len(p.cards), 1)
        self.assertEqual(p.cards[0]['url'], fixture['url'])
        self.assertEqual(p.pages, {22})
        with self.assertRaises(ValueError): b.Page('<a href="'+b.URL+'?page=1000">next</a>')
    def test_shared_access_minimum_retry_windows(self):
        for status in [401, 403]: self.assertEqual(b.retry_delay(status).total_seconds(), 7 * 86400)
        self.assertEqual(b.retry_delay(429).total_seconds(), 3600)
        self.assertEqual(b.retry_delay(200, True).total_seconds(), 7 * 86400)
        self.assertEqual(b.retry_delay(429, True).total_seconds(), 7 * 86400)
        self.assertIsNone(b.retry_delay(500))
    def test_atomic_checkpoint_checksum_roundtrip(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / 'progress.json'
            b.atomic(path, fixture)
            self.assertEqual(b.digest(json.loads(path.read_text())), b.digest(fixture))
            changed = copy.deepcopy(fixture); changed['images'].pop()
            self.assertNotEqual(b.digest(changed), b.digest(fixture))
            self.assertFalse(path.with_suffix('.json.tmp').exists())

if __name__ == '__main__': unittest.main()
