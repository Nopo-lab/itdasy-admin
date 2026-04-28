/* 잇데이 운영자 admin — 인증·라우팅·API 공용 코어 */
(function () {
  "use strict";

  // 백엔드 — 스테이징 기본. 운영자 본인이 본 화면 쓰면 production 으로 바꿔도 됨.
  var DEFAULT_API = "https://itdasy260417-staging-production.up.railway.app";
  var API_BASE = (function () {
    try {
      var stored = localStorage.getItem("itdasy_admin_api_base");
      if (stored && /^https?:\/\//.test(stored)) return stored;
    } catch (e) {}
    return DEFAULT_API;
  })();

  var TOKEN_KEY = "itdasy_admin_token";
  var ADMIN_KEY = "itdasy_admin_user";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (e) {
      return "";
    }
  }

  function setToken(t) {
    try {
      localStorage.setItem(TOKEN_KEY, t || "");
    } catch (e) {}
  }

  function getAdminUser() {
    try {
      var raw = localStorage.getItem(ADMIN_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setAdminUser(u) {
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(u));
    } catch (e) {}
  }

  function clearAuth() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(ADMIN_KEY);
    } catch (e) {}
  }

  function redirectToLogin() {
    var here = location.pathname.split("/").pop() || "index.html";
    if (here !== "login.html") {
      location.href = "login.html";
    }
  }

  function requireAuth() {
    var here = location.pathname.split("/").pop() || "";
    if (here === "login.html") return; // 로그인 페이지는 통과
    if (!getToken()) {
      redirectToLogin();
    }
  }

  async function api(path, opts) {
    opts = opts || {};
    var headers = Object.assign(
      {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      opts.headers || {}
    );
    var token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;
    var res = await fetch(API_BASE + path, {
      method: opts.method || "GET",
      headers: headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
    if (res.status === 401 || res.status === 403) {
      clearAuth();
      redirectToLogin();
      throw new Error("인증 만료");
    }
    var ct = res.headers.get("content-type") || "";
    var payload = ct.indexOf("application/json") >= 0 ? await res.json() : await res.text();
    if (!res.ok) {
      var msg =
        (payload && (payload.detail || payload.message)) ||
        (typeof payload === "string" ? payload : "요청 실패");
      throw new Error(msg);
    }
    return payload;
  }

  function toast(msg, opts) {
    opts = opts || {};
    var el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.toggle("error", !!opts.error);
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(function () {
      el.classList.remove("show");
    }, opts.error ? 4500 : 2400);
  }

  function fmtKRW(n) {
    var v = Number(n || 0);
    return "₩" + v.toLocaleString("ko-KR");
  }

  function fmtNum(n) {
    return Number(n || 0).toLocaleString("ko-KR");
  }

  function fmtUSD(n) {
    return "$" + Number(n || 0).toFixed(2);
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var now = new Date();
    var sameDay =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    if (sameDay) return hh + ":" + mm;
    var mo = String(d.getMonth() + 1).padStart(2, "0");
    var dd = String(d.getDate()).padStart(2, "0");
    return mo + "/" + dd + " " + hh + ":" + mm;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSidebar(activeId) {
    var html =
      '<div class="sidebar-logo"><span>잇데이 운영자</span></div>' +
      '<a class="nav-link' +
      (activeId === "dashboard" ? " active" : "") +
      '" href="index.html"><span>대시보드</span></a>' +
      '<a class="nav-link' +
      (activeId === "chat" ? " active" : "") +
      '" href="chat.html"><span>채팅방</span></a>' +
      '<a class="nav-link' +
      (activeId === "users" ? " active" : "") +
      '" href="users.html"><span>사용자</span></a>' +
      '<a class="nav-link' +
      (activeId === "announce" ? " active" : "") +
      '" href="announcements.html"><span>공지 발송</span></a>' +
      '<a class="nav-link' +
      (activeId === "metrics" ? " active" : "") +
      '" href="metrics.html"><span>운영 메트릭</span></a>' +
      '<div class="sidebar-foot">' +
      '<div id="admin-who"></div>' +
      '<button id="logout-btn">로그아웃</button>' +
      "</div>";
    var sb = document.querySelector(".sidebar");
    if (sb) {
      sb.innerHTML = html;
      var who = document.getElementById("admin-who");
      var u = getAdminUser();
      if (who && u) {
        who.textContent = u.name + " (" + u.email + ")";
      }
      var btn = document.getElementById("logout-btn");
      if (btn) {
        btn.onclick = function () {
          clearAuth();
          redirectToLogin();
        };
      }
    }
  }

  window.AdminCore = {
    API_BASE: API_BASE,
    getToken: getToken,
    setToken: setToken,
    getAdminUser: getAdminUser,
    setAdminUser: setAdminUser,
    clearAuth: clearAuth,
    requireAuth: requireAuth,
    api: api,
    toast: toast,
    fmtKRW: fmtKRW,
    fmtNum: fmtNum,
    fmtUSD: fmtUSD,
    fmtDate: fmtDate,
    escapeHtml: escapeHtml,
    renderSidebar: renderSidebar,
  };

  // 페이지 로딩 시 자동 인증 확인
  document.addEventListener("DOMContentLoaded", function () {
    requireAuth();
  });
})();
