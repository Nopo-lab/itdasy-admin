/* 잇데이 admin — 공지 발송 */
(function () {
  "use strict";
  var $ = function (s) {
    return document.querySelector(s);
  };
  var TARGET_LABELS = {
    all: "전체 활성 사용자",
    paid: "유료 사용자",
    free: "Free 사용자",
  };

  function updatePreview() {
    var target = $("#a-target").value;
    var title = ($("#a-title").value || "").trim();
    var body = ($("#a-body").value || "").trim();
    $("#a-preview-target").textContent = TARGET_LABELS[target] || target;
    $("#a-preview-title").textContent = title || "제목이 여기에 표시됩니다.";
    $("#a-preview-body").textContent = body || "본문이 여기에 표시됩니다.";
  }

  async function send() {
    var title = ($("#a-title").value || "").trim();
    var body = ($("#a-body").value || "").trim();
    var target = $("#a-target").value;
    if (!title || !body) {
      AdminCore.toast("제목·본문 모두 입력해주세요.", { error: true });
      return;
    }
    if (!$("#a-confirm").checked) {
      AdminCore.toast("발송 확인 체크가 필요합니다.", { error: true });
      return;
    }
    var label = TARGET_LABELS[target] || target;
    if (!confirm(label + "에게 공지를 발송합니다. 계속할까요?")) {
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
      $("#a-confirm").checked = false;
      updatePreview();
    } catch (e) {
      AdminCore.toast(e.message, { error: true });
    } finally {
      btn.disabled = false;
      btn.textContent = "발송";
    }
  }

  window.addEventListener("DOMContentLoaded", function () {
    if (!AdminCore.getToken()) return;
    ["#a-target", "#a-title", "#a-body"].forEach(function (sel) {
      $(sel).addEventListener("input", updatePreview);
      $(sel).addEventListener("change", updatePreview);
    });
    updatePreview();
    $("#a-send").addEventListener("click", send);
  });
})();
