import { fetchText } from "../src/collector/http";

const TARGETS: Array<{ id: string; url: string; headers?: Record<string, string> }> = [
  { id: "zara-us-shoes-html", url: "https://www.zara.com/us/en/woman-shoes-l1251.html" },
  {
    id: "zara-us-shoes-ajax",
    url: "https://www.zara.com/us/en/woman-shoes-l1251.html?ajax=true",
    headers: {
      Accept: "application/json",
      Referer: "https://www.zara.com/us/en/",
      "X-Requested-With": "XMLHttpRequest",
    },
  },
  {
    id: "zara-itxrest-category",
    url: "https://www.zara.com/itxrest/2/catalog/store/11764/category/1251/product?locale=en_US&ajax=true",
    headers: {
      Accept: "application/json",
      Referer: "https://www.zara.com/us/en/",
    },
  },
  {
    id: "zara-categories-ajax",
    url: "https://www.zara.com/us/en/categories?ajax=true",
    headers: {
      Accept: "application/json",
      Referer: "https://www.zara.com/us/en/",
    },
  },
  { id: "fp-shoes", url: "https://www.freepeople.com/shoes/" },
  { id: "fp-womens-shoes", url: "https://www.freepeople.com/womens-shoes/" },
  { id: "fp-format-json", url: "https://www.freepeople.com/shoes/?format=json" },
  { id: "fp-products-json", url: "https://www.freepeople.com/products.json?limit=5" },
  { id: "fp-collections-json", url: "https://www.freepeople.com/collections.json?limit=5" },
  {
    id: "fp-update-grid",
    url: "https://www.freepeople.com/on/demandware.store/Sites-FreePeople-Site/default/Search-UpdateGrid?cgid=shoes&start=0&sz=24",
  },
  { id: "fp-api-catalog", url: "https://www.freepeople.com/api/catalog/v1/?offset=0&count=24" },
  { id: "farfetch-shoes", url: "https://www.farfetch.com/shopping/women/shoes-1/items.aspx" },
  { id: "farfetch-uk", url: "https://www.farfetch.com/uk/shopping/women/shoes-1/items.aspx" },
  { id: "farfetch-sitemap", url: "https://www.farfetch.com/sitemap.xml" },
];

function sniff(text: string): string {
  const trimmed = text.replace(/\s+/g, " ").slice(0, 180);
  const json = text.trim().startsWith("{") || text.trim().startsWith("[");
  const captcha = /captcha|cloudflare|datadome|challenge|access denied|pardon our interruption/i.test(
    text,
  );
  return `${json ? "json-like" : "html"} captcha=${captcha} body="${trimmed}"`;
}

for (const target of TARGETS) {
  const result = await fetchText(target.url, { delayMs: 700, headers: target.headers });
  console.log(
    `${target.id}\tHTTP ${result.status}\tok=${result.ok}\tlen=${result.text.length}\t${sniff(result.text)}`,
  );
}
