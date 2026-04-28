/* 잇데이 admin — 운영 메트릭 (Chart.js) */
(function () {
  "use strict";
  var $ = function (s) {
    return document.querySelector(s);
  };
  var charts = {};
  var state = {
    requestId: 0,
    errorShown: false,
  };
  var CACHE_PREFIX = "itdasy_admin_metrics_cache_v2:";

  function destroy(key) {
    if (charts[key]) {
      try {
        charts[key].destroy();
      } catch (e) {}
      charts[key] = null;
    }
  }

  function buildLine(canvas, labels, data, label, color) {
    return new Chart(canvas, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: data,
            borderColor: color,
            backgroundColor: color + "33",
            borderWidth: 2,
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#b9c1d4" } } },
        scales: {
          x: { ticks: { color: "#7c869c" }, grid: { color: "#252b38" } },
          y: { ticks: { color: "#7c869c" }, grid: { color: "#252b38" }, beginAtZero: true },
        },
      },
    });
  }

  function buildBar(canvas, labels, data, label, color) {
    return new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          { label: label, data: data, backgroundColor: color, borderRadius: 6 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#7c869c" }, grid: { display: false } },
          y: { ticks: { color: "#7c869c" }, grid: { color: "#252b38" }, beginAtZero: true },
        },
      },
    });
  }

  function buildDoughnut(canvas, labels, data) {
    return new Chart(canvas, {
      type: "doughnut",
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: ["#7c869c", "#f18091", "#fbbf24"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: "#b9c1d4" } } },
        cutout: "62%",
      },
    });
  }

  function cacheKey(period) {
    return CACHE_PREFIX + period;
  }

  function readCache(period) {
    try {
      var raw = localStorage.getItem(cacheKey(period));
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeCache(period, section, data) {
    try {
      var cached = readCache(period);
      cached[section] = data;
      cached.updated_at = new Date().toISOString();
      localStorage.setItem(cacheKey(period), JSON.stringify(cached));
    } catch (e) {}
  }

  function renderSection(section, data) {
    if (section === "overview") renderOverview(data);
    if (section === "members") renderMembership(data);
    if (section === "revenue") renderRevenue(data);
    if (section === "api") renderApiUsage(data);
    if (section === "gem") renderGemini(data);
    if (section === "support") renderSupport(data);
  }

  function renderCached(period) {
    var cached = readCache(period);
    ["overview", "members", "revenue", "api", "gem", "support"].forEach(function (section) {
      if (cached[section]) renderSection(section, cached[section]);
    });
  }

  function fetchSection(requestId, period, section, path) {
    AdminCore.api(path)
      .then(function (data) {
        if (requestId !== state.requestId) return;
        renderSection(section, data);
        writeCache(period, section, data);
      })
      .catch(function (e) {
        if (requestId !== state.requestId) return;
        if (!state.errorShown) {
          state.errorShown = true;
          AdminCore.toast(e.message, { error: true });
        }
      });
  }

  function loadAll() {
    var period = $("#period-select") ? $("#period-select").value : "month";
    var requestId = ++state.requestId;
    state.errorShown = false;
    renderCached(period);
    fetchSection(requestId, period, "overview", "/admin/stats/overview");
    fetchSection(requestId, period, "members", "/admin/stats/memberships");
    fetchSection(requestId, period, "revenue", "/admin/stats/revenue?period=" + period);
    fetchSection(requestId, period, "api", "/admin/stats/api-usage?period=" + period);
    fetchSection(requestId, period, "gem", "/admin/stats/gemini-cost?period=" + period);
    fetchSection(requestId, period, "support", "/admin/stats/support-tickets?period=" + period);
  }

  function renderOverview(o) {
    var box = $("#kpi-overview");
    if (!box) return;
    var t = o.today,
      w = o.week,
      m = o.month;
    box.innerHTML =
      kpi("오늘 활성 사용자", AdminCore.fmtNum(t.active_users), "신규 " + t.new_users + "명") +
      kpi("이번주 매출", AdminCore.fmtKRW(w.revenue_krw), "결제 " + w.api_calls + "건 호출") +
      kpi("이번달 매출", AdminCore.fmtKRW(m.revenue_krw), "활성 " + m.active_users + "명", true) +
      kpi("이번달 상담 유입", AdminCore.fmtNum(m.support_messages), "API 콜 " + AdminCore.fmtNum(m.api_calls));
  }

  function kpi(title, value, sub, brand) {
    return (
      '<div class="kpi' +
      (brand ? " brand" : "") +
      '"><h4>' +
      AdminCore.escapeHtml(title) +
      '</h4><div class="v">' +
      value +
      '</div><div class="sub">' +
      AdminCore.escapeHtml(sub || "") +
      "</div></div>"
    );
  }

  function renderMembership(m) {
    var box = $("#kpi-membership");
    if (box) {
      box.innerHTML =
        kpi("Free", AdminCore.fmtNum(m.free), "무료 사용자") +
        kpi("Pro", AdminCore.fmtNum(m.pro), "유료", true) +
        kpi("Premium", AdminCore.fmtNum(m.premium), "프리미엄") +
        kpi("취소 누적", AdminCore.fmtNum(m.cancelled), "구독 취소");
    }
    var c = $("#chart-membership");
    if (c) {
      destroy("members");
      charts["members"] = buildDoughnut(
        c,
        ["Free", "Pro", "Premium"],
        [m.free, m.pro, m.premium]
      );
    }
  }

  function renderRevenue(r) {
    var c = $("#chart-revenue");
    if (!c) return;
    var labels = (r.daily || []).map(function (d) {
      return d.day.slice(5);
    });
    var data = (r.daily || []).map(function (d) {
      return d.amount;
    });
    destroy("rev");
    charts["rev"] = buildLine(c, labels, data, "매출 (KRW)", "#f18091");
    var s = $("#revenue-summary");
    if (s) {
      s.innerHTML =
        '<strong>' +
        AdminCore.fmtKRW(r.total_krw) +
        "</strong> · " +
        r.paid_count +
        "건 · 환불 " +
        AdminCore.fmtKRW(r.refunded_krw);
    }
  }

  function renderApiUsage(a) {
    var c = $("#chart-api");
    if (!c) return;
    var top = (a.by_endpoint || []).slice(0, 12);
    var labels = top.map(function (x) {
      return x.endpoint;
    });
    var data = top.map(function (x) {
      return x.calls;
    });
    destroy("api");
    charts["api"] = buildBar(c, labels, data, "호출 수", "#7c869c");
    var s = $("#api-summary");
    if (s) s.textContent = "총 " + AdminCore.fmtNum(a.total_calls) + " 호출";
  }

  function renderGemini(g) {
    var c = $("#chart-gemini");
    if (!c) return;
    var top = (g.by_endpoint || []).slice(0, 10);
    var labels = top.map(function (x) {
      return x.endpoint;
    });
    var data = top.map(function (x) {
      return Number(x.estimated_usd).toFixed(3);
    });
    destroy("gem");
    charts["gem"] = buildBar(c, labels, data, "Gemini 비용 (USD)", "#fbbf24");
    var s = $("#gemini-summary");
    if (s) {
      s.innerHTML =
        '<strong>' +
        AdminCore.fmtUSD(g.estimated_usd) +
        "</strong> 추정 · 80% flash / 20% pro 가정";
    }
  }

  function renderSupport(s) {
    var box = $("#kpi-support");
    if (!box) return;
    box.innerHTML =
      kpi("문의 유입", AdminCore.fmtNum(s.incoming), "기간 합계") +
      kpi("답변 발송", AdminCore.fmtNum(s.outgoing), "기간 합계") +
      kpi("응답률", s.response_rate + "%", "미응답 " + s.unanswered + "건", true) +
      kpi("평균 응답", s.avg_response_minutes + "분", "유저 메시지 → 답변");
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    if ($("#period-select")) {
      $("#period-select").addEventListener("change", loadAll);
    }
    loadAll();
  });
})();
