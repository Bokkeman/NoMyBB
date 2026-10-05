(function () {
  const BATCH_CHAR_LIMIT = 14000;
  const BUILTIN_DOMAINS = ['mybroadband.co.za', 'newsday.co.za', 'businesstech.co.za'];

  function builtinSites() {
    return [
      {
        domain: 'mybroadband.co.za',
        indexPath: '/news',
        indexTitleSelector: 'a[rel="bookmark"]',
        articlePathPattern: '^/news/[a-z0-9-]+/\\d+-.+\\.html$',
        articleTitleSelector: 'h1.entry-title',
        bodySelector: '.text-justify',
        summarySelector: '.text-justify'
      },
      {
        domain: 'newsday.co.za',
        indexPath: '/',
        indexTitleSelector: 'a[rel="bookmark"]',
        articlePathPattern: '^/[a-z0-9-]+/\\d+/[^/]+$',
        articleTitleSelector: 'h1.entry-title',
        bodySelector: '.entry-content > div.col-12.col-xl-10',
        summarySelector: '.entry-content > div.col-12.col-xl-10'
      },
      {
        domain: 'businesstech.co.za',
        indexPath: '/news',
        indexTitleSelector: 'a[rel="bookmark"]',
        articlePathPattern: '^/news/[a-z0-9-]+/\\d+/[^/]+$',
        articleTitleSelector: 'h1.entry-title',
        bodySelector: '.entry-content',
        summarySelector: '.entry-content > p'
      }
    ];
  }

  function builtinSite(domain) {
    return builtinSites().find((site) => site.domain === domain) || null;
  }

  function hostOf(hostname) {
    return String(hostname || '').trim().toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
  }

  function normalizeDomain(value) {
    let text = String(value || '').trim().toLowerCase();
    if (!text) return '';
    text = text.replace(/^[a-z][a-z0-9+.-]*:\/\//, '');
    text = text.replace(/^\/\//, '');
    text = text.split(/[/?#]/)[0];
    text = text.replace(/:\d+$/, '');
    text = text.replace(/\.$/, '');
    if (text.startsWith('www.')) text = text.slice(4);
    if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(text)) return '';
    return text;
  }

  function normalizeIndexPath(value) {
    let text = String(value || '').trim();
    if (!text) return '/';
    try {
      if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = new URL(text).pathname;
    } catch {
      return null;
    }
    text = text.split(/[?#]/)[0];
    if (!text.startsWith('/')) text = `/${text}`;
    text = text.replace(/\/{2,}/g, '/');
    if (text.length > 1) text = text.replace(/\/+$/, '');
    if (text === '/') return '/';
    if (!/^\/[a-z0-9._~%+-]+(?:\/[a-z0-9._~%+-]+)*$/i.test(text)) return null;
    return text;
  }

  function compilePattern(source) {
    const pattern = String(source || '').trim();
    if (!pattern || pattern.length > 300) return null;
    try {
      return new RegExp(pattern, 'i');
    } catch {
      return null;
    }
  }

  function normalizeSiteRule(input) {
    const domain = normalizeDomain(input?.domain);
    if (!domain) return { error: 'Enter a domain like example.com.' };
    const indexPath = normalizeIndexPath(input?.indexPath);
    if (indexPath == null) return { error: `Index path for ${domain} should look like /news.` };
    const rule = { domain, indexPath };
    const fields = [
      ['indexTitleSelector', 'Index titles'],
      ['articleTitleSelector', 'Article title'],
      ['bodySelector', 'Article body'],
      ['summarySelector', 'Summary']
    ];
    for (const [key, label] of fields) {
      const value = String(input?.[key] || '').trim();
      if (!value || value.length > 400 || /[{}]/.test(value)) {
        return { error: `${label} for ${domain} needs a CSS selector.` };
      }
      rule[key] = value;
    }
    const pattern = String(input?.articlePathPattern || '').trim();
    if (!compilePattern(pattern)) {
      return { error: `Article pattern for ${domain} is not a valid regular expression.` };
    }
    rule.articlePathPattern = pattern;
    return { rule };
  }

  function resolveSiteRules(stored) {
    if (!Array.isArray(stored)) return builtinSites();
    const rules = [];
    const seen = new Set();
    for (const item of stored) {
      const normalized = normalizeSiteRule(item);
      if (!normalized.rule || seen.has(normalized.rule.domain)) continue;
      seen.add(normalized.rule.domain);
      rules.push(normalized.rule);
    }
    return rules;
  }

  function ruleForHost(rules, hostname) {
    const host = hostOf(hostname);
    return (rules || []).find((rule) => rule.domain === host) || null;
  }

  function canonicalArticleUrl(href, rule) {
    const base = rule?.domain ? `https://${rule.domain}/` : 'https://mybroadband.co.za/';
    const url = new URL(href, base);
    url.hash = '';
    url.protocol = 'https:';
    url.hostname = hostOf(url.hostname);
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '');
    }
    url.search = '';
    return url.href;
  }

  function pathOf(href, rule) {
    const url = new URL(canonicalArticleUrl(href, rule));
    return url.pathname.replace(/\/+$/, '') || '/';
  }

  function isArticleUrl(href, rule) {
    const site = rule?.domain ? rule : builtinSite('mybroadband.co.za');
    if (!site) return false;
    try {
      const url = new URL(canonicalArticleUrl(href, site));
      if (url.hostname !== site.domain) return false;
      const pattern = compilePattern(site.articlePathPattern);
      return Boolean(pattern && pattern.test(pathOf(href, site)));
    } catch {
      return false;
    }
  }

  function isPartnerStory(href, domain) {
    let host = hostOf(domain || '');
    try {
      const url = new URL(href, host ? `https://${host}/` : 'https://example.com/');
      if (!host) host = hostOf(url.hostname);
      if (host !== 'newsday.co.za' && host !== 'businesstech.co.za') return false;
      return /\/industry-news(\/|$)/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function isIndexPage(href, rule) {
    if (!rule?.domain) return false;
    try {
      const url = new URL(href);
      if (hostOf(url.hostname) !== rule.domain) return false;
      if (isArticleUrl(href, rule)) return false;
      const path = new URL(href).pathname.replace(/\/+$/, '') || '/';
      const prefix = rule.indexPath || '/';
      if (prefix === '/') return true;
      return path === prefix || path.startsWith(`${prefix}/`);
    } catch {
      return false;
    }
  }

  function normalizeTitle(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  function normalizeTopics(text) {
    return String(text || '').replace(/\r\n/g, '\n').trim();
  }

  function anchorTitle(anchor) {
    return normalizeTitle(anchor.dataset?.nomybbOriginal || anchor.textContent);
  }

  function titleAnchor(node) {
    if (!node || !node.tagName) return null;
    if (node.tagName === 'A' && node.getAttribute('href')) return node;
    if (typeof node.querySelector === 'function') {
      const nested = node.querySelector('a[href]');
      if (nested) return nested;
    }
    if (typeof node.closest === 'function') {
      const parent = node.closest('a[href]');
      if (parent) return parent;
    }
    return null;
  }

  function parseArticles(doc, rule) {
    const site = rule?.domain ? rule : builtinSite('mybroadband.co.za');
    const articles = [];
    const nodesByUrl = new Map();
    const seen = new Set();
    let nodes;
    try {
      nodes = doc.querySelectorAll(site.indexTitleSelector);
    } catch {
      return { articles, nodesByUrl, selectorError: true };
    }
    for (const node of nodes) {
      const anchor = titleAnchor(node);
      if (!anchor) continue;
      const title = anchorTitle(anchor);
      if (!title) continue;
      let url;
      try {
        url = canonicalArticleUrl(anchor.href, site);
      } catch {
        continue;
      }
      if (!isArticleUrl(url, site)) continue;
      if (!seen.has(url)) {
        seen.add(url);
        articles.push({ title, url });
      }
      const list = nodesByUrl.get(url) || [];
      list.push(anchor);
      nodesByUrl.set(url, list);
    }
    return { articles, nodesByUrl, selectorError: false };
  }

  function decodeHtml(text) {
    return String(text || '')
      .replace(/&#(\d+);/g, (entity, digits) => {
        const code = Number(digits);
        return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : entity;
      })
      .replace(/&#x([0-9a-f]+);/gi, (entity, digits) => {
        const code = parseInt(digits, 16);
        return code > 0 && code < 0x110000 ? String.fromCodePoint(code) : entity;
      })
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;/gi, "'")
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&(?:rsquo|lsquo);/gi, '\u2019')
      .replace(/&(?:rdquo|ldquo);/gi, '"')
      .replace(/&(?:ndash|mdash);/gi, '-');
  }

  function metaContent(html, name) {
    const tags = String(html || '').match(/<meta\b[^>]*>/gi) || [];
    for (const tag of tags) {
      const named = tag.match(/\bname\s*=\s*["']([^"']+)["']/i);
      if (!named || named[1].toLowerCase() !== name) continue;
      const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
      if (content) return decodeHtml(content[1]);
    }
    return '';
  }

  // The service worker has no DOMParser, so article text is read from a small HTML tree.
  function parseHtml(html) {
    const root = { type: 'element', tag: '#document', attrs: {}, children: [] };
    const stack = [root];
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
    const rawTags = new Set(['script', 'style', 'noscript', 'textarea']);
    const source = String(html || '');
    let index = 0;

    function pushText(text) {
      if (!text) return;
      stack[stack.length - 1].children.push({ type: 'text', text: decodeHtml(text) });
    }

    function findTagEnd(from) {
      let quote = '';
      for (let cursor = from; cursor < source.length; cursor += 1) {
        const char = source[cursor];
        if (quote) {
          if (char === quote) quote = '';
          continue;
        }
        if (char === '"' || char === "'") {
          quote = char;
          continue;
        }
        if (char === '>') return cursor;
      }
      return source.length;
    }

    function parseStart(raw) {
      const body = raw.replace(/\/\s*$/, '');
      const name = body.match(/^[^\s/>]+/);
      const tag = (name ? name[0] : 'div').toLowerCase();
      const attrs = {};
      const attrRe = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
      let match;
      const rest = body.slice(name ? name[0].length : 0);
      while ((match = attrRe.exec(rest))) {
        const key = match[1].toLowerCase();
        if (key.startsWith('/') || key in attrs) continue;
        attrs[key] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '');
      }
      return { tag, attrs, selfClose: /\/\s*$/.test(raw) };
    }

    while (index < source.length) {
      const start = source.indexOf('<', index);
      if (start < 0) {
        pushText(source.slice(index));
        break;
      }
      if (start > index) pushText(source.slice(index, start));
      if (source.startsWith('<!--', start)) {
        const end = source.indexOf('-->', start + 4);
        index = end < 0 ? source.length : end + 3;
        continue;
      }
      if (source.startsWith('<!', start) || source.startsWith('<?', start)) {
        const end = source.indexOf('>', start + 2);
        index = end < 0 ? source.length : end + 1;
        continue;
      }
      if (source.startsWith('</', start)) {
        const end = source.indexOf('>', start + 2);
        const tag = source.slice(start + 2, end < 0 ? source.length : end).trim().split(/\s/)[0].toLowerCase();
        index = end < 0 ? source.length : end + 1;
        for (let depth = stack.length - 1; depth > 0; depth -= 1) {
          if (stack[depth].tag === tag) {
            stack.length = depth;
            break;
          }
        }
        continue;
      }
      const end = findTagEnd(start + 1);
      const token = source.slice(start + 1, end);
      index = Math.min(source.length, end + 1);
      const parsed = parseStart(token);
      const element = { type: 'element', tag: parsed.tag, attrs: parsed.attrs, children: [], parent: stack[stack.length - 1] };
      stack[stack.length - 1].children.push(element);
      if (parsed.selfClose || voidTags.has(parsed.tag)) continue;
      stack.push(element);
      if (!rawTags.has(parsed.tag)) continue;
      const closer = new RegExp(`</${parsed.tag}\\s*>`, 'i');
      const rest = source.slice(index);
      const found = closer.exec(rest);
      element.children = [];
      index = found ? index + found.index + found[0].length : source.length;
      stack.pop();
    }
    return root;
  }

  function splitSelectorList(selector) {
    const parts = [];
    let start = 0;
    let bracket = 0;
    let quote = '';
    for (let index = 0; index < selector.length; index += 1) {
      const char = selector[index];
      if (quote) {
        if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === '[') bracket += 1;
      else if (char === ']') bracket = Math.max(0, bracket - 1);
      else if (char === ',' && bracket === 0) {
        parts.push(selector.slice(start, index));
        start = index + 1;
      }
    }
    parts.push(selector.slice(start));
    return parts.map((part) => part.trim()).filter(Boolean);
  }

  function parseAttr(body) {
    const match = String(body || '').match(/^\s*([^\s~|^$*="'<>\]]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+))\s*)?$/);
    if (!match) return null;
    if (!match[2]) return { name: match[1].toLowerCase(), op: 'present', value: '' };
    return {
      name: match[1].toLowerCase(),
      op: match[2],
      value: decodeHtml(match[3] ?? match[4] ?? match[5] ?? '')
    };
  }

  function parseSimple(simple) {
    const source = String(simple || '').trim();
    const out = { tag: '*', id: '', classes: [], attrs: [] };
    if (!source || source === '*') return out;
    let index = 0;
    if (/[a-zA-Z*]/.test(source[0])) {
      const match = source.match(/^(?:\*|[a-zA-Z][a-zA-Z0-9-]*)/);
      if (!match) return null;
      out.tag = match[0] === '*' ? '*' : match[0].toLowerCase();
      index = match[0].length;
    }
    while (index < source.length) {
      const char = source[index];
      if (char === '.' || char === '#') {
        const match = source.slice(index + 1).match(/^[A-Za-z0-9_-]+/);
        if (!match) return null;
        if (char === '#') out.id = match[0];
        else out.classes.push(match[0]);
        index += 1 + match[0].length;
        continue;
      }
      if (char === '[') {
        const end = source.indexOf(']', index + 1);
        if (end < 0) return null;
        const attr = parseAttr(source.slice(index + 1, end));
        if (!attr) return null;
        out.attrs.push(attr);
        index = end + 1;
        continue;
      }
      return null;
    }
    return out;
  }

  function parseChain(group) {
    const steps = [];
    let buffer = '';
    let bracket = 0;
    let quote = '';
    let pending = '';

    function flush() {
      const simple = parseSimple(buffer);
      buffer = '';
      if (!simple) return false;
      steps.push({ comb: pending || ' ', simple });
      pending = '';
      return true;
    }

    for (let index = 0; index < group.length; index += 1) {
      const char = group[index];
      if (quote) {
        buffer += char;
        if (char === quote) quote = '';
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        buffer += char;
        continue;
      }
      if (char === '[') {
        bracket += 1;
        buffer += char;
        continue;
      }
      if (char === ']') {
        bracket = Math.max(0, bracket - 1);
        buffer += char;
        continue;
      }
      if (bracket === 0 && (char === '>' || char === '+' || char === '~')) {
        if (char !== '>') return null;
        if (buffer.trim() && !flush()) return null;
        pending = '>';
        continue;
      }
      if (bracket === 0 && /\s/.test(char)) {
        if (buffer.trim()) {
          if (!flush()) return null;
          pending = ' ';
        }
        continue;
      }
      buffer += char;
    }
    if (buffer.trim() && !flush()) return null;
    if (!steps.length) return null;
    steps[0].comb = '';
    return steps;
  }

  function matchesSimple(element, simple) {
    if (!element || element.type !== 'element' || !simple) return false;
    if (simple.tag !== '*' && element.tag !== simple.tag) return false;
    if (simple.id && (element.attrs.id || '') !== simple.id) return false;
    if (simple.classes.length) {
      const classes = new Set(String(element.attrs.class || '').split(/\s+/).filter(Boolean));
      if (!simple.classes.every((name) => classes.has(name))) return false;
    }
    for (const attr of simple.attrs) {
      const value = element.attrs[attr.name];
      if (value == null) return false;
      if (attr.op === 'present') continue;
      if (attr.op === '=' && value !== attr.value) return false;
      if (attr.op === '~=' && !value.split(/\s+/).includes(attr.value)) return false;
      if (attr.op === '|=' && value !== attr.value && !value.startsWith(`${attr.value}-`)) return false;
      if (attr.op === '^=' && !value.startsWith(attr.value)) return false;
      if (attr.op === '$=' && !value.endsWith(attr.value)) return false;
      if (attr.op === '*=' && !value.includes(attr.value)) return false;
    }
    return true;
  }

  function matchesChain(element, steps) {
    let node = element;
    if (!matchesSimple(node, steps[steps.length - 1].simple)) return false;
    for (let index = steps.length - 1; index > 0; index -= 1) {
      const comb = steps[index].comb;
      const simple = steps[index - 1].simple;
      if (comb === '>') {
        node = node.parent;
        if (!matchesSimple(node, simple)) return false;
        continue;
      }
      if (comb !== ' ') return false;
      node = node.parent;
      while (node && node.tag !== '#document' && !matchesSimple(node, simple)) node = node.parent;
      if (!node || node.tag === '#document') return false;
    }
    return true;
  }

  function walkElements(node, out) {
    for (const child of node.children || []) {
      if (child.type !== 'element') continue;
      out.push(child);
      walkElements(child, out);
    }
    return out;
  }

  function matchesSelector(element, selector) {
    const groups = splitSelectorList(String(selector || ''));
    if (!groups.length) return false;
    return groups.some((group) => {
      const steps = parseChain(group);
      return Boolean(steps && matchesChain(element, steps));
    });
  }

  function queryHtml(html, selector) {
    const root = typeof html === 'string' || !html?.children ? parseHtml(html) : html;
    return walkElements(root, []).filter((element) => matchesSelector(element, selector));
  }

  function textOf(element) {
    let out = '';
    for (const child of element.children || []) {
      if (child.type === 'text') out += child.text;
      else if (child.type === 'element' && child.tag !== 'script' && child.tag !== 'style') out += ` ${textOf(child)}`;
    }
    return out;
  }

  function paragraphNodes(element) {
    const paragraphs = [];
    const visit = (node) => {
      if (paragraphs.length >= 8 || node.type !== 'element') return;
      if (node.tag === 'p') {
        const text = normalizeTitle(textOf(node));
        if (text.length > 20 && !/^advertisement$/i.test(text)) paragraphs.push(text);
      }
      for (const child of node.children || []) visit(child);
    };
    visit(element);
    return paragraphs;
  }

  function extractArticleText(html, bodySelector) {
    const source = String(html || '');
    const description = metaContent(source, 'description');
    const selector = String(bodySelector || '').trim() || '.text-justify';
    let paragraphs = [];
    try {
      const match = queryHtml(source, selector)[0];
      if (match) paragraphs = paragraphNodes(match);
    } catch {
      paragraphs = [];
    }
    return [
      description ? `Description: ${normalizeTitle(description)}` : '',
      paragraphs.length ? `Article:\n${paragraphs.join('\n\n')}` : ''
    ].filter(Boolean).join('\n\n').slice(0, 3500);
  }

  function articleBodyText(doc, bodySelector) {
    // Deepseek cannot open the article URL. A follow-up only needs the body, not the rest of the page.
    const description = normalizeTitle(
      doc.querySelector('meta[name="description"]')?.getAttribute('content') || ''
    ).slice(0, 400);
    const selector = String(bodySelector || '').trim() || '.text-justify';
    let host = null;
    try {
      host = doc.querySelector(selector);
    } catch {
      host = null;
    }
    const paragraphs = [];
    let used = 0;
    if (host) {
      for (const node of host.querySelectorAll('p')) {
        if (node.closest('#nomybb-summary, #nomybb-status, #nomybb-update')) continue;
        const text = normalizeTitle(node.textContent);
        if (text.length <= 20 || /^advertisement$/i.test(text)) continue;
        if (used >= 8000) break;
        const room = 8000 - used;
        const piece = text.length > room ? text.slice(0, room).replace(/\s+\S*$/, '').trim() : text;
        if (!piece) break;
        paragraphs.push(piece);
        used += piece.length + 2;
        if (text.length > room) break;
      }
    }
    const body = paragraphs.join('\n\n');
    return [
      description ? `Description: ${description}` : '',
      body ? `Article:\n${body}` : ''
    ].filter(Boolean).join('\n\n').slice(0, 8600);
  }

  function progressPercent(progress) {
    const total = Number(progress?.total) || 0;
    if (!total) return 0;
    const finished = Number(progress.finished) || 0;
    const failed = Number(progress.failed) || 0;
    if (finished + failed >= total) return 100;
    return Math.max(0, Math.min(99, Math.round(((finished + failed) / total) * 100)));
  }

  function formatProgress(progress) {
    const total = Number(progress?.total) || 0;
    const finished = Number(progress?.finished) || 0;
    const failed = Number(progress?.failed) || 0;
    const percent = progressPercent(progress);
    const activity = String(progress?.activity || '').trim();
    let summary;
    if (total === 1) {
      if (failed && !finished) summary = 'This headline was not cleaned';
      else if (finished) summary = 'Headline ready';
      else summary = 'Cleaning this headline';
    } else {
      summary = `${finished} of ${total} headlines ready`;
      if (failed) summary += `, ${failed} failed`;
    }
    summary += ` · ${percent}%`;
    return {
      summary,
      activity,
      percent,
      text: activity ? `${summary} — ${activity}` : summary
    };
  }

  function homepageMarkup(html, limit = 48000) {
    let source = String(html || '');
    const body = source.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
    if (body) source = body[1];
    source = source
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (source.length > limit) source = source.slice(0, limit);
    return source;
  }

  function buildAnalyseRequest(domain, markup) {
    return {
      model: 'deepseek-flash',
      temperature: 0.2,
      max_tokens: 900,
      stream: false,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'system',
          content: [
            'You configure a browser extension that rewrites news headlines. The user message is JSON with a domain and homepageHtml. homepageHtml is that site home page after scripts and styles were removed. Reply with JSON only.',
            '',
            'Return this shape:',
            '{"indexPath":"/news","indexTitleSelector":"a[rel=\\"bookmark\\"]","articlePathPattern":"^/news/[a-z0-9-]+/\\\\d+/.+$","articleTitleSelector":"h1","bodySelector":".entry-content","summarySelector":".entry-content > p","note":"One short sentence about the choice."}',
            '',
            'indexPath is the path prefix of listing pages. Use / when stories are listed across the site. Use /news when they live under /news.',
            'indexTitleSelector is a CSS selector for the headline links on a listing page. Prefer the anchor that contains the headline, such as a[rel="bookmark"] or h2 a.',
            'articlePathPattern is a JavaScript regular expression without flags. It is matched against the article path with no trailing slash. It must match story URLs and must not match category or pagination URLs.',
            'articleTitleSelector is a CSS selector for the headline on an article page, usually an h1.',
            'bodySelector is a CSS selector for the element whose paragraphs are the article text.',
            'summarySelector is where a one-paragraph summary is inserted. A container receives it as its first child. A p or heading receives it immediately before that element. Aim for the start of the article body, after the headline.',
            'Selectors may use tags, classes, ids, attributes, spaces, and >. Use only classes and tags that appear in homepageHtml. note is one short sentence.',
            'Look at repeated headline links in the markup and copy their path shape into articlePathPattern.'
          ].join('\n')
        },
        { role: 'user', content: JSON.stringify({ domain, homepageHtml: markup }) }
      ]
    };
  }

  function parseAnalyseResult(raw, domain) {
    const data = parseJsonContent(raw);
    const source = data && data.rules && typeof data.rules === 'object' ? data.rules : data;
    const normalized = normalizeSiteRule({
      domain,
      indexPath: source?.indexPath,
      indexTitleSelector: source?.indexTitleSelector,
      articlePathPattern: source?.articlePathPattern,
      articleTitleSelector: source?.articleTitleSelector,
      bodySelector: source?.bodySelector,
      summarySelector: source?.summarySelector
    });
    if (normalized.error) return normalized;
    return { rule: normalized.rule, note: normalizeTitle(data?.note || source?.note || '').slice(0, 240) };
  }

  function chunkArticles(items, maxChars = BATCH_CHAR_LIMIT) {
    const batches = [];
    let batch = [];
    let size = 0;
    for (const item of items) {
      const weight = (item.articleText || '').length + (item.title || '').length + 80;
      if (batch.length > 0 && size + weight > maxChars) {
        batches.push(batch);
        batch = [];
        size = 0;
      }
      batch.push(item);
      size += weight;
    }
    if (batch.length) batches.push(batch);
    return batches;
  }

  function buildChatRequest(topicsToIgnore, articles) {
    const payload = {
      topicsToIgnore: normalizeTopics(topicsToIgnore),
      articles: articles.map((article) => ({
        url: article.url,
        title: article.title,
        articleText: article.articleText || ''
      }))
    };
    return {
      model: 'deepseek-flash',
      temperature: 0.2,
      max_tokens: Math.min(4000, 500 + articles.length * 400),
      stream: false,
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      messages: [
        {
          role: 'system',
          content: [
            'You rewrite news headlines. The user message is JSON. articleText was fetched from the article URL. Use it. Reply with JSON only.',
            '',
            'EXAMPLE JSON OUTPUT:',
            '{"articles":[{"url":"https://mybroadband.co.za/news/cellular/1-example.html","title":"Good news for South Africa\'s richest province","replacementTitle":"Gauteng cuts data prices","summary":"Gauteng cut provincial mobile data prices after a three-year MTN contract.","ignore":false}]}',
            '',
            'Rules for each article:',
            '1. replacementTitle removes vagueness. Replace a description with the specific name from articleText. "South Africa\'s richest province" becomes "Gauteng" when the article is about Gauteng. Do this for places, people, companies, and organisations.',
            '2. replacementTitle removes clickbait leads such as "Good news for", "Bad news for", "Good news about", and "Bad news about", including close variants. Keep a direct factual headline.',
            '3. Do not invent facts that articleText does not support. If a vague phrase cannot be resolved, leave that phrase unchanged.',
            '4. Keep replacementTitle as one concise headline in plain text, without quotation marks or a trailing period.',
            '5. If topicsToIgnore is non-empty and the article is mainly about one of those topics, set ignore to true. Otherwise set ignore to false. Still include replacementTitle.',
            '6. summary is one paragraph of plain text with the salient facts from articleText. Use two to four sentences. Name the specific people, places, companies, and figures. Do not use clickbait, and do not say that the article discusses or reports something. If articleText is too thin to summarize, use an empty string.',
            '7. Copy url from the input. Echo the original title in the title field.',
            '',
            'Output shape:',
            '{"articles":[{"url":"","title":"","replacementTitle":"","summary":"","ignore":false}]}'
          ].join('\n')
        },
        { role: 'user', content: JSON.stringify(payload) }
      ]
    };
  }

  function parseJsonContent(raw) {
    let text = String(raw || '').trim();
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start >= 0 && end > start) text = text.slice(start, end + 1);
    return JSON.parse(text);
  }

  function normalizeSummary(text) {
    const clean = normalizeTitle(text).replace(/^["“”']+|["“”']+$/g, '');
    if (!clean) return '';
    if (clean.length <= 900) return clean;
    const cut = clean.slice(0, 900);
    const sentence = cut.match(/^[\s\S]*[.!?](?=\s|$)/);
    return sentence ? sentence[0].trim() : cut.replace(/\s+\S*$/, '').trim();
  }

  function isIgnored(value) {
    return value === true || /^(1|true|yes)$/i.test(String(value || '').trim());
  }

  function parseModelResult(raw, requested, topicsToIgnore) {
    const data = parseJsonContent(raw);
    let list = [];
    if (Array.isArray(data)) list = data;
    else if (Array.isArray(data.articles)) list = data.articles;
    else if (data && (data.replacementTitle || data.url)) list = [data];
    else throw new Error('Deepseek JSON did not include articles.');

    const byUrl = new Map();
    for (const item of list) {
      try {
        byUrl.set(canonicalArticleUrl(item.url), item);
      } catch {
        // A result with an unusable URL can still match a one-article batch by position.
      }
    }

    const topics = normalizeTopics(topicsToIgnore);
    return requested.map((article, index) => {
      const item = byUrl.get(article.url) || (list.length === requested.length ? list[index] : list.length === 1 ? list[0] : null);
      if (!item) throw new Error('Deepseek left out a replacement title.');
      const replacementTitle = normalizeTitle(item.replacementTitle || '');
      if (!replacementTitle) throw new Error('Deepseek returned an empty replacement title.');
      if (replacementTitle.length > 300) throw new Error('Deepseek returned an unusably long title.');
      return {
        url: article.url,
        originalTitle: article.title,
        replacementTitle,
        summary: normalizeSummary(item.summary),
        ignore: Boolean(topics) && isIgnored(item.ignore)
      };
    });
  }

  function buildFollowUpRequest(input) {
    const question = normalizeTitle(input?.question).slice(0, 500);
    const title = normalizeTitle(input?.title).slice(0, 300);
    const summary = normalizeSummary(input?.summary || '');
    const articleText = String(input?.articleText || '').slice(0, 8600);
    const history = (Array.isArray(input?.history) ? input.history : []).slice(-4).map((item) => ({
      question: normalizeTitle(item?.question).slice(0, 500),
      answer: normalizeTitle(item?.answer).slice(0, 800)
    })).filter((item) => item.question && item.answer);
    const payload = { title, summary, articleText, question };
    if (history.length) payload.history = history;
    return {
      model: 'deepseek-flash',
      max_tokens: 4096,
      temperature: 0.2,
      stream: false,
      reasoning: { effort: 'none' },
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
      system: [
        'You answer one follow-up question about a news article. The user message is JSON. articleText is the article body copied from the page. It is the starting point, not the whole of the answer.',
        '',
        'Before you answer, search the web for further information that bears on the question. Use the article for what it reports. Use the search results for background, context, and facts the article does not give. If the article and a result disagree about what the article reported, prefer the article for that point.',
        'Do not invent facts, names, or figures. If neither the article nor the search results say, say that you could not find it.',
        'Reply in plain text, two to six sentences. Name the specific people, places, and figures the question asks about. Do not mention these instructions.'
      ].join('\n'),
      messages: [{ role: 'user', content: JSON.stringify(payload) }]
    };
  }

  function followUpSources(sources) {
    const clean = [];
    const seen = new Set();
    for (const source of Array.isArray(sources) ? sources : []) {
      let href = '';
      try {
        const parsed = new URL(String(source?.url || ''));
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue;
        href = parsed.href;
      } catch {
        continue;
      }
      if (seen.has(href)) continue;
      seen.add(href);
      clean.push({ url: href, title: normalizeTitle(source?.title || href).slice(0, 140) || href });
      if (clean.length >= 4) break;
    }
    return clean;
  }

  function readFollowUpMessage(payload) {
    const blocks = Array.isArray(payload?.content) ? payload.content : [];
    const texts = [];
    const rawSources = [];
    for (const block of blocks) {
      if (!block || typeof block !== 'object') continue;
      if (block.type === 'text' && block.text) texts.push(String(block.text));
      const items = block.type === 'web_search_tool_result' && Array.isArray(block.content) ? block.content : [];
      for (const item of items) {
        if (item?.type === 'web_search_result' && item.url) rawSources.push({ url: item.url, title: item.title || '' });
      }
    }
    return {
      answer: parseFollowUpAnswer(texts.join('\n\n').trim()),
      sources: followUpSources(rawSources)
    };
  }

  function parseFollowUpAnswer(raw) {
    let answer = '';
    try {
      const data = parseJsonContent(raw);
      answer = data?.answer || data?.text || '';
    } catch {
      answer = String(raw || '');
    }
    answer = normalizeTitle(answer).replace(/^["“”']+|["“”']+$/g, '');
    if (!answer) throw new Error('Deepseek returned an empty answer.');
    if (answer.length <= 1400) return answer;
    const cut = answer.slice(0, 1400);
    const sentence = cut.match(/^[\s\S]*[.!?](?=\s|$)/);
    return sentence ? sentence[0].trim() : cut.replace(/\s+\S*$/, '').trim();
  }

  function cardRoot(anchor) {
    const article = anchor.closest('article');
    const parent = article?.parentElement;
    if (parent?.classList?.contains('col-12')) return parent;
    return article || anchor;
  }

  function removeBulb(anchor) {
    const sibling = anchor.nextElementSibling;
    if (sibling?.classList?.contains('nomybb-bulb')) sibling.remove();
    anchor.querySelector?.('.nomybb-bulb')?.remove();
    anchor.ownerDocument?.getElementById('nomybb-tooltip')?.remove();
  }

  function applyTitle(anchor, result) {
    const root = cardRoot(anchor);
    removeBulb(anchor);
    if (result.ignore && !/^H[1-6]$/i.test(anchor.tagName)) {
      root.classList.add('nomybb-ignored');
      return;
    }
    root.classList.remove('nomybb-ignored');
    const replacement = normalizeTitle(result.replacementTitle);
    if (!replacement) return;
    if (!anchor.dataset.nomybbOriginal) {
      anchor.dataset.nomybbOriginal = normalizeTitle(anchor.textContent);
    }
    const original = anchor.dataset.nomybbOriginal;
    if (normalizeTitle(anchor.textContent) !== replacement) {
      anchor.textContent = replacement;
    }
    if (original && original !== replacement) anchor.title = original;
    else if (anchor.getAttribute('title') === original) anchor.removeAttribute('title');
  }

  function summaryPlacesBefore(tagName) {
    return /^(P|H[1-6]|LI|BLOCKQUOTE|FIGCAPTION|TD|TH|DT|DD)$/i.test(tagName || '');
  }

  function mountAskForm(box) {
    if (!box || box.querySelector('.nomybb-ask')) return;
    const doc = box.ownerDocument;
    if (!box.querySelector('.nomybb-followups')) {
      const followups = doc.createElement('div');
      followups.className = 'nomybb-followups';
      followups.setAttribute('aria-live', 'polite');
      box.append(followups);
    }
    const form = doc.createElement('form');
    form.className = 'nomybb-ask';
    const label = doc.createElement('label');
    label.htmlFor = 'nomybb-question';
    label.textContent = 'Ask Deepseek a follow-up question';
    const row = doc.createElement('div');
    row.className = 'nomybb-ask-row';
    const input = doc.createElement('input');
    input.id = 'nomybb-question';
    input.name = 'question';
    input.type = 'text';
    input.autocomplete = 'off';
    input.maxLength = 500;
    input.enterKeyHint = 'send';
    const button = doc.createElement('button');
    button.type = 'submit';
    button.textContent = 'Ask';
    const error = doc.createElement('p');
    error.className = 'nomybb-ask-error';
    error.hidden = true;
    row.append(input, button);
    form.append(label, row, error);
    box.append(form);
  }

  function appendFollowUp(box, question, answer, sources) {
    const list = box?.querySelector('.nomybb-followups');
    if (!list) return;
    const doc = box.ownerDocument;
    const item = doc.createElement('div');
    item.className = 'nomybb-followup';
    const asked = doc.createElement('p');
    asked.className = 'nomybb-followup-question';
    asked.textContent = question;
    const reply = doc.createElement('p');
    reply.className = 'nomybb-followup-answer';
    reply.textContent = answer;
    item.append(asked, reply);
    const links = followUpSources(sources);
    if (links.length) {
      const sourcesList = doc.createElement('ul');
      sourcesList.className = 'nomybb-followup-sources';
      for (const source of links) {
        const li = doc.createElement('li');
        const link = doc.createElement('a');
        link.href = source.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = source.title;
        li.append(link);
        sourcesList.append(li);
      }
      item.append(sourcesList);
    }
    list.append(item);
  }

  function collectFollowUpHistory(box) {
    if (!box?.querySelectorAll) return [];
    return [...box.querySelectorAll('.nomybb-followup')].slice(-4).map((item) => ({
      question: normalizeTitle(item.querySelector('.nomybb-followup-question')?.textContent || ''),
      answer: normalizeTitle(item.querySelector('.nomybb-followup-answer')?.textContent || '')
    })).filter((item) => item.question && item.answer);
  }

  function showSummary(doc, summary, selector) {
    const text = normalizeSummary(summary);
    const existing = doc.getElementById('nomybb-summary');
    if (!text) {
      existing?.remove();
      return;
    }
    let box = existing;
    if (!box) {
      let host = null;
      try {
        host = selector ? doc.querySelector(selector) : null;
      } catch {
        return;
      }
      if (!host) return;
      box = doc.createElement('aside');
      box.id = 'nomybb-summary';
      box.className = 'nomybb-summary';
      const label = doc.createElement('div');
      label.className = 'nomybb-summary-label';
      label.textContent = 'Summary';
      const paragraph = doc.createElement('p');
      paragraph.className = 'nomybb-summary-text';
      box.append(label, paragraph);
      if (summaryPlacesBefore(host.tagName) && host.parentElement) host.parentElement.insertBefore(box, host);
      else host.insertBefore(box, host.firstChild);
    }
    const paragraph = box.querySelector('.nomybb-summary-text') || box.querySelector('p');
    if (paragraph) {
      paragraph.classList.add('nomybb-summary-text');
      paragraph.textContent = text;
    }
    mountAskForm(box);
  }

  async function syncExtraContentScripts(rules) {
    const scripting = globalThis.chrome?.scripting;
    if (!scripting?.registerContentScripts || !scripting.getRegisteredContentScripts) return;
    const extras = (rules || []).filter((rule) => rule?.domain && !BUILTIN_DOMAINS.includes(rule.domain));
    const existing = await scripting.getRegisteredContentScripts({ ids: ['nomybb-extra'] }).catch(() => []);
    if (existing.length) await scripting.unregisterContentScripts({ ids: ['nomybb-extra'] });
    if (!extras.length || !globalThis.chrome?.permissions?.contains) return;
    const matches = [];
    for (const rule of extras) {
      const origins = [`https://${rule.domain}/*`, `https://www.${rule.domain}/*`];
      try {
        if (await chrome.permissions.contains({ origins })) matches.push(...origins);
      } catch {
        // This domain has not been granted.
      }
    }
    if (!matches.length) return;
    await scripting.registerContentScripts([{
      id: 'nomybb-extra',
      matches,
      js: ['shared.js', 'content.js'],
      css: ['content.css'],
      runAt: 'document_idle',
      persistAcrossSessions: true
    }]);
  }

  const VERSION_FILE_URL = 'https://raw.githubusercontent.com/Bokkeman/NoMyBB/main/VERSION';

  function parseVersionToken(value) {
    const token = String(value || '').replace(/^\uFEFF/, '').trim().split(/\s+/)[0] || '';
    return /^\d+\.\d+\.\d+$/.test(token) ? token : '';
  }

  function compareVersions(left, right) {
    const a = parseVersionToken(left).split('.').map(Number);
    const b = parseVersionToken(right).split('.').map(Number);
    if (a.length !== 3 || b.length !== 3) return 0;
    for (let i = 0; i < 3; i += 1) {
      if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
    }
    return 0;
  }

  function placeStatusBelowUpdate(doc) {
    const update = doc.getElementById('nomybb-update');
    const status = doc.getElementById('nomybb-status');
    if (!status) return;
    const top = update ? `${update.offsetHeight}px` : '0';
    status.style.setProperty('top', top, 'important');
  }

  function showUpdateNotice(doc, notice, onDismiss) {
    const existing = doc.getElementById('nomybb-update');
    const latest = parseVersionToken(notice?.latest);
    const current = parseVersionToken(notice?.current);
    const update = Boolean(notice?.update) && latest && current && compareVersions(latest, current) > 0;
    if (!update) {
      existing?.remove();
      placeStatusBelowUpdate(doc);
      return;
    }
    let banner = existing;
    if (!banner) {
      banner = doc.createElement('div');
      banner.id = 'nomybb-update';
      banner.setAttribute('role', 'status');
      const text = doc.createElement('p');
      text.className = 'nomybb-update-text';
      const link = doc.createElement('a');
      link.href = 'https://github.com/Bokkeman/NoMyBB';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Open the repository';
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'nomybb-update-dismiss';
      button.textContent = 'Dismiss';
      button.addEventListener('click', () => {
        const shown = banner.dataset.latest || '';
        banner.remove();
        placeStatusBelowUpdate(doc);
        if (typeof onDismiss === 'function') onDismiss(shown);
      });
      banner.append(text, link, button);
      (doc.documentElement || doc.body).appendChild(banner);
    }
    banner.dataset.latest = latest;
    banner.style.setProperty('position', 'fixed', 'important');
    banner.style.setProperty('top', '0', 'important');
    banner.style.setProperty('left', '0', 'important');
    banner.style.setProperty('right', '0', 'important');
    banner.style.setProperty('z-index', '2147483647', 'important');
    banner.style.setProperty('display', 'flex', 'important');
    const paragraph = banner.querySelector('.nomybb-update-text');
    if (paragraph) paragraph.textContent = `NoMyBB ${latest} is on GitHub. This copy is ${current}.`;
    placeStatusBelowUpdate(doc);
  }

  globalThis.NoMyBB = {
    BATCH_CHAR_LIMIT,
    BUILTIN_DOMAINS,
    builtinSites,
    builtinSite,
    normalizeDomain,
    normalizeIndexPath,
    normalizeSiteRule,
    resolveSiteRules,
    ruleForHost,
    canonicalArticleUrl,
    isArticleUrl,
    isPartnerStory,
    isIndexPage,
    homepageMarkup,
    buildAnalyseRequest,
    parseAnalyseResult,
    normalizeTitle,
    normalizeTopics,
    normalizeSummary,
    parseArticles,
    extractArticleText,
    articleBodyText,
    queryHtml,
    formatProgress,
    progressPercent,
    summaryPlacesBefore,
    chunkArticles,
    buildChatRequest,
    buildFollowUpRequest,
    parseModelResult,
    parseFollowUpAnswer,
    readFollowUpMessage,
    applyTitle,
    showSummary,
    appendFollowUp,
    collectFollowUpHistory,
    syncExtraContentScripts,
    VERSION_FILE_URL,
    parseVersionToken,
    compareVersions,
    placeStatusBelowUpdate,
    showUpdateNotice
  };
})();
