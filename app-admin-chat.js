/* 잇데이 admin — 채팅방 (카카오톡 스타일) */
(function () {
  "use strict";
  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var state = {
    rooms: [],
    activeUserId: null,
    pollTimer: null,
    listTimer: null,
  };

  function avatarLabel(name, email) {
    var s = (name || email || "?").trim();
    return s.charAt(0).toUpperCase();
  }

  function renderList(rooms) {
    var box = $("#chat-list-body");
    if (!rooms || !rooms.length) {
      box.innerHTML = '<div class="empty">채팅방 없음</div>';
      return;
    }
    var html = rooms
      .map(function (r) {
        var nm = r.user_name || r.user_email || "user#" + r.user_id;
        var unread = r.unread > 0 ? '<span class="badge">' + r.unread + "</span>" : "";
        return (
          '<div class="chat-room' +
          (state.activeUserId === r.user_id ? " active" : "") +
          '" data-uid="' +
          r.user_id +
          '">' +
          '<div class="avatar">' +
          AdminCore.escapeHtml(avatarLabel(r.user_name, r.user_email)) +
          "</div>" +
          '<div class="meta">' +
          '<div class="name"><span>' +
          AdminCore.escapeHtml(nm) +
          unread +
          "</span><time>" +
          AdminCore.fmtDate(r.last_at) +
          "</time></div>" +
          '<div class="preview">' +
          AdminCore.escapeHtml(r.last_message || "") +
          "</div>" +
          "</div>" +
          "</div>"
        );
      })
      .join("");
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll(".chat-room"), function (el) {
      el.addEventListener("click", function () {
        var uid = parseInt(el.getAttribute("data-uid"), 10);
        openRoom(uid);
      });
    });
  }

  function renderMessages(msgs, roomInfo) {
    var head = $("#chat-head");
    if (roomInfo) {
      head.textContent =
        (roomInfo.user_name || "이름없음") +
        " · " +
        (roomInfo.user_email || "user#" + roomInfo.user_id);
    }
    var body = $("#chat-body");
    if (!msgs || !msgs.length) {
      body.innerHTML = '<div class="empty">메시지 없음</div>';
      return;
    }
    var html = msgs
      .map(function (m) {
        var cls = m.from_admin ? "bubble admin" : "bubble user";
        return (
          '<div class="' +
          cls +
          '">' +
          AdminCore.escapeHtml(m.content) +
          "<time>" +
          AdminCore.fmtDate(m.created_at) +
          "</time>" +
          "</div>"
        );
      })
      .join("");
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;
  }

  async function loadList() {
    try {
      var rooms = await AdminCore.api("/admin/chats");
      state.rooms = rooms || [];
      renderList(state.rooms);
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    }
  }

  async function loadMessages() {
    if (!state.activeUserId) return;
    try {
      var msgs = await AdminCore.api(
        "/admin/chats/" + state.activeUserId + "/messages?limit=100"
      );
      var info = state.rooms.find(function (r) {
        return r.user_id === state.activeUserId;
      });
      renderMessages(msgs, info);
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    }
  }

  function openRoom(uid) {
    state.activeUserId = uid;
    Array.prototype.forEach.call(document.querySelectorAll(".chat-room"), function (el) {
      el.classList.toggle("active", parseInt(el.getAttribute("data-uid"), 10) === uid);
    });
    $("#reply-input").disabled = false;
    $("#reply-btn").disabled = false;
    loadMessages();
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(loadMessages, 8000);
  }

  async function sendReply() {
    var inp = $("#reply-input");
    var btn = $("#reply-btn");
    var text = (inp.value || "").trim();
    if (!text || !state.activeUserId) return;
    btn.disabled = true;
    try {
      await AdminCore.api("/admin/chats/" + state.activeUserId + "/reply", {
        method: "POST",
        body: { content: text },
      });
      inp.value = "";
      await loadMessages();
      await loadList();
      AdminCore.toast("답장 전송 완료");
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    } finally {
      btn.disabled = false;
      inp.focus();
    }
  }

  function bind() {
    $("#reply-btn").addEventListener("click", sendReply);
    $("#reply-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        sendReply();
      }
    });
    $("#filter-unread").addEventListener("change", function (e) {
      var val = e.target.checked ? "true" : "all";
      AdminCore.api("/admin/chats?has_unread=" + val).then(function (rooms) {
        state.rooms = rooms || [];
        renderList(state.rooms);
      });
    });
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    bind();
    loadList();
    state.listTimer = setInterval(loadList, 15000);
  });
})();
