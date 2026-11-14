import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  BookmarkCheck,
  Eye,
  EyeOff,
  Pause,
  Play,
  RotateCcw,
  Wind,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveCreation } from '../../lib/firebase';
import {
  getCpcbTier,
  getTierColors,
  type PortalLang,
  type StationTelemetry,
} from '../../data/indiaStations';

type TwinModelId = 'caaqms' | 'smogtower' | 'lidar';
type CameraPresetId = 'hero' | 'top' | 'detail' | 'low';

interface TwinModelMeta {
  label: string;
  partsLabel: string;
  description: string;
}

const TWIN_MODELS: Record<TwinModelId, TwinModelMeta> = {
  caaqms: {
    label: 'CAAQMS Tower',
    partsLabel: '9-part reference monitoring rig',
    description:
      'Step plinth, shelter, cyclone PM2.5 inlet, 3-cup anemometer, solar wings & calibration mast',
  },
  smogtower: {
    label: 'HEPA Smog Tower',
    partsLabel: '8-part urban filtration purifier',
    description:
      'Slatted intake base, Venturi cowling, internal HEPA cartridge core, impeller & clean-air ring',
  },
  lidar: {
    label: 'Aerosol Lidar Pod',
    partsLabel: '8-part optical inversion scanner',
    description:
      'Leveling tripod, azimuth yoke, dual optical telescopes, cooling fins & telemetry dome',
  },
};

const CAMERA_PRESETS: Record<
  CameraPresetId,
  { label: string; pos: [number, number, number]; target: [number, number, number] }
> = {
  hero: { label: 'Hero 3/4', pos: [4.8, 3.2, 5.1], target: [0, 1.35, 0] },
  top: { label: 'Top Plan', pos: [0.01, 6.8, 0.25], target: [0, 1.0, 0] },
  detail: { label: 'Sensor Detail', pos: [2.4, 2.05, 2.5], target: [0, 1.65, 0] },
  low: { label: 'Low Angle', pos: [3.9, 0.9, 3.7], target: [0, 1.5, 0] },
};

function createSolarTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#0a1f3d';
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
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function createPadTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#1b2838';
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
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.32)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(256, 256, 190, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(256, 256, 120, 0, Math.PI * 2);
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
    const grad = ctx.createRadialGradient(128, 128, 14, 128, 128, 122);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.65)');
    grad.addColorStop(0.55, 'rgba(2, 6, 23, 0.25)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function registerPart(
  root: THREE.Group,
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
  root.add(obj);
}

function groundGroupToPlinth(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group);
  if (Number.isFinite(box.min.y)) {
    const offset = -box.min.y + 0.02;
    group.children.forEach((child) => {
      if (child.userData.basePos instanceof THREE.Vector3) {
        child.position.y += offset;
        child.userData.basePos.y += offset;
      }
    });
  }
}

interface SharedMats {
  alloy: THREE.MeshStandardMaterial;
  emerald: THREE.MeshStandardMaterial;
  concrete: THREE.MeshStandardMaterial;
  darkSteel: THREE.MeshStandardMaterial;
  solar: THREE.MeshStandardMaterial;
  glass: THREE.MeshPhysicalMaterial;
  hepaFilter: THREE.MeshStandardMaterial;
}

function buildStationTwinModel(
  modelId: TwinModelId,
  mats: SharedMats
): { root: THREE.Group; spinner: THREE.Object3D | null } {
  const root = new THREE.Group();
  let spinner: THREE.Object3D | null = null;

  if (modelId === 'caaqms') {
    // 1. Concrete Foundation Plinth
    const plinth = new THREE.Mesh(
      new THREE.CylinderGeometry(1.15, 1.32, 0.22, 8),
      mats.concrete
    );
    plinth.position.set(0, 0.11, 0);
    registerPart(root, plinth, new THREE.Vector3(0, -0.18, 0));

    // 2. Beveled Weatherproof Analyzer Shelter (ExtrudeGeometry)
    const shelterShape = new THREE.Shape();
    shelterShape.moveTo(-0.56, -0.45);
    shelterShape.lineTo(0.56, -0.45);
    shelterShape.lineTo(0.56, 0.45);
    shelterShape.lineTo(-0.56, 0.45);
    shelterShape.closePath();
    const shelterGeo = new THREE.ExtrudeGeometry(shelterShape, {
      depth: 0.95,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.04,
      bevelSegments: 2,
    });
    shelterGeo.rotateX(-Math.PI / 2);
    const shelter = new THREE.Mesh(shelterGeo, mats.alloy);
    shelter.position.set(0, 0.24, 0);
    registerPart(root, shelter, new THREE.Vector3(0, 0, 0));

    // 3. Recessed Status & Calibration Display Bay
    const displayFrame = new THREE.Mesh(
      new THREE.BoxGeometry(0.56, 0.34, 0.06),
      mats.darkSteel
    );
    displayFrame.position.set(0, 0.78, 0.48);
    registerPart(root, displayFrame, new THREE.Vector3(0, 0, 0.42));

    const displayGlass = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.24, 0.04),
      mats.glass
    );
    displayGlass.position.set(0, 0.78, 0.5);
    registerPart(root, displayGlass, new THREE.Vector3(0, 0, 0.65), false);

    // 4. Primary Galvanized Mast
    const mast = new THREE.Mesh(
      new THREE.CylinderGeometry(0.065, 0.085, 1.95, 16),
      mats.darkSteel
    );
    mast.position.set(0, 2.15, 0);
    registerPart(root, mast, new THREE.Vector3(0, 0.35, 0));

    // 5. Louvered PM2.5 Cyclone Sampling Head (LatheGeometry)
    const inletPts = [
      new THREE.Vector2(0.08, 0),
      new THREE.Vector2(0.24, 0.05),
      new THREE.Vector2(0.24, 0.22),
      new THREE.Vector2(0.16, 0.27),
      new THREE.Vector2(0.26, 0.32),
      new THREE.Vector2(0.03, 0.44),
    ];
    const cycloneHead = new THREE.Mesh(
      new THREE.LatheGeometry(inletPts, 24),
      mats.alloy
    );
    cycloneHead.position.set(-0.42, 2.28, 0);
    registerPart(root, cycloneHead, new THREE.Vector3(-0.62, 0.62, 0));

    // 6. Sampling Crossarm + Conduit Tube
    const crossArmCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 1.25, 0),
      new THREE.Vector3(-0.22, 1.75, 0),
      new THREE.Vector3(-0.42, 2.05, 0),
      new THREE.Vector3(-0.42, 2.28, 0),
    ]);
    const conduit = new THREE.Mesh(
      new THREE.TubeGeometry(crossArmCurve, 20, 0.03, 10, false),
      mats.emerald
    );
    registerPart(root, conduit, new THREE.Vector3(-0.35, 0.35, 0));

    // 7. Dual Solar Photovoltaic Wings
    [-1, 1].forEach((dir) => {
      const wing = new THREE.Group();
      const strut = new THREE.Mesh(
        new THREE.CylinderGeometry(0.028, 0.028, 0.85, 10),
        mats.darkSteel
      );
      strut.rotation.z = Math.PI / 2;
      strut.position.x = dir * 0.42;
      const panel = new THREE.Mesh(
        new THREE.BoxGeometry(0.76, 0.035, 0.52),
        mats.solar
      );
      panel.position.x = dir * 0.68;
      wing.add(strut, panel);
      wing.position.set(dir * 0.1, 1.72, 0.12);
      wing.rotation.x = 0.48;
      registerPart(root, wing, new THREE.Vector3(dir * 0.72, 0.15, 0.25));
    });

    // 8. 3-Cup Ultrasonic / Mechanical Anemometer Spinner
    const anemometer = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.16, 12),
      mats.emerald
    );
    anemometer.add(hub);
    for (let i = 0; i < 3; i++) {
      const angle = (i / 3) * Math.PI * 2;
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.015, 0.34, 8),
        mats.alloy
      );
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = angle;
      arm.position.set(Math.cos(angle) * 0.17, 0.02, -Math.sin(angle) * 0.17);
      const cup = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 14, 10, 0, Math.PI),
        mats.emerald
      );
      cup.position.set(Math.cos(angle) * 0.35, 0.02, -Math.sin(angle) * 0.35);
      cup.rotation.y = angle + Math.PI / 2;
      anemometer.add(arm, cup);
    }
    anemometer.position.set(0, 3.2, 0);
    registerPart(root, anemometer, new THREE.Vector3(0, 0.95, 0));
    spinner = anemometer;
  } else if (modelId === 'smogtower') {
    // 1. Octagonal Intake Plinth
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.45, 1.62, 0.28, 8),
      mats.concrete
    );
    base.position.set(0, 0.14, 0);
    registerPart(root, base, new THREE.Vector3(0, -0.25, 0));

    // 2. Slatted Intake Louver Core
    const intake = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.15, 0.75, 16),
      mats.darkSteel
    );
    intake.position.set(0, 0.65, 0);
    registerPart(root, intake, new THREE.Vector3(0, 0, 0));

    // 3. Internal Pleated HEPA Cartridge (Visible on Explode)
    const hepa = new THREE.Mesh(
      new THREE.CylinderGeometry(0.84, 0.84, 1.25, 24),
      mats.hepaFilter
    );
    hepa.position.set(0, 1.35, 0);
    registerPart(root, hepa, new THREE.Vector3(0, 0.65, 0.85));

    // 4. Venturi Turbine Cowling (LatheGeometry)
    const cowlPts = [
      new THREE.Vector2(1.16, 0),
      new THREE.Vector2(1.08, 0.45),
      new THREE.Vector2(0.74, 1.15),
      new THREE.Vector2(0.82, 1.75),
      new THREE.Vector2(1.04, 2.05),
    ];
    const cowling = new THREE.Mesh(
      new THREE.LatheGeometry(cowlPts, 32),
      new THREE.MeshStandardMaterial({
        color: mats.alloy.color.getHex(),
        roughness: 0.3,
        metalness: 0.72,
        side: THREE.DoubleSide,
      })
    );
    cowling.position.set(0, 1.0, 0);
    registerPart(root, cowling, new THREE.Vector3(0, 0.4, 0));

    // 5. Internal Axial Turbine Impeller
    const rotor = new THREE.Group();
    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.38, 16),
      mats.emerald
    );
    rotor.add(nose);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.03, 0.16),
        mats.alloy
      );
      blade.position.set(Math.cos(a) * 0.36, -0.05, Math.sin(a) * 0.36);
      blade.rotation.y = -a;
      blade.rotation.x = 0.42;
      rotor.add(blade);
    }
    rotor.position.set(0, 2.25, 0);
    registerPart(root, rotor, new THREE.Vector3(0, 0.9, 0));
    spinner = rotor;

    // 6. Clean-Air Diffuser Crown Ring
    const diffuser = new THREE.Mesh(
      new THREE.TorusGeometry(0.95, 0.11, 16, 40),
      mats.emerald
    );
    diffuser.rotation.x = Math.PI / 2;
    diffuser.position.set(0, 3.08, 0);
    registerPart(root, diffuser, new THREE.Vector3(0, 1.25, 0));

    // 7. 4 External Structural Buttresses
    const ribs = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const rib = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 2.4, 0.16),
        mats.darkSteel
      );
      rib.position.set(Math.cos(a) * 1.15, 1.5, Math.sin(a) * 1.15);
      rib.rotation.y = -a;
      ribs.add(rib);
    }
    registerPart(root, ribs, new THREE.Vector3(0, 0.2, 0));

    // 8. Top Telemetry Sensor Beacon
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 20, 16),
      mats.glass
    );
    beacon.position.set(0, 3.24, 0);
    registerPart(root, beacon, new THREE.Vector3(0, 1.55, 0), false);
  } else {
    // Aerosol Lidar Dispersion Pod (8 parts)
    // 1. Tripod Leveling Base
    const tripod = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      const leg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.08, 1.15, 12),
        mats.darkSteel
      );
      leg.position.set(Math.cos(a) * 0.52, 0.48, Math.sin(a) * 0.52);
      leg.lookAt(0, 1.1, 0);
      leg.rotateX(Math.PI / 2);
      tripod.add(leg);
    }
    registerPart(root, tripod, new THREE.Vector3(0, -0.22, 0));

    // 2. Azimuth Turntable Deck
    const deck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.65, 0.72, 0.18, 24),
      mats.alloy
    );
    deck.position.set(0, 1.05, 0);
    registerPart(root, deck, new THREE.Vector3(0, 0, 0));

    // 3. Gimbal Yoke Arms
    const yoke = new THREE.Mesh(
      new THREE.TorusGeometry(0.62, 0.08, 12, 28, Math.PI),
      mats.darkSteel
    );
    yoke.rotation.z = Math.PI;
    yoke.position.set(0, 1.72, 0);
    registerPart(root, yoke, new THREE.Vector3(0, 0.28, 0));

    // 4. Beveled Optical Chassis
    const chassis = new THREE.Mesh(
      new THREE.BoxGeometry(0.88, 0.62, 0.92),
      mats.alloy
    );
    chassis.position.set(0, 1.82, 0);
    registerPart(root, chassis, new THREE.Vector3(0, 0.45, 0));

    // 5. Primary Laser Emitter Barrel (Lathe)
    const barrelPts = [
      new THREE.Vector2(0.16, 0),
      new THREE.Vector2(0.22, 0.15),
      new THREE.Vector2(0.22, 0.85),
      new THREE.Vector2(0.26, 0.95),
    ];
    const emitter = new THREE.Mesh(
      new THREE.LatheGeometry(barrelPts, 24),
      mats.emerald
    );
    emitter.position.set(-0.2, 2.02, 0.1);
    emitter.rotation.x = 0.22;
    registerPart(root, emitter, new THREE.Vector3(-0.35, 0.85, 0.2));

    // 6. Optical Receiver Lens
    const lens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2, 0.2, 0.12, 24),
      mats.glass
    );
    lens.position.set(0.22, 2.28, 0.16);
    lens.rotation.x = 0.22;
    registerPart(root, lens, new THREE.Vector3(0.35, 0.95, 0.25), false);

    // 7. Side Solar Tracker Plate
    const tracker = new THREE.Mesh(
      new THREE.BoxGeometry(0.92, 0.04, 0.56),
      mats.solar
    );
    tracker.position.set(0.95, 1.48, 0);
    tracker.rotation.z = -0.45;
    registerPart(root, tracker, new THREE.Vector3(0.75, 0.1, 0));

    // 8. Rotating Calibration Scanner Dome
    const dome = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.18, 0.25, 16),
      mats.emerald
    );
    dome.position.set(0, 2.38, -0.28);
    registerPart(root, dome, new THREE.Vector3(0, 1.05, -0.35));
    spinner = dome;
  }

  groundGroupToPlinth(root);
  return { root, spinner };
}

function getAtmoMoodFromAqi(aqi: number): {
  bgHex: number;
  fogDensity: number;
  particleHex: number;
  label: string;
} {
  if (aqi <= 50) {
    return {
      bgHex: 0x0f2738,
      fogDensity: 0.018,
      particleHex: 0x34d399,
      label: 'Clear Marine / Mountain Air',
    };
  }
  if (aqi <= 150) {
    return {
      bgHex: 0x162235,
      fogDensity: 0.028,
      particleHex: 0x60a5fa,
      label: 'Moderate Urban Haze',
    };
  }
  if (aqi <= 250) {
    return {
      bgHex: 0x221f26,
      fogDensity: 0.04,
      particleHex: 0xf59e0b,
      label: 'Elevated Particulate Plume',
    };
  }
  return {
    bgHex: 0x281b1c,
    fogDensity: 0.056,
    particleHex: 0xf87171,
    label: 'Dense Winter Inversion Trap',
  };
}

export function ThreeDispersionLabView({
  stations,
  focusedStation,
  onSelectStation,
  lang,
}: {
  stations: StationTelemetry[];
  focusedStation: StationTelemetry;
  onSelectStation: (st: StationTelemetry) => void;
  lang: PortalLang;
}) {
  const { user } = useAuth();
  const mountRef = useRef<HTMLDivElement | null>(null);

  const [modelId, setModelId] = useState<TwinModelId>('caaqms');
  const [explodeAmount, setExplodeAmount] = useState<number>(0);
  const [simPlaying, setSimPlaying] = useState<boolean>(true);
  const [autoOrbit, setAutoOrbit] = useState<boolean>(true);
  const [cameraPreset, setCameraPreset] = useState<CameraPresetId>('hero');
  const [controlsOpen, setControlsOpen] = useState<boolean>(true);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const stationRef = useRef(focusedStation);
  stationRef.current = focusedStation;

  const explodeTargetRef = useRef(0);
  const simPlayingRef = useRef(true);
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
    mats: SharedMats;
    activeGroup: THREE.Group | null;
    spinner: THREE.Object3D | null;
    particleMat: THREE.MeshStandardMaterial;
    requestRender: () => void;
  } | null>(null);

  useEffect(() => {
    explodeTargetRef.current = explodeAmount;
    sceneRefs.current?.requestRender();
  }, [explodeAmount]);

  useEffect(() => {
    simPlayingRef.current = simPlaying;
    sceneRefs.current?.requestRender();
  }, [simPlaying]);

  useEffect(() => {
    autoOrbitRef.current = autoOrbit;
    if (sceneRefs.current) {
      sceneRefs.current.controls.autoRotate = autoOrbit;
      sceneRefs.current.requestRender();
    }
  }, [autoOrbit]);

  // Keyboard shortcut 'H' to toggle controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'h' || e.key === 'H') &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'SELECT'
      ) {
        setControlsOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Initialize Three.js WebGL stage once on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      const probeCanvas = document.createElement('canvas');
      const probeGl =
        probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      let isSoftwareGl = false;
      if (probeGl) {
        const dbg = probeGl.getExtension('WEBGL_debug_renderer_info');
        const rendererStr = String(
          probeGl.getParameter(dbg ? dbg.UNMASKED_RENDERER_WEBGL : probeGl.RENDERER) ?? ''
        );
        isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(
          rendererStr
        );
      }

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(
        isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      );
      renderer.setSize(container.clientWidth || 960, container.clientHeight || 640);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const mood = getAtmoMoodFromAqi(stationRef.current.aqi);
      scene.background = new THREE.Color(mood.bgHex);
      scene.fog = new THREE.FogExp2(mood.bgHex, mood.fogDensity);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;

      const camera = new THREE.PerspectiveCamera(
        42,
        (container.clientWidth || 960) / (container.clientHeight || 640),
        0.1,
        100
      );
      camera.position.set(...CAMERA_PRESETS.hero.pos);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...CAMERA_PRESETS.hero.target);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minDistance = 2.1;
      controls.maxDistance = 14.5;
      controls.maxPolarAngle = Math.PI * 0.49;
      controls.autoRotate = autoOrbitRef.current;
      controls.autoRotateSpeed = 0.65;
      controls.update();

      // Lighting
      const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.35);
      keyLight.position.set(5.5, 8.8, 5.2);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 26;
      const s = 3.8;
      keyLight.shadow.camera.left = -s;
      keyLight.shadow.camera.right = s;
      keyLight.shadow.camera.top = s;
      keyLight.shadow.camera.bottom = -s;
      keyLight.shadow.bias = -0.0005;
      scene.add(keyLight);

      const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.8);
      scene.add(hemiLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.9);
      rimLight.position.set(-5.2, 4.2, -5.4);
      scene.add(rimLight);

      const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
      const padTex = createPadTexture(maxAniso);
      const solarTex = createSolarTexture(maxAniso);
      const shadowTex = createContactShadowTexture();

      // Ground Plinth & Contact Shadow
      const plinthPad = new THREE.Mesh(
        new THREE.CylinderGeometry(3.6, 3.85, 0.08, 48),
        new THREE.MeshStandardMaterial({
          map: padTex,
          roughness: 0.78,
          metalness: 0.22,
        })
      );
      plinthPad.position.y = -0.04;
      plinthPad.receiveShadow = true;
      scene.add(plinthPad);

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

      const mats: SharedMats = {
        alloy: new THREE.MeshStandardMaterial({
          color: 0xdbe4ee,
          roughness: 0.28,
          metalness: 0.86,
        }),
        emerald: new THREE.MeshStandardMaterial({
          color: 0x059669,
          roughness: 0.34,
          metalness: 0.55,
        }),
        concrete: new THREE.MeshStandardMaterial({
          color: 0x64748b,
          roughness: 0.88,
          metalness: 0.06,
        }),
        darkSteel: new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          roughness: 0.42,
          metalness: 0.82,
        }),
        solar: new THREE.MeshStandardMaterial({
          map: solarTex,
          roughness: 0.2,
          metalness: 0.45,
        }),
        glass: new THREE.MeshPhysicalMaterial({
          color: 0x93c5fd,
          roughness: 0.08,
          metalness: 0.1,
          transmission: 0.6,
          transparent: true,
          opacity: 0.74,
        }),
        hepaFilter: new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.85,
          metalness: 0.05,
        }),
      };

      const built = buildStationTwinModel('caaqms', mats);
      scene.add(built.root);

      // InstancedMesh Atmospheric Particulate Dispersion Field (zero per-frame allocations)
      const PARTICLE_COUNT = 160;
      const particleGeo = new THREE.SphereGeometry(0.032, 8, 8);
      const particleMat = new THREE.MeshStandardMaterial({
        color: mood.particleHex,
        roughness: 0.4,
        metalness: 0.1,
        emissive: mood.particleHex,
        emissiveIntensity: 0.35,
      });
      const particlesMesh = new THREE.InstancedMesh(
        particleGeo,
        particleMat,
        PARTICLE_COUNT
      );
      const particleSeeds = Array.from({ length: PARTICLE_COUNT }, () => ({
        x: (Math.random() - 0.5) * 7.0,
        yNorm: Math.random(),
        z: (Math.random() - 0.5) * 7.0,
        speed: 0.6 + Math.random() * 0.9,
        scale: 0.55 + Math.random() * 0.9,
        phase: Math.random() * Math.PI * 2,
      }));
      // Pre-allocated scratch objects outside loop
      const _mat = new THREE.Matrix4();
      const _pos = new THREE.Vector3();
      const _quat = new THREE.Quaternion();
      const _scale = new THREE.Vector3();

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const sd = particleSeeds[i];
        _pos.set(sd.x, 0.35 + sd.yNorm * 3.1, sd.z);
        _scale.setScalar(sd.scale);
        _mat.compose(_pos, _quat, _scale);
        particlesMesh.setMatrixAt(i, _mat);
      }
      particlesMesh.instanceMatrix.needsUpdate = true;
      particlesMesh.computeBoundingSphere();
      scene.add(particlesMesh);

      let frameHandle = 0;
      let timerHandle = 0;
      let dirty = true;
      let prevTime = performance.now();
      let simClock = 0;
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

        // Particulate dispersion plume + anemometer spin
        const st = stationRef.current;
        const activeCount = Math.max(
          25,
          Math.min(PARTICLE_COUNT, Math.round((st.aqi / 350) * PARTICLE_COUNT))
        );
        const windSpeedNorm = Math.max(0.25, st.windKmh / 6.0);
        const ceilingHeight = Math.min(3.8, Math.max(1.35, 1.2 + st.windKmh * 0.2));

        if (simPlayingRef.current) {
          simClock += dt;
          if (sceneRefs.current?.spinner) {
            sceneRefs.current.spinner.rotation.y += dt * (1.2 + windSpeedNorm * 1.4);
          }
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            if (i >= activeCount) {
              _pos.set(0, -10, 0);
              _scale.setScalar(0);
            } else {
              const sd = particleSeeds[i];
              sd.x += dt * windSpeedNorm * 0.55 * sd.speed;
              if (sd.x > 3.6) sd.x = -3.6;
              const y =
                0.28 +
                sd.yNorm * ceilingHeight +
                Math.sin(simClock * 1.4 + sd.phase) * 0.14;
              _pos.set(sd.x, y, sd.z + Math.cos(simClock * 0.8 + sd.phase) * 0.08);
              _scale.setScalar(sd.scale * (st.aqi > 250 ? 1.25 : 0.9));
            }
            _mat.compose(_pos, _quat, _scale);
            particlesMesh.setMatrixAt(i, _mat);
          }
          particlesMesh.instanceMatrix.needsUpdate = true;
          needsMore = true;
        }

        if (controls.autoRotate || controls.enableDamping) {
          controls.update();
        }

        renderer.render(scene, camera);

        if (needsMore || controls.autoRotate || dirty) {
          dirty = false;
          if (isSoftwareGl) {
            timerHandle = window.setTimeout(() => {
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
        mats,
        activeGroup: built.root,
        spinner: built.spinner,
        particleMat,
        requestRender,
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
        if (timerHandle) clearTimeout(timerHandle);
        controls.removeEventListener('start', onControlStart);
        controls.removeEventListener('change', onControlChange);
        controls.dispose();
        pmrem.dispose();
        envTex.dispose();
        padTex.dispose();
        solarTex.dispose();
        shadowTex.dispose();
        particleGeo.dispose();
        particleMat.dispose();
        Object.values(mats).forEach((m) => m.dispose());
        renderer.dispose();
        if (renderer.domElement.parentElement === container) {
          container.removeChild(renderer.domElement);
        }
        sceneRefs.current = null;
      };
    } catch (err) {
      setWebglError(
        err instanceof Error ? err.message : 'Unable to initialize 3D WebGL stage.'
      );
      return undefined;
    }
  }, []);

  // Swap 3D station / purifier model when modelId changes
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
    const built = buildStationTwinModel(modelId, refs.mats);
    refs.activeGroup = built.root;
    refs.spinner = built.spinner;
    refs.scene.add(built.root);
    refs.requestRender();
  }, [modelId]);

  // Update atmospheric haze, fog & particle plume color whenever focusedStation updates
  useEffect(() => {
    const refs = sceneRefs.current;
    if (!refs) return;
    const mood = getAtmoMoodFromAqi(focusedStation.aqi);
    refs.scene.background = new THREE.Color(mood.bgHex);
    refs.scene.fog = new THREE.FogExp2(mood.bgHex, mood.fogDensity);
    refs.particleMat.color.setHex(mood.particleHex);
    refs.particleMat.emissive.setHex(mood.particleHex);
    refs.requestRender();
  }, [focusedStation]);

  const applyCameraPreset = (preset: CameraPresetId) => {
    setCameraPreset(preset);
    const cfg = CAMERA_PRESETS[preset];
    cameraGoalRef.current = {
      pos: new THREE.Vector3(...cfg.pos),
      target: new THREE.Vector3(...cfg.target),
      active: true,
    };
    sceneRefs.current?.requestRender();
  };

  const handleSavePreset = async () => {
    if (!user) return;
    await saveCreation({
      ownerId: user.uid,
      kind: 'scene_preset',
      title: `3D Twin: ${focusedStation.city} · ${TWIN_MODELS[modelId].label}`,
      content: `City: ${focusedStation.city} (AQI ${focusedStation.aqi} ${getCpcbTier(focusedStation.aqi)})\nModel: ${TWIN_MODELS[modelId].label}\nWind Dispersion: ${focusedStation.windKmh} km/h\nExploded Assembly: ${Math.round(explodeAmount * 100)}%\nCamera: ${CAMERA_PRESETS[cameraPreset].label}`,
      modelUsed: 'three.js-dispersion-twin',
    });
    setSavedNotice('Saved to Cloud Watchlist');
    setTimeout(() => setSavedNotice(null), 2600);
  };

  const tier = getCpcbTier(focusedStation.aqi);
  const tierColors = getTierColors(tier);
  const atmoMood = useMemo(
    () => getAtmoMoodFromAqi(focusedStation.aqi),
    [focusedStation.aqi]
  );

  if (webglError) {
    return (
      <div className="max-w-3xl mx-auto my-12 bg-white border border-[#bdc9c1] rounded-xl p-10 text-center">
        <h2 className="text-base font-bold text-[#0b1c30]">
          3D Dispersion Lab Unavailable
        </h2>
        <p className="text-xs text-[#3e4943] mt-2">{webglError}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-8">
      <div className="relative w-full min-h-[640px] h-[calc(100vh-175px)] rounded-xl overflow-hidden border border-[#bdc9c1]/60 bg-[#0b1c30]">
        {/* Dedicated Three.js WebGL Mount */}
        <div
          ref={mountRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        />

        {/* Top-Left Compact Live Station + Atmospheric Readout (no backdrop-blur) */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none max-w-sm">
          <div className="bg-[#0b1c30]/94 border border-[#334155] rounded-xl px-4 py-3 text-white space-y-1.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold tracking-tight truncate">
                {focusedStation.city} — {TWIN_MODELS[modelId].label}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums shrink-0"
                style={{ backgroundColor: tierColors.hex, color: '#ffffff' }}
              >
                AQI {focusedStation.aqi} · {tier}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 tabular-nums flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <Wind className="w-3 h-3 text-emerald-400" />
                {focusedStation.windKmh} km/h
              </span>
              <span>PM2.5: {focusedStation.pm25} µg/m³</span>
              <span>{atmoMood.label}</span>
            </div>
          </div>
        </div>

        {/* Top-Right Compact Actions */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
          {user && (
            <button
              type="button"
              onClick={() => void handleSavePreset()}
              className="px-3 py-1.5 bg-[#0b1c30]/94 hover:bg-[#1e293b] border border-[#334155] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
            >
              <BookmarkCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{savedNotice || (lang === 'hi' ? 'प्रीसेट सहेजें' : 'Save 3D Preset')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setControlsOpen((v) => !v)}
            className="px-3 py-1.5 bg-[#0b1c30]/94 hover:bg-[#1e293b] border border-[#334155] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors"
          >
            {controlsOpen ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{controlsOpen ? 'Hide Controls' : 'Show Controls'}</span>
          </button>
        </div>

        {/* Single Collapsible Bottom Control Dock (solid surface, zero backdrop-filter) */}
        {controlsOpen && (
          <div className="absolute bottom-4 left-4 right-4 z-10 bg-[#0b1c30]/94 border border-[#334155] rounded-xl px-4 py-3 text-white">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              {/* 1. Station Atmospheric Context Selector */}
              <div className="md:col-span-3 space-y-1">
                <label
                  htmlFor="twinCitySelect"
                  className="block text-[10px] uppercase tracking-wider font-bold text-slate-400"
                >
                  Simulated City Telemetry
                </label>
                <select
                  id="twinCitySelect"
                  value={focusedStation.code}
                  onChange={(e) => {
                    const next = stations.find((s) => s.code === e.target.value);
                    if (next) onSelectStation(next);
                  }}
                  className="w-full bg-[#16263d] border border-[#334155] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                >
                  {stations.map((s) => (
                    <option key={s.code} value={s.code}>
                      {s.city} (AQI {s.aqi} · {s.windKmh} km/h)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Composite Model Switcher */}
              <div className="md:col-span-4 space-y-1">
                <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  3D Infrastructure Assembly
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TWIN_MODELS) as TwinModelId[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModelId(id)}
                      className={`px-2.5 py-1.5 text-xs rounded-lg font-semibold transition-colors ${
                        modelId === id
                          ? 'bg-[#047857] text-[#9ffdd3]'
                          : 'bg-[#16263d] text-slate-300 hover:bg-[#1e3250]'
                      }`}
                    >
                      {TWIN_MODELS[id].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Explode View + Plume Simulation */}
              <div className="md:col-span-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Explode View</span>
                  <span className="font-mono tabular-nums text-emerald-300">
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
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={() => setSimPlaying((v) => !v)}
                  className="text-[11px] font-semibold text-slate-300 hover:text-white inline-flex items-center gap-1"
                >
                  {simPlaying ? (
                    <>
                      <Pause className="w-3 h-3 text-emerald-400" />
                      Plume Sim Running
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 text-amber-400" />
                      Plume Sim Paused
                    </>
                  )}
                </button>
              </div>

              {/* 4. Camera Presets & Auto-Orbit */}
              <div className="md:col-span-3 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 font-semibold">Camera Presets</span>
                  <button
                    type="button"
                    onClick={() => setAutoOrbit((v) => !v)}
                    className={`inline-flex items-center gap-1 font-semibold ${
                      autoOrbit ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {autoOrbit ? 'Orbit On' : 'Orbit Off'}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(CAMERA_PRESETS) as CameraPresetId[]).map((cid) => (
                    <button
                      key={cid}
                      type="button"
                      onClick={() => applyCameraPreset(cid)}
                      className={`px-2 py-1 text-[11px] rounded-md font-semibold transition-colors ${
                        cameraPreset === cid
                          ? 'bg-white text-[#0b1c30]'
                          : 'bg-[#16263d] text-slate-300 hover:bg-[#1e3250]'
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
    </div>
  );
}
