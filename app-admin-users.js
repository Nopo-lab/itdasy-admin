/* 잇데이 admin — 사용자 관리 */
(function () {
  "use strict";

  var state = {
    rows: [],
    showEmail: false,
    timer: null,
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function esc(s) {
    return AdminCore.escapeHtml(s == null ? "" : String(s));
  }

  function maskEmail(email) {
    email = String(email || "");
    var parts = email.split("@");
    if (parts.length !== 2) return "****";
    var name = parts[0];
    var domain = parts[1];
    var head = name.slice(0, 2);
    return head + "***@" + domain;
  }

  function planBadge(plan) {
    var p = (plan || "free").toLowerCase();
    var cls = p === "pro" || p === "premium" ? "pill brand" : "pill";
    return '<span class="' + cls + '">' + esc(p) + "</span>";
  }

  function statusBadge(user) {
    if (user.is_admin) return '<span class="pill warn">admin</span>';
    if (user.is_active) return '<span class="pill ok">active</span>';
    return '<span class="pill bad">inactive</span>';
  }

  function render() {
    var tbody = $("#users-table tbody");
    if (!tbody) return;
    if (!state.rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="muted-cell">검색 결과가 없습니다.</td></tr>';
      return;
    }
    tbody.innerHTML = state.rows
      .map(function (u) {
        var email = state.showEmail ? u.email : maskEmail(u.email);
        var chatHref = "chat.html?user_id=" + encodeURIComponent(u.id);
        return (
          "<tr>" +
          "<td>" +
          esc(u.id) +
          "</td><td>" +
          esc(u.name || "이름없음") +
          "</td><td>" +
          esc(email) +
          "</td><td>" +
          planBadge(u.plan) +
          "</td><td>" +
          statusBadge(u) +
          "</td><td>" +
          esc(AdminCore.fmtDate(u.created_at)) +
          '</td><td><a class="table-action" href="' +
          chatHref +
          '">채팅 열기</a></td></tr>'
        );
      })
      .join("");
  }

  async function loadUsers() {
    var q = ($("#user-search").value || "").trim();
    var limit = $("#user-limit").value || "50";
    var tbody = $("#users-table tbody");
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="muted-cell">불러오는 중입니다.</td></tr>';
    try {
      state.rows = await AdminCore.api(
        "/admin/users?q=" + encodeURIComponent(q) + "&limit=" + encodeURIComponent(limit)
      );
      render();
    } catch (e) {
      if (tbody) {
        tbody.innerHTML =
          '<tr><td colspan="7" class="muted-cell error-cell">' + esc(e.message) + "</td></tr>";
      }
      AdminCore.toast(e.message, { error: true });
    }
  }

  function scheduleLoad() {
    clearTimeout(state.timer);
    state.timer = setTimeout(loadUsers, 300);
  }

  function bind() {
    $("#user-refresh").addEventListener("click", loadUsers);
    $("#user-search").addEventListener("input", scheduleLoad);
    $("#user-limit").addEventListener("change", loadUsers);
    $("#toggle-email").addEventListener("click", function () {
      state.showEmail = !state.showEmail;
      $("#toggle-email").textContent = state.showEmail ? "이메일 가리기" : "이메일 보기";
      render();
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    bind();
    loadUsers();
  });
})();
