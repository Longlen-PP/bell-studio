// Bell Studio dashboard — renders from BellStore and edits it through the inspector.
// Hierarchy: department → channel → (product, for "shop" channels) → work/clip.
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
  // t() returns HTML: the template is trusted, every variable is escaped
  const t = (key, vars = {}) => {
    const s = window.BELL_I18N[lang][key] ?? window.BELL_I18N.en[key] ?? key;
    return typeof s === "string" ? s.replace(/\{(\w+)\}/g, (_, k) => esc(vars[k] ?? "")) : s;
  };
  const n = (count, unit) => {
    const [one, many] = t(`n_${unit}`);
    return `${count} ${count === 1 ? one : many}`;
  };
  function setLang(next) {
    lang = next;
    try { localStorage.setItem("bellstudio:lang", next); } catch { /* ignore */ }
    document.documentElement.lang = next;
    render();
  }
  document.documentElement.lang = lang;

  const STAGES = ["idea", "doing", "done"];
  const STATUSES = ["active", "planned", "paused", "unconfirmed"];
  const stLabel = (id) => t(`st_${id}`);

  // ---------- data helpers ----------
  const S = () => store.get();
  const dept = (id) => S().departments.find((d) => d.id === id);
  const channel = (id) => S().channels.find((c) => c.id === id);
  const product = (id) => S().products.find((p) => p.id === id);
  const deptOf = (work) => channel(work.channel)?.dept;
  const worksIn = (pred) => S().pipeline.map((w, i) => ({ ...w, _i: i })).filter(pred);
  const fmtDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${+m[3]} ${t("months")[+m[2] - 1]} ${m[1]}` : "";
  };
  const slug = (name) => {
    const base = String(name).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "item";
    return `${base}-${Math.random().toString(36).slice(2, 6)}`;
  };
  const pathOf = (w) => {
    const c = channel(w.channel), d = c && dept(c.dept), p = w.product && product(w.product);
    return [d?.name, c?.name, p?.name].filter(Boolean).join(" › ");
  };

  // Google Drive share link → direct thumbnail; any other https image URL passes through.
  function imageSrc(link) {
    const s = String(link || "").trim();
    if (!s) return "";
    const m = s.match(/\/file\/d\/([\w-]{15,})/) || s.match(/[?&]id=([\w-]{15,})/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w1600`;
    return /^https:\/\//i.test(s) ? s : "";
  }

  const ICONS = {
    plus: '<path d="M12 5v14M5 12h14"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    down: '<path d="M6 9l6 6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8"/>',
    menu: '<path d="M4 8h16M4 16h16"/>'
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
    if (view === "product" && product(id)) return { view: "product", id };
    return { view: "next" };
  }
  const go = (hash) => { if (location.hash !== hash) location.hash = hash; else render(); };

  // ---------- floating bar ----------
  function renderNav(r) {
    const cur = (cond) => (cond ? ' aria-current="page"' : "");
    const inDept = ["dept", "channel", "product"].includes(r.view);
    const deptMenu = S().departments.map((d) => `
      <div class="menu-group" style="--c: var(--d-${esc(d.id)})">
        <a class="menu-link" href="#/dept/${esc(d.id)}"><span class="dot"></span>${esc(d.name)}<span class="muted">${esc(d.head.name)}</span></a>
        ${S().channels.filter((c) => c.dept === d.id).map((c) => `<a class="menu-link sub" href="#/channel/${esc(c.id)}">${esc(c.name)}</a>`).join("")}
        <button class="menu-link add" type="button" data-new-channel="${esc(d.id)}">${t("newChannel")}</button>
      </div>`).join("");
    const hasCh = S().channels.length > 0;
    const newMenu = `
      <div class="menu-group">
        ${hasCh ? `<button class="menu-link" type="button" data-new-work="">${t("newIdea")}</button>` : ""}
        ${S().channels.some((c) => c.kind === "shop") ? `<button class="menu-link" type="button" data-new-product="${esc(S().channels.find((c) => c.kind === "shop").id)}">${t("newProduct")}</button>` : ""}
        <button class="menu-link" type="button" data-new-channel="">${t("newChannel")}</button>
      </div>`;

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
          <div class="lang" role="group" aria-label="${t("langLabel")}">
            <button type="button" data-lang="th" aria-pressed="${lang === "th"}">TH</button>
            <button type="button" data-lang="en" aria-pressed="${lang === "en"}">EN</button>
          </div>
          <div style="position:relative">
            <button class="btn btn-sm" type="button" data-pop="new" aria-expanded="false" aria-controls="pop-new">${icon("plus")}${t("new")}</button>
            <div class="popover" id="pop-new" hidden style="right:0">${newMenu}</div>
          </div>
          <button class="icon-btn menu-toggle" type="button" data-menu aria-label="${t("menu")}" aria-expanded="false" aria-controls="nav-links">${icon("menu")}</button>
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

  function hero({ logo = false, context = "", title, lede = "", actions = "", stats = null, after = "" }) {
    return `
      <section class="band hero">
        <div class="inner">
          ${logo ? `<span class="logo-full" role="img" aria-label="${esc(S().company.name)}"></span>` : ""}
          ${context ? `<div class="context">${context}</div>` : ""}
          <h1>${esc(title)}</h1>
          ${lede ? `<p class="lede">${lede}</p>` : ""}
          ${actions ? `<div class="hero-actions">${actions}</div>` : ""}
          ${after}
          ${stats ? `<div class="stats">${stats.map(([num, label]) => `<div><div class="stat-num">${num}</div><div class="stat-label">${label}</div></div>`).join("")}</div>` : ""}
        </div>
      </section>`;
  }

  const btn = (label, attrs, kind = "", ic = "plus") =>
    `<button class="btn ${kind}" type="button" ${attrs}>${ic ? icon(ic) : ""}${label}</button>`;

  function workRow(w) {
    return `
      <button class="row" type="button" data-edit-work="${w._i}">
        <span class="status st-${esc(w.stage)}"><span class="visually-hidden">${stLabel(w.stage)}</span></span>
        <span class="row-main"><span class="row-title">${esc(w.title)}</span><span class="row-sub">${esc(pathOf(w))}</span></span>
        <span class="row-meta num">${esc(fmtDate(w.updated))}</span>${icon("chev", "icon chev")}
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

  // ---------- views ----------
  function viewNext() {
    const doing = worksIn((w) => w.stage === "doing");
    const ideas = worksIn((w) => w.stage === "idea");
    const doneAll = worksIn((w) => w.stage === "done");
    const done = doneAll.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 5);
    const lonely = S().departments.filter((d) => !S().channels.some((c) => c.dept === d.id));
    const hasCh = S().channels.length > 0;
    const lonelyRows = lonely.map((d) => `
      <button class="row" type="button" data-new-channel="${esc(d.id)}" style="--c: var(--d-${esc(d.id)})">
        <span class="dot"></span>
        <span class="row-main"><span class="row-title">${esc(d.name)}</span><span class="row-sub">${t("needsChannelRow", { head: d.head.name })}</span></span>
        <span class="btn-link">${t("addChannel")}</span>
      </button>`);

    return hero({
      logo: true,
      title: t("upNext"),
      lede: t("nextLede", { doing: n(doing.length, "clip"), ideas: n(ideas.length, "idea"), channels: n(S().channels.length, "channel") }),
      actions: hasCh ? btn(t("newIdea"), 'data-new-work=""') : btn(t("newChannel"), 'data-new-channel=""'),
      stats: [[doing.length, t("statInProgress")], [ideas.length, t("statIdeas")], [doneAll.length, t("statPublished")]]
    }) +
      band(t("secInProgress"), doing.map(workRow), t("emptyInProgress"), { gray: true }) +
      band(t("secIdeas"), ideas.map(workRow), hasCh ? `${t("emptyIdeas")} <button class="btn-link" type="button" data-new-work="">${t("addIdea")}</button>` : t("emptyNoChannels")) +
      (lonely.length ? band(t("secNeedsChannel"), lonelyRows, "", { gray: true }) : "") +
      band(t("secRecent"), done.map(workRow), t("emptyPublished"), { gray: !lonely.length });
  }

  function viewBoard() {
    let filter = "all";
    try { filter = localStorage.getItem("bellstudio:board") || "all"; } catch { /* ignore */ }
    if (filter !== "all" && !dept(filter)) filter = "all";
    const chips = [`<button class="chip" type="button" data-board-filter="all" aria-pressed="${filter === "all"}">${t("all")}</button>`]
      .concat(S().departments.map((d) => `<button class="chip" type="button" data-board-filter="${esc(d.id)}" aria-pressed="${filter === d.id}" style="--c: var(--d-${esc(d.id)})"><span class="dot"></span>${esc(d.name)}</button>`)).join("");
    const items = worksIn((w) => filter === "all" || deptOf(w) === filter);
    const lanes = STAGES.map((s) => {
      const cards = items.filter((w) => w.stage === s);
      return `
        <section aria-label="${stLabel(s)}">
          <div class="lane-head"><span class="status st-${s}"></span><h2>${stLabel(s)}</h2><span class="count num">${cards.length}</span></div>
          <div class="lane">${cards.length ? cards.map((w) => `
            <button class="card" type="button" data-edit-work="${w._i}">
              <span class="row-title">${esc(w.title)}</span>
              <span class="row-sub">${esc(pathOf(w))}</span>
              <span class="card-foot"><span>${esc(dept(deptOf(w))?.head.name ?? "")}</span><span class="num">${esc(fmtDate(w.updated))}</span></span>
            </button>`).join("") : `<div class="empty">${t("nothingHere")}</div>`}</div>
        </section>`;
    }).join("");
    return hero({ title: t("board"), lede: t("boardLede"), after: `<div class="chips" role="group" aria-label="${t("departments")}">${chips}</div>` }) +
      `<section class="band gray"><div class="inner wide"><div class="board">${lanes}</div></div></section>`;
  }

  function viewDept(id) {
    const d = dept(id);
    const chans = S().channels.filter((c) => c.dept === id);
    const prodCount = S().products.filter((p) => chans.some((c) => c.id === p.channel)).length;
    const published = S().pipeline.filter((w) => w.stage === "done" && chans.some((c) => c.id === w.channel)).length;
    const rows = chans.map((c) => {
      const prods = S().products.filter((p) => p.channel === c.id).length;
      const works = S().pipeline.filter((w) => w.channel === c.id).length;
      const bits = [c.platform, c.kind === "shop" ? n(prods, "product") : null, n(works, "clip")].filter(Boolean).join(" · ");
      return `
        <a class="row" href="#/channel/${esc(c.id)}">
          <span class="row-main"><span class="row-title">${esc(c.name)}</span><span class="row-sub">${esc(bits)}</span></span>
          <span class="status st-${esc(c.status)}">${stLabel(c.status)}</span>${icon("chev", "icon chev")}
        </a>`;
    });
    return hero({
      context: `<span class="dot" style="--c: var(--d-${esc(id)})"></span>${esc(d.head.name)}`,
      title: d.name,
      lede: `${esc(d.head.persona)} — <strong>${esc(d.mission)}</strong>`,
      actions: btn(t("newChannel"), `data-new-channel="${esc(id)}"`) + btn(t("editDept"), `data-edit-dept="${esc(id)}"`, "btn-outline", "edit"),
      stats: [[chans.length, t("statChannels")], [prodCount, t("statProducts")], [published, t("statClipsPublished")]]
    }) +
      band(t("secChannels"), rows, `${t("noChannelYet", { head: d.head.name })} <button class="btn-link" type="button" data-new-channel="${esc(id)}">${t("addChannel")}</button>`, { gray: true }) + `
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

  const photoImg = (p) => {
    const src = imageSrc(p.image);
    return src ? `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" data-fallback>` : "";
  };

  function viewChannel(id) {
    const c = channel(id), d = dept(c.dept);
    const context = `<a href="#/dept/${esc(d.id)}">${esc(d.name)}</a><span class="sep">·</span>${esc(c.platform)}<span class="sep">·</span><span class="status st-${esc(c.status)}">${stLabel(c.status)}</span>`;
    const editBtn = btn(t("editChannel"), `data-edit-channel="${esc(id)}"`, "btn-outline", "edit");

    if (c.kind === "shop") {
      const prods = S().products.filter((p) => p.channel === id);
      const loose = worksIn((w) => w.channel === id && !w.product);
      const allClips = S().pipeline.filter((w) => w.channel === id);
      const tiles = prods.map((p) => {
        const clips = S().pipeline.filter((w) => w.product === p.id);
        const live = clips.filter((w) => w.stage === "done").length;
        return `
          <a class="tile" href="#/product/${esc(p.id)}">
            <div class="stage">${photoImg(p) || `<span class="no-photo">${icon("photo")}${t("noPhoto")}</span>`}</div>
            <div class="tile-body">
              <div class="tile-name">${esc(p.name)}</div>
              <div class="tile-meta"><span class="num">${clips.length ? t("clipsOf", { a: live, b: n(clips.length, "clip") }) : t("noClipsYet")}</span><span class="status st-${esc(p.status)}">${stLabel(p.status)}</span></div>
            </div>
          </a>`;
      }).join("");
      return hero({
        context, title: c.name, lede: c.note ? esc(c.note) : "",
        actions: btn(t("newProduct"), `data-new-product="${esc(id)}"`) + editBtn,
        stats: [[prods.length, t("statProducts")], [allClips.filter((w) => w.stage === "done").length, t("statClipsPublished")], [allClips.filter((w) => w.stage === "doing").length, t("statInProgress")]]
      }) + `
        <section class="band gray">
          <div class="inner wide">
            <div class="sec-head"><h2>${t("secProducts")}</h2></div>
            <div class="gallery">${tiles}<button class="tile tile-new" type="button" data-new-product="${esc(id)}">${icon("plus")}${t("newProduct")}</button></div>
          </div>
        </section>` +
        (loose.length ? band(t("secOtherClips"), loose.map(workRow), "") : "");
    }

    const byStage = (s) => worksIn((w) => w.channel === id && w.stage === s);
    return hero({
      context, title: c.name, lede: c.note ? esc(c.note) : "",
      actions: btn(t("newClip"), `data-new-work="${esc(id)}"`) + editBtn,
      stats: [[byStage("doing").length, t("statInProgress")], [byStage("idea").length, t("statIdeas")], [byStage("done").length, t("statPublished")]]
    }) +
      band(t("secInProgress"), byStage("doing").map(workRow), t("emptyInProgress"), { gray: true }) +
      band(t("secIdeas"), byStage("idea").map(workRow), `${t("emptyChannelIdeas")} <button class="btn-link" type="button" data-new-work="${esc(id)}">${t("addIdea")}</button>`) +
      band(t("secRecent"), byStage("done").map(workRow), t("emptyPublished"), { gray: true });
  }

  function viewProduct(id) {
    const p = product(id), c = channel(p.channel), d = dept(c.dept);
    const clips = worksIn((w) => w.product === id);
    const live = clips.filter((w) => w.stage === "done").length;
    const context = `<a href="#/dept/${esc(d.id)}">${esc(d.name)}</a><span class="sep">›</span><a href="#/channel/${esc(c.id)}">${esc(c.name)}</a>`;
    const img = photoImg(p);
    const stage = img
      ? `<div class="product-stage">${img}</div>`
      : `<button class="product-stage" type="button" data-edit-product="${esc(id)}"><span class="no-photo">${icon("photo")}${t("addPhoto")}</span></button>`;
    const facts = [
      [t("factChannel"), `${esc(c.name)} · ${esc(c.platform)}`],
      [t("factUpdated"), `<span class="num">${esc(fmtDate(p.updated))}</span>`],
      p.note ? [t("factNote"), esc(p.note)] : null
    ].filter(Boolean);

    const heroHtml = hero({
      context, title: p.name,
      actions: btn(t("newClip"), `data-new-work="${esc(c.id)}" data-product="${esc(id)}"`) + btn(t("editProduct"), `data-edit-product="${esc(id)}"`, "btn-outline", "edit"),
      after: stage,
      stats: [[live, t("statClipsDone")], [clips.length, t("statClipsTotal")], [`<span class="stat-text"><span class="status st-${esc(p.status)}">${stLabel(p.status)}</span></span>`, t("factStatus")]]
    });

    return heroHtml +
      band(t("secClips"), clips.map(workRow), `${t("noClipsYet")}. <button class="btn-link" type="button" data-new-work="${esc(c.id)}" data-product="${esc(id)}">${t("addClip")}</button>`, { gray: true }) + `
      <section class="band"><div class="inner"><dl class="facts" style="margin:0">${facts.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl></div></section>`;
  }

  function render() {
    const r = route();
    renderNav(r);
    main.innerHTML = ribbon() + (
      r.view === "board" ? viewBoard() :
      r.view === "dept" ? viewDept(r.id) :
      r.view === "channel" ? viewChannel(r.id) :
      r.view === "product" ? viewProduct(r.id) : viewNext());
    main.querySelectorAll("img[data-fallback]").forEach((img) => img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), { className: "no-photo", textContent: window.BELL_I18N[lang].photoUnavailable }));
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
      <div class="insp-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="${t("close")}">${icon("close")}</button></div>
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
  const select = (name, options, value) =>
    `<select class="select" name="${name}">${options.map((o) => o.group
      ? `<optgroup label="${esc(o.group)}">${o.items.map((i) => `<option value="${esc(i.id)}"${i.id === value ? " selected" : ""}>${esc(i.label)}</option>`).join("")}</optgroup>`
      : `<option value="${esc(o.id)}"${o.id === value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  const statusOptions = () => STATUSES.map((id) => ({ id, label: window.BELL_I18N[lang][`st_${id}`] }));

  function channelOptions(filter = () => true) {
    return S().departments.map((d) => ({
      group: d.name,
      items: S().channels.filter((c) => c.dept === d.id && filter(c)).map((c) => ({ id: c.id, label: c.name }))
    })).filter((g) => g.items.length);
  }
  const productOptions = (chId) =>
    [{ id: "", label: window.BELL_I18N[lang].f_none }].concat(S().products.filter((p) => p.channel === chId).map((p) => ({ id: p.id, label: p.name })));

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
    say(window.BELL_I18N[lang][ok ? msgKey : "toastStorage"]);
  }

  function editWork(index, preset = {}) {
    const isNew = index == null;
    const w = isNew ? { title: "", channel: preset.channel || S().channels[0]?.id, product: preset.product || "", stage: "idea", note: "" } : S().pipeline[index];
    const stageSeg = `<div class="seg-field" role="radiogroup" aria-label="${t("f_status")}">${STAGES.map((s) =>
      `<label><input type="radio" name="stage" value="${s}"${w.stage === s ? " checked" : ""}><span>${stLabel(s)}</span></label>`).join("")}</div>`;
    const productField = (ch, val) => S().products.some((p) => p.channel === ch) ? fieldWrap(t("f_product"), select("product", productOptions(ch), val || "")) : "";
    const body =
      fieldWrap(t("f_title"), input("title", w.title, `required autocomplete="off" placeholder="${t("f_titlePh")}"`)) +
      fieldWrap(t("f_channel"), select("channel", channelOptions(), w.channel)) +
      `<div id="product-field">${productField(w.channel, w.product)}</div>` +
      `<div class="field"><span class="label">${t("f_status")}</span>${stageSeg}</div>` +
      fieldWrap(t("f_note"), textarea("note", w.note, `placeholder="${t("f_notePh")}"`));
    openInspector(window.BELL_I18N[lang][isNew ? "newClip" : "editClip"], body, {
      onSave(form) {
        if (!required(form, "title", "errTitle")) return;
        const data = {
          title: form.elements.title.value.trim(),
          channel: form.elements.channel.value,
          product: form.elements.product?.value || undefined,
          stage: form.querySelector('input[name="stage"]:checked')?.value || "idea",
          note: form.elements.note.value.trim(),
          updated: store.today()
        };
        if (!data.product) delete data.product;
        commit((s) => { if (isNew) s.pipeline.push(data); else s.pipeline[index] = data; }, isNew ? "toastClipAdded" : "toastClipSaved");
      },
      onDelete: isNew ? null : () => commit((s) => s.pipeline.splice(index, 1), "toastClipDeleted")
    });
    const form = $("insp-form");
    form.elements.channel.addEventListener("change", () => { $("product-field").innerHTML = productField(form.elements.channel.value, ""); });
  }

  function editProduct(id, channelId) {
    const isNew = id == null;
    const p = isNew ? { name: "", channel: channelId, status: "planned", image: "", note: "" } : product(id);
    const body =
      fieldWrap(t("f_name"), input("name", p.name, `required autocomplete="off" placeholder="${t("f_productPh")}"`)) +
      fieldWrap(t("f_channel"), select("channel", channelOptions((c) => c.kind === "shop"), p.channel)) +
      fieldWrap(t("f_status"), select("status", statusOptions(), p.status)) +
      fieldWrap(t("f_photo"), input("image", p.image, 'type="url" inputmode="url" placeholder="https://drive.google.com/file/d/…"'), t("f_photoHint")) +
      `<div class="thumb" id="thumb"></div>` +
      fieldWrap(t("f_note"), textarea("note", p.note || ""));
    const clipCount = isNew ? 0 : S().pipeline.filter((w) => w.product === id).length;
    openInspector(window.BELL_I18N[lang][isNew ? "newProduct" : "editProduct"], body, {
      onSave(form) {
        if (!required(form, "name", "errName")) return;
        const data = {
          id: isNew ? slug(form.elements.name.value) : id,
          channel: form.elements.channel.value,
          name: form.elements.name.value.trim(),
          status: form.elements.status.value,
          image: form.elements.image.value.trim(),
          note: form.elements.note.value.trim(),
          updated: store.today()
        };
        commit((s) => {
          if (isNew) s.products.push(data);
          else {
            Object.assign(s.products.find((x) => x.id === id), data);
            s.pipeline.forEach((w) => { if (w.product === id) w.channel = data.channel; });
          }
        }, isNew ? "toastProductAdded" : "toastProductSaved");
        if (isNew) go(`#/product/${data.id}`);
      },
      onDelete: isNew ? null : () => {
        commit((s) => {
          s.products = s.products.filter((x) => x.id !== id);
          s.pipeline = s.pipeline.filter((w) => w.product !== id);
        }, "toastProductDeleted");
        go(`#/channel/${p.channel}`);
      },
      deleteLabel: clipCount ? t("deleteWith", { what: n(clipCount, "clip") }) : ""
    });
    const form = $("insp-form");
    const preview = () => {
      const src = imageSrc(form.elements.image.value);
      const box = $("thumb");
      box.innerHTML = src ? `<img src="${esc(src)}" alt="" referrerpolicy="no-referrer">` : t("f_preview");
      box.querySelector("img")?.addEventListener("error", () => { box.textContent = window.BELL_I18N[lang].f_cantLoad; }, { once: true });
    };
    form.elements.image.addEventListener("input", preview);
    preview();
  }

  function editChannel(id, deptId) {
    const isNew = id == null;
    const dId = deptId || S().departments[0].id;
    const c = isNew ? { name: "", dept: dId, platform: "", kind: dId === "shopee" ? "shop" : "content", status: "planned", note: "" } : channel(id);
    const body =
      fieldWrap(t("f_name"), input("name", c.name, `required autocomplete="off" placeholder="${t("f_channelPh")}"`)) +
      fieldWrap(t("f_dept"), select("dept", S().departments.map((d) => ({ id: d.id, label: `${d.name} — ${d.head.name}` })), c.dept)) +
      fieldWrap(t("f_platform"), input("platform", c.platform, `autocomplete="off" placeholder="${t("f_platformPh")}"`)) +
      `<div class="field"><label class="check"><input type="checkbox" name="shop"${c.kind === "shop" ? " checked" : ""}>${t("f_shop")}</label><span class="hint">${t("f_shopHint")}</span></div>` +
      fieldWrap(t("f_status"), select("status", statusOptions(), c.status)) +
      fieldWrap(t("f_note"), textarea("note", c.note || ""));
    const nProducts = isNew ? 0 : S().products.filter((p) => p.channel === id).length;
    const nWorks = isNew ? 0 : S().pipeline.filter((w) => w.channel === id).length;
    const cascade = [nProducts && n(nProducts, "product"), nWorks && n(nWorks, "clip")].filter(Boolean).join(" + ");
    openInspector(window.BELL_I18N[lang][isNew ? "newChannel" : "editChannel"], body, {
      onSave(form) {
        if (!required(form, "name", "errName")) return;
        const data = {
          id: isNew ? slug(form.elements.name.value) : id,
          dept: form.elements.dept.value,
          name: form.elements.name.value.trim(),
          platform: form.elements.platform.value.trim(),
          kind: form.elements.shop.checked ? "shop" : "content",
          status: form.elements.status.value,
          note: form.elements.note.value.trim()
        };
        commit((s) => { if (isNew) s.channels.push(data); else Object.assign(s.channels.find((x) => x.id === id), data); }, isNew ? "toastChannelAdded" : "toastChannelSaved");
        if (isNew) go(`#/channel/${data.id}`);
      },
      onDelete: isNew ? null : () => {
        commit((s) => {
          s.channels = s.channels.filter((x) => x.id !== id);
          s.products = s.products.filter((p) => p.channel !== id);
          s.pipeline = s.pipeline.filter((w) => w.channel !== id);
        }, "toastChannelDeleted");
        go(`#/dept/${c.dept}`);
      },
      deleteLabel: cascade ? t("deleteWith", { what: cascade }) : ""
    });
  }

  function editDept(id) {
    const d = dept(id);
    const body =
      fieldWrap(t("f_head"), input("head", d.head.name, 'required autocomplete="off"')) +
      fieldWrap(t("f_persona"), input("persona", d.head.persona, 'autocomplete="off"')) +
      fieldWrap(t("f_mission"), textarea("mission", d.mission)) +
      fieldWrap(t("f_team"), textarea("roles", d.roles.map((r) => `${r.title} — ${r.duty}`).join("\n")), t("f_teamHint")) +
      fieldWrap(t("f_rules"), textarea("rules", d.rules.join("\n")), t("f_rulesHint")) +
      fieldWrap(t("f_skills"), textarea("skills", d.skills.join("\n"), 'style="min-height:80px"'), t("f_skillsHint"));
    openInspector(window.BELL_I18N[lang].editDeptTitle.replace("{name}", d.name), body, {
      onSave(form) {
        if (!required(form, "head", "errHead")) return;
        const lines = (k) => form.elements[k].value.split("\n").map((x) => x.trim()).filter(Boolean);
        commit((s) => {
          const tgt = s.departments.find((x) => x.id === id);
          tgt.head = { ...tgt.head, name: form.elements.head.value.trim(), persona: form.elements.persona.value.trim() };
          tgt.mission = form.elements.mission.value.trim();
          tgt.roles = lines("roles").map((l) => { const [title, ...rest] = l.split(/\s+[—-]\s+/); return { title: title.trim(), duty: rest.join(" — ").trim() }; });
          tgt.rules = lines("rules");
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
      if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = window.BELL_I18N[lang].confirmDelete; return; }
      return openState?.onDelete?.();
    }
    if ("export" in ds) {
      const blob = new Blob([store.exportJSON()], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `bell-studio-${store.today()}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return say(window.BELL_I18N[lang].toastExported);
    }
    if ("reset" in ds) {
      if (!el.classList.contains("armed")) { el.classList.add("armed"); el.textContent = window.BELL_I18N[lang].discard; return; }
      store.reset();
      return say(window.BELL_I18N[lang].toastReset);
    }
    if ("boardFilter" in ds) { try { localStorage.setItem("bellstudio:board", ds.boardFilter); } catch { /* ignore */ } return render(); }
    if ("editWork" in ds) return editWork(+ds.editWork);
    if ("newWork" in ds) return editWork(null, { channel: ds.newWork || undefined, product: ds.product });
    if ("editProduct" in ds) return editProduct(ds.editProduct);
    if ("newProduct" in ds) return editProduct(null, ds.newProduct);
    if ("editChannel" in ds) return editChannel(ds.editChannel);
    if ("newChannel" in ds) { e.preventDefault(); return editChannel(null, ds.newChannel || undefined); }
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
  window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
  render();
})();
