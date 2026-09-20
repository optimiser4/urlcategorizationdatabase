# urlcategorizationdatabase

A zero-dependency Node.js client for the [URL Categorization Database](https://www.urlcategorizationdatabase.com) API. One call classifies any domain or URL into IAB content taxonomy categories from a database of 120 million+ categorized domains, with tier 1 (29 top-level categories) and tier 2 (441 subcategories) classification, language detection and buyer personas in a single response.

The URL categorization database was built by fetching, extracting and classifying the text of every domain in the corpus. Non-English sites were translated to English before classification (NMT models with BLEU scores above 40 for each language pair), so the categories are consistent across languages.

---

## Installation

```bash
npm install urlcategorizationdatabase
```

No runtime dependencies. Node.js 14 and newer are supported, and TypeScript definitions ship with the package.

## Quick start

```js
const UrlCategorizationClient = require('urlcategorizationdatabase');

const client = new UrlCategorizationClient('YOUR_API_KEY');

(async () => {
  const c = await client.classify('bbc.com');
  console.log(c.primaryCategory);      // 'News and Politics'
  console.log(c.categoryNames);        // [ 'News and Politics', 'Television', 'Events and Attractions', ... ]
  console.log(c.language);             // 'en'
  console.log(c.remainingCredits);     // 1499998

  // tier 2 subcategories
  const v2 = await client.classifyV2('bbc.com');
  console.log(v2.categoryNames);       // [ 'Comedy TV', 'World Movies', 'Drama TV', ... ]

  if (await client.isInCategory('espn.com', ['Sports'])) {
    // matched
  }
})();
```

With ES modules or TypeScript:

```ts
import UrlCategorizationClient, { Classification } from 'urlcategorizationdatabase';

const client = new UrlCategorizationClient(process.env.UCD_API_KEY!);
const c: Classification = await client.classify('https://www.zdf.de');
console.log(c.primaryCategory);   // 'Television'
console.log(c.language);          // 'de'
```

## What a classification contains

| Field | Type | Meaning |
|---|---|---|
| `categories` | `{category, confidence}[]` | IAB tier 1 content categories, highest confidence first |
| `categoriesV2` | `{category, confidence}[]` | IAB tier 2 subcategories (441 categories) |
| `filtering` | `{category, confidence}[]` | 59-category web filtering taxonomy (same as the web filtering database) |
| `buyer_personas` | `string[]` | audience personas inferred for the site |
| `language` | string | primary language of the site, ISO code |
| `remaining_credits` | number | credits left on the plan after this call |
| `total_credits` | number | credits on the plan |

## Methods

| Method | Credits | Returns |
|---|---|---|
| `classify(domainOrUrl)` | 1 | `Classification` with tier 1 categories |
| `classifyV2(domainOrUrl)` | 1 | `Classification` with tier 2 subcategories |
| `category(domainOrUrl)` | 1 | the best IAB category as a string, or `null` |
| `isInCategory(domainOrUrl, names)` | 1 | `boolean`, true when any category matches |
| `classifyMany(domains, {concurrency, pauseMs})` | 1 per unique domain | array in input order |

## Errors

| Status | Error class | When |
|---|---|---|
| 401, 403 | `AuthenticationError` | invalid or missing key |
| 429 | `RateLimitError` | too many requests for the plan |
| 500 | `ClassificationError` | site could not be loaded or classified |
| other | `CategorizationError` | network failure after retries |

## Worked examples

### 1. Contextual ad targeting

Classify publisher domains to match advertiser verticals without cookies.

```js
const UrlCategorizationClient = require('urlcategorizationdatabase');
const client = new UrlCategorizationClient(process.env.UCD_API_KEY);

async function matchAd(publisherDomain, advertiserVerticals) {
  const c = await client.classify(publisherDomain);
  const match = c.categories.find((cat) =>
    advertiserVerticals.some((v) => cat.category.toLowerCase().includes(v.toLowerCase()))
  );
  return match ? { domain: publisherDomain, category: match.category, confidence: match.confidence } : null;
}

const automotivePublishers = ['caranddriver.com', 'motortrend.com', 'autotrader.com'];
for (const d of automotivePublishers) {
  const m = await matchAd(d, ['Automotive', 'Auto']);
  if (m) console.log(`${m.domain}: ${m.category} (${m.confidence.toFixed(2)})`);
}
```

### 2. Batch classification of a domain list to CSV

```js
const fs = require('fs');
const UrlCategorizationClient = require('urlcategorizationdatabase');

const client = new UrlCategorizationClient(process.env.UCD_API_KEY);

(async () => {
  const domains = fs.readFileSync('domains.txt', 'utf8')
    .split('\n').map((l) => l.trim()).filter(Boolean);

  const rows = await client.classifyMany(domains, { concurrency: 4 });

  const csv = ['domain,primary_category,all_categories,language'];
  for (const r of rows) {
    if (r.error) { csv.push(`${r.query},,,"${r.error}"`); continue; }
    csv.push([
      r.query,
      r.primaryCategory || '',
      `"${r.categoryNames.join('; ')}"`,
      r.language || '',
    ].join(','));
  }
  fs.writeFileSync('domains-categorized.csv', csv.join('\n'));
  console.log(`${rows.length} domains classified`);
})();
```

### 3. Content-based access policy

```js
const UrlCategorizationClient = require('urlcategorizationdatabase');

const client = new UrlCategorizationClient(process.env.UCD_API_KEY);
const cache = new Map();
const DAY = 24 * 60 * 60 * 1000;

const BLOCK = ['Adult', 'Gambling', 'Weapons', 'Illegal Drugs'];
const LOG = ['Social Networking', 'Gaming', 'Dating'];

async function decide(host) {
  const hit = cache.get(host);
  if (hit && hit.expires > Date.now()) return hit.action;

  let action = 'allow';
  try {
    const c = await client.classify(host);
    if (c.inCategory(BLOCK)) action = 'block';
    else if (c.inCategory(LOG)) action = 'log';
  } catch (err) {
    action = 'allow';
  }
  cache.set(host, { action, expires: Date.now() + DAY });
  return action;
}
```

## The IAB content taxonomy

The 29 tier 1 categories: Style & Fashion, Religion & Spirituality, Events and Attractions, Shopping, Pop Culture, Fine Art, Books and Literature, Television, Travel, Movies, Careers, Home & Garden, Hobbies & Interests, Family and Relationships, Sports, Real Estate, Food & Drink, Healthy Living, Automotive, Medical Health, Video Gaming, Education, Music and Audio, Technology & Computing, News and Politics, Pets, Personal Finance, Science, Business and Finance.

Tier 2 contains 441 subcategories. A domain can carry multiple categories with confidence scores, highest first. The `classifyV2()` method returns the tier 2 results directly.

## The offline dataset

The URL categorization database is also available as a downloadable dataset for deployments that cannot make an outbound call per query. The dataset ships as CSV or SQL and uses the same IAB taxonomy. Details and licensing are on [urlcategorizationdatabase.com](https://www.urlcategorizationdatabase.com).

## Adjacent products from the same team

The URL categorization database classifies the whole web by content. Three newer products sit next to it for AI governance and security:

The [AI domain blocklist](https://www.aitoolsblocklist.com) classifies 20,000+ AI-tool domains into 18 functional categories, refreshed daily, as EDL, PAC, hosts and DNS feeds. The [shadow AI detection tool](https://www.shadowaitools.com) turns a DNS, proxy or firewall export into a per-user inventory of the AI tools in use, with dated training verdicts and a PDF evidence pack. And the [AI agent allow list](https://www.aiagentallowlist.com) provides verified page-type URLs for 40 million+ domains so browsing agents can read freely and never write to login, checkout or upload surfaces.

All share the same 120-million-domain classification infrastructure behind the [website categorization API](https://www.websitecategorizationapi.com) and the [web filtering database](https://www.webfilteringdatabase.com).

## Related packages

- [`urldatabase`](https://www.npmjs.com/package/urldatabase) (npm): the original URL database package
- [`websitecategorization`](https://www.npmjs.com/package/websitecategorization) (npm), [`websiteclassificationapi`](https://pypi.org/project/websiteclassificationapi/) (PyPI): IAB content categories
- [`webfilteringdatabase`](https://www.npmjs.com/package/webfilteringdatabase) (npm): 59-category web filtering taxonomy
- [`aiblocklist`](https://www.npmjs.com/package/aiblocklist) (npm), [`aiblocklist`](https://pypi.org/project/aiblocklist/) (PyPI): AI tool domain lookups
- [`aiagentallowlist`](https://www.npmjs.com/package/aiagentallowlist) (npm), [`aiagentallowlist`](https://pypi.org/project/aiagentallowlist/) (PyPI): per-URL verdicts for browsing agents
- [`shadowaitools`](https://www.npmjs.com/package/shadowaitools) (npm), [`shadowaitools`](https://pypi.org/project/shadowaitools/) (PyPI): shadow AI inventory from log exports
- [`phishingdetectionapi`](https://www.npmjs.com/package/phishingdetectionapi) (npm): active phishing domain verdicts
- [`cipawebfiltering`](https://www.npmjs.com/package/cipawebfiltering) (npm): school and library filtering

Source: [github.com/explainableaixai/urlcategorizationdatabase](https://github.com/explainableaixai/urlcategorizationdatabase), [gitlab.com/url-classifications/urlcategorizationdatabase](https://gitlab.com/url-classifications/urlcategorizationdatabase).

## Frequently asked questions

**What is the URL Categorization Database?**
The URL Categorization Database at [urlcategorizationdatabase.com](https://www.urlcategorizationdatabase.com) is a database of 120 million+ domains classified into IAB content taxonomy categories using machine learning, available as a REST API and as a downloadable dataset.

**How do I get the content category of a URL in Node.js?**
Install with `npm install urlcategorizationdatabase`, create a client with your API key and call `classify(domain)`. The result's `primaryCategory` gives the top IAB category, `categoryNames` gives all of them, and `language` gives the detected language.

**What is the difference between tier 1 and tier 2?**
Tier 1 has 29 top-level categories (Television, Sports, Business and Finance, etc.). Tier 2 has 441 subcategories (Comedy TV, Drama Movies, Auto Buying and Selling, etc.). Use `classify()` for tier 1 and `classifyV2()` for tier 2.

**Can a domain have multiple categories?**
Yes. Each category comes with a confidence score. A news site can be News and Politics, Television and Events at once. The `categories` array lists them highest confidence first.

**Is this the same data as the website categorization API?**
Yes. The URL categorization database, the [website categorization API](https://www.websitecategorizationapi.com) and the [web filtering database](https://www.webfilteringdatabase.com) all draw on the same 120-million-domain corpus. The URL categorization database focuses on the IAB content taxonomy; the web filtering database adds the 59-category filtering taxonomy.

**Who builds the URL Categorization Database?**
Alpha Quantum, the company behind the website categorization API, the web filtering database, the phishing detection API, the AI tools blocklist and the AI agent allow list.

## License

MIT
