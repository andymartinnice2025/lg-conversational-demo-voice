/* ====================================================================
   Contextual Workspace — persistent right-hand panel driven by
   structured `ui` data from the Cognigy voice conversation.
   ====================================================================
   Same panel/rendering logic as the chat version of this demo. The only
   difference is the transport: interactions are sent back via
   window.__lgSendInfo(text, data), which app-voice.js wires to the real
   Click to Call Widget API, session.sendInfo(text, data) — documented at
   https://github.com/Cognigy/click-to-call-widget, not assumed.
   ==================================================================== */

(function () {
  "use strict";

  var els = {};
  var currentProducts = [];
  var voiceFillBuffer = "";

  // ---- Product cards --------------------------------------------------------

  function buttonClass(style) {
    if (style === "primary") return "ws-card__btn ws-card__btn--primary";
    if (style === "secondary") return "ws-card__btn ws-card__btn--secondary";
    return "ws-card__btn ws-card__btn--tertiary";
  }

  function renderProductCard(product) {
    var checkmarksHtml = (product.checkmarks || []).map(function (c) {
      return "<li>" + c + "</li>";
    }).join("");

    var considerationsHtml = (product.considerations || []).map(function (c) {
      return "<li>" + c + "</li>";
    }).join("");

    var buttons = product.buttons || [];
    var primary = buttons.filter(function (b) { return b.style === "primary"; });
    var rest = buttons.filter(function (b) { return b.style !== "primary"; });

    function buttonHtml(b, extraAttrs) {
      return '<button type="button" class="' + buttonClass(b.style) + '" ' +
        'data-action="' + b.action + '" data-product-id="' + product.id + '" ' +
        'data-product-name="' + product.name + '" ' + (extraAttrs || "") + ">" +
        b.label + "</button>";
    }

    return (
      '<div class="ws-card">' +
        '<div class="ws-card__accent"></div>' +
        '<p class="ws-card__name">' + product.name + "</p>" +
        (product.tagline ? '<p class="ws-card__tagline">' + product.tagline + "</p>" : "") +
        (product.whyRelevant ?
          '<div class="ws-card__why"><strong>Why you\'re seeing this: </strong>' + product.whyRelevant + "</div>"
          : "") +
        '<div class="ws-card__detail" style="display:none">' +
          (checkmarksHtml ? '<ul class="ws-card__list ws-card__list--check">' + checkmarksHtml + "</ul>" : "") +
          (considerationsHtml ? '<ul class="ws-card__list ws-card__list--warn">' + considerationsHtml + "</ul>" : "") +
          (product.detail ? '<p class="ws-card__detail-text">' + product.detail + "</p>" : "") +
        "</div>" +
        '<div class="ws-card__buttons">' +
          primary.map(function (b) { return buttonHtml(b, 'data-view-details="1"'); }).join("") +
          (rest.length ? '<div class="ws-card__buttons ws-card__buttons--row">' + rest.map(function (b) { return buttonHtml(b); }).join("") + "</div>" : "") +
        "</div>" +
      "</div>"
    );
  }

  function renderProducts(products) {
    currentProducts = products;

    var compareBtn = products.length > 1
      ? '<div class="ws-footer-actions"><button type="button" class="ws-card__btn ws-card__btn--secondary" id="ws-compare-btn">Compare these options</button></div>'
      : "";

    els.body.innerHTML =
      '<button type="button" class="ws-close" id="ws-close-btn" aria-label="Close workspace">&times;</button>' +
      '<p class="ws-heading">Options that could be worth exploring</p>' +
      '<div class="ws-track">' + products.map(renderProductCard).join("") + "</div>" +
      compareBtn +
      '<p class="ws-footer-note">Illustrative example based on what you\'ve told me — not a personal recommendation. Please check full details before making a decision.</p>';

    document.getElementById("ws-close-btn").addEventListener("click", function () {
      closeWorkspace();
    });

    var compareEl = document.getElementById("ws-compare-btn");
    if (compareEl) {
      compareEl.addEventListener("click", function () {
        sendCompareRequest(currentProducts);
      });
    }

    els.body.querySelectorAll(".ws-card__btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.viewDetails) {
          toggleDetail(btn);
          return;
        }
        sendCardAction(btn.dataset.action, btn.dataset.productId, btn.dataset.productName);
      });
    });
  }

  function toggleDetail(btn) {
    var card = btn.closest(".ws-card");
    var detailEl = card && card.querySelector(".ws-card__detail");
    if (!detailEl) return;
    var isHidden = detailEl.style.display !== "block";
    detailEl.style.display = isHidden ? "block" : "none";
    btn.textContent = isHidden ? "Hide details" : "View details";

    var anyExpanded = !!els.body.querySelector('.ws-card__detail[style*="display: block"]');
    els.layout.classList.toggle("is-expanded", anyExpanded);

    if (isHidden) {
      requestAnimationFrame(function () {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  function sendCardAction(action, productId, productName) {
    console.log("[workspace] Sending card action:", { action: action, productId: productId, productName: productName });
    if (window.__lgSendInfo) {
      window.__lgSendInfo("", { action: action, productId: productId, productName: productName });
    }
  }

  function sendCompareRequest(products) {
    var names = products.map(function (p) { return p.name; });
    var text = "Please compare these options side by side: " + names.join(", ") + ".";
    console.log("[workspace] Sending compare request:", text);
    if (window.__lgSendInfo) {
      window.__lgSendInfo(text, { action: "compare_requested", productIds: products.map(function (p) { return p.id; }) });
    }
  }

  // ---- Comparison view --------------------------------------------------------

  function renderComparisonColumn(product) {
    var checkmarksHtml = (product.checkmarks || []).map(function (c) { return "<li>" + c + "</li>"; }).join("");
    var considerationsHtml = (product.considerations || []).map(function (c) { return "<li>" + c + "</li>"; }).join("");
    return (
      '<div class="ws-compare-col">' +
        '<p class="ws-card__name">' + product.name + "</p>" +
        (product.tagline ? '<p class="ws-card__tagline">' + product.tagline + "</p>" : "") +
        (checkmarksHtml ? '<ul class="ws-card__list ws-card__list--check">' + checkmarksHtml + "</ul>" : "") +
        (considerationsHtml ? '<ul class="ws-card__list ws-card__list--warn">' + considerationsHtml + "</ul>" : "") +
      "</div>"
    );
  }

  function renderComparison(products) {
    if (!Array.isArray(products) || products.length === 0) {
      console.warn("[workspace] showComparison received with no products:", products);
      return;
    }
    els.body.innerHTML =
      '<button type="button" class="ws-close" id="ws-close-btn" aria-label="Close workspace">&times;</button>' +
      '<p class="ws-heading">Comparing your options</p>' +
      '<div class="ws-compare-grid">' + products.map(renderComparisonColumn).join("") + "</div>" +
      '<p class="ws-footer-note">Illustrative example based on what you\'ve told me — not a personal recommendation. Please check full details before making a decision.</p>';

    document.getElementById("ws-close-btn").addEventListener("click", function () {
      closeWorkspace();
    });
    els.layout.classList.remove("is-expanded");
    els.layout.classList.add("is-open");
  }

  // ---- Appointment booking form --------------------------------------------
  // Deliberately NOT full-width here (unlike card "View details"): the
  // customer is mid-call, so the call controls and live transcript stay
  // visible alongside the form rather than being covered by it.

  function renderBookingForm(topic) {
    voiceFillBuffer = "";

    els.body.innerHTML =
      '<button type="button" class="ws-close" id="ws-close-btn" aria-label="Close workspace">&times;</button>' +
      '<p class="ws-heading">Book a call with an adviser</p>' +
      '<p class="ws-form-hint ws-form-hint--voice">You can say these details out loud or type them below — spoken answers fill the matching field automatically.</p>' +
      '<form class="ws-form" id="ws-booking-form">' +
        '<div class="ws-form-group">' +
          '<label for="ws-field-topic">What would you like to discuss?</label>' +
          '<textarea id="ws-field-topic" rows="2">' + (topic || "") + "</textarea>" +
          '<span class="ws-form-hint">We\'ve pre-filled this from your conversation — feel free to edit it.</span>' +
        "</div>" +
        '<div class="ws-form-group">' +
          '<label for="ws-field-name">Full name</label>' +
          '<input type="text" id="ws-field-name" autocomplete="name" />' +
        "</div>" +
        '<div class="ws-form-group">' +
          '<label for="ws-field-email">Email address</label>' +
          '<input type="email" id="ws-field-email" autocomplete="email" />' +
        "</div>" +
        '<div class="ws-form-group">' +
          '<label for="ws-field-phone">Phone number (optional)</label>' +
          '<input type="tel" id="ws-field-phone" autocomplete="tel" />' +
        "</div>" +
        '<div class="ws-form-group">' +
          '<label for="ws-field-time">Preferred time (optional)</label>' +
          '<input type="text" id="ws-field-time" placeholder="e.g. weekday mornings" />' +
        "</div>" +
        '<p class="ws-form-error" id="ws-form-error"></p>' +
        '<div class="ws-form-actions">' +
          '<button type="submit" class="ws-card__btn ws-card__btn--primary" id="ws-form-submit">Submit request</button>' +
          '<button type="button" class="ws-card__btn ws-card__btn--tertiary" id="ws-form-cancel">Cancel</button>' +
        "</div>" +
      "</form>";

    document.getElementById("ws-close-btn").addEventListener("click", function () { closeWorkspace(); });
    document.getElementById("ws-form-cancel").addEventListener("click", function () { closeWorkspace(); });

    var form = document.getElementById("ws-booking-form");
    form.addEventListener("submit", function (evt) {
      evt.preventDefault();
      submitBookingForm();
    });

    // No is-expanded here — stays in the normal split so the call/transcript
    // column remains visible while the form is filled in.
    els.layout.classList.remove("is-expanded");
    els.layout.classList.add("is-open");
  }

  function setFieldFromVoice(input, value) {
    if (!input || input.value) return;
    input.value = value;
    input.classList.add("ws-field--voice-filled");
    setTimeout(function () { input.classList.remove("ws-field--voice-filled"); }, 1600);
  }

  // Light-touch, client-side parsing of the live call transcript so spoken
  // answers land in the form as the customer says them. Deliberately simple
  // pattern matching, not a parsing guarantee — every field stays a normal
  // input the customer can type into or correct at any time.
  function tryAutofillFromSpeech(text) {
    if (!document.getElementById("ws-booking-form")) return;
    voiceFillBuffer += " " + text;

    var emailMatch = voiceFillBuffer.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
    if (emailMatch) {
      setFieldFromVoice(document.getElementById("ws-field-email"), emailMatch[0].replace(/\s+/g, ""));
    }

    var phoneMatch = voiceFillBuffer.match(/\b0\d[\d\s]{8,12}\d\b/);
    if (phoneMatch) {
      setFieldFromVoice(document.getElementById("ws-field-phone"), phoneMatch[0].replace(/\s+/g, ""));
    }

    var nameMatch = voiceFillBuffer.match(/(?:my name is|name's|it's|this is)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+)?)/i);
    if (nameMatch) {
      setFieldFromVoice(document.getElementById("ws-field-name"), nameMatch[1]);
    }

    var timeMatch = voiceFillBuffer.match(/\b(weekday mornings?|weekday afternoons?|weekend mornings?|weekend afternoons?|mornings?|afternoons?|evenings?|monday|tuesday|wednesday|thursday|friday)\b/i);
    if (timeMatch) {
      setFieldFromVoice(document.getElementById("ws-field-time"), timeMatch[0]);
    }
  }

  function handleTranscript(originator, text) {
    if (!text || originator === "remote") return; // only the customer's own speech fills the form
    tryAutofillFromSpeech(text);
  }

  function submitBookingForm() {
    var topic = document.getElementById("ws-field-topic").value.trim();
    var name = document.getElementById("ws-field-name").value.trim();
    var email = document.getElementById("ws-field-email").value.trim();
    var phone = document.getElementById("ws-field-phone").value.trim();
    var preferredTime = document.getElementById("ws-field-time").value.trim();
    var errorEl = document.getElementById("ws-form-error");

    var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!name || !emailOk) {
      errorEl.textContent = !name
        ? "Please enter your name."
        : "Please enter a valid email address.";
      return;
    }
    errorEl.textContent = "";

    var submitBtn = document.getElementById("ws-form-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Sending...";

    var text = "Please book an appointment with an adviser. Name: " + name +
      ". Email: " + email +
      ". Phone: " + (phone || "not provided") +
      ". Preferred time: " + (preferredTime || "no preference") +
      ". What I'd like to discuss: " + topic + ".";

    console.log("[workspace] Sending appointment request:", text);
    if (window.__lgSendInfo) {
      window.__lgSendInfo(text, {
        action: "appointment_submitted",
        name: name, email: email, phone: phone, preferredTime: preferredTime, topic: topic
      });
    }
  }

  // ---- Handoff summary + confirmation email ---------------------------

  function renderHandoffSummary(ui) {
    var reference = ui.reference || "N/A";
    els.body.innerHTML =
      '<button type="button" class="ws-close" id="ws-close-btn" aria-label="Close workspace">&times;</button>' +
      '<span class="ws-summary-badge">Call scheduled</span>' +
      '<p class="ws-summary-ref">Reference <strong>' + reference + "</strong>" + (ui.scheduledFor ? " &middot; " + ui.scheduledFor : "") + "</p>" +
      '<ul class="ws-summary-list">' +
        '<li><strong>Name:</strong> ' + (ui.name || "") + "</li>" +
        '<li><strong>Email:</strong> ' + (ui.email || "") + "</li>" +
        (ui.phone ? '<li><strong>Phone:</strong> ' + ui.phone + "</li>" : "") +
        '<li><strong>Topic:</strong> ' + (ui.topic || "") + "</li>" +
        (ui.zoomLink ? '<li><strong>Zoom link:</strong> <a href="' + ui.zoomLink + '" target="_blank" rel="noopener">' + ui.zoomLink + "</a></li>" : "") +
        (ui.zoomId ? '<li><strong>Meeting ID:</strong> ' + ui.zoomId + "</li>" : "") +
        (ui.zoomPasscode ? '<li><strong>Passcode:</strong> ' + ui.zoomPasscode + "</li>" : "") +
      "</ul>" +
      '<div class="ws-email-mock">' +
        '<p class="ws-email-mock__label">Confirmation email sent</p>' +
        '<p class="ws-email-mock__row"><strong>To:</strong> ' + (ui.email || "") + "</p>" +
        '<p class="ws-email-mock__row"><strong>From:</strong> noreply@legalandgeneral.com</p>' +
        '<p class="ws-email-mock__row"><strong>Subject:</strong> Your L&amp;G appointment request — Ref ' + reference + "</p>" +
        '<p class="ws-email-mock__body">Hi ' + (ui.name || "") + ',\n\nYour call with one of our advisers is confirmed for ' + (ui.scheduledFor || "shortly") + '. Here\'s what we\'ll cover:\n"' + (ui.topic || "") + '"\n\n' + (ui.zoomLink ? "Join via Zoom: " + ui.zoomLink + "\nMeeting ID: " + ui.zoomId + "\nPasscode: " + ui.zoomPasscode + "\n\n" : "") + "Reference: " + reference + "\n\nLegal & General" + "</p>" +
      "</div>" +
      '<p class="ws-footer-note">This is a demonstration prototype — the appointment and adviser follow-up are not real, but the confirmation email shown above has genuinely been sent.</p>';

    document.getElementById("ws-close-btn").addEventListener("click", function () { closeWorkspace(); });
    els.layout.classList.remove("is-expanded");
  }

  // ---- Open / close ---------------------------------------------------------

  function openWorkspace(products) {
    if (!Array.isArray(products) || products.length === 0) {
      console.warn("[workspace] showProducts received with no products:", products);
      return;
    }
    renderProducts(products);
    els.layout.classList.remove("is-expanded");
    els.layout.classList.add("is-open");
  }

  function closeWorkspace() {
    els.layout.classList.remove("is-open");
    els.layout.classList.remove("is-expanded");
  }

  // ---- The ui-instruction contract ------------------------------------------
  // Identical contract to the chat version — the Cognigy flow is a direct
  // clone, so it emits the same actions.output('', {ui:{...}}) payloads.
  function handleUiInstruction(ui) {
    if (!ui || !ui.action) return;
    console.log("[workspace] Received ui instruction:", ui);

    if (ui.action === "showProducts") {
      openWorkspace(ui.products);
    } else if (ui.action === "showComparison") {
      renderComparison(ui.products);
    } else if (ui.action === "showBookingForm") {
      renderBookingForm(ui.topic);
    } else if (ui.action === "showHandoffSummary") {
      renderHandoffSummary(ui);
    } else if (ui.action === "closeWorkspace") {
      closeWorkspace();
    } else {
      console.warn("[workspace] Unknown ui.action:", ui.action);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    els.layout = document.getElementById("workspace-layout");
    els.workspace = document.getElementById("context-workspace");
    els.body = document.getElementById("workspace-body");
  });

  window.__lgWorkspace = {
    handleUiInstruction: handleUiInstruction,
    handleTranscript: handleTranscript,
    closeWorkspace: closeWorkspace
  };
})();
