/* 잇데이 운영자 admin — 출시 첫날 화면
 *
 * [출시감사 2026-07-31] 왜 '운영 메트릭'과 따로 만드나:
 *   metrics.html 은 사업 지표(결제 전환율·매출·MAU) 중심이라 "지금 뭐가 터지고 있나"엔 안 맞는다.
 *   출시 첫날엔 다른 걸 본다 — 사람이 실제로 쓰고 있나 / AI 비용이 예산 안인가 /
 *   막아둔 기능이 없나. 5~10분마다 새로고침하며 사고를 잡는 용도다.
 *
 * 백엔드: GET /admin/launch-metrics?hours=N  (admin 전용, routers/admin.py)
 * 의존: AdminCore.api / fmtNum / fmtKRW / escapeHtml
 *
 * GCP 전용 지표(DB CPU·Cloud Run 인스턴스·실제 청구액)는 여기서 안 뽑는다 —
 * API 연동은 과투자다. 콘솔 딥링크를 두는 게 싸고 정확하다.
 */
(function () {
  "use strict";

  var AUTO_MS = 5 * 60 * 1000;
  var root = null;
  var timer = null;
  var hours = 24;

  // 백엔드 utils/cost_guard.py 의 UNIT_COST_KRW 와 같은 값(표시용).
  // 여기서만 쓰는 복제라 값이 갈릴 수 있다 — 원가를 바꾸면 양쪽 다 고칠 것.
  var UNIT = {
    assistant: 7.5,
    caption: 3.0,
    "remove-bg": 1.4,
    "ai-enhance": 2.2,
    "ai-remove-object": 2.8,
    "ai-generate-bg": 39.2,
    analyze: 3.0,
    "portfolio-tag": 1.0,
    "photo-ai-analyze": 3.0,
  };
  var LABEL = {
    assistant: "잇비",
    caption: "캡션",
    "remove-bg": "누끼",
    analyze: "말투 분석",
    "portfolio-tag": "포트폴리오 태그",
    "photo-ai-analyze": "사진 AI 분석",
    "ai-enhance": "AI 보정",
    "ai-remove-object": "AI 지우개",
    "ai-generate-bg": "AI 배경생성",
  };

  var esc = function (s) {
    return window.AdminCore && window.AdminCore.escapeHtml
      ? window.AdminCore.escapeHtml(String(s == null ? "" : s))
      : String(s == null ? "" : s);
  };
  var n = function (v) {
    if (v == null || v < 0) return "–";
    return window.AdminCore && window.AdminCore.fmtNum
      ? window.AdminCore.fmtNum(v)
      : Number(v).toLocaleString("ko-KR");
  };

  function kpi(title, value, note, tone) {
    return (
      '<div class="kpi">' +
      "<h4>" + esc(title) + "</h4>" +
      '<div class="v"' + (tone ? ' style="color:' + tone + '"' : "") + ">" + esc(value) + "</div>" +
      (note ? '<div class="card-title" style="margin-top:6px;text-transform:none">' + esc(note) + "</div>" : "") +
      "</div>"
    );
  }

  function render(d) {
    var u = d.users || {};
    var a = d.actions || {};
    var c = d.cost_krw || {};
    var s = d.switches || {};

    // 원가 상한 사용률 — 60% 노랑, 90% 빨강
    var ratio = c.cap && c.today != null ? c.today / c.cap : 0;
    var costTone = ratio >= 0.9 ? "#f85149" : ratio >= 0.6 ? "#d29922" : "";

    // 막아둔 기능이 있으면 맨 위에 크게 — 이걸 잊고 "왜 안 되지" 하는 걸 막는다
    var blocked = [];
    if (s.maintenance) blocked.push("전체 점검 모드");
    if (s.assistant_off) blocked.push("잇비");
    if (s.caption_off) blocked.push("캡션");
    if (s.image_ai_off) blocked.push("AI 이미지");
    if (s.removebg_off) blocked.push("누끼");

    var html = "";

    if (blocked.length) {
      html +=
        '<div class="kpi" style="border-color:#f85149;background:rgba(248,81,73,.08);margin-bottom:22px">' +
        '<h4 style="color:#f85149">지금 막혀 있는 기능</h4>' +
        '<div class="v" style="color:#f85149;font-size:20px">' + esc(blocked.join(" · ")) + "</div>" +
        '<div class="card-title" style="margin-top:6px;text-transform:none">' +
        "Cloud Run 환경변수(MAINTENANCE_MODE · FEATURE_*)로 켜져 있음. 복구하려면 해당 변수를 지운다." +
        "</div></div>";
    }

    html +=
      '<h3 class="card-title">사용자</h3><div class="kpi-grid">' +
      kpi("전체 가입", n(u.total)) +
      kpi("신규 가입", n(u.new), "최근 " + hours + "시간") +
      kpi("활성 사용자", n(u.active), "AI 를 1회 이상 쓴 사람") +
      kpi("유료 · 체험", n(u.paid)) +
      "</div>";

    html +=
      '<h3 class="card-title">원장님이 실제로 한 일</h3><div class="kpi-grid">' +
      kpi("예약 등록", n(a.bookings)) +
      kpi("매출 기록", n(a.revenue_records)) +
      kpi("고객 등록", n(a.customers)) +
      "</div>";

    html +=
      '<h3 class="card-title">AI 원가</h3><div class="kpi-grid">' +
      kpi("구간 원가", n(c.window) + "원", "최근 " + hours + "시간") +
      kpi("오늘 누적", c.today == null ? "–" : n(c.today) + "원",
          c.cap ? "일 상한 " + n(c.cap) + "원" : "상한 미설정 (ITDASY_DAILY_COST_CAP_KRW)", costTone) +
      kpi("상한 사용률", c.cap && c.today != null ? Math.round(ratio * 100) + "%" : "–",
          c.cap ? "" : "상한을 걸어두면 폭주를 막는다", costTone) +
      "</div>";

    // 기능별 호출 · 원가
    var usage = d.ai_usage || {};
    var keys = Object.keys(usage).sort(function (x, y) { return usage[y] - usage[x]; });
    var rows = keys.map(function (k) {
      var cnt = usage[k];
      var cost = UNIT[k] ? Math.round(UNIT[k] * cnt) : null;
      return (
        "<tr><td>" + esc(LABEL[k] || k) + "</td>" +
        '<td style="text-align:right">' + n(cnt) + "</td>" +
        '<td style="text-align:right">' + (cost == null ? '<span class="muted-cell">–</span>' : n(cost) + "원") + "</td></tr>"
      );
    });
    html +=
      '<h3 class="card-title">기능별 사용량</h3><div class="table-wrap"><table>' +
      "<thead><tr><th>기능</th><th style=\"text-align:right\">호출</th><th style=\"text-align:right\">추정 원가</th></tr></thead>" +
      "<tbody>" +
      (rows.join("") || '<tr><td colspan="3" class="muted-cell">아직 호출 없음</td></tr>') +
      "</tbody></table></div>";

    // 콘솔 딥링크
    html +=
      '<h3 class="card-title" style="margin-top:22px">여기선 못 보는 것 — 콘솔에서</h3>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      [
        ["Cloud Run 지표 (인스턴스·지연·5xx)", "https://console.cloud.google.com/run/detail/asia-northeast3/itdasy-backend-staging/metrics?project=itdasy-495513"],
        ["Cloud Run 로그", "https://console.cloud.google.com/logs/query?project=itdasy-495513"],
        ["GCP 청구 (실제 LLM 비용)", "https://console.cloud.google.com/billing"],
        ["Supabase (DB·Storage)", "https://supabase.com/dashboard"],
        ["Uptime 알림 이력", "https://github.com/Nopo-lab/itdasy_backend-test/actions/workflows/uptime-alert.yml"],
      ]
        .map(function (p) {
          return '<a class="btn" target="_blank" rel="noopener" href="' + p[1] + '">' + esc(p[0]) + "</a>";
        })
        .join("") +
      "</div>";

    root.innerHTML = html;

    var sub = document.getElementById("launch-sub");
    if (sub) {
      sub.textContent =
        "기준 " + new Date(d.generated_at).toLocaleString("ko-KR") +
        " · 최근 " + d.window_hours + "시간 · 자동 갱신 5분";
    }
  }

  function load() {
    if (!window.AdminCore || !window.AdminCore.api) return;
    window.AdminCore.api("/admin/launch-metrics?hours=" + hours)
      .then(render)
      .catch(function (e) {
        root.innerHTML =
          '<div class="kpi" style="border-color:#f85149">' +
          '<h4 style="color:#f85149">불러오기 실패</h4>' +
          '<div class="card-title" style="text-transform:none">' + esc(e && e.message ? e.message : e) + "</div>" +
          '<div class="card-title" style="text-transform:none;margin-top:8px">' +
          "403 이면 admin 계정이 아닙니다. 401 이면 다시 로그인하세요." +
          "</div></div>";
      });
  }

  function mount() {
    root = document.getElementById("launch-root");
    if (!root) return;

    // 구간 선택 — 첫날엔 1시간, 이후엔 24시간을 주로 본다
    var bar = document.createElement("div");
    bar.style.cssText = "display:flex;gap:8px;margin-bottom:18px;align-items:center";
    bar.innerHTML =
      [1, 6, 24, 168]
        .map(function (h) {
          return '<button class="btn" data-h="' + h + '">' +
            (h === 168 ? "7일" : h + "시간") + "</button>";
        })
        .join("") +
      '<span class="card-title" style="text-transform:none;margin:0 0 0 8px">자동 갱신 5분</span>';
    root.parentNode.insertBefore(bar, root);
    bar.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-h]");
      if (!b) return;
      hours = Number(b.getAttribute("data-h"));
      load();
    });

    load();
    if (timer) clearInterval(timer);
    timer = setInterval(load, AUTO_MS);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
