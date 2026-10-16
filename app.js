// Bell Studio dashboard — renders from BellStore and edits it through the inspector.
// Hierarchy: department → channel (typed) → work → episode/clip.
(function () {
  const store = window.BellStore;
  const $ = (id) => document.getElementById(id);
  const nav = $("nav"), main = $("main"), foot = $("foot"), inspector = $("inspector"), scrim = $("scrim"), toast = $("toast");

  // ---------- language ----------
  let lang = "en";
  try { lang = localStorage.getItem("bellstudio:lang") || ((navigator.language || "").startsWith("th") ? "th" : "en"); } catch { /* ignore */ }
  if (!window.BELL_I18N[lang]) lang = "en";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // L() is the plain string (use inside attributes); t() fills {vars} (escaped) and returns trusted HTML
  const L = (key) => window.BELL_I18N[lang][key] ?? window.BELL_I18N.en[key] ?? key;
  const t = (key, vars = {}) => {
    const s = L(key);
    return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => esc(vars[k] ?? "")) : s;
  };
  const n = (count, unit) => {
    const [one, many] = L(`n_${unit}`);
    return `${count} ${count === 1 ? one : many}`;
  };
  function setLang(next) {
    lang = next;
    try { localStorage.setItem("bellstudio:lang", next); } catch { /* ignore */ }
    document.documentElement.lang = next;
    render();
  }
  document.documentElement.lang = lang;

  // ---------- model: what each channel type asks for ----------
  const STAGES = ["idea", "script", "producing", "editing", "published"];
  const IN_PROGRESS = ["script", "producing", "editing"];
  const stLabel = (id) => L(`st_${id}`);

  const TYPES = {
    affiliate: { noun: "clip", fields: ["category"], lists: [], rules: false },
    series: { noun: "ep", fields: ["genre", "epsPlanned", "epLength", "style", "engine"], lists: ["characters", "locations"], rules: true },
    mv: { noun: "video", fields: ["genre", "lyrics", "epLength", "style", "engine"], lists: ["characters"], rules: false },
    story: { noun: "ep", fields: ["narrator", "epsPlanned", "epLength", "style", "script"], lists: ["characters"], rules: false },
    live: { noun: "session", fields: ["when", "duration", "products", "runsheet"], lists: [], rules: false }
  };
  const TYPE_IDS = Object.keys(TYPES);
  const FIELD_KIND = { epsPlanned: "number", lyrics: "link", script: "link", runsheet: "link", products: "textarea", when: "datetime-local" };
  const defaultType = (deptId) => (deptId === "shopee" ? "affiliate" : "series");
  const ROLES = ["main", "support", "villain", "other"];

  // ---------- data helpers ----------
  const S = () => store.get();
  const dept = (id) => S().departments.find((d) => d.id === id);
  const channel = (id) => S().channels.find((c) => c.id === id);
  const work = (id) => S().works.find((w) => w.id === id);
  const episode = (id) => S().episodes.find((e) => e.id === id);
  const worksOf = (chId) => S().works.filter((w) => w.channel === chId);
  const epsOf = (wId) => S().episodes.filter((e) => e.work === wId).sort((a, b) => a.n - b.n);
  const typeOfChannel = (chId) => TYPES[channel(chId)?.type] || TYPES.series;
  const typeOfWork = (w) => typeOfChannel(w.channel);
  const deptOfWork = (w) => channel(w.channel)?.dept;
  const epCountIn = (chIds, pred) => S().episodes.filter((e) => chIds.includes(work(e.work)?.channel) && pred(e)).length;
  const MONTHS = () => L("months");
  const fmtDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    return m ? `${+m[3]} ${MONTHS()[+m[2] - 1]} ${m[1]}` : "";
  };
  const slug = (name) => {
    const base = String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "item";
    return `${base}-${store.rid()}`;
  };
  const pathOf = (w) => {
    const c = channel(w.channel), d = c && dept(c.dept);
    return [d?.name, c?.name, w.title].filter(Boolean).join(" › ");
  };
  const epName = (T, e) => `${L("ep_" + T.noun)} ${e.n}${e.title ? " · " + e.title : ""}`;
  const progress = (w) => {
    const eps = epsOf(w.id);
    const pub = eps.filter((e) => e.stage === "published").length;
    return { eps, pub, total: Math.max(+w.props?.epsPlanned || 0, eps.length) };
  };
  const platformShown = (c, d) => (c.platform && c.platform !== d?.name ? c.platform : "");

  // Google Drive share link → direct thumbnail; any other https image URL passes through.
  function imageSrc(link) {
    const s = String(link || "").trim();
    if (!s) return "";
    const m = s.match(/\/file\/d\/([\w-]{15,})/) || s.match(/[?&]id=([\w-]{15,})/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
    return /^https:\/\//i.test(s) ? s : "";
  }
  const safeLink = (s) => (/^https?:\/\//i.test(String(s || "").trim()) ? String(s).trim() : "");

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8"/>',
    menu: '<path d="M4 8h16M4 16h16"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>'
  };
  const icon = (name, cls = "icon") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]}</svg>`;

  let toastTimer;
  function say(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2200);
  }

  // ---------- routing ----------
  function route() {
    const [view, id] = location.hash.replace(/^#\/?/, "").split("/");
    if (view === "board") return { view: "board" };
    if (view === "dept" && dept(id)) return { view: "dept", id };
    if (view === "channel" && channel(id)) return { view: "channel", id };
    if ((view === "work" || view === "product") && work(id)) return { view: "work", id };
    return { view: "next" };
  }
  const go = (hash) => { if (location.hash !== hash) location.hash = hash; else render(); };

  // Platform logo for the four known departments (masked SVG painted in the brand colour); a colour dot for any other.
  const BRAND_ICONS = ["facebook", "youtube", "tiktok", "shopee"];
  const deptIcon = (id) => BRAND_ICONS.includes(id)
    ? `<span class="brand-icon bi-${esc(id)}" aria-hidden="true"></span>`
    : `<span class="dot" style="--c: var(--d-${esc(id)}, var(--ink-3))" aria-hidden="true"></span>`;

  // ---------- floating bar ----------
  function renderNav(r) {
    const cur = (cond) => (cond ? ' aria-current="page"' : "");
    const inDept = ["dept", "channel", "work"].includes(r.view);
    const deptMenu = S().departments.map((d) => `
      <div class="menu-group" style="--c: var(--d-${esc(d.id)})">
        <a class="menu-link" href="#/dept/${esc(d.id)}">${deptIcon(d.id)}${esc(d.name)}<span class="muted">${esc(d.head.name)}</span></a>
        ${S().channels.filter((c) => c.dept === d.id).map((c) => `<a class="menu-link sub" href="#/channel/${esc(c.id)}">${esc(c.name)}</a>`).join("")}
      </div>`).join("");

    // The page you are on decides what the forms start with.
    const ctx = (() => {
      if (r.view === "dept") return { dept: r.id };
      if (r.view === "channel") return { dept: channel(r.id).dept, channel: r.id };
      if (r.view === "work") { const w = work(r.id); return { dept: deptOfWork(w), channel: w.channel, work: r.id }; }
      return {};
    })();
    const ctxItems = [];
    if (ctx.work) {
      const w = work(ctx.work), T = typeOfWork(w);
      ctxItems.push(`<button class="menu-link" type="button" data-new-ep="${esc(w.id)}">${icon("plus")}${L("newEp_" + T.noun)}</button>`);
      if (T.lists.includes("characters")) ctxItems.push(`<button class="menu-link" type="button" data-new-char="${esc(w.id)}">${icon("plus")}${L("newChar")}</button>`);
      if (T.lists.includes("locations")) ctxItems.push(`<button class="menu-link" type="button" data-new-loc="${esc(w.id)}">${icon("plus")}${L("newLoc")}</button>`);
    }
    const generic = [
      S().channels.length ? `<button class="menu-link" type="button" data-new-work="${esc(ctx.channel || "")}" data-dept="${esc(ctx.dept || "")}">${icon("plus")}${L("newWork")}</button>` : "",
      `<button class="menu-link" type="button" data-new-channel="" data-dept="${esc(ctx.dept || "")}">${icon("plus")}${L("newChannel")}</button>`
    ].join("");
    const newMenu = (ctxItems.length ? `<div class="menu-group">${ctxItems.join("")}</div>` : "") + `<div class="menu-group">${generic}</div>`;

    nav.innerHTML = `
      <nav class="pillbar" aria-label="Main">
        <a class="brand" href="#/next"><span class="logo-mark" aria-hidden="true"></span><span>${esc(S().company.name)}</span></a>
        <div class="nav-links" id="nav-links">
          <a class="nav-link" href="#/next"${cur(r.view === "next")}>${t("upNext")}</a>
          <a class="nav-link" href="#/board"${cur(r.view === "board")}>${t("board")}</a>
          <div style="position:relative">
            <button class="nav-link" type="button" data-pop="depts" aria-expanded="false" aria-controls="pop-depts"${inDept ? ' aria-current="page"' : ""}>${t("departments")}${icon("down")}</button>
            <div class="popover" id="pop-depts" hidden>${deptMenu}</div>
          </div>
        </div>
        <div class="nav-right">
          <div class="lang" role="group" aria-label="${L("langLabel")}">
            <button type="button" data-lang="th" aria-pressed="${lang === "th"}">TH</button>
            <button type="button" data-lang="en" aria-pressed="${lang === "en"}">EN</button>
          </div>
          <div style="position:relative">
            <button class="btn btn-sm" type="button" data-pop="new" aria-expanded="false" aria-controls="pop-new">${icon("plus")}${t("new")}</button>
            <div class="popover" id="pop-new" hidden style="right:0">${newMenu}</div>
          </div>
          <button class="icon-btn menu-toggle" type="button" data-menu aria-label="${L("menu")}" aria-expanded="false" aria-controls="nav-links">${icon("menu")}</button>
        </div>
      </nav>`;
  }

  function closePopovers() {
    nav.querySelectorAll(".popover").forEach((p) => { p.hidden = true; });
    nav.querySelectorAll("[data-pop]").forEach((b) => b.setAttribute("aria-expanded", "false"));
  }

  // ---------- shared pieces ----------
  function ribbon() {
    if (!store.hasLocalChanges()) return "";
    return `<div class="ribbon" role="note">${t("ribbon")}<span class="ribbon-actions">
      <button type="button" data-export>${t("export")}</button><button type="button" data-reset>${t("reset")}</button></span></div>`;
  }

  function hero({ logo = false, hideTitle = false, titleLogo = "", context = "", title, lede = "", actions = "", stats = null, after = "" }) {
    return `
      <section class="band hero">
        <div class="inner">
          ${logo ? `<span class="logo-full" role="img" aria-label="${esc(S().company.name)}"></span>` : ""}
          ${context ? `<div class="context">${context}</div>` : ""}
          ${titleLogo && BRAND_ICONS.includes(titleLogo)
            ? `<h1 class="logo-title"><span class="brand-icon big bi-${esc(titleLogo)}" aria-hidden="true"></span><span class="visually-hidden">${esc(title)}</span></h1>`
            : `<h1${hideTitle ? ' class="visually-hidden"' : ""}>${esc(title)}</h1>`}
          ${lede ? `<p class="lede">${lede}</p>` : ""}
          ${actions ? `<div class="hero-actions">${actions}</div>` : ""}
          ${after}
          ${typeof stats === "string" ? stats : stats ? `<div class="stats">${stats.map(([num, label]) => `<div><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`).join("")}</div>` : ""}
        </div>
      </section>`;
  }

  const btn = (label, attrs, kind = "", ic = "plus") =>
    `<button class="btn ${kind}" type="button" ${attrs}>${ic ? icon(ic) : ""}${label}</button>`;

  // ---------- the pipeline strip: one layout on every page, counts the episodes in scope ----------
  // scope is what the Board filters to when a stage is clicked: "all" | <dept id> | "ch:<id>" | "wk:<id>"
  const boardFocus = { stage: null };
  function flowStrip(eps, scope, facts = "") {
    const counts = STAGES.map((s) => eps.filter((e) => e.stage === s).length);
    const total = eps.length, pub = counts[STAGES.length - 1];
    const cells = STAGES.map((s, i) => `
      <button class="flow-stage st-${s}${counts[i] ? "" : " zero"}${IN_PROGRESS.includes(s) && counts[i] ? " active" : ""}" type="button" data-flow-stage="${s}" data-flow-scope="${esc(scope)}" title="${esc(t("flowOpen", { stage: stLabel(s) }))}">
        <span class="flow-node"><span class="flow-num">${counts[i]}</span></span>
        <span class="flow-label">${stLabel(s)}</span>
      </button>${i < STAGES.length - 1 ? `<span class="flow-link${counts[i] ? " moving" : ""}" aria-hidden="true"></span>` : ""}`).join("");
    const open = eps.filter((e) => e.stage !== "published");
    let next;
    if (!total) next = L("flowEmpty");
    else if (!open.length) next = L("flowAllDone");
    else {
      const lead = open.slice().sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage)
        || String(a.updated || "").localeCompare(String(b.updated || "")))[0];
      next = `${t("flowPub", { pub, total })} · ${L("flowNext")} <button class="link" type="button" data-edit-ep="${esc(lead.id)}">${esc(epName(typeOfWork(work(lead.work)), lead))}</button> <span class="flow-at">${stLabel(lead.stage)}</span>`;
    }
    return `
      <div class="flow" role="group" aria-label="${esc(L("flowAria"))}">
        ${facts ? `<p class="flow-facts">${facts}</p>` : ""}
        <div class="flow-stages">${cells}</div>
        <p class="flow-next">${next}</p>
      </div>`;
  }

  function epRow(e, { showPath = true } = {}) {
    const w = work(e.work);
    const T = typeOfWork(w);
    const sub = showPath ? esc(pathOf(w)) : esc(e.summary || "");
    return `
      <button class="row" type="button" data-edit-ep="${esc(e.id)}">
        <span class="status st-${esc(e.stage)}"><span class="visually-hidden">${stLabel(e.stage)}</span></span>
        <span class="row-main"><span class="row-title">${esc(epName(T, e))}</span>${sub ? `<span class="row-sub">${sub}</span>` : ""}</span>
        <span class="status-text">${stLabel(e.stage)}</span>
        <span class="row-meta num">${esc(fmtDate(e.date || e.updated))}</span>
        ${icon("chev", "icon chev")}
      </button>`;
  }

  function band(title, rows, emptyHtml, { gray = false, extra = "" } = {}) {
    return `
      <section class="band${gray ? " gray" : ""}">
        <div class="inner">
          <div class="sec-head"><h2>${title}${rows.length ? ` <span class="count num">${rows.length}</span>` : ""}</h2>${extra}</div>
          <div class="list">${rows.length ? rows.join("") : `<div class="empty">${emptyHtml}</div>`}</div>
        </div>
      </section>`;
  }

  const imgTag = (src, alt) =>
    src ? `<img src="${esc(src)}" alt="${esc(alt)}" loading="lazy" referrerpolicy="no-referrer" data-fallback>` : "";

  // ---------- views ----------
  // ---------- company map: Bell in the middle, one node per department ----------
  // dots leave Bell toward a department for each episode in progress and come back green for each one published
  function companyMap() {
    const SLOTS = [[17, 22], [83, 22], [17, 78], [83, 78]];
    const nodes = S().departments.map((d, i) => {
      const [x, y] = SLOTS[i % SLOTS.length];
      const ids = S().channels.filter((c) => c.dept === d.id).map((c) => c.id);
      const eps = S().episodes.filter((e) => ids.includes(work(e.work)?.channel));
      const works = S().works.filter((w) => ids.includes(w.channel)).length;
      const doingN = eps.filter((e) => IN_PROGRESS.includes(e.stage)).length;
      const pubN = eps.filter((e) => e.stage === "published").length;
      const bar = STAGES.map((st) => { const k = eps.filter((e) => e.stage === st).length; return k ? `<i class="st-${st}" style="flex:${k}"></i>` : ""; }).join("");
      const sx = x < 50 ? -1 : 1, ny = y * 5.2, ex = x * 10 - sx * 130, mid = (500 + ex) / 2;
      const state = !ids.length ? "idle" : doingN ? "busy" : "live";
      const id = `lk-${esc(d.id)}`;
      const link = `<path id="${id}" class="map-link ${state}" d="M500 260 C ${mid} 260, ${mid} ${ny}, ${ex} ${ny}" style="--c: var(--d-${esc(d.id)})"/>`;
      const dot = (k, back) => `<circle r="${back ? 5 : 4.5}" class="map-dot${back ? " back" : ""}" style="--c: ${back ? "var(--st-published)" : `var(--d-${esc(d.id)})`}"><animateMotion dur="3.6s" begin="${(k * 1.2 + (back ? 0.6 : 0)).toFixed(1)}s" repeatCount="indefinite"${back ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ""}><mpath href="#${id}"/></animateMotion></circle>`;
      const dots = Array.from({ length: Math.min(doingN, 3) }, (_, k) => dot(k, false)).concat(Array.from({ length: Math.min(pubN, 3) }, (_, k) => dot(k, true))).join("");
      const line = ids.length ? [n(ids.length, "channel"), n(works, "work"), t("dcPub", { pub: pubN })].join(" · ") : "";
      const html = `
        <a class="map-node ${state}" href="#/dept/${esc(d.id)}" style="--c: var(--d-${esc(d.id)}); left: ${x}%; top: ${y}%">
          <span class="map-node-top">${deptIcon(d.id)}<span class="map-node-name">${esc(d.name)}</span>${doingN ? `<span class="map-live">${t("mapLive", { n: doingN })}</span>` : ""}</span>
          <span class="map-node-head">${esc(d.head.name)}</span>
          <span class="flow-bar mini" aria-hidden="true">${bar}</span>
          ${ids.length ? `<span class="map-node-line">${line}</span>` : `<span class="map-node-cta">${L("dcSetup")}${icon("chev", "icon chev")}</span>`}
        </a>`;
      return { link, dots, html };
    });
    return `
      <div class="map" role="group" aria-label="${esc(S().company.name)}">
        <svg class="map-svg" viewBox="0 0 1000 520" aria-hidden="true">${nodes.map((x) => x.link).join("")}${nodes.map((x) => x.dots).join("")}</svg>
        <div class="map-core"><span class="map-pulse"></span><span class="map-pulse late"></span><span class="map-ring"></span><span class="logo-mark" role="img" aria-label="${esc(S().ceo?.name || "Bell")}"></span><span class="map-core-label">${esc(S().ceo?.name || "Bell")} · ${esc(S().ceo?.title || "CEO")}</span></div>
        ${nodes.map((x) => x.html).join("")}
      </div>
      <p class="map-legend" aria-hidden="true"><span><i style="background: var(--ink)"></i>${L("mapOut")}</span><span><i style="background: var(--st-published)"></i>${L("mapIn")}</span></p>`;
  }

  function viewNext() {
    const all = S().episodes;
    const doing = all.filter((e) => IN_PROGRESS.includes(e.stage));
    const ideas = all.filter((e) => e.stage === "idea");
    const published = all.filter((e) => e.stage === "published");
    const recent = published.slice().sort((a, b) => String(b.date || b.updated).localeCompare(String(a.date || a.updated))).slice(0, 5);
    const nextRows = doing.concat(ideas).map((e) => epRow(e));

    return hero({
      hideTitle: true,
      title: L("upNext"),
      after: companyMap(),
      stats: flowStrip(all, "all")
    }) +
      (nextRows.length ? band(t("secNextUp"), nextRows, "", { gray: true }) : "") +
      (recent.length ? band(t("secRecent"), recent.map((e) => epRow(e)), "", { gray: !nextRows.length }) : "");
  }

  function viewBoard() {
    let filter = "all";
    try { filter = localStorage.getItem("bellstudio:board") || "all"; } catch { /* ignore */ }
    const scoped = filter.startsWith("ch:") ? channel(filter.slice(3)) : filter.startsWith("wk:") ? work(filter.slice(3)) : null;
    if (filter !== "all" && !dept(filter) && !scoped) filter = "all";
    const chips = [`<button class="chip" type="button" data-board-filter="all" aria-pressed="${filter === "all"}">${t("all")}</button>`]
      .concat(S().departments.map((d) => `<button class="chip" type="button" data-board-filter="${esc(d.id)}" aria-pressed="${filter === d.id}">${deptIcon(d.id)}${esc(d.name)}</button>`))
      .concat(scoped ? [`<button class="chip" type="button" data-board-filter="${esc(filter)}" aria-pressed="true">${esc(scoped.name || scoped.title)}</button>`] : []).join("");
    const inScope = (e) => filter === "all" ? true
      : filter.startsWith("ch:") ? work(e.work)?.channel === filter.slice(3)
      : filter.startsWith("wk:") ? e.work === filter.slice(3)
      : deptOfWork(work(e.work)) === filter;
    const items = S().episodes.filter(inScope);
    const focus = boardFocus.stage;
    boardFocus.stage = null;
    const lanes = STAGES.map((s) => {
      const cards = items.filter((e) => e.stage === s);
      return `
        <section aria-label="${stLabel(s)}"${focus === s ? " data-focus" : ""} class="st-${s}">
          <div class="lane-head"><span class="status st-${s}"></span><h2>${stLabel(s)}</h2><span class="count num">${cards.length}</span></div>
          <div class="lane">${cards.length ? cards.map((e) => {
            const w = work(e.work), T = typeOfWork(w);
            return `
              <button class="card" type="button" data-edit-ep="${esc(e.id)}">
                <span class="row-title">${esc(epName(T, e))}</span>
                <span class="row-sub">${esc(pathOf(w))}</span>
                <span class="card-foot"><span>${esc(dept(deptOfWork(w))?.head.name ?? "")}</span><span class="num">${esc(fmtDate(e.date || e.updated))}</span></span>
              </button>`;
          }).join("") : `<div class="empty">${t("nothingHere")}</div>`}</div>
        </section>`;
    }).join("");
    return hero({ title: L("board"), lede: t("boardLede"), after: `<div class="chips" role="group" aria-label="${L("departments")}">${chips}</div>` }) +
      `<section class="band gray"><div class="inner wide"><div class="board">${lanes}</div></div></section>`;
  }

  function viewDept(id) {
    const d = dept(id);
    const chans = S().channels.filter((c) => c.dept === id);
    const ids = chans.map((c) => c.id);
    const workCount = S().works.filter((w) => ids.includes(w.channel)).length;
    const deptEps = S().episodes.filter((e) => ids.includes(work(e.work)?.channel));
    const rows = chans.map((c) => {
      const ws = worksOf(c.id);
      const eps = epCountIn([c.id], () => true);
      const bits = [platformShown(c, d), L("type_" + c.type), n(ws.length, "work"), n(eps, "ep")].filter(Boolean).join(" · ");
      return `
        <a class="row" href="#/channel/${esc(c.id)}">
          <span class="row-main"><span class="row-title">${esc(c.name)}</span><span class="row-sub">${esc(bits)}</span></span>
          ${c.status && c.status !== "active" ? `<span class="status st-${esc(c.status)}">${stLabel(c.status)}</span>` : ""}${icon("chev", "icon chev")}
        </a>`;
    });
    return hero({
      context: esc(d.head.name),
      titleLogo: id,
      title: d.name,
      lede: `${esc(d.head.persona)} — <strong>${esc(d.mission)}</strong>`,
      actions: btn(L("editDept"), `data-edit-dept="${esc(id)}"`, "btn-outline", "edit"),
      stats: flowStrip(deptEps, id, `${n(chans.length, "channel")} · ${n(workCount, "work")}`)
    }) +
      band(t("secChannels"), rows, `${t("noChannelYet", { head: d.head.name })} ${t("noChannelHint")}`, { gray: true }) + `
      <section class="band">
        <div class="inner">
          <div class="cols">
            <div class="col"><h3>${t("secTeam")}</h3><ul>${d.roles.map((r) => `<li><strong>${esc(r.title)}</strong> ${esc(r.duty)}</li>`).join("") || `<li>${t("noRoles")}</li>`}</ul></div>
            <div class="col"><h3>${t("secRules")}</h3><ul>${d.rules.map((r) => `<li>${esc(r)}</li>`).join("") || `<li>${t("noRules")}</li>`}</ul></div>
            <div class="col"><h3>${t("secSkills")}</h3><div class="skills">${d.skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("") || `<span class="hint">${t("noSkills")}</span>`}</div></div>
          </div>
        </div>
      </section>`;
  }

  function workTile(w) {
    const { pub, total, eps } = progress(w);
    const src = imageSrc(w.cover);
    return `
      <a class="tile" href="#/work/${esc(w.id)}">
        <div class="stage">${imgTag(src, w.title) || `<span class="no-photo">${icon("photo")}${t("noPhoto")}</span>`}</div>
        <div class="tile-body">
          <div class="tile-name">${esc(w.title)}</div>
          <div class="tile-meta"><span class="num">${eps.length ? t("progressOf", { a: pub, b: total }) : t("noEpsYet")}</span></div>
        </div>
      </a>`;
  }

  function factList(items) {
    const rows = items.filter(Boolean);
    return rows.length ? `<dl class="facts">${rows.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : "";
  }

  function viewChannel(id) {
    const c = channel(id), d = dept(c.dept);
    const ws = worksOf(id);
    const wIds = ws.map((w) => w.id);
    const eps = S().episodes.filter((e) => wIds.includes(e.work));
    const sep = '<span class="sep">·</span>';
    const platform = platformShown(c, d);
    const context = `${deptIcon(d.id)}<a href="#/dept/${esc(d.id)}">${esc(d.name)}</a>${sep}${platform ? esc(platform) + sep : ""}${esc(L("type_" + c.type))}` +
      (c.status && c.status !== "active" ? `${sep}<span class="status st-${esc(c.status)}">${stLabel(c.status)}</span>` : "");
    const facts = factList([
      c.audience ? [L("fAudience"), esc(c.audience)] : null,
      c.schedule ? [L("fSchedule"), esc(c.schedule)] : null,
      safeLink(c.url) ? [L("fPage"), `<a href="${esc(safeLink(c.url))}" target="_blank" rel="noopener">${esc(safeLink(c.url).replace(/^https?:\/\//, ""))}</a>`] : null
    ]);
    return hero({
      context, title: c.name, lede: c.concept ? esc(c.concept) : "",
      actions: btn(L("editChannel"), `data-edit-channel="${esc(id)}"`, "btn-outline", "edit"),
      stats: flowStrip(eps, "ch:" + id, n(ws.length, "work"))
    }) + `
      <section class="band gray">
        <div class="inner wide">
          <div class="sec-head"><h2>${t("secWorks")}${ws.length ? ` <span class="count num">${ws.length}</span>` : ""}</h2></div>
          ${ws.length ? `<div class="gallery">${ws.map(workTile).join("")}</div>` : `<div class="list"><div class="empty">${t("noWorksHint")}</div></div>`}
        </div>
      </section>` +
      (facts ? `<section class="band"><div class="inner"><div class="sec-head"><h2>${t("chanFacts")}</h2></div>${facts}</div></section>` : "");
  }

  function viewWork(id) {
    const w = work(id), c = channel(w.channel), d = dept(c.dept), T = typeOfWork(w);
    const { eps, pub, total } = progress(w);
    const sep = '<span class="sep">›</span>';
    const context = `${deptIcon(d.id)}<a href="#/dept/${esc(d.id)}">${esc(d.name)}</a>${sep}<a href="#/channel/${esc(c.id)}">${esc(c.name)}</a>`;
    const src = imageSrc(w.cover);
    const stage = src
      ? `<div class="product-stage">${imgTag(src, w.title)}</div>`
      : `<button class="product-stage" type="button" data-edit-work="${esc(w.id)}"><span class="no-photo">${icon("photo")}${t("addPhoto")}</span></button>`;

    const detailRows = T.fields.map((k) => {
      const v = String(w.props?.[k] ?? "").trim();
      if (!v) return null;
      const kind = FIELD_KIND[k];
      const shown = kind === "link"
        ? (safeLink(v) ? `<a href="${esc(safeLink(v))}" target="_blank" rel="noopener">${esc(safeLink(v).replace(/^https?:\/\//, ""))}</a>` : esc(v))
        : kind === "datetime-local" ? esc(v.replace("T", " ")) : esc(v);
      return [L("fld_" + k), shown];
    });
    const details = factList([...detailRows, w.note ? [L("f_note"), esc(w.note)] : null, [L("e_work"), `<span class="num">${esc(fmtDate(w.updated))}</span>`]]);
    const about = (w.summary ? `<p class="copy">${esc(w.summary)}</p>` : "") + details;

    const miniGrid = (items, kind) => `<div class="gallery mini-grid">${items.map((it, i) => `
      <button class="tile mini" type="button" data-edit-${kind}="${esc(w.id)}|${i}">
        <div class="stage ${kind === "loc" ? "wide" : ""}">${imgTag(imageSrc(it.image), it.name) || `<span class="no-photo">${icon("photo")}</span>`}</div>
        <div class="tile-body">
          <div class="tile-name">${esc(it.name)}</div>
          ${kind === "char" ? `<div class="tile-meta"><span>${esc(L("role_" + (it.role || "other")))}</span></div>` : ""}
          ${(kind === "char" ? it.look : it.desc) ? `<p class="tile-text">${esc(kind === "char" ? it.look : it.desc)}</p>` : ""}
        </div>
      </button>`).join("")}</div>`;
    const listBand = (title, items, kind, hintKey, gray) => `
      <section class="band${gray ? " gray" : ""}">
        <div class="inner wide">
          <div class="sec-head"><h2>${title}${items.length ? ` <span class="count num">${items.length}</span>` : ""}</h2></div>
          ${items.length ? miniGrid(items, kind) : `<div class="list"><div class="empty">${t(hintKey)}</div></div>`}
        </div>
      </section>`;

    return hero({
      context, title: w.title,
      actions: btn(L("editWork"), `data-edit-work="${esc(w.id)}"`, "btn-outline", "edit"),
      after: stage,
      stats: flowStrip(eps, "wk:" + id)
    }) +
      band(L("epp_" + T.noun), eps.map((e) => epRow(e, { showPath: false })), t("noEpsHint"), { gray: true }) +
      `<section class="band"><div class="inner"><div class="sec-head"><h2>${t(T.lists.length || w.summary ? "secAbout" : "secDetails")}</h2></div>${about}</div></section>` +
      (T.lists.includes("characters") ? listBand(t("secChars"), w.characters, "char", "noCharsHint", true) : "") +
      (T.lists.includes("locations") ? listBand(t("secLocs"), w.locations, "loc", "noLocsHint", false) : "") +
      (T.rules && w.rules ? `<section class="band gray"><div class="inner"><div class="sec-head"><h2>${t("secRulesWork")}</h2></div><p class="copy pre">${esc(w.rules)}</p></div></section>` : "");
  }

  function render() {
    const r = route();
    renderNav(r);
    main.innerHTML = ribbon() + (
      r.view === "board" ? viewBoard() :
      r.view === "dept" ? viewDept(r.id) :
      r.view === "channel" ? viewChannel(r.id) :
      r.view === "work" ? viewWork(r.id) : viewNext());
    main.querySelectorAll("img[data-fallback]").forEach((img) => img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), { className: "no-photo", textContent: L("photoUnavailable") }));
    }, { once: true }));
    foot.innerHTML = `${t("foot", { ceo: S().ceo.name, date: fmtDate(S().updated) })} · ${store.hasLocalChanges() ? t("footLocal") : t("footPublished")}`;
    document.title = r.view === "next" ? "Bell Studio" : `${main.querySelector("h1")?.textContent} — Bell Studio`;
  }

  // ---------- inspector ----------
  let openState = null;

  function openInspector(title, bodyHtml, { onSave, onDelete, deleteLabel }) {
    closePopovers();
    openState = { onSave, onDelete, returnFocus: document.activeElement };
    inspector.innerHTML = `
      <div class="insp-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="${L("close")}">${icon("close")}</button></div>
      <form class="insp-body" id="insp-form" novalidate>${bodyHtml}</form>
      <div class="insp-foot">
        ${onDelete ? `<button class="btn btn-danger" type="button" data-delete>${deleteLabel || t("delete")}</button>` : ""}
        <span class="spacer"></span>
        <button class="btn btn-ghost" type="button" data-close>${t("cancel")}</button>
        <button class="btn" type="submit" form="insp-form">${t("save")}</button>
      </div>`;
    inspector.hidden = false;
    scrim.hidden = false;
    requestAnimationFrame(() => inspector.querySelector("input, select, textarea")?.focus());
  }

  function closeInspector() {
    if (inspector.hidden) return;
    inspector.hidden = true;
    scrim.hidden = true;
    const back = openState?.returnFocus;
    openState = null;
    if (back && document.contains(back)) back.focus();
  }

  const fieldWrap = (label, control, hint = "") =>
    `<label class="field"><span class="label">${label}</span>${control}${hint ? `<span class="hint">${hint}</span>` : ""}</label>`;
  const input = (name, value, attrs = "") => `<input class="input" name="${name}" value="${esc(value)}" ${attrs}>`;
  const textarea = (name, value, attrs = "") => `<textarea class="textarea" name="${name}" ${attrs}>${esc(value)}</textarea>`;
  const linkAttrs = 'type="url" inputmode="url" placeholder="https://…"';
  const opt = (o, value) => `<option value="${esc(o.id)}"${o.id === value ? " selected" : ""}>${esc(o.label)}</option>`;
  const select = (name, options, value) =>
    `<select class="select" name="${name}">${options.map((o) => o.group
      ? `<optgroup label="${esc(o.group)}">${o.items.map((i) => opt(i, value)).join("")}</optgroup>`
      : opt(o, value)).join("")}</select>`;
  const setOptions = (el, options) => { el.innerHTML = options.map((o) => opt(o)).join(""); };

  function required(form, name, msgKey) {
    const el = form.elements[name];
    const ok = el.value.trim() !== "";
    el.setAttribute("aria-invalid", String(!ok));
    el.parentElement.querySelector(".error")?.remove();
    if (!ok) { el.insertAdjacentHTML("afterend", `<span class="error">${t(msgKey)}</span>`); el.focus(); }
    return ok;
  }

  function commit(fn, msgKey) {
    const ok = store.mutate(fn);
    closeInspector();
    say(L(ok ? msgKey : "toastStorage"));
  }

  // image link field + live preview box
  const imageField = (name, label, value, boxId) =>
    fieldWrap(label, input(name, value, linkAttrs), L("f_photoHint")) + `<div class="thumb" id="${boxId}"></div>`;
  function bindPreview(form, name, boxId) {
    const el = form.elements[name], box = $(boxId);
    if (!el || !box) return;
    const show = () => {
      const src = imageSrc(el.value);
      box.innerHTML = src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">` : esc(L("f_preview"));
      box.querySelector("img")?.addEventListener("error", () => { box.textContent = L("f_cantLoad"); }, { once: true });
    };
    el.addEventListener("input", show);
    show();
  }

  // ----- channel -----
  function editChannel(id, presetDept) {
    const isNew = id == null;
    const startDept = presetDept || S().departments[0].id;
    const c = isNew ? { name: "", dept: startDept, platform: "", type: defaultType(startDept), status: "active", concept: "", audience: "", schedule: "", url: "" } : channel(id);
    const platformList = (deptKey, current) => {
      const d = dept(deptKey);
      const list = (d?.platforms?.length ? d.platforms : [d?.name]).filter(Boolean);
      if (current && !list.includes(current)) list.push(current);
      return list.map((p) => ({ id: p, label: p }));
    };
    const typeOptions = TYPE_IDS.map((k) => ({ id: k, label: L("type_" + k) }));
    const more =
      fieldWrap(L("f_concept"), textarea("concept", c.concept || "")) +
      fieldWrap(L("f_audience"), input("audience", c.audience || "", 'autocomplete="off"')) +
      fieldWrap(L("f_schedule"), input("schedule", c.schedule || "", `autocomplete="off" placeholder="${esc(L("f_schedulePh"))}"`)) +
      fieldWrap(L("f_page"), input("url", c.url || "", linkAttrs));
    const body =
      fieldWrap(L("f_name"), input("name", c.name, `required autocomplete="off" placeholder="${esc(L("f_channelPh"))}"`)) +
      fieldWrap(L("f_dept"), select("dept", S().departments.map((d) => ({ id: d.id, label: `${d.name} — ${d.head.name}` })), c.dept)) +
      fieldWrap(L("f_platform"), select("platform", platformList(c.dept, c.platform), c.platform || platformList(c.dept)[0]?.id)) +
      fieldWrap(L("f_type"), select("type", typeOptions, c.type), `<span id="type-hint">${esc(L("typeHint_" + c.type))}</span>`) +
      `<details class="more"${isNew ? "" : " open"}><summary>${t("f_moreDetails")}</summary><div class="more-body">${more}</div></details>`;
    const wsHere = isNew ? [] : worksOf(id);
    const nEps = wsHere.reduce((sum, w) => sum + epsOf(w.id).length, 0);
    const cascade = [wsHere.length && n(wsHere.length, "work"), nEps && n(nEps, "ep")].filter(Boolean).join(" + ");
    openInspector(L(isNew ? "newChannel" : "editChannel"), body, {
      onSave(form) {
        if (!required(form, "name", "errName")) return;
        const data = {
          id: isNew ? slug(form.elements.name.value) : id,
          dept: form.elements.dept.value,
          name: form.elements.name.value.trim(),
          platform: form.elements.platform.value,
          type: form.elements.type.value,
          status: isNew ? "active" : (channel(id)?.status || "active"),
          concept: form.elements.concept.value.trim(),
          audience: form.elements.audience.value.trim(),
          schedule: form.elements.schedule.value.trim(),
          url: form.elements.url.value.trim()
        };
        commit((s) => { if (isNew) s.channels.push(data); else Object.assign(s.channels.find((x) => x.id === id), data); }, isNew ? "toastChannelAdded" : "toastChannelSaved");
        if (isNew) go(`#/channel/${data.id}`);
      },
      onDelete: isNew ? null : () => {
        commit((s) => {
          const gone = s.works.filter((w) => w.channel === id).map((w) => w.id);
          s.channels = s.channels.filter((x) => x.id !== id);
          s.works = s.works.filter((w) => w.channel !== id);
          s.episodes = s.episodes.filter((e) => !gone.includes(e.work));
        }, "toastChannelDeleted");
        go(`#/dept/${c.dept}`);
      },
      deleteLabel: cascade ? t("deleteWith", { what: cascade }) : ""
    });
    const form = $("insp-form");
    form.elements.dept.addEventListener("change", () => {
      setOptions(form.elements.platform, platformList(form.elements.dept.value));
      if (isNew) { form.elements.type.value = defaultType(form.elements.dept.value); form.elements.type.dispatchEvent(new Event("change")); }
    });
    form.elements.type.addEventListener("change", () => { $("type-hint").textContent = L("typeHint_" + form.elements.type.value); });
  }

  // ----- work -----
  function editWork(id, preset = {}) {
    const isNew = id == null;
    const startCh = (preset.channel && channel(preset.channel)) || S().channels.find((c) => c.dept === preset.dept) || S().channels[0];
    const w = isNew ? { channel: startCh?.id, title: "", summary: "", cover: "", props: {}, characters: [], locations: [], rules: "", note: "" } : work(id);
    const deptKey = channel(w.channel)?.dept;
    const deptOptions = S().departments.filter((d) => S().channels.some((c) => c.dept === d.id)).map((d) => ({ id: d.id, label: d.name }));
    const channelsOf = (dId) => S().channels.filter((c) => c.dept === dId).map((c) => ({ id: c.id, label: c.name }));

    const propInput = (k, v) => {
      const kind = FIELD_KIND[k], label = L("fld_" + k);
      if (kind === "textarea") return fieldWrap(label, textarea("p_" + k, v, 'style="min-height:72px"'));
      const attrs = kind === "link" ? linkAttrs : kind === "number" ? 'type="number" min="1" inputmode="numeric"' : kind === "datetime-local" ? 'type="datetime-local"' : 'autocomplete="off"';
      return fieldWrap(label, input("p_" + k, v, attrs));
    };
    const fieldsHtml = (chId, v) => {
      const T = typeOfChannel(chId), aff = channel(chId)?.type === "affiliate";
      return fieldWrap(L(aff ? "w_titleProduct" : "w_title"), input("title", v.title, `required autocomplete="off" placeholder="${esc(L("w_titlePh"))}"`)) +
        fieldWrap(L(aff ? "w_summaryProduct" : "w_summary"), textarea("summary", v.summary)) +
        imageField("cover", L(aff ? "w_coverProduct" : "w_cover"), v.cover, "thumb") +
        T.fields.map((k) => propInput(k, v.props?.[k] ?? "")).join("") +
        (T.rules ? fieldWrap(L("w_rules"), textarea("rules", v.rules), L("w_rulesHint")) : "") +
        fieldWrap(L("f_note"), textarea("note", v.note, `placeholder="${esc(L("f_notePh"))}"`));
    };
    const readValues = (form) => {
      const v = { props: {} };
      ["title", "summary", "cover", "rules", "note"].forEach((k) => { v[k] = form.elements[k]?.value ?? ""; });
      Object.keys(FIELD_KIND).concat(["category", "genre", "epLength", "style", "engine", "narrator", "duration"]).forEach((k) => {
        if (form.elements["p_" + k]) v.props[k] = form.elements["p_" + k].value;
      });
      return v;
    };

    const body =
      fieldWrap(L("f_dept"), select("dept", deptOptions, deptKey)) +
      fieldWrap(L("f_channel"), select("channel", channelsOf(deptKey), w.channel)) +
      `<div class="more-body" id="work-fields">${fieldsHtml(w.channel, w)}</div>`;
    const eps = isNew ? [] : epsOf(id);
    openInspector(L(isNew ? "newWork" : "editWork"), body, {
      onSave(form) {
        if (!required(form, "title", "errTitle")) return;
        const chId = form.elements.channel.value, T = typeOfChannel(chId);
        const v = readValues(form);
        const props = {};
        T.fields.forEach((k) => { const val = String(v.props[k] ?? "").trim(); if (val) props[k] = val; });
        const data = {
          id: isNew ? slug(v.title) : id,
          channel: chId,
          title: v.title.trim(),
          summary: v.summary.trim(),
          cover: v.cover.trim(),
          props,
          rules: T.rules ? v.rules.trim() : (w.rules || ""),
          note: v.note.trim(),
          characters: w.characters || [],
          locations: w.locations || [],
          updated: store.today()
        };
        commit((s) => {
          if (isNew) {
            s.works.push(data);
            // a product is always sold through at least one clip, so Affiliate works start with one
            if (channel(chId)?.type === "affiliate") {
              s.episodes.push({ id: `e-${store.rid()}`, work: data.id, n: 1, title: L("firstClip"), summary: "", stage: "idea", date: "", link: "", note: "", updated: store.today() });
            }
          } else {
            s.works[s.works.findIndex((x) => x.id === id)] = data;
          }
        }, isNew ? "toastWorkAdded" : "toastWorkSaved");
        if (isNew) go(`#/work/${data.id}`);
      },
      onDelete: isNew ? null : () => {
        commit((s) => {
          s.works = s.works.filter((x) => x.id !== id);
          s.episodes = s.episodes.filter((e) => e.work !== id);
        }, "toastWorkDeleted");
        go(`#/channel/${w.channel}`);
      },
      deleteLabel: eps.length ? t("deleteWith", { what: n(eps.length, "ep") }) : ""
    });
    const form = $("insp-form");
    const redraw = () => { bindPreview(form, "cover", "thumb"); };
    form.elements.dept.addEventListener("change", () => {
      setOptions(form.elements.channel, channelsOf(form.elements.dept.value));
      form.elements.channel.dispatchEvent(new Event("change"));
    });
    form.elements.channel.addEventListener("change", () => {
      const v = readValues(form);
      $("work-fields").innerHTML = fieldsHtml(form.elements.channel.value, { ...w, ...v, props: { ...(w.props || {}), ...v.props } });
      redraw();
    });
    redraw();
    if (isNew) form.elements.title.focus();
  }

  // ----- episode / clip -----
  function editEpisode(id, preset = {}) {
    const isNew = id == null;
    const startWork = work(preset.work) || S().works[0];
    const e = isNew
      ? { work: startWork?.id, n: epsOf(startWork.id).length + 1, title: "", summary: "", stage: "idea", date: "", link: "", note: "" }
      : episode(id);
    const workOptions = S().channels.map((c) => ({
      group: `${dept(c.dept)?.name ?? ""} · ${c.name}`,
      items: worksOf(c.id).map((w) => ({ id: w.id, label: w.title }))
    })).filter((g) => g.items.length);
    const stageSeg = `<div class="seg-field five" role="radiogroup" aria-label="${esc(L("e_status"))}">${STAGES.map((s) =>
      `<label><input type="radio" name="stage" value="${s}"${e.stage === s ? " checked" : ""}><span>${stLabel(s)}</span></label>`).join("")}</div>`;
    const body =
      fieldWrap(L("e_work"), select("work", workOptions, e.work)) +
      fieldWrap(L("e_number"), input("n", e.n, 'type="number" min="1" inputmode="numeric"')) +
      fieldWrap(L("e_title"), input("title", e.title, 'autocomplete="off"')) +
      fieldWrap(L("e_summary"), textarea("summary", e.summary, 'style="min-height:72px"')) +
      `<div class="field"><span class="label">${L("e_status")}</span>${stageSeg}</div>` +
      fieldWrap(L("e_date"), input("date", e.date, 'type="date"')) +
      fieldWrap(L("e_link"), input("link", e.link, linkAttrs), esc(L("e_linkHint")) + (safeLink(e.link) ? ` <a href="${esc(safeLink(e.link))}" target="_blank" rel="noopener">${esc(L("openPost"))}</a>` : "")) +
      fieldWrap(L("f_note"), textarea("note", e.note, `placeholder="${esc(L("f_notePh"))}"`));
    const T0 = typeOfWork(work(e.work));
    openInspector(L((isNew ? "newEp_" : "editEp_") + T0.noun), body, {
      onSave(f) {
        const data = {
          id: isNew ? `e-${store.rid()}` : id,
          work: f.elements.work.value,
          n: Math.max(1, parseInt(f.elements.n.value, 10) || 1),
          title: f.elements.title.value.trim(),
          summary: f.elements.summary.value.trim(),
          stage: f.querySelector('input[name="stage"]:checked')?.value || "idea",
          date: f.elements.date.value,
          link: f.elements.link.value.trim(),
          note: f.elements.note.value.trim(),
          updated: store.today()
        };
        commit((s) => { if (isNew) s.episodes.push(data); else s.episodes[s.episodes.findIndex((x) => x.id === id)] = data; }, isNew ? "toastEpAdded" : "toastEpSaved");
      },
      onDelete: isNew ? null : () => commit((s) => { s.episodes = s.episodes.filter((x) => x.id !== id); }, "toastEpDeleted")
    });
    const form = $("insp-form");
    if (isNew) {
      form.elements.work.addEventListener("change", () => { form.elements.n.value = epsOf(form.elements.work.value).length + 1; });
      form.elements.title.focus();
    }
  }

  // ----- characters and locations (stored inside the work) -----
  function editListItem(kind, workId, idx) {
    const wk = work(workId);
    const isNew = idx == null;
    const isChar = kind === "char";
    const key = isChar ? "characters" : "locations";
    const item = isNew ? (isChar ? { name: "", role: "main", look: "", personality: "", voice: "", image: "" } : { name: "", desc: "", image: "" }) : wk[key][idx];
    const body = isChar
      ? fieldWrap(L("c_name"), input("name", item.name, 'required autocomplete="off"')) +
        fieldWrap(L("c_role"), select("role", ROLES.map((r) => ({ id: r, label: L("role_" + r) })), item.role || "main")) +
        fieldWrap(L("c_look"), textarea("look", item.look || "", 'style="min-height:72px"')) +
        fieldWrap(L("c_personality"), textarea("personality", item.personality || "", 'style="min-height:72px"')) +
        fieldWrap(L("c_voice"), input("voice", item.voice || "", 'autocomplete="off"')) +
        imageField("image", L("c_image"), item.image, "thumb")
      : fieldWrap(L("l_name"), input("name", item.name, 'required autocomplete="off"')) +
        fieldWrap(L("l_desc"), textarea("desc", item.desc || "")) +
        imageField("image", L("l_image"), item.image, "thumb");
    const title = `${L(isNew ? (isChar ? "newChar" : "newLoc") : (isChar ? "editChar" : "editLoc"))} · ${wk.title}`;
    const msg = (what) => `toast${isChar ? "Char" : "Loc"}${what}`;
    openInspector(title, body, {
      onSave(f) {
        if (!required(f, "name", "errName")) return;
        const data = isChar
          ? { name: f.elements.name.value.trim(), role: f.elements.role.value, look: f.elements.look.value.trim(), personality: f.elements.personality.value.trim(), voice: f.elements.voice.value.trim(), image: f.elements.image.value.trim() }
          : { name: f.elements.name.value.trim(), desc: f.elements.desc.value.trim(), image: f.elements.image.value.trim() };
        commit((s) => {
          const target = s.works.find((x) => x.id === workId);
          if (isNew) target[key].push(data); else target[key][idx] = data;
          target.updated = store.today();
        }, msg(isNew ? "Added" : "Saved"));
      },
      onDelete: isNew ? null : () => commit((s) => { s.works.find((x) => x.id === workId)[key].splice(idx, 1); }, msg("Deleted"))
    });
    bindPreview($("insp-form"), "image", "thumb");
  }

  // ----- department -----
  function editDept(id) {
    const d = dept(id);
    const body =
      fieldWrap(L("f_head"), input("head", d.head.name, 'required autocomplete="off"')) +
      fieldWrap(L("f_persona"), input("persona", d.head.persona, 'autocomplete="off"')) +
      fieldWrap(L("f_mission"), textarea("mission", d.mission)) +
      fieldWrap(L("f_platforms"), textarea("platforms", (d.platforms || []).join("\n"), 'style="min-height:72px"'), L("f_platformsHint")) +
      fieldWrap(L("f_team"), textarea("roles", d.roles.map((r) => `${r.title} — ${r.duty}`).join("\n")), L("f_teamHint")) +
      fieldWrap(L("f_rules"), textarea("rules", d.rules.join("\n")), L("f_rulesHint")) +
      fieldWrap(L("f_skills"), textarea("skills", d.skills.join("\n"), 'style="min-height:80px"'), L("f_skillsHint"));
    openInspector(L("editDeptTitle").replace("{name}", d.name), body, {
      onSave(form) {
        if (!required(form, "head", "errHead")) return;
        const lines = (k) => form.elements[k].value.split("\n").map((x) => x.trim()).filter(Boolean);
        commit((s) => {
          const tgt = s.departments.find((x) => x.id === id);
          tgt.head = { ...tgt.head, name: form.elements.head.value.trim(), persona: form.elements.persona.value.trim() };
          tgt.mission = form.elements.mission.value.trim();
          tgt.roles = lines("roles").map((l) => { const [title, ...rest] = l.split(/\s+[—-]\s+/); return { title: title.trim(), duty: rest.join(" — ").trim() }; });
          tgt.rules = lines("rules");
          tgt.platforms = lines("platforms");
          tgt.skills = lines("skills");
        }, "toastDeptSaved");
      }
    });
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const el = e.target.closest("button, a");
    if (!e.target.closest(".popover, [data-pop]")) closePopovers();
    if (!el) return;
    const ds = el.dataset;

    if ("pop" in ds) {
      const pop = $(`pop-${ds.pop}`);
      const willOpen = pop.hidden;
      closePopovers();
      pop.hidden = !willOpen;
      el.setAttribute("aria-expanded", String(willOpen));
      return;
    }
    if ("menu" in ds) {
      const links = $("nav-links");
      links.classList.toggle("open");
      el.setAttribute("aria-expanded", String(links.classList.contains("open")));
      return;
    }
    if ("lang" in ds) return setLang(ds.lang);
    if ("close" in ds) return closeInspector();
    if ("delete" in ds) {
      if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = L("confirmDelete"); return; }
      return openState?.onDelete?.();
    }
    if ("export" in ds) {
      const blob = new Blob([store.exportJSON()], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `bell-studio-${store.today()}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return say(L("toastExported"));
    }
    if ("reset" in ds) {
      if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = L("discard"); return; }
      store.reset();
      return say(L("toastReset"));
    }
    if ("flowStage" in ds) {
      try { localStorage.setItem("bellstudio:board", ds.flowScope || "all"); } catch { /* ignore */ }
      boardFocus.stage = ds.flowStage;
      location.hash = "#/board";
      return;
    }
    if ("boardFilter" in ds) { try { localStorage.setItem("bellstudio:board", ds.boardFilter); } catch { /* ignore */ } return render(); }

    if ("newWork" in ds) return editWork(null, { dept: ds.dept || undefined, channel: ds.newWork || undefined });
    if ("editWork" in ds) return editWork(ds.editWork);
    if ("newEp" in ds) return editEpisode(null, { work: ds.newEp });
    if ("editEp" in ds) return editEpisode(ds.editEp);
    if ("newChar" in ds) return editListItem("char", ds.newChar, null);
    if ("editChar" in ds) { const [wid, i] = ds.editChar.split("|"); return editListItem("char", wid, +i); }
    if ("newLoc" in ds) return editListItem("loc", ds.newLoc, null);
    if ("editLoc" in ds) { const [wid, i] = ds.editLoc.split("|"); return editListItem("loc", wid, +i); }
    if ("newChannel" in ds) { e.preventDefault(); return editChannel(null, ds.dept || undefined); }
    if ("editChannel" in ds) return editChannel(ds.editChannel);
    if ("editDept" in ds) return editDept(ds.editDept);
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id !== "insp-form") return;
    e.preventDefault();
    openState?.onSave?.(e.target);
  });

  scrim.addEventListener("click", closeInspector);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!inspector.hidden) closeInspector();
    else closePopovers();
  });

  store.subscribe(render);
  window.addEventListener("hashchange", () => {
    render();
    window.scrollTo(0, 0);
    const lane = main.querySelector("[data-focus]");
    if (lane && window.matchMedia("(max-width: 980px)").matches) lane.scrollIntoView({ block: "start" });
  });
  render();
})();
