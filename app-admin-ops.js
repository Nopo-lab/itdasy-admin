/* 잇데이 admin — 출시 운영 상태 */
(function () {
  "use strict";

  var GITHUB_OWNER = "Nopo-lab";
  var FRONT_TEST_URL = "https://nopo-lab.github.io/itdasy-frontend-test-yeunjun/";
  var FRONT_PROD_URL = "https://nopo-lab.github.io/itdasy-frontend/";
  var REPOS = [
    { key: "frontend-test", label: "프론트 테스트", repo: "itdasy-frontend-test-yeunjun" },
    { key: "backend", label: "백엔드", repo: "itdasy_backend" },
    { key: "admin", label: "관리자", repo: "itdasy-admin" },
  ];

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(s) {
    return AdminCore.escapeHtml(s == null ? "" : String(s));
  }

  function withTimeout(url, opts) {
    opts = opts || {};
    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, opts.timeout || 7000);
    return fetch(url, {
      method: opts.method || "GET",
      headers: opts.headers || {},
      signal: controller.signal,
      cache: "no-store",
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  function statusClass(level) {
    if (level === "ok") return "ok";
    if (level === "warn") return "warn";
    return "bad";
  }

  function card(item) {
    var cls = statusClass(item.level);
    var href = item.href
      ? '<a class="status-link" href="' + esc(item.href) + '" target="_blank" rel="noopener">자세히</a>'
      : "";
    return (
      '<div class="status-card ' +
      cls +
      '">' +
      '<div class="status-top"><span class="status-dot"></span><span class="status-title">' +
      esc(item.title) +
      "</span>" +
      href +
      "</div>" +
      '<div class="status-main">' +
      esc(item.main) +
      "</div>" +
      '<div class="status-sub">' +
      esc(item.sub || "") +
      "</div>" +
      "</div>"
    );
  }

  function render(items) {
    var box = $("#ops-status-grid");
    if (!box) return;
    box.innerHTML = items.map(card).join("");
  }

  function runText(run) {
    if (!run) return { level: "warn", main: "기록 없음", sub: "최근 실행 기록을 찾지 못했습니다." };
    if (run.status !== "completed") {
      return { level: "warn", main: "실행 중", sub: run.name + " · " + run.status };
    }
    if (run.conclusion === "success") {
      return { level: "ok", main: "정상", sub: run.name + " · 성공" };
    }
    return { level: "bad", main: "확인 필요", sub: run.name + " · " + (run.conclusion || "실패") };
  }

  async function checkBackend() {
    try {
      var started = Date.now();
      var res = await withTimeout(AdminCore.API_BASE + "/", { timeout: 6000 });
      var ms = Date.now() - started;
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      return {
        title: "백엔드 서버",
        level: data.status === "ok" ? "ok" : "warn",
        main: data.status === "ok" ? "정상" : "응답 확인 필요",
        sub: AdminCore.API_BASE + " · " + ms + "ms",
        href: AdminCore.API_BASE + "/docs",
      };
    } catch (e) {
      return {
        title: "백엔드 서버",
        level: "bad",
        main: "응답 실패",
        sub: e.message || "서버 상태 확인 실패",
        href: AdminCore.API_BASE,
      };
    }
  }

  function parseBuild(html) {
    var m = String(html || "").match(/window\.__LATEST_BUILD__\s*=\s*'([^']+)'/);
    return m ? m[1] : "";
  }

  async function checkPageBuild(label, url) {
    try {
      var res = await withTimeout(url + "?admin_check=" + Date.now(), { timeout: 7000 });
      if (!res.ok) throw new Error("HTTP " + res.status);
      var html = await res.text();
      var build = parseBuild(html);
      return {
        title: label,
        level: build ? "ok" : "warn",
        main: build ? "배포 확인" : "빌드 표시 없음",
        sub: build || "HTML은 열리지만 빌드 번호가 없습니다.",
        href: url,
      };
    } catch (e) {
      return {
        title: label,
        level: "bad",
        main: "확인 실패",
        sub: e.message || "GitHub Pages 확인 실패",
        href: url,
      };
    }
  }

  async function fetchRuns(repo) {
    var url =
      "https://api.github.com/repos/" +
      GITHUB_OWNER +
      "/" +
      repo +
      "/actions/runs?per_page=12";
    var res = await withTimeout(url, {
      timeout: 8000,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error("GitHub HTTP " + res.status);
    var data = await res.json();
    return data.workflow_runs || [];
  }

  async function checkRepo(repoInfo) {
    try {
      var runs = await fetchRuns(repoInfo.repo);
      var latest = runs[0];
      var recentCutoff = Date.now() - 24 * 60 * 60 * 1000;
      var failed = runs.find(function (r) {
        return (
          new Date(r.created_at || 0).getTime() >= recentCutoff &&
          r.status === "completed" &&
          r.conclusion &&
          r.conclusion !== "success"
        );
      });
      var pick = failed || latest;
      var text = runText(pick);
      var sub = text.sub;
      if (repoInfo.repo === "itdasy-frontend-test-yeunjun" && pick && /Supabase/i.test(pick.name || "")) {
        sub += " · DB 비밀번호/접속주소 확인";
      }
      return {
        title: repoInfo.label + " Actions",
        level: failed ? "bad" : text.level,
        main: failed ? "실패 run 있음" : text.main,
        sub: sub,
        href: pick ? pick.html_url : "https://github.com/" + GITHUB_OWNER + "/" + repoInfo.repo + "/actions",
      };
    } catch (e) {
      return {
        title: repoInfo.label + " Actions",
        level: "warn",
        main: "확인 실패",
        sub: e.message || "GitHub API 제한 가능",
        href: "https://github.com/" + GITHUB_OWNER + "/" + repoInfo.repo + "/actions",
      };
    }
  }

  async function loadOpsStatus() {
    var box = $("#ops-status-grid");
    if (box) {
      box.innerHTML =
        '<div class="status-card"><div class="status-title">확인 중</div><div class="status-main">운영 상태를 불러오는 중입니다.</div></div>';
    }
    var checks = [
      checkBackend(),
      checkPageBuild("프론트 테스트 앱", FRONT_TEST_URL),
      checkPageBuild("프론트 운영 앱", FRONT_PROD_URL),
    ].concat(
      REPOS.map(function (repo) {
        return checkRepo(repo);
      })
    );
    var items = await Promise.all(checks);
    render(items);
  }

  window.AdminOps = { load: loadOpsStatus };

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    var btn = $("#ops-refresh");
    if (btn) btn.addEventListener("click", loadOpsStatus);
    loadOpsStatus();
  });
})();
