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
  const dock = document.getElementById("voice-call-dock");
  if (dock) dock.dataset.callState = state;
}

async function startVoiceWidget() {
  try {
    const widget = await window.initWebRTCWidget(COGNIGY_VOICE_ENDPOINT_URL, {
      webrtcWidgetConfig: {
        label: "Ask L&G",
        tagline: "Speak with Ella, our virtual assistant",
        theme: "CLEAN_WHITE",
        // Left enabled so session.on('transcription') keeps firing — the
        // widget's OWN transcript UI is hidden via CSS instead (styles.css),
        // since disabling this setting might silence the underlying events
        // too, not just its display, and that event is what workspace.js's
        // transcript bubbles and voice-autofill both run on.
        transcription: { enabled: true }
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
        // Logged deliberately: the README doesn't enumerate the exact
        // originator values, and the first real call showed every bubble
        // rendering as the same side, so this needs to be confirmed against
        // a real payload rather than guessed again. Check this in DevTools
        // during the next test call.
        console.log("[voice] transcription event:", transcription);
        (transcription.messages || []).forEach((message) => {
          console.log("[voice] transcription message:", message);
          window.__lgWorkspace.handleTranscript(
            (message.originator || transcription.originator),
            message.text || ""
          );
        });
      });
    });

    // The widget appends its own root straight to document.body (confirmed
    // by inspecting the bundle — there's no container/mount option). Rather
    // than giving it the whole panel like the chat version does with
    // Cognigy Webchat, we shrink it down via CSS (styles.css) to just the
    // call button / mute / end-call controls and position that small
    // cluster over a dedicated dock in the header. Poll briefly for the
    // node since it may not exist the instant the init promise resolves.
    const dock = document.getElementById("voice-call-dock");
    let attempts = 0;
    const findRoot = setInterval(() => {
      attempts += 1;
      const root = document.querySelector(".webrtc_widget_outer_wrapper");
      if (root && dock) {
        clearInterval(findRoot);
        const syncPosition = () => {
          const rect = dock.getBoundingClientRect();
          root.style.top = `${rect.top + window.scrollY}px`;
          root.style.left = `${rect.left + window.scrollX}px`;
          root.style.width = `${rect.width}px`;
          root.style.height = `${rect.height}px`;
        };
        syncPosition();
        window.addEventListener("resize", syncPosition);
        new ResizeObserver(syncPosition).observe(dock);
      } else if (attempts > 50) {
        clearInterval(findRoot);
        console.warn("[voice] Could not find .webrtc_widget_outer_wrapper to position.");
      }
    }, 100);
  } catch (error) {
    console.error("Unable to initialise the voice widget", error);
    const empty = document.getElementById("voice-transcript-empty");
    if (empty) {
      empty.textContent = "We could not connect to the voice assistant. Please refresh the page and try again.";
    }
  }
}

window.addEventListener("load", startVoiceWidget);
