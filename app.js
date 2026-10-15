// Bell Studio dashboard — แสดงผลจาก window.STUDIO (data.js) อย่างเดียว ไม่แก้ข้อมูล
(function () {
  const S = window.STUDIO;
  const view = document.getElementById("view");

  const STAGES = [
    { id: "idea", label: "ไอเดีย" },
    { id: "doing", label: "กำลังทำ" },
    { id: "done", label: "ลงแล้ว" }
  ];
  const STATUS_LABEL = { active: "ใช้งานอยู่", planned: "วางแผน", paused: "พัก", unconfirmed: "รอยืนยัน" };

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const deptById = (id) => S.departments.find((d) => d.id === id);
  const cssVar = (id) => `--c: var(--${id})`;
  const pill = (cls, text) => `<span class="pill st-${cls}"><span class="dot"></span>${esc(text)}</span>`;
  const countStage = (deptId, stage) =>
    S.pipeline.filter((p) => (!deptId || p.dept === deptId) && p.stage === stage).length;

  document.getElementById("company-name").textContent = S.company.name;
  document.getElementById("tagline").textContent = S.company.tagline;
  document.getElementById("updated").textContent = "อัปเดตล่าสุด " + S.updated;

  // per-viewer convenience only: remember last dept / pipeline filter
  const store = {
    get(k) { try { return localStorage.getItem("bellstudio:" + k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem("bellstudio:" + k, v); } catch { /* ignore */ } }
  };

  // ---------- views ----------
  function overview() {
    const stats = [
      { n: countStage(null, "idea"), l: "ไอเดียรอทำ" },
      { n: countStage(null, "doing"), l: "กำลังทำ" },
      { n: countStage(null, "done"), l: "ลงแล้ว" },
      { n: S.channels.filter((c) => c.status === "active").length, l: "ช่องที่ใช้งาน" }
    ];
    const depts = S.departments.map((d) => `
      <button class="card dept-card" style="${cssVar(d.id)}" data-goto="${d.id}" aria-label="ดูแผนก ${esc(d.name)}">
        <div class="dept-head">
          <div class="avatar">${d.head.emoji}</div>
          <div>
            <div class="dept-name">${d.emoji} ${esc(d.name)}</div>
            <div class="head-name">${esc(d.head.name)} <span class="muted" style="font-weight:400;font-size:13px">หัวหน้าแผนก</span></div>
          </div>
        </div>
        <p class="mission">${esc(d.mission)}</p>
        <ul class="roles">${d.roles.map((r) => `<li>${esc(r.title)}</li>`).join("")}</ul>
        <div class="counts">
          ${STAGES.map((s) => pill(s.id, `${s.label} ${countStage(d.id, s.id)}`)).join("")}
        </div>
      </button>`).join("");

    view.innerHTML = `
      <div class="stats">${stats.map((s) => `<div class="stat"><div class="num">${s.n}</div><div class="lbl">${s.l}</div></div>`).join("")}</div>
      <h2 class="section-title">ผังองค์กร</h2>
      <div class="org">
        <div class="card ceo">
          <div style="font-size:30px">${S.ceo.emoji}</div>
          <div class="who">${esc(S.ceo.name)} · ${esc(S.ceo.title)}</div>
          <div class="muted" style="font-size:14px">${esc(S.ceo.persona)}</div>
          <ul>${S.ceo.duties.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        <div class="connector"></div>
        <div class="org-depts grid grid-4">${depts}</div>
      </div>`;

    view.querySelectorAll("[data-goto]").forEach((el) =>
      el.addEventListener("click", () => {
        store.set("dept", el.dataset.goto);
        location.hash = "#dept";
      }));
  }

  function dept() {
    let current = store.get("dept");
    if (!deptById(current)) current = S.departments[0].id;
    const d = deptById(current);

    const chooser = S.departments.map((x) =>
      `<button style="${cssVar(x.id)}" data-dept="${x.id}" aria-pressed="${x.id === current}">${x.emoji} ${esc(x.name)}</button>`).join("");
    const channels = S.channels.filter((c) => c.dept === d.id);
    const work = S.pipeline.filter((p) => p.dept === d.id);
    const stageLabel = (id) => STAGES.find((s) => s.id === id)?.label ?? id;

    view.innerHTML = `
      <div class="chooser" role="group" aria-label="เลือกแผนก">${chooser}</div>
      <div class="card detail-hero" style="${cssVar(d.id)}">
        <div class="avatar">${d.head.emoji}</div>
        <div>
          <div class="dept-name">${d.emoji} แผนก ${esc(d.name)}</div>
          <h2>${esc(d.head.name)} (${esc(d.head.gender)}) · หัวหน้าแผนก</h2>
          <p class="persona">${esc(d.head.persona)}</p>
          <p class="mission" style="margin-bottom:0"><b>งานหลัก:</b> ${esc(d.mission)}</p>
        </div>
      </div>

      <div class="grid grid-2" style="margin-top:14px">
        <div class="card">
          <h3>ทีมในแผนก</h3>
          ${d.roles.map((r) => `<div class="role"><b>${esc(r.title)}</b><span>${esc(r.duty)}</span></div>`).join("")}
        </div>
        <div class="card">
          <h3>กฎของแผนก</h3>
          <ul class="rules">${d.rules.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>
          <h3 style="margin-top:16px">สกิลที่ใช้</h3>
          <div class="chips">${d.skills.map((s) => `<span class="chip">${esc(s)}</span>`).join("")}</div>
        </div>
        <div class="card">
          <h3>ช่อง / บัญชี</h3>
          ${channels.length ? channels.map((c) => `
            <div class="item"><div><div class="t">${esc(c.name)}</div><div class="n">${esc(c.note)}</div></div>${pill(c.status, STATUS_LABEL[c.status] ?? c.status)}</div>`).join("")
            : `<div class="empty">ยังไม่มีช่อง</div>`}
        </div>
        <div class="card">
          <h3>งานในมือ</h3>
          ${work.length ? work.map((p) => `
            <div class="item"><div><div class="t">${esc(p.title)}</div><div class="n">${esc(p.note)} · ${esc(p.updated)}</div></div>${pill(p.stage, stageLabel(p.stage))}</div>`).join("")
            : `<div class="empty">ยังไม่มีงาน — ส่งไอเดียผ่านเบลได้เลย</div>`}
        </div>
      </div>`;

    view.querySelectorAll("[data-dept]").forEach((b) =>
      b.addEventListener("click", () => { store.set("dept", b.dataset.dept); dept(); }));
  }

  function pipeline() {
    let filter = store.get("filter") || "all";
    if (filter !== "all" && !deptById(filter)) filter = "all";

    const chooser = [`<button data-f="all" aria-pressed="${filter === "all"}">ทั้งหมด</button>`]
      .concat(S.departments.map((x) =>
        `<button style="${cssVar(x.id)}" data-f="${x.id}" aria-pressed="${x.id === filter}">${x.emoji} ${esc(x.name)}</button>`)).join("");
    const items = S.pipeline.filter((p) => filter === "all" || p.dept === filter);

    const cols = STAGES.map((s) => {
      const cards = items.filter((p) => p.stage === s.id);
      return `
        <section class="col" aria-label="${s.label}">
          <div class="col-h">${pill(s.id, s.label)}<span class="muted">${cards.length}</span></div>
          ${cards.length ? cards.map((p) => {
            const d = deptById(p.dept);
            return `<div class="k-card" style="${cssVar(p.dept)}">
              <div class="t">${esc(p.title)}</div>
              ${p.note ? `<div class="n">${esc(p.note)}</div>` : ""}
              <div class="meta">${d ? `${d.emoji} ${esc(d.name)} · ${esc(d.head.name)}` : esc(p.dept)} · ${esc(p.updated)}</div>
            </div>`;
          }).join("") : `<div class="empty">ว่าง</div>`}
        </section>`;
    }).join("");

    view.innerHTML = `<div class="chooser filters" role="group" aria-label="กรองแผนก">${chooser}</div><div class="kanban">${cols}</div>`;
    view.querySelectorAll("[data-f]").forEach((b) =>
      b.addEventListener("click", () => { store.set("filter", b.dataset.f); pipeline(); }));
  }

  function products() {
    const rows = S.products.map((p) => {
      const d = deptById(p.dept);
      return `<tr>
        <td><b>${esc(p.name)}</b></td>
        <td>${esc(p.platform)}</td>
        <td>${d ? `${d.emoji} ${esc(d.head.name)}` : esc(p.dept)}</td>
        <td>${pill(p.status, STATUS_LABEL[p.status] ?? p.status)}</td>
        <td class="muted">${esc(p.updated)}</td>
      </tr>`;
    }).join("");
    view.innerHTML = `
      <div class="card">
        <h3>สินค้าที่ทำคลิปขาย</h3>
        ${S.products.length ? `<div class="table-wrap"><table>
          <thead><tr><th>สินค้า</th><th>ลงที่</th><th>ผู้ดูแล</th><th>สถานะ</th><th>อัปเดต</th></tr></thead>
          <tbody>${rows}</tbody></table></div>` : `<div class="empty">ยังไม่มีสินค้า</div>`}
      </div>`;
  }

  // ---------- router ----------
  const ROUTES = { overview, dept, pipeline, products };
  function route() {
    const tab = location.hash.slice(1);
    const key = ROUTES[tab] ? tab : "overview";
    document.querySelectorAll(".tabs a").forEach((a) => {
      if (a.dataset.tab === key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    ROUTES[key]();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  route();
})();
