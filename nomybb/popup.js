const ADD = '__add__';

const apiKeyInput = document.querySelector('#api-key');
const topicsInput = document.querySelector('#topics');
const status = document.querySelector('#status');
const counts = document.querySelector('#counts');
const run = document.querySelector('#run');
const toggleKey = document.querySelector('#toggle-key');
const siteSelect = document.querySelector('#site-select');
const skipPartnerInput = document.querySelector('#skip-partner');
const cacheLimitInput = document.querySelector('#cache-limit');
const newDomainRow = document.querySelector('#new-domain-row');
const newDomainInput = document.querySelector('#new-domain');
const setupChoice = document.querySelector('#setup-choice');
const setupHint = document.querySelector('#setup-hint');
const automaticButton = document.querySelector('#setup-automatic');
const manualButton = document.querySelector('#setup-manual');
const analyseStatus = document.querySelector('#analyse-status');
const ruleFields = document.querySelector('#rule-fields');
const inspectButton = document.querySelector('#inspect-site');
const indexPathInput = document.querySelector('#index-path');
const indexTitleInput = document.querySelector('#index-title');
const patternInput = document.querySelector('#article-pattern');
const articleTitleInput = document.querySelector('#article-title');
const bodyInput = document.querySelector('#body-selector');
const summaryInput = document.querySelector('#summary-selector');
const resetButton = document.querySelector('#reset-site');
const removeButton = document.querySelector('#remove-site');
const progress = document.querySelector('#progress');
const progressTrack = document.querySelector('#progress-track');
const progressFill = document.querySelector('#progress-fill');

const storage = globalThis.chrome?.storage?.local || {
  async get(keys) {
    const data = JSON.parse(localStorage.getItem('nomybb-settings') || '{}');
    const names = Array.isArray(keys) ? keys : [keys];
    const out = {};
    for (const name of names) out[name] = data[name];
    return out;
  },
  async set(values) {
    const data = JSON.parse(localStorage.getItem('nomybb-settings') || '{}');
    Object.assign(data, values);
    localStorage.setItem('nomybb-settings', JSON.stringify(data));
  },
  async remove(key) {
    const data = JSON.parse(localStorage.getItem('nomybb-settings') || '{}');
    delete data[key];
    localStorage.setItem('nomybb-settings', JSON.stringify(data));
  }
};

let sites = [];
let addDraft = blankDraft();
let selected = ADD;
let addMode = 'domain';
let setupDomain = '';
let inspectGeneration = 0;

function blankDraft() {
  return {
    domain: '',
    indexPath: '/',
    indexTitleSelector: 'a[rel="bookmark"]',
    articlePathPattern: '',
    articleTitleSelector: 'h1',
    bodySelector: '.entry-content',
    summarySelector: '.entry-content'
  };
}

function setStatus(message, kind) {
  status.textContent = message;
  status.className = kind ? `status ${kind}` : 'status';
}

function setAnalyse(message, kind) {
  analyseStatus.textContent = message || '';
  analyseStatus.className = kind ? `hint ${kind}` : 'hint';
}

function enteredDomain() {
  return NoMyBB.normalizeDomain(newDomainInput.value);
}

function refreshSetup() {
  const adding = selected === ADD;
  const domain = adding ? enteredDomain() : '';
  if (adding && domain !== setupDomain) addMode = 'domain';
  if (!domain) setupDomain = '';
  newDomainRow.hidden = !adding;
  const choosing = adding && addMode === 'domain' && Boolean(domain);
  setupChoice.hidden = !choosing;
  setupHint.hidden = !choosing;
  ruleFields.hidden = adding && addMode !== 'fields';
  const custom = !adding && !NoMyBB.builtinSite(selected);
  inspectButton.hidden = !custom;
  resetButton.hidden = adding || !NoMyBB.builtinSite(selected);
  removeButton.hidden = adding;
  if (!adding || !domain) setAnalyse('');
}

function readForm() {
  return {
    domain: selected === ADD ? newDomainInput.value : selected,
    indexPath: indexPathInput.value,
    indexTitleSelector: indexTitleInput.value,
    articlePathPattern: patternInput.value,
    articleTitleSelector: articleTitleInput.value,
    bodySelector: bodyInput.value,
    summarySelector: summaryInput.value
  };
}

function rememberForm() {
  const data = readForm();
  if (selected === ADD) {
    addDraft = data;
    return;
  }
  const index = sites.findIndex((site) => site.domain === selected);
  if (index >= 0) sites[index] = { ...sites[index], ...data, domain: selected };
}

function writeForm(site) {
  const adding = selected === ADD;
  newDomainRow.hidden = !adding;
  newDomainInput.value = adding ? (site?.domain || '') : '';
  indexPathInput.value = site?.indexPath ?? '';
  indexTitleInput.value = site?.indexTitleSelector || '';
  patternInput.value = site?.articlePathPattern || '';
  articleTitleInput.value = site?.articleTitleSelector || '';
  bodyInput.value = site?.bodySelector || '';
  summaryInput.value = site?.summarySelector || '';
  refreshSetup();
}

function fillSelect() {
  const current = selected;
  siteSelect.replaceChildren();
  for (const site of sites) {
    const option = document.createElement('option');
    option.value = site.domain;
    option.textContent = site.domain;
    siteSelect.append(option);
  }
  const add = document.createElement('option');
  add.value = ADD;
  add.textContent = '...Add new';
  siteSelect.append(add);
  const available = sites.some((site) => site.domain === current) || current === ADD;
  selected = available ? current : (sites[0]?.domain || ADD);
  siteSelect.value = selected;
}

function showSelected() {
  writeForm(selected === ADD ? addDraft : sites.find((site) => site.domain === selected));
}

function renderRun(runState) {
  const snapshot = runState?.progress;
  const showBar = Boolean(snapshot?.total) && (runState.phase === 'running' || runState.phase === 'error');
  progress.hidden = !showBar;
  if (!showBar) {
    run.textContent = runState?.message || '';
    run.hidden = !run.textContent;
    return;
  }
  const view = NoMyBB.formatProgress(snapshot);
  progressFill.style.width = `${view.percent}%`;
  progressTrack.classList.toggle('busy', Boolean(view.activity) && runState.phase === 'running');
  progressTrack.setAttribute('aria-valuenow', String(view.percent));
  progressTrack.setAttribute('aria-label', view.text);
  run.hidden = false;
  run.textContent = runState.phase === 'error' ? (runState.message || view.text) : view.text;
}

async function refreshCounts() {
  const stored = await storage.get(['articleList', 'processedTitles', 'runState', 'cacheArticleLimit']);
  const listed = stored.articleList?.articles?.length || 0;
  const cleaned = Object.keys(stored.processedTitles || {}).length;
  const limit = NoMyBB.cacheArticleLimit(stored.cacheArticleLimit);
  counts.textContent = listed || cleaned
    ? `${listed} headline${listed === 1 ? '' : 's'} saved from listing pages. ${cleaned} of ${limit} cached article${limit === 1 ? '' : 's'} kept.`
    : `Nothing cached yet. Open a listing page after saving. Up to ${limit} articles are kept.`;
  renderRun(stored.runState);
}

function prepareSites() {
  rememberForm();
  const next = sites.map((site) => ({ ...site }));
  let focus = selected;
  if (selected === ADD && String(addDraft.domain || '').trim()) {
    if (addMode !== 'fields') return { error: 'Choose Automatic or Manual for this domain before saving.' };
    const domain = NoMyBB.normalizeDomain(addDraft.domain);
    if (!domain) return { error: 'Enter a domain like example.com.' };
    const draft = { ...addDraft, domain };
    const existing = next.findIndex((site) => site.domain === domain);
    if (existing >= 0) next[existing] = { ...next[existing], ...draft, domain };
    else next.push(draft);
    focus = domain;
  }
  const rules = [];
  for (const site of next) {
    const result = NoMyBB.normalizeSiteRule(site);
    if (result.error) return { error: result.error };
    if (rules.some((rule) => rule.domain === result.rule.domain)) {
      return { error: `${result.rule.domain} is listed twice.` };
    }
    rules.push(result.rule);
  }
  return { rules, focus };
}

function extraOrigins(rules) {
  const origins = [];
  for (const rule of rules) {
    if (NoMyBB.BUILTIN_DOMAINS.includes(rule.domain)) continue;
    origins.push(`https://${rule.domain}/*`, `https://www.${rule.domain}/*`);
  }
  return origins;
}

async function load() {
  const stored = await storage.get(['apiKey', 'topicsToIgnore', 'siteRules', 'skipPartnerStories', 'cacheArticleLimit']);
  apiKeyInput.value = stored.apiKey || '';
  topicsInput.value = stored.topicsToIgnore || '';
  skipPartnerInput.checked = Boolean(stored.skipPartnerStories);
  cacheLimitInput.value = String(NoMyBB.cacheArticleLimit(stored.cacheArticleLimit));
  sites = NoMyBB.resolveSiteRules(stored.siteRules);
  selected = sites[0]?.domain || ADD;
  fillSelect();
  showSelected();
  await refreshCounts();
}

siteSelect.addEventListener('change', () => {
  inspectGeneration += 1;
  setSetupBusy(false);
  rememberForm();
  selected = siteSelect.value;
  showSelected();
});

function setSetupBusy(busy, which) {
  automaticButton.disabled = busy;
  manualButton.disabled = busy;
  inspectButton.disabled = busy;
  automaticButton.textContent = busy && which === 'add' ? 'Inspecting…' : 'Automatic';
  inspectButton.textContent = busy && which === 'saved' ? 'Inspecting…' : 'Inspect';
}

async function allowSite(domain) {
  const origins = [`https://${domain}/*`, `https://www.${domain}/*`];
  if (!globalThis.chrome?.permissions?.request) return true;
  try {
    return await chrome.permissions.request({ origins });
  } catch {
    return false;
  }
}

async function inspectDomain(domain) {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) throw new Error('Enter a Deepseek API key first.');
  const granted = await allowSite(domain);
  if (!granted) throw new Error(`Allow ${domain} so NoMyBB can read its home page.`);
  const response = await fetch(`https://${domain}/`, {
    redirect: 'follow',
    credentials: 'omit',
    headers: { Accept: 'text/html' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Home page fetch failed (${response.status}).`);
  const markup = NoMyBB.homepageMarkup(await response.text());
  if (markup.length < 200) throw new Error('The home page had too little markup to inspect.');
  const completion = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(NoMyBB.buildAnalyseRequest(domain, markup)),
    signal: AbortSignal.timeout(60000)
  });
  const bodyText = await completion.text();
  if (completion.status === 401 || completion.status === 403) {
    throw new Error('Deepseek rejected the API key.');
  }
  if (!completion.ok) throw new Error(`Deepseek request failed (${completion.status}).`);
  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    throw new Error('Deepseek returned an unreadable response.');
  }
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Deepseek returned no rules.');
  const result = NoMyBB.parseAnalyseResult(content, domain);
  if (result.error) throw new Error(result.error);
  return result;
}

async function beginInspect(target) {
  const domain = target === 'add' ? enteredDomain() : selected;
  if (!domain || domain === ADD) return;
  if (target === 'add') newDomainInput.value = domain;
  const generation = ++inspectGeneration;
  setSetupBusy(true, target);
  const report = target === 'add' ? setAnalyse : setStatus;
  report(`Reading ${domain} and asking Deepseek for rules.`);
  try {
    const result = await inspectDomain(domain);
    if (generation !== inspectGeneration) return;
    const note = result.note ? ` ${result.note}` : '';
    if (target === 'add') {
      setupDomain = domain;
      addMode = 'fields';
      addDraft = { ...result.rule, domain };
      writeForm(addDraft);
      setAnalyse(`Suggested rules for ${domain}.${note} Review them, then save.`, 'ok');
    } else {
      const index = sites.findIndex((site) => site.domain === domain);
      if (index >= 0) sites[index] = { ...sites[index], ...result.rule, domain };
      writeForm(sites[index] || { ...result.rule, domain });
      setStatus(`Suggested rules for ${domain}.${note} Save to keep them.`, 'ok');
    }
  } catch (error) {
    if (generation !== inspectGeneration) return;
    report(error?.message || 'Could not inspect that site.', 'err');
  } finally {
    if (generation === inspectGeneration) setSetupBusy(false);
  }
}

newDomainInput.addEventListener('input', () => {
  refreshSetup();
});

newDomainInput.addEventListener('blur', () => {
  const domain = enteredDomain();
  if (domain) newDomainInput.value = domain;
  refreshSetup();
});

automaticButton.addEventListener('click', () => {
  beginInspect('add');
});

manualButton.addEventListener('click', () => {
  const domain = enteredDomain();
  if (!domain) return;
  newDomainInput.value = domain;
  setupDomain = domain;
  addMode = 'fields';
  addDraft = {
    domain,
    indexPath: '',
    indexTitleSelector: '',
    articlePathPattern: '',
    articleTitleSelector: '',
    bodySelector: '',
    summarySelector: ''
  };
  writeForm(addDraft);
  setAnalyse('');
});

inspectButton.addEventListener('click', () => {
  beginInspect('saved');
});

indexPathInput.addEventListener('blur', () => {
  const path = NoMyBB.normalizeIndexPath(indexPathInput.value);
  if (path) indexPathInput.value = path;
});

resetButton.addEventListener('click', () => {
  const builtin = NoMyBB.builtinSite(selected);
  if (!builtin) return;
  writeForm(builtin);
  rememberForm();
  setStatus(`Built-in rules for ${selected} are back in the form. Save to keep them.`, 'ok');
});

removeButton.addEventListener('click', () => {
  if (selected === ADD) return;
  const domain = selected;
  const confirmed = confirm(`Remove ${domain} from NoMyBB?`);
  if (!confirmed) return;
  sites = sites.filter((site) => site.domain !== domain);
  selected = sites[0]?.domain || ADD;
  fillSelect();
  showSelected();
  setStatus(`${domain} removed from the list. Save to keep this change.`, 'ok');
});

document.querySelector('#settings').addEventListener('submit', async (event) => {
  event.preventDefault();
  const cacheArticleLimit = NoMyBB.normalizeCacheLimit(cacheLimitInput.value);
  if (cacheArticleLimit === null) {
    setStatus(`Enter a whole number from ${NoMyBB.CACHE_ARTICLE_LIMIT_MIN} to ${NoMyBB.CACHE_ARTICLE_LIMIT_MAX}.`, 'err');
    return;
  }
  const prepared = prepareSites();
  if (prepared.error) {
    setStatus(prepared.error, 'err');
    return;
  }
  const origins = extraOrigins(prepared.rules);
  let granted = true;
  if (origins.length && globalThis.chrome?.permissions?.request) {
    try {
      granted = await chrome.permissions.request({ origins });
    } catch {
      granted = false;
    }
  }
  await storage.set({
    apiKey: apiKeyInput.value.trim(),
    topicsToIgnore: topicsInput.value.replace(/\r\n/g, '\n').trim(),
    skipPartnerStories: skipPartnerInput.checked,
    cacheArticleLimit,
    siteRules: prepared.rules
  });
  sites = prepared.rules;
  addDraft = blankDraft();
  selected = sites.some((site) => site.domain === prepared.focus) ? prepared.focus : (sites[0]?.domain || ADD);
  fillSelect();
  showSelected();
  try {
    await globalThis.chrome?.runtime?.sendMessage({ type: 'SYNC_SITES' });
  } catch {
    // The settings page can be opened outside the extension.
  }
  if (!granted) {
    setStatus('Saved. Chrome still needs permission before an added site can run. Save again to allow it.', 'err');
  } else {
    setStatus('Saved in this browser. Reload open news tabs so the rules apply.', 'ok');
  }
  await refreshCounts();
});

toggleKey.addEventListener('click', () => {
  const showing = apiKeyInput.type === 'text';
  apiKeyInput.type = showing ? 'password' : 'text';
  toggleKey.textContent = showing ? 'Show' : 'Hide';
});

document.querySelector('#clear-cache').addEventListener('click', async () => {
  const confirmed = confirm('Clear cached titles, summaries, and follow-up questions? Titles and summaries will be requested again on the next visit.');
  if (!confirmed) return;
  await storage.remove('processedTitles');
  setStatus('Cached titles and summaries cleared. Reload a news page to clean them again.', 'ok');
  await refreshCounts();
});

globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
  if (area !== 'local') return;
  if (!changes.processedTitles && !changes.articleList && !changes.runState) return;
  refreshCounts().catch(() => setStatus('Could not read local storage.', 'err'));
});

load().catch(() => setStatus('Could not read local storage.', 'err'));
