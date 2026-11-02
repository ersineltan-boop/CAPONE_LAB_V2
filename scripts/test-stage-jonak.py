import json
import runpy
import unittest

Listing = runpy.run_path('scripts/stage-jonak.py')['Listing']


def fixture(images=True, metadata=True, total=True):
    data = {'42': {'name': 'Official name', 'category': 'Woman shoes/Ballet flats'}} if metadata else {}
    return ('<script>var data_layer_products = ' + json.dumps(data) + ';</script>' +
            ('<input id="totalElems" value="1">' if total else '') + '<input id="nb_prod" value="48">' +
            '<div data-prod="42"><div><a class="linkImgWrapper" href="/p/official-42.html">' +
            ('<img class="imgProd" data-src="/phototheque/42B.jpg"><img class="imgProd" src="/phototheque/42A.jpg">' if images else '') +
            '</a></div></div>')


class Tests(unittest.TestCase):
    def test_preserves_source_identity_gallery_order_and_metadata(self):
        result = Listing(fixture())
        self.assertEqual(result.total, 1)
        card = result.cards[0]
        self.assertEqual(card['id'], '42')
        self.assertEqual(card['url'], 'https://www.jonak-paris.com/p/official-42.html')
        self.assertEqual([x.rsplit('/', 1)[1] for x in card['images']], ['42B.jpg', '42A.jpg'])
        self.assertEqual(card['sourceMetadata']['name'], 'Official name')
        self.assertNotIn('isNew', card)

    def test_rejects_missing_gallery_metadata_or_count(self):
        for options in [{'images': False}, {'metadata': False}, {'total': False}]:
            with self.subTest(options=options), self.assertRaises(ValueError):
                Listing(fixture(**options))


if __name__ == '__main__':
    unittest.main()
