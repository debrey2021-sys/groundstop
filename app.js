(() => {
  "use strict";

  // Live data sits on the repo's `data` branch so it can change without a redeploy.
  // The copies shipped with the site are the fallback.
  const REMOTE = "https://raw.githubusercontent.com/debrey2021-sys/groundstop/data/";
  const LOCAL = "data/";
  const STALE_AFTER_MIN = 60;
  const REFRESH_MS = 60 * 1000;

  const AIRPORTS = {
    ATL: "Atlanta", AUS: "Austin", BDL: "Hartford", BNA: "Nashville", BOS: "Boston", BUF: "Buffalo",
    BUR: "Burbank", BWI: "Baltimore", CHS: "Charleston", CLE: "Cleveland", CLT: "Charlotte",
    CMH: "Columbus", CVG: "Cincinnati", DAL: "Dallas Love Field", DCA: "Washington Reagan",
    DEN: "Denver", DFW: "Dallas Fort Worth", DTW: "Detroit", EWR: "Newark", FLL: "Fort Lauderdale",
    HNL: "Honolulu", HOU: "Houston Hobby", IAD: "Washington Dulles", IAH: "Houston Intercontinental",
    IND: "Indianapolis", JAX: "Jacksonville", JFK: "New York JFK", LAS: "Las Vegas", LAX: "Los Angeles",
    LGA: "New York LaGuardia", MCI: "Kansas City", MCO: "Orlando", MDW: "Chicago Midway",
    MEM: "Memphis", MIA: "Miami", MKE: "Milwaukee", MSP: "Minneapolis St. Paul", MSY: "New Orleans",
    OAK: "Oakland", OGG: "Maui", OMA: "Omaha", ONT: "Ontario", ORD: "Chicago O'Hare", PBI: "West Palm Beach",
    PDX: "Portland", PHL: "Philadelphia", PHX: "Phoenix", PIT: "Pittsburgh", RDU: "Raleigh Durham",
    RSW: "Fort Myers", SAN: "San Diego", SAT: "San Antonio", SDF: "Louisville", SEA: "Seattle",
    SFO: "San Francisco", SJC: "San Jose", SJU: "San Juan", SLC: "Salt Lake City", SMF: "Sacramento",
    SNA: "Orange County", STL: "St. Louis", TPA: "Tampa", ANC: "Anchorage", ABQ: "Albuquerque",
    BOI: "Boise", RNO: "Reno", TUS: "Tucson", ELP: "El Paso", OKC: "Oklahoma City", TUL: "Tulsa",
    RIC: "Richmond", ORF: "Norfolk", PVD: "Providence", ALB: "Albany", SYR: "Syracuse", ROC: "Rochester",
    GRR: "Grand Rapids", DSM: "Des Moines", SAV: "Savannah", PNS: "Pensacola", BHM: "Birmingham",
  };
  const HUBS = ["ATL", "ORD", "DFW", "DEN", "LAX", "JFK", "EWR", "LGA", "SFO", "SEA", "MIA", "MCO", "CLT", "PHX", "IAH", "BOS", "LAS", "MSP", "DTW", "PHL"];

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  let national = null;
  let feed = null;
  let selected = null;

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const fmtTime = (iso) => (iso ? timeFmt.format(new Date(iso)) : "");
  const ago = (iso) => {
    const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    return `${h} hr ${m % 60} min ago`;
  };
  const fmtMin = (n) => {
    if (n == null) return null;
    const m = Math.round(Number(n));
    return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`;
  };
  const tidy = (s) => {
    if (!s) return "";
    const codes = { EQ: "equipment", WX: "weather", VOL: "volume", RWY: "runway", OTHER: "other" };
    return String(s)
      .replace(/^TM Initiatives:/i, "")
      .split(":")
      .map((p) => codes[p.trim().toUpperCase()] || p.trim().toLowerCase())
      .join(", ");
  };

  async function getJSON(name) {
    const bust = Math.floor(Date.now() / REFRESH_MS);
    for (const base of [REMOTE, LOCAL]) {
      try {
        const r = await fetch(`${base}${name}?t=${bust}`, { cache: "no-store" });
        if (r.ok) return await r.json();
      } catch (_) { /* try the next source */ }
    }
    return null;
  }

  function effectiveState() {
    if (!national) return "loading";
    if (national.state === "lifted" || national.state === "partial") return national.state;
    const mins = (Date.now() - Date.parse(national.verifiedAt)) / 60000;
    return mins > STALE_AFTER_MIN ? "stale" : "active";
  }

  function renderHero() {
    const state = effectiveState();
    document.documentElement.dataset.state = state;
    const answer = $("answer");
    const sub = $("sub");
    const copy = {
      loading: ["…", "Checking the latest."],
      active: ["NO.", national && national.summary],
      stale: ["Not confirmed.", `Flights were still grounded when we last checked at ${national ? fmtTime(national.verifiedAt) : ""}. That check is more than an hour old, so confirm with the FAA or your airline.`],
      partial: ["Partly.", national && national.summary],
      lifted: ["YES.", national && national.summary],
    }[state];
    answer.textContent = copy[0];
    answer.classList.toggle("long", copy[0].length > 5);
    sub.textContent = copy[1] || "";

    const short = { active: "NO", stale: "Unconfirmed", partial: "Partly", lifted: "YES" }[state];
    document.title = short ? `${short} — Is the ground stop over?` : "Is the ground stop over?";

    if (!national) return;
    $("clockLabel").textContent = state === "lifted" ? "Flights were grounded for" : "Grounded for";
    $("clockMeta").textContent =
      `Ordered ${fmtTime(national.issuedAt)}` + (national.liftedAt ? ` · lifted ${fmtTime(national.liftedAt)}` : "");

    const v = $("verified");
    v.textContent = "";
    v.append(`Status last confirmed ${fmtTime(national.verifiedAt)} (${ago(national.verifiedAt)}) against `);
    if (national.sourceUrl) {
      const a = el("a", null, national.sourceName || "source");
      a.href = national.sourceUrl;
      a.rel = "noopener";
      v.append(a);
    }
    v.append(".");
    $("liveText").textContent = `Checked ${ago(national.verifiedAt)}`;
    $("cause").textContent = national.cause || "";
  }

  function tick() {
    if (!national) return;
    const end = national.liftedAt ? Date.parse(national.liftedAt) : Date.now();
    let s = Math.max(0, Math.floor((end - Date.parse(national.issuedAt)) / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    const p = (n) => String(n).padStart(2, "0");
    $("clock").textContent = `${p(h)}:${p(m)}:${p(s)}`;
  }

  function renderTimeline() {
    const list = $("timelineList");
    list.textContent = "";
    for (const item of (national && national.timeline) || []) {
      const li = el("li");
      const t = el("time", null, fmtTime(item.t));
      t.dateTime = item.t;
      const p = el("p", null, item.text);
      if (item.url) {
        const src = el("a", "src", item.source || "Source");
        src.href = item.url;
        src.rel = "noopener";
        p.append(src);
      }
      li.append(t, p);
      list.append(li);
    }
  }

  // One airport's FAA entries as [title, detail, isRestrictive].
  function airportLines(code) {
    const a = feed && feed.airports && feed.airports[code];
    const out = [];
    if (!a) return out;
    if (a.groundStop) out.push(["Airport ground stop", `Reason: ${tidy(a.groundStop.reason) || "not given"}` + (a.groundStop.end ? `. Scheduled until ${fmtTime(a.groundStop.end)}` : ""), true]);
    if (a.closure) out.push(["Closure notice", a.closure.text || "", true]);
    if (a.groundDelay) out.push(["Ground delay program", `Average ${fmtMin(a.groundDelay.avgMin) || "n/a"}, up to ${fmtMin(a.groundDelay.maxMin) || "n/a"}. Reason: ${tidy(a.groundDelay.reason) || "not given"}`, true]);
    if (a.departureDelay) out.push(["Departure delays", `${a.departureDelay.min || "?"} to ${a.departureDelay.max || "?"}${a.departureDelay.trend ? ", " + a.departureDelay.trend.toLowerCase() : ""}. Reason: ${tidy(a.departureDelay.reason) || "not given"}`, true]);
    if (a.arrivalDelay) out.push(["Arrival delays", `${a.arrivalDelay.min || "?"} to ${a.arrivalDelay.max || "?"}${a.arrivalDelay.trend ? ", " + a.arrivalDelay.trend.toLowerCase() : ""}. Reason: ${tidy(a.arrivalDelay.reason) || "not given"}`, true]);
    return out;
  }
  const kindOf = (code) => {
    const a = feed.airports[code];
    if (a.groundStop) return ["Ground stop", tidy(a.groundStop.reason)];
    if (a.closure) return ["Closure notice", ""];
    if (a.groundDelay) return ["Ground delay", `avg ${fmtMin(a.groundDelay.avgMin) || "n/a"}, ${tidy(a.groundDelay.reason)}`];
    if (a.departureDelay) return ["Departure delays", `${a.departureDelay.max || ""}, ${tidy(a.departureDelay.reason)}`];
    if (a.arrivalDelay) return ["Arrival delays", `${a.arrivalDelay.max || ""}, ${tidy(a.arrivalDelay.reason)}`];
    return ["Notice", ""];
  };
  const nameOf = (code) => AIRPORTS[code] || (feed && feed.airports && feed.airports[code] && feed.airports[code].name) || "";

  function resolve(q) {
    q = (q || "").trim();
    if (!q) return null;
    const up = q.toUpperCase().replace(/^K(?=[A-Z]{3}$)/, "");
    const lead = up.slice(0, 3);
    if (/^[A-Z]{3}$/.test(up) && (AIRPORTS[up] || (feed && feed.airports && feed.airports[up]))) return up;
    if (/^[A-Z]{3}\b/.test(up) && AIRPORTS[lead]) return lead; // "ORD - Chicago O'Hare" from the suggestion list
    const low = q.toLowerCase();
    const hit = Object.keys(AIRPORTS).find((c) => AIRPORTS[c].toLowerCase() === low)
      || Object.keys(AIRPORTS).find((c) => AIRPORTS[c].toLowerCase().includes(low));
    if (hit) return hit;
    return /^[A-Z]{3}$/.test(up) ? up : null;
  }

  function renderResult() {
    const box = $("result");
    if (!selected) { box.hidden = true; return; }
    box.hidden = false;
    box.textContent = "";
    const h = el("h3");
    h.append(el("span", "code", selected), nameOf(selected) || "Airport");
    box.append(h);

    const state = effectiveState();
    const ul = el("ul");
    const add = (title, detail, hot) => {
      const li = el("li", hot ? "hot" : "");
      li.append(el("b", null, title), detail || "");
      ul.append(li);
    };
    if (state === "active") add("Nationwide ground stop applies", "Departures from every U.S. airport are held, including this one. Arriving flights already in the air are still landing.", true);
    if (state === "stale") add("Nationwide ground stop was in effect at our last check", `Last confirmed ${fmtTime(national.verifiedAt)}. Confirm the current status with your airline.`, true);
    if (state === "partial") add("Nationwide stop partly lifted", national.summary, true);
    const lines = airportLines(selected);
    for (const [t, d, hot] of lines) add(t, d, hot && state !== "active");
    if (!lines.length) {
      add(feed ? "No airport-specific FAA program listed" : "FAA airport feed unavailable right now",
        feed ? (state === "lifted" ? "Nothing is restricting this airport in the FAA feed. Expect leftover delays while airlines reposition planes and crews." : "Nothing extra is listed for this airport beyond the nationwide order.") : "Try again in a minute.", false);
    }
    box.append(ul);

    const row = el("div", "row");
    const link = el("button", "btn", `Share ${selected} status`);
    link.type = "button";
    link.addEventListener("click", () => share(link, `${selected} airport status during the ground stop`));
    row.append(link);
    box.append(row);
  }

  function renderPrograms() {
    const wrap = $("programs");
    wrap.textContent = "";
    if (!feed) { wrap.append(el("p", "muted", "The FAA feed isn't reachable right now.")); return; }
    const codes = Object.keys(feed.airports || {}).sort();
    if (!codes.length) wrap.append(el("p", "muted", "The FAA lists no airport-specific programs at the moment."));
    for (const code of codes) {
      const [kind, why] = kindOf(code);
      const b = el("button", "prog");
      b.type = "button";
      b.append(el("span", "code", code), el("span", "kind", kind), el("span", "why", [nameOf(code), why].filter(Boolean).join(" · ")));
      b.addEventListener("click", () => pick(code, true));
      wrap.append(b);
    }
    $("feedMeta").textContent = `FAA feed read ${fmtTime(feed.fetchedAt)} (${ago(feed.fetchedAt)}). Source: nasstatus.faa.gov`;
    for (const c of document.querySelectorAll(".chip")) c.classList.toggle("flag", !!feed.airports[c.dataset.code]);
  }

  function pick(code, scroll) {
    selected = code;
    $("airportInput").value = code;
    const url = new URL(location.href);
    url.searchParams.set("a", code);
    history.replaceState(null, "", url);
    renderResult();
    if (scroll) $("result").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function share(btn, text) {
    const data = { title: document.title, text: text || "Is the ground stop over? Live answer:", url: location.href };
    const label = btn.textContent;
    try {
      if (navigator.share) { await navigator.share(data); return; }
      await navigator.clipboard.writeText(location.href);
      btn.textContent = "Link copied";
    } catch (e) {
      if (e && e.name === "AbortError") return;
      btn.textContent = "Copy the address bar link";
    }
    setTimeout(() => { btn.textContent = label; }, 2200);
  }

  async function refresh() {
    const [n, f] = await Promise.all([getJSON("national.json"), getJSON("airports.json")]);
    if (n && n.state) {
      const changed = !national || national.verifiedAt !== n.verifiedAt || national.state !== n.state;
      national = n;
      if (changed) renderTimeline();
    }
    if (f && f.airports) feed = f;
    renderHero();
    tick();
    renderPrograms();
    renderResult();
  }

  function init() {
    const list = $("airportList");
    for (const code of Object.keys(AIRPORTS).sort()) {
      const o = el("option");
      o.value = `${code} - ${AIRPORTS[code]}`;
      list.append(o);
    }
    const chips = $("chips");
    for (const code of HUBS) {
      const b = el("button", "chip", code);
      b.type = "button";
      b.dataset.code = code;
      b.title = AIRPORTS[code];
      b.addEventListener("click", () => pick(code, false));
      chips.append(b);
    }
    $("airportForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const input = $("airportInput");
      const code = resolve(input.value);
      if (code) { pick(code, false); return; }
      selected = null;
      const box = $("result");
      box.hidden = false;
      box.textContent = "";
      box.append(el("h3", null, "Couldn't match that airport"), el("p", "muted", "Try the three-letter code on your boarding pass, like ORD or ATL."));
    });
    $("share").addEventListener("click", (e) => share(e.currentTarget));

    const pre = resolve(new URLSearchParams(location.search).get("a"));
    if (pre) { selected = pre; $("airportInput").value = pre; }

    refresh();
    setInterval(refresh, REFRESH_MS);
    setInterval(() => { tick(); }, 1000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  }

  init();
})();
