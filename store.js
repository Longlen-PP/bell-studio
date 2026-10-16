// Bell Studio data layer.
// Phase 1 ("local"): state is seeded from data.js and edits are kept in this browser's localStorage.
// Phase 3 swaps in Firestore behind the same interface: get / mutate / reset / exportJSON / subscribe.
//
// Data model v2: departments → channels (typed) → works → episodes.
window.BellStore = (function () {
  const KEY = "bellstudio:state:v2";
  const OLD_KEY = "bellstudio:state:v1";
  const listeners = [];
  let state;
  let localChanges = false;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rid = () => Math.random().toString(36).slice(2, 8);
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  // v1 had products + a flat pipeline of clips. Products become works, clips become episodes.
  function fromV1(old) {
    const s = clone(old);
    s.v = 2;
    s.channels.forEach((c) => {
      c.type = c.type || (c.kind === "shop" ? "affiliate" : "series");
      c.concept = c.concept ?? c.note ?? "";
      c.audience = c.audience ?? "";
      c.schedule = c.schedule ?? "";
      c.url = c.url ?? "";
      delete c.kind;
      delete c.note;
    });
    const stageMap = { idea: "idea", doing: "producing", done: "published" };
    s.works = (old.products || []).map((p) => ({
      id: p.id, channel: p.channel, title: p.name, summary: "", cover: p.image || "", props: {},
      characters: [], locations: [], rules: "", note: p.note || "", updated: p.updated || today()
    }));
    s.episodes = [];
    (old.pipeline || []).forEach((w) => {
      let workId = w.product;
      if (!workId) {
        workId = `w-${rid()}`;
        s.works.push({
          id: workId, channel: w.channel, title: w.title, summary: "", cover: "", props: {},
          characters: [], locations: [], rules: "", note: "", updated: w.updated || today()
        });
      }
      s.episodes.push({
        id: `e-${rid()}`, work: workId, n: s.episodes.filter((e) => e.work === workId).length + 1,
        title: w.title, summary: "", stage: stageMap[w.stage] || "idea", date: "", link: "", note: w.note || "", updated: w.updated || today()
      });
    });
    delete s.products;
    delete s.pipeline;
    return s;
  }

  // short code for a channel: first letters of its name, made unique inside the department
  function autoCode(name, taken) {
    const base = String(name || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3).padEnd(3, "X") || "CHN";
    let code = base, i = 2;
    while (taken.includes(code)) code = base.slice(0, 2) + i++;
    return code;
  }

  // fill in anything an older saved state does not have yet
  function backfill(s) {
    const fresh = clone(window.STUDIO);
    s.departments.forEach((d) => {
      if (!d.platforms) d.platforms = fresh.departments.find((x) => x.id === d.id)?.platforms || [];
      if (!d.code) d.code = fresh.departments.find((x) => x.id === d.id)?.code || String(d.id).slice(0, 3).toUpperCase();
    });
    if (!s.formats) s.formats = clone(fresh.formats || {});
    s.episodes.forEach((e) => { if (e.format == null) e.format = ""; });
    s.channels.forEach((c) => {
      if (!c.code) c.code = autoCode(c.name, s.channels.filter((x) => x.dept === c.dept && x !== c).map((x) => x.code).filter(Boolean));
    });
    s.channels.forEach((c) => {
      const mine = s.works.filter((w) => w.channel === c.id);
      let top = Math.max(0, c.seq || 0, ...mine.map((w) => w.no || 0));
      mine.forEach((w) => { if (!w.no) w.no = ++top; });
      c.seq = top;
    });
    s.works.forEach((w) => {
      w.props = w.props || {};
      w.characters = w.characters || [];
      w.locations = w.locations || [];
      w.rules = w.rules || "";
    });
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = backfill(JSON.parse(raw));
        localChanges = true;
        return;
      }
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        state = backfill(fromV1(JSON.parse(old)));
        localChanges = true;
        persist();
        return;
      }
    } catch { /* storage blocked or corrupt: fall back to the published seed */ }
    state = clone(window.STUDIO);
    localChanges = false;
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      localChanges = true;
      return true;
    } catch {
      return false;
    }
  }

  const emit = () => listeners.forEach((fn) => fn(state));

  load();

  return {
    mode: "local",
    today,
    rid,
    autoCode,
    get: () => state,
    hasLocalChanges: () => localChanges,
    // fn edits the state in place; returns false when the browser refused to store it
    mutate(fn) {
      fn(state);
      state.updated = today();
      const ok = persist();
      emit();
      return ok;
    },
    reset() {
      try { localStorage.removeItem(KEY); localStorage.removeItem(OLD_KEY); } catch { /* ignore */ }
      state = clone(window.STUDIO);
      localChanges = false;
      emit();
    },
    exportJSON: () => JSON.stringify(state, null, 2),
    subscribe: (fn) => listeners.push(fn)
  };
})();
