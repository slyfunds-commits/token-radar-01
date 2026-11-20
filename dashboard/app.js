(() => {
  "use strict";

  const board = window.TOKEN_RADAR_BOARD;
  const liveTokens = window.TOKEN_RADAR_LIVE ?? [];
  const comparables = window.TOKEN_RADAR_COMPARABLES ?? [];
  const $ = (selector) => document.querySelector(selector);
  const categoriesFor = new Map();
  const chainNames = new Set();
  const floor = 50_000_000;
  const number = new Intl.NumberFormat("en-US");
  const usd = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
  let activeTab = "prelaunch";

  if (!board || !Array.isArray(board.rows)) {
    document.body.innerHTML = "<main><h1>Board data unavailable</h1><p>Reload the page with dashboard/data.js present.</p></main>";
    return;
  }

  function categoryOf(row) {
    const match = row.farm_steps?.[3]?.match(/core (.+) action twice/);
    return match?.[1] ?? "Uncategorized";
  }

  function baselineValue(row) {
    return Math.round(
      row.tvl_usd *
        row.category_multiple *
        row.growth_factor *
        row.maturity_factor *
        row.chain_multiplier,
    );
  }

  const rows = board.rows.map((row) => {
    const category = row.category ?? categoryOf(row);
    const baseline = baselineValue(row);
    const item = {
      ...row,
      category,
      scope: row.tvl_usd >= floor ? "watchlist" : "early",
      recomputed_value_usd: baseline,
    };
    for (const chain of item.chains ?? []) chainNames.add(chain);
    categoriesFor.set(category, (categoriesFor.get(category) ?? []).concat(item));
    return item;
  });
  const liveRows = liveTokens.map((row, index) => {
    const item = { ...row, rank: index + 1, scope: "live" };
    for (const chain of item.chains ?? []) chainNames.add(chain);
    return item;
  });
  const integrityCount = rows.filter(
    (row) => row.recomputed_value_usd === row.implied_value_usd,
  ).length;

  $("#as-of").textContent = `AS OF ${board.as_of}`;
  $("#footer-date").textContent = board.as_of;
  $("#integrity-status").textContent =
    integrityCount === rows.length ? `${integrityCount} / ${rows.length} VALUES RECONCILE` : "MODEL CHECK FAILED";
  $("#integrity-detail").textContent =
    "Page-side calculation checked against every ranked row.";
  $("#prelaunch-count").textContent = rows.length;
  $("#live-count").textContent = liveRows.length;
  $("#tab-note").textContent =
    "The snapshot records no token for these candidates; that record is not proof no token exists. Watchlist entries meet the $50M floor; early entries are below it.";

  function esc(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[character]);
  }

  function compactMoney(value) {
    const abs = Math.abs(value);
    if (abs >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
    if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return usd.format(value);
  }

  function openDetail(slug) {
    const row = rows.find((item) => item.slug === slug);
    if (!row) {
      const live = liveRows.find((item) => item.slug === slug);
      if (!live) return;
      $("#detail-content").innerHTML = `
        <div class="detail-kicker">LIVE-TOKEN COMPARABLE · ${esc(live.category ?? "Uncategorized")}</div>
        <h2 class="detail-title" id="detail-title">${esc(live.name)}</h2>
        <div class="detail-slug">${esc(live.slug)} · ${(live.chains ?? []).map(esc).join(", ") || "Chain not listed"}</div>
        <div class="detail-value">${Number(live.mcap_to_tvl).toFixed(4)}×</div>
        <div class="detail-sub">Market capitalization / TVL · snapshot peer, not a pre-token candidate</div>
        <div class="model-card"><h3>Comparable observation</h3><div class="factor-grid">
          <div class="factor"><span>TVL</span><strong>${usd.format(live.tvl_usd)}</strong></div>
          <div class="factor"><span>Market capitalization</span><strong>${usd.format(live.mcap_usd)}</strong></div>
          <div class="factor"><span>Category</span><strong>${esc(live.category ?? "Uncategorized")}</strong></div>
          <div class="factor"><span>Peer rank by market cap / TVL</span><strong>#${live.rank}</strong></div>
        </div></div>
        <p class="precision-note">This protocol records a live token in the snapshot and is shown only as a valuation comparable. It is not included in the no-token board or farm-plan ranking.</p>`;
      $("#detail-dialog").showModal();
      return;
    }
    const chainFactor = Number(row.chain_multiplier).toFixed(6);
    $("#detail-content").innerHTML = `
      <div class="detail-kicker">RANK ${String(row.rank).padStart(3, "0")} · ${esc(row.scope === "watchlist" ? "WATCHLIST" : "EARLY RADAR")}</div>
      <h2 class="detail-title" id="detail-title">${esc(row.name)}</h2>
      <div class="detail-slug">${esc(row.slug)} · ${esc(row.category)} · ${(row.chains ?? []).map(esc).join(", ") || "Chain not listed"}</div>
      <div class="detail-value">${usd.format(row.recomputed_value_usd)}</div>
      <div class="detail-sub">Implied token value · model estimate, not a forecast</div>
      <div class="model-card">
        <h3>Value, recomputed from board components</h3>
        <div class="factor-grid">
          <div class="factor"><span>TVL</span><strong>${usd.format(row.tvl_usd)}</strong></div>
          <div class="factor"><span>Category multiple</span><strong>${Number(row.category_multiple).toFixed(6)}×</strong></div>
          <div class="factor"><span>Growth factor</span><strong>${Number(row.growth_factor).toFixed(6)}×</strong></div>
          <div class="factor"><span>Maturity factor</span><strong>${Number(row.maturity_factor).toFixed(6)}×</strong></div>
          <div class="factor"><span>Chain multiplier</span><strong>${chainFactor}×</strong></div>
          <div class="factor"><span>Comparable peers in category</span><strong>${number.format(row.category_comparable_count ?? 0)}</strong></div>
        </div>
        <p class="recompute">Recomputed from full-precision serialized components: ${usd.format(baselineValue(row))} ${row.recomputed_value_usd === row.implied_value_usd ? "✓ exact board match" : "× mismatch"}</p>
        <p class="precision-note">The category median uses ${number.format(row.category_comparable_count ?? 0)} live-token comparables and is shrunk toward the ${board.model.global_median_mcap_to_tvl.toFixed(3)}× global prior. No-token status means DefiLlama records no token in this snapshot; it is not proof no token exists.</p>
      </div>
      <div class="factor-grid">
        <div class="factor"><span>TVL</span><strong>${compactMoney(row.tvl_usd)}</strong></div>
        <div class="factor"><span>Suggested weekly capital</span><strong>${usd.format(row.capital_usd)}</strong></div>
        <div class="factor"><span>Category peer count</span><strong>${number.format(row.category_comparable_count ?? 0)}</strong></div>
        <div class="factor"><span>Chains</span><strong>${(row.chains ?? []).map(esc).join(", ") || "Not listed"}</strong></div>
      </div>
      <section class="farm-plan"><h3>Seven-step farm plan</h3><ol>${row.farm_steps.map((step) => `<li>${esc(step)}</li>`).join("")}</ol></section>`;
    $("#detail-dialog").showModal();
  }

  function showSpotlight() {
    $("#spotlight").innerHTML = rows.slice(0, 10).map((row, index) => `
      <button class="spot-card" data-open="${esc(row.slug)}" aria-label="Open rank ${row.rank}, ${esc(row.name)}">
        <span class="spot-top"><span class="spot-rank">#${String(index + 1).padStart(2, "0")}</span><span>${esc(row.category)}</span></span>
        <span class="spot-name">${esc(row.name)}</span>
        <span class="spot-value">${compactMoney(row.implied_value_usd)}</span>
        <span class="spot-caption">implied value · ${compactMoney(row.tvl_usd)} TVL</span>
      </button>`).join("");
  }

  function showComparables() {
    $("#comparables-rows").innerHTML = comparables.map((record) => `
      <tr><td>${esc(record.category)}</td>
      <td class="align-right money">${record.median_mcap_to_tvl === null ? "—" : `${Number(record.median_mcap_to_tvl).toFixed(6)}×`}</td>
      <td class="align-right money">${Number(record.shrunk_category_multiple).toFixed(6)}×</td>
      <td class="align-right count-unavailable">${number.format(record.live_token_comparable_count)}</td></tr>`).join("");
  }

  function sortRows(list, isLive) {
    const mode = $("#sort").value;
    const sorted = [...list];
    const byName = (a, b) => a.name.localeCompare(b.name) || a.rank - b.rank;
    const metric = (row) => isLive ? row.mcap_usd : row.implied_value_usd;
    if (mode === "value-desc") sorted.sort((a, b) => metric(b) - metric(a) || byName(a, b));
    else if (mode === "value-asc") sorted.sort((a, b) => metric(a) - metric(b) || byName(a, b));
    else if (mode === "tvl-desc") sorted.sort((a, b) => b.tvl_usd - a.tvl_usd || byName(a, b));
    else if (mode === "tvl-asc") sorted.sort((a, b) => a.tvl_usd - b.tvl_usd || byName(a, b));
    else if (mode === "name") sorted.sort(byName);
    else sorted.sort((a, b) => a.rank - b.rank);
    return sorted;
  }

  function renderRows() {
    const query = $("#search").value.trim().toLowerCase();
    const category = $("#category-filter").value;
    const chain = $("#chain-filter").value;
    const isLive = activeTab === "live";
    if (isLive) $("#scope-filter").value = "";
    const scope = $("#scope-filter").value;
    const source = isLive ? liveRows : rows;
    $("#sort").querySelector('[value="rank"]').textContent = isLive
      ? "Sort: mcap / TVL rank"
      : "Sort: board rank";
    $("#sort").querySelector('[value="value-desc"]').textContent = isLive
      ? "Market cap: high to low"
      : "Implied value: high to low";
    $("#sort").querySelector('[value="value-asc"]').textContent = isLive
      ? "Market cap: low to high"
      : "Implied value: low to high";
    $("#scope-filter").disabled = isLive;
    $("#scope-filter").querySelector('[value=""]').textContent = isLive
      ? "Scope: pre-token only"
      : "All scopes";
    $("#tvl-heading").textContent = "TVL";
    $("#multiple-heading").textContent = isLive ? "Market cap / TVL" : "Category multiple";
    $("#value-heading").textContent = isLive ? "Market cap" : "Implied value";
    const filtered = sortRows(source.filter((row) =>
      (!query || `${row.name} ${row.slug} ${row.category}`.toLowerCase().includes(query)) &&
      (!category || (row.category ?? "Uncategorized") === category) &&
      (!chain || (row.chains ?? []).includes(chain)) &&
      (isLive ? !scope : (!scope || row.scope === scope)),
    ), isLive);
    $("#visible-count").textContent = filtered.length;
    $("#board-rows").innerHTML = filtered.map((row) => `
      <tr>
        <td class="rank-cell">${String(row.rank).padStart(3, "0")}</td>
        <td><button class="protocol-button" data-open="${esc(row.slug)}">${esc(row.name)}</button></td>
        <td class="category-cell">${esc(row.category ?? "Uncategorized")}</td>
        <td class="money">${compactMoney(row.tvl_usd)}</td>
        <td>${isLive ? `${Number(row.mcap_to_tvl).toFixed(3)}×` : `${Number(row.category_multiple).toFixed(3)}×`}</td>
        <td class="align-right money value-cell">${compactMoney(isLive ? row.mcap_usd : row.implied_value_usd)}</td>
        <td><span class="scope-pill ${row.scope === "early" ? "early" : ""}">${isLive ? "Live token" : (row.scope === "watchlist" ? "Watchlist" : "Early")}</span></td>
        <td><button class="detail-link" data-open="${esc(row.slug)}" aria-label="View ${esc(row.name)} details">↗</button></td>
      </tr>`).join("");
    $("#empty-state").hidden = filtered.length !== 0;
    $("#empty-state").textContent = isLive
      ? "No live-token comparables match these filters."
      : "No protocols match these filters. Try clearing one or more.";
  }

  [...new Set([...rows, ...liveRows].map((row) => row.category ?? "Uncategorized"))]
    .sort((a, b) => a.localeCompare(b))
    .forEach((category) => {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      $("#category-filter").append(option);
    });
  [...chainNames].sort((a, b) => a.localeCompare(b)).forEach((chain) => {
    const option = document.createElement("option");
    option.value = chain;
    option.textContent = chain;
    $("#chain-filter").append(option);
  });

  $("#spotlight").addEventListener("click", (event) => {
    const target = event.target.closest("[data-open]");
    if (target) openDetail(target.dataset.open);
  });
  $("#board-rows").addEventListener("click", (event) => {
    const target = event.target.closest("[data-open]");
    if (target) openDetail(target.dataset.open);
  });
  $("#dialog-close").addEventListener("click", () => $("#detail-dialog").close());
  $("#detail-dialog").addEventListener("click", (event) => {
    if (event.target === $("#detail-dialog")) $("#detail-dialog").close();
  });
  $("#prelaunch-tab").addEventListener("click", () => {
    activeTab = "prelaunch";
    $("#prelaunch-tab").classList.add("active");
    $("#live-tab").classList.remove("active");
    $("#prelaunch-tab").setAttribute("aria-selected", "true");
    $("#live-tab").setAttribute("aria-selected", "false");
    $("#tab-note").textContent =
      "The snapshot records no token for these candidates; that record is not proof no token exists. Watchlist entries meet the $50M floor; early entries are below it.";
    renderRows();
  });
  $("#live-tab").addEventListener("click", () => {
    activeTab = "live";
    $("#live-tab").classList.add("active");
    $("#prelaunch-tab").classList.remove("active");
    $("#live-tab").setAttribute("aria-selected", "true");
    $("#prelaunch-tab").setAttribute("aria-selected", "false");
    $("#tab-note").textContent =
      "Search and filter live-token peers from the same sealed snapshot. These rows ground category multiples; they are not ranked as pre-launch candidates.";
    renderRows();
  });
  ["search", "category-filter", "chain-filter", "scope-filter", "sort"]
    .forEach((id) => $(`#${id}`).addEventListener(id === "search" ? "input" : "change", renderRows));

  showSpotlight();
  showComparables();
  renderRows();
})();
