import type { MarketResearchBrand, MarketResearchCountryCatalog } from "../types";
import { ROMANIA_SNAPSHOT_OBSERVED_AT, marelboProductImage, otterProductImage, snapshotPrice } from "./snapshotHelpers";

function brand(input: MarketResearchBrand): MarketResearchBrand {
  return input;
}

const IL_PASSO = brand({
  id: "mr-ro-il-passo",
  name: "IL PASSO",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "ilpasso.ro", url: "https://www.ilpasso.ro/all/femei/incaltaminte.html", kind: "brand" }],
  models: [
    {
      id: "il-passo-tess",
      name: "TESS",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "il-passo-tess-default",
          color: null,
          productUrl: "https://www.ilpasso.ro/all/femei.html",
          images: [],
          ...snapshotPrice(649, 649, "RON"),
        },
      ],
    },
    {
      id: "il-passo-tess-i",
      name: "TESS I",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "il-passo-tess-i-cognac",
          color: "Cognac",
          productUrl: "https://www.ilpasso.ro/pantofi-femei-cognac-tess-i.html",
          images: [],
          ...snapshotPrice(649, 649, "RON"),
        },
      ],
    },
    {
      id: "il-passo-carissa",
      name: "CARISSA",
      categoryId: "babet",
      categoryLabel: "Babet",
      variants: [
        {
          id: "il-passo-carissa-default",
          color: null,
          productUrl: "https://www.ilpasso.ro/all/femei/incaltaminte.html",
          images: [],
          ...snapshotPrice(329.4, 549, "RON"),
        },
      ],
    },
    {
      id: "il-passo-devorah",
      name: "DEVORAH",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "il-passo-devorah-default",
          color: null,
          productUrl: "https://www.ilpasso.ro/all/femei.html",
          images: [],
          ...snapshotPrice(549, 549, "RON"),
        },
      ],
    },
    {
      id: "il-passo-tijuana",
      name: "TIJUANA",
      categoryId: "bot-cizme",
      categoryLabel: "Bot",
      variants: [
        {
          id: "il-passo-tijuana-default",
          color: null,
          productUrl: "https://www.ilpasso.ro/all/femei.html",
          images: [],
          ...snapshotPrice(999, 999, "RON"),
        },
      ],
    },
    {
      id: "il-passo-tijuana-i",
      name: "TIJUANA I",
      categoryId: "bot-cizme",
      categoryLabel: "Bot",
      variants: [
        {
          id: "il-passo-tijuana-i-default",
          color: null,
          productUrl: "https://www.ilpasso.ro/all/outlet-sale.html",
          images: [],
          ...snapshotPrice(849, 849, "RON"),
        },
      ],
    },
  ],
});

const MUSETTE = brand({
  id: "mr-ro-musette",
  name: "Musette",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "musette.ro", url: "https://musette.ro/femei/incaltaminte.html", kind: "brand" }],
  models: [
    {
      id: "musette-ella-a126",
      name: "ELLA A126",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "musette-ella-a126-black",
          color: "Negru",
          productUrl: "https://musette.ro/ella-a126-f00030389.html",
          images: [],
          ...snapshotPrice(399.5, 799, "RON"),
        },
      ],
    },
    {
      id: "musette-ella-a253",
      name: "ELLA A253",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "musette-ella-a253-default",
          color: null,
          productUrl: "https://musette.ro/femei/incaltaminte/pantofi.html",
          images: [],
          ...snapshotPrice(559.3, 799, "RON"),
        },
      ],
    },
    {
      id: "musette-gloria",
      name: "GLORIA",
      categoryId: "mule",
      categoryLabel: "Mule",
      variants: [
        {
          id: "musette-gloria-beige",
          color: "Bej",
          productUrl: "https://musette.ro/gloria-23.html",
          images: [],
          ...snapshotPrice(519.2, 649, "RON"),
        },
      ],
    },
    {
      id: "musette-pansy-883",
      name: "PANSY 883",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "musette-pansy-883-rose",
          color: "Roze",
          productUrl: "https://musette.ro/pansy-883-71.html",
          images: [],
          ...snapshotPrice(649, 649, "RON"),
        },
      ],
    },
  ],
});

const EPICA = brand({
  id: "mr-ro-epica",
  name: "EPICA",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [
    { label: "Tezyo", url: "https://www.tezyo.ro/branduri/epica", kind: "retailer" },
    { label: "OTTER", url: "https://www.otter.ro/branduri/epica", kind: "retailer" },
  ],
  models: [
    {
      id: "epica-99570",
      name: "99570",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "epica-99570-brown",
          color: "Maro",
          productUrl: "https://www.tezyo.ro/branduri/epica",
          images: [],
          ...snapshotPrice(699, 699, "RON"),
        },
        {
          id: "epica-99570-black",
          color: "Negru",
          productUrl: "https://www.tezyo.ro/branduri/epica",
          images: [],
          ...snapshotPrice(699, 699, "RON"),
        },
      ],
    },
    {
      id: "epica-669b754",
      name: "669B754",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "epica-669b754-brown",
          color: "Maro",
          productUrl:
            "https://www.otter.ro/pantofi-eleganti-epica-maro-669b754-din-material-textil-si-piele-naturala",
          images: [
            otterProductImage("5498f1a7d8e72cfcb61725b5d5266d1bf21b09146d9668c6f2f0ce8c863642e8"),
            otterProductImage("88f5bf6b8bc897d41e4085ec9ed6905277cb124008aba77d810365132e6e919b"),
            otterProductImage("3f2efc6fcd2fd68c9e7ab307bd5649c2fa4ddced9fe0e7c55a19add820037b6a"),
          ],
          ...snapshotPrice(null, null, "RON"),
        },
      ],
    },
    {
      id: "epica-1766138",
      name: "1766138",
      categoryId: "sandal",
      categoryLabel: "Sandalet",
      variants: [
        {
          id: "epica-1766138-black",
          color: "Negru",
          productUrl: "https://www.tezyo.ro/sandale-epica-negre-1766138-din-piele-naturala",
          images: [],
          ...snapshotPrice(null, null, "RON"),
        },
      ],
    },
  ],
});

const MARELBO = brand({
  id: "mr-ro-marelbo",
  name: "Marelbo",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "marelbo.com", url: "https://marelbo.com/ro/103-incaltaminte-femei", kind: "brand" }],
  models: [
    {
      id: "marelbo-1374",
      name: "1374",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "marelbo-1374-black",
          color: "Negru",
          productUrl: "https://marelbo.com/ro/108-pantofi-eleganti-dama",
          images: [marelboProductImage(52352, "pantofi-eleganti-dama-1374-negru")],
          ...snapshotPrice(299, 299, "RON"),
        },
      ],
    },
    {
      id: "marelbo-6086",
      name: "6086",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "marelbo-6086-capucino",
          color: "Capucino",
          productUrl: "https://marelbo.com/ro/109-pantofi-casual-dama",
          images: [],
          ...snapshotPrice(269, 269, "RON"),
        },
        {
          id: "marelbo-6086-black",
          color: "Negru",
          productUrl: "https://marelbo.com/ro/109-pantofi-casual-dama",
          images: [],
          ...snapshotPrice(269, 269, "RON"),
        },
        {
          id: "marelbo-6086-cream",
          color: "Crem",
          productUrl: "https://marelbo.com/ro/109-pantofi-casual-dama",
          images: [],
          ...snapshotPrice(269, 269, "RON"),
        },
      ],
    },
    {
      id: "marelbo-6091",
      name: "6091",
      categoryId: "sneaker",
      categoryLabel: "Sneaker",
      variants: [
        {
          id: "marelbo-6091-beige",
          color: "Bej",
          productUrl: "https://marelbo.com/ro/110-pantofi-sport-dama",
          images: [],
          ...snapshotPrice(269, 269, "RON"),
        },
        {
          id: "marelbo-6091-brown",
          color: "Maro",
          productUrl: "https://marelbo.com/ro/110-pantofi-sport-dama",
          images: [],
          ...snapshotPrice(269, 269, "RON"),
        },
        {
          id: "marelbo-6091-white",
          color: "Alb",
          productUrl: "https://marelbo.com/ro/110-pantofi-sport-dama",
          images: [],
          ...snapshotPrice(269, 269, "RON"),
        },
      ],
    },
    {
      id: "marelbo-3420",
      name: "3420",
      categoryId: "bot-cizme",
      categoryLabel: "Çizme",
      variants: [
        {
          id: "marelbo-3420-chocolate",
          color: "Ciocolata",
          productUrl: "https://marelbo.com/ro/103-incaltaminte-femei",
          images: [marelboProductImage(48502, "cizme-dama-3420-ciocolata")],
          ...snapshotPrice(null, null, "RON"),
        },
      ],
    },
    {
      id: "marelbo-5125",
      name: "5125",
      categoryId: "sandal",
      categoryLabel: "Sandalet",
      variants: [
        {
          id: "marelbo-5125-white",
          color: "Alb",
          productUrl: "https://marelbo.com/ro/209-papuci-dama",
          images: [],
          ...snapshotPrice(199, 199, "RON"),
        },
        {
          id: "marelbo-5125-black",
          color: "Negru",
          productUrl: "https://marelbo.com/ro/209-papuci-dama",
          images: [],
          ...snapshotPrice(199, 199, "RON"),
        },
      ],
    },
  ],
});

const PAPUCEI = brand({
  id: "mr-ro-papucei",
  name: "Papucei",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "papucei.ro", url: "https://www.papucei.ro/en/products-category/footwear/", kind: "brand" }],
  models: [
    {
      id: "papucei-bela-niro",
      name: "Bela Niro",
      categoryId: "sandal",
      categoryLabel: "Sandalet",
      variants: [
        {
          id: "papucei-bela-niro-black-silver",
          color: "Black silver",
          productUrl: "https://www.papucei.ro/en/product/bela-niro/",
          images: [],
          ...snapshotPrice(89, 165, "EUR"),
        },
        {
          id: "papucei-bela-niro-black",
          color: "BLACK",
          productUrl: "https://www.papucei.ro/en/product/bela-niro/",
          images: [],
          ...snapshotPrice(89, 165, "EUR"),
        },
        {
          id: "papucei-bela-niro-red",
          color: "RED",
          productUrl: "https://www.papucei.ro/en/product/bela-niro/",
          images: [],
          ...snapshotPrice(89, 165, "EUR"),
        },
      ],
    },
    {
      id: "papucei-life-in-motion",
      name: "Life in Motion",
      categoryId: "babet",
      categoryLabel: "Babet",
      variants: [
        {
          id: "papucei-life-in-motion-default",
          color: null,
          productUrl: "https://www.papucei.ro/en/products-category/footwear/",
          images: [],
          ...snapshotPrice(207, 207, "EUR"),
        },
      ],
    },
    {
      id: "papucei-long-journey",
      name: "Long Journey",
      categoryId: "bot-cizme",
      categoryLabel: "Çizme",
      variants: [
        {
          id: "papucei-long-journey-default",
          color: null,
          productUrl: "https://www.papucei.ro/en/products-category/footwear/",
          images: [],
          ...snapshotPrice(249, 249, "EUR"),
        },
      ],
    },
  ],
});

const MIHAELA_GLAVAN = brand({
  id: "mr-ro-mihaela-glavan",
  name: "Mihaela Glavan",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "mihaelaglavan.ro", url: "https://mihaelaglavan.ro/", kind: "brand" }],
  models: [
    {
      id: "mg-cosmic-hugs-ballerinas",
      name: "Cosmic Hugs open-back ballerinas",
      categoryId: "babet",
      categoryLabel: "Babet",
      variants: [
        {
          id: "mg-cosmic-hugs-silver",
          color: "Silver",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(820, 820, "RON"),
        },
        {
          id: "mg-cosmic-hugs-black",
          color: "Black",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(820, 820, "RON"),
        },
      ],
    },
    {
      id: "mg-cosmic-hugs-pump",
      name: "Cosmic Hugs open-back pump",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "mg-cosmic-hugs-pump-gold",
          color: "Golden",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(890, 890, "RON"),
        },
      ],
    },
    {
      id: "mg-dandy-star",
      name: "Dandy Star",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "mg-dandy-star-multicolor",
          color: "Multicolor",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(860, 860, "RON"),
        },
      ],
    },
    {
      id: "mg-dandy-star-bw",
      name: "Dandy Star B&W",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "mg-dandy-star-bw-default",
          color: "B&W",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(860, 860, "RON"),
        },
      ],
    },
    {
      id: "mg-why-so-serious",
      name: "Why so Serious lace-up booties",
      categoryId: "bot-cizme",
      categoryLabel: "Bot",
      variants: [
        {
          id: "mg-why-so-serious-beige",
          color: "Beige suede",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(1200, 1200, "RON"),
        },
        {
          id: "mg-why-so-serious-light-beige",
          color: "Light beige nubuck",
          productUrl: "https://mihaelaglavan.ro/",
          images: [],
          ...snapshotPrice(1200, 1200, "RON"),
        },
      ],
    },
  ],
});

const GRYXX = brand({
  id: "mr-ro-gryxx",
  name: "GRYXX",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "gryxx.ro", url: "https://www.gryxx.ro/femei/incaltaminte/pantofi", kind: "brand" }],
  models: [
    {
      id: "gryxx-5g873",
      name: "5G873",
      categoryId: "sneaker",
      categoryLabel: "Sneaker",
      variants: [
        {
          id: "gryxx-5g873-white",
          color: "Alb",
          productUrl: "https://www.gryxx.ro/femei/incaltaminte/pantofi",
          images: [],
          ...snapshotPrice(299, 499, "RON"),
        },
        {
          id: "gryxx-5g873-silver",
          color: "Argintiu",
          productUrl: "https://www.gryxx.ro/femei/incaltaminte/pantofi",
          images: [],
          ...snapshotPrice(349, 499, "RON"),
        },
      ],
    },
    {
      id: "gryxx-r526d72",
      name: "R526D72",
      categoryId: "sneaker",
      categoryLabel: "Sneaker",
      variants: [
        {
          id: "gryxx-r526d72-orange",
          color: "Portocaliu",
          productUrl: "https://www.gryxx.ro/femei/incaltaminte/pantofi",
          images: [],
          ...snapshotPrice(220, 449, "RON"),
        },
        {
          id: "gryxx-r526d72-white",
          color: "Alb",
          productUrl: "https://www.gryxx.ro/femei/incaltaminte/pantofi",
          images: [],
          ...snapshotPrice(224, 449, "RON"),
        },
      ],
    },
    {
      id: "gryxx-022y708",
      name: "022Y708",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "gryxx-022y708-black",
          color: "Negru",
          productUrl: "https://www.gryxx.ro/pantofi-gryxx-negri-022y708-din-piele-naturala",
          images: [otterProductImage("4e3c4541fd5b7518f7451b9b6bccf60c69bc1aeaa570a90bf9a182fcfd4a0f5b")],
          ...snapshotPrice(null, 499, "RON"),
        },
      ],
    },
    {
      id: "gryxx-251yz73",
      name: "251YZ73",
      categoryId: "sneaker",
      categoryLabel: "Sneaker",
      variants: [
        {
          id: "gryxx-251yz73-black",
          color: "Negru",
          productUrl: "https://www.gryxx.ro/pantofi-sport-gryxx-negri-251yz73-din-piele-naturala",
          images: [
            otterProductImage("62aa39aa539924d7438168f83b2938d3662921839bfa8059f8e1d9308e650163"),
            otterProductImage("dbd456335afb9d54f1424acf99991f77fe270c183473ca3cb29133d39208eafa"),
            otterProductImage("288bebfe03af519a3f6a15ed45df940571ef272c14f57fe733adb0f22ec769b5"),
          ],
          ...snapshotPrice(null, null, "RON"),
        },
      ],
    },
  ],
});

const WOJAS = brand({
  id: "mr-ro-wojas",
  name: "Wojas",
  entityKind: "brand",
  originCountry: "PL",
  originCountryLabel: "Polonya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "wojas.ro", url: "https://wojas.ro/colectare-dama-botine", kind: "brand" }],
  models: [
    {
      id: "wojas-55316-62",
      name: "55316-62",
      categoryId: "bot-cizme",
      categoryLabel: "Bot",
      variants: [
        {
          id: "wojas-55316-62-default",
          color: null,
          productUrl: "https://wojas.ro/colectare-dama-botine",
          images: [],
          ...snapshotPrice(455.99, 759, "RON"),
        },
      ],
    },
    {
      id: "wojas-55340-51",
      name: "55340-51",
      categoryId: "bot-cizme",
      categoryLabel: "Bot",
      variants: [
        {
          id: "wojas-55340-51-default",
          color: null,
          productUrl: "https://wojas.ro/botine-dama-55060-51",
          images: [],
          ...snapshotPrice(324.99, 649, "RON"),
        },
      ],
    },
    {
      id: "wojas-55263-51",
      name: "55263-51",
      categoryId: "bot-cizme",
      categoryLabel: "Bot",
      variants: [
        {
          id: "wojas-55263-51-chelsea",
          color: "Negru",
          productUrl: "https://wojas.ro/botine-dama-55060-51",
          images: [],
          ...snapshotPrice(389.99, 649, "RON"),
        },
      ],
    },
  ],
});

const BADURA = brand({
  id: "mr-ro-badura",
  name: "Badura",
  entityKind: "brand",
  originCountry: "PL",
  originCountryLabel: "Polonya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "CCC România", url: "https://ccc.eu/ro/ro/c/incaltaminte-dama", kind: "marketplace" }],
  models: [
    {
      id: "badura-giselle",
      name: "Giselle",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "badura-giselle-default",
          color: null,
          productUrl: "https://ccc.eu/ro/ro/c/incaltaminte-dama",
          images: [],
          ...snapshotPrice(343.99, 343.99, "RON"),
        },
      ],
    },
  ],
});

const GINO_ROSSI = brand({
  id: "mr-ro-gino-rossi",
  name: "Gino Rossi",
  entityKind: "brand",
  originCountry: "PL",
  originCountryLabel: "Polonya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "CCC România", url: "https://ccc.eu/ro/ro/c/incaltaminte-dama", kind: "marketplace" }],
  models: [
    {
      id: "gino-rossi-simon-115856",
      name: "SIMON-115856",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "gino-rossi-simon-black",
          color: "Negru",
          productUrl: "https://ccc.eu/ro/ro/p/mocasini-gino-rossi-simon-115856-negru-5905588827740",
          images: [],
          ...snapshotPrice(139.99, 311.99, "RON"),
        },
        {
          id: "gino-rossi-simon-pink",
          color: "Roz deschis",
          productUrl: "https://ccc.eu/ro/ro/p/mocasini-gino-rossi-simon-115856--roz-deschis-5903698599670",
          images: [],
          ...snapshotPrice(343.99, 343.99, "RON"),
        },
      ],
    },
    {
      id: "gino-rossi-grace",
      name: "GRACE-I23-26372PE",
      categoryId: "loafer",
      categoryLabel: "Loafer",
      variants: [
        {
          id: "gino-rossi-grace-black",
          color: "Negru",
          productUrl: "https://ccc.eu/ro/ro/p/mocasini-gino-rossi-grace-i23-26372pe-negru-5905588844792",
          images: [],
          ...snapshotPrice(230.99, 230.99, "RON"),
        },
      ],
    },
    {
      id: "gino-rossi-frida",
      name: "FRIDA V1525-833-1",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "gino-rossi-frida-black",
          color: "Negru",
          productUrl: "https://ccc.eu/ro/ro/p/pantofi-cu-toc-gino-rossi-frida-v1525-833-1-negru-5903419850738",
          images: [],
          ...snapshotPrice(179.99, 359.99, "RON"),
        },
      ],
    },
  ],
});

const LASOCKI = brand({
  id: "mr-ro-lasocki",
  name: "Lasocki",
  entityKind: "brand",
  originCountry: "PL",
  originCountryLabel: "Polonya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "CCC România", url: "https://ccc.eu/ro/ro/c/incaltaminte-dama", kind: "marketplace" }],
  models: [],
});

const ALDO = brand({
  id: "mr-ro-aldo",
  name: "ALDO",
  entityKind: "brand",
  originCountry: "CA",
  originCountryLabel: "Kanada",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "aldoshoes.com.ro", url: "https://www.aldoshoes.com.ro/", kind: "brand" }],
  models: [
    {
      id: "aldo-stessylow-121",
      name: "STESSYLOW 121",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "aldo-stessylow-121-white",
          color: "Alb",
          productUrl: "https://www.aldoshoes.com.ro/pantofi-eleganti-aldo-albi-14344632-din-piele-naturala",
          images: [
            otterProductImage("6dde0b2f732acbffe0bac7ead0b3e01c7635d0619222c9a4cb82cc3f63bae489"),
            otterProductImage("cd5f4a9f7f28d8e5f418271b3ff20120e7b48b8200209ce99447fead8b2ff440"),
            otterProductImage("577da7263e8711a33ac57b1857d23db2fb279e4d8a0206b8042c922d8e154563"),
          ],
          ...snapshotPrice(299, 499, "RON"),
        },
      ],
    },
    {
      id: "aldo-delicat-413",
      name: "DELICAT 413",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "aldo-delicat-413-white",
          color: "Alb",
          productUrl: "https://www.aldoshoes.com.ro/pantofi-eleganti-aldo-albi-14344606-din-piele-ecologica",
          images: [],
          ...snapshotPrice(278, 449, "RON"),
        },
      ],
    },
    {
      id: "aldo-pearlescent-121",
      name: "PEARLESCENT 121",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "aldo-pearlescent-121-white",
          color: "Alb",
          productUrl: "https://www.aldoshoes.com.ro/pantofi-eleganti-aldo-albi-14296114-din-material-textil",
          images: [],
          ...snapshotPrice(299, 599, "RON"),
        },
      ],
    },
    {
      id: "aldo-stasya-690",
      name: "STASYA 690",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "aldo-stasya-690-pink",
          color: "Roz",
          productUrl: "https://www.aldoshoes.com.ro/pantofi-eleganti-aldo-roz-stasya-690-din-piele-ecologica-lacuita",
          images: [],
          ...snapshotPrice(231, 579, "RON"),
        },
      ],
    },
  ],
});

const BOTTA = brand({
  id: "mr-ro-botta",
  name: "Botta",
  entityKind: "brand",
  originCountry: "RO",
  originCountryLabel: "Romanya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "botta.ro", url: "https://botta.ro/", kind: "brand" }],
  models: [
    {
      id: "botta-nataly-c178",
      name: "Nataly c178",
      categoryId: "sandal",
      categoryLabel: "Sandalet",
      variants: [
        {
          id: "botta-nataly-c178-default",
          color: null,
          productUrl: "https://botta.ro/",
          images: [],
          ...snapshotPrice(379, 379, "RON"),
        },
      ],
    },
    {
      id: "botta-flora-c178",
      name: "Flora c178",
      categoryId: "sandal",
      categoryLabel: "Sandalet",
      variants: [
        {
          id: "botta-flora-c178-default",
          color: null,
          productUrl: "https://botta.ro/",
          images: [],
          ...snapshotPrice(399, 399, "RON"),
        },
      ],
    },
    {
      id: "botta-janette-c178",
      name: "Janette c178",
      categoryId: "sandal",
      categoryLabel: "Sandalet",
      variants: [
        {
          id: "botta-janette-c178-default",
          color: null,
          productUrl: "https://botta.ro/",
          images: [],
          ...snapshotPrice(379, 379, "RON"),
        },
      ],
    },
  ],
});

const FLAVIA_PASSINI = brand({
  id: "mr-ro-flavia-passini",
  name: "Flavia Passini",
  entityKind: "brand",
  originCountry: "IT",
  originCountryLabel: "İtalya",
  salesMarket: "RO",
  markets: ["RO"],
  soldInSalesMarket: true,
  availability: "visible",
  sourceLinks: [{ label: "OTTER", url: "https://www.otter.ro/branduri/flavia-passini", kind: "retailer" }],
  models: [
    {
      id: "flavia-pt1682",
      name: "PT1682",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "flavia-pt1682-nude",
          color: "Nude",
          productUrl: "https://www.otter.ro/pantofi-eleganti-flavia-passini-nude-pt1682-din-piele-naturala-lacuita",
          images: [
            otterProductImage("32076d2db27a126545af4e5a686abaa9c27c0221b22dd760c558d72d79cee1f2"),
            otterProductImage("fcfd3683a6047f9bf0b03ea526bc1f85b0574b57fd17749bc8b2592d5f7f3cda"),
          ],
          ...snapshotPrice(null, null, "RON"),
        },
      ],
    },
    {
      id: "flavia-jh09",
      name: "JH09",
      categoryId: "topuklu",
      categoryLabel: "Topuklu",
      variants: [
        {
          id: "flavia-jh09-black",
          color: "Negru",
          productUrl: "https://www.otter.ro/pantofi-eleganti-flavia-passini-negri-jh09-din-piele-naturala-lacuita",
          images: [],
          ...snapshotPrice(null, null, "RON"),
        },
      ],
    },
  ],
});

export const ROMANIA_MARKET_RESEARCH_CATALOG: MarketResearchCountryCatalog = {
  version: 1,
  kind: "market-research-snapshot",
  salesMarket: "RO",
  salesMarketLabel: "Romanya",
  observedAt: ROMANIA_SNAPSHOT_OBSERVED_AT,
  snapshotNote:
    "İlk production preview için güvenli seed/snapshot. Canlı collect bu dosyanın üstüne yazılmaz. observedAt tüm fiyat gözlemleri için sabittir.",
  brands: [
    IL_PASSO,
    MUSETTE,
    EPICA,
    MARELBO,
    PAPUCEI,
    MIHAELA_GLAVAN,
    GRYXX,
    WOJAS,
    BADURA,
    GINO_ROSSI,
    LASOCKI,
    ALDO,
    BOTTA,
    FLAVIA_PASSINI,
  ],
  retailers: [
    {
      id: "otter",
      name: "OTTER",
      entityKind: "retailer",
      showAsBrandCard: false,
      role: "evidence_source",
      url: "https://www.otter.ro/",
    },
    {
      id: "tezyo",
      name: "Tezyo",
      entityKind: "retailer",
      showAsBrandCard: false,
      role: "evidence_source",
      url: "https://www.tezyo.ro/",
    },
    {
      id: "ccc-romania",
      name: "CCC România",
      entityKind: "marketplace",
      showAsBrandCard: false,
      role: "evidence_source",
      url: "https://ccc.eu/ro/",
    },
  ],
  excluded: [
    { id: "anna-cori", name: "Anna Cori", reason: "Erişilebilir veri yok — kart gizlendi" },
    { id: "otter", name: "OTTER", reason: "Retailer/source; marka kartı değil" },
    { id: "benvenuti", name: "Benvenuti", reason: "İlk kapsamda marka kartı değil" },
    { id: "enzo-bertini", name: "Enzo Bertini", reason: "İlk kapsamda marka kartı değil" },
    { id: "exe", name: "EXÉ", reason: "Portekiz markası; Yunan olarak sınıflandırılır" },
    { id: "tsakiris-mallas", name: "Tsakiris Mallas", reason: "Yunan markası; Romanya görünümüne eklenmez" },
    { id: "sante", name: "SANTE", reason: "Yunan markası; Romanya görünümüne eklenmez" },
  ],
};

