// Phase 5の3D閲覧画面。Three.jsはApp側のReact.lazyから読み込まれるため、
// 2D編集画面の初期表示へ3D依存を持ち込まない。

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { AppState } from "../state/appState";
import {
  buildScene3D,
  defaultFirstPersonPose,
  firstPersonPoseForObject,
  objectBaseElevationMm,
  rotateFirstPersonPose,
  shouldUpdateOrbitControls,
  type FirstPersonPose,
  type Scene3DBackgroundPlane,
  type Scene3DModel,
  type Scene3DPrimitive,
} from "../core/scene3d";

const MM_TO_M = 0.001;
type CameraMode = "orbit" | "firstPerson";
type FloorMode = "grid" | "plain" | "background";
type EyePreset = "seated" | "standing" | "conductor" | "custom";

interface Props {
  state: AppState;
  onClose: () => void;
  onNotice: (message: string) => void;
}

interface FirstPersonPointer {
  pointerId: number;
  startX: number;
  startY: number;
  startPose: FirstPersonPose;
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (Array.isArray(mesh.material)) mesh.material.forEach((material) => material.dispose());
    else if (mesh.material) mesh.material.dispose();
  });
}

function colorForPrimitive(primitive: Scene3DPrimitive): number {
  if (primitive.kind === "wall") return 0x59636e;
  if (primitive.kind === "avatar") return primitive.avatarKind === "standing" ? 0xd97706 : 0x7c3aed;
  if (primitive.objectType === "riser") return 0x986b43;
  if (primitive.objectType === "chair") return 0x2f855a;
  if (primitive.objectType === "musicStand") return 0x2563eb;
  if (primitive.objectType === "instrument") return 0xb45309;
  return 0x3478b8;
}

function addPrimitive(root: THREE.Group, primitive: Scene3DPrimitive) {
  const base = primitive.baseHeightMm * MM_TO_M;
  const height = Math.max(1, primitive.heightMm) * MM_TO_M;
  const width = Math.max(1, primitive.widthMm) * MM_TO_M;
  const depth = Math.max(1, primitive.depthMm) * MM_TO_M;
  const color = colorForPrimitive(primitive);

  if (primitive.kind === "avatar") {
    const avatar = new THREE.Group();
    const bodyHeight = height * 0.62;
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(width * 0.42, width * 0.5, bodyHeight, 12),
      new THREE.MeshStandardMaterial({ color }),
    );
    body.position.y = base + bodyHeight / 2;
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(width * 0.34, height * 0.1), 16, 12),
      new THREE.MeshStandardMaterial({ color: 0xf2c7a5 }),
    );
    head.position.y = base + height - head.geometry.parameters.radius;
    avatar.add(body, head);
    avatar.position.set(primitive.xMm * MM_TO_M, 0, primitive.yMm * MM_TO_M);
    avatar.rotation.y = -(primitive.rotationDeg * Math.PI) / 180;
    root.add(avatar);
    return;
  }

  const geometry = primitive.shape === "cylinder"
    ? new THREE.CylinderGeometry(0.5, 0.5, height, 24)
    : new THREE.BoxGeometry(width, height, depth);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color, transparent: true, opacity: primitive.kind === "wall" ? 0.92 : 0.82 }),
  );
  if (primitive.shape === "cylinder") {
    mesh.scale.set(width, 1, depth);
  }
  mesh.position.set(
    primitive.xMm * MM_TO_M,
    base + height / 2,
    primitive.yMm * MM_TO_M,
  );
  mesh.rotation.y = -(primitive.rotationDeg * Math.PI) / 180;
  mesh.userData.objectId = primitive.id;
  root.add(mesh);
}

function buildThreeGroup(model: Scene3DModel, floorMode: FloorMode): THREE.Group {
  const root = new THREE.Group();
  root.name = "stage-layout-model";
  const widthMm = Math.max(1000, model.bounds.maxXMm - model.bounds.minXMm);
  const depthMm = Math.max(1000, model.bounds.maxYMm - model.bounds.minYMm);
  const width = widthMm * MM_TO_M;
  const depth = depthMm * MM_TO_M;
  const centerX = (model.bounds.minXMm + model.bounds.maxXMm) / 2 * MM_TO_M;
  const centerY = (model.bounds.minYMm + model.bounds.maxYMm) / 2 * MM_TO_M;
  const background = floorMode === "background" ? model.backgroundPlane : null;
  const floorWidth = (background?.widthMm ?? widthMm) * MM_TO_M;
  const floorDepth = (background?.depthMm ?? depthMm) * MM_TO_M;
  const floorCenterX = (background?.xMm ?? centerX / MM_TO_M) * MM_TO_M;
  const floorCenterY = (background?.yMm ?? centerY / MM_TO_M) * MM_TO_M;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(floorWidth, floorDepth),
    new THREE.MeshStandardMaterial({
      color: floorMode === "plain" ? 0x59636e : background ? 0xffffff : 0x35404d,
      transparent: Boolean(background),
      opacity: background?.opacity ?? 1,
      roughness: 0.92,
    }),
  );
  floor.name = "floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(floorCenterX, -0.02, floorCenterY);
  root.add(floor);

  if (floorMode === "grid") {
    const size = Math.max(width, depth);
    const divisions = Math.min(100, Math.max(2, Math.round(Math.max(widthMm, depthMm) / 910)));
    const grid = new THREE.GridHelper(size, divisions, 0x9aa6b2, 0x617080);
    grid.name = "real-size-grid";
    grid.position.set(centerX, 0, centerY);
    root.add(grid);
  }

  model.primitives.forEach((primitive) => addPrimitive(root, primitive));
  return root;
}

function setOrbitCamera(camera: THREE.PerspectiveCamera, controls: OrbitControls, model: Scene3DModel) {
  const centerX = (model.bounds.minXMm + model.bounds.maxXMm) / 2 * MM_TO_M;
  const centerY = (model.bounds.minYMm + model.bounds.maxYMm) / 2 * MM_TO_M;
  const span = Math.max(
    (model.bounds.maxXMm - model.bounds.minXMm) * MM_TO_M,
    (model.bounds.maxYMm - model.bounds.minYMm) * MM_TO_M,
    8,
  );
  camera.position.set(centerX + span * 0.72, span * 0.82, centerY + span * 0.9);
  camera.near = 0.01;
  camera.far = Math.max(200, span * 12);
  camera.updateProjectionMatrix();
  controls.target.set(centerX, 0, centerY);
  controls.update();
}

function applyFirstPersonCamera(camera: THREE.PerspectiveCamera, pose: FirstPersonPose) {
  const yaw = (pose.yawDeg * Math.PI) / 180;
  const pitch = (pose.pitchDeg * Math.PI) / 180;
  const horizontal = Math.cos(pitch);
  const direction = new THREE.Vector3(
    Math.sin(yaw) * horizontal,
    Math.sin(pitch),
    -Math.cos(yaw) * horizontal,
  );
  camera.position.set(pose.xMm * MM_TO_M, pose.eyeHeightMm * MM_TO_M, pose.yMm * MM_TO_M);
  camera.lookAt(camera.position.clone().add(direction));
}

function eyeHeightForPreset(preset: EyePreset, customMm: number): number {
  if (preset === "standing") return 1600;
  if (preset === "conductor") return 1700;
  if (preset === "custom") return Math.max(300, customMm);
  return 1200;
}

function createBackgroundCanvas(image: HTMLImageElement, plane: Scene3DBackgroundPlane): HTMLCanvasElement {
  const { crop, rotationDeg } = plane;
  const rotated = rotationDeg === 90 || rotationDeg === 270;
  const canvas = document.createElement("canvas");
  canvas.width = rotated ? crop.heightPx : crop.widthPx;
  canvas.height = rotated ? crop.widthPx : crop.heightPx;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("背景画像を3D用テクスチャへ変換できません。");

  if (rotationDeg === 90) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  } else if (rotationDeg === 180) {
    context.translate(canvas.width, canvas.height);
    context.rotate(Math.PI);
  } else if (rotationDeg === 270) {
    context.translate(0, canvas.height);
    context.rotate(-Math.PI / 2);
  }
  context.drawImage(
    image,
    crop.xPx,
    crop.yPx,
    crop.widthPx,
    crop.heightPx,
    0,
    0,
    crop.widthPx,
    crop.heightPx,
  );
  return canvas;
}

interface MiniMapProps {
  model: Scene3DModel;
  pose: FirstPersonPose;
  onMove: (position: { xMm: number; yMm: number }) => void;
}

function MiniMap({ model, pose, onMove }: MiniMapProps) {
  const widthMm = Math.max(1, model.bounds.maxXMm - model.bounds.minXMm);
  const depthMm = Math.max(1, model.bounds.maxYMm - model.bounds.minYMm);

  function handlePointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const xRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const yRatio = Math.min(1, Math.max(0, (event.clientY - rect.top) / Math.max(1, rect.height)));
    onMove({
      xMm: model.bounds.minXMm + xRatio * widthMm,
      yMm: model.bounds.minYMm + yRatio * depthMm,
    });
  }

  return (
    <div className="viewer3d-minimap">
      <h3>視点位置</h3>
      <svg
        className="viewer3d-minimap-canvas"
        viewBox={model.bounds.minXMm + " " + model.bounds.minYMm + " " + widthMm + " " + depthMm}
        preserveAspectRatio="none"
        role="application"
        aria-label="3Dミニマップ。橙色の点が視点位置、線が視線方向。タップした位置へ移動"
        onPointerDown={handlePointerDown}
      >
        <rect x={model.bounds.minXMm} y={model.bounds.minYMm} width={widthMm} height={depthMm} fill="#111827" />
        {model.primitives.filter((primitive) => primitive.kind === "wall").map((primitive) => (
          <rect
            key={primitive.id}
            x={primitive.xMm - primitive.widthMm / 2}
            y={primitive.yMm - primitive.depthMm / 2}
            width={primitive.widthMm}
            height={primitive.depthMm}
            fill="#64748b"
            transform={"rotate(" + primitive.rotationDeg + " " + primitive.xMm + " " + primitive.yMm + ")"}
          />
        ))}
        {model.primitives.filter((primitive) => primitive.kind === "object").map((primitive) => (
          <rect
            key={primitive.id}
            x={primitive.xMm - primitive.widthMm / 2}
            y={primitive.yMm - primitive.depthMm / 2}
            width={primitive.widthMm}
            height={primitive.depthMm}
            fill={primitive.objectType === "chair" ? "#34d399" : "#60a5fa"}
            transform={"rotate(" + primitive.rotationDeg + " " + primitive.xMm + " " + primitive.yMm + ")"}
          />
        ))}
        <line
          x1={pose.xMm}
          y1={pose.yMm}
          x2={pose.xMm + Math.sin((pose.yawDeg * Math.PI) / 180) * Math.max(widthMm, depthMm) * 0.08}
          y2={pose.yMm - Math.cos((pose.yawDeg * Math.PI) / 180) * Math.max(widthMm, depthMm) * 0.08}
          stroke="#f59e0b"
          strokeWidth={Math.max(widthMm, depthMm) * 0.006}
          strokeLinecap="round"
        />
        <circle cx={pose.xMm} cy={pose.yMm} r={Math.max(widthMm, depthMm) * 0.012} fill="#f59e0b" stroke="#fff" strokeWidth={Math.max(widthMm, depthMm) * 0.004} />
      </svg>
      <p>橙色の点が位置、線が視線方向。タップした位置へ移動します。</p>
    </div>
  );
}

export function Viewer3D({ state, onClose, onNotice }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const cameraModeRef = useRef<CameraMode>("orbit");
  const pointerRef = useRef<FirstPersonPointer | null>(null);
  const [rendererError, setRendererError] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("orbit");
  const [floorMode, setFloorMode] = useState<FloorMode>("grid");
  const [showAvatars, setShowAvatars] = useState(true);
  const [eyePreset, setEyePreset] = useState<EyePreset>("seated");
  const [backgroundTextureError, setBackgroundTextureError] = useState(false);
  const [customEyeHeightMm, setCustomEyeHeightMm] = useState(1200);
  const model = useMemo(() => buildScene3D(state.project, { showAvatars }), [state.project, showAvatars]);
  const [pose, setPose] = useState<FirstPersonPose>(() => defaultFirstPersonPose(model));
  const poseRef = useRef<FirstPersonPose>(pose);
  poseRef.current = pose;
  const selectedChairId = state.project.objects.find((object) =>
    (state.selectedIds.includes(object.id) || state.selectedId === object.id) && object.type === "chair",
  )?.id ?? null;

  function setEyePresetAndPose(nextPreset: EyePreset) {
    setEyePreset(nextPreset);
    const baseHeightMm = selectedChairId ? objectBaseElevationMm(state.project, selectedChairId) : 0;
    setPose((current) => ({ ...current, eyeHeightMm: baseHeightMm + eyeHeightForPreset(nextPreset, customEyeHeightMm) }));
  }

  function setCustomEyeHeightAndPose(nextValue: number) {
    const safeValue = Math.max(300, nextValue);
    setCustomEyeHeightMm(safeValue);
    if (eyePreset === "custom") {
      const baseHeightMm = selectedChairId ? objectBaseElevationMm(state.project, selectedChairId) : 0;
      setPose((current) => ({ ...current, eyeHeightMm: baseHeightMm + safeValue }));
    }
  }

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    if (!cameraRef.current || !controlsRef.current) return;
    if (cameraMode === "firstPerson") {
      controlsRef.current.enabled = false;
      applyFirstPersonCamera(cameraRef.current, pose);
    } else {
      controlsRef.current.enabled = true;
      setOrbitCamera(cameraRef.current, controlsRef.current, model);
    }
  }, [cameraMode, model, pose]);

  useEffect(() => {
    const mount = viewportRef.current;
    if (!mount) return;
    setRendererError(null);
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setRendererError("WebGLを初期化できません。ブラウザの設定を確認して2D編集画面へ戻ってください。");
      return;
    }
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x151b22);
    const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 200);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(Math.max(1, mount.clientWidth), Math.max(1, mount.clientHeight));
    renderer.domElement.setAttribute("aria-label", "3D舞台ビュー");
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.userSelect = "none";
    renderer.domElement.style.display = "block";
    mount.appendChild(renderer.domElement);
    const ambient = new THREE.HemisphereLight(0xdbeafe, 0x1f2937, 1.8);
    const directional = new THREE.DirectionalLight(0xffffff, 2.2);
    directional.position.set(8, 12, 6);
    scene.add(ambient, directional);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 0.5;
    controls.maxDistance = 200;
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;
    controlsRef.current = controls;
    setOrbitCamera(camera, controls, model);

    function handleCanvasPointerDown(event: PointerEvent) {
      if (cameraModeRef.current !== "firstPerson" || (pointerRef.current && pointerRef.current.pointerId !== event.pointerId)) return;
      event.preventDefault();
      mount?.focus();
      try {
        renderer.domElement.setPointerCapture(event.pointerId);
      } catch {
        // canvasの再描画直後など、捕捉対象が消えた場合も視点操作を止めない
      }
      pointerRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPose: poseRef.current,
      };
    }

    function handleCanvasPointerMove(event: PointerEvent) {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId || cameraModeRef.current !== "firstPerson") return;
      event.preventDefault();
      setPose(rotateFirstPersonPose(
        pointer.startPose,
        event.clientX - pointer.startX,
        event.clientY - pointer.startY,
      ));
    }

    function handleCanvasPointerUp(event: PointerEvent) {
      const pointer = pointerRef.current;
      if (!pointer || pointer.pointerId !== event.pointerId) return;
      event.preventDefault();
      const distance = Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY);
      pointerRef.current = null;
      try {
        renderer.domElement.releasePointerCapture(event.pointerId);
      } catch {
        // pointer captureが既に解除されていても操作結果は確定できる
      }
      if (distance < 8) {
        setPose((current) => {
          const yaw = (current.yawDeg * Math.PI) / 180;
          return {
            ...current,
            xMm: current.xMm + Math.sin(yaw) * 500,
            yMm: current.yMm - Math.cos(yaw) * 500,
          };
        });
      }
    }

    function handleCanvasPointerCancel(event: PointerEvent) {
      if (pointerRef.current?.pointerId === event.pointerId) {
        pointerRef.current = null;
      }
    }

    function handleCanvasLostPointerCapture(event: PointerEvent) {
      if (pointerRef.current?.pointerId === event.pointerId) {
        pointerRef.current = null;
      }
    }

    renderer.domElement.addEventListener("pointerdown", handleCanvasPointerDown);
    renderer.domElement.addEventListener("pointermove", handleCanvasPointerMove);
    renderer.domElement.addEventListener("pointerup", handleCanvasPointerUp);
    renderer.domElement.addEventListener("pointercancel", handleCanvasPointerCancel);
    renderer.domElement.addEventListener("lostpointercapture", handleCanvasLostPointerCapture);

    function resize() {
      if (!viewportRef.current) return;
      const width = Math.max(1, viewportRef.current.clientWidth);
      const height = Math.max(1, viewportRef.current.clientHeight);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(resize);
    resizeObserver?.observe(mount);
    window.addEventListener("resize", resize);
    let frame = 0;
    let renderErrorHandled = false;
    function handleRendererError(message: string) {
      if (renderErrorHandled) return;
      renderErrorHandled = true;
      window.cancelAnimationFrame(frame);
      pointerRef.current = null;
      setRendererError(message);
    }
    function handleWebglContextLost(event: Event) {
      event.preventDefault();
      handleRendererError("WebGLコンテキストが失われました。2D編集画面へ戻って、必要ならブラウザを再読み込みしてください。");
    }
    renderer.domElement.addEventListener("webglcontextlost", handleWebglContextLost);
    const render = () => {
      if (renderErrorHandled) return;
      try {
        if (shouldUpdateOrbitControls(cameraModeRef.current)) {
          controls.update();
        } else {
          // OrbitControlsのtarget更新で一人称カメラのlookAtが毎フレーム上書きされないよう、
          // 一人称中はposeを正本としてカメラ姿勢を再適用する。
          applyFirstPersonCamera(camera, poseRef.current);
        }
        renderer.render(scene, camera);
      } catch {
        handleRendererError("3D描画中にエラーが発生しました。2D編集画面へ戻って作業を続けてください。");
        return;
      }
      frame = window.requestAnimationFrame(render);
    };
    render();
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handleCanvasPointerDown);
      renderer.domElement.removeEventListener("pointermove", handleCanvasPointerMove);
      renderer.domElement.removeEventListener("pointerup", handleCanvasPointerUp);
      renderer.domElement.removeEventListener("pointercancel", handleCanvasPointerCancel);
      renderer.domElement.removeEventListener("lostpointercapture", handleCanvasLostPointerCapture);
      renderer.domElement.removeEventListener("webglcontextlost", handleWebglContextLost);
      controls.dispose();
      renderer.dispose();
      if (modelGroupRef.current) {
        scene.remove(modelGroupRef.current);
        disposeObject(modelGroupRef.current);
        modelGroupRef.current = null;
      }
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, [model]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (modelGroupRef.current) {
      scene.remove(modelGroupRef.current);
      disposeObject(modelGroupRef.current);
    }
    const group = buildThreeGroup(model, floorMode);
    scene.add(group);
    modelGroupRef.current = group;
    if (cameraMode === "orbit" && cameraRef.current && controlsRef.current) {
      setOrbitCamera(cameraRef.current, controlsRef.current, model);
    }
  }, [floorMode, model]);

  useEffect(() => {
    if (floorMode === "background" && !model.backgroundPlane) {
      setFloorMode("grid");
    }
  }, [floorMode, model.backgroundPlane]);

  useEffect(() => {
    const floor = modelGroupRef.current?.getObjectByName("floor") as THREE.Mesh | undefined;
    const dataUrl = state.project.background.imageDataUrl;
    const plane = model.backgroundPlane;
    if (!floor || floorMode !== "background" || !dataUrl || !plane) {
      setBackgroundTextureError(false);
      return;
    }
    const material = floor.material as THREE.MeshStandardMaterial;
    let disposed = false;
    let texture: THREE.CanvasTexture | null = null;
    setBackgroundTextureError(false);
    new THREE.ImageLoader().load(
      dataUrl,
      (image) => {
        if (disposed) return;
        try {
          const canvas = createBackgroundCanvas(image, plane);
          texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          material.map = texture;
          material.needsUpdate = true;
        } catch {
          setBackgroundTextureError(true);
          setFloorMode("grid");
        }
      },
      undefined,
      () => {
        if (disposed) return;
        setBackgroundTextureError(true);
        setFloorMode("grid");
      },
    );
    return () => {
      disposed = true;
      texture?.dispose();
      if (texture && material.map === texture) {
        material.map = null;
        material.needsUpdate = true;
      }
    };
  }, [floorMode, model.backgroundPlane, state.project.background.imageDataUrl]);

  function moveFirstPerson(forwardMm: number, sideMm = 0) {
    setPose((current) => {
      const yaw = (current.yawDeg * Math.PI) / 180;
      return {
        ...current,
        xMm: current.xMm + Math.sin(yaw) * forwardMm + Math.cos(yaw) * sideMm,
        yMm: current.yMm - Math.cos(yaw) * forwardMm + Math.sin(yaw) * sideMm,
      };
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (cameraMode !== "firstPerson") return;
    const target = event.target as HTMLElement | null;
    if (target && ["INPUT", "SELECT", "BUTTON"].includes(target.tagName)) return;
    const step = event.shiftKey ? 1000 : 250;
    const key = event.key.toLowerCase();
    if (key === "escape") {
      setCameraMode("orbit");
      return;
    }
    if (key === "w" || key === "arrowup") {
      event.preventDefault();
      moveFirstPerson(step);
    } else if (key === "s" || key === "arrowdown") {
      event.preventDefault();
      moveFirstPerson(-step);
    } else if (key === "a" || key === "arrowleft") {
      event.preventDefault();
      moveFirstPerson(0, -step);
    } else if (key === "d" || key === "arrowright") {
      event.preventDefault();
      moveFirstPerson(0, step);
    }
  }

  function switchToSeatView() {
    if (!selectedChairId) {
      onNotice("2D画面で椅子を1つ選択してから「この席から見る」を実行してください。");
      return;
    }
    const next = firstPersonPoseForObject(
      state.project,
      selectedChairId,
      eyeHeightForPreset(eyePreset, customEyeHeightMm),
    );
    if (!next) return;
    setPose(next);
    setCameraMode("firstPerson");
  }

  function resetView() {
    if (cameraMode === "orbit") {
      if (cameraRef.current && controlsRef.current) {
        setOrbitCamera(cameraRef.current, controlsRef.current, model);
      }
      return;
    }
    const baseHeightMm = selectedChairId ? objectBaseElevationMm(state.project, selectedChairId) : 0;
    setPose({
      ...defaultFirstPersonPose(model),
      eyeHeightMm: baseHeightMm + eyeHeightForPreset(eyePreset, customEyeHeightMm),
    });
  }

  function moveToMiniMap(position: { xMm: number; yMm: number }) {
    setPose((current) => ({ ...current, xMm: position.xMm, yMm: position.yMm }));
    setCameraMode("firstPerson");
  }

  if (rendererError) {
    return (
      <section className="viewer3d-error-screen" aria-label="3Dビューエラー">
        <div className="viewer3d-error" role="alert">
          <h2>3Dビューを表示できません</h2>
          <p>{rendererError}</p>
          <button type="button" onClick={onClose}>2D編集へ戻る</button>
        </div>
      </section>
    );
  }

  return (
    <section className="viewer3d-screen" aria-label={cameraMode === "firstPerson" ? "3D一人称ビュー" : "3D俯瞰ビュー"}>
      <div className="viewer3d-toolbar">
        <button type="button" onClick={onClose}>← 2D編集へ</button>
        <button type="button" className={cameraMode === "orbit" ? "active" : ""} onClick={() => setCameraMode("orbit")}>俯瞰</button>
        <button type="button" className={cameraMode === "firstPerson" ? "active" : ""} onClick={() => setCameraMode("firstPerson")}>一人称</button>
        <button type="button" onClick={resetView}>視点リセット</button>
        <button type="button" disabled={!selectedChairId} onClick={switchToSeatView}>この席から見る</button>
        <label>視点高さ
          <select value={eyePreset} onChange={(event) => setEyePresetAndPose(event.target.value as EyePreset)}>
            <option value="seated">座奏 1200mm</option>
            <option value="standing">立奏 1600mm</option>
            <option value="conductor">指揮者 1700mm</option>
            <option value="custom">任意</option>
          </select>
        </label>
        {eyePreset === "custom" && <input className="viewer3d-eye-input" type="number" min={300} value={customEyeHeightMm} onChange={(event) => setCustomEyeHeightAndPose(Number(event.target.value) || 300)} aria-label="任意の目線高さ(mm)" />}
        <label>床表示
          <select value={floorMode} onChange={(event) => setFloorMode(event.target.value as FloorMode)}>
            <option value="grid">実寸グリッド</option>
            <option value="plain">無地</option>
            <option value="background" disabled={!model.backgroundPlane}>背景画像{model.backgroundPlane ? "" : "（未読込）"}</option>
          </select>
        </label>
        <label className="viewer3d-check"><input type="checkbox" checked={showAvatars} onChange={(event) => setShowAvatars(event.target.checked)} />アバター</label>
        <span className="viewer3d-count">オブジェクト {model.objectCount} / 壁 {model.wallCount} / アバター {model.avatarCount}</span>
      </div>
      <div className="viewer3d-layout">
        <div
          ref={viewportRef}
          className="viewer3d-viewport"
          tabIndex={0}
          role="application"
          aria-label={cameraMode === "firstPerson" ? "一人称3D視点。ドラッグで回転、WASDまたは矢印キーで移動、タップで前進" : "3D俯瞰ビュー。ドラッグで回転、ピンチまたはホイールで拡大縮小"}
          onKeyDown={handleKeyDown}
        />
        <aside className="viewer3d-help">
          <MiniMap model={model} pose={pose} onMove={moveToMiniMap} />
          <h2>3D確認</h2>
          <p>{cameraMode === "firstPerson" ? "ミニマップで位置を決めた後、中央の3D画面をドラッグして視線を回転。WASD／矢印キーで移動。iPadはタップで前進します。視点リセットで初期位置へ戻せます。" : "ドラッグで俯瞰回転。ホイール／ピンチでズームします。視点リセットで舞台全体へ戻せます。"}</p>
          <p>ミニマップをタップすると、その位置から一人称視点を確認できます。</p>
          {backgroundTextureError && <p className="error-message" role="alert">背景画像を3D表示できないため、実寸グリッドへ切り替えました。</p>}
          <p>3Dは閲覧専用です。位置・寸法・壁の編集は2Dへ戻って行います。</p>
          {selectedChairId ? <p className="success-message">選択中の椅子から見ることができます。</p> : <p className="hint">椅子を選択すると席視点ボタンが有効になります。</p>}
        </aside>
      </div>
    </section>
  );
}
