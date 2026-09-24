import { useEffect, useRef } from "react";
import { collectBounds } from "../domain/spatial";
import type { CameraState, Entity, WorldPoint } from "../domain/types";

interface MinimapProps {
  entities: Entity[];
  camera: CameraState;
  onNavigate: (point: WorldPoint) => void;
}

export function Minimap({ entities, camera, onNavigate }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bounds = collectBounds(entities);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(7, 10, 18, .92)";
    ctx.fillRect(0, 0, width, height);

    const padding = 12;
    const scale = Math.min((width - padding * 2) / Math.max(bounds.width, 1), (height - padding * 2) / Math.max(bounds.height, 1));
    const offsetX = padding + (width - padding * 2 - bounds.width * scale) / 2 - bounds.x * scale;
    const offsetY = padding + (height - padding * 2 - bounds.height * scale) / 2 - bounds.y * scale;

    for (const entity of entities) {
      if (entity.kind === "group") {
        ctx.fillStyle = `${entity.color ?? "#7767e9"}22`;
        ctx.strokeStyle = `${entity.color ?? "#7767e9"}aa`;
        ctx.lineWidth = 1;
        ctx.fillRect(entity.x * scale + offsetX, entity.y * scale + offsetY, entity.width * scale, entity.height * scale);
        ctx.strokeRect(entity.x * scale + offsetX, entity.y * scale + offsetY, entity.width * scale, entity.height * scale);
      }
    }
    ctx.fillStyle = "rgba(219, 226, 245, .8)";
    for (const entity of entities) {
      if (entity.kind === "group") continue;
      ctx.fillRect(entity.x * scale + offsetX, entity.y * scale + offsetY, Math.max(2, entity.width * scale), Math.max(2, entity.height * scale));
    }

    const viewX = -camera.x / camera.scale;
    const viewY = -camera.y / camera.scale;
    const viewWidth = camera.viewportWidth / camera.scale;
    const viewHeight = camera.viewportHeight / camera.scale;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(viewX * scale + offsetX, viewY * scale + offsetY, viewWidth * scale, viewHeight * scale);
    canvas.dataset.scale = String(scale);
    canvas.dataset.offsetX = String(offsetX);
    canvas.dataset.offsetY = String(offsetY);
  }, [bounds.height, bounds.width, bounds.x, bounds.y, camera, entities]);

  function navigate(event: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = Number(canvas.dataset.scale || 1);
    const offsetX = Number(canvas.dataset.offsetX || 0);
    const offsetY = Number(canvas.dataset.offsetY || 0);
    onNavigate({ x: (event.clientX - rect.left - offsetX) / scale, y: (event.clientY - rect.top - offsetY) / scale });
  }

  return (
    <div className="minimap-shell">
      <span>MAPA</span>
      <canvas ref={canvasRef} onClick={navigate} aria-label="Minimapa navegável" />
    </div>
  );
}
