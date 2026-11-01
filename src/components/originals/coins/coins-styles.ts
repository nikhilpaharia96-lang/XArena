/** Theme overrides + new classes for Lakshmi Coins (loaded together with SLOT_CSS). */
export const COINS_CSS = `
.ga-root.lc{border-color:rgba(255,120,120,.4);background:#1a0409}
.lc .ga-hero{background:linear-gradient(180deg,#2a0510 0%,#7a1230 42%,#e0562a 78%,#ffb347 100%)}
.lc .ga-frame{background:linear-gradient(180deg,#5a0f1c,#26050b);border-top-color:#ff9a5a}
.lc .ga-board{background:#14040a;border-color:#ffb347}
.lc .ga-reel{background:linear-gradient(180deg,#3a0a1c,#220510)}
.lc .ga-hud{background:linear-gradient(180deg,#2e0a10,#17050a)}
.lc .ga-panel{background:#17050a}
.lc.ga-fs .ga-frame{background:linear-gradient(180deg,#6a1a08,#2e0c04)}
.lc-swing{animation:lc-swing 3s ease-in-out infinite alternate}
.lc-flame{animation:lc-flame .9s ease-in-out infinite alternate}
.lc-bloom{animation:lc-bloom 5s ease-in-out infinite}
.lc-cell{aspect-ratio:1/1;position:relative;display:flex;align-items:center;justify-content:center}
.lc-empty{position:absolute;inset:10%;border-radius:10px;border:1.5px dashed rgba(255,210,120,.25);background:rgba(0,0,0,.25)}
.lc-empty.seek{border-color:rgba(255,230,150,.8);animation:lc-seek .5s ease-in-out infinite alternate}
.lc-chip{position:absolute;inset:6%;display:flex;align-items:center;justify-content:center}
.lc-chip svg{position:absolute;inset:0;width:100%;height:100%;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
.lc-chip svg text{display:none}
.lc-chip b{position:relative;z-index:1;font:900 clamp(9px,2.6vw,12px) Georgia,serif;color:#5a2a02;text-shadow:0 1px 0 rgba(255,255,255,.5);margin-top:4px}
.lc-chip.pop{animation:ga-zoom .45s cubic-bezier(.2,1.6,.4,1)}
.lc-chip.jp b{color:#fff;text-shadow:0 0 6px #e63b3b}
.lc-chip.jp::after{content:attr(data-label);position:absolute;top:-6px;left:50%;transform:translateX(-50%);padding:0 5px;border-radius:6px;font:900 8px system-ui;background:#c81e3c;color:#fff2b0;border:1px solid #ffd54a;z-index:2}
.lc-respins{display:flex;gap:5px;align-items:center;justify-content:center;margin-bottom:6px;font:900 11px system-ui;letter-spacing:.12em;color:#ffcf8a}
.lc-respins i{display:inline-block;width:12px;height:12px;border-radius:50%;background:#3a1a10;border:1px solid #ffd54a}
.lc-respins i.on{background:radial-gradient(circle,#fff2b0,#e49a1c);box-shadow:0 0 8px #ffb02e}
@keyframes lc-swing{from{transform:translateX(-2px)}to{transform:translateX(2px)}}
@keyframes lc-flame{from{transform:scale(1,1) skewX(-2deg)}to{transform:scale(.92,1.1) skewX(3deg)}}
@keyframes lc-bloom{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
@keyframes lc-seek{from{opacity:.4}to{opacity:1}}
`;
