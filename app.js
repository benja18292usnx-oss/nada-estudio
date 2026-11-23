import * as THREE from './vendor/three/three.module.min.js';
import { RoomEnvironment } from './vendor/three/addons/RoomEnvironment.js';
import { RoundedBoxGeometry } from './vendor/three/addons/RoundedBoxGeometry.js';
import { reply } from './tele.js';

/* ---------- calidad ---------- */
const params = new URLSearchParams(location.search);
const isMobile = matchMedia('(pointer:coarse)').matches || innerWidth < 820;
const QL = { baja: { dpr: 1, ink: 0.55, oct: 3, seg: 0.6 }, media: { dpr: 1.35, ink: 0.75, oct: 4, seg: 0.8 }, alta: { dpr: 2, ink: 1, oct: 5, seg: 1 } };
let forced = params.get('q');
let qName = QL[forced] ? forced : (localStorage.getItem('nada-q') || 'auto');
if (!QL[qName]) qName = 'auto';
let level = qName !== 'auto' ? qName : (isMobile ? ((navigator.deviceMemory || 4) <= 4 || (navigator.hardwareConcurrency || 8) <= 4 ? 'baja' : 'media') : 'alta');
const Q = () => QL[level];
const qBtn = document.getElementById('q');
const qLabel = () => (qBtn.querySelector('span').textContent = qName === 'auto' ? 'auto (' + level + ')' : qName);
qLabel();
qBtn.addEventListener('click', () => {
  const order = ['auto', 'baja', 'media', 'alta'];
  qName = order[(order.indexOf(qName) + 1) % order.length];
  localStorage.setItem('nada-q', qName);
  if (qName !== 'auto') level = qName; else level = isMobile ? 'baja' : 'alta';
  qLabel(); applyQuality(true);
});

/* ---------- renderer ---------- */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
const pmrem = new THREE.PMREMGenerator(renderer);
const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

let W = innerWidth, H = innerHeight;
function applyQuality(rebuildInk) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, Q().dpr));
  renderer.setSize(W, H, false);
  if (rebuildInk && ink.ready) ink.build();
}

/* ---------- puntero ---------- */
const ptr = { x: innerWidth * 0.62, y: innerHeight * 0.4, t: -10, down: false };
const now = () => performance.now() / 1000;
const onPtr = (x, y) => { ptr.x = x; ptr.y = y; ptr.t = now(); };
addEventListener('pointermove', e => onPtr(e.clientX, e.clientY), { passive: true });
addEventListener('pointerdown', e => { onPtr(e.clientX, e.clientY); ptr.down = true; }, { passive: true });
addEventListener('pointerup', () => (ptr.down = false), { passive: true });
addEventListener('touchmove', e => { const t = e.touches[0]; if (t) onPtr(t.clientX, t.clientY); }, { passive: true });

const clock = new THREE.Clock();
const GLSL_NOISE = `
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x), mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x), f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<OCT;i++){ s+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=.5; } return s; }
`;

/* =====================================================================
   1) HERO: T.E.L.E., cuerpo (foto) + cabeza de tele en 3D
   ===================================================================== */
const hero = (() => {
  const scene = new THREE.Scene();
  scene.environment = envTex;
  scene.environmentIntensity = 0.85;
  const cam = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  const IW = 4.0, IH = 3.0; // tamaño de la foto en el mundo

  // fondo + cuerpo (una sola placa con la foto, bordes fundidos con el fondo)
  const tex = new THREE.TextureLoader().load(isMobile ? 'img/cuerpo-m.webp' : 'img/cuerpo.webp', () => (hero.loaded = true));
  tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = 4;
  const bgMat = new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex }, uShadow: { value: new THREE.Vector3(0, 0, 1) }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vW; void main(){ vW=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `
      uniform sampler2D uTex; uniform vec3 uShadow; uniform float uTime; varying vec2 vW;
      void main(){
        vec2 uv = vec2(vW.x/${IW.toFixed(1)}+.5, vW.y/${IH.toFixed(1)}+.5);
        float vy = clamp(uv.y, .004, .996);
        vec3 eL = texture2D(uTex, vec2(.006, vy)).rgb, eR = texture2D(uTex, vec2(.994, vy)).rgb;
        vec3 edge = mix(eL, eR, clamp(uv.x,0.,1.));
        if(uv.y>1.) edge = mix(edge, edge*1.03, clamp((uv.y-1.)*.4,0.,1.));
        vec3 img = texture2D(uTex, clamp(uv, .002, .998)).rgb;
        float m = smoothstep(0.,.09,uv.x)*smoothstep(1.,.91,uv.x)*smoothstep(1.,.78,uv.y)*step(0.,uv.y);
        vec3 col = mix(edge, img, m);
        // sombra suave de la cabeza sobre cuello/hombros y pared
        vec2 s = (vW - vec2(uShadow.x, .28)) / vec2(.95, .32);
        col *= 1. - .22*exp(-dot(s,s)*1.6)*uShadow.z;
        vec2 s2 = (vW - vec2(uShadow.x+.12, 1.0)) / vec2(1.05, .9);
        col *= 1. - .07*exp(-dot(s2,s2)*2.)*uShadow.z;
        // grano fino
        col += (fract(sin(dot(gl_FragCoord.xy+uTime, vec2(12.9898,78.233)))*43758.5453)-.5)*.012;
        gl_FragColor = vec4(col,1.);
      }`,
    depthWrite: false, toneMapped: false,
  });
  const bg = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), bgMat);
  bg.renderOrder = -10; scene.add(bg);

  // luces
  const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(-2.5, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe6ff, 0.9); rim.position.set(3, 1.5, -2); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8c95, 0.35));

  // cabeza
  const NECK = new THREE.Vector3(0, 0.30, 0.22);
  const pivot = new THREE.Group(); pivot.position.copy(NECK); scene.add(pivot);
  const head = new THREE.Group(); pivot.add(head);
  const HC = 0.70; // alto del centro de la tele sobre el cuello
  const shellMat = new THREE.MeshPhysicalMaterial({ color: 0xb8bcc4, metalness: 0.55, roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x595c63, metalness: 0.35, roughness: 0.55 });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b0c0e, metalness: 0.2, roughness: 0.32 });
  const seg = Q().seg > 0.7 ? 6 : 4;
  const front = new THREE.Mesh(new RoundedBoxGeometry(1.56, 1.36, 0.46, seg, 0.11), shellMat);
  front.position.set(0, HC, 0.12); head.add(front);
  // parte de atrás del tubo (cónica)
  const backG = new RoundedBoxGeometry(1.36, 1.16, 0.62, seg, 0.14);
  { const p = backG.attributes.position; for (let i = 0; i < p.count; i++) { const z = p.getZ(i); if (z < 0) { const k = 1 + z * 0.75; p.setX(i, p.getX(i) * k); p.setY(i, p.getY(i) * k); } } backG.computeVertexNormals(); }
  const back = new THREE.Mesh(backG, darkMat); back.position.set(0, HC + 0.02, -0.28); head.add(back);
  // marco negro interior
  const rr = (w, h, r) => { const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
  const bez = new THREE.Mesh(new THREE.ExtrudeGeometry(rr(1.36, 1.1, 0.14), { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2, curveSegments: 6 }), blackMat);
  bez.position.set(0, HC + 0.05, 0.33); head.add(bez);
  // pantalla curva con shader
  const scrG = new THREE.PlaneGeometry(1.26, 1.02, 24, 20);
  { const p = scrG.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) / 0.63, y = p.getY(i) / 0.51; p.setZ(i, 0.055 * (1 - x * x * 0.85) * (1 - y * y * 0.85)); } scrG.computeVertexNormals(); }
  const logoCv = document.createElement('canvas'); logoCv.width = 256; logoCv.height = 208;
  const logoTex = new THREE.CanvasTexture(logoCv);
  const symCv = document.createElement('canvas'); symCv.width = 256; symCv.height = 208;
  const symTex = new THREE.CanvasTexture(symCv);
  const screenMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uLook: { value: new THREE.Vector2() }, uBlink: { value: 0 }, uMode: { value: 0 }, uBar: { value: 0 }, uLogo: { value: logoTex }, uWake: { value: 0 }, uFaceA: { value: 0 }, uFaceB: { value: 0 }, uFaceMix: { value: 1 }, uSym: { value: symTex }, uSymAmt: { value: 0 }, uGlitch: { value: 0 }, uBroken: { value: 0 }, uImpact: { value: new THREE.Vector2(0.12, 0.08) } },
    vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: `
      uniform float uTime,uBlink,uMode,uBar,uWake,uFaceA,uFaceB,uFaceMix,uSymAmt,uGlitch,uBroken; uniform vec2 uLook,uImpact; uniform sampler2D uLogo,uSym;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      float rbox(vec2 p, vec2 b, float r){ vec2 q=abs(p)-b+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r; }
      float h1(float n){ return fract(sin(n*127.1)*43758.5453); }
      float h2(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
      vec2 h22(vec2 p){ return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
      float dot2(vec2 v){ return dot(v,v); }
      float sdHeart(vec2 p){ p.x=abs(p.x); if(p.y+p.x>1.) return sqrt(dot2(p-vec2(.25,.75)))-sqrt(2.)/4.; return sqrt(min(dot2(p-vec2(0.,1.)), dot2(p-.5*max(p.x+p.y,0.))))*sign(p.x-p.y); }
      const vec3 GL = vec3(.55,.68,1.);
      // 0 normal 1 feliz 2 enojada 3 aburrida 4 sorprendida 5 enamorada 6 dormida 7 confundida
      vec3 face(float id, vec2 p, vec2 c, float side){
        vec2 e = p - c;
        float bl = (id>5.5 && id<6.5) ? 0. : uBlink;
        vec2 eb = vec2(e.x, e.y/max(1.-bl,.07));
        float d = length(eb);
        vec3 W = vec3(1.3,1.32,1.36);
        if(id<.5){
          float core=smoothstep(.112,.096,d);
          vec3 cc=mix(W, vec3(.78,.84,.98), smoothstep(.03,.11,d));
          return cc*core + GL*exp(-d*d*36.)*.55*(1.-bl*.8);
        }
        if(id<1.5){
          vec2 h=e+vec2(0.,.03); float arc=max(abs(length(h)-.085)-.018, -h.y);
          return W*smoothstep(.008,-.004,arc) + GL*exp(-pow(abs(length(h)-.085),2.)*700.)*.25*step(0.,h.y);
        }
        if(id<2.5){ // enojada: ojo cortado en diagonal + rojo
          float core=smoothstep(.112,.096,d);
          float cut=smoothstep(.006,-.006, eb.y - (.0 - side*eb.x*.75));
          vec3 R=vec3(1.45,.42,.36);
          return R*core*cut + vec3(1.,.25,.2)*exp(-d*d*30.)*.5*(.6+.4*cut);
        }
        if(id<3.5){ // aburrida: párpado a media asta, mira abajo
          vec2 f=vec2(e.x, e.y+.035); f.y/=max(1.-bl,.07); float dd=length(f);
          float core=smoothstep(.104,.09,dd)*smoothstep(.006,-.006, f.y-.0);
          float lid=smoothstep(.012,0.,abs(f.y))*step(abs(f.x),.1);
          return W*max(core,lid*.9) + GL*exp(-dd*dd*40.)*.3;
        }
        if(id<4.5){ // sorprendida: aros grandes con puntito
          float ring=smoothstep(.022,.008,abs(d-.115)); float dotc=smoothstep(.04,.03,d);
          return W*max(ring,dotc) + GL*exp(-d*d*20.)*.45;
        }
        if(id<5.5){ // enamorada: corazones que laten
          float beat=1.+.12*pow(abs(sin(uTime*3.2)),6.);
          vec2 q=e/(.24*beat)*vec2(1.,1.)+vec2(0.,.5);
          float hd=sdHeart(q);
          vec3 P=vec3(1.5,.45,.75);
          return P*smoothstep(.03,-.03,hd) + vec3(1.,.3,.6)*exp(-max(hd,0.)*9.)*.4;
        }
        if(id<6.5){ // dormida: rayita curva
          vec2 h=e-vec2(0.,.02); float arc=max(abs(length(h)-.085)-.014, h.y);
          return W*.9*smoothstep(.008,-.004,arc);
        }
        // confundida: uno chico, uno grande y un poco más arriba
        float r = side<0. ? .07 : .125; vec2 ec = side<0. ? eb+vec2(0.,.02) : eb-vec2(0.,.03);
        float dc=length(ec); float core=smoothstep(r,r-.016,dc);
        return W*core + GL*exp(-dc*dc*30.)*.5;
      }
      vec3 eyes(float id, vec2 p, vec2 lk){
        float sp = (id>6.5) ? .225 : .215;
        return face(id,p,vec2(-sp,.035)+lk,-1.) + face(id,p,vec2(sp,.035)+lk,1.);
      }
      void main(){
        vec2 uv0 = vUv;
        // glitch: líneas desplazadas
        float row = floor(uv0.y*38.); float gt = floor(uTime*18.);
        float gs = step(1.-uGlitch*.55, h1(row+gt*7.1)) * (h1(row*3.3+gt)-.5) * .16 * uGlitch;
        vec2 uv = vec2(uv0.x+gs, uv0.y);
        vec2 p = (uv-.5)*vec2(1.26,1.02);
        vec2 p0 = (uv0-.5)*vec2(1.26,1.02);
        float ed = rbox(p0, vec2(.63,.51), .13);
        vec3 col = vec3(.016,.018,.022);
        col += vec3(.025,.03,.04)*(1.-smoothstep(0.,.62,length(p0*vec2(.85,1.))));
        vec2 lk = uLook*vec2(.13,.085);
        vec3 ey = mix(eyes(uFaceA,p,lk), eyes(uFaceB,p,lk), uFaceMix);
        // ojos que se mueren al romperse
        float alive = 1.-uBroken;
        float dying = uBroken*step(.93, h1(floor(uTime*9.)))*step(uBroken,.995);
        ey.r += ey.r*gs*6.;  // corrimiento de color en glitch
        col += ey*(1.-uMode)*uWake*max(alive, dying*.6);
        // modo logo
        col += vec3(1.15)*texture2D(uLogo, uv).r*uMode;
        float bar = step(abs(p.y-.37),.017)*step(-.5,p.x)*step(p.x,-.5+.36*uBar);
        col += vec3(.45,.52,1.)*bar*uMode;
        // símbolos (Zzz, ?, !)
        col += vec3(1.1,1.12,1.2)*texture2D(uSym, uv).r*uSymAmt*(1.-uMode)*alive;
        // estática
        float sn = h2(floor(uv0*vec2(220.,180.))+floor(uTime*24.)*vec2(1.3,2.1));
        col += sn*(.035*(1.-uWake*.85) + .32*uGlitch*h1(row+gt) + .22*uBroken*(.6+.4*sin(uTime*13.)));
        col = mix(col, vec3(.9)*sn, uGlitch*.18*step(.75,h1(gt*1.7)));
        // scanlines + banda + parpadeo
        col *= .9+.1*sin(uv0.y*520.);
        col += vec3(.02,.025,.03)*smoothstep(.0,.08,fract(uv0.y*.6-uTime*.12))*smoothstep(.16,.08,fract(uv0.y*.6-uTime*.12));
        col *= .985+.015*sin(uTime*60.);
        col *= mix(.35, 1., smoothstep(.0,-.16,ed));
        // vidrio
        vec3 n = normalize(vN), v = normalize(vV);
        vec3 r = reflect(-v, n);
        float fres = pow(1.-max(dot(n,v),0.), 3.);
        float win = smoothstep(.25,.75,r.y)*smoothstep(.9,.2,abs(r.x+.25));
        // vidrio roto: rajaduras radiales + anillos (voronoi en coordenadas polares)
        if(uBroken>.01){
          vec2 q = p0-uImpact; float rr=length(q); float an=atan(q.y,q.x);
          vec2 g = vec2(an*1.7+sin(rr*9.)*.25, log(rr+.02)*1.5);
          vec2 gi=floor(g), gf=fract(g); float d1=8., d2=8.; vec2 cid=vec2(0.);
          for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){ vec2 o=vec2(float(i),float(j)); vec2 pt=o+h22(gi+o)*.85; float dd=length(gf-pt); if(dd<d1){d2=d1; d1=dd; cid=gi+o;} else if(dd<d2) d2=dd; }
          float crack = smoothstep(.07,.0,d2-d1) * smoothstep(.85,.02,rr) * uBroken;
          float shard = h2(cid);
          col *= 1.-.35*uBroken*smoothstep(.0,.35,rr)*step(.7,shard);
          col += vec3(.85,.9,1.)*crack*.8;
          col += vec3(1.)*smoothstep(.05,.0,rr)*uBroken*.7;
          win *= .5+shard;
          fres += .25*crack;
        }
        col += vec3(.75,.8,.9)*(.035*win + .25*fres);
        col += vec3(1.)*.05*smoothstep(.02,0.,abs(p0.x+p0.y*.6+.35))*smoothstep(.0,-.1,ed);
        col *= smoothstep(.004,-.004,ed);
        gl_FragColor = vec4(col,1.);
      }`,
    toneMapped: false,
  });
  const screen = new THREE.Mesh(scrG, screenMat); screen.position.set(0, HC + 0.05, 0.37); head.add(screen);
  // LEDs abajo a la derecha
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x6f86ff, toneMapped: false });
  const led = new THREE.Mesh(new THREE.CircleGeometry(0.014, 12), ledMat); led.position.set(0.18, HC - 0.6, 0.351); head.add(led);
  for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.045, 0.012), blackMat); d.position.set(0.26 + i * 0.065, HC - 0.6, 0.351); head.add(d); }
  // "orejas" laterales
  const earG = new THREE.CylinderGeometry(0.17, 0.17, 0.09, 24); earG.rotateZ(Math.PI / 2);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(earG, blackMat); ear.position.set(sx * 0.81, HC - 0.02, -0.02); head.add(ear);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 18).rotateZ(Math.PI / 2), darkMat); cap.position.set(sx * 0.85, HC - 0.02, -0.02); head.add(cap);
  }
  // cuello mecánico (anillo) para tapar el corte del cuello de la foto
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.6, metalness: 0.2 })); ring.position.set(0, 0.0, -0.05); pivot.add(ring);

  // cables (tubos que se recalculan cada cuadro)
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: 0.38, metalness: 0.1 });
  const cables = [];
  const NS = 44, RS = 6;
  function makeCable(local, end, sag, r) {
    const pos = new Float32Array(NS * RS * 3), nor = new Float32Array(NS * RS * 3), idx = [];
    for (let i = 0; i < NS - 1; i++) for (let j = 0; j < RS; j++) { const a = i * RS + j, b = i * RS + (j + 1) % RS, c = a + RS, d = b + RS; idx.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, cableMat); m.frustumCulled = false; scene.add(m);
    cables.push({ local: new THREE.Vector3(...local), end: new THREE.Vector3(...end), sag: new THREE.Vector3(...sag), r, g, pos, nor });
  }
  makeCable([-0.74, HC + 0.32, -0.05], [-0.42, -1.8, 0.3], [-1.05, -0.35, 0.35], 0.013);
  makeCable([-0.70, HC + 0.02, -0.25], [-1.3, -1.75, 0.2], [-0.45, -0.75, 0.4], 0.011);
  makeCable([-0.55, HC - 0.5, -0.15], [0.12, -1.85, 0.32], [-0.7, -0.95, 0.4], 0.012);
  makeCable([0.74, HC + 0.38, -0.08], [0.95, -1.8, 0.25], [0.3, -0.55, 0.45], 0.013);
  makeCable([0.6, HC - 0.48, -0.2], [-0.08, -1.85, 0.35], [0.75, -0.85, 0.45], 0.011);
  makeCable([0.72, HC + 0.08, -0.3], [1.4, -1.45, 0.15], [1.15, -0.05, 0.25], 0.012);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _p = new THREE.Vector3(), _t = new THREE.Vector3(), _n = new THREE.Vector3(), _bn = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1);
  const _out = new THREE.Vector3();
  function bez3(p0, p1, p2, p3, t, o) { const u = 1 - t; return o.set(0, 0, 0).addScaledVector(p0, u * u * u).addScaledVector(p1, 3 * u * u * t).addScaledVector(p2, 3 * u * t * t).addScaledVector(p3, t * t * t); }
  function updateCables(time) {
    head.updateMatrixWorld(true);
    cables.forEach((c, ci) => {
      _a.copy(c.local).applyMatrix4(head.matrixWorld);
      _out.copy(c.local).setY(c.local.y - 0.25).add(new THREE.Vector3(Math.sign(c.local.x) * 0.25, 0, 0.05)).applyMatrix4(head.matrixWorld);
      _b.copy(_out);
      _c.copy(c.sag); _c.x += 0.03 * Math.sin(time * 0.9 + ci); _c.y += 0.02 * Math.sin(time * 1.3 + ci);
      let k = 0;
      for (let i = 0; i < NS; i++) {
        const t = i / (NS - 1);
        bez3(_a, _b, _c, c.end, t, _p);
        bez3(_a, _b, _c, c.end, Math.min(1, t + 0.01), _t); _t.sub(_p);
        if (_t.lengthSq() < 1e-10) _t.set(0, -1, 0); _t.normalize();
        _n.crossVectors(_t, _up).normalize(); _bn.crossVectors(_n, _t);
        for (let j = 0; j < RS; j++) {
          const a = (j / RS) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
          const nx = _n.x * ca + _bn.x * sa, ny = _n.y * ca + _bn.y * sa, nz = _n.z * ca + _bn.z * sa;
          c.pos[k] = _p.x + nx * c.r; c.nor[k++] = nx; c.pos[k] = _p.y + ny * c.r; c.nor[k++] = ny; c.pos[k] = _p.z + nz * c.r; c.nor[k++] = nz;
        }
      }
      c.g.attributes.position.needsUpdate = true; c.g.attributes.normal.needsUpdate = true;
    });
  }

  // logo en pantalla: ∅ + nada
  function drawLogo(text) {
    const g = logoCv.getContext('2d'); g.clearRect(0, 0, 256, 208); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 208);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.lineCap = 'round';
    if (!text) { g.lineWidth = 13; g.beginPath(); g.arc(128, 100, 44, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(72, 156); g.lineTo(184, 44); g.stroke(); }
    else { g.font = '400 44px "Archivo Black"'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 104); }
    logoTex.needsUpdate = true;
  }
  drawLogo();

  // estado
  const st = { yaw: 0, pitch: 0, vy: 0, vp: 0, look: new THREE.Vector2(), blink: 0, nextBlink: 1.5, blinkT: -1, happy: 0, happyT: 0, mode: 0, modeT: 0, bar: 0, wake: 0 };
  const headScreen = new THREE.Vector3();
  function layout(w, h) {
    const a = w / h; cam.aspect = a;
    let Hv, cx;
    if (a >= 1) { Hv = 3.95; cx = -0.11 * Hv * a; }
    else { const Vw = 2.45; Hv = Vw / a; cx = 0; }
    const d = (Hv / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    cam.position.set(cx, -1.42 + Hv / 2, d); cam.lookAt(cx, -1.42 + Hv / 2, 0);
    cam.near = d * 0.3; cam.far = d * 3; cam.updateProjectionMatrix();
  }
  function say(kind) { st.mode = 1; st.modeT = 2.4; st.bar = 0; if (kind) drawLogo(kind === 'tienda' ? 'PRONTO' : null); else drawLogo(); }
  // ---- caras, glitch, rotura ----
  const FACES = { normal: 0, feliz: 1, enojada: 2, aburrida: 3, sorprendida: 4, enamorada: 5, dormida: 6, confundida: 7 };
  const SYMS = { dormida: 'Zzz', confundida: '?', sorprendida: '!', enojada: '#@!' };
  const fx = { a: 0, b: 0, mix: 1, name: 'normal', until: 0, sym: 0, glitch: 0, glitchT: 0, shake: 0, broken: 0, brokenT: 0, isBroken: false, lastAct: 0, nextIdle: 10, sleeping: false, spark: 0 };
  function drawSym(t) {
    const g = symCv.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 256, 208);
    if (t) { g.fillStyle = '#fff'; g.font = '400 ' + (t.length > 2 ? 30 : 38) + 'px "Archivo Black"'; g.textAlign = 'right'; g.textBaseline = 'top'; g.fillText(t, 226, 22); }
    symTex.needsUpdate = true;
  }
  drawSym('');
  function setFace(name, dur = 3) {
    if (!(name in FACES)) name = 'normal';
    const now2 = clock.elapsedTime; fx.lastAct = now2;
    fx.until = name === 'normal' ? 0 : now2 + dur;
    if (name !== fx.name) {
      fx.a = fx.mix > 0.5 ? fx.b : fx.a; fx.b = FACES[name]; fx.mix = 0; fx.name = name;
      drawSym(SYMS[name] || ''); fx.sym = SYMS[name] ? 1 : 0;
    }
    if (name !== 'dormida') fx.sleeping = false;
  }
  function glitch(a, d = 0.8) { fx.glitch = Math.max(fx.glitch, a); fx.glitchT = d; }
  function shake(a) { fx.shake = Math.max(fx.shake, a); }
  function breakTV() {
    fx.isBroken = true; fx.brokenT = 0; glitch(1, 1.2); shake(1); setFace('sorprendida', 0.4);
    screenMat.uniforms.uImpact.value.set((Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.35);
    burst(40);
  }
  function repair() { fx.isBroken = false; glitch(0.6, 0.6); say(); setTimeout(() => setFace('enojada', 3), 2200); }
  // chispas
  const NSP = 70, spPos = new Float32Array(NSP * 3), spCol = new Float32Array(NSP * 3), spVel = new Float32Array(NSP * 3), spLife = new Float32Array(NSP);
  for (let i = 0; i < NSP; i++) spPos[i * 3 + 1] = -999;
  const spG = new THREE.BufferGeometry(); spG.setAttribute('position', new THREE.BufferAttribute(spPos, 3)); spG.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
  const sparks = new THREE.Points(spG, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, depthWrite: false, toneMapped: false }));
  sparks.frustumCulled = false; head.add(sparks);
  let spI = 0;
  function burst(n) {
    const im = screenMat.uniforms.uImpact.value;
    for (let k = 0; k < n; k++) {
      const i = spI++ % NSP; const fromEdge = Math.random() < 0.45;
      const x = fromEdge ? (Math.random() < 0.5 ? -0.66 : 0.66) : im.x, y = fromEdge ? HC + (Math.random() - 0.3) * 0.9 : HC + 0.05 + im.y;
      spPos[i * 3] = x; spPos[i * 3 + 1] = y; spPos[i * 3 + 2] = 0.42;
      const a = Math.random() * Math.PI * 2, sp = 0.6 + Math.random() * 1.6;
      spVel[i * 3] = Math.cos(a) * sp * 0.8; spVel[i * 3 + 1] = Math.abs(Math.sin(a)) * sp + 0.4; spVel[i * 3 + 2] = 0.3 + Math.random() * 0.8;
      spLife[i] = 0.5 + Math.random() * 0.6;
    }
  }
  function updateSparks(dt) {
    for (let i = 0; i < NSP; i++) {
      if (spLife[i] <= 0) { spPos[i * 3 + 1] = -999; continue; }
      spLife[i] -= dt; spVel[i * 3 + 1] -= 4.2 * dt;
      spPos[i * 3] += spVel[i * 3] * dt; spPos[i * 3 + 1] += spVel[i * 3 + 1] * dt; spPos[i * 3 + 2] += spVel[i * 3 + 2] * dt;
      const l = Math.max(0, Math.min(1, spLife[i] * 1.6));
      spCol[i * 3] = 1.0; spCol[i * 3 + 1] = 0.45 + 0.5 * l * l; spCol[i * 3 + 2] = 0.1 + 0.6 * l * l * l;
    }
    spG.attributes.position.needsUpdate = true; spG.attributes.color.needsUpdate = true;
  }
  function updateFx(dt, time) {
    fx.mix = Math.min(1, fx.mix + dt * 5);
    if (fx.until && time > fx.until && !fx.isBroken) setFace(fx.sleeping ? 'dormida' : 'normal');
    // caras al azar y siesta
    const idleFor = Math.min(now() - ptr.t, time - fx.lastAct);
    if (!fx.isBroken && fx.name === 'normal' && st.mode < 0.05) {
      if (idleFor > 28 && !fx.sleeping) { fx.sleeping = true; setFace('dormida', 1e6); }
      else if (time - fx.lastAct > fx.nextIdle) { fx.nextIdle = 9 + Math.random() * 9; setFace(['aburrida', 'confundida', 'sorprendida', 'feliz', 'enamorada'][Math.floor(Math.random() * 5)], 1.8); }
    }
    if (fx.sleeping && now() - ptr.t < 0.5 && time > 2) { fx.sleeping = false; setFace('sorprendida', 1.4); }
    fx.glitchT -= dt; if (fx.glitchT <= 0) fx.glitch = Math.max(0, fx.glitch - dt * 2.5);
    fx.shake = Math.max(0, fx.shake - dt * 1.8);
    fx.broken += ((fx.isBroken ? 1 : 0) - fx.broken) * Math.min(1, dt * (fx.isBroken ? 10 : 3));
    if (fx.isBroken) { fx.brokenT += dt; fx.spark -= dt; if (fx.spark <= 0) { fx.spark = 0.25 + Math.random() * 1.1; burst(4 + Math.floor(Math.random() * 10)); if (Math.random() < 0.4) glitch(0.5, 0.15); } }
    updateSparks(dt);
    const u = screenMat.uniforms;
    u.uFaceA.value = fx.a; u.uFaceB.value = fx.b; u.uFaceMix.value = fx.mix;
    u.uSymAmt.value += ((fx.sym && !fx.isBroken ? 1 : 0) * (0.75 + 0.25 * Math.sin(time * 3)) - u.uSymAmt.value) * Math.min(1, dt * 6);
    u.uGlitch.value = Math.min(1, fx.glitch + (fx.isBroken ? 0.12 : 0)); u.uBroken.value = fx.broken;
  }
  function poke() { glitch(0.15, 0.2); }
  function update(dt, time, rect) {
    // a dónde mira: puntero relativo a la cabeza en pantalla
    headScreen.set(0, NECK.y + HC, 0.4).project(cam);
    const hx = rect.left + (headScreen.x * 0.5 + 0.5) * rect.width, hy = rect.top + (-headScreen.y * 0.5 + 0.5) * rect.height;
    let tx = (ptr.x - hx) / (rect.width * 0.5), ty = -(ptr.y - hy) / (rect.height * 0.5);
    const idle = now() - ptr.t > 3.5;
    if (idle) { tx = Math.sin(time * 0.37) * 0.55 + Math.sin(time * 0.91) * 0.2; ty = Math.sin(time * 0.53 + 1) * 0.3; }
    tx = THREE.MathUtils.clamp(tx, -1.3, 1.3); ty = THREE.MathUtils.clamp(ty, -1.2, 1.2);
    const tyaw = tx * 0.42, tpitch = -ty * 0.2;
    // resorte suave
    const k = 26, damp = 8.5;
    st.vy += ((tyaw - st.yaw) * k - st.vy * damp) * dt; st.yaw += st.vy * dt;
    st.vp += ((tpitch - st.pitch) * k - st.vp * damp) * dt; st.pitch += st.vp * dt;
    head.rotation.set(st.pitch, st.yaw, -st.yaw * 0.08 + Math.sin(time * 0.8) * 0.01);
    head.position.y = Math.sin(time * 1.1) * 0.006;
    if (fx.shake > 0) { const a = fx.shake * fx.shake * 0.05; head.position.x = (Math.random() - 0.5) * a; head.position.y += (Math.random() - 0.5) * a; head.rotation.z += (Math.random() - 0.5) * a; } else head.position.x = 0;
    if (fx.isBroken) { head.rotation.x = st.pitch * 0.3 + 0.12; head.rotation.z += 0.06; }
    st.look.lerp(new THREE.Vector2(THREE.MathUtils.clamp(tx * 0.9, -1, 1), THREE.MathUtils.clamp(ty * 0.9, -1, 1)), 1 - Math.exp(-dt * 10));
    // parpadeo
    st.nextBlink -= dt;
    if (st.nextBlink <= 0 && st.blinkT < 0) { st.blinkT = 0; st.nextBlink = 2.2 + Math.random() * 3.2; if (Math.random() < 0.2) st.nextBlink = 0.32; }
    if (st.blinkT >= 0) { st.blinkT += dt; const b = st.blinkT / 0.16; st.blink = b < 0.5 ? b * 2 : Math.max(0, 2 - b * 2); if (b >= 1) { st.blinkT = -1; st.blink = 0; } }
    st.modeT -= dt; const m = st.modeT > 0 ? 1 : 0; st.mode += (m - st.mode) * Math.min(1, dt * 14); if (m) st.bar = Math.min(1, st.bar + dt * 0.7);
    st.wake = Math.min(1, st.wake + dt * 0.9);
    const u = screenMat.uniforms; u.uTime.value = time; u.uLook.value.copy(st.look); u.uBlink.value = st.blink; u.uMode.value = st.mode; u.uBar.value = st.bar; u.uWake.value = st.wake < 0.35 ? (Math.random() < 0.5 ? 0.2 : 1) * st.wake : st.wake;
    ledMat.color.setHSL(0.63, 0.9, 0.62 + 0.08 * Math.sin(time * 3));
    bgMat.uniforms.uShadow.value.set(Math.sin(st.yaw) * 0.12, 0, 1); bgMat.uniforms.uTime.value = time % 10;
    updateFx(dt, time);
    updateCables(time);
  }
  // tocar la tele
  function hitHead(x, y, rect) {
    headScreen.set(0, NECK.y + HC, 0.4).project(cam);
    const hx = rect.left + (headScreen.x * 0.5 + 0.5) * rect.width, hy = rect.top + (-headScreen.y * 0.5 + 0.5) * rect.height;
    const r = rect.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)) * cam.position.z) * 0.8;
    return Math.hypot(x - hx, y - hy) < r;
  }
  return { scene, cam, layout, update, say, poke, hitHead, setFace, glitch, shake, breakTV, repair, fx, loaded: false };
})();

/* =====================================================================
   2) NADA: letras gigantes + tinta que se derrite + relleno orgánico
   ===================================================================== */
const ink = (() => {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const textCv = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(textCv); tex.colorSpace = THREE.NoColorSpace; tex.minFilter = THREE.LinearFilter; tex.generateMipmaps = false;
  const uni = { uText: { value: tex }, uTexel: { value: new THREE.Vector2() }, uRes: { value: new THREE.Vector2(1, 1) }, uTime: { value: 0 }, uCover: { value: 0 }, uSweep: { value: 0 }, uPtr: { value: new THREE.Vector2(9, 9) }, uPtrAmt: { value: 0 }, uCell: { value: 12 }, uTrail: { value: new THREE.Vector2(9, 9) } };
  let mat;
  function makeMat() {
    mat = new THREE.ShaderMaterial({
      uniforms: uni, toneMapped: false, depthTest: false, depthWrite: false,
      defines: { OCT: Q().oct },
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform sampler2D uText; uniform vec2 uTexel, uRes, uPtr, uTrail; uniform float uTime, uCover, uSweep, uPtrAmt, uCell;
        varying vec2 vUv;
        ${GLSL_NOISE}
        float hgt(vec2 uv){ vec3 t=texture2D(uText,uv).rgb; float a=smoothstep(.42,.98,t.g), b=smoothstep(.3,.9,t.b); return sqrt(clamp(a*.45+b*.55,0.,1.))*t.r; }
        vec3 studio(vec3 r){
          float y=r.y+.3*r.z;
          vec3 c=mix(vec3(.05,.05,.06), vec3(.9,.91,.94), smoothstep(-.5,.5,y));
          c *= 1.-.5*exp(-pow((r.x-.2)*4.5,2.))*smoothstep(.2,.9,r.z);
          c += .55*smoothstep(.6,.95,r.y)*(.7+.3*sin(r.x*5.));
          c += vec3(1.,.82,.84)*.55*exp(-pow((r.x+.6)*3.2,2.))*smoothstep(-.4,.3,y);
          c += vec3(.9,.93,1.)*.5*exp(-pow((r.x-.65)*3.5,2.));
          c *= 1.-.85*exp(-pow((r.y+.18)*5.5,2.))*smoothstep(.95,.5,r.z);
          return c;
        }
        void main(){
          vec2 uv=vUv; float asp=uRes.x/uRes.y;
          vec2 p=(uv-.5)*vec2(asp,1.);
          float t=uTime;
          // ---- tinta ----
          vec2 w=vec2(fbm(p*1.5+vec2(0.,t*.06)), fbm(p*1.5+vec2(5.2,-t*.05)));
          vec2 q=p+(w-.5)*1.0;
          float rag=(fbm(q*4.2+vec2(t*.04,0.))-.5)*.6;
          float base=uCover*1.5-.5-length(q*vec2(.5/max(asp*.6,.6),1.25));
          float f=base+rag;
          float pd=length(p-uPtr+(w-.5)*.35); float td=length(p-uTrail+(w-.5)*.35);
          f=max(f, ((.17-pd)*1.6+rag*.5)*uPtrAmt-(1.-uPtrAmt));
          f=max(f, ((.12-td)*1.6+rag*.5)*uPtrAmt-(1.-uPtrAmt));
          // salpicaduras
          float band=smoothstep(-.45,0.,f)*smoothstep(0.,.25,uCover+uPtrAmt*.3);
          float dn=noise(p*15.+3.)*.65+noise(p*34.+9.)*.35;
          float drop=dn-1.04+band*.38;
          float aa=fwidth(f)*1.3+1e-4, aa2=fwidth(drop)*1.3+1e-4;
          float inkM=max(smoothstep(-aa,aa,f), smoothstep(-aa2,aa2,drop));
          // brillo líquido en el borde de la tinta
          vec2 gr=vec2(dFdx(f),dFdy(f)); vec2 gn=normalize(gr+1e-6);
          float rim=smoothstep(0.,.035,f)*(1.-smoothstep(.035,.14,f));
          vec3 inkCol=vec3(.012,.012,.014)+vec3(.5)*rim*max(dot(-gn,normalize(vec2(-.5,.85))),0.)*.45;
          // ---- letras ----
          vec4 tx=texture2D(uText,uv); float mask=tx.r;
          float h=hgt(uv);
          vec2 e=uTexel*1.5;
          float hx=hgt(uv+vec2(e.x,0.))-hgt(uv-vec2(e.x,0.));
          float hy=hgt(uv+vec2(0.,e.y))-hgt(uv-vec2(0.,e.y));
          vec3 n=normalize(vec3(-hx*2.2,-hy*2.2,1.));
          vec3 v=vec3(0.,0.,1.);
          // cromo (globo metalizado con arruguitas)
          vec2 sp=uv*uRes;
          vec3 nc=normalize(n+vec3((noise(sp/26.)-.5)*.5,(noise(sp/26.+7.)-.5)*.5,0.)*(.35+.65*(1.-h)));
          vec3 rc=reflect(-v,nc);
          vec3 chrome=studio(rc)*vec3(.93,.93,.96);
          chrome*= .55+.45*smoothstep(0.,.35,h);
          // glaseado rosa con granitos (orgánico)
          vec3 L=normalize(vec3(-.45,.6,.75));
          vec2 cs=sp/uCell; vec2 ci=floor(cs), cf=fract(cs);
          float hh=hash(ci), hb=hash(ci+17.3);
          vec2 pt=vec2(.28+.44*hash(ci+3.1), .28+.44*hash(ci+8.7));
          float rad=.16+.14*hh; vec2 dv=(cf-pt)/rad; float dd=length(dv);
          float dotm=smoothstep(1.,.75,dd)*step(hb,.8);
          vec3 n2=normalize(n+vec3(dv*.9*dotm,0.)+vec3((noise(sp/9.)-.5)*.25,(noise(sp/9.+4.)-.5)*.25,0.));
          float dif=max(dot(n2,L),0.)*.75+.42;
          vec3 baseC=mix(vec3(.93,.45,.47), vec3(.8,.3,.33), noise(sp/60.));
          vec3 pink=mix(baseC, vec3(.52,.07,.11), dotm)*dif;
          pink+=vec3(1.,.92,.92)*pow(max(dot(reflect(-L,n2),v),0.),22.)*(.6+.3*dotm);
          pink+=vec3(1.,.95,.95)*.35*smoothstep(.75,.95,studio(reflect(-v,n2)).r)*.6;
          pink+=vec3(1.,.6,.6)*pow(1.-n2.z,2.)*.12;
          pink*= .45+.55*smoothstep(0.,.45,h);
          float ms=smoothstep(-.07,.07,(uSweep*3.2-1.6)-p.x*.9+(fbm(p*2.6+3.)-.5)*.6);
          vec3 puffy=mix(chrome,pink,ms);
          // ---- composición ----
          vec3 white=vec3(.957,.957,.948);
          vec3 flatC=mix(white, vec3(.035), mask);
          vec3 inside=mix(inkCol, puffy, mask);
          vec3 col=mix(flatC, inside, inkM);
          col+=(hash(gl_FragCoord.xy+fract(t)*91.)-.5)*.018;
          gl_FragColor=vec4(col,1.);
        }`,
    });
  }
  makeMat();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false; scene.add(quad);
  let built = '';
  function build(rw, rh) {
    rw = rw || this_rw; rh = rh || this_rh; this_rw = rw; this_rh = rh;
    const s = Math.min(Q().ink * Math.min(devicePixelRatio, Q().dpr), 2);
    const tw = Math.max(256, Math.round(rw * s)), th = Math.max(256, Math.round(rh * s));
    const key = tw + 'x' + th + level;
    if (key === built) return; built = key;
    const portrait = rw / rh < 0.85;
    const lines = portrait ? ['NA', 'DA'] : ['NADA'];
    // medir
    const m = document.createElement('canvas').getContext('2d');
    m.font = '400 100px "Archivo Black"';
    const wid = Math.max(...lines.map(l => m.measureText(l).width));
    const fs = (tw * (portrait ? 1.06 : 1.04)) / wid * 100;
    const lh = fs * 0.84;
    const draw = (ctx, blur) => {
      ctx.save(); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, tw, th); ctx.filter = blur ? `blur(${blur}px)` : 'none';
      ctx.fillStyle = '#fff'; ctx.font = `400 ${fs}px "Archivo Black"`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.letterSpacing = (-fs * 0.03) + 'px';
      const total = lh * lines.length; const top = th / 2 - total / 2 + (portrait ? -th * 0.02 : th * 0.03);
      lines.forEach((l, i) => ctx.fillText(l, tw / 2, top + lh * (i + 0.86)));
      ctx.restore();
    };
    const mk = () => { const c = document.createElement('canvas'); c.width = tw; c.height = th; return c; };
    const A = mk(), B = mk(), C = mk();
    draw(A.getContext('2d'), 0); draw(B.getContext('2d'), fs * 0.04); draw(C.getContext('2d'), fs * 0.11);
    textCv.width = tw; textCv.height = th;
    const out = textCv.getContext('2d');
    const da = A.getContext('2d').getImageData(0, 0, tw, th).data, db = B.getContext('2d').getImageData(0, 0, tw, th).data, dc = C.getContext('2d').getImageData(0, 0, tw, th).data;
    const img = out.createImageData(tw, th), o = img.data;
    for (let i = 0; i < o.length; i += 4) { o[i] = da[i]; o[i + 1] = db[i]; o[i + 2] = dc[i]; o[i + 3] = 255; }
    out.putImageData(img, 0, 0);
    tex.dispose(); tex.image = textCv; tex.needsUpdate = true;
    uni.uTexel.value.set(1 / tw, 1 / th);
    uni.uCell.value = Math.max(5, fs * 0.05);
  }
  let this_rw = 1, this_rh = 1;
  const sm = { cover: 0, sweep: 0, ptrAmt: 0, px: 9, py: 9, tx: 9, ty: 9 };
  function update(dt, time, rect, prog) {
    uni.uRes.value.set(rect.width, rect.height);
    uni.uTime.value = time;
    const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    const cover = ss(0.02, 0.42, prog) * 0.8 + ss(0.55, 0.8, prog) * 0.08 + Math.sin(time * 0.6) * 0.02 - ss(0.88, 1.0, prog) * 0.4;
    const sweep = ss(0.36, 0.78, prog);
    const k = 1 - Math.exp(-dt * 4);
    sm.cover += (cover - sm.cover) * k; sm.sweep += (sweep - sm.sweep) * k;
    const inside = ptr.y >= rect.top && ptr.y <= rect.bottom && now() - ptr.t < 2.5;
    sm.ptrAmt += ((inside ? 1 : 0) - sm.ptrAmt) * (1 - Math.exp(-dt * 3));
    const asp = rect.width / rect.height;
    const px = ((ptr.x - rect.left) / rect.width - 0.5) * asp, py = 0.5 - (ptr.y - rect.top) / rect.height;
    if (sm.px > 8) { sm.px = px; sm.py = py; sm.tx = px; sm.ty = py; }
    sm.px += (px - sm.px) * (1 - Math.exp(-dt * 7)); sm.py += (py - sm.py) * (1 - Math.exp(-dt * 7));
    sm.tx += (sm.px - sm.tx) * (1 - Math.exp(-dt * 2.2)); sm.ty += (sm.py - sm.ty) * (1 - Math.exp(-dt * 2.2));
    uni.uCover.value = sm.cover; uni.uSweep.value = sm.sweep; uni.uPtrAmt.value = sm.ptrAmt;
    uni.uPtr.value.set(sm.px, sm.py); uni.uTrail.value.set(sm.tx, sm.ty);
  }
  function setQuality() { const old = mat; makeMat(); quad.material = mat; old.dispose(); built = ''; }
  return { scene, cam, build, update, setQuality, ready: false, uni, sm };
})();

/* =====================================================================
   3) IDEAS: objetos inflados (estrella cromada, flor azul, corazón con tachas)
   ===================================================================== */
const ideas = (() => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050506);
  scene.environment = envTex;
  const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 50); cam.position.set(0, 0, 9);
  const key = new THREE.DirectionalLight(0xffffff, 1.2); key.position.set(-3, 4, 5); scene.add(key);
  const q = Q().seg;
  function balloon(radiusFn, depth, bumps, segU, segV) {
    const g = new THREE.SphereGeometry(1, Math.round(segU * q), Math.round(segV * q));
    const p = g.attributes.position; const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const a = Math.atan2(v.y, v.x); const R = radiusFn(a);
      const rr = Math.hypot(v.x, v.y);
      let x = v.x * R, y = v.y * R, z = v.z * depth * (0.55 + 0.45 * R);
      if (bumps) { const b = bumps(v, a); x += v.x * b; y += v.y * b; z += v.z * b; }
      p.setXYZ(i, x, y, z);
    }
    g.computeVertexNormals(); return g;
  }
  // estrella cromada
  const star = new THREE.Mesh(balloon(a => 0.5 + 0.55 * Math.pow(0.5 + 0.5 * Math.cos(5 * (a - Math.PI / 2)), 2.2), 0.42,
    (v, a) => 0.012 * Math.sin(v.x * 23 + v.y * 17) * Math.sin(v.y * 19 - v.z * 13), 120, 72),
    new THREE.MeshPhysicalMaterial({ color: 0xd7d9de, metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.08 }));
  // flor azul (globo de aluminio)
  const flower = new THREE.Mesh(balloon(a => 0.42 + 0.62 * Math.pow(0.5 + 0.5 * Math.cos(8 * a), 0.65), 0.55,
    (v, a) => 0.07 * Math.cos(8 * a) * v.z + 0.015 * Math.sin(v.x * 21 + v.z * 15) * Math.cos(v.y * 18), 140, 80),
    new THREE.MeshPhysicalMaterial({ color: 0x1846ff, metalness: 1, roughness: 0.17, clearcoat: 1, clearcoatRoughness: 0.1, iridescence: 0.3 }));
  // corazón con tachas
  const heartR = (() => { const N = 720, tbl = new Float32Array(N); const pts = []; for (let i = 0; i < 2000; i++) { const t = i / 2000 * Math.PI * 2; pts.push([16 * Math.pow(Math.sin(t), 3), 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t) + 2.5]); }
    for (const [x, y] of pts) { const a = Math.atan2(y, x); const k = Math.floor(((a + Math.PI) / (Math.PI * 2)) * N) % N; tbl[k] = Math.max(tbl[k], Math.hypot(x, y) / 17); }
    for (let i = 0; i < N; i++) if (!tbl[i]) tbl[i] = tbl[(i + N - 1) % N];
    return a => tbl[Math.floor(((a + Math.PI) / (Math.PI * 2)) * N) % N]; })();
  const heart = new THREE.Mesh(balloon(heartR, 0.5, (v) => { const u = Math.atan2(v.y, v.x) * 7, w = Math.acos(THREE.MathUtils.clamp(v.z, -1, 1)) * 9; return 0.035 * Math.pow(Math.max(0, Math.sin(u * 2.3) * Math.sin(w * 2.3)), 2); }, 160, 100),
    new THREE.MeshPhysicalMaterial({ color: 0xc3c6cc, metalness: 1, roughness: 0.26, clearcoat: 0.5 }));
  const objs = [star, flower, heart];
  objs.forEach(o => scene.add(o));
  const st = { rx: 0, ry: 0 };
  function layout(w, h) {
    const a = w / h; cam.aspect = a; cam.updateProjectionMatrix();
    if (a >= 1) { star.position.set(-3.1, 0.25, 0); flower.position.set(0, -0.3, 0.6); heart.position.set(3.1, 0.15, 0); objs.forEach(o => o.scale.setScalar(1.15)); flower.scale.setScalar(1.45); }
    else { const vw = 2 * Math.tan(THREE.MathUtils.degToRad(16)) * 9 * a; const k = vw / 4.2; star.position.set(-0.85 * k, 2.1, 0); flower.position.set(0.15 * k, 0, 0.6); heart.position.set(0.8 * k, -2.1, 0); objs.forEach(o => o.scale.setScalar(0.85 * k)); flower.scale.setScalar(1.05 * k); }
  }
  function update(dt, time, rect, prog) {
    const tx = ((ptr.x - rect.left) / rect.width - 0.5) * 2, ty = ((ptr.y - rect.top) / rect.height - 0.5) * 2;
    st.ry += (tx * 0.6 - st.ry) * (1 - Math.exp(-dt * 4)); st.rx += (ty * 0.4 - st.rx) * (1 - Math.exp(-dt * 4));
    objs.forEach((o, i) => {
      o.rotation.y = st.ry + Math.sin(time * 0.5 + i * 2) * 0.35 + prog * 0.5 * (i % 2 ? -1 : 1);
      o.rotation.x = st.rx + Math.sin(time * 0.4 + i) * 0.15;
      o.rotation.z = Math.sin(time * 0.3 + i * 1.7) * 0.12;
      o.position.y += (Math.sin(time * 0.9 + i * 2.1) * 0.0025);
    });
    cam.position.y = (0.5 - prog) * 0.8;
  }
  return { scene, cam, layout, update, objs };
})();

/* ---------- vistas (un solo canvas, una tijera por sección) ---------- */
const heroEl = document.querySelector('[data-view="hero"]');
const nadaEl = document.querySelector('[data-view="nada"]');
const nadaPin = document.getElementById('nada');
const ideasEl = document.querySelector('[data-view="ideas"]');
const ideasPin = document.querySelector('.pin2');
let lastSizes = {};
function resize() {
  W = innerWidth; H = innerHeight;
  applyQuality(false);
  const hr = heroEl.getBoundingClientRect(); hero.layout(hr.width, hr.height);
  const nr = nadaEl.getBoundingClientRect(); if (ink.ready) ink.build(nr.width, nr.height);
  const ir = ideasEl.getBoundingClientRect(); ideas.layout(ir.width, ir.height);
}
let rz = 0; addEventListener('resize', () => { cancelAnimationFrame(rz); rz = requestAnimationFrame(resize); });

function renderView(scene, cam, r) {
  const top = H - r.bottom;
  renderer.setViewport(r.left, top, r.width, r.height);
  renderer.setScissor(r.left, top, r.width, r.height);
  renderer.render(scene, cam);
}
const vis = r => r.bottom > 0 && r.top < H && r.width > 0;
const pinProg = (el) => { const r = el.getBoundingClientRect(); return Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - H))); };

let frames = 0, acc = 0, adapted = false;
function frame() {
  requestAnimationFrame(frame);
  if (document.hidden) return;
  const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
  renderer.setScissorTest(true);
  const hr = heroEl.getBoundingClientRect();
  if (vis(hr)) { hero.update(dt, time, hr); renderView(hero.scene, hero.cam, hr); }
  const nr = nadaEl.getBoundingClientRect();
  if (vis(nr)) { ink.update(dt, time, nr, pinProg(nadaPin)); renderView(ink.scene, ink.cam, nr); }
  const ir = ideasEl.getBoundingClientRect();
  if (vis(ir)) { ideas.update(dt, time, ir, pinProg(ideasPin)); renderView(ideas.scene, ideas.cam, ir); }
  // calidad automática: si va lento, bajamos
  if (qName === 'auto' && !adapted && document.body.classList.contains('ready')) {
    frames++; acc += dt;
    if (frames === 90) {
      const avg = acc / frames;
      if (avg > 1 / 40 && level !== 'baja') { level = level === 'alta' ? 'media' : 'baja'; ink.setQuality(); applyQuality(true); qLabel(); frames = 0; acc = 0; }
      else adapted = true;
    }
  }
}

/* ---------- chat de T.E.L.E. ---------- */
const chatEl = document.getElementById('chatText');
const LINES = {
  hola: ['¿Otra vez vos de visita? Ya debería empezar a cobrarte entrada. ¿Necesitás algo?'],
  equipo: ['¿Querés sumarte? Mandá tu porfolio a hola@nada.estudio. Prometo no perderlo… casi nunca.'],
  trabajos: ['Bajá y mirá. Spoiler: hacemos mucho con casi nada.'],
  cultura: ['Acá trabajamos en serio y nos reímos en serio. Y el mate es sagrado.'],
  tienda: ['La tienda abre pronto. Por ahora vendo silencio, que es nada.'],
  poke: ['¡Ey! Eso me hizo cosquillas en los tubos.', 'Cuidado con la pantalla, que es vintage.', 'Si me tocás de nuevo, me reinicio.', 'Ya sé, ya sé: soy lo más lindo de esta web.'],
};
let typing = 0;
function type(text) {
  const id = ++typing; let i = 0; chatEl.textContent = '';
  const step = () => { if (id !== typing) return; chatEl.textContent = text.slice(0, ++i); if (i < text.length) setTimeout(step, 18 + Math.random() * 30); };
  step();
}
document.querySelectorAll('[data-say]').forEach(b => b.addEventListener('click', e => {
  const k = b.dataset.say; if (b.tagName === 'A') e.preventDefault();
  if (hero.fx.isBroken) return;
  type(LINES[k][0]); hero.say(k);
  if (k === 'trabajos') setTimeout(() => document.getElementById('trabajos').scrollIntoView({ behavior: 'smooth' }), 1300);
  if (b.tagName === 'A') scrollTo({ top: 0, behavior: 'smooth' });
}));

/* ---------- toques a la tele: a los 10 se rompe ---------- */
const TAPS = [
  ['¡Ey! Eso me hizo cosquillas en los tubos.', 'feliz', 0],
  ['¿Qué tocás? ¿Pensás que soy touch? Soy de 1986.', 'sorprendida', 0],
  ['Ya está, ya me saludaste. Suficiente.', 'aburrida', 0.1],
  ['¿Vos no tenés nada mejor que hacer? ¿La tarea, por ejemplo?', 'confundida', 0.2],
  ['Te estoy avisando, eh. La pantalla no es de goma.', 'enojada', 0.35],
  ['Basta. Me estás dejando las huellas en el vidrio.', 'enojada', 0.5],
  ['Uy, uy, uy… se me está desconfigurando todo.', 'enojada', 0.7],
  ['UNA más y me rompo. Hablo en serio.', 'enojada', 0.85],
  ['¡¡ÚLTIMA ADVERTENCIA!! No lo hagas…', 'sorprendida', 1],
];
const FINAL = ['Bien ahí. Rompiste lo único que funcionaba en esta web. ¿Contento?', 'Felicitaciones, campeón. Ahora la tele sos vos.', 'Listo. Me rompiste. Espero que tu celu no se entere de esto.'];
let taps = 0, lastTap = 0, finalI = 0, repairTimer = 0;
const tapsEl = document.getElementById('taps'), repairBtn = document.getElementById('repair');
function showTaps() { tapsEl.textContent = taps ? `Toques: ${taps}/10` : ''; tapsEl.classList.toggle('on', taps > 0); tapsEl.classList.toggle('hot', taps >= 7); }
function tapTV() {
  const nowT = performance.now();
  if (hero.fx.isBroken) { type(['Ya está rota. ¿Qué más querés romper?', 'Tocá “Reparar”, genio.', '¡No me toques, que me caigo a pedazos!'][Math.floor(Math.random() * 3)]); hero.shake(0.4); return; }
  if (nowT - lastTap > 6000) taps = 0;
  lastTap = nowT; taps++;
  if (taps >= 10) {
    hero.breakTV(); taps = 0; showTaps(); tapsEl.textContent = '¡Rota!'; tapsEl.classList.add('on', 'hot');
    type(FINAL[finalI++ % FINAL.length]); setMini('rota');
    setTimeout(() => repairBtn.hidden = false, 900);
    clearTimeout(repairTimer); repairTimer = setTimeout(doRepair, 15000);
    if (navigator.vibrate) navigator.vibrate([60, 40, 120]);
    return;
  }
  const [line, face, g] = TAPS[taps - 1];
  type(line); hero.setFace(face, 3.2); setMini(face);
  if (g) { hero.glitch(g, 0.35 + g * 0.6); hero.shake(g * 0.7); } else hero.poke();
  showTaps();
}
function doRepair() {
  clearTimeout(repairTimer); if (!hero.fx.isBroken) return;
  repairBtn.hidden = true; tapsEl.classList.remove('on', 'hot'); tapsEl.textContent = '';
  hero.repair(); setMini('normal');
  type('Reiniciando… Listo, como nueva. Que no se repita, ¿eh?');
}
repairBtn.addEventListener('click', e => { e.stopPropagation(); doRepair(); });
heroEl.addEventListener('click', e => {
  if (e.target.closest('button,a,#chatPanel')) return;
  if (hero.hitHead(e.clientX, e.clientY, heroEl.getBoundingClientRect())) tapTV();
});

/* ---------- chat con T.E.L.E. ---------- */
const panel = document.getElementById('chatPanel'), fab = document.getElementById('chatFab');
const log = document.getElementById('chatLog'), form = document.getElementById('chatForm'), input = document.getElementById('chatInput');
const mini = document.getElementById('mini'), mg = mini.getContext('2d');
function setMini(face) {
  const w = mini.width, h = mini.height; mg.clearRect(0, 0, w, h);
  mg.fillStyle = '#b8bcc4'; mg.beginPath(); mg.roundRect(0, 0, w, h, 9); mg.fill();
  mg.fillStyle = '#0b0c0e'; mg.beginPath(); mg.roundRect(4, 4, w - 8, h - 11, 7); mg.fill();
  const cx = w / 2, cy = (h - 7) / 2 + 2, dx = w * 0.19, r = w * 0.085; const col = { enojada: '#ff6a5c', enamorada: '#ff6fb0' }[face] || '#fff';
  mg.fillStyle = col; mg.strokeStyle = col; mg.lineWidth = 2.4; mg.lineCap = 'round';
  for (const sd of [-1, 1]) {
    const x = cx + sd * dx, y = cy;
    mg.beginPath();
    if (face === 'feliz') { mg.arc(x, y + 2, r, Math.PI * 1.1, Math.PI * 1.9); mg.stroke(); }
    else if (face === 'dormida') { mg.arc(x, y - 1, r, Math.PI * 0.1, Math.PI * 0.9); mg.stroke(); }
    else if (face === 'aburrida') { mg.arc(x, y, r, 0, Math.PI); mg.fill(); }
    else if (face === 'sorprendida') { mg.arc(x, y, r * 1.15, 0, Math.PI * 2); mg.stroke(); }
    else if (face === 'enojada') { mg.moveTo(x - r, y - r * 0.2 * -sd); mg.lineTo(x + r, y + r * 0.2 * -sd - (sd > 0 ? 0 : 0)); mg.arc(x, y, r, 0, Math.PI); mg.fill(); mg.beginPath(); mg.moveTo(x - r * 1.1, y - r * (sd < 0 ? 1.1 : 0.2)); mg.lineTo(x + r * 1.1, y - r * (sd < 0 ? 0.2 : 1.1)); mg.stroke(); }
    else if (face === 'enamorada') { mg.font = `${r * 3}px sans-serif`; mg.textAlign = 'center'; mg.textBaseline = 'middle'; mg.fillText('♥', x, y + 1); }
    else if (face === 'confundida') { mg.arc(x, y + (sd < 0 ? 1 : -1), sd < 0 ? r * 0.65 : r * 1.15, 0, Math.PI * 2); mg.fill(); }
    else if (face === 'rota') { mg.moveTo(x - r, y - r); mg.lineTo(x + r, y + r); mg.moveTo(x + r, y - r); mg.lineTo(x - r, y + r); mg.stroke(); }
    else { mg.arc(x, y, r, 0, Math.PI * 2); mg.fill(); }
  }
  if (face === 'rota') { mg.strokeStyle = 'rgba(255,255,255,.6)'; mg.lineWidth = 1; mg.beginPath(); mg.moveTo(w * 0.6, 6); mg.lineTo(w * 0.5, h * 0.45); mg.lineTo(w * 0.75, h - 10); mg.stroke(); }
}
setMini('normal');
function addMsg(who, text) {
  const d = document.createElement('div'); d.className = 'msg ' + who;
  const sp = document.createElement('span'); sp.textContent = text; d.appendChild(sp); log.appendChild(d); log.scrollTop = log.scrollHeight; return sp;
}
function typeInto(sp, text, done) {
  let i = 0; const step = () => { sp.textContent = text.slice(0, ++i); log.scrollTop = log.scrollHeight; if (i < text.length) setTimeout(step, 14 + Math.random() * 24); else done && done(); }; step();
}
let opened = false, busy = false;
function openChat(open) {
  panel.hidden = !open; fab.setAttribute('aria-expanded', String(open)); document.body.classList.toggle('chat-open', open);
  if (open) {
    if (scrollY > innerHeight * 0.5) scrollTo({ top: 0, behavior: 'smooth' });
    if (!opened) { opened = true; const sp = addMsg('tele', ''); typeInto(sp, 'Bienvenido al chat. Preguntame lo que quieras, que yo te contesto con toda la buena onda que me queda. O sea, poca.'); hero.setFace('feliz', 2.5); setMini('feliz'); }
    if (!isMobile) setTimeout(() => input.focus(), 50);
  }
}
fab.addEventListener('click', () => openChat(panel.hidden));
document.getElementById('chatClose').addEventListener('click', () => openChat(false));
document.querySelectorAll('.sugg button').forEach(b => b.addEventListener('click', () => { input.value = b.textContent; form.requestSubmit(); }));
form.addEventListener('submit', async e => {
  e.preventDefault();
  const q = input.value.trim().slice(0, 400); if (!q || busy) return;
  input.value = ''; addMsg('me', q); busy = true;
  const dots = addMsg('tele typing', '•••');
  hero.setFace('confundida', 1.2);
  const t0 = performance.now();
  let r;
  if (hero.fx.isBroken) r = ['Krrzzz… estoy rota… tocá Reparar… krrzz.', 'rota'];
  else r = await reply(q);
  await new Promise(res => setTimeout(res, Math.max(0, 600 + Math.random() * 700 - (performance.now() - t0))));
  dots.parentElement.classList.remove('typing');
  const [text, face] = r;
  if (face !== 'rota') { hero.setFace(face, 4.5); if (face === 'enojada') hero.glitch(0.25, 0.3); }
  setMini(face);
  typeInto(dots, text, () => (busy = false));
  if (!hero.fx.isBroken && scrollY < innerHeight * 0.6) type(text);
});
/* ---------- arranque ---------- */
(async function start() {
  try { await Promise.race([Promise.all([document.fonts.load('400 100px "Archivo Black"'), document.fonts.load('500 13px "Inter Tight"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}
  ink.ready = true;
  resize();
  // precompilar
  try { renderer.compile(hero.scene, hero.cam); renderer.compile(ink.scene, ink.cam); renderer.compile(ideas.scene, ideas.cam); } catch (e) {}
  const t0 = performance.now();
  await new Promise(r => { const c = () => (hero.loaded || performance.now() - t0 > 4000 ? r() : setTimeout(c, 40)); c(); });
  clock.start();
  requestAnimationFrame(frame);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    document.body.classList.add('ready');
    setTimeout(() => type(LINES.hola[0]), 700);
  }));
})();
window.__nada = { hero };
