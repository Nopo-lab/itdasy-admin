/* 잇데이 admin — 공지 발송 */
(function () {
  "use strict";
  var $ = function (s) {
    return document.querySelector(s);
  };

  async function send() {
    var title = ($("#a-title").value || "").trim();
    var body = ($("#a-body").value || "").trim();
    var target = $("#a-target").value;
    if (!title || !body) {
      AdminCore.toast("제목·본문 모두 입력해주세요.", { error: true });
      return;
    }
    if (!confirm("정말 발송하시겠어요? 모든 대상자에게 푸시 + in-app 알림이 갑니다.")) {
      return;
    }
    var btn = $("#a-send");
    btn.disabled = true;
    btn.textContent = "요청 중…";
    try {
      var r = await AdminCore.api("/admin/announcements", {
        method: "POST",
        body: { title: title, body: body, target: target },
      });
      if (r.queued_push) {
        AdminCore.toast("공지 등록 완료 — in-app " + r.inserted + "건 / 푸시는 백그라운드 발송 중");
      } else {
        AdminCore.toast(
          "발송 완료 — in-app " + r.inserted + "건 / 푸시 " + r.pushed + "건"
        );
      }
      $("#a-title").value = "";
      $("#a-body").value = "";
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    } finally {
      btn.disabled = false;
      btn.textContent = "발송";
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    $("#a-send").addEventListener("click", send);
  });
})();
