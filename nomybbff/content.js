(function () {
  const api = globalThis.browser ?? globalThis.chrome;
  if (window.top !== window) return;

  const nodesByUrl = new Map();
  const requested = new Set();
  let scanTimer = 0;
  let port = null;
  let retries = 0;
  let closing = false;
  let rule = null;
  let skipPartner = false;
  let watching = false;

  function restoreAnchor(anchor) {
    if (!anchor) return;
    const original = anchor.dataset?.nomybbOriginal;
    if (original) anchor.textContent = original;
    if (original && anchor.getAttribute('title') === original) anchor.removeAttribute('title');
    delete anchor.dataset.nomybbOriginal;
    const sibling = anchor.nextElementSibling;
    if (sibling?.classList?.contains('nomybb-bulb')) sibling.remove();
    anchor.querySelector?.('.nomybb-bulb')?.remove();
    anchor.ownerDocument?.getElementById('nomybb-tooltip')?.remove();
  }

  function pinBanner(banner) {
    banner.style.setProperty('position', 'fixed', 'important');
    banner.style.setProperty('top', '0', 'important');
    banner.style.setProperty('left', '0', 'important');
    banner.style.setProperty('right', '0', 'important');
    banner.style.setProperty('z-index', '2147483646', 'important');
    banner.style.setProperty('display', 'block', 'important');
    document.documentElement.appendChild(banner);
  }

  function showStatus(message, progress) {
    let banner = document.getElementById('nomybb-status');
    const hasProgress = Number(progress?.total) > 0;
    if (!message && !hasProgress) {
      banner?.remove();
      return;
    }
    if (!banner || !banner.querySelector('.nomybb-status-text') || !banner.querySelector('.nomybb-progress')) {
      banner?.remove();
      banner = document.createElement('div');
      banner.id = 'nomybb-status';
      const text = document.createElement('div');
      text.className = 'nomybb-status-text';
      const track = document.createElement('div');
      track.className = 'nomybb-progress';
      track.setAttribute('role', 'progressbar');
      track.setAttribute('aria-valuemin', '0');
      track.setAttribute('aria-valuemax', '100');
      const fill = document.createElement('span');
      track.append(fill);
      banner.append(text, track);
    }
    pinBanner(banner);
    const view = hasProgress ? NoMyBB.formatProgress(progress) : null;
    banner.querySelector('.nomybb-status-text').textContent = message || view.text;
    const track = banner.querySelector('.nomybb-progress');
    track.hidden = !view;
    if (!view) return;
    track.classList.toggle('busy', Boolean(view.activity));
    track.setAttribute('aria-valuenow', String(view.percent));
    track.setAttribute('aria-label', view.text);
    track.firstElementChild.style.width = `${view.percent}%`;
  }

  function applyStoredRun(runState) {
    const message = String(runState?.message || '');
    const progress = runState?.progress && typeof runState.progress === 'object' ? runState.progress : null;
    const phase = runState?.phase || '';
    if (phase === 'running' || phase === 'error' || message) {
      showStatus(message, progress);
      return;
    }
    showStatus('', null);
  }

  function pageKind() {
    if (!rule) return '';
    if (NoMyBB.isArticleUrl(location.href, rule)) return 'article';
    if (NoMyBB.isIndexPage(location.href, rule)) return 'home';
    return '';
  }

  function currentArticle() {
    let heading = null;
    try {
      heading = document.querySelector(rule.articleTitleSelector);
    } catch {
      return { selectorError: true };
    }
    if (!heading) return null;
    let url;
    try {
      url = NoMyBB.canonicalArticleUrl(location.href, rule);
    } catch {
      return null;
    }
    if (!NoMyBB.isArticleUrl(url, rule)) return null;
    return {
      url,
      heading,
      title: NoMyBB.normalizeTitle(heading.dataset.nomybbOriginal || heading.textContent)
    };
  }

  function applyReady(message) {
    if (pageKind() === 'article') {
      const story = currentArticle();
      if (!story || story.url !== message.url) return;
      NoMyBB.applyTitle(story.heading, message);
      NoMyBB.showSummary(document, message.summary, rule.summarySelector);
      return;
    }
    const nodes = nodesByUrl.get(message.url) || [];
    for (const anchor of nodes) {
      if (!anchor.isConnected) continue;
      NoMyBB.applyTitle(anchor, message);
    }
  }

  function handleWorkerMessage(message) {
    if (message?.type === 'TITLE_READY') {
      retries = 0;
      applyReady(message);
    }
    if (message?.type === 'STATUS') {
      if (message.final && !message.message) showStatus('', null);
      else showStatus(message.message || '', message.progress || null);
      if (message.final) {
        closing = true;
        try { port?.disconnect(); } catch { /* already closed */ }
        port = null;
      }
    }
  }

  function ensurePort() {
    if (port) return port;
    port = api.runtime.connect({ name: 'nomybb' });
    port.onMessage.addListener(handleWorkerMessage);
    port.onDisconnect.addListener(() => {
      port = null;
      if (closing) {
        closing = false;
        return;
      }
      if (retries >= 5) {
        showStatus('NoMyBB stopped before this page was updated. Reload the page.');
        return;
      }
      retries += 1;
      requested.clear();
      setTimeout(() => scan(true), 400);
    });
    return port;
  }

  function post(payload) {
    try {
      ensurePort().postMessage(payload);
    } catch {
      port = null;
      showStatus('NoMyBB could not reach its background worker. Reload the page.');
    }
  }

  function scan(force) {
    const kind = pageKind();
    if (!kind) return;
    if (kind === 'article') {
      if (skipPartner && NoMyBB.isPartnerStory(location.href, rule.domain)) {
        const story = currentArticle();
        if (story && !story.selectorError) restoreAnchor(story.heading);
        document.getElementById('nomybb-summary')?.remove();
        return;
      }
      const story = currentArticle();
      if (story?.selectorError) {
        showStatus(`NoMyBB: the article title selector for ${rule.domain} is not valid CSS.`);
        return;
      }
      if (!story) {
        showStatus(`NoMyBB: no element matched the article title selector on ${rule.domain}.`);
        return;
      }
      if (!force && requested.has(story.url)) return;
      requested.add(story.url);
      post({
        type: 'PROCESS_PAGE',
        domain: rule.domain,
        pageUrl: location.href,
        requireSummary: true,
        articles: [{ title: story.title, url: story.url }]
      });
      return;
    }

    const parsed = NoMyBB.parseArticles(document, rule);
    if (parsed.selectorError) {
      showStatus(`NoMyBB: the index title selector for ${rule.domain} is not valid CSS.`);
      return;
    }
    if (skipPartner) {
      for (const [url, nodes] of [...parsed.nodesByUrl]) {
        if (!NoMyBB.isPartnerStory(url, rule.domain)) continue;
        for (const anchor of nodes) restoreAnchor(anchor);
        parsed.nodesByUrl.delete(url);
        requested.delete(url);
      }
      parsed.articles = parsed.articles.filter((article) => !NoMyBB.isPartnerStory(article.url, rule.domain));
    }
    nodesByUrl.clear();
    for (const [url, nodes] of parsed.nodesByUrl) nodesByUrl.set(url, nodes);
    const fresh = force ? parsed.articles : parsed.articles.filter((article) => !requested.has(article.url));
    for (const article of parsed.articles) requested.add(article.url);
    if (!fresh.length) return;
    post({
      type: 'PROCESS_PAGE',
      domain: rule.domain,
      pageUrl: location.href,
      articles: fresh
    });
  }

  function watch() {
    if (watching) return;
    watching = true;
    const observer = new MutationObserver(() => {
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => scan(false), 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  api.storage.local.get(['siteRules', 'skipPartnerStories', 'runState']).then((stored) => {
    skipPartner = Boolean(stored.skipPartnerStories);
    rule = NoMyBB.ruleForHost(NoMyBB.resolveSiteRules(stored.siteRules), location.hostname);
    applyStoredRun(stored.runState);
    api.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.runState) applyStoredRun(changes.runState.newValue);
      if (changes.siteRules) {
        rule = NoMyBB.ruleForHost(NoMyBB.resolveSiteRules(changes.siteRules.newValue), location.hostname);
        nodesByUrl.clear();
      }
      if (changes.skipPartnerStories) skipPartner = Boolean(changes.skipPartnerStories.newValue);
      if (!changes.topicsToIgnore && !changes.apiKey && !changes.siteRules && !changes.skipPartnerStories) return;
      if (!rule) return;
      requested.clear();
      watch();
      scan(true);
    });
    if (!rule || !pageKind()) return;
    watch();
    scan(false);
  }).catch(() => {
    showStatus('NoMyBB could not read its site rules.');
  });
})();
