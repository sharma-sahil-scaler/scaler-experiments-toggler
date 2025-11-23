const state = {
  experiments: new Map(),
  variants: new Map(),
  flagIds: new Map(),
  tab: null
};

const CONFIG = {
  API_URL: 'https://abex.scaler.com/api/v1',
  AUTH: btoa('produser:9VHAG!34H'),
  COOKIE: 'experiments'
};

const dom = {
  search: document.getElementById('searchExperiments'),
  list: document.getElementById('experimentsList'),
  save: document.getElementById('saveChanges'),
  refresh: document.getElementById('refreshPage'),
  domain: document.getElementById('currentDomain'),
  count: document.getElementById('activeCount'),
  toast: document.getElementById('toast')
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;

  try {
    dom.domain.textContent = new URL(tab.url).hostname;
  } catch {
    dom.domain.textContent = 'Unknown';
  }

  const stored = await chrome.storage.local.get(['variants', 'flagIds']);
  if (stored.variants) {
    state.variants = new Map(Object.entries(stored.variants));
  }
  if (stored.flagIds) {
    state.flagIds = new Map(Object.entries(stored.flagIds));
  }

  dom.search.addEventListener('input', render);
  dom.save.addEventListener('click', save);
  dom.refresh.addEventListener('click', refresh);

  await load();
}

async function getExperimentsFromContentScript(tabId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'getExperiments' });
      if (response) return response;
    } catch {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['scripts/content.js']
      });
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }
  return null;
}

async function load() {
  try {
    state.experiments.clear();

    const response = await getExperimentsFromContentScript(state.tab.id);

    if (response?.experiments?.length) {
      response.experiments.forEach(exp => {
        state.experiments.set(exp.key, exp.value);
      });
    }

    if (!state.experiments.size) {
      dom.list.innerHTML = `
        <div class="empty-state">
          <p>No experiments found</p>
          <p style="font-size:11px">Make sure you're on a page with data-variant-key elements</p>
        </div>`;
      dom.save.disabled = true;
      return;
    }

    render();
    updateCount();
    await fetchVariants();
  } catch (err) {
    dom.list.innerHTML = `
      <div class="empty-state">
        <p>Failed to load experiments</p>
        <p style="font-size:11px">Try refreshing the page and reopening the extension</p>
      </div>`;
    dom.save.disabled = true;
  }
}

async function fetchVariants() {
  if (state.experiments.size === 0) return;

  try {
    const res = await fetch(`${CONFIG.API_URL}/flags`, {
      headers: {
        'Authorization': `Basic ${CONFIG.AUTH}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const flags = await res.json();
    const flagMap = new Map(flags.map(f => [f.key, f.id]));
    const keys = [...state.experiments.keys()];

    await Promise.all(keys.map(async key => {
      const flagId = flagMap.get(key);
      if (!flagId) return;

      state.flagIds.set(key, flagId);

      try {
        const detailRes = await fetch(`${CONFIG.API_URL}/flags/${flagId}`, {
          headers: {
            'Authorization': `Basic ${CONFIG.AUTH}`,
            'Content-Type': 'application/json'
          }
        });

        if (detailRes.ok) {
          const flag = await detailRes.json();
          if (flag.variants?.length) {
            const variantData = flag.variants.map(v => {
              let percentage = null;
              if (flag.segments?.length) {
                const lastSegment = flag.segments[flag.segments.length - 1];
                if (lastSegment.distributions) {
                  const dist = lastSegment.distributions.find(d => d.variantKey === v.key);
                  if (dist) percentage = dist.percent;
                }
              }
              return { key: v.key, percentage };
            });
            state.variants.set(key, variantData);
          }
        }
      } catch {}
    }));

    await chrome.storage.local.set({
      variants: Object.fromEntries(state.variants),
      flagIds: Object.fromEntries(state.flagIds)
    });

    render();
  } catch (err) {
    console.error('Failed to fetch variants:', err);
  }
}

function render() {
  if (state.experiments.size === 0) {
    dom.list.innerHTML = `
      <div class="empty-state">
        <p>No experiments found</p>
        <p style="font-size:11px">Make sure you're on a page with experiment cookies</p>
      </div>`;
    dom.save.disabled = true;
    return;
  }

  const search = dom.search.value.toLowerCase();
  const sorted = [...state.experiments.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  let html = '';
  let count = 0;

  for (const [key, value] of sorted) {
    if (search && !key.toLowerCase().includes(search) && !value.toLowerCase().includes(search)) {
      continue;
    }
    count++;

    const variants = state.variants.get(key) || [];
    const flagId = state.flagIds.get(key);
    const name = formatName(key);

    html += `
      <div class="experiment-card active" data-key="${esc(key)}">
        <div class="experiment-header">
          <div class="experiment-name" title="${esc(key)}">${esc(name)}</div>
          <div class="experiment-meta">
            <span class="experiment-current">${esc(value)}</span>
            ${flagId ? `<a href="https://abex.scaler.com/#/flags/${flagId}" target="_blank" class="experiment-link" title="View in Flagr">↗</a>` : ''}
          </div>
        </div>
        ${variants.length ? `
          <div class="variants-section">
            <div class="variants-label">Select Variant</div>
            <div class="variants-grid">
              ${variants.map(v => `
                <button class="variant-chip ${v.key === value ? 'selected' : ''}"
                        data-key="${esc(key)}"
                        data-variant="${esc(v.key)}">
                  ${esc(v.key)}${v.percentage !== null ? ` <span class="variant-percent">${v.percentage}%</span>` : ''}
                </button>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>`;
  }

  if (count === 0) {
    html = '<div class="empty-state"><p>No matching experiments</p></div>';
  }

  dom.list.innerHTML = html;
  dom.save.disabled = false;

  dom.list.querySelectorAll('.variant-chip').forEach(el => {
    el.addEventListener('click', handleVariant);
  });
}

function handleVariant(e) {
  const key = e.target.dataset.key;
  const variant = e.target.dataset.variant;

  state.experiments.set(key, variant);

  const card = e.target.closest('.experiment-card');
  if (card) {
    card.querySelector('.experiment-current').textContent = variant;
    card.querySelectorAll('.variant-chip').forEach(chip => {
      chip.classList.toggle('selected', chip.dataset.variant === variant);
    });
  }
}

async function save() {
  const parts = [];
  for (const [key, val] of state.experiments) {
    parts.push(`${key}:${val}`);
  }

  const cookieValue = encodeURIComponent(parts.join(';'));

  try {
    const res = await chrome.runtime.sendMessage({
      action: 'setCookie',
      url: state.tab.url,
      name: CONFIG.COOKIE,
      value: cookieValue
    });

    if (res.error) {
      toast(res.error, 'error');
      return;
    }

    toast(`Saved ${state.experiments.size} experiments`, 'success');

    setTimeout(() => {
      chrome.tabs.reload(state.tab.id);
      window.close();
    }, 500);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function refresh() {
  chrome.tabs.reload(state.tab.id);
  window.close();
}

function updateCount() {
  dom.count.textContent = `${state.experiments.size} active`;
}

function formatName(key) {
  return key
    .replace(/^growth-tech_/, '')
    .replace(/^academy_/, '')
    .replace(/[_-]/g, ' ')
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function toast(msg, type = '') {
  dom.toast.textContent = msg;
  dom.toast.className = `toast show ${type}`;
  setTimeout(() => dom.toast.className = 'toast', 3000);
}

function esc(str) {
  const el = document.createElement('div');
  el.textContent = str;
  return el.innerHTML;
}
