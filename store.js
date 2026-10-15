// Bell Studio data layer.
// Phase 1 ("local"): state is seeded from data.js and edits are kept in this browser's localStorage.
// Phase 3 swaps in Firestore behind the same interface: get / mutate / reset / exportJSON / subscribe.
window.BellStore = (function () {
  const KEY = "bellstudio:state:v1";
  const listeners = [];
  let state;
  let localChanges = false;

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  function seed() {
    const s = clone(window.STUDIO);
    s.channels.forEach((c) => {
      // older seeds have no kind: a channel that already has products sells products
      if (!c.kind) c.kind = s.products.some((p) => p.channel === c.id) ? "shop" : "content";
    });
    return s;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        state = JSON.parse(raw);
        localChanges = true;
        return;
      }
    } catch { /* storage blocked or corrupt: fall back to the published seed */ }
    state = seed();
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
      try { localStorage.removeItem(KEY); } catch { /* ignore */ }
      state = seed();
      localChanges = false;
      emit();
    },
    exportJSON: () => JSON.stringify(state, null, 2),
    subscribe: (fn) => listeners.push(fn)
  };
})();
