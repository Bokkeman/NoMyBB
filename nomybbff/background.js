// shared.js is loaded first from the manifest. Firefox event pages have no importScripts.
// browser.* is promise-based. Firefox's chrome alias is callback-only, so this file calls browser.
const api = globalThis.browser ?? globalThis.chrome;

const LIST_LIMIT = 400;
const TITLE_LIMIT = 500;

let queue = Promise.resolve();
let syncing = Promise.resolve();

function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.then(() => undefined, () => undefined);
  return run;
}

function notify(port, message) {
  try {
    port.postMessage(message);
  } catch {
    // The news tab closed or the port dropped.
  }
}

function progressSnapshot(progress) {
  const view = NoMyBB.formatProgress(progress);
  return {
    total: Number(progress.total) || 0,
    finished: Number(progress.finished) || 0,
    failed: Number(progress.failed) || 0,
    reading: Number(progress.reading) || 0,
    asking: Number(progress.asking) || 0,
    activity: progress.activity || '',
    percent: view.percent
  };
}

async function setRunState(message, phase, progress) {
  await api.storage.local.set({
    runState: {
      message: message || '',
      phase,
      at: Date.now(),
      progress: progress || null
    }
  });
}

async function readSettings() {
  const stored = await api.storage.local.get(['apiKey', 'topicsToIgnore', 'skipPartnerStories']);
  return {
    apiKey: String(stored.apiKey || '').trim(),
    topicsToIgnore: NoMyBB.normalizeTopics(stored.topicsToIgnore || ''),
    skipPartnerStories: Boolean(stored.skipPartnerStories)
  };
}

async function readSiteRules() {
  const stored = await api.storage.local.get('siteRules');
  return NoMyBB.resolveSiteRules(stored.siteRules);
}

async function saveArticleList(articles, pageUrl) {
  const stored = await api.storage.local.get('articleList');
  const previous = stored.articleList?.articles || [];
  const incomingUrls = new Set(articles.map((article) => article.url));
  const merged = [
    ...articles.map((article) => ({ title: article.title, url: article.url })),
    ...previous.filter((article) => article?.url && !incomingUrls.has(article.url))
  ].slice(0, LIST_LIMIT);
  await api.storage.local.set({
    articleList: {
      savedAt: Date.now(),
      page: pageUrl || '',
      articles: merged
    }
  });
}

function pruneTitles(map) {
  const entries = Object.entries(map);
  if (entries.length <= TITLE_LIMIT) return map;
  entries.sort((a, b) => (b[1].processedAt || 0) - (a[1].processedAt || 0));
  return Object.fromEntries(entries.slice(0, TITLE_LIMIT));
}

async function rememberTitles(entries, topicsSnapshot) {
  const stored = await api.storage.local.get('processedTitles');
  const map = stored.processedTitles || {};
  const processedAt = Date.now();
  for (const entry of entries) {
    map[entry.url] = {
      originalTitle: entry.originalTitle,
      replacementTitle: entry.replacementTitle,
      summary: entry.summary || '',
      ignore: entry.ignore,
      topicsSnapshot,
      processedAt
    };
  }
  await api.storage.local.set({ processedTitles: pruneTitles(map) });
}

async function fetchArticleText(url, bodySelector) {
  const response = await fetch(url, {
    redirect: 'follow',
    credentials: 'omit',
    signal: AbortSignal.timeout(20000),
    headers: { Accept: 'text/html' }
  });
  if (!response.ok) throw new Error(`Article fetch failed (${response.status}).`);
  return NoMyBB.extractArticleText(await response.text(), bodySelector);
}

async function callDeepseek(apiKey, topics, articles) {
  // The chat API does not browse. The extension fetches each article and sends that text in the JSON payload.
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(NoMyBB.buildChatRequest(topics, articles)),
    signal: AbortSignal.timeout(60000)
  });
  const bodyText = await response.text();
  if (response.status === 401 || response.status === 403) {
    throw new Error('Deepseek rejected the API key.');
  }
  if (!response.ok) throw new Error(`Deepseek request failed (${response.status}).`);
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error('Deepseek returned an unreadable response.');
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Deepseek returned no title.');
  return NoMyBB.parseModelResult(content, articles, topics);
}

async function rewriteBatch(apiKey, topics, batch) {
  try {
    return { done: await callDeepseek(apiKey, topics, batch), failures: [], authError: '', detail: '' };
  } catch (error) {
    const message = error?.message || 'Deepseek request failed.';
    const authError = /API key/i.test(message) ? message : '';
    if (authError || batch.length === 1) {
      return { done: [], failures: batch.map((article) => article.url), authError, detail: message };
    }
    const done = [];
    const failures = [];
    let detail = message;
    for (const article of batch) {
      try {
        done.push(...await callDeepseek(apiKey, topics, [article]));
      } catch (oneError) {
        const oneMessage = oneError?.message || 'Deepseek request failed.';
        detail = oneMessage;
        if (/API key/i.test(oneMessage)) {
          return { done, failures, authError: oneMessage, detail: oneMessage };
        }
        failures.push(article.url);
      }
    }
    return { done, failures, authError: '', detail };
  }
}

async function publish(port, topics, done) {
  if (!done.length) return;
  await rememberTitles(done, topics);
  for (const item of done) {
    notify(port, {
      type: 'TITLE_READY',
      url: item.url,
      originalTitle: item.originalTitle,
      replacementTitle: item.replacementTitle,
      summary: item.summary || '',
      ignore: item.ignore
    });
  }
}

async function report(port, progress) {
  const view = NoMyBB.formatProgress(progress);
  const snapshot = progressSnapshot(progress);
  notify(port, { type: 'STATUS', message: view.text, progress: snapshot });
  await setRunState(view.text, 'running', snapshot);
}

function readingActivity(count, total) {
  if (total === 1) return 'Reading the article';
  return `Reading ${count} article${count === 1 ? '' : 's'}`;
}

function askingActivity(count, total) {
  if (total === 1 || count === 1) return 'Asking Deepseek';
  return `Asking Deepseek about ${count} headlines`;
}

async function rewritePending(port, apiKey, topics, pending, progress, bodySelector) {
  const failures = [];
  let authError = '';
  let detail = '';

  for (let index = 0; index < pending.length; index += 4) {
    if (authError) break;
    const slice = pending.slice(index, index + 4);
    progress.reading = slice.length;
    progress.asking = 0;
    progress.activity = readingActivity(slice.length, progress.total);
    await report(port, progress);

    const prepared = await Promise.all(slice.map(async (article) => {
      let articleText = '';
      let problem = '';
      try {
        articleText = await fetchArticleText(article.url, bodySelector);
        if (!articleText) problem = 'Article page had no readable text.';
      } catch (error) {
        problem = error?.message || 'Article fetch failed.';
      }
      return { ...article, articleText, problem };
    }));

    progress.reading = 0;
    const readable = prepared.filter((article) => article.articleText);
    const unreadable = prepared.filter((article) => !article.articleText);
    if (unreadable.length) {
      failures.push(...unreadable.map((article) => article.url));
      progress.failed += unreadable.length;
      detail = unreadable[0].problem || detail;
    }
    if (!readable.length) {
      progress.activity = '';
      await report(port, progress);
      continue;
    }

    progress.asking = readable.length;
    progress.activity = askingActivity(readable.length, progress.total);
    await report(port, progress);
    const outcome = await rewriteBatch(apiKey, topics, readable);
    progress.asking = 0;
    if (outcome.authError) authError = outcome.authError;
    if (outcome.detail) detail = outcome.detail;
    failures.push(...outcome.failures);
    progress.finished += outcome.done.length;
    progress.failed += outcome.failures.length;
    progress.activity = '';
    await publish(port, topics, outcome.done);
    if (!authError) await report(port, progress);
  }
  return { failures, authError, detail };
}

async function finishWith(port, message, phase, progress) {
  const settled = progress ? { ...progress, activity: '', reading: 0, asking: 0 } : null;
  const snapshot = settled ? progressSnapshot(settled) : null;
  notify(port, { type: 'STATUS', message, final: true, progress: snapshot });
  await setRunState(message, phase, snapshot);
}

async function processPage(port, incoming, requireSummary, domain, pageUrl) {
  const rules = await readSiteRules();
  let rule = NoMyBB.ruleForHost(rules, domain);
  if (!rule && incoming[0]?.url) {
    try {
      rule = NoMyBB.ruleForHost(rules, new URL(incoming[0].url).hostname);
    } catch {
      rule = null;
    }
  }
  if (!rule) return;

  const settings = await readSettings();
  const articles = [];
  const seen = new Set();
  for (const article of incoming) {
    if (!article?.url || !article?.title) continue;
    if (settings.skipPartnerStories && NoMyBB.isPartnerStory(article.url, rule.domain)) continue;
    if (!NoMyBB.isArticleUrl(article.url, rule)) continue;
    const url = NoMyBB.canonicalArticleUrl(article.url, rule);
    const title = NoMyBB.normalizeTitle(article.title);
    if (!title || seen.has(url)) continue;
    seen.add(url);
    articles.push({ title, url });
  }
  if (!articles.length) return;

  await saveArticleList(articles, pageUrl);
  const stored = await api.storage.local.get('processedTitles');
  const cache = stored.processedTitles || {};
  const pending = [];

  for (const article of articles) {
    const hit = cache[article.url];
    const titleCached = hit
      && hit.originalTitle === article.title
      && hit.topicsSnapshot === settings.topicsToIgnore
      && hit.replacementTitle;
    if (titleCached) {
      notify(port, {
        type: 'TITLE_READY',
        url: article.url,
        originalTitle: hit.originalTitle,
        replacementTitle: hit.replacementTitle,
        summary: hit.summary || '',
        ignore: Boolean(hit.ignore)
      });
    }
    if (!titleCached || (requireSummary && !hit.summary)) pending.push(article);
  }

  if (!pending.length) {
    notify(port, { type: 'STATUS', message: '', final: true });
    await setRunState('', 'idle');
    return;
  }
  if (!settings.apiKey) {
    const message = 'NoMyBB: open the toolbar icon and save a Deepseek API key to clean these headlines.';
    notify(port, { type: 'STATUS', message, final: true });
    await setRunState(message, 'needs-key');
    return;
  }

  const progress = {
    total: articles.length,
    finished: articles.length - pending.length,
    failed: 0,
    reading: 0,
    asking: 0,
    activity: ''
  };
  const outcome = await rewritePending(port, settings.apiKey, settings.topicsToIgnore, pending, progress, rule.bodySelector);
  if (outcome.authError) {
    await finishWith(port, `NoMyBB: ${outcome.authError}`, 'error', progress);
    return;
  }
  if (outcome.failures.length) {
    const count = outcome.failures.length;
    const why = outcome.detail ? ` ${outcome.detail}` : '';
    const message = `NoMyBB: ${count} headline${count === 1 ? '' : 's'} could not be cleaned.${why} The original title was left in place.`;
    await finishWith(port, message, 'error', progress);
    return;
  }
  notify(port, { type: 'STATUS', message: '', final: true });
  await setRunState('', 'idle');
}

function syncSites() {
  const run = syncing.then(async () => {
    const rules = await readSiteRules();
    await NoMyBB.syncExtraContentScripts(rules);
  });
  syncing = run.then(() => undefined, () => undefined);
  return run;
}

api.runtime.onConnect.addListener((port) => {
  if (port.name !== 'nomybb') return;
  port.onMessage.addListener((message) => {
    if (message?.type !== 'PROCESS_PAGE') return;
    const articles = Array.isArray(message.articles) ? message.articles.slice(0, 80) : [];
    enqueue(() => processPage(
      port,
      articles,
      Boolean(message.requireSummary),
      message.domain || '',
      message.pageUrl || ''
    )).catch((error) => {
      const text = `NoMyBB: ${error?.message || 'something went wrong while cleaning headlines.'}`;
      notify(port, { type: 'STATUS', message: text });
      setRunState(text, 'error');
    });
  });
});

api.runtime.onMessage.addListener((message) => {
  if (message?.type !== 'SYNC_SITES') return undefined;
  return syncSites()
    .then(() => ({ ok: true }))
    .catch((error) => ({ ok: false, error: error?.message || 'Could not register the site.' }));
});

api.runtime.onInstalled.addListener(() => {
  syncSites().catch(() => {});
});

api.runtime.onStartup.addListener(() => {
  syncSites().catch(() => {});
});

syncSites().catch(() => {});
