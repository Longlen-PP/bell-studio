// Bell Studio dashboard — renders from BellStore and edits it through the inspector.
// Hierarchy: department → channel → (product, for "shop" channels) → work/clip.
(function () {
  const store = window.BellStore;
  const $ = (id) => document.getElementById(id);
  const sidebar = $("sidebar"), main = $("main"), inspector = $("inspector"), scrim = $("scrim"), toast = $("toast");

  const STAGES = [
    { id: "idea", label: "Idea" },
    { id: "doing", label: "In progress" },
    { id: "done", label: "Published" }
  ];
  const STATUSES = [
    { id: "active", label: "Active" },
    { id: "planned", label: "Planned" },
    { id: "paused", label: "Paused" },
    { id: "unconfirmed", label: "Unconfirmed" }
  ];
  const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label ?? id;
  const statusLabel = (id) => STATUSES.find((s) => s.id === id)?.label ?? id;

  // ---------- helpers ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = () => store.get();
  const dept = (id) => S().departments.find((d) => d.id === id);
  const channel = (id) => S().channels.find((c) => c.id === id);
  const product = (id) => S().products.find((p) => p.id === id);
  const deptOf = (work) => channel(work.channel)?.dept;
  const worksIn = (pred) => S().pipeline.map((w, i) => ({ ...w, _i: i })).filter(pred);
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmtDate = (iso) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : "";
  };
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
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
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    tray: '<path d="M4 13h4l1.5 2.5h5L16 13h4"/><path d="M4 13l2-7h12l2 7v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/>',
    board: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15M14.5 4.5v15"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    photo: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-5-5-8.5 8"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
    reset: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'
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

  // ---------- sidebar ----------
  function renderSidebar(r) {
    const doing = S().pipeline.filter((w) => w.stage === "doing").length;
    const cur = (cond) => (cond ? ' aria-current="page"' : "");
    const depts = S().departments.map((d) => {
      const chans = S().channels.filter((c) => c.dept === d.id);
      const isCur = r.view === "dept" && r.id === d.id;
      return `
        <div class="dept-row${isCur ? " current" : ""}" style="--c: var(--d-${esc(d.id)})">
          <a class="nav-item" href="#/dept/${esc(d.id)}"${cur(isCur)}><span class="dot"></span>${esc(d.name)} <span class="head">${esc(d.head.name)}</span></a>
          <button class="add-btn" type="button" data-new-channel="${esc(d.id)}" aria-label="New ${esc(d.name)} channel" title="New channel">${icon("plus")}</button>
        </div>
        ${chans.map((c) => `<a class="nav-item channel-link" href="#/channel/${esc(c.id)}"${cur((r.view === "channel" && r.id === c.id) || (r.view === "product" && product(r.id)?.channel === c.id))}>${esc(c.name)}</a>`).join("")}`;
    }).join("");

    sidebar.innerHTML = `
      <div class="brand"><img src="icon.svg" alt=""><span>${esc(S().company.name)}</span></div>
      <a class="nav-item" href="#/next"${cur(r.view === "next")}>${icon("tray")}Up Next${doing ? `<span class="count num">${doing}</span>` : ""}</a>
      <a class="nav-item" href="#/board"${cur(r.view === "board")}>${icon("board")}Board</a>
      <div class="nav-group">Departments</div>
      ${depts}
      <div class="sidebar-foot">${esc(S().ceo.name)} · ${esc(S().ceo.title)}<br>Updated ${esc(fmtDate(S().updated))} · ${store.hasLocalChanges() ? "edits in this browser" : "published data"}</div>`;
  }

  // ---------- shared pieces ----------
  function toolbar({ crumbs = [], title, subtitle = "", actions = "" }) {
    return `
      <header class="toolbar">
        <button class="icon-btn menu-btn" type="button" data-menu aria-label="Show navigation">${icon("menu")}</button>
        <div class="title-block">
          ${crumbs.length ? `<nav class="crumbs" aria-label="Breadcrumb">${crumbs.map((c, i) => `${i ? icon("chev") : ""}<a href="${c.href}">${esc(c.label)}</a>`).join("")}</nav>` : ""}
          <h1>${esc(title)}</h1>
          ${subtitle ? `<p class="subtitle">${subtitle}</p>` : ""}
        </div>
        <div class="actions">${actions}</div>
      </header>
      ${localNotice()}`;
  }

  function localNotice() {
    if (!store.hasLocalChanges()) return "";
    return `
      <div class="notice" role="note">
        <p><strong>Your edits live in this browser only</strong> until sign-in sync is connected. Export them so Bell can publish them, or go back to the published data.</p>
        <button class="btn" type="button" data-export>${icon("download")}Export</button>
        <button class="btn btn-plain" type="button" data-reset>${icon("reset")}Reset</button>
      </div>`;
  }

  const btn = (label, attrs, primary = false, ic = "plus") =>
    `<button class="btn${primary ? " btn-primary" : ""}" type="button" ${attrs}>${icon(ic)}${esc(label)}</button>`;

  function workRow(w) {
    return `
      <button class="row" type="button" data-edit-work="${w._i}">
        <span class="status st-${esc(w.stage)}"><span class="visually-hidden">${esc(stageLabel(w.stage))}</span></span>
        <span class="row-main"><span class="row-title">${esc(w.title)}</span><span class="row-sub">${esc(pathOf(w))}</span></span>
        <span class="row-meta num">${esc(fmtDate(w.updated))}</span>${icon("chev", "icon chev")}
      </button>`;
  }

  function group(title, rows, emptyHtml, extra = "") {
    return `
      <section class="section">
        <div class="section-head"><h2>${esc(title)}</h2><span class="count num">${rows.length || ""}</span>${extra}</div>
        <div class="list">${rows.length ? rows.join("") : `<div class="empty">${emptyHtml}</div>`}</div>
      </section>`;
  }

  // ---------- views ----------
  function viewNext() {
    const doing = worksIn((w) => w.stage === "doing");
    const ideas = worksIn((w) => w.stage === "idea");
    const done = worksIn((w) => w.stage === "done").sort((a, b) => String(b.updated).localeCompare(String(a.updated))).slice(0, 5);
    const lonely = S().departments.filter((d) => !S().channels.some((c) => c.dept === d.id));
    const hasChannels = S().channels.length > 0;
    const sub = [`${doing.length} in progress`, plural(ideas.length, "idea")].join(" · ");

    const lonelyRows = lonely.map((d) => `
      <button class="row" type="button" data-new-channel="${esc(d.id)}" style="--c: var(--d-${esc(d.id)})">
        <span class="dot"></span>
        <span class="row-main"><span class="row-title">${esc(d.name)}</span><span class="row-sub">${esc(d.head.name)} has no channel yet</span></span>
        <span class="btn btn-plain" aria-hidden="true">Add channel</span>
      </button>`);

    return toolbar({
      title: "Up Next",
      subtitle: esc(sub),
      actions: hasChannels ? btn("New idea", 'data-new-work=""', true) : ""
    }) +
      group("In progress", doing.map(workRow), "Nothing is in progress. Move an idea forward when you start on it.") +
      group("Ideas", ideas.map(workRow), hasChannels
        ? `No ideas waiting. <button class="btn btn-plain" type="button" data-new-work="">Add an idea</button>`
        : "Add a channel first, then ideas can go into it.") +
      (lonely.length ? group("Needs a channel", lonelyRows, "") : "") +
      group("Recently published", done.map(workRow), "Nothing published yet.");
  }

  function viewBoard() {
    let filter = "all";
    try { filter = localStorage.getItem("bellstudio:board") || "all"; } catch { /* ignore */ }
    if (filter !== "all" && !dept(filter)) filter = "all";
    const seg = [`<button type="button" data-board-filter="all" aria-pressed="${filter === "all"}">All</button>`]
      .concat(S().departments.map((d) => `<button type="button" data-board-filter="${esc(d.id)}" aria-pressed="${filter === d.id}">${esc(d.name)}</button>`)).join("");
    const items = worksIn((w) => filter === "all" || deptOf(w) === filter);
    const lanes = STAGES.map((s) => {
      const cards = items.filter((w) => w.stage === s.id);
      return `
        <section aria-label="${esc(s.label)}">
          <div class="lane-head"><span class="status st-${s.id}"></span><h2>${esc(s.label)}</h2><span class="count num">${cards.length}</span></div>
          <div class="lane">${cards.length ? cards.map((w) => `
            <button class="card" type="button" data-edit-work="${w._i}">
              <div class="row-title">${esc(w.title)}</div>
              <div class="row-sub">${esc(pathOf(w))}</div>
              <div class="card-foot"><span>${esc(dept(deptOf(w))?.head.name ?? "")}</span><span class="num">${esc(fmtDate(w.updated))}</span></div>
            </button>`).join("") : `<div class="empty">Nothing here.</div>`}</div>
        </section>`;
    }).join("");
    return toolbar({ title: "Board", subtitle: "Every clip and idea by status.", actions: S().channels.length ? btn("New idea", 'data-new-work=""', true) : "" }) +
      `<div class="segmented" role="group" aria-label="Filter by department">${seg}</div><div class="board">${lanes}</div>`;
  }

  function viewDept(id) {
    const d = dept(id);
    const chans = S().channels.filter((c) => c.dept === id);
    const rows = chans.map((c) => {
      const prods = S().products.filter((p) => p.channel === c.id).length;
      const works = S().pipeline.filter((w) => w.channel === c.id).length;
      const bits = [c.platform, c.kind === "shop" ? plural(prods, "product") : null, plural(works, "clip")].filter(Boolean).join(" · ");
      return `
        <a class="row" href="#/channel/${esc(c.id)}">
          <span class="row-main"><span class="row-title">${esc(c.name)}</span><span class="row-sub">${esc(bits)}</span></span>
          <span class="status st-${esc(c.status)}">${esc(statusLabel(c.status))}</span>${icon("chev", "icon chev")}
        </a>`;
    });
    return toolbar({
      title: d.name,
      subtitle: `Led by ${esc(d.head.name)}`,
      actions: btn("Edit department", `data-edit-dept="${esc(id)}"`, false, "edit") + btn("New channel", `data-new-channel="${esc(id)}"`, true)
    }) + `
      <div class="about" style="--c: var(--d-${esc(id)})">
        <div class="avatar" aria-hidden="true">${esc((d.head.name || "?").slice(0, 1))}</div>
        <div><h2>${esc(d.head.name)}</h2><p class="persona">${esc(d.head.persona)}</p><p class="mission">${esc(d.mission)}</p></div>
      </div>` +
      group("Channels", rows, `${esc(d.head.name)} has no channel yet. <button class="btn btn-plain" type="button" data-new-channel="${esc(id)}">Add a channel</button>`) + `
      <section class="section">
        <div class="cols">
          <div><div class="section-head"><h2>Team</h2></div><ul class="plain-list">${d.roles.map((r) => `<li>${esc(r.title)} <span>— ${esc(r.duty)}</span></li>`).join("") || "<li>No roles yet.</li>"}</ul></div>
          <div><div class="section-head"><h2>Rules</h2></div><ul class="plain-list">${d.rules.map((r) => `<li>${esc(r)}</li>`).join("") || "<li>No rules yet.</li>"}</ul></div>
          <div><div class="section-head"><h2>Skills</h2></div><div class="skills">${d.skills.map((s) => `<span class="skill">${esc(s)}</span>`).join("") || '<span class="hint">No skills listed.</span>'}</div></div>
        </div>
      </section>`;
  }

  function stageHtml(p, big = false) {
    const src = imageSrc(p.image);
    return `<div class="stage">${src
      ? `<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" referrerpolicy="no-referrer" data-fallback>`
      : `<span class="no-photo">${icon("photo")}${big ? "No photo yet" : "No photo"}</span>`}</div>`;
  }

  function viewChannel(id) {
    const c = channel(id), d = dept(c.dept);
    const crumbs = [{ label: d.name, href: `#/dept/${d.id}` }];
    const sub = [esc(c.platform), `<span class="status st-${esc(c.status)}">${esc(statusLabel(c.status))}</span>`].filter(Boolean).join(" · ");
    const edit = btn("Edit channel", `data-edit-channel="${esc(id)}"`, false, "edit");

    if (c.kind === "shop") {
      const prods = S().products.filter((p) => p.channel === id);
      const loose = worksIn((w) => w.channel === id && !w.product);
      const tiles = prods.map((p) => {
        const clips = S().pipeline.filter((w) => w.product === p.id);
        const live = clips.filter((w) => w.stage === "done").length;
        return `
          <a class="tile" href="#/product/${esc(p.id)}">
            ${stageHtml(p)}
            <div class="tile-body">
              <div class="tile-name">${esc(p.name)}</div>
              <div class="tile-meta"><span class="num">${clips.length ? `${live} of ${plural(clips.length, "clip")} published` : "No clips yet"}</span><span class="status st-${esc(p.status)}">${esc(statusLabel(p.status))}</span></div>
            </div>
          </a>`;
      }).join("");
      return toolbar({ crumbs, title: c.name, subtitle: sub, actions: edit + btn("New product", `data-new-product="${esc(id)}"`, true) }) + `
        <section class="section">
          <div class="section-head"><h2>Products</h2><span class="count num">${prods.length || ""}</span></div>
          <div class="gallery">${tiles}<button class="tile tile-new" type="button" data-new-product="${esc(id)}">${icon("plus")}New product</button></div>
        </section>` +
        (loose.length ? group("Other clips in this channel", loose.map(workRow), "") : "");
    }

    const byStage = (s) => worksIn((w) => w.channel === id && w.stage === s);
    return toolbar({ crumbs, title: c.name, subtitle: sub, actions: edit + btn("New clip", `data-new-work="${esc(id)}"`, true) }) +
      group("In progress", byStage("doing").map(workRow), "Nothing in progress.") +
      group("Ideas", byStage("idea").map(workRow), `No ideas yet. <button class="btn btn-plain" type="button" data-new-work="${esc(id)}">Add an idea</button>`) +
      group("Published", byStage("done").map(workRow), "Nothing published yet.");
  }

  function viewProduct(id) {
    const p = product(id), c = channel(p.channel), d = dept(c.dept);
    const clips = worksIn((w) => w.product === id);
    const crumbs = [{ label: d.name, href: `#/dept/${d.id}` }, { label: c.name, href: `#/channel/${c.id}` }];
    const facts = [
      ["Status", `<span class="status st-${esc(p.status)}">${esc(statusLabel(p.status))}</span>`],
      ["Channel", `${esc(c.name)} · ${esc(c.platform)}`],
      ["Clips", `<span class="num">${clips.filter((w) => w.stage === "done").length} published of ${clips.length}</span>`],
      ["Updated", `<span class="num">${esc(fmtDate(p.updated))}</span>`],
      p.note ? ["Note", esc(p.note)] : null
    ].filter(Boolean);
    return toolbar({
      crumbs, title: p.name,
      actions: btn("Edit product", `data-edit-product="${esc(id)}"`, false, "edit") + btn("New clip", `data-new-work="${esc(c.id)}" data-product="${esc(id)}"`, true)
    }) + `
      <div class="product-hero">
        ${p.image ? stageHtml(p, true) : `<button class="stage" type="button" data-edit-product="${esc(id)}" style="border:0;cursor:pointer;border-radius:var(--r-lg)"><span class="no-photo">${icon("photo")}Add a photo link</span></button>`}
        <div>
          <dl class="facts" style="margin:0">${facts.map(([k, v]) => `<div class="fact"><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
          ${group("Clips", clips.map(workRow), `No clips yet. <button class="btn btn-plain" type="button" data-new-work="${esc(c.id)}" data-product="${esc(id)}">Add a clip</button>`)}
        </div>
      </div>`;
  }

  function render() {
    const r = route();
    renderSidebar(r);
    main.innerHTML =
      r.view === "board" ? viewBoard() :
      r.view === "dept" ? viewDept(r.id) :
      r.view === "channel" ? viewChannel(r.id) :
      r.view === "product" ? viewProduct(r.id) : viewNext();
    main.querySelectorAll("img[data-fallback]").forEach((img) => img.addEventListener("error", () => {
      img.replaceWith(Object.assign(document.createElement("span"), { className: "no-photo", textContent: "Photo unavailable — check the link is shared" }));
    }, { once: true }));
    document.title = r.view === "next" ? "Bell Studio" : `${main.querySelector("h1")?.textContent} — Bell Studio`;
  }

  // ---------- inspector ----------
  let openState = null; // {kind, key, returnFocus}
  let savedOk = true;

  function openInspector(title, bodyHtml, { onSave, onDelete, deleteLabel }) {
    openState = { onSave, onDelete, returnFocus: document.activeElement };
    inspector.innerHTML = `
      <div class="insp-head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Close">${icon("close")}</button></div>
      <form class="insp-body" id="insp-form" novalidate>${bodyHtml}</form>
      <div class="insp-foot">
        ${onDelete ? `<button class="btn btn-danger" type="button" data-delete>${esc(deleteLabel || "Delete")}</button>` : ""}
        <span class="spacer"></span>
        <button class="btn" type="button" data-close>Cancel</button>
        <button class="btn btn-primary" type="submit" form="insp-form">Save</button>
      </div>`;
    inspector.hidden = false;
    scrim.hidden = window.innerWidth > 900;
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

  const field = (label, control, hint = "") =>
    `<div class="field">${label ? `<label>${esc(label)}</label>` : ""}${control}${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
  const input = (name, value, attrs = "") => `<input class="input" name="${name}" value="${esc(value)}" ${attrs}>`;
  const textarea = (name, value, attrs = "") => `<textarea class="textarea" name="${name}" ${attrs}>${esc(value)}</textarea>`;
  const select = (name, options, value) =>
    `<select class="select" name="${name}">${options.map((o) => o.group
      ? `<optgroup label="${esc(o.group)}">${o.items.map((i) => `<option value="${esc(i.id)}"${i.id === value ? " selected" : ""}>${esc(i.label)}</option>`).join("")}</optgroup>`
      : `<option value="${esc(o.id)}"${o.id === value ? " selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`;
  // label wraps the control so the field label stays clickable
  const labelled = (label, control, hint) => field("", `<label class="field" style="gap:6px"><span class="label" style="font-size:13px;font-weight:500;color:var(--ink-2)">${esc(label)}</span>${control}</label>`, hint);

  function channelOptions() {
    return S().departments.map((d) => ({
      group: d.name,
      items: S().channels.filter((c) => c.dept === d.id).map((c) => ({ id: c.id, label: c.name }))
    })).filter((g) => g.items.length);
  }
  function productOptions(chId) {
    return [{ id: "", label: "None" }].concat(S().products.filter((p) => p.channel === chId).map((p) => ({ id: p.id, label: p.name })));
  }

  function required(form, name, msg) {
    const el = form.elements[name];
    const ok = el.value.trim() !== "";
    el.setAttribute("aria-invalid", String(!ok));
    el.parentElement.querySelector(".error")?.remove();
    if (!ok) { el.insertAdjacentHTML("afterend", `<span class="error">${esc(msg)}</span>`); el.focus(); }
    return ok;
  }

  function commit(fn, msg) {
    savedOk = store.mutate(fn);
    closeInspector();
    say(savedOk ? msg : "Couldn't save — this browser blocked storage");
  }

  function editWork(index, preset = {}) {
    const isNew = index == null;
    const w = isNew ? { title: "", channel: preset.channel || S().channels[0]?.id, product: preset.product || "", stage: "idea", note: "" } : S().pipeline[index];
    const stageSeg = `<div class="seg-field" role="radiogroup" aria-label="Status">${STAGES.map((s) =>
      `<label><input type="radio" name="stage" value="${s.id}"${w.stage === s.id ? " checked" : ""}><span>${esc(s.label)}</span></label>`).join("")}</div>`;
    const body =
      labelled("Title", input("title", w.title, 'required autocomplete="off" placeholder="What is the clip or idea?"')) +
      labelled("Channel", select("channel", channelOptions(), w.channel)) +
      `<div id="product-field">${S().products.some((p) => p.channel === w.channel) ? labelled("Product", select("product", productOptions(w.channel), w.product || "")) : ""}</div>` +
      field("Status", stageSeg) +
      labelled("Note", textarea("note", w.note, 'placeholder="Engine, length, where it goes…"'));
    openInspector(isNew ? "New clip" : "Edit clip", body, {
      onSave(form) {
        if (!required(form, "title", "Give it a title.")) return;
        const data = {
          title: form.elements.title.value.trim(),
          channel: form.elements.channel.value,
          product: form.elements.product?.value || undefined,
          stage: form.querySelector('input[name="stage"]:checked')?.value || "idea",
          note: form.elements.note.value.trim(),
          updated: store.today()
        };
        if (!data.product) delete data.product;
        commit((s) => { if (isNew) s.pipeline.push(data); else s.pipeline[index] = data; }, isNew ? "Clip added" : "Clip saved");
      },
      onDelete: isNew ? null : () => commit((s) => s.pipeline.splice(index, 1), "Clip deleted")
    });
    const form = $("insp-form");
    form.elements.channel.addEventListener("change", () => {
      const ch = form.elements.channel.value;
      $("product-field").innerHTML = S().products.some((p) => p.channel === ch) ? labelled("Product", select("product", productOptions(ch), "")) : "";
    });
  }

  function editProduct(id, channelId) {
    const isNew = id == null;
    const p = isNew ? { name: "", channel: channelId, status: "planned", image: "", note: "" } : product(id);
    const shopChannels = S().departments.map((d) => ({
      group: d.name, items: S().channels.filter((c) => c.dept === d.id && c.kind === "shop").map((c) => ({ id: c.id, label: c.name }))
    })).filter((g) => g.items.length);
    const body =
      labelled("Name", input("name", p.name, 'required autocomplete="off" placeholder="Product name"')) +
      labelled("Channel", select("channel", shopChannels, p.channel)) +
      labelled("Status", select("status", STATUSES, p.status)) +
      labelled("Photo link", input("image", p.image, 'type="url" inputmode="url" placeholder="https://drive.google.com/file/d/…"'),
        "Paste a Google Drive share link (set to “Anyone with the link”) or any https image URL.") +
      `<div class="thumb" id="thumb"></div>` +
      labelled("Note", textarea("note", p.note || ""));
    const clipCount = isNew ? 0 : S().pipeline.filter((w) => w.product === id).length;
    openInspector(isNew ? "New product" : "Edit product", body, {
      onSave(form) {
        if (!required(form, "name", "Give the product a name.")) return;
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
        }, isNew ? "Product added" : "Product saved");
        if (isNew) go(`#/product/${data.id}`);
      },
      onDelete: isNew ? null : () => {
        commit((s) => {
          s.products = s.products.filter((x) => x.id !== id);
          s.pipeline = s.pipeline.filter((w) => w.product !== id);
        }, "Product deleted");
        go(`#/channel/${p.channel}`);
      },
      deleteLabel: clipCount ? `Delete with ${plural(clipCount, "clip")}` : "Delete"
    });
    const form = $("insp-form");
    const preview = () => {
      const src = imageSrc(form.elements.image.value);
      const box = $("thumb");
      box.innerHTML = src ? `<img src="${esc(src)}" alt="Photo preview" referrerpolicy="no-referrer">` : "Photo preview appears here";
      box.querySelector("img")?.addEventListener("error", () => { box.textContent = "Can't load this link. Check it is shared with “Anyone with the link”."; }, { once: true });
    };
    form.elements.image.addEventListener("change", preview);
    form.elements.image.addEventListener("input", preview);
    preview();
  }

  function editChannel(id, deptId) {
    const isNew = id == null;
    const c = isNew ? { name: "", dept: deptId, platform: "", kind: deptId === "shopee" ? "shop" : "content", status: "planned", note: "" } : channel(id);
    const body =
      labelled("Name", input("name", c.name, 'required autocomplete="off" placeholder="Channel or account name"')) +
      labelled("Department", select("dept", S().departments.map((d) => ({ id: d.id, label: `${d.name} — ${d.head.name}` })), c.dept)) +
      labelled("Platform", input("platform", c.platform, 'autocomplete="off" placeholder="e.g. YouTube, Shopee Video"')) +
      field("", `<label class="check"><input type="checkbox" name="shop"${c.kind === "shop" ? " checked" : ""}>Sells products</label>`, "Turn on for affiliate or shop channels, so work is organised per product.") +
      labelled("Status", select("status", STATUSES, c.status)) +
      labelled("Note", textarea("note", c.note || ""));
    const nProducts = isNew ? 0 : S().products.filter((p) => p.channel === id).length;
    const nWorks = isNew ? 0 : S().pipeline.filter((w) => w.channel === id).length;
    const cascade = [nProducts && plural(nProducts, "product"), nWorks && plural(nWorks, "clip")].filter(Boolean).join(" and ");
    openInspector(isNew ? "New channel" : "Edit channel", body, {
      onSave(form) {
        if (!required(form, "name", "Give the channel a name.")) return;
        const data = {
          id: isNew ? slug(form.elements.name.value) : id,
          dept: form.elements.dept.value,
          name: form.elements.name.value.trim(),
          platform: form.elements.platform.value.trim(),
          kind: form.elements.shop.checked ? "shop" : "content",
          status: form.elements.status.value,
          note: form.elements.note.value.trim()
        };
        commit((s) => { if (isNew) s.channels.push(data); else Object.assign(s.channels.find((x) => x.id === id), data); }, isNew ? "Channel added" : "Channel saved");
        if (isNew) go(`#/channel/${data.id}`);
      },
      onDelete: isNew ? null : () => {
        commit((s) => {
          s.channels = s.channels.filter((x) => x.id !== id);
          s.products = s.products.filter((p) => p.channel !== id);
          s.pipeline = s.pipeline.filter((w) => w.channel !== id);
        }, "Channel deleted");
        go(`#/dept/${c.dept}`);
      },
      deleteLabel: cascade ? `Delete with ${cascade}` : "Delete"
    });
  }

  function editDept(id) {
    const d = dept(id);
    const body =
      labelled("Head", input("head", d.head.name, 'required autocomplete="off"')) +
      labelled("Persona", input("persona", d.head.persona, 'autocomplete="off"')) +
      labelled("Mission", textarea("mission", d.mission)) +
      labelled("Team", textarea("roles", d.roles.map((r) => `${r.title} — ${r.duty}`).join("\n")), "One role per line: Role — what they do") +
      labelled("Rules", textarea("rules", d.rules.join("\n")), "One rule per line") +
      labelled("Skills", textarea("skills", d.skills.join("\n"), 'style="min-height:72px"'), "One skill per line");
    openInspector(`Edit ${d.name}`, body, {
      onSave(form) {
        if (!required(form, "head", "The department needs a head.")) return;
        const lines = (n) => form.elements[n].value.split("\n").map((x) => x.trim()).filter(Boolean);
        commit((s) => {
          const t = s.departments.find((x) => x.id === id);
          t.head = { ...t.head, name: form.elements.head.value.trim(), persona: form.elements.persona.value.trim() };
          t.mission = form.elements.mission.value.trim();
          t.roles = lines("roles").map((l) => { const [title, ...rest] = l.split(/\s+[—-]\s+/); return { title: title.trim(), duty: rest.join(" — ").trim() }; });
          t.rules = lines("rules");
          t.skills = lines("skills");
        }, "Department saved");
      }
    });
  }

  // ---------- events ----------
  document.addEventListener("click", (e) => {
    const t = e.target.closest("button, a");
    if (!t) return;
    const ds = t.dataset;
    if ("menu" in ds) { sidebar.classList.toggle("open"); scrim.hidden = !sidebar.classList.contains("open"); return; }
    if ("close" in ds) return closeInspector();
    if ("delete" in ds) {
      if (!t.classList.contains("armed")) { t.classList.add("armed"); t.textContent = "Confirm delete"; return; }
      return openState?.onDelete?.();
    }
    if ("export" in ds) {
      const blob = new Blob([store.exportJSON()], { type: "application/json" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `bell-studio-${store.today()}.json` });
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      return say("Exported — send the file to Bell");
    }
    if ("reset" in ds) {
      if (!t.classList.contains("armed")) { t.classList.add("armed"); t.lastChild.textContent = "Discard my edits?"; return; }
      store.reset();
      return say("Back to the published data");
    }
    if ("boardFilter" in ds) { try { localStorage.setItem("bellstudio:board", ds.boardFilter); } catch { /* ignore */ } return render(); }
    if ("editWork" in ds) return editWork(+ds.editWork);
    if ("newWork" in ds) return editWork(null, { channel: ds.newWork || undefined, product: ds.product });
    if ("editProduct" in ds) return editProduct(ds.editProduct);
    if ("newProduct" in ds) return editProduct(null, ds.newProduct);
    if ("editChannel" in ds) return editChannel(ds.editChannel);
    if ("newChannel" in ds) { e.preventDefault(); return editChannel(null, ds.newChannel); }
    if ("editDept" in ds) return editDept(ds.editDept);
    if (t.matches(".sidebar a")) { sidebar.classList.remove("open"); scrim.hidden = inspector.hidden; }
  });

  document.addEventListener("submit", (e) => {
    if (e.target.id !== "insp-form") return;
    e.preventDefault();
    openState?.onSave?.(e.target);
  });

  scrim.addEventListener("click", () => { sidebar.classList.remove("open"); closeInspector(); scrim.hidden = true; });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!inspector.hidden) closeInspector();
    else if (sidebar.classList.contains("open")) { sidebar.classList.remove("open"); scrim.hidden = true; }
  });

  store.subscribe(render);
  window.addEventListener("hashchange", () => { render(); main.scrollTo?.(0, 0); window.scrollTo(0, 0); });
  render();
})();
