# L&G "Ask L&G" Voice Demo — Run Script

Live URL: (added after first deploy — see README)
Agent: Ella (Cognigy.AI project "LegalandGeneral", flow "Ella - L&G Contact Us Assistant Flow Voice")
Endpoint: voiceGateway2, token `5809e50875e7a7b0b348cc32815da1f55af3f3e0cfa283c5fe62a82cc8dad47f`

This is the voice counterpart to the chat demo (`lg-conversational-demo`). Same Contextual Workspace panel, same underlying Cognigy flow (a direct clone), same product/comparison/booking/handoff journey — driven by a live call instead of typed chat.

## Before recording

1. Allow microphone access when the browser prompts (the widget shows its own privacy consent dialog first — accept it).
2. Click the green call button in the centre of the card to start the call.
3. Speak naturally — Ella responds by voice, and the workspace panel reacts the same way it does in the chat version.

## The flow

1. **Opening** — say *"I'm thinking about retirement"*. Ella asks a clarifying question rather than giving a generic answer.
2. **Context → cards** — say *"I'd like a regular guaranteed income when I retire, I'm not too worried about flexibility"*. The panel opens with relevant product cards.
3. **Explore** — click **View details** on a card (takes over the full panel width, same as the chat version). Ask a knowledge question by voice, e.g. *"What happens to my annuity income if I die early?"*
4. **Compare** — click **Compare these options** in the panel, or just ask by voice. The panel switches to a side-by-side comparison.
5. **Book** — say *"I'd like to book a call with an adviser"*. The booking form opens **alongside** the call (not covering it, unlike the card-detail view) — you can keep talking while it's open.
6. **Fill the form by voice or by typing** — say your name, email and (optionally) a preferred time; matching fields fill in automatically and briefly highlight. You can also just type, or correct anything that was misheard, at any point before submitting.
7. **Submit** — click **Submit request**. Ella books the (mock) appointment, schedules a (mock) Zoom call, and sends a **real confirmation email** to the address in the form.
8. **Topic change closes the panel** — say *"Actually, different question — do you offer life insurance for my family?"*. The panel closes and the call continues.

## What's genuinely new here vs. the chat version

- **Transport**: `session.sendInfo(text, data)` / `session.on('newInfo', ...)` / `session.on('transcription', ...)` — the Click to Call Widget's own documented API (github.com/Cognigy/click-to-call-widget), not webchat's `sendMessage`/`onMessage`. Verified live before building on it, the same discipline as the chat version's webchat integration.
- **Centred call window**: `webrtcWidgetConfig.demoPage.position: "centered"`, plus centring the widget's own flex wrapper over our dedicated stage — the widget owns its DOM (appends to `document.body`, no container option), so it's positioned over the page the same non-reparenting way the chat version positions Cognigy Webchat.
- **Booking form stays alongside the call**, not full-width — the one deliberate UX difference from the chat version, per the explicit ask: the call/transcript stays visible and audible while the form is open.
- **Voice autofill**: light-touch, client-side regex matching against the live transcript (email, UK-style phone number, "my name is...", day/time-of-day words). It's a convenience layer, not a guarantee — every field stays a normal input the customer can type into or correct.

## Known limitations

- The idle call button currently renders as the widget's default dark compact pill rather than matching the L&G light theme exactly — a cosmetic follow-up, not a functional issue.
- **This was not verified end-to-end with a real phone call** — browser automation can't supply microphone audio or speak into a live call, so the actual voice conversation, live transcription, and voice-autofill behaviour need a real run-through by a person before recording.
