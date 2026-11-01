import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ShieldCheck, Eye, EyeOff, RotateCw, Layers, Sparkles, Compass } from 'lucide-react';

interface Props {
  className?: string;
  onExplodeChange?: (val: number) => void;
}

export const EduLocSecurityVault3D: React.FC<Props> = ({ className = '' }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [explodedVal, setExplodedVal] = useState(0);
  const [activeFinish, setActiveFinish] = useState<'obsidian' | 'emerald' | 'sapphire'>('obsidian');
  const [isRotating, setIsRotating] = useState(true);
  const [activeView, setActiveView] = useState<'isometric' | 'front' | 'top'>('isometric');

  // References for animation loop
  const animStateRef = useRef({
    exploded: 0,
    targetExploded: 0,
    cameraAngle: 0,
    isRotating: true,
    targetCameraPos: new THREE.Vector3(3.8, 3.2, 4.5),
    targetLookAt: new THREE.Vector3(0, 0.9, 0),
    activeFinish: 'obsidian',
  });

  useEffect(() => {
    animStateRef.current.targetExploded = explodedVal;
  }, [explodedVal]);

  useEffect(() => {
    animStateRef.current.isRotating = isRotating;
  }, [isRotating]);

  useEffect(() => {
    animStateRef.current.activeFinish = activeFinish;
  }, [activeFinish]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Detect software WebGL
    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131224);
    scene.fog = new THREE.FogExp2(0x131224, 0.07);

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 500;
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 50);
    camera.position.set(3.8, 3.2, 4.5);
    camera.lookAt(0, 0.9, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(renderer.domElement);

    // 2. Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 3. Balanced Studio Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff3e0, 2.5);
    keyLight.position.set(4, 7, 3);
    keyLight.castShadow = !isSoftwareGl;
    if (keyLight.castShadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      const d = 3;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
    }
    scene.add(keyLight);

    const fillLight = new THREE.HemisphereLight(0x9d90f5, 0x1a1930, 1.1);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x0e9c82, 1.8);
    rimLight.position.set(-4, 3, -3);
    scene.add(rimLight);

    // 4. Ground Contact Shadow
    const shadowGeo = new THREE.PlaneGeometry(6, 6);
    // Procedural radial shadow texture
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createRadialGradient(128, 128, 10, 128, 128, 120);
    gradient.addColorStop(0, 'rgba(0,0,0,0.75)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.3)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const shadowTex = new THREE.CanvasTexture(canvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.8,
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.01;
    scene.add(shadowPlane);

    // Floor subtle circular grid
    const gridHelper = new THREE.PolarGridHelper(3.2, 16, 8, 32, 0x332e86, 0x221f4a);
    gridHelper.position.y = 0.02;
    scene.add(gridHelper);

    // 5. Procedural 3D Composite Subject: EduLoc Vault & Graduation Cap (8 Parts)
    const vaultGroup = new THREE.Group();
    scene.add(vaultGroup);

    // Part 1: Hexagonal Obsidian Pedestal Plinth
    const plinthGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.35, 6);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x18172b,
      roughness: 0.35,
      metalness: 0.7,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = 0.175;
    plinth.receiveShadow = !isSoftwareGl;
    vaultGroup.add(plinth);

    // Part 2: Gold Plinth Accent Ring
    const accentRingGeo = new THREE.CylinderGeometry(1.64, 1.64, 0.05, 6);
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      roughness: 0.2,
      metalness: 0.9,
    });
    const accentRing = new THREE.Mesh(accentRingGeo, goldMat);
    accentRing.position.y = 0.35;
    vaultGroup.add(accentRing);

    // Part 3: Inner Rotating Cryptographic Ring
    const innerRingGeo = new THREE.TorusGeometry(1.1, 0.035, 16, 64);
    const innerRingMat = new THREE.MeshStandardMaterial({
      color: 0x8d7fe3,
      emissive: 0x332e86,
      emissiveIntensity: 0.4,
      roughness: 0.25,
      metalness: 0.85,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = Math.PI / 2;
    innerRing.position.y = 0.65;
    vaultGroup.add(innerRing);

    // Part 4: Outer Security Gyro Ring (inclined)
    const outerRingGeo = new THREE.TorusGeometry(1.35, 0.028, 16, 64);
    const emeraldMat = new THREE.MeshStandardMaterial({
      color: 0x0e9c82,
      emissive: 0x095245,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.8,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, emeraldMat);
    outerRing.rotation.x = Math.PI / 2.3;
    outerRing.position.y = 0.85;
    vaultGroup.add(outerRing);

    // Part 5: Central Faceted Quantum Payment Core (Sapphire / Emerald Crystal)
    const crystalGeo = new THREE.OctahedronGeometry(0.38, 1);
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x2cd5b0,
      emissive: 0x075444,
      emissiveIntensity: 0.35,
      roughness: 0.08,
      metalness: 0.1,
      transmission: isSoftwareGl ? 0 : 0.88,
      transparent: true,
      opacity: 0.9,
      ior: 1.65,
    });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 0.95;
    crystal.castShadow = !isSoftwareGl;
    vaultGroup.add(crystal);

    // Graduation Mortarboard Assembly (Part 6, 7, 8)
    const capGroup = new THREE.Group();
    capGroup.position.y = 1.65;
    vaultGroup.add(capGroup);

    // Part 6: Mortarboard Skullcap
    const skullCapGeo = new THREE.CylinderGeometry(0.35, 0.42, 0.28, 24);
    const fabricMat = new THREE.MeshStandardMaterial({
      color: 0x221c5e,
      roughness: 0.65,
      metalness: 0.15,
    });
    const skullCap = new THREE.Mesh(skullCapGeo, fabricMat);
    skullCap.position.y = -0.14;
    skullCap.castShadow = !isSoftwareGl;
    capGroup.add(skullCap);

    // Part 7: Mortarboard Square Flat Diamond Board
    const boardGeo = new THREE.BoxGeometry(1.1, 0.04, 1.1);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x332e86,
      roughness: 0.4,
      metalness: 0.3,
    });
    const board = new THREE.Mesh(boardGeo, boardMat);
    board.rotation.y = Math.PI / 4;
    board.position.y = 0.02;
    board.castShadow = !isSoftwareGl;
    capGroup.add(board);

    // Part 8: Golden Button Stud & Silk Tassel
    const buttonGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16);
    const button = new THREE.Mesh(buttonGeo, goldMat);
    button.position.y = 0.05;
    capGroup.add(button);

    // Procedural Tassel Cord & Fringe
    const tasselCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.05, 0),
      new THREE.Vector3(0.3, 0.04, 0.2),
      new THREE.Vector3(0.55, -0.05, 0.35),
      new THREE.Vector3(0.65, -0.28, 0.4),
    ]);
    const tasselGeo = new THREE.TubeGeometry(tasselCurve, 20, 0.015, 8, false);
    const tassel = new THREE.Mesh(tasselGeo, goldMat);
    capGroup.add(tassel);

    const tasselFringeGeo = new THREE.ConeGeometry(0.05, 0.16, 12);
    const tasselFringe = new THREE.Mesh(tasselFringeGeo, goldMat);
    tasselFringe.rotation.x = Math.PI;
    tasselFringe.position.set(0.65, -0.36, 0.4);
    capGroup.add(tasselFringe);

    // Part 9: Floating Payment Protocol Runes / Particles
    const particlesCount = 24;
    const particleGeo = new THREE.TetrahedronGeometry(0.04);
    const particleMat = new THREE.MeshStandardMaterial({
      color: 0xdfb15b,
      emissive: 0xbd7e28,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.1,
    });
    const particlesGroup = new THREE.Group();
    for (let i = 0; i < particlesCount; i++) {
      const pMesh = new THREE.Mesh(particleGeo, particleMat);
      const angle = (i / particlesCount) * Math.PI * 2;
      const radius = 1.45 + Math.sin(i * 1.5) * 0.2;
      const py = 0.5 + Math.cos(i * 2) * 0.4;
      pMesh.position.set(Math.cos(angle) * radius, py, Math.sin(angle) * radius);
      particlesGroup.add(pMesh);
    }
    vaultGroup.add(particlesGroup);

    // 6. Interaction: Mouse dragging & camera damping
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let sphericalTheta = 0.7;
    let sphericalPhi = 0.9;
    let sphericalRadius = 4.8;

    const handlePointerDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      animStateRef.current.isRotating = false;
      setIsRotating(false);
    };

    const handlePointerMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouseX;
      const dy = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      sphericalTheta -= dx * 0.008;
      sphericalPhi = Math.max(0.15, Math.min(Math.PI / 2 - 0.05, sphericalPhi - dy * 0.008));
    };

    const handlePointerUp = () => {
      isDragging = false;
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);

    // Resize observer
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 7. Render Loop with Exponential Damping & Zero GC
    let frameId = 0;
    let clock = new THREE.Clock();

    const tick = () => {
      frameId = requestAnimationFrame(tick);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Auto rotation
      if (animStateRef.current.isRotating && !isDragging) {
        sphericalTheta += delta * 0.35;
      }

      // Smooth camera position damping
      const cx = sphericalRadius * Math.sin(sphericalPhi) * Math.sin(sphericalTheta);
      const cy = sphericalRadius * Math.cos(sphericalPhi) + 0.3;
      const cz = sphericalRadius * Math.sin(sphericalPhi) * Math.cos(sphericalTheta);
      
      camera.position.x = THREE.MathUtils.damp(camera.position.x, cx, 8, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, cy, 8, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, cz, 8, delta);
      camera.lookAt(0, 0.95, 0);

      // Smooth exploded view damping
      animStateRef.current.exploded = THREE.MathUtils.damp(
        animStateRef.current.exploded,
        animStateRef.current.targetExploded,
        9,
        delta
      );
      const expl = animStateRef.current.exploded;

      // Apply exploded transformation to distinct parts
      capGroup.position.y = 1.65 + expl * 1.2;
      board.position.y = 0.02 + expl * 0.3;
      crystal.position.y = 0.95 + expl * 0.45;
      innerRing.position.y = 0.65 - expl * 0.15;
      outerRing.position.y = 0.85 + expl * 0.25;
      plinth.position.y = 0.175 - expl * 0.25;
      accentRing.position.y = 0.35 - expl * 0.2;

      // Continuous mechanical rotations
      crystal.rotation.y = elapsed * 0.8;
      crystal.rotation.x = Math.sin(elapsed * 0.5) * 0.2;
      innerRing.rotation.z = -elapsed * 0.5;
      outerRing.rotation.z = elapsed * 0.4;
      particlesGroup.rotation.y = elapsed * 0.25;

      // Finishes material reaction
      const currentFinish = animStateRef.current.activeFinish;
      if (currentFinish === 'emerald') {
        plinthMat.color.setHex(0x0c2621);
        crystalMat.color.setHex(0x10b981);
        innerRingMat.color.setHex(0x0e9c82);
      } else if (currentFinish === 'sapphire') {
        plinthMat.color.setHex(0x12163b);
        crystalMat.color.setHex(0x6366f1);
        innerRingMat.color.setHex(0x332e86);
      } else {
        plinthMat.color.setHex(0x18172b);
        crystalMat.color.setHex(0x2cd5b0);
        innerRingMat.color.setHex(0x8d7fe3);
      }

      renderer.render(scene, camera);
    };

    tick();

    return () => {
      cancelAnimationFrame(frameId);
      dom.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(dom)) {
        container.removeChild(dom);
      }
    };
  }, []);

  return (
    <div className={`relative w-full h-[540px] rounded-3xl overflow-hidden border border-line bg-[#131224] shadow-2xl ${className}`}>
      {/* 3D Canvas Mount Point */}
      <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />

      {/* Top Floating Spec Banner */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-[#1c1b33]/90 px-3.5 py-1.5 border border-white/10 text-white backdrop-blur-sm">
          <ShieldCheck className="h-4 w-4 text-[#0E9C82]" />
          <span className="text-xs font-semibold tracking-wide">EduLoc Vault 3D · Architecture Sécurisée</span>
        </div>
        <div className="hidden sm:flex items-center gap-2 rounded-xl bg-black/40 px-3 py-1.5 border border-white/5 text-xs text-slate-300">
          <span>PCI DSS Level 1</span>
          <span className="text-white/30">/</span>
          <span>GSMA Mobile Money</span>
        </div>
      </div>

      {/* Top-Right Toggle Full HUD */}
      <div className="absolute top-4 right-4 z-10">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="flex items-center gap-1.5 rounded-xl bg-[#1c1b33]/90 hover:bg-[#252445] px-3 py-1.5 border border-white/10 text-xs font-medium text-white transition-colors"
          title={isCollapsed ? 'Afficher les contrôles 3D' : 'Masquer les contrôles 3D'}
        >
          {isCollapsed ? <Eye className="h-3.5 w-3.5 text-[#0E9C82]" /> : <EyeOff className="h-3.5 w-3.5 text-slate-400" />}
          <span className="hidden sm:inline">{isCollapsed ? 'Afficher Dock' : 'Mode Cinéma'}</span>
        </button>
      </div>

      {/* Bottom Collapsible Control Dock (Conforms strictly to Three.js skill <= 15% footprint) */}
      <div
        className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-[760px] transition-all duration-300 ${
          isCollapsed ? 'translate-y-28 opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
        }`}
      >
        <div className="rounded-2xl border border-white/15 bg-[#18172ce6] p-3 shadow-2xl backdrop-blur-md text-white">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Exploded View Slider */}
            <div className="flex items-center gap-2.5 flex-1 min-w-[200px]">
              <Layers className="h-4 w-4 text-[#8D7FE3] shrink-0" />
              <span className="text-slate-300 shrink-0 font-medium">Vue éclatée:</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={explodedVal}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setExplodedVal(val);
                }}
                className="w-full accent-[#8D7FE3] cursor-pointer h-1.5 bg-white/20 rounded-lg"
              />
              <span className="text-slate-400 font-mono w-8 text-right">{Math.round(explodedVal * 100)}%</span>
            </div>

            {/* Separator */}
            <div className="hidden sm:block h-5 w-px bg-white/15" />

            {/* Finishes Swatches */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 mr-1 text-[11px]">Finition:</span>
              <button
                onClick={() => setActiveFinish('obsidian')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activeFinish === 'obsidian' ? 'bg-[#332E86] text-white font-semibold' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Obsidienne & Or
              </button>
              <button
                onClick={() => setActiveFinish('emerald')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activeFinish === 'emerald' ? 'bg-[#0E9C82] text-white font-semibold' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Émeraude GSMA
              </button>
              <button
                onClick={() => setActiveFinish('sapphire')}
                className={`px-2.5 py-1 rounded-lg transition-colors ${
                  activeFinish === 'sapphire' ? 'bg-[#4338CA] text-white font-semibold' : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                Saphir Visa
              </button>
            </div>

            {/* Rotation Toggle */}
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isRotating ? 'border-[#0E9C82]/50 text-[#0E9C82] bg-[#0E9C82]/10' : 'border-white/10 text-slate-400 hover:text-white'
              }`}
              title={isRotating ? 'Arrêter la rotation' : 'Démarrer la rotation'}
            >
              <RotateCw className={`h-4 w-4 ${isRotating ? 'animate-spin' : ''}`} style={{ animationDuration: '8s' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
