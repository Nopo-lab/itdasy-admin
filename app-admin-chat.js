/* 잇데이 admin — 채팅방 (카카오톡 스타일) */
(function () {
  "use strict";
  var $ = function (sel) {
    return document.querySelector(sel);
  };
  var state = {
    rooms: [],
    messages: [],
    pendingByUser: {},
    activeUserId: null,
    pollTimer: null,
    listTimer: null,
    sending: false,
  };

  function avatarLabel(name, email) {
    var s = (name || email || "?").trim();
    return s.charAt(0).toUpperCase();
  }

  function latestPending(uid) {
    var pending = state.pendingByUser[uid] || [];
    return pending.length ? pending[pending.length - 1] : null;
  }

  function mergePendingRooms(rooms) {
    return (rooms || [])
      .map(function (room) {
        var pending = latestPending(room.user_id);
        if (!pending) return room;
        return Object.assign({}, room, {
          last_message: pending.content,
          last_at: pending.created_at,
        });
      })
      .sort(function (a, b) {
        return new Date(b.last_at || 0) - new Date(a.last_at || 0);
      });
  }

  function updateRoomPreview(uid, text, at) {
    var found = false;
    state.rooms = state.rooms.map(function (room) {
      if (room.user_id !== uid) return room;
      found = true;
      return Object.assign({}, room, {
        last_message: text,
        last_at: at,
        unread: 0,
      });
    });
    if (!found) {
      state.rooms.unshift({
        user_id: uid,
        user_name: null,
        user_email: "user#" + uid,
        last_message: text,
        last_at: at,
        unread: 0,
      });
    }
    state.rooms.sort(function (a, b) {
      return new Date(b.last_at || 0) - new Date(a.last_at || 0);
    });
    renderList(state.rooms);
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
    var pending = state.pendingByUser[state.activeUserId] || [];
    var merged = (msgs || []).concat(pending);
    if (!merged.length) {
      body.innerHTML = '<div class="empty">메시지 없음</div>';
      return;
    }
    var html = merged
      .map(function (m) {
        var cls = m.from_admin ? "bubble admin" : "bubble user";
        if (m.pending) cls += " pending";
        if (m.failed) cls += " failed";
        var status = m.failed ? " · 실패" : m.pending ? " · 전송 중" : "";
        return (
          '<div class="' +
          cls +
          '">' +
          AdminCore.escapeHtml(m.content) +
          "<time>" +
          AdminCore.fmtDate(m.created_at) +
          status +
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
      state.rooms = mergePendingRooms(rooms || []);
      renderList(state.rooms);
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    }
  }

  async function loadMessages() {
    if (!state.activeUserId) return;
    var uid = state.activeUserId;
    try {
      var msgs = await AdminCore.api(
        "/admin/chats/" + uid + "/messages?limit=100"
      );
      if (uid !== state.activeUserId) return;
      state.messages = msgs || [];
      var info = state.rooms.find(function (r) {
        return r.user_id === state.activeUserId;
      });
      renderMessages(state.messages, info);
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    }
  }

  function openRoom(uid) {
    state.activeUserId = uid;
    Array.prototype.forEach.call(document.querySelectorAll(".chat-room"), function (el) {
      el.classList.toggle("active", parseInt(el.getAttribute("data-uid"), 10) === uid);
    });
    var info = state.rooms.find(function (r) {
      return r.user_id === uid;
    });
    if (!info) {
      $("#chat-head").textContent = "user#" + uid;
    }
    $("#reply-input").disabled = false;
    $("#reply-btn").disabled = false;
    state.messages = [];
    loadMessages();
    if (state.pollTimer) clearInterval(state.pollTimer);
    // [2026-04-29] 활성 채팅방 폴링 8초→3초 — 새 메시지 빨리 표시
    state.pollTimer = setInterval(loadMessages, 3000);
  }

  async function sendReply() {
    var inp = $("#reply-input");
    var btn = $("#reply-btn");
    var text = (inp.value || "").trim();
    if (!text || !state.activeUserId || state.sending) return;
    var uid = state.activeUserId;
    var tempId = "tmp-" + Date.now();
    var nowIso = new Date().toISOString();
    var temp = {
      id: tempId,
      from_admin: true,
      content: text,
      created_at: nowIso,
      read: false,
      pending: true,
    };
    state.sending = true;
    btn.disabled = true;
    inp.value = "";
    state.pendingByUser[uid] = (state.pendingByUser[uid] || []).concat([temp]);
    updateRoomPreview(uid, text, nowIso);
    renderMessages(state.messages, state.rooms.find(function (r) { return r.user_id === uid; }));
    try {
      var saved = await AdminCore.api("/admin/chats/" + uid + "/reply", {
        method: "POST",
        body: { content: text },
      });
      state.pendingByUser[uid] = (state.pendingByUser[uid] || []).filter(function (m) {
        return m.id !== tempId;
      });
      if (state.activeUserId === uid) {
        state.messages = state.messages
          .filter(function (m) {
            return m.id !== saved.id;
          })
          .concat([saved]);
        renderMessages(state.messages, state.rooms.find(function (r) { return r.user_id === uid; }));
      }
      updateRoomPreview(uid, saved.content, saved.created_at);
      loadList();
      setTimeout(function () {
        if (state.activeUserId === uid) loadMessages();
      }, 350);
      AdminCore.toast("답장 전송 완료");
    } catch (e) {
      state.pendingByUser[uid] = (state.pendingByUser[uid] || []).map(function (m) {
        if (m.id !== tempId) return m;
        return Object.assign({}, m, { pending: false, failed: true });
      });
      if (!inp.value.trim()) inp.value = text;
      if (state.activeUserId === uid) {
        renderMessages(state.messages, state.rooms.find(function (r) { return r.user_id === uid; }));
      }
      AdminCore.toast(e.message, { error: true });
    } finally {
      state.sending = false;
      btn.disabled = !state.activeUserId;
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
        state.rooms = mergePendingRooms(rooms || []);
        renderList(state.rooms);
      });
    });
  }

  // [2026-04-29 W7] WebSocket 실시간 — 폴링 fallback 유지
  function _connectWs() {
    if (!AdminCore.getToken()) return null;
    var wsUrl = AdminCore.API_BASE.replace(/^https?:/, AdminCore.API_BASE.indexOf('https') === 0 ? 'wss:' : 'ws:')
      + '/admin/ws?token=' + encodeURIComponent(AdminCore.getToken());
    var ws;
    try { ws = new WebSocket(wsUrl); } catch (e) { console.warn('[admin-ws] 연결 실패', e); return null; }
    ws.onopen = function () { console.log('[admin-ws] connected'); };
    ws.onmessage = function (e) {
      try {
        var data = JSON.parse(e.data);
        if (data.kind === 'user_msg') {
          loadList();
          if (state.activeUserId === data.user_id) {
            state.messages.push({
              id: data.message_id, from_admin: false, content: data.content,
              created_at: data.created_at, read: false,
            });
            renderMessages(state.messages, state.rooms.find(function (r) { return r.user_id === data.user_id; }));
          }
          if (window.navigator.vibrate) window.navigator.vibrate(50);
        } else if (data.kind === 'admin_reply') {
          if (state.activeUserId === data.user_id) {
            state.messages.push({
              id: data.message_id, from_admin: true, content: data.content,
              created_at: data.created_at, read: true,
            });
            renderMessages(state.messages, state.rooms.find(function (r) { return r.user_id === data.user_id; }));
          }
          loadList();
        }
      } catch (_) { /* ignore */ }
    };
    ws.onclose = function () { setTimeout(_connectWs, 5000); };
    ws.onerror = function (e) { console.warn('[admin-ws] error', e); };
    setInterval(function () {
      try { if (ws.readyState === 1) ws.send(JSON.stringify({ kind: 'ping' })); } catch (_) { /* ignore */ }
    }, 30000);
    return ws;
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    bind();
    loadList().then(function () {
      var params = new URLSearchParams(location.search);
      var uid = parseInt(params.get("user_id") || "", 10);
      if (uid) openRoom(uid);
    });
    // [2026-04-29] 채팅방 목록 폴링 — WebSocket 실시간 + fallback (15초→8초)
    state.listTimer = setInterval(loadList, 8000);
    // [2026-04-29 W7] WebSocket 실시간 연결
    _connectWs();
  });
})();
