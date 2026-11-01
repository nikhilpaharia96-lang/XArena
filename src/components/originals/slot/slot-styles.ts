/** All CSS for Garuda Ascent, scoped under .ga-root so nothing leaks into the rest of XArena. */
export const SLOT_CSS = `
.ga-root{position:relative;border-radius:22px;overflow:hidden;background:#12061f;border:1px solid rgba(255,200,80,.35);box-shadow:0 20px 50px -20px rgba(0,0,0,.8);color:#fff;user-select:none;-webkit-tap-highlight-color:transparent}
.ga-root.ga-shake{animation:ga-shake .7s cubic-bezier(.36,.07,.19,.97) both}
.ga-hero{position:relative;height:clamp(190px,52vw,270px);overflow:hidden;background:linear-gradient(180deg,#1b1250 0%,#5a2a7a 38%,#e0624a 72%,#ffb347 100%)}
.ga-hero.ga-fever{filter:hue-rotate(-28deg) saturate(1.35) brightness(1.08)}
.ga-hero-svg{position:absolute;inset:0;width:100%;height:100%}
.ga-rays{position:absolute;left:50%;top:48%;width:170%;aspect-ratio:1;transform:translate(-50%,-50%);background:repeating-conic-gradient(from 0deg,rgba(255,226,140,.20) 0 6deg,transparent 6deg 18deg);animation:ga-rot 40s linear infinite;-webkit-mask-image:radial-gradient(circle,#000 8%,transparent 62%);mask-image:radial-gradient(circle,#000 8%,transparent 62%)}
.ga-halo{animation:ga-halo 4s ease-in-out infinite;transform-origin:200px 120px}
.ga-wing-l{animation:ga-flap-l 3.2s ease-in-out infinite}
.ga-wing-r{animation:ga-flap-r 3.2s ease-in-out infinite}
.ga-eyes{filter:drop-shadow(0 0 5px #ff3030) drop-shadow(0 0 10px #ff1010);animation:ga-eye 2.4s ease-in-out infinite}
.ga-spark{position:absolute;bottom:-8px;border-radius:50%;background:radial-gradient(circle,#fff6c0,#ffc93c 60%,transparent);animation:ga-float linear infinite;opacity:0}
.ga-brand{position:absolute;top:10px;left:0;right:0;text-align:center;font-family:Georgia,'Times New Roman',serif;font-weight:900;letter-spacing:.14em;font-size:clamp(15px,4.4vw,22px);color:#ffe9a3;text-shadow:0 2px 0 #7a3b00,0 0 18px rgba(255,190,60,.8)}
.ga-brand small{display:block;font-size:.5em;letter-spacing:.35em;color:#ffcf8a;opacity:.9}
.ga-frame{position:relative;margin-top:-6px;padding:10px 10px 8px;background:linear-gradient(180deg,#4a2a12,#2b1508);border-top:3px solid #e9b24a;box-shadow:inset 0 2px 0 rgba(255,236,170,.4)}
.ga-fs .ga-frame{background:linear-gradient(180deg,#5a1a14,#2b0a08);border-top-color:#ff8a3a}
.ga-titlebar{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;font-family:Georgia,serif;font-weight:900;color:#ffe9a3;letter-spacing:.08em;font-size:14px}
.ga-chip{border:1px solid rgba(255,220,120,.4);background:rgba(0,0,0,.35);border-radius:999px;padding:3px 10px;font:700 11px system-ui;letter-spacing:.04em;color:#ffe9a3}
.ga-chip.on{background:linear-gradient(180deg,#ffd45a,#d8860f);color:#3a1a00;border-color:#fff2b0}
.ga-boardwrap{display:flex;gap:8px;align-items:stretch}
.ga-board{position:relative;flex:1;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;padding:5px;border-radius:14px;background:#0d0418;border:2px solid #e9b24a;box-shadow:inset 0 0 22px rgba(0,0,0,.9)}
.ga-reel{position:relative;aspect-ratio:1/3;overflow:hidden;border-radius:8px;background:linear-gradient(180deg,#2a0f3a,#1a0828)}
.ga-cell{aspect-ratio:1/1;display:flex;align-items:center;justify-content:center;padding:7%;position:relative}
.ga-cell svg{width:100%;height:100%;filter:drop-shadow(0 2px 3px rgba(0,0,0,.6))}
.ga-strip{position:absolute;top:0;left:0;width:100%;animation:ga-spin .32s linear infinite;filter:blur(1.6px)}
.ga-settle{animation:ga-settle .28s cubic-bezier(.2,1.6,.4,1)}
.ga-cell.win::before{content:"";position:absolute;inset:3%;border-radius:10px;border:2px solid #fff2b0;box-shadow:0 0 14px #ffc93c,inset 0 0 12px rgba(255,210,90,.7);animation:ga-winpulse .7s ease-in-out infinite alternate}
.ga-cell.win svg{animation:ga-pop .7s ease-in-out infinite alternate}
.ga-shine::after{content:"";position:absolute;inset:0;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.35) 50%,transparent 65%);transform:translateX(-120%);animation:ga-shine 3.6s ease-in-out infinite}
.ga-canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3}
.ga-side{width:54px;display:flex;flex-direction:column;gap:4px;justify-content:center}
.ga-ladder{display:flex;flex-direction:column;gap:3px;flex:1}
.ga-rung{flex:1;border-radius:8px;display:flex;align-items:center;justify-content:center;font:900 13px Georgia,serif;color:#ffe9a3;background:linear-gradient(180deg,#5b2d62,#33153c);border:1px solid rgba(255,210,100,.35);transition:all .25s}
.ga-rung.on{background:linear-gradient(180deg,#ffe27a,#e08a10);color:#3a1a00;box-shadow:0 0 16px #ffb02e;transform:scale(1.07)}
.ga-sidelabel{font:800 8px system-ui;letter-spacing:.12em;text-align:center;color:#ffcf8a}
.ga-hud{padding:10px 12px 14px;background:linear-gradient(180deg,#2b1508,#160a04)}
.ga-win{display:flex;align-items:baseline;justify-content:center;gap:10px;margin-bottom:10px;font-family:Georgia,serif}
.ga-win b{font-size:12px;letter-spacing:.2em;color:#ffcf8a}
.ga-win span{font-size:28px;font-weight:900;color:#ffe9a3;text-shadow:0 0 14px rgba(255,190,60,.7);min-width:120px;text-align:center}
.ga-win span.big{animation:ga-pop .35s ease-in-out infinite alternate;color:#fff6c0}
.ga-controls{display:flex;align-items:center;justify-content:space-between;gap:6px}
.ga-stack{display:flex;flex-direction:column;gap:6px;flex-shrink:0}
.ga-betgrp{display:flex;align-items:center;gap:4px;flex-shrink:0}
.ga-round{flex-shrink:0;width:34px;height:34px;border-radius:50%;border:2px solid #e9b24a;background:radial-gradient(circle at 35% 30%,#6a3a1a,#2a1408);color:#ffe9a3;display:flex;align-items:center;justify-content:center;font:900 9px system-ui;letter-spacing:.02em;transition:transform .12s,filter .12s}
.ga-round.lg{width:32px;height:32px;font-size:12px}
.ga-round:active:not(:disabled){transform:scale(.9)}
.ga-round:disabled{opacity:.45}
.ga-round.on{background:radial-gradient(circle at 35% 30%,#ffe27a,#d8860f);color:#3a1a00}
.ga-spinbtn{flex-shrink:0;width:76px;height:76px;border-radius:50%;border:4px solid #fff2b0;background:radial-gradient(circle at 35% 28%,#ffe98a,#e49a1c 60%,#9b5a08);color:#3a1a00;font:900 14px Georgia,serif;letter-spacing:.04em;box-shadow:0 8px 24px -6px rgba(255,170,30,.7),inset 0 -6px 12px rgba(120,60,0,.5);transition:transform .12s,filter .12s}
.ga-spinbtn:active:not(:disabled){transform:scale(.93)}
.ga-spinbtn:disabled{filter:grayscale(.4) brightness(.8)}
.ga-spinbtn.spinning svg{animation:ga-turn 1s linear infinite}
.ga-betbox{text-align:center;min-width:62px}
.ga-betbox small{display:block;font:700 9px system-ui;letter-spacing:.14em;color:#ffcf8a}
.ga-betbox b{font:900 17px Georgia,serif;color:#ffe9a3}
.ga-bal{display:flex;justify-content:space-between;margin-top:10px;font:700 12px system-ui;color:#ffcf8a}
.ga-bal b{color:#fff;font-size:14px}
.ga-overlay{position:absolute;inset:0;z-index:20;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;background:radial-gradient(circle,rgba(70,20,10,.55),rgba(8,2,14,.9));animation:ga-fade .35s ease-out}
.ga-overlay h2{font:900 clamp(30px,10vw,52px)/1 Georgia,serif;letter-spacing:.08em;color:#fff2b0;text-shadow:0 0 28px #ffb02e,0 4px 0 #7a3b00;animation:ga-zoom .6s cubic-bezier(.2,1.6,.4,1)}
.ga-overlay p{margin-top:10px;font:800 15px system-ui;letter-spacing:.12em;color:#ffcf8a}
.ga-overlay .amt{margin-top:8px;font:900 34px Georgia,serif;color:#fff;text-shadow:0 0 18px #ffc93c}
.ga-overlay .burst{position:absolute;width:140%;aspect-ratio:1;background:repeating-conic-gradient(rgba(255,210,90,.22) 0 8deg,transparent 8deg 20deg);animation:ga-turn 12s linear infinite;-webkit-mask-image:radial-gradient(circle,#000,transparent 65%);mask-image:radial-gradient(circle,#000,transparent 65%)}
.ga-fsbadge{position:absolute;left:50%;top:-14px;transform:translateX(-50%);z-index:5;padding:4px 14px;border-radius:999px;background:linear-gradient(180deg,#ff8a3a,#c2410c);border:1px solid #ffe0a0;font:900 12px system-ui;letter-spacing:.1em;white-space:nowrap}
.ga-panel{padding:12px 14px;background:#160a04;border-top:1px solid rgba(255,210,100,.25);font:500 12px/1.5 system-ui;color:#e8d6b0}
.ga-panel table{width:100%;border-collapse:collapse;margin:6px 0}
.ga-panel td,.ga-panel th{padding:3px 4px;text-align:center;border-bottom:1px solid rgba(255,255,255,.07)}
.ga-panel td svg{width:26px;height:26px;display:inline-block;vertical-align:middle}
@keyframes ga-spin{from{transform:translateY(0)}to{transform:translateY(-75%)}}
@keyframes ga-settle{0%{transform:translateY(-14%)}60%{transform:translateY(5%)}100%{transform:translateY(0)}}
@keyframes ga-winpulse{from{opacity:.65}to{opacity:1}}
@keyframes ga-pop{from{transform:scale(1)}to{transform:scale(1.1)}}
@keyframes ga-shine{0%,60%{transform:translateX(-120%)}100%{transform:translateX(120%)}}
@keyframes ga-turn{to{transform:rotate(360deg)}}
@keyframes ga-rot{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes ga-float{0%{transform:translateY(0) scale(.6);opacity:0}15%{opacity:.95}100%{transform:translateY(-230px) scale(1.2);opacity:0}}
@keyframes ga-flap-l{0%,100%{transform:rotate(0)}50%{transform:rotate(-7deg)}}
@keyframes ga-flap-r{0%,100%{transform:rotate(0)}50%{transform:rotate(7deg)}}
@keyframes ga-eye{0%,100%{opacity:.75}50%{opacity:1}}
@keyframes ga-halo{0%,100%{opacity:.4;transform:scale(1)}50%{opacity:.7;transform:scale(1.08)}}
@keyframes ga-shake{10%,90%{transform:translate3d(-2px,0,0)}20%,80%{transform:translate3d(4px,1px,0)}30%,50%,70%{transform:translate3d(-7px,-1px,0)}40%,60%{transform:translate3d(7px,2px,0)}}
@keyframes ga-fade{from{opacity:0}to{opacity:1}}
@keyframes ga-zoom{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
@media (prefers-reduced-motion:reduce){.ga-root *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;
