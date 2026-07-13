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
tl.to(cam,{z:20,y:1,ease:'none',duration:1},0)          // ch1: push in
  .to(cam,{ry:Math.PI*0.5,x:-6,ease:'none',duration:1},1) // ch2: orbit
  .to(cam,{z:16,y:-1.2,ry:Math.PI*0.9,ease:'none',duration:1},2) // ch3: close but never inside
  .to(strandGroup.rotation,{y:Math.PI*1.6,ease:'none',duration:3},0)
  .to(bloom,{strength:1.5,ease:'none',duration:1},2);
In animate(): ease camera toward targets + parallax, then lookAt origin:
camera.position.z+=(cam.z-camera.position.z)*0.08;
camera.position.x=Math.sin(cam.ry)*camera.position.z*0.35+mouse.x*2.2;
camera.position.y+=((cam.y-mouse.y*1.6)-camera.position.y)*0.06;
camera.lookAt(0,0,0); composer.render();
Also gsap.from() each .chapter .inner (opacity 0, y:60) with its own ScrollTrigger at 'top 78%'.

AMBIENT MOTION (MANDATORY — the scene must be visibly ALIVE the instant it loads,
before any scroll or mouse movement; scroll-driven camera alone reads as a static
image and is a failure). In animate() add a clock and drive continuous, autonomous
motion every frame, independent of scroll:
var t=performance.now()*0.001;
- particle universe: points.rotation.y += 0.0009; points.rotation.x = Math.sin(t*0.15)*0.05;
- light-strand group: strandGroup.rotation.y += 0.0016 (ADD to the scroll tween, don't replace it);
- centrepiece: centre.rotation.y += 0.0022; centre.rotation.z = Math.sin(t*0.3)*0.08;
- gentle bloom breathing: bloom.strength = base + Math.sin(t*0.8)*0.12 (keep within 0.8–1.6);
- optional particle drift: bob a few systems with position.y = Math.sin(t*0.5)*0.4.
This ambient layer runs ALWAYS (the scroll timeline adds camera moves on top). The
page must never sit still. Keep speeds slow and weighty — this is a luxury idle, not a spin.

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

═══ CRAFT UPGRADES — what separates "expensive" from "junior" (all asset-free) ═══
(These use r128 API but adapt them carefully; the render→fix loop will catch any
scene that fails to initialise, so prefer richness over timidity.)

RECIPE I — REAL MATERIALS, LIGHTING & REFLECTIONS (lift the SOLID centrepiece out of
flat glow; particles/wireframes stay MeshBasic — they glow via bloom):
// procedural environment map (asset-free) so metal/glass actually reflects something:
function envTex(){var c=document.createElement('canvas');c.width=64;c.height=32;
 var g=c.getContext('2d'),gr=g.createLinearGradient(0,0,0,32);
 gr.addColorStop(0,'LIGHT_TINT');gr.addColorStop(0.5,'ACCENT');gr.addColorStop(1,'BG');
 g.fillStyle=gr;g.fillRect(0,0,64,32);var t=new THREE.CanvasTexture(c);
 t.mapping=THREE.EquirectangularReflectionMapping;return t;}
var env=envTex(); scene.environment=env;
// subtle lights (bloom still supplies the glow — keep these low so nothing white-outs):
scene.add(new THREE.HemisphereLight(0xffffff, BG, 0.55));
var key=new THREE.PointLight(ACCENT,2.0,140); key.position.set(9,11,15); scene.add(key);
var rim=new THREE.PointLight(ACCENT2,1.4,140); rim.position.set(-11,-5,-9); scene.add(rim);
// centrepiece CORE: a solid, reflective, emissive-tinted inner form:
var coreMat=new THREE.MeshStandardMaterial({color:0x0b0b12,metalness:0.85,roughness:0.22,
 envMap:env,envMapIntensity:1.1,emissive:new THREE.Color(ACCENT),emissiveIntensity:0.32});
Keep the glowing WIREFRAME (RECIPE D) as an OUTER shell over this solid core. The
combination (reflective solid core + bloom wireframe + rim glow below) is the look.

RECIPE J — FRESNEL RIM GLOW (GLSL — the single biggest "senior" tell; cheap, reliable):
Wrap the core in a slightly larger transparent shell whose edges glow, so light appears
to wrap the silhouette (dimensional even before bloom). ShaderMaterial, additive, no texture:
var fres=new THREE.ShaderMaterial({transparent:true,blending:THREE.AdditiveBlending,
 depthWrite:false,uniforms:{c:{value:new THREE.Color(ACCENT2)},p:{value:2.8}},
 vertexShader:'varying float vF;uniform float p;void main(){vec3 n=normalize(normalMatrix*normal);'+
  'vec4 mv=modelViewMatrix*vec4(position,1.0);vec3 v=normalize(-mv.xyz);'+
  'vF=pow(1.0-abs(dot(n,v)),p);gl_Position=projectionMatrix*mv;}',
 fragmentShader:'varying float vF;uniform vec3 c;void main(){gl_FragColor=vec4(c*vF,vF);}'});
Apply fres to a clone of the core geometry scaled ~1.06. The rim intensifies at glancing
angles — that gradient of light around the edge is what makes it read as lit, not painted.

RECIPE K — DEPTH OF FIELD (optional; whisper-subtle cinematic focus). Adds one script
AFTER the bloom scripts:
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/examples/js/postprocessing/BokehPass.js"></script>
var bokeh=new THREE.BokehPass(scene,camera,{focus:22.0,aperture:0.00016,maxblur:0.007,
 width:innerWidth,height:innerHeight}); composer.addPass(bokeh); // add LAST, after UnrealBloom
Keep aperture/maxblur TINY — only the far background and extreme edges soften; the hero
stays crisp. Disable below 768px. If any frame looks blurred all over, drop maxblur to
0.004 or remove this pass entirely (it is optional polish, not core).

MANDATORY GUARDS (all of them, every time):
- Wrap the whole scene in: if(reduce||!hasWebGL()||!window.THREE)return; try{...}catch(e){}
  where reduce = matchMedia('(prefers-reduced-motion: reduce)').matches and
  hasWebGL tests canvas.getContext('webgl') in try/catch.
- CSS fallback under @media(prefers-reduced-motion:reduce){#gl{display:none} body{background:radial-gradient(...)}}
- resize handler updates camera.aspect + updateProjectionMatrix() + renderer AND composer setSize.
- r128 API only: no CapsuleGeometry (r142+), no THREE.Geometry (removed), BufferGeometry everywhere.
- Never create geometry/materials inside animate(). Share one sprite texture across all Points.
- Points materials always: transparent:true, depthWrite:false, blending:THREE.AdditiveBlending.
- Total particle budget <= 16000 across all systems; segment counts modest (wireframes look BETTER low-poly).`;
}
