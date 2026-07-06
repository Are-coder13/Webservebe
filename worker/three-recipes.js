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
