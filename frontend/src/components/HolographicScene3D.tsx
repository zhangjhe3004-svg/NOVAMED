/**
 * 全息 3D 场景（附近互传节点）
 *
 * 用原生 Three.js 渲染真正的 3D 全息粒子球（对齐 jarvis-holographic 全息风格），
 * 支持轨道旋转（左键拖拽）、缩放（滚轮）、平移（右键/中键拖拽）。
 * 中心=本机大球，同事=环绕小球（带 3D 深度），层级连线 + 已连接虚线在 3D 空间绘制。
 *
 * 通过 onProject 回调把每个节点/中心的 3D 世界坐标投影为屏幕坐标（供 DOM overlay 定位名片/标签）。
 * focusNodeId 变化时，相机会平滑地对准该节点（搜索定位）。
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export interface SceneNode {
  id: number;          // 同事 id（中心为 -1）
  label: string;       // 名称
  level: number;       // 权限等级
  active: boolean;     // 是否已连接
  isCenter?: boolean;
}

export interface HolographicScene3DProps {
  width: number;
  height: number;
  nodes: SceneNode[];           // 含中心（isCenter）与同事
  superiorLines: { from: number; to: number }[]; // 同事 id → 上级 id（-1 表示中心）
  connectedIds: number[];       // 已连接同事 id
  onProject: (positions: Record<number, { x: number; y: number }>) => void; // id → 屏幕坐标（中心 -1）
  onDistanceChange?: (distance: number) => void;
  focusNodeId?: number | null;  // 需要相机对准的节点 id（搜索定位）
}

function makeRnd(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

// 球面均匀分布点
function spherePoints(n: number, _seed: number) {
  const pts = new Float32Array(n * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const yy = 1 - (i / (n - 1)) * 2;
    const rad = Math.sqrt(1 - yy * yy);
    const th = golden * i;
    pts[i * 3] = Math.cos(th) * rad;
    pts[i * 3 + 1] = yy;
    pts[i * 3 + 2] = Math.sin(th) * rad;
  }
  return pts;
}

// 卫星球壳点
function satellitePoints(n: number, seed: number, r0: number, r1: number) {
  const rnd = makeRnd(seed);
  const pts = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1;
    const phi = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    const r = r0 + rnd() * (r1 - r0);
    pts[i * 3] = Math.cos(phi) * s * r;
    pts[i * 3 + 1] = u * r;
    pts[i * 3 + 2] = Math.sin(phi) * s * r;
  }
  return pts;
}

const CORE_ON = new THREE.Color(0x00f0ff);
const DIM_ON = new THREE.Color(0x002fa7);
const CORE_OFF = new THREE.Color(0x7ca8cc);
const DIM_OFF = new THREE.Color(0x2a3c66);

function buildHoloBall(opts: {
  radius: number; coreCount: number; satCount: number; seed: number; active: boolean;
}) {
  const group = new THREE.Group();
  const { radius } = opts;

  // 内核心光晕球
  const haloMat = new THREE.MeshBasicMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.62, 32, 32), haloMat);
  halo.name = "halo";
  group.add(halo);

  // 线框经纬球
  const wireMat = new THREE.MeshBasicMaterial({
    wireframe: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 2), wireMat);
  wire.name = "wire";
  group.add(wire);

  // 内核心粒子
  const coreGeo = new THREE.BufferGeometry();
  coreGeo.setAttribute("position", new THREE.BufferAttribute(spherePoints(opts.coreCount, opts.seed), 3));
  const corePts = new THREE.Points(coreGeo, new THREE.PointsMaterial({
    size: radius * 0.028, sizeAttenuation: true, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  corePts.scale.setScalar(radius);
  corePts.name = "core";
  group.add(corePts);

  // 外层卫星粒子
  const satGeo = new THREE.BufferGeometry();
  satGeo.setAttribute("position", new THREE.BufferAttribute(satellitePoints(opts.satCount, opts.seed * 7, 1.05, 1.5), 3));
  const satPts = new THREE.Points(satGeo, new THREE.PointsMaterial({
    size: radius * 0.018, sizeAttenuation: true, transparent: true, opacity: 0.65,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  satPts.scale.setScalar(radius);
  satPts.name = "satellite";
  group.add(satPts);

  // 倾斜光环带
  const ringMat = new THREE.MeshBasicMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.35, radius * 0.018, 16, 96), ringMat);
  ring.rotation.x = Math.PI / 2.3;
  ring.name = "ring";
  group.add(ring);

  // 应用激活/未激活配色
  const apply = (active: boolean) => {
    const core = active ? CORE_ON : CORE_OFF;
    const dim = active ? DIM_ON : DIM_OFF;
    (halo.material as THREE.MeshBasicMaterial).color.copy(core);
    (halo.material as THREE.MeshBasicMaterial).opacity = active ? 0.5 : 0.3;
    (wire.material as THREE.MeshBasicMaterial).color.copy(dim);
    (wire.material as THREE.MeshBasicMaterial).opacity = active ? 0.45 : 0.3;
    (corePts.material as THREE.PointsMaterial).color.copy(core);
    (satPts.material as THREE.PointsMaterial).color.copy(core);
    (ring.material as THREE.MeshBasicMaterial).color.copy(core);
    (ring.material as THREE.MeshBasicMaterial).opacity = active ? 0.5 : 0.3;
  };
  apply(opts.active);
  group.userData.applyColor = apply;
  // 粒子尺寸动态补偿基准（无论缩放多少都保持可见，见渲染循环）
  group.userData.baseCoreSize = radius * 0.028;
  group.userData.baseSatSize = radius * 0.018;

  return group;
}

export default function HolographicScene3D(props: HolographicScene3DProps) {
  const { width, height, nodes, superiorLines, connectedIds, onProject, onDistanceChange, focusNodeId } = props;
  const mountRef = useRef<HTMLDivElement>(null);

  // 保存最新回调与数据（供渲染循环读取，避免重建场景）
  const onProjectRef = useRef(onProject);
  const onDistanceRef = useRef(onDistanceChange);
  const connectedRef = useRef(connectedIds);
  const rebuildRef = useRef<((nodes: SceneNode[], lines: { from: number; to: number }[]) => void) | null>(null);
  const focusRef = useRef<number | null>(null);
  onProjectRef.current = onProject;
  onDistanceRef.current = onDistanceChange;
  connectedRef.current = connectedIds;

  // 节点/连线数据变化 → 就地重建球体与连线（保留相机视角）
  useEffect(() => {
    rebuildRef.current?.(nodes, superiorLines);
  }, [nodes, superiorLines]);

  // 搜索定位：focusNodeId 变化 → 相机平滑对准
  useEffect(() => {
    if (focusNodeId != null) focusRef.current = focusNodeId;
  }, [focusNodeId]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.setClearColor(0x000000, 1);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.01, 200000);
    camera.position.set(0, 0, 180);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0;      // 无限制缩放（可无限拉近）
    controls.maxDistance = Infinity; // 无限制缩放（可无限拉远）
    controls.enablePan = true;
    controls.rotateSpeed = 0.6;
    controls.zoomSpeed = 0.9;

    // 复位视角：记录初始相机位置/目标（Blender 风格，R 键复位）
    const homePosition = new THREE.Vector3(0, 0, 180);
    const homeTarget = new THREE.Vector3(0, 0, 0);
    let resetting = false;
    const resetView = () => {
      resetting = true;
    };

    scene.add(new THREE.AmbientLight(0x002f7a, 0.6));
    const p1 = new THREE.PointLight(0x00f0ff, 1.6, 400);
    p1.position.set(90, 90, 90);
    scene.add(p1);
    const p2 = new THREE.PointLight(0x00a3ff, 1.2, 400);
    p2.position.set(-90, -60, -40);
    scene.add(p2);

    const worldPos = new Map<number, THREE.Vector3>();
    const ballGroups = new Map<number, THREE.Group>();
    const nodeGroup = new THREE.Group();
    const lineGroup = new THREE.Group();
    scene.add(nodeGroup, lineGroup);

    let focusTarget: THREE.Vector3 | null = null;

    function disposeGroup(g: THREE.Group) {
      while (g.children.length) {
        const c = g.children[0] as THREE.Mesh;
        c.geometry?.dispose?.();
        const m = c.material as THREE.Material | THREE.Material[];
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose?.();
        g.remove(c);
      }
    }

    function rebuild(data: SceneNode[], lines: { from: number; to: number }[]) {
      disposeGroup(nodeGroup);
      disposeGroup(lineGroup);
      worldPos.clear();
      ballGroups.clear();

      const peers = data.filter((n) => !n.isCenter);
      const peerCount = Math.max(peers.length, 1);

      // 中心球
      const centerGroup = buildHoloBall({ radius: 24, coreCount: 520, satCount: 220, seed: 7, active: true });
      centerGroup.position.set(0, 0, 0);
      nodeGroup.add(centerGroup);
      worldPos.set(-1, centerGroup.position.clone());

      // 同事球（3D 椭圆轨道 + 深度错开）
      peers.forEach((peer, i) => {
        const active = connectedRef.current.includes(peer.id);
        const group = buildHoloBall({
          radius: 13, coreCount: 190, satCount: 90, seed: 100 + i * 13, active,
        });
        const ang = (i / peerCount) * Math.PI * 2 - Math.PI / 2;
        const rx = 78, ry = 66;
        const rz = Math.sin(ang * 2 + i) * 20;
        group.position.set(Math.cos(ang) * rx, Math.sin(ang) * ry, rz);
        nodeGroup.add(group);
        worldPos.set(peer.id, group.position.clone());
        ballGroups.set(peer.id, group);
      });

      // 层级连线
      const hierMat = new THREE.LineBasicMaterial({
        color: 0x00a3ff, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      lines.forEach((l) => {
        const from = worldPos.get(l.from);
        const to = worldPos.get(l.to);
        if (!from || !to) return;
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        lineGroup.add(new THREE.Line(geo, hierMat));
      });
      // 已连接虚线
      const dashMat = new THREE.LineDashedMaterial({
        color: 0x00f0ff, dashSize: 3, gapSize: 3, transparent: true, opacity: 0.9,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      connectedRef.current.forEach((cid) => {
        const from = worldPos.get(-1);
        const to = worldPos.get(cid);
        if (!from || !to) return;
        const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
        const line = new THREE.Line(geo, dashMat);
        line.computeLineDistances();
        lineGroup.add(line);
      });
    }
    rebuild(nodes, superiorLines);
    rebuildRef.current = rebuild;

    let raf = 0;
    let prevConnected = [...connectedRef.current];

    const loop = () => {
      // 连接状态变化 → 更新配色 + 虚线
      const cur = connectedRef.current;
      const changed = cur.length !== prevConnected.length || cur.some((id, idx) => id !== prevConnected[idx]);
      if (changed) {
        ballGroups.forEach((g, id) => {
          g.userData.applyColor?.(cur.includes(id));
        });
        // 只重建虚线部分
        while (lineGroup.children.length) {
          const c = lineGroup.children[0] as THREE.Line;
          if ((c.material as THREE.LineDashedMaterial)?.isLineDashedMaterial) {
            c.geometry?.dispose();
            c.material?.dispose();
            lineGroup.remove(c);
          } else break;
        }
        const dashMat = new THREE.LineDashedMaterial({
          color: 0x00f0ff, dashSize: 3, gapSize: 3, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        cur.forEach((cid) => {
          const from = worldPos.get(-1);
          const to = worldPos.get(cid);
          if (!from || !to) return;
          const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
          const line = new THREE.Line(geo, dashMat);
          line.computeLineDistances();
          lineGroup.add(line);
        });
        prevConnected = [...cur];
      }

      // 搜索定位：平滑对准目标节点
      if (focusRef.current != null) {
        const v = worldPos.get(focusRef.current);
        if (v) {
          focusTarget = v.clone();
          focusRef.current = null;
        }
      }
      if (focusTarget) {
        controls.target.lerp(focusTarget, 0.12);
        if (controls.target.distanceTo(focusTarget) < 0.5) focusTarget = null;
      }

      // 复位视角（Blender 风格，R 键触发）：平滑回到初始位置/目标
      if (resetting) {
        camera.position.lerp(homePosition, 0.14);
        controls.target.lerp(homeTarget, 0.14);
        focusTarget = null;
        if (camera.position.distanceTo(homePosition) < 0.5 && controls.target.distanceTo(homeTarget) < 0.5) {
          camera.position.copy(homePosition);
          controls.target.copy(homeTarget);
          resetting = false;
        }
      }

      // 粒子尺寸动态补偿：无论缩放多少都保持粒子可见
      // sizeAttenuation 会让远距粒子缩成亚像素——按相机距离等比放大粒子尺寸，
      // 屏幕上保持近似恒定大小；近距离（f<1）则不放大，保留透视纵深感
      const dist = controls.getDistance();
      const f = Math.max(1, dist / 180);
      const applySize = (g?: THREE.Object3D | null) => {
        if (!g) return;
        const core = g.getObjectByName("core") as THREE.Points | undefined;
        const sat = g.getObjectByName("satellite") as THREE.Points | undefined;
        if (core) (core.material as THREE.PointsMaterial).size = (g.userData.baseCoreSize || 0.34) * f;
        if (sat) (sat.material as THREE.PointsMaterial).size = (g.userData.baseSatSize || 0.23) * f;
      };
      ballGroups.forEach((g) => applySize(g));
      applySize(nodeGroup.children[0]);

      // 自转
      ballGroups.forEach((g) => {
        g.rotation.y += 0.006;
        const sat = g.getObjectByName("satellite");
        if (sat) sat.rotation.y -= 0.005;
        const ring = g.getObjectByName("ring");
        if (ring) ring.rotation.z += 0.005;
      });
      const centerGroup = nodeGroup.children[0] as THREE.Group | undefined;
      if (centerGroup) {
        centerGroup.rotation.y += 0.005;
        const cSat = centerGroup.getObjectByName("satellite");
        if (cSat) cSat.rotation.y -= 0.004;
        const cRing = centerGroup.getObjectByName("ring");
        if (cRing) cRing.rotation.z += 0.004;
      }

      controls.update();
      renderer.render(scene, camera);

      // 投影
      const proj: Record<number, { x: number; y: number }> = {};
      worldPos.forEach((v, id) => {
        const s = v.clone().project(camera);
        proj[id] = {
          x: (s.x * 0.5 + 0.5) * width,
          y: (-s.y * 0.5 + 0.5) * height,
        };
      });
      onProjectRef.current(proj);
      onDistanceRef.current?.(controls.getDistance());

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // R 键复位视角（Blender 风格）；忽略输入框内按键
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === "r" || e.key === "R") {
        e.preventDefault();
        resetView();
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      controls.dispose();
      renderer.dispose();
      while (mount.firstChild) mount.removeChild(mount.firstChild);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
