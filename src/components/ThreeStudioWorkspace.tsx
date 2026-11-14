import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { Eye, EyeOff, RotateCcw, BookmarkCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saveCreation } from '../lib/firebase';

type ModelId = 'satellite' | 'rover' | 'pavilion';
type FinishId = 'titanium' | 'obsidian' | 'ceramic';
type LightingId = 'studio_dark' | 'solar_amber' | 'daylight_lab';
type CameraPresetId = 'hero' | 'top' | 'detail' | 'low';

interface FinishPalette {
  label: string;
  swatch: string;
  primaryColor: number;
  primaryRoughness: number;
  primaryMetalness: number;
  accentColor: number;
  accentRoughness: number;
  accentMetalness: number;
}

const FINISH_PALETTES: Record<FinishId, FinishPalette> = {
  titanium: {
    label: 'Anodized Titanium',
    swatch: '#94a3b8',
    primaryColor: 0xcbd5e1,
    primaryRoughness: 0.28,
    primaryMetalness: 0.88,
    accentColor: 0x0ea5e9,
    accentRoughness: 0.35,
    accentMetalness: 0.65,
  },
  obsidian: {
    label: 'Obsidian & Brass',
    swatch: '#d97706',
    primaryColor: 0x1e293b,
    primaryRoughness: 0.36,
    primaryMetalness: 0.78,
    accentColor: 0xf59e0b,
    accentRoughness: 0.22,
    accentMetalness: 0.94,
  },
  ceramic: {
    label: 'Ceramic Matte',
    swatch: '#f1f5f9',
    primaryColor: 0xf1f5f9,
    primaryRoughness: 0.72,
    primaryMetalness: 0.08,
    accentColor: 0x334155,
    accentRoughness: 0.26,
    accentMetalness: 0.85,
  },
};

const LIGHTING_PRESETS: Record<
  LightingId,
  {
    label: string;
    bg: number;
    fogDensity: number;
    keyColor: number;
    keyIntensity: number;
    hemiSky: number;
    hemiGround: number;
    hemiIntensity: number;
    rimColor: number;
  }
> = {
  studio_dark: {
    label: 'Studio Slate',
    bg: 0x0b1120,
    fogDensity: 0.032,
    keyColor: 0xfff3e0,
    keyIntensity: 2.3,
    hemiSky: 0xbae6fd,
    hemiGround: 0x1e293b,
    hemiIntensity: 0.7,
    rimColor: 0x38bdf8,
  },
  solar_amber: {
    label: 'Solar Horizon',
    bg: 0x181311,
    fogDensity: 0.034,
    keyColor: 0xffd29d,
    keyIntensity: 2.6,
    hemiSky: 0xfed7aa,
    hemiGround: 0x292524,
    hemiIntensity: 0.55,
    rimColor: 0xfb923c,
  },
  daylight_lab: {
    label: 'Daylight Lab',
    bg: 0xdbe6f2,
    fogDensity: 0.024,
    keyColor: 0xfff8eb,
    keyIntensity: 2.1,
    hemiSky: 0xffffff,
    hemiGround: 0x94a3b8,
    hemiIntensity: 0.95,
    rimColor: 0x60a5fa,
  },
};

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { label: 'Hero 3/4', pos: [4.6, 3.1, 4.9], target: [0, 1.05, 0] },
  top: { label: 'Top Plan', pos: [0.01, 6.4, 0.2], target: [0, 0.9, 0] },
  detail: { label: 'Close Detail', pos: [2.3, 1.8, 2.4], target: [0, 1.1, 0] },
  low: { label: 'Low Angle', pos: [3.8, 0.85, 3.6], target: [0, 1.25, 0] },
};

const MODEL_META: Record<ModelId, { label: string; summary: string }> = {
  satellite: {
    label: 'Orbital Relay',
    summary: '9-part spacecraft assembly with Lathe dish, beveled truss & solar wings',
  },
  rover: {
    label: 'Survey Rover',
    summary: '10-part planetary rover with bogie suspension, stereo mast & RTG radiator',
  },
  pavilion: {
    label: 'Meridian Pavilion',
    summary: '8-part architectural dome with stepped plinth, colonnade & acoustic core',
  },
};

function createSolarTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0c1b3a';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    for (let x = 0; x <= 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
    for (let y = 0; y <= 256; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(512, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.45)';
    ctx.lineWidth = 1;
    for (let x = 16; x < 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 256);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPlinthGridTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 256, 180, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256, 256, 110, 0, Math.PI * 2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.62)');
    grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.24)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function registerPart(
  group: THREE.Group,
  obj: THREE.Object3D,
  explodeVec: THREE.Vector3,
  castShadow = true
) {
  obj.userData.basePos = obj.position.clone();
  obj.userData.explodeVec = explodeVec;
  obj.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = castShadow;
      child.receiveShadow = true;
    }
  });
  group.add(obj);
}

function groundGroup(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (Number.isFinite(box.min.y)) {
    const offset = -box.min.y + 0.04;
    group.children.forEach((child) => {
      if (child.userData.basePos instanceof THREE.Vector3) {
        child.position.y += offset;
        child.userData.basePos.y += offset;
      }
    });
  }
}

function buildCompositeModel(
  modelId: ModelId,
  mats: {
    primary: THREE.MeshStandardMaterial;
    accent: THREE.MeshStandardMaterial;
    darkFrame: THREE.MeshStandardMaterial;
    solar: THREE.MeshStandardMaterial;
    glass: THREE.MeshPhysicalMaterial;
  }
): THREE.Group {
  const root = new THREE.Group();

  if (modelId === 'satellite') {
    // 1. Octagonal Spacecraft Bus Core
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.68, 1.15, 8), mats.primary);
    bus.position.set(0, 1.25, 0);
    registerPart(root, bus, new THREE.Vector3(0, 0, 0));

    // 2. Beveled Structural Collar (ExtrudeGeometry)
    const hexShape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const r = 0.74;
      if (i === 0) hexShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else hexShape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    hexShape.closePath();
    const collarGeo = new THREE.ExtrudeGeometry(hexShape, {
      depth: 0.14,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.03,
      bevelSegments: 2,
    });
    collarGeo.rotateX(Math.PI / 2);
    const collar = new THREE.Mesh(collarGeo, mats.accent);
    collar.position.set(0, 1.32, 0);
    registerPart(root, collar, new THREE.Vector3(0, 0.2, 0));

    // 3. Parabolic Lathe Dish
    const dishPoints = [
      new THREE.Vector2(0.02, 0),
      new THREE.Vector2(0.28, 0.05),
      new THREE.Vector2(0.55, 0.16),
      new THREE.Vector2(0.76, 0.34),
      new THREE.Vector2(0.79, 0.36),
    ];
    const dish = new THREE.Mesh(
      new THREE.LatheGeometry(dishPoints, 32),
      new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        roughness: 0.3,
        metalness: 0.6,
        side: THREE.DoubleSide,
      })
    );
    dish.position.set(0, 1.88, 0);
    registerPart(root, dish, new THREE.Vector3(0, 0.72, 0));

    // 4. Feed Horn Spire
    const hornGroup = new THREE.Group();
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, 0.56, 12), mats.darkFrame);
    spire.position.y = 0.28;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 1), mats.accent);
    tip.position.y = 0.58;
    hornGroup.add(spire, tip);
    hornGroup.position.set(0, 1.9, 0);
    registerPart(root, hornGroup, new THREE.Vector3(0, 1.15, 0));

    // 5 & 6. Dual Solar Wings (Port + Starboard)
    [-1, 1].forEach((dir) => {
      const wing = new THREE.Group();
      const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.95, 10), mats.darkFrame);
      boom.rotation.z = Math.PI / 2;
      boom.position.x = dir * 1.05;
      const panel = new THREE.Mesh(new THREE.BoxGeometry(1.48, 0.035, 0.68), mats.solar);
      panel.position.x = dir * 1.38;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.54, 0.025, 0.74), mats.primary);
      frame.position.x = dir * 1.38;
      wing.add(frame, panel, boom);
      wing.position.set(dir * 0.55, 1.25, 0);
      wing.rotation.x = 0.25;
      registerPart(root, wing, new THREE.Vector3(dir * 0.9, 0, 0));
    });

    // 7. Thruster Nozzle Bell (LatheGeometry)
    const bellPts = [
      new THREE.Vector2(0.14, 0.3),
      new THREE.Vector2(0.1, 0.18),
      new THREE.Vector2(0.24, 0),
    ];
    const nozzle = new THREE.Mesh(new THREE.LatheGeometry(bellPts, 24), mats.darkFrame);
    nozzle.position.set(0, 0.36, 0);
    registerPart(root, nozzle, new THREE.Vector3(0, -0.35, 0));

    // 8. Propellant Conduit Loop (TubeGeometry)
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.45, 0.9, 0.45),
      new THREE.Vector3(0.75, 1.15, 0.35),
      new THREE.Vector3(0.75, 1.55, -0.35),
      new THREE.Vector3(0.45, 1.65, -0.45),
    ]);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.03, 10, false), mats.accent);
    registerPart(root, tube, new THREE.Vector3(0.45, 0, 0.25));

    // 9. Sensor Dome Forward
    const sensor = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), mats.glass);
    sensor.position.set(0, 1.25, 0.68);
    registerPart(root, sensor, new THREE.Vector3(0, 0, 0.65));
  } else if (modelId === 'rover') {
    // 1. Beveled Hull Chassis
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-0.7, -0.95);
    hullShape.lineTo(0.7, -0.95);
    hullShape.lineTo(0.85, -0.3);
    hullShape.lineTo(0.72, 0.95);
    hullShape.lineTo(-0.72, 0.95);
    hullShape.lineTo(-0.85, -0.3);
    hullShape.closePath();
    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.38,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 2,
    });
    hullGeo.rotateX(Math.PI / 2);
    const hull = new THREE.Mesh(hullGeo, mats.primary);
    hull.position.set(0, 0.95, 0);
    registerPart(root, hull, new THREE.Vector3(0, 0.2, 0));

    // 2. Solar Deck Lid
    const deck = new THREE.Mesh(new THREE.BoxGeometry(1.22, 0.06, 1.45), mats.solar);
    deck.position.set(0, 1.03, 0.02);
    registerPart(root, deck, new THREE.Vector3(0, 0.6, 0));

    // 3. Stereo Optical Mast
    const mast = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.85, 14), mats.darkFrame);
    pole.position.y = 0.42;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.24), mats.accent);
    head.position.y = 0.88;
    const lensL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.08, 16), mats.glass);
    lensL.rotation.x = Math.PI / 2;
    lensL.position.set(-0.12, 0.88, 0.13);
    const lensR = lensL.clone();
    lensR.position.x = 0.12;
    mast.add(pole, head, lensL, lensR);
    mast.position.set(0.32, 1.02, 0.58);
    registerPart(root, mast, new THREE.Vector3(0.2, 0.85, 0.35));

    // 4. High-Gain Dish
    const dishPts = [
      new THREE.Vector2(0.01, 0),
      new THREE.Vector2(0.22, 0.04),
      new THREE.Vector2(0.42, 0.16),
    ];
    const dish = new THREE.Mesh(new THREE.LatheGeometry(dishPts, 24), mats.primary);
    dish.position.set(-0.38, 1.24, -0.35);
    dish.rotation.x = -0.38;
    registerPart(root, dish, new THREE.Vector3(-0.35, 0.85, -0.25));

    // 5. Rear RTG Finned Power Cylinder
    const rtg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.65, 12), mats.accent);
    rtg.rotation.x = Math.PI / 3;
    rtg.position.set(0, 0.96, -1.08);
    registerPart(root, rtg, new THREE.Vector3(0, 0.25, -0.75));

    // 6-7. Rocker-Bogie Suspension Arms (Left & Right)
    [-1, 1].forEach((side) => {
      const tubeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(side * 0.98, 0.32, 0.92),
        new THREE.Vector3(side * 0.94, 0.72, 0.15),
        new THREE.Vector3(side * 0.98, 0.32, 0.0),
        new THREE.Vector3(side * 0.94, 0.72, -0.25),
        new THREE.Vector3(side * 0.98, 0.32, -0.92),
      ]);
      const arm = new THREE.Mesh(
        new THREE.TubeGeometry(tubeCurve, 28, 0.042, 10, false),
        mats.darkFrame
      );
      registerPart(root, arm, new THREE.Vector3(side * 0.55, 0, 0));

      // 3 Wheels per side
      [-0.92, 0, 0.92].forEach((zPos) => {
        const wheelGroup = new THREE.Group();
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.22, 18), mats.darkFrame);
        tire.rotation.z = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 12), mats.accent);
        hub.rotation.z = Math.PI / 2;
        wheelGroup.add(tire, hub);
        wheelGroup.position.set(side * 1.08, 0.32, zPos);
        registerPart(root, wheelGroup, new THREE.Vector3(side * 0.85, -0.1, zPos * 0.25));
      });
    });
  } else {
    // Meridian Geodesic Pavilion (8 parts)
    // 1. Stepped Base Plinth
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 2.02, 0.26, 24), mats.darkFrame);
    plinth.position.set(0, 0.13, 0);
    registerPart(root, plinth, new THREE.Vector3(0, -0.2, 0));

    // 2. Inner Raised Deck
    const deck = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.56, 0.16, 24), mats.primary);
    deck.position.set(0, 0.34, 0);
    registerPart(root, deck, new THREE.Vector3(0, 0, 0));

    // 3. Colonnade Ring of 8 Slanted Columns
    const colRing = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.08, 1.25, 12), mats.primary);
      col.position.set(Math.cos(a) * 1.32, 0.95, Math.sin(a) * 1.32);
      col.lookAt(0, 2.1, 0);
      col.rotateX(Math.PI / 2);
      colRing.add(col);
    }
    registerPart(root, colRing, new THREE.Vector3(0, 0.25, 0));

    // 4. Cantilevered Torus Canopy Halo
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.36, 0.09, 16, 48), mats.accent);
    halo.rotation.x = Math.PI / 2;
    halo.position.set(0, 1.54, 0);
    registerPart(root, halo, new THREE.Vector3(0, 0.62, 0));

    // 5. Glass Dome Shell
    const glassDome = new THREE.Mesh(
      new THREE.SphereGeometry(1.26, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2),
      mats.glass
    );
    glassDome.position.set(0, 1.54, 0);
    registerPart(root, glassDome, new THREE.Vector3(0, 0.95, 0), false);

    // 6. Geodesic Exo-Rib Cage
    const cage = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.29, 1),
      new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.3,
        metalness: 0.85,
        wireframe: true,
      })
    );
    cage.position.set(0, 1.54, 0);
    registerPart(root, cage, new THREE.Vector3(0, 1.15, 0));

    // 7. Central Acoustic Core Spire
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), mats.accent);
    core.position.set(0, 1.2, 0);
    registerPart(root, core, new THREE.Vector3(0, 0.45, 0));

    // 8. Oculus Crown Finial
    const finialPts = [
      new THREE.Vector2(0.38, 0),
      new THREE.Vector2(0.28, 0.14),
      new THREE.Vector2(0.06, 0.36),
    ];
    const finial = new THREE.Mesh(new THREE.LatheGeometry(finialPts, 20), mats.primary);
    finial.position.set(0, 2.75, 0);
    registerPart(root, finial, new THREE.Vector3(0, 1.48, 0));
  }

  groundGroup(root);
  return root;
}

export function ThreeStudioWorkspace() {
  const { user } = useAuth();
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [modelId, setModelId] = useState<ModelId>('satellite');
  const [finishId, setFinishId] = useState<FinishId>('titanium');
  const [lightingId, setLightingId] = useState<LightingId>('studio_dark');
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [explodeAmount, setExplodeAmount] = useState<number>(0);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const [savingNotice, setSavingNotice] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  // Synced refs read cleanly inside the WebGL frame loop
  const explodeTargetRef = useRef(0);
  const autoOrbitRef = useRef(true);
  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(...CAMERA_PRESETS.hero.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.hero.target),
    active: false,
  });

  const sceneRefs = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    renderer: THREE.WebGLRenderer;
    keyLight: THREE.DirectionalLight;
    hemiLight: THREE.HemisphereLight;
    rimLight: THREE.DirectionalLight;
    mats: {
      primary: THREE.MeshStandardMaterial;
      accent: THREE.MeshStandardMaterial;
      darkFrame: THREE.MeshStandardMaterial;
      solar: THREE.MeshStandardMaterial;
      glass: THREE.MeshPhysicalMaterial;
    };
    activeGroup: THREE.Group | null;
    requestRender: () => void;
    isSoftwareGl: boolean;
  } | null>(null);

  useEffect(() => {
    explodeTargetRef.current = explodeAmount;
    sceneRefs.current?.requestRender();
  }, [explodeAmount]);

  useEffect(() => {
    autoOrbitRef.current = autoOrbit;
    if (sceneRefs.current) {
      sceneRefs.current.controls.autoRotate = autoOrbit;
      sceneRefs.current.requestRender();
    }
  }, [autoOrbit]);

  // Initialize Three.js WebGL stage once on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      // Probe software GL first so renderer options match hardware budget
      const probeCanvas = document.createElement('canvas');
      const probeGl =
        probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      let isSoftwareGl = false;
      if (probeGl) {
        const dbg = probeGl.getExtension('WEBGL_debug_renderer_info');
        const rendererStr = String(
          probeGl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER) ?? ''
        );
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(rendererStr);
      }

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(container.clientWidth || 800, container.clientHeight || 620);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const lightCfg = LIGHTING_PRESETS.studio_dark;
      scene.background = new THREE.Color(lightCfg.bg);
      scene.fog = new THREE.FogExp2(lightCfg.bg, lightCfg.fogDensity);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(
        42,
        (container.clientWidth || 800) / (container.clientHeight || 620),
        0.1,
        100
      );
      camera.position.set(...CAMERA_PRESETS.hero.pos);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...CAMERA_PRESETS.hero.target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = 2.0;
      controls.maxDistance = 14.0;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.autoRotate = autoOrbitRef.current;
      controls.autoRotateSpeed = 0.75;
      controls.update();

      // Lighting
      const keyLight = new THREE.DirectionalLight(lightCfg.keyColor, lightCfg.keyIntensity);
      keyLight.position.set(5.5, 8.5, 5.0);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 25;
      const s = 3.5;
      keyLight.shadow.camera.left = -s;
      keyLight.shadow.camera.right = s;
      keyLight.shadow.camera.top = s;
      keyLight.shadow.camera.bottom = -s;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);

      const hemiLight = new THREE.HemisphereLight(
        lightCfg.hemiSky,
        lightCfg.hemiGround,
        lightCfg.hemiIntensity
      );
      scene.add(hemiLight);

      const rimLight = new THREE.DirectionalLight(lightCfg.rimColor, 0.95);
      rimLight.position.set(-5.0, 4.0, -5.5);
      scene.add(rimLight);

      const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      const plinthTex = createPlinthGridTexture(maxAniso);
      const solarTex = createSolarTexture(maxAniso);
      const shadowTex = createContactShadowTexture();

      // Turntable Floor Plinth & Contact Shadow
      const floor = new THREE.Mesh(
        new THREE.CylinderGeometry(3.4, 3.6, 0.08, 48),
        new THREE.MeshStandardMaterial({
          map: plinthTex,
          roughness: 0.78,
          metalness: 0.25,
        })
      );
      floor.position.y = -0.04;
      floor.receiveShadow = true;
      scene.add(floor);

      const contactShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 4.4),
        new THREE.MeshBasicMaterial({
          map: shadowTex,
          transparent: true,
          depthWrite: false,
        })
      );
      contactShadow.rotation.x = -Math.PI / 2;
      contactShadow.position.y = 0.004;
      scene.add(contactShadow);

      const palette = FINISH_PALETTES.titanium;
      const mats = {
        primary: new THREE.MeshStandardMaterial({
          color: palette.primaryColor,
          roughness: palette.primaryRoughness,
          metalness: palette.primaryMetalness,
        }),
        accent: new THREE.MeshStandardMaterial({
          color: palette.accentColor,
          roughness: palette.accentRoughness,
          metalness: palette.accentMetalness,
        }),
        darkFrame: new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          roughness: 0.42,
          metalness: 0.82,
        }),
        solar: new THREE.MeshStandardMaterial({
          map: solarTex,
          roughness: 0.18,
          metalness: 0.45,
        }),
        glass: new THREE.MeshPhysicalMaterial({
          color: 0xbae6fd,
          roughness: 0.08,
          metalness: 0.1,
          transmission: 0.65,
          transparent: true,
          opacity: 0.72,
        }),
      };

      const activeGroup = buildCompositeModel('satellite', mats);
      scene.add(activeGroup);

      // Coalesced render scheduling (hardware rAF vs software GL afterDraw)
      let frameHandle = 0;
      let dirty = true;
      let prevTime = performance.now();
      let explodeCurrent = 0;

      const requestRender = () => {
        dirty = true;
        if (!frameHandle) {
          frameHandle = requestAnimationFrame(tick);
        }
      };

      const onControlStart = () => {
        cameraGoalRef.current.active = false;
        requestRender();
      };
      const onControlChange = () => {
        requestRender();
      };
      controls.addEventListener('start', onControlStart);
      controls.addEventListener('change', onControlChange);

      const tick = (now: number) => {
        frameHandle = 0;
        const dt = Math.min((now - prevTime) / 1000, 0.05);
        prevTime = now;

        let needsMore = false;

        // Smooth camera preset transition
        if (cameraGoalRef.current.active) {
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            cameraGoalRef.current.pos.x,
            5.5,
            dt
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            cameraGoalRef.current.pos.y,
            5.5,
            dt
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            cameraGoalRef.current.pos.z,
            5.5,
            dt
          );
          controls.target.x = THREE.MathUtils.damp(
            controls.target.x,
            cameraGoalRef.current.target.x,
            5.5,
            dt
          );
          controls.target.y = THREE.MathUtils.damp(
            controls.target.y,
            cameraGoalRef.current.target.y,
            5.5,
            dt
          );
          controls.target.z = THREE.MathUtils.damp(
            controls.target.z,
            cameraGoalRef.current.target.z,
            5.5,
            dt
          );
          if (camera.position.distanceTo(cameraGoalRef.current.pos) < 0.02) {
            cameraGoalRef.current.active = false;
          } else {
            needsMore = true;
          }
        }

        // Smooth exploded assembly interpolation
        const group = sceneRefs.current?.activeGroup;
        if (Math.abs(explodeCurrent - explodeTargetRef.current) > 0.002) {
          explodeCurrent = THREE.MathUtils.damp(
            explodeCurrent,
            explodeTargetRef.current,
            6.5,
            dt
          );
          needsMore = true;
        } else {
          explodeCurrent = explodeTargetRef.current;
        }

        if (group) {
          group.children.forEach((child) => {
            const base = child.userData.basePos as THREE.Vector3 | undefined;
            const vec = child.userData.explodeVec as THREE.Vector3 | undefined;
            if (base && vec) {
              child.position.copy(base).addScaledVector(vec, explodeCurrent);
            }
          });
        }

        if (controls.autoRotate || controls.enableDamping) {
          controls.update();
        }

        renderer.render(scene, camera);

        if (needsMore || controls.autoRotate || dirty) {
          dirty = false;
          if (isSoftwareGl) {
            setTimeout(() => {
              if (!frameHandle && (needsMore || controls.autoRotate)) {
                frameHandle = requestAnimationFrame(tick);
              }
            }, 34);
          } else if (needsMore || controls.autoRotate) {
            frameHandle = requestAnimationFrame(tick);
          }
        }
      };

      sceneRefs.current = {
        scene,
        camera,
        controls,
        renderer,
        keyLight,
        hemiLight,
        rimLight,
        mats,
        activeGroup,
        requestRender,
        isSoftwareGl,
      };

      requestRender();

      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const w = Math.max(320, Math.floor(entry.contentRect.width));
          const h = Math.max(420, Math.floor(entry.contentRect.height));
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
          requestRender();
        }
      });
      ro.observe(container);

      return () => {
        ro.disconnect();
        if (frameHandle) cancelAnimationFrame(frameHandle);
        controls.removeEventListener('start', onControlStart);
        controls.removeEventListener('change', onControlChange);
        controls.dispose();
        pmrem.dispose();
        envTex.dispose();
        plinthTex.dispose();
        solarTex.dispose();
        shadowTex.dispose();
        Object.values(mats).forEach((m) => m.dispose());
        renderer.dispose();
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        sceneRefs.current = null;
      };
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize WebGL 3D Studio.'
      );
      return undefined;
    }
  }, []);

  // Swap active composite model when modelId changes
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    if (refs.activeGroup) {
      refs.scene.remove(refs.activeGroup);
      refs.activeGroup.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          (obj as THREE.Mesh).geometry.dispose();
        }
      });
    }
    const next = buildCompositeModel(modelId, refs.mats);
    refs.activeGroup = next;
    refs.scene.add(next);
    refs.requestRender();
  }, [modelId]);

  // Update material finish swatches
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const pal = FINISH_PALETTES[finishId];
    refs.mats.primary.color.setHex(pal.primaryColor);
    refs.mats.primary.roughness = pal.primaryRoughness;
    refs.mats.primary.metalness = pal.primaryMetalness;
    refs.mats.accent.color.setHex(pal.accentColor);
    refs.mats.accent.roughness = pal.accentRoughness;
    refs.mats.accent.metalness = pal.accentMetalness;
    refs.requestRender();
  }, [finishId]);

  // Update lighting & fog environment
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const cfg = LIGHTING_PRESETS[lightingId];
    refs.scene.background = new THREE.Color(cfg.bg);
    refs.scene.fog = new THREE.FogExp2(cfg.bg, cfg.fogDensity);
    refs.keyLight.color.setHex(cfg.keyColor);
    refs.keyLight.intensity = cfg.keyIntensity;
    refs.hemiLight.color.setHex(cfg.hemiSky);
    refs.hemiLight.groundColor.setHex(cfg.hemiGround);
    refs.hemiLight.intensity = cfg.hemiIntensity;
    refs.rimLight.color.setHex(cfg.rimColor);
    refs.requestRender();
  }, [lightingId]);

  const applyCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    const targetCfg = CAMERA_PRESETS[preset];
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...targetCfg.pos),
      target: new THREE.Vector3(...targetCfg.target),
      active: true,
    };
    sceneRefs.current?.requestRender();
  };

  const handleSavePreset = async () => {
    if (!user) return;
    await saveCreation({
      ownerId: user.uid,
      kind: 'scene_preset',
      title: `${MODEL_META[modelId].label} · ${FINISH_PALETTES[finishId].label}`,
      content: `Model: ${MODEL_META[modelId].label}\nFinish: ${FINISH_PALETTES[finishId].label}\nLighting: ${LIGHTING_PRESETS[lightingId].label}\nExploded Separation: ${Math.round(explodeAmount * 100)}%\nCamera: ${CAMERA_PRESETS[cameraPreset].label}`,
      modelUsed: 'three.js-pbr',
    });
    setSavingNotice('Scene preset saved to Library');
    setTimeout(() => setSavingNotice(null), 2600);
  };

  if (webglError) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
        <h2 className="text-base font-semibold text-slate-900">3D Viewport Unavailable</h2>
        <p className="text-xs text-slate-600 mt-2">{webglError}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-[640px] h-[calc(100vh-140px)] rounded-xl overflow-hidden border border-slate-200 bg-slate-950">
      {/* Dedicated WebGL Mount Container — never recreated across state updates */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top-Left Minimal Model Title Overlay (solid opaque background, no backdrop-blur) */}
      <div className="absolute top-4 left-4 z-10 pointer-events-none">
        <div className="bg-slate-950/90 border border-slate-800 rounded-lg px-3.5 py-2 text-slate-100">
          <div className="text-xs font-semibold tracking-tight">{MODEL_META[modelId].label}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{MODEL_META[modelId].summary}</div>
        </div>
      </div>

      {/* Top-Right Compact Actions */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        {user && (
          <button
            type="button"
            onClick={handleSavePreset}
            className="px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors"
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-sky-400" />
            {savingNotice ? savingNotice : 'Save Preset'}
          </button>
        )}
        <button
          type="button"
          onClick={() => setControlsOpen((v) => !v)}
          className="px-3 py-1.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-700 text-slate-100 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors"
        >
          {controlsOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {controlsOpen ? 'Hide Controls' : 'Show Controls'}
        </button>
      </div>

      {/* Single Collapsible Bottom Control Dock (no backdrop-filter over WebGL) */}
      {controlsOpen && (
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-slate-950/92 border border-slate-800 rounded-xl px-4 py-3 text-slate-100">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            {/* 1. Composite Model Selector */}
            <div>
              <div className="text-[11px] font-medium text-slate-400 mb-1.5">Assembly Model</div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(MODEL_META) as ModelId[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setModelId(id)}
                    className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                      modelId === id
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {MODEL_META[id].label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. PBR Material Finish & Explode */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-slate-400">
                  Explode View
                </span>
                <span className="text-[11px] font-mono tabular-nums text-slate-300">
                  {Math.round(explodeAmount * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={explodeAmount}
                onChange={(e) => setExplodeAmount(parseFloat(e.target.value))}
                className="w-full accent-sky-400 cursor-pointer"
              />
            </div>

            {/* 3. Material Swatches & Lighting */}
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">Finish</div>
                <div className="flex items-center gap-1.5">
                  {(Object.keys(FINISH_PALETTES) as FinishId[]).map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      title={FINISH_PALETTES[fid].label}
                      onClick={() => setFinishId(fid)}
                      className={`w-6 h-6 rounded-md border transition-transform ${
                        finishId === fid
                          ? 'border-sky-400 scale-110'
                          : 'border-slate-700 hover:scale-105'
                      }`}
                      style={{ backgroundColor: FINISH_PALETTES[fid].swatch }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-medium text-slate-400 mb-1.5">Environment</div>
                <select
                  value={lightingId}
                  onChange={(e) => setLightingId(e.target.value as LightingId)}
                  className="bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                >
                  {(Object.keys(LIGHTING_PRESETS) as LightingId[]).map((lid) => (
                    <option key={lid} value={lid}>
                      {LIGHTING_PRESETS[lid].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. Camera Presets & Orbit Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-medium text-slate-400">Camera View</span>
                <button
                  type="button"
                  onClick={() => setAutoOrbit((v) => !v)}
                  className={`text-[11px] font-medium inline-flex items-center gap-1 ${
                    autoOrbit ? 'text-sky-400' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  {autoOrbit ? 'Auto-Orbit On' : 'Auto-Orbit Off'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((cid) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => applyCameraPreset(cid)}
                    className={`px-2 py-1 text-[11px] rounded-md font-medium transition-colors ${
                      cameraPreset === cid
                        ? 'bg-slate-100 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {CAMERA_PRESETS[cid].label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
