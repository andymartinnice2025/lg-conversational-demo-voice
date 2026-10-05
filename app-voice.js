const COGNIGY_VOICE_ENDPOINT_URL =
  "https://endpoint-trial.cognigy.ai/5809e50875e7a7b0b348cc32815da1f55af3f3e0cfa283c5fe62a82cc8dad47f";

let activeSession = null;

// Same role as webchat.sendMessage() in the chat version, over the real,
// documented Click to Call Widget API: session.sendInfo(text, data) sends a
// structured info message during an active call. Card/compare/booking-form
// interactions in workspace.js call this instead of webchat.sendMessage().
function sendInfo(text, data) {
  if (!activeSession) {
    console.warn("[voice] No active call — cannot send:", text, data);
    return;
  }
  try {
    activeSession.sendInfo(text || "", data || {});
  } catch (error) {
    console.error("[voice] sendInfo failed", error);
  }
}
window.__lgSendInfo = sendInfo;

function setCallState(state) {
  const stage = document.getElementById("voice-stage");
  if (stage) stage.dataset.callState = state;
}

async function startVoiceWidget() {
  try {
    const widget = await window.initWebRTCWidget(COGNIGY_VOICE_ENDPOINT_URL, {
      webrtcWidgetConfig: {
        label: "Ask L&G",
        tagline: "Speak with Ella, our virtual assistant",
        theme: "CLEAN_WHITE",
        transcription: { enabled: true },
        demoPage: {
          position: "centered",
          background: { mode: "color", color: "#ffffff" }
        }
      }
    });

    window.__lgVoiceWidget = widget;

    widget.on("newRTCSession", (session) => {
      activeSession = session;
      setCallState("connecting");

      session.on("accepted", () => setCallState("active"));
      session.on("answered", () => setCallState("active"));
      session.on("failed", () => {
        setCallState("idle");
        activeSession = null;
      });
      session.on("ended", () => {
        setCallState("idle");
        activeSession = null;
        if (window.__lgWorkspace) window.__lgWorkspace.closeWorkspace();
      });
      session.on("terminated", () => {
        setCallState("idle");
        activeSession = null;
      });

      // The structured `ui` payloads Ella sends (actions.output('', {ui:...}))
      // arrive as info messages from the bot side, not as transcription —
      // per the widget's documented contract, anything carrying a
      // `_transcription` marker is filtered into the `transcription` event
      // instead, so whatever lands here is the data channel we want.
      session.on("newInfo", ({ originator, info }) => {
        if (originator !== "remote") return;
        try {
          const parsed = JSON.parse(info.body);
          const ui = (parsed && parsed.data && parsed.data.ui) || (parsed && parsed.ui);
          if (ui && window.__lgWorkspace) window.__lgWorkspace.handleUiInstruction(ui);
        } catch (error) {
          console.warn("[voice] Could not parse newInfo body:", info && info.body, error);
        }
      });

      // Live transcript of both sides of the call. Also fed to workspace.js
      // so it can light-touch autofill the booking form from what the
      // customer says (see handleTranscript in workspace.js) — purely a
      // convenience layer on top of the widget's own transcript rendering,
      // the customer can always type or correct any field directly.
      session.on("transcription", (transcription) => {
        if (!window.__lgWorkspace || !transcription) return;
        (transcription.messages || []).forEach((message) => {
          window.__lgWorkspace.handleTranscript(transcription.originator, message.text || "");
        });
      });
    });

    const loading = document.getElementById("voice-loading");
    if (loading) loading.style.display = "none";

    // The widget appends its own root straight to document.body (confirmed
    // by inspecting the bundle — there's no container/mount option), so we
    // position it over our dedicated stage the same non-reparenting way the
    // chat version positions Cognigy Webchat's root: find it, size/position
    // it in place, and keep it synced on resize. Poll briefly for the node
    // since it may not exist the instant the init promise resolves.
    const stage = document.getElementById("voice-stage");
    let attempts = 0;
    const findRoot = setInterval(() => {
      attempts += 1;
      const root = document.querySelector(".webrtc_widget_outer_wrapper");
      if (root && stage) {
        clearInterval(findRoot);
        const syncPosition = () => {
          const rect = stage.getBoundingClientRect();
          root.style.top = `${rect.top + window.scrollY}px`;
          root.style.left = `${rect.left + window.scrollX}px`;
          root.style.width = `${rect.width}px`;
          root.style.height = `${rect.height}px`;
        };
        syncPosition();
        window.addEventListener("resize", syncPosition);
        new ResizeObserver(syncPosition).observe(stage);
      } else if (attempts > 50) {
        clearInterval(findRoot);
        console.warn("[voice] Could not find .webrtc_widget_outer_wrapper to position.");
      }
    }, 100);
  } catch (error) {
    console.error("Unable to initialise the voice widget", error);
    const loading = document.getElementById("voice-loading");
    if (loading) {
      loading.innerHTML =
        '<div><strong>We could not connect to the voice assistant.</strong>' +
        '<span>Please refresh the page and try again.</span></div>';
    }
  }
}

window.addEventListener("load", startVoiceWidget);
