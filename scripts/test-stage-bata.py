import json
import runpy
import unittest

module = runpy.run_path('scripts/stage-bata.py')
Page = module['Page']


class BataPageTests(unittest.TestCase):
    def test_scope_uses_own_women_evidence_without_collecting_men_clothing_or_other_brands(self):
        scope = module['footwear_scope']
        base = {'brand': 'BATA', 'category1': 'Woman', 'category2': 'Shoes', 'gender-name': 'Others', 'name': 'Classic Sneakers'}
        self.assertTrue(scope(base))
        self.assertFalse(scope({**base, 'gender-name': 'Men'}))
        self.assertFalse(scope({**base, 'brand': 'OTHER'}))
        self.assertFalse(scope({**base, 'category2': 'Clothing', 'gender-name': 'Ladies'}))
        self.assertTrue(scope({'brand': 'BATA', 'gender-name': 'Ladies', 'name': "BATA Women's Sneakers with Platform and Zip"}))
    def test_accepts_only_exact_style_or_observed_two_digit_variant_qualification(self):
        same = module['same_source_style']
        self.assertTrue(same('170R_2021_5946405', '170R_2021_5946405_04'))
        self.assertTrue(same('170R_2021_5946405', '170R_2021_5946405'))
        self.assertFalse(same('170R_2021_5946405', '170R_2021_5943405_04'))
        self.assertFalse(same('170R_2021_5946405', '170R_2021_5946405_unknown'))
    def test_keeps_exact_official_pagination_and_identity(self):
        page = Page('<div data-total-products="49"></div><div data-testid="plp-product-tile"><div class="analytics-product" data-id="style" data-dimension1="color" data-brand="BATA" data-producturl="https://www.bata.com/pt/a.html"></div></div><button data-testid="plp-load-more" data-url="https://www.bata.com/grid?start=24&amp;sz=24"></button>')
        self.assertEqual(page.total, 49)
        self.assertEqual(page.items[0]['dimension1'], 'color')
        self.assertEqual(page.next, 'https://www.bata.com/grid?start=24&sz=24')

    def test_preserves_only_own_schema_gallery_and_canonical(self):
        data = {'@type': 'Product', 'brand': {'name': 'BATA'}, 'mpn': 'style', 'image': ['https://www.bata.com/dw/image/one.jpg', 'https://www.bata.com/dw/image/two.jpg']}
        page = Page('<link rel="canonical" href="https://www.bata.com/pt/a.html"><script type="application/ld+json">' + json.dumps(data) + '</script>')
        self.assertEqual(page.canonical, 'https://www.bata.com/pt/a.html')
        self.assertEqual(page.schema, [data])
        self.assertNotIn('isNew', page.schema[0])

    def test_checksum_detects_modified_gallery_order(self):
        self.assertNotEqual(module['digest'](['one', 'two']), module['digest'](['two', 'one']))

    def test_ignores_carousels_and_preserves_visible_colorway_links(self):
        tile = lambda identity: ('<div data-testid="plp-product-tile"><a data-testid="plp-product-link" href="/pt/' + identity + '.html"></a><div class="analytics-product" data-id="' + identity + '" data-producturl="https://www.bata.com/pt/shared-parent.html"></div></div>')
        page = Page('<div class="analytics-product" data-id="recommendation" data-producturl="https://www.bata.com/pt/other.html"></div>' + tile('black') + tile('brown'))
        self.assertEqual([p['id'] for p in page.items], ['black', 'brown'])
        self.assertEqual([p['tileurl'] for p in page.items], ['https://www.bata.com/pt/black.html', 'https://www.bata.com/pt/brown.html'])


if __name__ == '__main__':
    unittest.main()
