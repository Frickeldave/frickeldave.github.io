import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";

interface StlViewerProps {
  url: string;
  alt?: string;
}

export default function StlViewer({ url, alt }: StlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf3f4f6);

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 120);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    scene.add(directionalLight);

    const fillLight = new THREE.DirectionalLight(0xffffff, 0.4);
    fillLight.position.set(-10, 10, -10);
    scene.add(fillLight);

    const controls = {
      isDragging: false,
      previousMousePosition: { x: 0, y: 0 },
      rotation: { x: 0, y: 0 },
      zoom: 1,
    };

    const loader = new STLLoader();
    loader.load(
      url,
      (geometry) => {
        geometry.computeBoundingBox();
        geometry.center();

        const material = new THREE.MeshStandardMaterial({
          color: 0x0891b2,
          metalness: 0.2,
          roughness: 0.6,
        });
        const mesh = new THREE.Mesh(geometry, material);
        scene.add(mesh);

        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const fitHeightDistance =
          maxDim / (2 * Math.atan((Math.PI * camera.fov) / 360));
        const fitWidthDistance = fitHeightDistance / camera.aspect;
        const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.2;

        camera.position.set(distance, distance * 0.6, distance);
        camera.lookAt(0, 0, 0);

        controls.zoom = distance;

        const onMouseDown = (event: MouseEvent) => {
          controls.isDragging = true;
          controls.previousMousePosition = {
            x: event.clientX,
            y: event.clientY,
          };
        };

        const onMouseMove = (event: MouseEvent) => {
          if (!controls.isDragging) return;

          const deltaMove = {
            x: event.clientX - controls.previousMousePosition.x,
            y: event.clientY - controls.previousMousePosition.y,
          };

          mesh.rotation.y += deltaMove.x * 0.01;
          mesh.rotation.x += deltaMove.y * 0.01;

          controls.previousMousePosition = {
            x: event.clientX,
            y: event.clientY,
          };
        };

        const onMouseUp = () => {
          controls.isDragging = false;
        };

        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          const zoomSpeed = 0.001;
          controls.zoom += event.deltaY * zoomSpeed * distance;
          controls.zoom = Math.max(
            distance * 0.2,
            Math.min(distance * 3, controls.zoom)
          );

          const direction = new THREE.Vector3()
            .copy(camera.position)
            .normalize()
            .multiplyScalar(controls.zoom);
          camera.position.copy(direction);
        };

        container.addEventListener("mousedown", onMouseDown);
        container.addEventListener("mousemove", onMouseMove);
        container.addEventListener("mouseup", onMouseUp);
        container.addEventListener("mouseleave", onMouseUp);
        container.addEventListener("wheel", onWheel, { passive: false });

        let animationId: number;
        const animate = () => {
          animationId = requestAnimationFrame(animate);
          renderer.render(scene, camera);
        };
        animate();

        setLoading(false);

        return () => {
          cancelAnimationFrame(animationId);
          container.removeEventListener("mousedown", onMouseDown);
          container.removeEventListener("mousemove", onMouseMove);
          container.removeEventListener("mouseup", onMouseUp);
          container.removeEventListener("mouseleave", onMouseUp);
          container.removeEventListener("wheel", onWheel as EventListener);
        };
      },
      undefined,
      (err) => {
        console.error("Failed to load STL:", err);
        setError("3D-Vorschau konnte nicht geladen werden.");
        setLoading(false);
      }
    );

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [url]);

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full cursor-move overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800"
      role="img"
      aria-label={alt || "3D-Modell-Vorschau"}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <span>3D-Vorschau wird geladen…</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-red-600 dark:text-red-400">
          <svg
            className="h-10 w-10"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.054 0 1.918-.816 1.995-1.85L21 5.25a2 2 0 00-1.995-1.85H4.995A2 2 0 003 5.25l.938 12.9c.077 1.034.941 1.85 1.995 1.85z"
            />
          </svg>
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
