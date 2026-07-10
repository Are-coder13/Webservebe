// Tested, working Three.js scene recipes injected into the design agent's
// prompt. Every pattern below was rendered and screenshot-verified in
// headless Chromium against Three.js r128 + GSAP 3.12.5 before shipping.
// The agent adapts these (colours, distributions, choreography) per business —
// it must not invent 3D boilerplate from scratch, that is where scenes break.

export function threeRecipes() {
  return `
CINEMATIC 3D RECIPES (tested code — adapt, don't reinvent):

Load EXACTLY these scripts, in this order (r128 — never another version; never <script type="module">):
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/postprocessing/EffectComposer.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/postprocessing/RenderPass.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/postprocessing/ShaderPass.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/shaders/CopyShader.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/shaders/LuminosityHighPassShader.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/postprocessing/UnrealBloomPass.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>

PAGE ARCHITECTURE — "immersive chapters":
- ONE fixed full-viewport canvas behind everything: <div id="gl" style="position:fixed;inset:0;z-index:0">.
- A fixed radial vignette .veil above it (z-index:1, pointer-events:none).
- Content = full-height .chapter sections (z-index:2) that scroll OVER the 3D.
- Every text block sits on a scrim or it will drown in the glow:
  .inner::before{content:'';position:absolute;inset:-70px -90px;z-index:-1;
    background:radial-gradient(closest-side,rgba(BG,.78),rgba(BG,.45) 60%,transparent);filter:blur(4px)}
  plus text-shadow on headings/paragraphs.

SETUP (one renderer for the page lifetime):
var renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setSize(window.innerWidth,window.innerHeight);
scene.background=new THREE.Color(BG); scene.fog=new THREE.FogExp2(BG,0.016);
var camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,0.1,400); camera.position.set(0,2,46);
var clock=new THREE.Clock(); // drives RECIPE F2/G2 ambient motion — declare once, read in animate()

RECIPE A — soft particle sprite (no image assets ever):
function makeSprite(){var c=document.createElement('canvas');c.width=c.height=64;
 var g=c.getContext('2d'),r=g.createRadialGradient(32,32,0,32,32,32);
 r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(0.35,'rgba(255,255,255,.6)');r.addColorStop(1,'rgba(255,255,255,0)');
 g.fillStyle=r;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}

RECIPE B — two-tone particle universe (~9000 points; create geometry ONCE, never in animate()):
var geo=new THREE.BufferGeometry(),pos=new Float32Array(N*3),col=new Float32Array(N*3);
var ca=new THREE.Color(ACCENT),cb=new THREE.Color(ACCENT2),c=new THREE.Color();
for(var i=0;i<N;i++){var r=SPREAD*Math.pow(Math.random(),0.5),th=Math.random()*Math.PI*2,ph=Math.acos(2*Math.random()-1);
 pos[i*3]=r*Math.sin(ph)*Math.cos(th);pos[i*3+1]=r*Math.sin(ph)*Math.sin(th)*0.55;pos[i*3+2]=r*Math.cos(ph);
 c.copy(ca).lerp(cb,Math.random());col[i*3]=c.r;col[i*3+1]=c.g;col[i*3+2]=c.b;}
geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
new THREE.Points(geo,new THREE.PointsMaterial({size:0.55,map:sprite,vertexColors:true,transparent:true,opacity:0.9,depthWrite:false,blending:THREE.AdditiveBlending}));

RECIPE C — signature helix light-strand (two of them, one rotated Math.PI, in a Group):
for(var i=0;i<N;i++){var t=i/N,a=t*Math.PI*2*TURNS,w=0.35*Math.sin(t*40);
 pos[i*3]=Math.cos(a)*(RADIUS+w);pos[i*3+1]=(t-0.5)*HEIGHT;pos[i*3+2]=Math.sin(a)*(RADIUS+w);}
Same Points material pattern as B with a single color. Vary the parametric curve per brand:
helix (tech/medical), torus-knot path (beauty/creative), flat spiral galaxy (restaurants), lissajous ribbon (auto).

RECIPE D — glowing wireframe hero structure (centrepiece the camera flies around):
group of: IcosahedronGeometry(3.4,1) wireframe MeshBasicMaterial ACCENT opacity .5
 + inner IcosahedronGeometry(1.9,0) wireframe white opacity .85
 + TorusGeometry(5.2,0.03,8,120) MeshBasicMaterial ACCENT2, ring.rotation.x=Math.PI/2.4.
MeshBasicMaterial only — NO lights needed anywhere. Swap the silhouette per trade
(e.g. torus-knot for a salon, octahedron stack for law, sphere lattice for dental).

RECIPE E — bloom (this is what makes it look expensive):
var composer=new THREE.EffectComposer(renderer);
composer.addPass(new THREE.RenderPass(scene,camera));
var bloom=new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),1.25,0.85,0.12);
composer.addPass(bloom);
Then call composer.render() in animate() — NOT renderer.render().
EXPOSURE DISCIPLINE: bloom strength stays within 0.8–1.6. The camera must NEVER
end a scroll move inside/through the geometry — closest approach z >= 14 with the
sizes above, or the frame white-outs and text dies.

RECIPE G — HERO-PRODUCT HOLOGRAM (the moment that explains the business):
Draw the business's CORE product/service as a 2D silhouette with THREE.Shape
beziers (a tooth, a wrench, a plate, scissors, a gavel, a house...). Then two
particle systems scroll-morph from scattered cloud into that silhouette — a dim
FILL plus a bright OUTLINE so the shape reads crisply (like an AR hologram scan):
// fill: sample area-weighted random points inside the triangulated shape
var geo=new THREE.ShapeGeometry(shape,24); // then walk geo.index triangles,
// pick triangle by cumulative area, random barycentric point, scale ~1.5x,
// z jitter +-0.6. Material: size:0.24, opacity:0.5, color:ACCENT.
// outline: var pts=shape.getPoints(240); sample randomly along it, jitter 0.12,
// z jitter +-0.25. Material: size:0.4, opacity:0.95, color: lightened accent.
// both: map:sprite, transparent, depthWrite:false, AdditiveBlending.
// morph state {t:0}; tween t 0->1 in the scroll timeline at the chapter where
// you present the core offering. Per frame lerp cloud->target and billboard:
// arr[k]=cloud[k]+(target[k]-cloud[k])*morph.t; attr.needsUpdate=true;
// pts.quaternion.copy(camera.quaternion);
// Start positions = random sphere (radius ~26-30). Keep total morph particles
// <= 5000. The OUTLINE is what makes it readable — never ship fill-only blobs.
// If another centrepiece occupies the origin, shrink it to scale 0.001 as the
// hologram forms (tween in the same timeline).

RECIPE F — scroll-driven camera chapters (GSAP scrub) + mouse parallax + inertia:
var cam={x:0,y:2,z:46,ry:0};
gsap.registerPlugin(ScrollTrigger);
var tl=gsap.timeline({scrollTrigger:{trigger:document.body,start:'top top',end:'bottom bottom',scrub:1.1}});
// Make the moves BIG — this is a fly-THROUGH, not a nudge. Wide -> deep push -> sweeping
// orbit -> close reveal -> rise -> settle. Keep closest approach z>=14 (never inside geometry).
tl.to(cam,{z:30,y:3,ease:'none',duration:1},0)               // ch1: pull the world in
  .to(cam,{z:18,ry:Math.PI*0.6,x:-8,ease:'none',duration:1},1) // ch2: dive + sweeping orbit
  .to(cam,{z:14,y:-2,ry:Math.PI*1.1,ease:'none',duration:1},2) // ch3: close reveal (never inside)
  .to(cam,{z:24,y:4,ry:Math.PI*1.5,ease:'none',duration:1},3)  // ch4: rise + keep orbiting
  .to(strandGroup.rotation,{y:Math.PI*2.2,ease:'none',duration:4},0) // strand turns the whole way
  .to(bloomBase,{v:1.5,ease:'none',duration:1},2); // brighten toward the reveal (see bloomBase below)
// bloomBase is a plain proxy so scroll and the ambient pulse compose instead of fighting:
var bloomBase={v:1.15};
In animate(): ease camera toward targets + parallax, then lookAt origin:
camera.position.z+=(cam.z-camera.position.z)*0.08;
camera.position.x=Math.sin(cam.ry)*camera.position.z*0.35+mouse.x*2.2;
camera.position.y+=((cam.y-mouse.y*1.6)-camera.position.y)*0.06;
camera.lookAt(0,0,0); composer.render();
Also gsap.from() each .chapter .inner (opacity 0, y:60) with its own ScrollTrigger at 'top 78%'.

RECIPE F2 — AMBIENT MOTION (MANDATORY — the scene must be ALIVE at rest, before/without any scroll):
The camera moves and the strand rotation in RECIPE F are driven by SCROLL. On their own,
that means a visitor sitting at the top of the page (not scrolling) sees a FROZEN scene —
this is the #1 way these pages look dead. FIX: in animate(), advance a clock and apply
continuous, scroll-INDEPENDENT motion EVERY frame, on top of whatever the scroll timeline does:
var t=clock.getElapsedTime();
// 1) clearly-visible idle spin of objects the SCROLL TIMELINE does NOT already rotate
//    (universe + centrepiece; the strand keeps its scroll-driven spin). Fast enough to READ:
universe.rotation.y=t*0.08; universe.rotation.x=Math.sin(t*0.15)*0.08;
centrepiece.rotation.y=t*0.28; centrepiece.rotation.x=Math.sin(t*0.35)*0.2;
// 2) a breathing bob so nothing is rigid:
centrepiece.position.y=Math.sin(t*0.7)*0.7;
// 3) living particles + sparkle: a slow drift on the whole field and a composed bloom pulse
//    (scroll sets bloomBase.v; the sine pulses around it — one owner, no fight):
particleField.position.y=Math.sin(t*0.4)*0.6; particleField.rotation.z=Math.sin(t*0.12)*0.05;
bloom.strength=Math.min(1.6,Math.max(0.8,bloomBase.v+Math.sin(t*0.8)*0.18));
IMPORTANT: only assign time-based absolute rotation to objects the scroll GSAP timeline does
NOT tween (or GSAP will overwrite it each scroll tick). If you also want the strand alive at
rest, wrap it in an extra parent Group and idle-spin THAT parent, leaving the inner strand for
the scroll tween. The result: motionless page = still gently rotating & breathing; on scroll =
the choreographed chapters ON TOP. NEVER ship a hero whose only motion is scroll or mouse parallax.

RECIPE G2 — ANIMATING THE HERO PRODUCT (e.g. the tooth) so it is never a static prop:
The RECIPE G hologram morph (morph.t 0->1) is SCROLL-driven, so at the top of the page the
product silhouette can look frozen. Give the hero product its OWN continuous life in animate(),
independent of scroll, so it reads as a live hologram even at rest:
- billboard + slow idle yaw every frame: holoGroup.rotation.y=Math.sin(t*0.25)*0.5; (a slow
  left-right turn, not just a static face-on plane), PLUS the per-point billboard to camera.
- shimmer/scan: oscillate the OUTLINE points opacity (0.7<->1) on a ~2s sine, or drift a few
  points along the silhouette, so the outline pulses like a live scan.
- a slow vertical float: holoGroup.position.y=Math.sin(t*0.5)*0.3.
- START the morph partly formed (morph.t ease 0.15->1 across scroll, not 0->1) so the shape is
  already legible on load, then completes as the user scrolls into the reveal chapter.
The tooth (or any flagship silhouette) must be visibly rotating/shimmering/floating at ALL times.

RECIPE H — SCAN/TARGETING HUD (optional; use ONLY for precision/tech/security-coded
trades — dental, auto diagnostics, legal, security, engineering, medical. Skip it
entirely for warm/casual trades like restaurants, salons, cafes — it reads cold there):
A pure CSS/SVG overlay (NOT WebGL — a plain fixed <div class="hud"> above the canvas,
z-index above .veil) that frames the hero-product hologram (RECIPE G) like a targeting
scan. Fade it in only while that hologram is forming, fade out after:
<div class="hud" id="hud"> containing:
  - 4 corner brackets: absolutely positioned 26x26px divs, each with two 1.5px borders
    forming an L (top+left / top+right / bottom+left / bottom+right), framing a
    rectangle around the hologram's screen position.
  - a reticle: inline SVG, viewBox 0 0 100 100, two concentric circles (r=46, r=30) +
    a crosshair (two centered lines), stroke only, accent colour, opacity ~0.5,
    centered over the hologram.
  - a moving scanline: a 1px-tall gradient bar (transparent-accent-transparent) that
    animates top<->bottom across the bracket frame on a 2-3s ease-in-out loop.
  - a readout panel: small monospace/heading-font card (dark translucent bg, 1px
    accent border, backdrop-filter:blur) with 2-3 label/value rows (e.g. SCAN:ACTIVE,
    TARGET:<real service name>, a plausible precision/metric stat). One row has a
    small pulsing dot (radial glow, opacity keyframe 1<->0.3 on ~1.4s loop).
Toggle visibility with a CSS class (.hud{opacity:0;transition:opacity .5s}.hud.show{opacity:1})
driven from the SAME scroll timeline that drives the hologram morph — call
document.getElementById('hud').classList.add('show') / .remove('show') at the timeline
positions bracketing the morph tween (add slightly before morph starts, remove slightly
after it completes). Hide the whole .hud under prefers-reduced-motion and below 768px
width (this is a decorative precision layer, not core content — never let it block
touch targets, keep pointer-events:none on the whole block).

MANDATORY GUARDS (all of them, every time):
- Wrap the whole scene in: if(reduce||!hasWebGL()||!window.THREE)return; try{...}catch(e){}
  where reduce = matchMedia('(prefers-reduced-motion: reduce)').matches and
  hasWebGL tests canvas.getContext('webgl') in try/catch.
- CSS fallback under @media(prefers-reduced-motion:reduce){#gl{display:none} body{background:radial-gradient(...)}}
- resize handler updates camera.aspect + updateProjectionMatrix() + renderer AND composer setSize.
- r128 API only: no CapsuleGeometry (r142+), no THREE.Geometry (removed), BufferGeometry everywhere.
- Never create geometry/materials inside animate(). Share one sprite texture across all Points.
- ALWAYS-ON MOTION: every scene MUST include RECIPE F2 ambient motion so it animates at rest
  (idle rotation + breathing), and any hero product (RECIPE G) MUST animate continuously per
  RECIPE G2. A scene whose only motion is scroll/mouse (frozen when still) is a failure — use a
  THREE.Clock and advance object rotations/positions every frame regardless of scroll.
- Points materials always: transparent:true, depthWrite:false, blending:THREE.AdditiveBlending.
- Total particle budget <= 16000 across all systems; segment counts modest (wireframes look BETTER low-poly).`;
}
