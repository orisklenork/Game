import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EquippedLoadout, WeaponId } from '../shared/gameData';
import { buildPlayerCharacterModel } from '../game/models';

interface Props {
  loadout: EquippedLoadout;
  weaponId: WeaponId;
  className?: string;
}

export function CharacterPreview3D({ loadout, weaponId, className = '' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const charRef = useRef<THREE.Group | null>(null);
  const rotYRef = useRef(0.35);
  const requestRenderRef = useRef<() => void>(() => {});

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({ antialias: !isSoftwareGl, alpha: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth || 320, el.clientHeight || 420);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(40, (el.clientWidth || 320) / (el.clientHeight || 420), 0.1, 30);
    camera.position.set(0, 1.15, 3.2);
    camera.lookAt(0, 0.95, 0);

    // Three-point studio lighting
    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x0f172a, 0.9);
    const key = new THREE.DirectionalLight(0xfef2f2, 2.2);
    key.position.set(2.5, 4, 3);
    const rim = new THREE.DirectionalLight(0xdc2626, 1.4);
    rim.position.set(-2.5, 2.5, -2.5);
    scene.add(hemi, key, rim);

    // Pedestal disc
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.0, 0.12, 32),
      new THREE.MeshStandardMaterial({ color: '#131924', roughness: 0.4, metalness: 0.7 })
    );
    pedestal.position.y = -0.06;
    scene.add(pedestal);

    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let disposed = false;

    const draw = () => {
      if (disposed) return;
      if (charRef.current) {
        charRef.current.rotation.y = rotYRef.current;
      }
      renderer.render(scene, camera);
    };

    const requestRender = () => {
      if (renderBusy || disposed) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;
        draw();
        const done = () => {
          renderBusy = false;
          if (renderDirty && !disposed) requestRender();
        };
        if (isSoftwareGl) {
          const gl = renderer.getContext() as WebGL2RenderingContext;
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (disposed) return;
            const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
            if (state === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(done, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
        } else {
          done();
        }
      });
    };
    requestRenderRef.current = requestRender;

    // Drag to rotate character
    let dragging = false;
    let lastX = 0;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      rotYRef.current += (e.clientX - lastX) * 0.015;
      lastX = e.clientX;
      requestRender();
    };
    const onUp = () => {
      dragging = false;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth || 320;
      const h = el.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    requestRender();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
      if (canvas.parentNode === el) el.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (charRef.current) {
      scene.remove(charRef.current);
    }
    const handle = buildPlayerCharacterModel(loadout, weaponId);
    handle.group.rotation.y = rotYRef.current;
    scene.add(handle.group);
    charRef.current = handle.group;
    requestRenderRef.current();
  }, [loadout, weaponId]);

  return (
    <div className={`relative select-none ${className}`}>
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-3 inset-x-0 text-center text-xs text-slate-400">
        Drag to rotate 3D operative
      </div>
    </div>
  );
}
