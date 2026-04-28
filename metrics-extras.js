/* 잇데이 운영자 admin — 추가 메트릭 카드 4종
 *  1) 멤버십 결제 전환율 + 월별 trend
 *  2) 예상 월 비용 (USD/KRW + breakdown)
 *  3) 저장소 사용률 (DB / R2 / Supabase Storage)
 *  4) 사용자 활성도 (DAU/WAU/MAU)
 *
 * 사용법:
 *   1) 페이지 HTML 안에 다음 컨테이너를 두면 자동 마운트:
 *        <div id="metrics-extras"></div>
 *   2) Chart.js (CDN) 가 이미 로드돼 있어야 함. 없으면 자동 lazy-load.
 *   3) AdminCore.api / AdminCore.fmtKRW / fmtUSD / fmtNum 의존.
 */
(function () {
  "use strict";

  var CHART_CDN = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";

  function loadChartJs() {
    return new Promise(function (resolve) {
      if (window.Chart) return resolve(window.Chart);
      var s = document.createElement("script");
      s.src = CHART_CDN;
      s.async = true;
      s.onload = function () {
        resolve(window.Chart);
      };
      s.onerror = function () {
        resolve(null);
      };
      document.head.appendChild(s);
    });
  }

  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === "class") n.className = attrs[k];
        else if (k === "style") n.setAttribute("style", attrs[k]);
        else if (k === "html") n.innerHTML = attrs[k];
        else n.setAttribute(k, attrs[k]);
      });
    }
    if (children) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
      });
    }
    return n;
  }

  function pct(n) {
    return Number(n || 0).toFixed(2) + "%";
  }

  function progressBar(used, limit, color) {
    var pctVal = limit && limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    var bar = el("div", { class: "mx-bar" });
    bar.appendChild(
      el("div", {
        class: "mx-bar-fill",
        style:
          "width:" +
          pctVal.toFixed(1) +
          "%;background:" +
          (color || "var(--brand,#f18091)") +
          ";",
      })
    );
    return bar;
  }

  function buildLayout(host) {
    host.innerHTML = "";
    var grid = el("div", { class: "mx-grid" });
    host.appendChild(grid);

    // 1) 결제 전환율
    var c1 = el("section", { class: "mx-card", id: "mx-conversion" });
    c1.appendChild(el("h3", { class: "mx-h" }, "멤버십 결제 전환율"));
    c1.appendChild(el("div", { class: "mx-big", id: "mx-conv-rate" }, "—"));
    c1.appendChild(el("div", { class: "mx-sub", id: "mx-conv-sub" }, ""));
    c1.appendChild(
      el("div", { class: "mx-chart-wrap" }, el("canvas", { id: "mx-conv-chart" }))
    );
    grid.appendChild(c1);

    // 2) 예상 월 비용
    var c2 = el("section", { class: "mx-card", id: "mx-cost" });
    c2.appendChild(el("h3", { class: "mx-h" }, "예상 월 인프라 비용"));
    c2.appendChild(el("div", { class: "mx-big", id: "mx-cost-krw" }, "—"));
    c2.appendChild(el("div", { class: "mx-sub", id: "mx-cost-usd" }, ""));
    c2.appendChild(el("ul", { class: "mx-list", id: "mx-cost-list" }));
    grid.appendChild(c2);

    // 3) 저장소 사용률
    var c3 = el("section", { class: "mx-card", id: "mx-storage" });
    c3.appendChild(el("h3", { class: "mx-h" }, "저장소 사용률"));
    c3.appendChild(el("div", { class: "mx-rows", id: "mx-storage-rows" }));
    grid.appendChild(c3);

    // 4) 사용자 활성도
    var c4 = el("section", { class: "mx-card", id: "mx-activity" });
    c4.appendChild(el("h3", { class: "mx-h" }, "사용자 활성도"));
    var row = el("div", { class: "mx-stat-row" });
    ["DAU", "WAU", "MAU"].forEach(function (k) {
      var box = el("div", { class: "mx-stat" });
      box.appendChild(el("div", { class: "mx-stat-k" }, k));
      box.appendChild(el("div", { class: "mx-stat-v", id: "mx-act-" + k.toLowerCase() }, "—"));
      row.appendChild(box);
    });
    c4.appendChild(row);
    c4.appendChild(el("div", { class: "mx-sub", id: "mx-act-extra" }, ""));
    grid.appendChild(c4);

    injectStyles();
  }

  function injectStyles() {
    if (document.getElementById("mx-style")) return;
    var css =
      ".mx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-top:8px;}" +
      ".mx-card{background:var(--bg-2,#1d222c);border:1px solid var(--line,#2a3142);border-radius:14px;padding:18px;box-shadow:var(--shadow,0 8px 24px rgba(0,0,0,.32));}" +
      ".mx-h{margin:0 0 10px;font-size:13px;color:var(--text-2,#7c869c);font-weight:600;letter-spacing:0.02em;}" +
      ".mx-big{font-size:28px;font-weight:700;color:var(--text-0,#eef1f7);}" +
      ".mx-sub{font-size:12px;color:var(--text-2,#7c869c);margin-top:4px;}" +
      ".mx-list{list-style:none;padding:0;margin:12px 0 0;font-size:12.5px;color:var(--text-1,#b9c1d4);}" +
      ".mx-list li{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed var(--line,#2a3142);}" +
      ".mx-list li:last-child{border:0;}" +
      ".mx-rows{display:flex;flex-direction:column;gap:14px;}" +
      ".mx-row-h{display:flex;justify-content:space-between;font-size:13px;color:var(--text-1,#b9c1d4);margin-bottom:4px;}" +
      ".mx-bar{width:100%;height:8px;background:var(--bg-3,#252b38);border-radius:6px;overflow:hidden;}" +
      ".mx-bar-fill{height:100%;border-radius:6px;transition:width .3s ease;}" +
      ".mx-stat-row{display:flex;gap:10px;}" +
      ".mx-stat{flex:1;background:var(--bg-3,#252b38);border-radius:10px;padding:10px 12px;text-align:center;}" +
      ".mx-stat-k{font-size:11px;color:var(--text-2,#7c869c);font-weight:600;}" +
      ".mx-stat-v{font-size:22px;font-weight:700;margin-top:4px;color:var(--text-0,#eef1f7);}" +
      ".mx-chart-wrap{margin-top:12px;height:140px;}";
    var s = document.createElement("style");
    s.id = "mx-style";
    s.textContent = css;
    document.head.appendChild(s);
  }

  async function loadConversion() {
    try {
      var d = await window.AdminCore.api("/admin/stats/conversion-rate");
      document.getElementById("mx-conv-rate").textContent = pct(d.conversion_rate);
      document.getElementById("mx-conv-sub").textContent =
        "유료 " +
        window.AdminCore.fmtNum(d.paid_users) +
        " / 전체 " +
        window.AdminCore.fmtNum(d.total_users) +
        " · 평균 " +
        Number(d.avg_days_to_paid || 0).toFixed(1) +
        "일 만에 결제";

      var Chart = await loadChartJs();
      if (!Chart) return;
      var ctx = document.getElementById("mx-conv-chart");
      if (!ctx) return;
      var labels = d.monthly_trend.map(function (x) {
        return x.month.slice(2);
      });
      var data = d.monthly_trend.map(function (x) {
        return x.conversion_rate;
      });
      // eslint-disable-next-line no-new
      new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "전환율 (%)",
              data: data,
              borderColor: "#f18091",
              backgroundColor: "rgba(241,128,145,0.15)",
              fill: true,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            x: { ticks: { color: "#7c869c", font: { size: 10 } }, grid: { display: false } },
            y: {
              ticks: { color: "#7c869c", font: { size: 10 } },
              grid: { color: "rgba(255,255,255,0.04)" },
              beginAtZero: true,
            },
          },
        },
      });
    } catch (e) {
      document.getElementById("mx-conv-rate").textContent = "—";
      document.getElementById("mx-conv-sub").textContent =
        "전환율 조회 실패: " + (e.message || "");
    }
  }

  async function loadCost() {
    try {
      var d = await window.AdminCore.api("/admin/stats/infra-cost?period=month");
      document.getElementById("mx-cost-krw").textContent =
        window.AdminCore.fmtKRW(d.estimated_monthly_krw);
      document.getElementById("mx-cost-usd").textContent =
        "≈ " + window.AdminCore.fmtUSD(d.estimated_monthly_usd) + " / 월 (USD)";
      var ul = document.getElementById("mx-cost-list");
      ul.innerHTML = "";
      var items = [
        ["Gemini API", d.gemini_usd],
        ["Replicate (누끼)", d.replicate_usd],
        ["Railway", d.railway_usd],
        ["Supabase", d.supabase_usd],
        ["FCM", 0],
      ];
      items.forEach(function (it) {
        var li = el("li");
        li.appendChild(el("span", null, it[0]));
        li.appendChild(el("span", null, window.AdminCore.fmtUSD(it[1])));
        ul.appendChild(li);
      });
    } catch (e) {
      document.getElementById("mx-cost-krw").textContent = "—";
      document.getElementById("mx-cost-usd").textContent = "비용 조회 실패";
    }
  }

  async function loadStorage() {
    try {
      var d = await window.AdminCore.api("/admin/stats/storage");
      var host = document.getElementById("mx-storage-rows");
      host.innerHTML = "";

      function addRow(label, used, limit, color) {
        var rh = el("div", { class: "mx-row-h" });
        rh.appendChild(el("span", null, label));
        var usedTxt =
          used == null
            ? "—"
            : Number(used).toFixed(1) + " MB" + (limit ? " / " + Number(limit).toFixed(0) + " MB" : "");
        rh.appendChild(el("span", null, usedTxt));
        host.appendChild(rh);
        host.appendChild(progressBar(used || 0, limit || 0, color));
      }

      addRow("DB (Postgres)", d.db_mb, d.db_limit_mb, "#6ee7b7");
      addRow("Cloudflare R2", d.r2_mb, d.r2_limit_mb, "#fbbf24");
      addRow("Supabase Storage", d.supabase_storage_mb, d.supabase_limit_mb, "#f18091");
    } catch (e) {
      var host2 = document.getElementById("mx-storage-rows");
      host2.innerHTML = '<div class="mx-sub">저장소 조회 실패</div>';
    }
  }

  async function loadActivity() {
    try {
      var d = await window.AdminCore.api("/admin/stats/user-activity?period=month");
      document.getElementById("mx-act-dau").textContent = window.AdminCore.fmtNum(d.dau);
      document.getElementById("mx-act-wau").textContent = window.AdminCore.fmtNum(d.wau);
      document.getElementById("mx-act-mau").textContent = window.AdminCore.fmtNum(d.mau);
      document.getElementById("mx-act-extra").textContent =
        "신규 가입 " +
        window.AdminCore.fmtNum(d.new_users) +
        "명 · 평균 세션 " +
        Number(d.avg_session_minutes || 0).toFixed(1) +
        "분";
    } catch (e) {
      document.getElementById("mx-act-extra").textContent = "활성도 조회 실패";
    }
  }

  function mount() {
    var host = document.getElementById("metrics-extras");
    if (!host) return; // 컨테이너 없으면 silent skip
    if (!window.AdminCore || !window.AdminCore.api) {
      console.warn("[metrics-extras] AdminCore 미로드 — app-admin-core.js 먼저 로드 필요");
      return;
    }
    buildLayout(host);
    loadConversion();
    loadCost();
    loadStorage();
    loadActivity();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }

  window.MetricsExtras = { mount: mount };
})();
