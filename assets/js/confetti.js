/* Easter egg: type "pils" anywhere on the page → confetti rain.
   No deps. Mounts on window with a small input buffer so the trigger
   survives partial typing. Respects prefers-reduced-motion. */
(function () {
  const TRIGGER = "pils";
  let buf = "";

  function fireConfetti() {
    if (document.querySelector(".pils-confetti")) return; // already going

    const layer = document.createElement("div");
    layer.className = "pils-confetti";
    Object.assign(layer.style, {
      position: "fixed", inset: "0",
      pointerEvents: "none", zIndex: "9999",
      overflow: "hidden",
    });

    const palette = [
      "oklch(0.86 0.155 88)",   // foam gold
      "oklch(0.78 0.155 72)",   // beer amber
      "oklch(0.55 0.140 55)",   // dark amber
      "oklch(0.72 0.18 28)",    // ember
      "oklch(0.74 0.15 155)",   // emerald
      "oklch(0.74 0.14 250)",   // blue
      "oklch(0.85 0.012 250)",  // silver
    ];
    const glyphs = ["🍺","🍻","🍺","🍻","🥨","✨"];

    const N = 140;
    const W = window.innerWidth;
    const H = window.innerHeight;

    for (let i = 0; i < N; i++) {
      const isGlyph = Math.random() < 0.18;
      const piece = document.createElement("span");
      const size = isGlyph ? 18 + Math.random() * 14 : 6 + Math.random() * 8;
      const left = Math.random() * 100;
      const delay = Math.random() * 0.6;
      const dur = 2.4 + Math.random() * 2.2;
      const sway = (Math.random() * 80 - 40).toFixed(0);
      const rot = (Math.random() * 720 - 360).toFixed(0);
      const color = palette[i % palette.length];

      Object.assign(piece.style, {
        position: "absolute",
        top: "-30px",
        left: left + "%",
        width: isGlyph ? "auto" : size + "px",
        height: isGlyph ? "auto" : (size * 0.5) + "px",
        background: isGlyph ? "transparent" : color,
        color: color,
        fontSize: isGlyph ? size + "px" : "0",
        lineHeight: "1",
        borderRadius: isGlyph ? "0" : "2px",
        boxShadow: isGlyph ? "none" : `0 0 8px ${color}`,
        filter: isGlyph ? `drop-shadow(0 0 8px ${color})` : "none",
        opacity: "0",
        transform: "translate3d(0,0,0)",
        animation: `pilsFall ${dur}s cubic-bezier(.3,.7,.6,1) ${delay}s forwards`,
      });
      piece.style.setProperty("--sway", sway + "px");
      piece.style.setProperty("--rot", rot + "deg");
      if (isGlyph) piece.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      layer.appendChild(piece);
    }

    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 6000);

    // A toast — but reuse the .toast class so it matches the design language.
    const toast = document.createElement("div");
    toast.className = "toast ok";
    toast.textContent = "🍺 Skål! 🍺";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2800);
  }

  function inject() {
    if (document.getElementById("pils-confetti-style")) return;
    const s = document.createElement("style");
    s.id = "pils-confetti-style";
    s.textContent = `
      @keyframes pilsFall {
        0%   { transform: translate3d(0, -10vh, 0) rotate(0deg);   opacity: 0; }
        8%   { opacity: 1; }
        100% { transform: translate3d(var(--sway), 110vh, 0) rotate(var(--rot)); opacity: 1; }
      }
      @media (prefers-reduced-motion: reduce) {
        .pils-confetti span { animation: none !important; opacity: 0 !important; }
      }
    `;
    document.head.appendChild(s);
  }
  inject();

  window.addEventListener("keydown", (e) => {
    // Ignore modifier-only keys; allow typing inside inputs/textareas too.
    if (e.key.length !== 1) { buf = ""; return; }
    buf = (buf + e.key.toLowerCase()).slice(-TRIGGER.length);
    if (buf === TRIGGER) {
      fireConfetti();
      buf = "";
    }
  });

  // Also expose a manual trigger in case the user wants to test it
  window.pils = fireConfetti;
})();
