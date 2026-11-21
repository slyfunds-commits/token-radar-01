'use strict';
/* Token Radar dashboard: renders window.RADAR with no network and no fetch. */
const R = window.RADAR;
const $ = (s) => document.querySelector(s);
const state = { tab: 'board', q: '', chain: '', cat: '', sort: 'rank', slug: null };

function usd(n) {
  if (n === null || n === undefined) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
  return '$' + Math.round(n);
}
function pct(n) {
  if (n === null || n === undefined) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
}
function ratio(n) {
  if (n === null || n === undefined) return '—';
  return n.toFixed(2) + '×';
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function chainsShort(chains) {
  if (!chains || chains.length === 0) return '—';
  if (chains.length <= 2) return esc(chains.join(', '));
  return esc(chains[0]) + ', ' + esc(chains[1]) + ' <span class="more">+' + (chains.length - 2) + ' more</span>';
}
function chainsFull(chains) {
  if (!chains || chains.length === 0) return '—';
  return esc(chains.join(', '));
}
function catName(c) { return c === null || c === undefined ? 'Uncategorised' : c; }

function showTab(t) {
  state.tab = t;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
  $('#tab-board').hidden = t !== 'board';
  $('#tab-live').hidden = t !== 'live';
  $('#tab-model').hidden = t !== 'model';
}

function boardRows() {
  let rows = R.rows.slice();
  const q = state.q.trim().toLowerCase();
  if (q) rows = rows.filter((r) => (r.name + ' ' + r.slug).toLowerCase().includes(q));
  if (state.chain) rows = rows.filter((r) => r.chains.includes(state.chain));
  if (state.cat) rows = rows.filter((r) => (r.category || 'Uncategorised') === state.cat);
  const key = state.sort;
  rows.sort((a, b) => {
    if (key === 'tvl') return b.tvl_usd - a.tvl_usd || a.rank - b.rank;
    if (key === 'implied') return b.implied_value_usd - a.implied_value_usd || a.rank - b.rank;
    if (key === 'growth') return (b.change_7d || 0) - (a.change_7d || 0) || a.rank - b.rank;
    return a.rank - b.rank;
  });
  return rows;
}

function renderBoard() {
  const rows = boardRows();
  $('#count').textContent = rows.length + ' of ' + R.rows.length + ' protocols shown. Ranks are the model’s claim: rank 1 is the most valuable pre-token protocol.';
  const tb = $('#board tbody');
  tb.innerHTML = rows.map((r) => {
    const g = r.change_7d;
    const cls = g === null ? '' : g >= 0 ? 'pos' : 'neg';
    const fb = r.fallback === 'category' ? '<span class="badge ok">category</span>' : r.fallback === 'family' ? '<span class="badge warn">family</span>' : '<span class="badge warn">global</span>';
    return '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td><td><b>' + esc(r.name) + '</b><br><span class="more">' + esc(r.slug) + '</span></td><td>' + esc(catName(r.category)) + '</td><td title="' + esc(r.chains.join(', ')) + '">' + chainsShort(r.chains) + '</td><td class="num">' + usd(r.tvl_usd) + '</td><td class="num ' + cls + '">' + pct(g) + '</td><td class="num">' + usd(r.implied_value_usd) + '</td><td class="num">' + r.category_multiple.toFixed(2) + '× (' + r.comparables + ') ' + fb + '</td></tr>';
  }).join('');
  tb.querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => renderDetail(tr.dataset.slug)));
}

function renderDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  const box = $('#detail');
  if (!r) { box.hidden = true; state.slug = null; return; }
  state.slug = slug;
  const recomputed = Math.max(1, Math.round(r.tvl_usd * r.category_multiple * r.growth_multiplier * r.maturity_multiplier * r.chain_multiplier));
  const match = recomputed === r.implied_value_usd;
  const steps = (r.farm_steps || []).map((s) => '<li>' + esc(s) + '</li>').join('');
  box.innerHTML = '<h2>' + esc(r.name) + ' <span class="more">rank ' + r.rank + ' · ' + esc(r.slug) + '</span></h2>' +
    '<p>' + esc(catName(r.category)) + ' · ' + chainsFull(r.chains) + ' · listed ' + (r.listed_at || 'unknown date') + (r.age_days === null ? '' : ' (' + r.age_days + ' days ago)') + '</p>' +
    '<div class="grid">' +
    '<div class="cell"><b>' + usd(r.tvl_usd) + '</b><span>TVL</span></div>' +
    '<div class="cell"><b>' + usd(r.implied_value_usd) + '</b><span>implied value</span></div>' +
    '<div class="cell"><b>' + r.category_multiple.toFixed(3) + '×</b><span>category multiple (' + r.comparables + ' comparables)</span></div>' +
    '<div class="cell"><b>' + pct(r.change_7d) + '</b><span>TVL change, 7 days</span></div>' +
    '<div class="cell"><b>' + r.growth_multiplier.toFixed(3) + '×</b><span>growth multiplier</span></div>' +
    '<div class="cell"><b>' + r.maturity_multiplier.toFixed(3) + '×</b><span>maturity multiplier</span></div>' +
    '<div class="cell"><b>' + r.chain_multiplier.toFixed(3) + '×</b><span>chain spread (' + r.chains.length + ' chains)</span></div>' +
    '<div class="cell"><b>' + (r.fallback === 'category' ? 'Category' : r.fallback === 'family' ? 'Family' : 'Global') + '</b><span>multiple fallback</span></div>' +
    '</div>' +
    '<h3>Recompute — the same figures, the same answer</h3>' +
    '<p class="recompute">' + usd(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(4) + ' × ' + r.growth_multiplier.toFixed(4) + ' × ' + r.maturity_multiplier.toFixed(4) + ' × ' + r.chain_multiplier.toFixed(4) + ' = ' + usd(recomputed) + '</p>' +
    '<p>' + (match ? 'The recomputed value matches the board’s implied value exactly.' : 'The recomputed value differs from the board’s implied value — the board’s figure is the model’s.') + '</p>' +
    '<h3>Farm plan</h3><ol>' + steps + '</ol>';
  box.hidden = false;
  box.scrollIntoView({ block: 'start' });
}

function renderLive() {
  const tb = $('#live tbody');
  tb.innerHTML = R.live.map((p, i) => '<tr><td class="num">' + (i + 1) + '</td><td><span class="sym">' + esc(p.symbol || '—') + '</span></td><td><b>' + esc(p.name) + '</b><br><span class="more">' + esc(p.slug) + '</span></td><td>' + esc(catName(p.category)) + '</td><td>' + chainsFull(p.chains) + '</td><td class="num">' + usd(p.tvl_usd) + '</td><td class="num">' + usd(p.mcap_usd) + '</td><td class="num">' + ratio(p.mcap_tvl_ratio) + '</td></tr>').join('');
}

function renderModel() {
  const tb = $('#model tbody');
  tb.innerHTML = R.comparables.map((c) => {
    const fb = c.fallback === 'category' ? '<span class="badge ok">category</span>' : c.fallback === 'family' ? '<span class="badge warn">family fallback</span>' : '<span class="badge warn">global fallback</span>';
    return '<tr><td>' + esc(c.category) + '</td><td>' + esc(c.family) + '</td><td class="num">' + c.comparables + '</td><td class="num">' + (c.median_ratio === null ? '—' : ratio(c.median_ratio)) + '</td><td class="num">' + (c.family_median === null ? '—' : ratio(c.family_median)) + '</td><td class="num"><b>' + ratio(c.multiple) + '</b></td><td>' + fb + '</td></tr>';
  }).join('');
}

function init() {
  $('#meta').innerHTML = 'Snapshot <b>' + esc(R.as_of) + '</b><br>Model <b>' + esc(R.model_version) + '</b> · ' + R.board_size + ' rows · ' + R.live_size + ' live tokens<br>Watchlist ' + R.watchlist_size + ' · floor ' + usd(R.floor_usd);
  $('#source').textContent = 'Source: ' + R.source + '. Snapshot as of ' + R.as_of + '; the board is scored from that snapshot alone.';
  const chains = new Set();
  const cats = new Set();
  R.rows.forEach((r) => { r.chains.forEach((c) => chains.add(c)); cats.add(catName(r.category)); });
  $('#f-chain').innerHTML = '<option value="">All chains</option>' + [...chains].sort().map((c) => '<option>' + esc(c) + '</option>').join('');
  $('#f-cat').innerHTML = '<option value="">All categories</option>' + [...cats].sort().map((c) => '<option>' + esc(c) + '</option>').join('');
  document.querySelectorAll('#tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  $('#q').addEventListener('input', (e) => { state.q = e.target.value; renderBoard(); });
  $('#f-chain').addEventListener('change', (e) => { state.chain = e.target.value; renderBoard(); });
  $('#f-cat').addEventListener('change', (e) => { state.cat = e.target.value; renderBoard(); });
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderBoard(); });
  const params = new URLSearchParams(location.search);
  const shot = params.get('shot');
  // Render the tables first: the detail panel sits below the 200-row board,
  // so its position is only final once the board is in the document.
  renderBoard();
  renderLive();
  renderModel();
  if (shot === 'live') { showTab('live'); }
  else if (shot === 'model') { showTab('model'); }
  else if (shot === 'filtered') {
    const chain = params.get('chain');
    if (chain) { state.chain = chain; $('#f-chain').value = chain; renderBoard(); }
  } else if (shot === 'detail') {
    const slug = params.get('slug') || (R.rows[0] && R.rows[0].slug);
    if (slug) renderDetail(slug);
  }
}
init();
