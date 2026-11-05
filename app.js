(function () {
  const hash = new URLSearchParams((location.hash || "#").slice(1));
  const token = hash.get("t") || localStorage.getItem("APP_TOKEN") || "";
  const dataPath = hash.get("d") || localStorage.getItem("DATA_PATH") || "";
  if (token) localStorage.setItem("APP_TOKEN", token);
  if (dataPath) localStorage.setItem("DATA_PATH", dataPath);

  const apiBase = ""; // same origin plan A
  const planB = !!dataPath;
  // Plan B base: absolute URL base, or DATA_PATH string -> ./d/<DATA_PATH>/ on same origin
  const dataBase = !planB ? "" : (/^https?:\/\//.test(dataPath)
    ? dataPath.replace(/\/+$/, "") + "/"
    : "./d/" + encodeURIComponent(dataPath) + "/");
  const POLL_MS = 15000;

  async function getJson(name) {
    const res = await fetch(dataBase + name + "?_=" + Date.now(), { cache: "no-store" });
    if (res.status === 404) throw new Error("waiting");
    if (!res.ok) throw new Error("http " + res.status);
    return res.json();
  }
  async function loadState() {
    return planB ? getJson("state.json") : api("/api/state");
  }

  function show(tab) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    const el = document.getElementById("screen-" + tab);
    if (el) el.classList.add("active");
    document.querySelectorAll(".tabs button").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
  }

  document.querySelectorAll(".tabs button").forEach((b) => {
    b.addEventListener("click", () => show(b.dataset.tab));
  });

  async function api(path, opts) {
    const headers = Object.assign({}, (opts && opts.headers) || {});
    if (token) headers["Authorization"] = "Bearer " + token;
    const url = apiBase + path;
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (res.status === 401) throw new Error("unauthorized");
    if (!res.ok) throw new Error("http " + res.status);
    return res.json();
  }

  function render(state) {
    const mode = (state.mode || "PAPER").toUpperCase();
    const badge = document.getElementById("mode-badge");
    badge.textContent = mode;
    badge.className = "badge " + (mode === "LIVE" ? "live" : "paper");

    const bal = state.balance || {};
    document.getElementById("stack-val").textContent = "$" + Number(bal.stack || 0).toFixed(2);
    document.getElementById("free-val").textContent = "free $" + Number(bal.free || 0).toFixed(2);
    document.getElementById("open-count").textContent = (state.positions || []).length;

    const posList = document.getElementById("pos-list");
    const positions = state.positions || [];
    if (!positions.length) {
      posList.className = "list empty-state";
      posList.textContent = "No positions";
    } else {
      posList.className = "list";
      posList.innerHTML = positions.map((p) => {
        const link = p.link || "#";
        return `<div class="item"><span class="n">${p.name || p.mint.slice(0,6)}</span>
          <span class="r"><a class="link" href="${link}">Sell on FOMO</a><br>$${Number(p.size_usd).toFixed(2)}</span></div>`;
      }).join("");
    }

    const act = state.activity || [];
    const feed = document.getElementById("feed");
    const activity = document.getElementById("activity");
    function actHtml(rows) {
      if (!rows.length) return null;
      return rows.map((a) => {
        const kill = a.kind && (a.kind.includes("kill") || a.kind === "reject" || a.kind === "skip");
        return `<div class="item ${kill ? "kill" : ""}"><span class="n">${a.title || a.kind}</span>
          <span class="r">${a.detail || ""}</span></div>`;
      }).join("");
    }
    const fh = actHtml(act.slice(0, 20));
    if (fh) { feed.className = "list"; feed.innerHTML = fh; }
    else { feed.className = "list empty-state"; feed.textContent = "Waiting for night…"; }
    const ah = actHtml(act);
    if (ah) { activity.className = "list"; activity.innerHTML = ah; }
    else { activity.className = "list empty-state"; activity.textContent = "No activity yet"; }

    const s = state.settings || {};
    document.getElementById("fomo-handle").textContent = "@" + (s.fomo_handle || state.fomo_handle || "—");
    document.getElementById("acct-mode").textContent = mode;
    document.getElementById("acct-notifier").textContent = s.notifier || "—";
    document.getElementById("acct-analyst").textContent = s.analyst_mode || "—";
    document.getElementById("set-stop").textContent = "-" + (s.stop_pct ?? "—") + "%";
    document.getElementById("set-trail").textContent = (s.trail_pct ?? "—") + "%";
    const sr = document.getElementById("stop-range");
    const sn = document.getElementById("stop-num");
    if (s.stop_pct != null) { sr.value = s.stop_pct; sn.value = s.stop_pct; }
    document.getElementById("signup").href = state.signup_url || "https://fomo.family/r/savipww";

    const hb = state.heartbeats || [];
    document.getElementById("hb").textContent = hb.map((h) => h.agent + " @ " + h.ts).join("\n") || "—";
  }

  async function boot() {
    show("loading");
    if (!token) {
      document.getElementById("err-msg").textContent = "Missing APP_TOKEN. Open URL with #t=…";
      show("error");
      return;
    }
    if (planB) {
      let shown = false;
      const tick = async () => {
        try {
          render(await loadState());
          if (!shown) { show("home"); shown = true; }
        } catch (e) {
          if (!shown) {
            document.getElementById("err-msg").textContent = e.message === "waiting"
              ? "Waiting for desk data… (no state.json published yet; retrying every 15s)"
              : "Data fetch failed: " + (e.message || e) + " (retrying)";
            show("error");
          }
        }
      };
      await tick();
      setInterval(tick, POLL_MS);
      return;
    }
    try {
      const state = await api("/api/state");
      render(state);
      show("home");
      // SSE
      try {
        const es = new EventSource("/api/stream?token=" + encodeURIComponent(token));
        es.onmessage = async () => {
          try { render(await api("/api/state")); } catch (e) {}
        };
      } catch (e) {}
    } catch (e) {
      document.getElementById("err-msg").textContent = String(e.message || e);
      show("error");
    }
  }

  document.getElementById("stop-range").addEventListener("input", (e) => {
    document.getElementById("stop-num").value = e.target.value;
  });
  document.getElementById("stop-num").addEventListener("input", (e) => {
    document.getElementById("stop-range").value = e.target.value;
  });
  document.getElementById("save-stop").addEventListener("click", async () => {
    const v = Number(document.getElementById("stop-num").value);
    if (planB) { alert("Read-only on Plan B: change settings via Telegram."); return; }
    try {
      await api("/api/settings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stop_pct: v }) });
      const state = await api("/api/state");
      render(state);
    } catch (e) {
      alert(e.message);
    }
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }

  boot();
})();
