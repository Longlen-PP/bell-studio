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
  // codes: SHP-AFF-001-C01 = department - channel - work number - kind letter + episode number
  const pad = (v, w) => String(v ?? 0).padStart(w, "0");
  const KIND_LETTER = { clip: "C", ep: "E", video: "V", session: "S" };
  const workCode = (w) => {
    const c = channel(w.channel), d = c && dept(c.dept);
    return [d?.code, c?.code, pad(w.no, 3)].filter(Boolean).join("-");
  };
  const nextEpNo = (workId) => Math.max(work(workId)?.epSeq || 0, ...epsOf(workId).map((x) => x.n || 0)) + 1;
  const epCode = (e, short = false) => {
    const w = work(e.work);
    const tail = (KIND_LETTER[typeOfWork(w).noun] || "E") + pad(e.n, 2);
    return short ? tail : `${workCode(w)}-${tail}`;
  };
  const IDLE_DAYS = 7;
  const ageOf = (e) => Math.max(0, Math.round((Date.parse(store.today()) - Date.parse(e.updated || store.today())) / 86400000));
  const isIdle = (e) => e.stage !== "published" && ageOf(e) >= IDLE_DAYS;
  // the format (template) is the clip's name; the optional title adds detail after it
  const epLabel = (e) => [e.format, e.title].filter(Boolean).join(" — ");
  const epName = (T, e, short = false) => `${epCode(e, short)}${epLabel(e) ? " · " + epLabel(e) : ""}`;
  // suggestions for the format field: the presets for this kind of channel plus anything already used there
  const formatChoices = (workId) => {
    const w = work(workId), type = channel(w?.channel)?.type;
    const used = S().episodes.filter((x) => channel(work(x.work)?.channel)?.type === type).map((x) => x.format);
    return [...new Set([...(S().formats?.[type] || []), ...used].filter(Boolean))];
  };
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
    if (view === "board") return { view: "next" };
    if (view === "library") return { view: "library" };
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
  const menuOpen = new Set();
  let findingsOpen = false;
  // Ize paused the key-findings panel on 2026-10-17 (too little data yet); flip to true to bring it back
  const FINDINGS_ON = false;
  function renderNav(r) {
    const cur = (cond) => (cond ? ' aria-current="page"' : "");
    const inDept = ["dept", "channel", "work"].includes(r.view);
    // each department can fold its channels; the department you are looking at starts open
    const curDept = r.view === "dept" ? r.id : r.view === "channel" ? channel(r.id)?.dept : r.view === "work" ? deptOfWork(work(r.id)) : null;
    const deptMenu = S().departments.map((d) => {
      const chs = S().channels.filter((c) => c.dept === d.id);
      const open = chs.length > 0 && (menuOpen.has(d.id) || curDept === d.id);
      return `
      <div class="menu-group" data-dept-group="${esc(d.id)}" style="--c: var(--d-${esc(d.id)})">
        <div class="menu-row">
          <a class="menu-link" href="#/dept/${esc(d.id)}">${deptIcon(d.id)}${esc(d.name)}</a>
          ${chs.length ? `<button class="menu-fold" type="button" data-dept-toggle="${esc(d.id)}" aria-expanded="${open}" aria-label="${esc(d.name)} · ${esc(n(chs.length, "channel"))}">${icon("chev", "icon chev")}</button>` : ""}
        </div>
        <div class="menu-subs"${open ? "" : " hidden"}>${chs.map((c) => `<a class="menu-link sub" href="#/channel/${esc(c.id)}">${esc(c.name)}</a>`).join("")}</div>
      </div>`;
    }).join("");

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
        <a class="brand" href="#/next" aria-label="${esc(S().company.name)} · ${esc(L("upNext"))}"><span class="logo-mark" aria-hidden="true"></span><span>${esc(S().company.name)}</span></a>
        <div class="nav-links" id="nav-links">
          <a class="nav-link" href="#/library"${cur(r.view === "library")}>${t("library")}</a>
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
  const boardFocus = { stage: null, all: false };
  // "2 of 9 published · Closest to done: ..." (or the empty-state sentence)
  function flowNextLine(eps) {
    const total = eps.length, pub = eps.filter((e) => e.stage === "published").length;
    const open = eps.filter((e) => e.stage !== "published");
    let next;
    if (!total) next = L("flowEmpty");
    else if (!open.length) next = t("flowPub", { pub, total });
    else {
      const lead = open.slice().sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage)
        || String(a.updated || "").localeCompare(String(b.updated || "")))[0];
      next = `${t("flowPub", { pub, total })} · ${L("flowNext")} <button class="link" type="button" data-edit-ep="${esc(lead.id)}">${esc(epName(typeOfWork(work(lead.work)), lead))}</button> <span class="flow-at">${stLabel(lead.stage)}</span>`;
    }
    return next;
  }

  function flowStrip(eps, scope, facts = "") {
    const counts = STAGES.map((s) => eps.filter((e) => e.stage === s).length);
    const total = eps.length, pub = counts[STAGES.length - 1];
    const cells = STAGES.map((s, i) => `
      <button class="flow-stage st-${s}${counts[i] ? "" : " zero"}${IN_PROGRESS.includes(s) && counts[i] ? " active" : ""}" type="button" data-flow-stage="${s}" data-flow-scope="${esc(scope)}" title="${esc(t("flowOpen", { stage: stLabel(s) }))}">
        <span class="flow-node"><span class="flow-num">${counts[i]}</span></span>
        <span class="flow-label">${stLabel(s)}</span>
      </button>${i < STAGES.length - 1 ? `<span class="flow-link${counts[i] ? " moving" : ""}" aria-hidden="true"></span>` : ""}`).join("");
    const next = flowNextLine(eps);
    return `
      <div class="flow" role="group" aria-label="${esc(L("flowAria"))}">
        ${facts ? `<p class="flow-facts">${facts}</p>` : ""}
        <div class="flow-stages">${cells}</div>
        ${next ? `<p class="flow-next">${next}</p>` : ""}
      </div>`;
  }

  // A list row for one episode/clip. In lists that mix works (home) it reads like a label:
  // product or story as the title, "Clip 1 · name" under it, then where it lives and what kind it is.
  function epRow(e, { showPath = true } = {}) {
    const w = work(e.work);
    const T = typeOfWork(w);
    let main, sub, tags = "";
    if (showPath) {
      const c = channel(w.channel), d = dept(c.dept);
      const kind = String(L("type_" + c.type) || "");
      const flavor = String(w.props?.category || w.props?.genre || "").trim();
      const pills = [
        `<span class="tag">${deptIcon(d.id)}${esc(d.name)}</span>`,
        `<span class="tag">${esc(c.name)}</span>`,
        kind && kind.toLowerCase() !== String(c.name).toLowerCase() ? `<span class="tag">${esc(kind)}</span>` : "",
        flavor ? `<span class="tag">${esc(flavor)}</span>` : ""
      ].filter(Boolean).join("");
      main = esc(w.title);
      sub = esc(epName(T, e));
      tags = `<span class="row-tags">${pills}</span>`;
    } else {
      main = esc(epName(T, e, true));
      sub = esc(e.summary || "");
    }
    return `
      <button class="row" type="button" data-edit-ep="${esc(e.id)}">
        <span class="status st-${esc(e.stage)}"><span class="visually-hidden">${stLabel(e.stage)}</span></span>
        <span class="row-main"><span class="row-title">${main}</span>${sub ? `<span class="row-sub">${sub}</span>` : ""}${tags}</span>
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
    let picked = "all";
    try { picked = localStorage.getItem("bellstudio:board") || "all"; } catch { /* ignore */ }
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
      const state = (!ids.length ? "idle" : doingN ? "busy" : "live") + (dept(picked) && picked !== d.id ? " dim" : "");
      const id = `lk-${esc(d.id)}`;
      const link = `<path id="${id}" class="map-link ${state}" d="M500 260 C ${mid} 260, ${mid} ${ny}, ${ex} ${ny}" style="--c: var(--d-${esc(d.id)})"/>`;
      const dot = (k, back) => `<circle r="${back ? 5 : 4.5}" class="map-dot${back ? " back" : ""}" style="--c: ${back ? "var(--st-published)" : `var(--d-${esc(d.id)})`}"><animateMotion dur="3.6s" begin="${(k * 1.2 + (back ? 0.6 : 0)).toFixed(1)}s" repeatCount="indefinite"${back ? ' keyPoints="1;0" keyTimes="0;1" calcMode="linear"' : ""}><mpath href="#${id}"/></animateMotion></circle>`;
      const dots = Array.from({ length: Math.min(doingN, 3) }, (_, k) => dot(k, false)).concat(Array.from({ length: Math.min(pubN, 3) }, (_, k) => dot(k, true))).join("");
      const line = ids.length ? [n(ids.length, "channel"), n(works, "work"), t("dcPub", { pub: pubN })].join(" · ") : "";
      const html = `
        <a class="map-node ${state}" href="#/dept/${esc(d.id)}" data-board-filter="${esc(d.id)}" style="--c: var(--d-${esc(d.id)}); left: ${x}%; top: ${y}%">
          <span class="map-node-top">${deptIcon(d.id)}<span class="map-node-name">${esc(d.name)}</span>${doingN ? `<span class="map-live">${t("mapLive", { n: doingN })}</span>` : ""}</span>
          <span class="flow-bar mini" aria-hidden="true">${bar}</span>
          ${ids.length ? `<span class="map-node-line">${line}</span>` : `<span class="map-node-cta">${L("dcSetup")}${icon("chev", "icon chev")}</span>`}
        </a>`;
      return { link, dots, html };
    });
    return `
      <div class="map" role="group" aria-label="${esc(S().company.name)}">
        <svg class="map-svg" viewBox="0 0 1000 520" aria-hidden="true">${nodes.map((x) => x.link).join("")}${nodes.map((x) => x.dots).join("")}</svg>
        <button class="map-core" type="button" data-board-filter="all" aria-pressed="${picked === "all"}" title="${esc(L("showAll"))}" aria-label="${esc(L("showAll"))}"><span class="map-orb" aria-hidden="true"></span><span class="logo-mark" aria-hidden="true"></span><span class="map-core-label">${esc(S().ceo?.name || "Bell")} · ${esc(S().ceo?.title || "CEO")}</span></button>
        ${nodes.map((x) => x.html).join("")}
      </div>`;
  }

  function viewNext() {
    const b = boardParts();
    return hero({ hideTitle: true, title: L("upNext"), after: companyMap() + b.controls }) + b.lanes;
  }

  // ---------- home: results row, weekly goal and the key-findings panel ----------
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function thisWeek() {
    const t0 = new Date(store.today() + "T00:00:00"), back = (t0.getDay() + 6) % 7;
    const start = new Date(t0); start.setDate(t0.getDate() - back);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { from: ymd(start), to: ymd(end) };
  }
  // findings are plain arithmetic on what has been typed in; nothing is guessed, and a small sample says so
  function findings(items, goalInfo) {
    const out = [];
    const pubs = items.filter((e) => e.stage === "published");
    const withData = pubs.filter((e) => numOf(e.cost) != null || numOf(e.stats?.views) != null || numOf(e.stats?.orders) != null);
    if (withData.length < 3) out.push(t("fLow", { n: withData.length }));
    const groups = {};
    pubs.forEach((e) => { if (e.format) (groups[e.format] = groups[e.format] || []).push(e); });
    const small = (g) => (g.length < 3 ? L("fSmall") : "");
    const byViews = Object.entries(groups).map(([f, g]) => ({ f, g, v: avgOf(g, (e) => e.stats?.views) })).filter((x) => x.v != null).sort((p, q) => q.v - p.v);
    if (byViews.length >= 2) out.push(t("fBestViews", { f: byViews[0].f, v: showNum(byViews[0].v), k: byViews[0].g.length, small: small(byViews[0].g) }));
    const byCost = Object.entries(groups).map(([f, g]) => {
      const orders = sumOf(g, (e) => e.stats?.orders), costed = g.filter((e) => numOf(e.cost) != null);
      return { f, g, v: orders > 0 && costed.length ? sumOf(costed, (e) => e.cost) / orders : null };
    }).filter((x) => x.v != null).sort((p, q) => p.v - q.v);
    if (byCost.length >= 2) out.push(t("fBestCost", { f: byCost[0].f, c: showBaht(byCost[0].v), k: byCost[0].g.length, small: small(byCost[0].g) }));
    const spend = sumOf(items.filter((e) => numOf(e.cost) != null), (e) => e.cost);
    const orders = sumOf(pubs, (e) => e.stats?.orders), views = sumOf(pubs, (e) => e.stats?.views);
    if (spend > 0 && orders > 0) out.push(t("fCostOrder", { c: showBaht(spend / orders) }));
    if (spend > 0 && views > 0) out.push(t("fCostView", { c: showBaht(spend / views * 1000) }));
    const dated = pubs.filter((e) => e.date).map((e) => e.date).sort();
    if (dated.length) {
      const days = ageOf({ updated: dated[dated.length - 1] });
      if (days >= 3) out.push(t("fCadence", { n: days }));
    }
    const quiet = items.filter(isIdle).length;
    if (quiet) out.push(t("fQuiet", { n: quiet, d: IDLE_DAYS }));
    const noDate = pubs.filter((e) => !e.date).length;
    if (goalInfo && noDate) out.push(t("fNoDate", { n: noDate }));
    return out.length ? out : [L("fNone")];
  }
  // market-trend infographic: ranked category chips per platform (shared ones glow) and four quick "what works" cards
  function trendsHtml(filter) {
    const tr = (window.STUDIO_NEWS || {}).trends;
    if (!tr || !(filter === "all" || (tr.depts || []).includes(filter))) return "";
    const rows = tr.categories || [];
    const shared = new Set((rows[0]?.items || []).map((x) => x.k).filter((k) => rows.every((r) => r.items.some((x) => x.k === k))));
    const rowHtml = rows.map((r) => `
      <div class="cat-row">
        <div class="cat-plat">${esc(r.platform)}<a href="${esc(r.url)}" target="_blank" rel="noopener" title="${esc(r.note)}">${L("trendSource")}</a></div>
        <div class="cat-chips">${r.items.map((x, k) => `<span class="cat-chip${shared.has(x.k) ? " shared" : ""}"><b class="num">${k + 1}</b>${esc(x.t)}</span>`).join("")}</div>
      </div>`).join("");
    const fmt = (tr.formats || []).map((f) => `
      <a class="fmt-card" href="${esc(f.url)}" target="_blank" rel="noopener" title="${esc(f.src)}">
        <b>${esc(f.big)}</b><span>${esc(f.t)}</span><i>${esc(L(f.trust === "official" ? "trustOfficial" : "trustSecondary"))}</i>
      </a>`).join("");
    return `<section class="trends">
      <h3>${L("trendHead")} <small>${t("trendWhen", { date: (window.STUDIO_NEWS || {}).updated || "-" })}</small></h3>
      <p class="trend-sub">${L("trendCats")} <span class="shared-key"><i></i>${L("trendShared")}</span></p>
      ${rowHtml}
      ${tr.catNote ? `<p class="muted">${esc(tr.catNote)}</p>` : ""}
      <p class="trend-sub">${L("trendFormats")}</p>
      <div class="fmt-grid">${fmt}</div>
      ${tr.caveat ? `<p class="muted">${esc(tr.caveat)}</p>` : ""}
    </section>`;
  }

  function homeStats(items, filter) {
    const pubs = items.filter((e) => e.stage === "published");
    const spend = countOf(items, (e) => e.cost) ? sumOf(items, (e) => e.cost) : null;
    const views = countOf(pubs, (e) => e.stats?.views) ? sumOf(pubs, (e) => e.stats?.views) : null;
    const orders = countOf(pubs, (e) => e.stats?.orders) ? sumOf(pubs, (e) => e.stats?.orders) : null;
    const costPub = avgOf(pubs, (e) => e.cost);
    const tile = (v, label) => `<div class="kpi"><div class="kpi-num">${v}</div><div class="kpi-label">${label}</div></div>`;
    const scopeChans = filter === "all" ? S().channels
      : dept(filter) ? S().channels.filter((c) => c.dept === filter)
      : filter.startsWith("ch:") ? [channel(filter.slice(3))].filter(Boolean)
      : [channel(work(filter.slice(3))?.channel)].filter(Boolean);
    const kind = kindsOf(scopeChans.map((c) => c.type));
    const followers = countOf(pubs, (e) => e.stats?.followers) ? sumOf(pubs, (e) => e.stats?.followers) : null;
    const watchAvg = avgOf(pubs, (e) => e.stats?.watch);
    const watchTxt = watchAvg == null ? "—" : `${showNum(watchAvg)} ${L("unitSec")}`;
    const tail = kind.sell && kind.content ? tile(showNum(orders), L("kpiOrders")) + tile(showNum(followers), L("kpiFollowers"))
      : kind.sell ? tile(showNum(orders), L("kpiOrders")) + tile(showBaht(costPub), L("kpiAvgCost"))
      : tile(showNum(followers), L("kpiFollowers")) + tile(watchTxt, L("kpiWatch"));
    const kpis = `<div class="kpis">${tile(showBaht(spend), L("kpiSpend"))}${tile(showNum(views), L("kpiViews"))}${tail}</div>`;

    // weekly goal: the department's own goal, or the sum over departments that have one
    const scopedDept = filter === "all" || dept(filter);
    const goalDepts = scopedDept ? S().departments.filter((d) => (filter === "all" || d.id === filter) && +d.weeklyGoal > 0) : [];
    const wk = thisWeek();
    const inWeek = (e) => e.stage === "published" && e.date && e.date >= wk.from && e.date <= wk.to;
    let goalHtml = "";
    let goalInfo = null;
    if (goalDepts.length) {
      const per = goalDepts.map((d) => ({ d, goal: +d.weeklyGoal, pub: items.filter((e) => inWeek(e) && deptOfWork(work(e.work)) === d.id).length }));
      const goal = per.reduce((n, p) => n + p.goal, 0), done = per.reduce((n, p) => n + Math.min(p.pub, p.goal), 0), pubN = per.reduce((n, p) => n + p.pub, 0);
      goalInfo = { goal, pub: pubN };
      const pips = goal <= 12
        ? Array.from({ length: goal }, (_, k) => `<i class="${k < pubN ? "f" : ""}"></i>`).join("")
        : `<i class="f" style="flex:${Math.min(pubN, goal)}"></i><i style="flex:${Math.max(goal - pubN, 0)}"></i>`;
      const detail = filter === "all" && per.length > 1
        ? `<div class="goal-depts">${per.map((p) => `<span style="--c: var(--d-${esc(p.d.id)})"><i></i>${esc(p.d.name)} ${p.pub}/${p.goal}</span>`).join("")}</div>` : "";
      goalHtml = `<div class="goal"><div class="goal-top"><span>${t("goalTitle", { pub: pubN, goal })}</span><span class="goal-left">${pubN >= goal ? L("goalDone") : t("goalLeft", { n: goal - pubN })}</span></div><div class="goal-track">${pips}</div>${detail}</div>`;
      void done;
    } else if (dept(filter)) {
      goalHtml = `<p class="goal-set"><button class="link" type="button" data-edit-dept="${esc(filter)}">${L("goalSet")}</button></p>`;
    }

    // key findings: only on request
    const toggle = !FINDINGS_ON ? "" : `<p class="find-toggle"><button class="btn btn-outline" type="button" data-findings-toggle aria-expanded="${findingsOpen}">${icon("chev", "icon chev")}${L(findingsOpen ? "findHide" : "findBtn")}</button></p>`;
    let panel = "";
    if (FINDINGS_ON && findingsOpen) {
      const list = findings(items, goalInfo).map((f) => `<li>${f}</li>`).join("");
      const news = window.STUDIO_NEWS || { items: [], updated: "" };
      const picks = (news.items || []).filter((n) => filter === "all" ? true : (n.dept === filter || n.dept === "all"));
      const newsHtml = picks.length ? picks.map((n) => `
        <article class="news">
          <h4>${esc(n.title)}</h4>
          <p>${esc(n.summary)}</p>
          <p class="news-meta"><span class="tag">${esc(L(n.trust === "official" ? "trustOfficial" : "trustSecondary"))}</span>${n.date ? `<span>${esc(n.date)}</span>` : ""}<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.source)} · ${L("readSource")}</a></p>
        </article>`).join("") : `<p class="muted">${L("newsEmpty")}</p>`;
      panel = `<div class="findings">
        ${trendsHtml(filter)}
        <div class="find-col"><h3>${L("findHead")}</h3><ul class="find-list">${list}</ul><p class="muted">${L("findExport")}</p></div>
        <div class="find-col"><h3>${L("findNewsHead")}</h3><p class="muted">${t("findNewsNote", { date: news.updated || "-" })}</p>${newsHtml}</div>
      </div>`;
    }
    return `<div class="home-stats">${kpis}${goalHtml}${toggle}${panel}</div>`;
  }

  // the controls (department bar) and the five lanes; the home page puts them under the company map
  function boardParts() {
    let filter = "all";
    try { filter = localStorage.getItem("bellstudio:board") || "all"; } catch { /* ignore */ }
    const scoped = filter.startsWith("ch:") ? channel(filter.slice(3)) : filter.startsWith("wk:") ? work(filter.slice(3)) : null;
    if (filter !== "all" && !dept(filter) && !scoped) filter = "all";
    // the department bar: a sliding highlight picks the department, each tab shows how many clips are still open
    const tabStats = (pred) => {
      const eps = S().episodes.filter(pred);
      return { open: eps.filter((e) => e.stage !== "published").length, doing: eps.filter((e) => IN_PROGRESS.includes(e.stage)).length, quiet: eps.filter(isIdle).length };
    };
    const tab = (key, iconHtml, label, st, color) => `
      <button class="dtab" type="button" data-board-filter="${esc(key)}" aria-pressed="${filter === key}" style="--c:${color}">
        ${iconHtml}<span class="dtab-name">${esc(label)}</span>
        <span class="dtab-meta">${st.doing ? `<i class="dtab-live" title="${esc(t("mapLive", { n: st.doing }))}"></i>` : ""}${st.quiet ? `<i class="dtab-quiet" title="${esc(t("railIdle", { n: st.quiet, d: IDLE_DAYS }))}"></i>` : ""}<b class="num">${st.open}</b></span>
      </button>`;
    const tabs = [tab("all", "", L("all"), tabStats(() => true), "var(--ink-2)")]
      .concat(S().departments.map((d) => tab(d.id, deptIcon(d.id), d.name, tabStats((e) => deptOfWork(work(e.work)) === d.id), `var(--d-${esc(d.id)})`)))
      .concat(scoped ? [tab(filter, "", scoped.name || scoped.title, tabStats((e) => filter.startsWith("ch:") ? work(e.work)?.channel === filter.slice(3) : e.work === filter.slice(3)), "var(--ink-2)")] : []).join("");
    const inScope = (e) => filter === "all" ? true
      : filter.startsWith("ch:") ? work(e.work)?.channel === filter.slice(3)
      : filter.startsWith("wk:") ? e.work === filter.slice(3)
      : deptOfWork(work(e.work)) === filter;
    const items = S().episodes.filter(inScope);
    const focus = boardFocus.stage;
    boardFocus.stage = null;
    const LIMIT = 3;
    const lanes = STAGES.map((s) => {
      let cards = items.filter((e) => e.stage === s);
      // the published lane only grows, so it shows the newest few until asked for more
      let hidden = 0;
      if (s === "published") {
        cards = cards.slice().sort((a, b) => String(b.date || b.updated).localeCompare(String(a.date || a.updated)));
        if (!boardFocus.all && cards.length > LIMIT) { hidden = cards.length - LIMIT; cards = cards.slice(0, LIMIT); }
      }
      const total = items.filter((e) => e.stage === s).length;
      const more = s === "published" && total > LIMIT
        ? `<button class="more-btn" type="button" data-board-more>${hidden ? t("showMore", { n: hidden }) : L("showLess")}</button>` : "";
      return `
        <section aria-label="${stLabel(s)}"${focus === s ? " data-focus" : ""} class="st-${s}">
          <h2 class="lane-title"><span class="status st-${s}"></span>${stLabel(s)} <span class="count num">${total}</span></h2>
          <div class="lane">${cards.length ? cards.map((e) => {
            const w = work(e.work), T = typeOfWork(w);
            return `
              <button class="card" type="button" data-edit-ep="${esc(e.id)}">
                <span class="row-title">${esc(w.title)}</span>
                <span class="row-sub">${esc(epName(T, e))}</span>
                <span class="card-foot"><span>${esc(dept(deptOfWork(w))?.name ?? "")}</span><span class="num">${esc(fmtDate(e.date || e.updated))}</span></span>
              </button>`;
          }).join("") + more : `<div class="lane-empty" aria-hidden="true"></div>`}</div>
        </section>`;
    }).join("");
    const idleN = items.filter(isIdle).length;
    const quiet = idleN ? `<p class="rail-note"><span class="quiet-ring"></span>${t("railIdle", { n: idleN, d: IDLE_DAYS })}</p>` : "";
    // the five circles sit right over their columns and work as the column headers
    const counts = STAGES.map((st) => items.filter((e) => e.stage === st).length);
    const heads = STAGES.map((st, i) => `
      <div class="bh-cell">
        <button class="flow-stage st-${st}${counts[i] ? "" : " zero"}${IN_PROGRESS.includes(st) && counts[i] ? " active" : ""}${focus === st ? " picked" : ""}" type="button" data-lane-focus="${st}" title="${esc(t("flowOpen", { stage: stLabel(st) }))}">
          <span class="flow-node"><span class="flow-num">${counts[i]}</span></span>
          <span class="flow-label">${stLabel(st)}</span>
        </button>${i < STAGES.length - 1 ? `<span class="flow-link bh-link${counts[i] ? " moving" : ""}" aria-hidden="true"></span>` : ""}
      </div>`).join("");
    const nextLine = flowNextLine(items);
    const pageLink = dept(filter) ? `<p class="deptlink"><a href="#/dept/${esc(filter)}">${t("openDept", { name: dept(filter).name })}${icon("chev", "icon chev")}</a></p>` : "";
    return {
      controls: `<div class="deptbar-wrap"><div class="deptbar" role="group" aria-label="${esc(L("departments"))}"><span class="deptbar-ind" aria-hidden="true"></span>${tabs}</div></div>${quiet}${pageLink}${homeStats(items, filter)}`,
      lanes: `<section class="band gray"><div class="inner wide">
        ${nextLine ? `<p class="flow-next board-next">${nextLine}</p>` : ""}
        <div class="board-head" role="group" aria-label="${esc(L("flowAria"))}">${heads}</div>
        <div class="board">${lanes}</div></div></section>`
    };
  }

  // ---------- cost and results (v1.0): tables for a set of episodes ----------
  // results depend on the kind of channel: selling channels count orders, content channels count followers and watch time
  const STAT_KEYS = ["views", "likes", "comments", "shares", "saves", "orders", "followers", "watch"];
  const SELL_TYPES = ["affiliate", "live"];
  const statApplies = (k, type) => (k === "orders" ? SELL_TYPES.includes(type) : (k === "followers" || k === "watch") ? !SELL_TYPES.includes(type) : true);
  const typeOfEp = (e) => channel(work(e.work)?.channel)?.type;
  const kindsOf = (types) => { const sell = types.some((t0) => SELL_TYPES.includes(t0)), content = types.some((t0) => !SELL_TYPES.includes(t0)); return sell || content ? { sell, content } : { sell: true, content: true }; };
  const numOf = (v) => (v === "" || v == null || isNaN(+v) ? null : +v);
  const nf = () => new Intl.NumberFormat(lang === "th" ? "th-TH" : "en-US", { maximumFractionDigits: 0 });
  const showNum = (v) => (v == null ? "—" : nf().format(v));
  const showBaht = (v) => (v == null ? "—" : "฿" + nf().format(v));
  const sumOf = (list, pick) => list.reduce((a, e) => a + (numOf(pick(e)) || 0), 0);
  const countOf = (list, pick) => list.filter((e) => numOf(pick(e)) != null).length;
  const avgOf = (list, pick) => { const k = countOf(list, pick); return k ? sumOf(list, pick) / k : null; };
  function perfParts(eps) {
    const pubs = eps.filter((e) => e.stage === "published").sort((a, b) => String(b.date || b.updated).localeCompare(String(a.date || a.updated)));
    const spend = countOf(eps, (e) => e.cost) ? sumOf(eps, (e) => e.cost) : null;
    const views = countOf(pubs, (e) => e.stats?.views) ? sumOf(pubs, (e) => e.stats?.views) : null;
    const costPub = avgOf(pubs, (e) => e.cost);
    const kind = kindsOf(eps.map(typeOfEp));
    const tile = (v, label) => `<div class="kpi"><div class="kpi-num">${v}</div><div class="kpi-label">${label}</div></div>`;
    const kpis = `<div class="kpis">${tile(showBaht(spend), L("kpiSpend"))}${tile(showNum(pubs.length), L("kpiClips"))}${tile(showBaht(costPub), L("kpiAvgCost"))}${tile(showNum(views), L("kpiViews"))}</div>`;
    const head = (cols) => `<thead><tr>${cols.map(([k, num]) => `<th${num ? ' class="n"' : ""}>${L(k)}</th>`).join("")}</tr></thead>`;
    const clipRows = pubs.map((e) => {
      const w = work(e.work);
      return `<tr>
        <td><button class="link" type="button" data-edit-ep="${esc(e.id)}">${esc(epCode(e))}</button><span class="sub">${esc(e.format || L("tNoFormat"))}${e.title ? " — " + esc(e.title) : ""}</span></td>
        <td>${esc(w.title)}</td>
        <td class="num">${e.date ? esc(fmtDate(e.date)) : "—"}</td>
        <td class="n">${numOf(e.length) != null ? showNum(+e.length) + "s" : "—"}</td>
        <td class="n">${showBaht(numOf(e.cost))}</td>
        <td class="n">${showNum(numOf(e.stats?.views))}</td>
        ${kind.sell ? `<td class="n">${showNum(numOf(e.stats?.orders))}</td>` : ""}${kind.content ? `<td class="n">${showNum(numOf(e.stats?.followers))}</td><td class="n">${numOf(e.stats?.watch) != null ? showNum(+e.stats.watch) + L("unitSec") : "—"}</td>` : ""}
      </tr>`;
    }).join("");
    const totalRow = pubs.length ? `<tr class="total"><td>${L("tTotal")}</td><td></td><td></td><td></td>
        <td class="n">${showBaht(countOf(pubs, (e) => e.cost) ? sumOf(pubs, (e) => e.cost) : null)}</td>
        <td class="n">${showNum(views)}</td>
        ${kind.sell ? `<td class="n">${showNum(countOf(pubs, (e) => e.stats?.orders) ? sumOf(pubs, (e) => e.stats?.orders) : null)}</td>` : ""}${kind.content ? `<td class="n">${showNum(countOf(pubs, (e) => e.stats?.followers) ? sumOf(pubs, (e) => e.stats?.followers) : null)}</td><td class="n">${avgOf(pubs, (e) => e.stats?.watch) != null ? showNum(avgOf(pubs, (e) => e.stats?.watch)) + L("unitSec") : "—"}</td>` : ""}</tr>` : "";
    const clipsTable = pubs.length
      ? `<div class="tbl"><table>${head([["tClip"], ["tProduct"], ["tPosted"], ["tLength", 1], ["tCost", 1], ["tViews", 1]].concat(kind.sell ? [["tOrders", 1]] : [], kind.content ? [["tFollowers", 1], ["tWatch", 1]] : []))}<tbody>${clipRows}${totalRow}</tbody></table></div>`
      : `<div class="list"><div class="empty">${L("noClipsYet")}</div></div>`;
    // group the published clips by format so the kinds of clip can be compared
    const groups = {};
    pubs.forEach((e) => { (groups[e.format || ""] = groups[e.format || ""] || []).push(e); });
    const fmtRows = Object.keys(groups).map((k) => {
      const g = groups[k];
      return `<tr><td>${esc(k || L("tNoFormat"))}</td><td class="n">${showNum(g.length)}</td><td class="n">${showBaht(avgOf(g, (e) => e.cost))}</td><td class="n">${showNum(avgOf(g, (e) => e.stats?.views))}</td>${kind.sell ? `<td class="n">${showNum(countOf(g, (e) => e.stats?.orders) ? sumOf(g, (e) => e.stats?.orders) : null)}</td>` : ""}${kind.content ? `<td class="n">${showNum(countOf(g, (e) => e.stats?.followers) ? sumOf(g, (e) => e.stats?.followers) : null)}</td>` : ""}</tr>`;
    }).join("");
    const fmtTable = pubs.length ? `<div class="tbl"><table>${head([["tFormat"], ["tClips", 1], ["tAvgCost", 1], ["tAvgViews", 1]].concat(kind.sell ? [["tOrders", 1]] : [], kind.content ? [["tFollowers", 1]] : []))}<tbody>${fmtRows}</tbody></table></div>` : "";
    return { kpis, clipsTable, fmtTable, pubs, kind, groups };
  }

  // weekly bars for the last eight weeks, with the goal as a dashed line
  function cadenceHtml(d, eps) {
    const pubs = eps.filter((e) => e.stage === "published" && e.date);
    const start = new Date(thisWeek().from + "T00:00:00");
    const goal = +d.weeklyGoal || 0;
    const weeks = Array.from({ length: 8 }, (_, k) => {
      const s0 = new Date(start); s0.setDate(start.getDate() - 7 * (7 - k));
      const s1 = new Date(s0); s1.setDate(s0.getDate() + 6);
      const from = ymd(s0), to = ymd(s1);
      return { from, to, label: `${s0.getDate()}/${s0.getMonth() + 1}`, n: pubs.filter((e) => e.date >= from && e.date <= to).length, now: k === 7 };
    });
    const max = Math.max(goal, ...weeks.map((x) => x.n), 1);
    const bars = weeks.map((x) => `<div class="wk-col${x.now ? " now" : ""}" title="${esc(x.from)} – ${esc(x.to)}: ${x.n}"><span class="wk-n num">${x.n || ""}</span><i class="${x.n ? "" : "z"}" style="height:${x.n ? Math.max(8, x.n / max * 100) : 3}%"></i></div>`).join("");
    const labels = weeks.map((x) => `<span class="${x.now ? "now" : ""}">${x.now ? L("cadenceNow") : x.label}</span>`).join("");
    const line = goal ? `<div class="wk-goal" style="bottom:${goal / max * 100}%"><span>${t("cadenceGoal", { n: goal })}</span></div>` : "";
    return `<div class="wk"><div class="wk-plot">${line}${bars}</div><div class="wk-labels">${labels}</div></div>
      <p class="muted-line">${pubs.length ? L("cadenceSub") : L("cadenceEmpty")}</p>`;
  }

  function viewDept(id) {
    const d = dept(id);
    const chans = S().channels.filter((c) => c.dept === id);
    const ids = chans.map((c) => c.id);
    const workCount = S().works.filter((w) => ids.includes(w.channel)).length;
    const deptEps = S().episodes.filter((e) => ids.includes(work(e.work)?.channel));
    const perf = perfParts(deptEps);

    // formats ranked by average views; the label on the right depends on what this kind of channel earns
    const rank = Object.keys(perf.groups).map((k) => {
      const g = perf.groups[k], sell = g.some((e) => SELL_TYPES.includes(typeOfEp(e)));
      const orders = sumOf(g, (e) => e.stats?.orders), costed = g.filter((e) => numOf(e.cost) != null);
      const fol = countOf(g, (e) => e.stats?.followers) ? sumOf(g, (e) => e.stats?.followers) : null;
      const side = sell ? (orders > 0 && costed.length ? t("perfOrder", { c: showBaht(sumOf(costed, (e) => e.cost) / orders) }) : "—") : (fol != null ? t("perfFollow", { n: showNum(fol) }) : "—");
      return { k: k || L("tNoFormat"), v: avgOf(g, (e) => e.stats?.views), n: g.length, side };
    }).filter((x) => x.v != null).sort((p, q) => q.v - p.v);
    const topV = rank.length ? rank[0].v : 1;
    const fmtBars = rank.length ? rank.map((x) => `
      <div class="rk"><span class="rk-name">${esc(x.k)}${x.n < 3 ? ` <em>${L("perfSmall")}</em>` : ""}</span><span class="rk-bar"><i style="width:${Math.max(3, x.v / topV * 100)}%"></i></span><span class="rk-val num">${showNum(x.v)}</span><span class="rk-side">${x.side}</span></div>`).join("") : `<p class="muted-line">${L("perfNone")}</p>`;
    const topClips = perf.pubs.filter((e) => numOf(e.stats?.views) != null).sort((p, q) => q.stats.views - p.stats.views).slice(0, 5);
    const topHtml = topClips.length ? topClips.map((e, k) => `
      <button class="rk-clip" type="button" data-edit-ep="${esc(e.id)}"><b class="num">${k + 1}</b><span><strong>${esc(work(e.work).title)}</strong><em>${esc(epName(typeOfWork(work(e.work)), e, false))}</em></span><span class="num">${showNum(+e.stats.views)}</span></button>`).join("") : `<p class="muted-line">${L("perfNone")}</p>`;

    const chanCards = chans.map((c) => {
      const eps = deptEps.filter((e) => work(e.work)?.channel === c.id);
      const bar = eps.length ? STAGES.map((st) => { const k = eps.filter((e) => e.stage === st).length; return k ? `<i class="st-${st}" style="flex:${k}"></i>` : ""; }).join("") : "";
      const pubN = eps.filter((e) => e.stage === "published").length;
      const spend = countOf(eps, (e) => e.cost) ? sumOf(eps, (e) => e.cost) : null;
      const views = countOf(eps, (e) => e.stats?.views) ? sumOf(eps, (e) => e.stats?.views) : null;
      return `
        <a class="chan-card" href="#/channel/${esc(c.id)}">
          <span class="chan-name">${esc(c.name)}${c.status && c.status !== "active" ? ` <span class="status st-${esc(c.status)}">${stLabel(c.status)}</span>` : ""}</span>
          <span class="chan-sub">${esc([platformShown(c, d), L("type_" + c.type)].filter(Boolean).join(" · "))}</span>
          <span class="flow-bar mini" aria-hidden="true">${bar}</span>
          <span class="chan-line">${esc([n(worksOf(c.id).length, "work"), n(eps.length, "ep"), t("dcPub", { pub: pubN })].join(" · "))}</span>
          <span class="chan-line">${showBaht(spend)} · ${showNum(views)} ${L("kpiViews").toLowerCase()}</span>
        </a>`;
    }).join("") + `<button class="chan-card chan-new" type="button" data-new-channel="" data-dept="${esc(id)}">${icon("plus")}<span>${L("chNew")}</span></button>`;

    const checks = (d.rules || []).length ? d.rules.map((r) => `<label class="ck-row"><input type="checkbox"><span>${esc(r)}</span></label>`).join("") : `<p class="muted-line">${t("noRules")}</p>`;
    return hero({
      titleLogo: id,
      title: d.name,
      lede: `<strong>${esc(d.mission)}</strong>`,
      actions: btn(L("editDept"), `data-edit-dept="${esc(id)}"`, "btn-outline", "edit"),
      stats: `<p class="flow-facts">${esc(n(chans.length, "channel"))} · ${esc(n(workCount, "work"))}</p>`
    }) + `
      <section class="band">
        <div class="inner wide">
          <div class="sec-head"><h2>${L("secCadence")}</h2></div>
          ${cadenceHtml(d, deptEps)}
        </div>
      </section>
      <section class="band gray">
        <div class="inner wide">
          <div class="sec-head"><h2>${L("secWorking")}</h2></div>
          ${perf.kpis}
          <div class="working" style="--c: var(--d-${esc(id)})">
            <div class="wcard"><h3>${L("perfFormats")}</h3>${fmtBars}</div>
            <div class="wcard"><h3>${L("perfTop")}</h3>${topHtml}</div>
          </div>
          <details class="more perf-all"><summary>${L("perfAll")}${perf.pubs.length ? ` (${perf.pubs.length})` : ""}</summary>
            <div class="more-body">${perf.clipsTable}${perf.fmtTable}<p class="priv">${L("privNote")}</p></div>
          </details>
        </div>
      </section>
      <section class="band">
        <div class="inner wide">
          <div class="sec-head"><h2>${t("secChannels")}${chans.length ? ` <span class="count num">${chans.length}</span>` : ""}</h2></div>
          <div class="chan-grid">${chanCards}</div>
        </div>
      </section>
      <section class="band gray">
        <div class="inner wide">
          <div class="cols two-up">
            <div class="col"><h3>${L("secPlaybook")}</h3><p class="muted-line">${L("playbookSub")}</p><div class="ck-list">${checks}</div></div>
            <div class="col"><h3>${L("secTeamSkills")}</h3>
              <ul>${d.roles.map((r) => `<li><strong>${esc(r.title)}</strong> ${esc(r.duty)}</li>`).join("") || `<li>${t("noRoles")}</li>`}</ul>
              <div class="skills">${d.skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("") || `<span class="hint">${t("noSkills")}</span>`}</div>
            </div>
          </div>
        </div>
      </section>`;
  }

  // ---------- library: everything ever made, searchable, so old clips and products can be found and reused ----------
  const lib = { tab: "products", q: "", dept: "all", stage: "all", format: "all", sort: "new", limit: 40 };
  const hay = (...parts) => parts.filter(Boolean).join(" ").toLowerCase();
  const viewsOf = (eps) => sumOf(eps.filter((e) => e.stage === "published"), (e) => e.stats?.views);
  function libItems() {
    const q = lib.q.trim().toLowerCase();
    const deptOk = (wk) => lib.dept === "all" || deptOfWork(wk) === lib.dept;
    if (lib.tab === "products") {
      return S().works.filter(deptOk).map((wk) => {
        const eps = epsOf(wk.id), c = channel(wk.channel), d = dept(c?.dept);
        const dates = eps.filter((e) => e.stage === "published" && e.date).map((e) => e.date).sort();
        const key = hay(wk.title, workCode(wk), wk.summary, wk.note, c?.name, d?.name, wk.props?.category, wk.props?.genre, ...eps.map((e) => e.format), ...eps.map((e) => e.title));
        return { wk, eps, c, d, first: dates[0], last: dates[dates.length - 1], key, sort: eps.reduce((m, e) => (e.updated > m ? e.updated : m), wk.updated || "") };
      }).filter((x) => !q || x.key.includes(q)).sort((p, r) => {
        if (lib.sort === "views") return viewsOf(r.eps) - viewsOf(p.eps);
        if (lib.sort === "clips") return r.eps.length - p.eps.length;
        return String(r.sort).localeCompare(String(p.sort));
      });
    }
    return S().episodes.filter((e) => {
      const wk = work(e.work);
      if (!wk || !deptOk(wk)) return false;
      if (lib.stage !== "all" && e.stage !== lib.stage) return false;
      if (lib.format !== "all" && (e.format || "") !== lib.format) return false;
      return !q || hay(epCode(e), e.format, e.title, e.summary, e.note, e.engine, wk.title, channel(wk.channel)?.name, dept(deptOfWork(wk))?.name).includes(q);
    }).sort((p, r) => lib.sort === "views" ? (numOf(r.stats?.views) || 0) - (numOf(p.stats?.views) || 0) : String(r.date || r.updated).localeCompare(String(p.date || p.updated)));
  }
  function libResultsHtml() {
    const items = libItems(), shown = items.slice(0, lib.limit);
    if (!items.length) return `<p class="lib-none">${L("libNone")}</p>`;
    const rows = lib.tab === "products" ? shown.map(({ wk, eps, c, d, first, last }) => {
      const pub = eps.filter((e) => e.stage === "published");
      const views = countOf(pub, (e) => e.stats?.views) ? sumOf(pub, (e) => e.stats?.views) : null;
      const src = imageSrc(wk.cover);
      return `
        <div class="lib-row">
          <a class="lib-main" href="#/work/${esc(wk.id)}">
            <span class="lib-thumb">${imgTag(src, wk.title) || icon("photo")}</span>
            <span class="lib-text">
              <strong>${esc(wk.title)}</strong>
              <em>${esc([workCode(wk), d?.name, c?.name, wk.props?.category || wk.props?.genre].filter(Boolean).join(" · "))}</em>
              <em>${esc(t("libClipsOf", { p: pub.length, n: eps.length }))} · ${last ? esc(L("libFirst") + " " + fmtDate(first) + " · " + L("libLast") + " " + fmtDate(last)) : esc(L("libNever"))}</em>
            </span>
          </a>
          <span class="lib-num num">${views == null ? "" : showNum(views) + " " + esc(L("kpiViews").toLowerCase())}</span>
          ${safeLink(wk.folder) ? `<a class="btn btn-outline lib-btn" href="${esc(safeLink(wk.folder))}" target="_blank" rel="noopener">${esc(L("libFolder"))}</a>` : ""}
          <button class="btn btn-outline lib-btn" type="button" data-lib-newclip="${esc(wk.id)}">${icon("plus")}${L("libNewClip")}</button>
        </div>`;
    }).join("") : shown.map((e) => {
      const wk = work(e.work), d = dept(deptOfWork(wk));
      const bits = [numOf(e.stats?.views) != null ? showNum(+e.stats.views) + " " + L("kpiViews").toLowerCase() : "", numOf(e.stats?.orders) != null ? showNum(+e.stats.orders) + " " + L("kpiOrders").toLowerCase() : "", numOf(e.cost) != null ? showBaht(+e.cost) : ""].filter(Boolean).join(" · ");
      return `
        <div class="lib-row">
          <button class="lib-main" type="button" data-edit-ep="${esc(e.id)}">
            <span class="status st-${esc(e.stage)} lib-dot"><span class="visually-hidden">${stLabel(e.stage)}</span></span>
            <span class="lib-text">
              <strong>${esc(wk.title)}</strong>
              <em>${esc(epName(typeOfWork(wk), e))}</em>
              <em>${esc([d?.name, channel(wk.channel)?.name, stLabel(e.stage), e.date ? fmtDate(e.date) : ""].filter(Boolean).join(" · "))}</em>
            </span>
          </button>
          <span class="lib-num num">${esc(bits)}</span>
          <button class="btn btn-outline lib-btn" type="button" data-lib-reuse="${esc(e.id)}" title="${esc(L("libReuseTip"))}">${icon("plus")}${L("libReuse")}</button>
        </div>`;
    }).join("");
    const more = items.length > shown.length ? `<button class="more-btn" type="button" data-lib-more>${t("libMore", { n: items.length - shown.length })}</button>` : "";
    return `<p class="lib-count">${t("libResults", { n: items.length })}</p><div class="lib-list">${rows}</div>${more}`;
  }
  function viewLibrary() {
    const formats = [...new Set(S().episodes.map((e) => e.format).filter(Boolean))].sort();
    const sel = (id, value, opts) => `<select class="select lib-sel" id="${id}" aria-label="${esc(id)}">${opts.map(([v, l]) => `<option value="${esc(v)}"${v === value ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
    const deptSel = sel("lib-dept", lib.dept, [["all", L("libAllDepts")]].concat(S().departments.map((d) => [d.id, d.name])));
    const sortOpts = lib.tab === "products" ? [["new", L("sortNew")], ["views", L("sortViews")], ["clips", L("sortClips")]] : [["new", L("sortNew")], ["views", L("sortViews")]];
    const sortSel = sel("lib-sort", sortOpts.some(([v]) => v === lib.sort) ? lib.sort : "new", sortOpts);
    const clipSel = lib.tab === "clips"
      ? sel("lib-stage", lib.stage, [["all", L("libAllStages")]].concat(STAGES.map((s) => [s, stLabel(s)]))) + sel("lib-format", lib.format, [["all", L("libAllFormats")]].concat(formats.map((f) => [f, f])))
      : "";
    const tabs = [["products", "libProducts", S().works.length], ["clips", "libClips", S().episodes.length]].map(([k, key, cnt]) =>
      `<button class="dtab" type="button" data-lib-tab="${k}" aria-pressed="${lib.tab === k}" style="--c: var(--ink-2)"><span class="dtab-name">${L(key)}</span><span class="dtab-meta"><b class="num">${cnt}</b></span></button>`).join("");
    return hero({
      hideTitle: true,
      title: L("library"),
      after: `<div class="deptbar-wrap"><div class="deptbar" role="group" aria-label="${esc(L("library"))}"><span class="deptbar-ind" aria-hidden="true"></span>${tabs}</div></div>
        <div class="lib-tools"><input class="input lib-q" id="lib-q" type="search" value="${esc(lib.q)}" placeholder="${esc(L("libSearch"))}" autocomplete="off">${deptSel}${clipSel}${sortSel}</div>`
    }) + `<section class="band gray"><div class="inner wide"><div id="lib-results">${libResultsHtml()}</div></div></section>`;
  }
  function reuseClip(id) {
    const src = episode(id);
    if (!src) return;
    let code = "";
    store.mutate((s) => {
      const wk = s.works.find((x) => x.id === src.work);
      wk.epSeq = Math.max(wk.epSeq || 0, ...s.episodes.filter((x) => x.work === wk.id).map((x) => x.n || 0)) + 1;
      const copy = { id: `e-${store.rid()}`, work: src.work, n: wk.epSeq, format: src.format || "", title: src.title || "", summary: src.summary || "", stage: "idea", date: "", link: "", note: src.note || "", updated: store.today(), length: src.length || "", engine: src.engine || "", cost: "", stats: {}, statsAt: "" };
      s.episodes.push(copy);
      code = epCode(copy);
    });
    say(t("libReused", { code }));
    go(`#/work/${src.work}`);
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
    const context = `${deptIcon(d.id)}<a href="#/dept/${esc(d.id)}">${esc(d.name)}</a>${sep}<a href="#/channel/${esc(c.id)}">${esc(c.name)}</a>${sep}<span class="code">${esc(workCode(w))}</span>`;
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
    const details = factList([...detailRows, safeLink(w.folder) ? [L("w_folder"), `<a href="${esc(safeLink(w.folder))}" target="_blank" rel="noopener">${esc(L("libFolder"))}</a>`] : null, w.note ? [L("f_note"), esc(w.note)] : null, [L("e_work"), `<span class="num">${esc(fmtDate(w.updated))}</span>`]]);
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

  // the highlight under the pressed department tab; it starts where it was before the render so it slides
  let barPrev = null;
  function placeDeptbar() {
    const bar = main.querySelector(".deptbar");
    if (!bar) { barPrev = null; return; }
    const on = bar.querySelector('.dtab[aria-pressed="true"]'), ind = bar.querySelector(".deptbar-ind");
    if (!on || !ind) return;
    const to = { x: on.offsetLeft, w: on.offsetWidth, c: on.style.getPropertyValue("--c") };
    const set = (p) => { ind.style.transform = `translateX(${p.x}px)`; ind.style.width = p.w + "px"; ind.style.setProperty("--c", p.c); };
    if (barPrev && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      set(barPrev); ind.getBoundingClientRect(); ind.classList.add("slide");
      setTimeout(() => set(to), 30);
    } else set(to);
    ind.classList.add("ready");
    barPrev = to;
    on.scrollIntoView({ inline: "center", block: "nearest" });
  }

  function render() {
    const r = route();
    renderNav(r);
    main.innerHTML = ribbon() + (
      r.view === "library" ? viewLibrary() :
      r.view === "dept" ? viewDept(r.id) :
      r.view === "channel" ? viewChannel(r.id) :
      r.view === "work" ? viewWork(r.id) : viewNext());
    main.querySelectorAll("img[data-fallback]").forEach((img) => img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), { className: "no-photo", textContent: L("photoUnavailable") }));
    }, { once: true }));
    foot.innerHTML = `${t("foot", { ceo: S().ceo.name, date: fmtDate(S().updated) })} · ${store.hasLocalChanges() ? t("footLocal") : t("footPublished")} · v${esc(window.STUDIO.version || "1.0")}`;
    placeDeptbar();
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
      fieldWrap(L("f_code"), input("code", c.code || "", 'autocomplete="off" maxlength="5" placeholder="AFF" style="text-transform:uppercase"'), `<span>${esc(L("f_codeHint"))}</span>`) +
      fieldWrap(L("f_dept"), select("dept", S().departments.map((d) => ({ id: d.id, label: d.name })), c.dept)) +
      fieldWrap(L("f_platform"), select("platform", platformList(c.dept, c.platform), c.platform || platformList(c.dept)[0]?.id)) +
      fieldWrap(L("f_type"), select("type", typeOptions, c.type), `<span id="type-hint">${esc(L("typeHint_" + c.type))}</span>`) +
      `<details class="more"${isNew ? "" : " open"}><summary>${t("f_moreDetails")}</summary><div class="more-body">${more}</div></details>`;
    const wsHere = isNew ? [] : worksOf(id);
    const nEps = wsHere.reduce((sum, w) => sum + epsOf(w.id).length, 0);
    const cascade = [wsHere.length && n(wsHere.length, "work"), nEps && n(nEps, "ep")].filter(Boolean).join(" + ");
    openInspector(L(isNew ? "newChannel" : "editChannel"), body, {
      onSave(form) {
        if (!required(form, "name", "errName")) return;
        const deptPick = form.elements.dept.value;
        const taken = S().channels.filter((x) => x.dept === deptPick && x.id !== id).map((x) => x.code);
        let code = form.elements.code.value.trim().toUpperCase();
        if (!code) code = store.autoCode(form.elements.name.value, taken);
        const codeEl = form.elements.code;
        codeEl.parentElement.querySelector(".error")?.remove();
        if (!/^[A-Z0-9]{2,5}$/.test(code) || taken.includes(code)) {
          codeEl.setAttribute("aria-invalid", "true");
          codeEl.insertAdjacentHTML("afterend", `<span class="error">${t("errCode")}</span>`);
          codeEl.focus();
          return;
        }
        const data = {
          id: isNew ? slug(form.elements.name.value) : id,
          code,
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
        commit((s) => { if (isNew) s.channels.push({ ...data, seq: 0 }); else Object.assign(s.channels.find((x) => x.id === id), data); }, isNew ? "toastChannelAdded" : "toastChannelSaved");
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
        fieldWrap(L("w_folder"), input("folder", v.folder || "", linkAttrs), esc(L("w_folderHint"))) +
        T.fields.map((k) => propInput(k, v.props?.[k] ?? "")).join("") +
        (T.rules ? fieldWrap(L("w_rules"), textarea("rules", v.rules), L("w_rulesHint")) : "") +
        fieldWrap(L("f_note"), textarea("note", v.note, `placeholder="${esc(L("f_notePh"))}"`));
    };
    const readValues = (form) => {
      const v = { props: {} };
      ["title", "summary", "cover", "folder", "rules", "note"].forEach((k) => { v[k] = form.elements[k]?.value ?? ""; });
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
          folder: (v.folder || "").trim(),
          props,
          rules: T.rules ? v.rules.trim() : (w.rules || ""),
          note: v.note.trim(),
          characters: w.characters || [],
          locations: w.locations || [],
          epSeq: w.epSeq || 0,
          updated: store.today()
        };
        commit((s) => {
          // each work gets the next number of its channel and keeps it (a number is never reused)
          if (isNew || w.channel !== chId) {
            const ch = s.channels.find((x) => x.id === chId);
            ch.seq = (ch.seq || 0) + 1;
            data.no = ch.seq;
          } else {
            data.no = w.no;
          }
          if (isNew) {
            s.works.push(data);
            // a product is always sold through at least one clip, so Affiliate works start with one
            if (channel(chId)?.type === "affiliate") {
              data.epSeq = 1;
              s.episodes.push({ id: `e-${store.rid()}`, work: data.id, n: 1, format: "", title: "", summary: "", stage: "idea", date: "", link: "", note: "", updated: store.today() });
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
      ? { work: startWork?.id, n: nextEpNo(startWork.id), format: "", title: "", length: "", engine: "", cost: "", stats: {}, statsAt: "", summary: "", stage: "idea", date: "", link: "", note: "" }
      : episode(id);
    const workOptions = S().channels.map((c) => ({
      group: `${dept(c.dept)?.name ?? ""} · ${c.name}`,
      items: worksOf(c.id).map((w) => ({ id: w.id, label: w.title }))
    })).filter((g) => g.items.length);
    const stageSeg = `<div class="seg-field five" role="radiogroup" aria-label="${esc(L("e_status"))}">${STAGES.map((s) =>
      `<label><input type="radio" name="stage" value="${s}"${e.stage === s ? " checked" : ""}><span>${stLabel(s)}</span></label>`).join("")}</div>`;
    const body =
      fieldWrap(L("e_work"), select("work", workOptions, e.work)) +
      fieldWrap(L("e_number"), input("n", e.n, 'type="number" readonly tabindex="-1" style="opacity:.7;cursor:not-allowed"'), esc(L("e_numberHint"))) +
      fieldWrap(L("e_format"), input("format", e.format || "", 'autocomplete="off" list="fmt-list"') + `<datalist id="fmt-list">${formatChoices(e.work).map((x) => `<option value="${esc(x)}">`).join("")}</datalist>`, esc(L("e_formatHint"))) +
      fieldWrap(L("e_title"), input("title", e.title, 'autocomplete="off"')) +
      fieldWrap(L("e_summary"), textarea("summary", e.summary, 'style="min-height:72px"')) +
      `<div class="field"><span class="label">${L("e_status")}</span>${stageSeg}</div>` +
      fieldWrap(L("e_date"), input("date", e.date, 'type="date"')) +
      fieldWrap(L("e_link"), input("link", e.link, linkAttrs), esc(L("e_linkHint")) + (safeLink(e.link) ? ` <a href="${esc(safeLink(e.link))}" target="_blank" rel="noopener">${esc(L("openPost"))}</a>` : "")) +
      `<details class="more"${e.cost || e.length || e.engine || Object.keys(e.stats || {}).length ? " open" : ""}><summary>${L("secProd")}</summary><div class="more-body">` +
        `<div class="two">${fieldWrap(L("e_length"), input("dur", e.length ?? "", 'type="number" min="0" inputmode="numeric"'))}${fieldWrap(L("e_cost"), input("cost", e.cost ?? "", 'type="number" min="0" step="any" inputmode="decimal"'), esc(L("e_costHint")))}</div>` +
        fieldWrap(L("e_engine"), input("engine", e.engine || "", 'autocomplete="off"')) +
        `<div class="three">${STAT_KEYS.map((k) => `<div class="stat" data-stat="${k}"${statApplies(k, typeOfEp(e)) ? "" : " hidden"}>${fieldWrap(L("s_" + k), input("s_" + k, e.stats?.[k] ?? "", 'type="number" min="0" inputmode="numeric"'))}</div>`).join("")}</div>` +
        fieldWrap(L("e_statsAt"), input("statsAt", e.statsAt || "", 'type="date"'), esc(L("e_resultsHint"))) +
      `</div></details>` +
      fieldWrap(L("f_note"), textarea("note", e.note, `placeholder="${esc(L("f_notePh"))}"`));
    const T0 = typeOfWork(work(e.work));
    openInspector(L((isNew ? "newEp_" : "editEp_") + T0.noun), body, {
      onSave(f) {
        const data = {
          id: isNew ? `e-${store.rid()}` : id,
          work: f.elements.work.value,
          n: e.n,
          format: f.elements.format.value.trim(),
          title: f.elements.title.value.trim(),
          length: f.elements.dur.value.trim(),
          engine: f.elements.engine.value.trim(),
          cost: f.elements.cost.value.trim(),
          stats: Object.fromEntries(STAT_KEYS.map((k) => [k, f.elements["s_" + k].value.trim()]).filter(([, v]) => v !== "")),
          statsAt: f.elements.statsAt.value,
          summary: f.elements.summary.value.trim(),
          stage: f.querySelector('input[name="stage"]:checked')?.value || "idea",
          date: f.elements.date.value,
          link: f.elements.link.value.trim(),
          note: f.elements.note.value.trim(),
          updated: store.today()
        };
        commit((s) => {
          if (isNew || data.work !== e.work) {
            const wk = s.works.find((x) => x.id === data.work);
            wk.epSeq = Math.max(wk.epSeq || 0, ...s.episodes.filter((x) => x.work === wk.id).map((x) => x.n || 0)) + 1;
            data.n = wk.epSeq;
          }
          if (isNew) s.episodes.push(data); else s.episodes[s.episodes.findIndex((x) => x.id === id)] = data;
        }, isNew ? "toastEpAdded" : "toastEpSaved");
      },
      onDelete: isNew ? null : () => commit((s) => { s.episodes = s.episodes.filter((x) => x.id !== id); }, "toastEpDeleted")
    });
    const form = $("insp-form");
    // the result fields follow the kind of channel the clip belongs to (typed values stay in the hidden ones)
    form.elements.work.addEventListener("change", () => {
      const ty = channel(work(form.elements.work.value)?.channel)?.type;
      form.querySelectorAll(".stat").forEach((el) => { el.hidden = !statApplies(el.dataset.stat, ty); });
    });
    form.elements.work.addEventListener("change", () => {
      $("fmt-list").innerHTML = formatChoices(form.elements.work.value).map((x) => `<option value="${esc(x)}">`).join("");
    });
    if (isNew) {
      form.elements.work.addEventListener("change", () => { form.elements.n.value = nextEpNo(form.elements.work.value); });
      form.elements.format.focus();
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
      fieldWrap(L("f_mission"), textarea("mission", d.mission)) +
      fieldWrap(L("f_goal"), input("goal", d.weeklyGoal || "", 'type="number" min="0" inputmode="numeric"'), L("f_goalHint")) +
      fieldWrap(L("f_platforms"), textarea("platforms", (d.platforms || []).join("\n"), 'style="min-height:72px"'), L("f_platformsHint")) +
      fieldWrap(L("f_team"), textarea("roles", d.roles.map((r) => `${r.title} — ${r.duty}`).join("\n")), L("f_teamHint")) +
      fieldWrap(L("f_rules"), textarea("rules", d.rules.join("\n")), L("f_rulesHint")) +
      fieldWrap(L("f_skills"), textarea("skills", d.skills.join("\n"), 'style="min-height:80px"'), L("f_skillsHint"));
    openInspector(L("editDeptTitle").replace("{name}", d.name), body, {
      onSave(form) {
        const lines = (k) => form.elements[k].value.split("\n").map((x) => x.trim()).filter(Boolean);
        commit((s) => {
          const tgt = s.departments.find((x) => x.id === id);
          tgt.mission = form.elements.mission.value.trim();
          tgt.weeklyGoal = Math.max(0, parseInt(form.elements.goal.value, 10) || 0);
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
    if ("deptToggle" in ds) {
      const group = el.closest("[data-dept-group]"), subs = group.querySelector(".menu-subs");
      const open = subs.hidden;
      subs.hidden = !open;
      el.setAttribute("aria-expanded", String(open));
      if (open) menuOpen.add(ds.deptToggle); else menuOpen.delete(ds.deptToggle);
      return;
    }
    if ("flowStage" in ds) {
      try { localStorage.setItem("bellstudio:board", ds.flowScope || "all"); } catch { /* ignore */ }
      boardFocus.stage = ds.flowStage;
      location.hash = "#/next";
      return;
    }
    if ("libTab" in ds) { lib.tab = ds.libTab; lib.limit = 40; return render(); }
    if ("libMore" in ds) { lib.limit += 40; $("lib-results").innerHTML = libResultsHtml(); return; }
    if ("libReuse" in ds) return reuseClip(ds.libReuse);
    if ("libNewclip" in ds) return editEpisode(null, { work: ds.libNewclip });
    if ("findingsToggle" in ds) { findingsOpen = !findingsOpen; return render(); }
    if ("laneFocus" in ds) {
      boardFocus.stage = boardFocus.stage === ds.laneFocus ? null : ds.laneFocus;
      render();
      const lane = main.querySelector("[data-focus]");
      if (lane && window.matchMedia("(max-width: 980px)").matches) lane.scrollIntoView({ block: "start" });
      return;
    }
    if ("boardMore" in ds) { boardFocus.all = !boardFocus.all; return render(); }
    if ("boardFilter" in ds) { e.preventDefault(); try { localStorage.setItem("bellstudio:board", ds.boardFilter); } catch { /* ignore */ } return render(); }

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

  document.addEventListener("input", (e) => {
    if (e.target.id !== "lib-q") return;
    lib.q = e.target.value; lib.limit = 40;
    $("lib-results").innerHTML = libResultsHtml();
  });
  document.addEventListener("change", (e) => {
    const id = e.target.id;
    if (id === "lib-dept") { lib.dept = e.target.value; lib.limit = 40; render(); }
    else if (id === "lib-stage") { lib.stage = e.target.value; lib.limit = 40; render(); }
    else if (id === "lib-format") { lib.format = e.target.value; lib.limit = 40; render(); }
    else if (id === "lib-sort") { lib.sort = e.target.value; lib.limit = 40; render(); }
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
    if (lane) lane.scrollIntoView({ block: "start" });
  });
  render();
})();
