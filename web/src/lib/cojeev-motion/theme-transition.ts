"use client";

export type ThemeRevealOrigin = { x:number; y:number };
export type ThemeChangeDetails = { origin:ThemeRevealOrigin };
export type ThemeRevealOptions = { origin?:ThemeRevealOrigin };
type ThemeMode = "light" | "dark";
let pendingOrigin: {origin:ThemeRevealOrigin; element:HTMLElement; time:number} | undefined;
let previousZone=-1;

/** Choose corners, edges and centre without repeating the previous region. */
export function variedThemeOrigin(width:number,height:number,random= Math.random,previous=-1) {
  const zones=[[.07,.07],[.93,.07],[.93,.93],[.07,.93],[.06,.5],[.94,.5],[.5,.06],[.5,.94],[.5,.5]];
  const draw=Math.max(0,Math.min(.999999,random()));
  let zone=Math.floor(draw*(previous>=0?8:9));
  if(previous>=0&&zone>=previous)zone++;
  const [x,y]=zones[zone];
  const jitter=()=> (Math.max(0,Math.min(1,random()))-.5)*.07;
  return {origin:{x:Math.max(12,Math.min(width-12,width*(x+jitter()))),y:Math.max(12,Math.min(height-12,height*(y+jitter())))},zone};
}

/** Record a varied origin at activation, never during rendering or hydration. */
export function rememberThemeOrigin(element:HTMLElement):ThemeChangeDetails {
  const root=element.ownerDocument.documentElement;
  const choice=variedThemeOrigin(root.clientWidth,root.clientHeight,Math.random,previousZone);
  const origin=choice.origin;previousZone=choice.zone;
  pendingOrigin={origin,element,time:performance.now()};
  return {origin};
}

/** Twelve smooth lobed segments, in viewport pixels, expanding beyond every corner. */
export function themeRevealPath(progress:number,origin:ThemeRevealOrigin,width:number,height:number,phase=0) {
  const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  const w=Math.max(1,Number.isFinite(width)?width:1),h=Math.max(1,Number.isFinite(height)?height:1);
  const x=Math.max(0,Math.min(w,Number.isFinite(origin.x)?origin.x:w/2)),y=Math.max(0,Math.min(h,Number.isFinite(origin.y)?origin.y:h/2));
  const reach=Math.hypot(Math.max(x,w-x),Math.max(y,h-y))/.72;
  const points=Array.from({length:12},(_,index)=>{
    const angle=index*Math.PI/6;
    const radius=reach*p*(1+.12*Math.sin(angle*3+p*.65+phase)+.065*Math.cos(angle*5-p*.35-phase*.7));
    return {x:x+Math.cos(angle)*radius,y:y+Math.sin(angle)*radius};
  });
  const f=(n:number)=>Number(n.toFixed(2));
  let path=`M${f(points[0].x)} ${f(points[0].y)}`;
  for(let i=0;i<points.length;i++){
    const before=points[(i+11)%12],start=points[i],end=points[(i+1)%12],after=points[(i+2)%12];
    path+=`C${f(start.x+(end.x-before.x)/6)} ${f(start.y+(end.y-before.y)/6)} ${f(end.x-(after.x-start.x)/6)} ${f(end.y-(after.y-start.y)/6)} ${f(end.x)} ${f(end.y)}`;
  }
  return path+"Z";
}

/**
 * Smooth theme switch: every theme write happens inside the view-transition
 * callback (so the old snapshot stays on the old theme), then a short circular
 * reveal expands from the tap point. The reveal is a single WAAPI animation on
 * the transition pseudo-element, so it runs on the compositor. Quiet,
 * hidden, reduced-motion or unsupported clients commit instantly.
 */
export function applyTheme(mode:ThemeMode,quiet=false,root?:HTMLElement,options:ThemeRevealOptions={}) {
  if(typeof document==="undefined")return;
  const scope=root??document.documentElement,doc=scope.ownerDocument,canvas=doc.documentElement;
  const commit=()=>{scope.dataset.mode=mode;scope.classList.toggle("dark",mode==="dark");};
  if(scope.dataset.mode===mode){pendingOrigin=undefined;commit();return;}
  const reduced=()=>doc.defaultView?.matchMedia("(prefers-reduced-motion: reduce)").matches??false;
  const activation=pendingOrigin&&performance.now()-pendingOrigin.time<1500?pendingOrigin:undefined;
  const origin=options.origin??activation?.origin;
  pendingOrigin=undefined;
  const start=(doc as Document & {startViewTransition?:(cb:()=>void)=>{ready:Promise<void>;finished:Promise<void>;skipTransition:()=>void}}).startViewTransition;
  if(quiet||doc.hidden||reduced()||typeof start!=="function"||!origin){commit();return;}
  const width=canvas.clientWidth,height=canvas.clientHeight;
  const x=Math.max(0,Math.min(width,Number.isFinite(origin.x)?origin.x:width/2));
  const y=Math.max(0,Math.min(height,Number.isFinite(origin.y)?origin.y:height/2));
  const reach=Math.hypot(Math.max(x,width-x),Math.max(y,height-y));
  canvas.setAttribute("data-theme-reveal",mode);
  try{
    const transition=start.call(doc,()=>{commit();});
    void transition.ready.then(()=>{
      try{
        canvas.animate(
          {clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${reach}px at ${x}px ${y}px)`]},
          {duration:550,easing:"cubic-bezier(.32,.72,0,1)",pseudoElement:"::view-transition-new(root)"},
        );
      }catch{/* the theme commit itself still stands */}
    },()=>{});
    void transition.finished.then(
      ()=>canvas.removeAttribute("data-theme-reveal"),
      ()=>canvas.removeAttribute("data-theme-reveal"),
    );
  }catch{canvas.removeAttribute("data-theme-reveal");commit();}
}
