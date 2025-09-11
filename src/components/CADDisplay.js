import React, { useRef, useEffect, useState } from "react";
import DxfParser from "dxf-parser";

const CADDisplay = ({ cadFilePath }) => {
  const canvasRef = useRef(null);
  const [dxfData, setDxfData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // ===================== 렌더링 함수 =====================
  function renderEntity(ctx, entity) {
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1 / ctx.getTransform().a;

    switch (entity.type) {
      case "LINE":
        renderLine(ctx, entity);
        break;
      case "POLYLINE":
      case "LWPOLYLINE":
        renderPolyline(ctx, entity);
        break;
      case "CIRCLE":
        renderCircle(ctx, entity);
        break;
      case "ARC":
        renderArc(ctx, entity);
        break;
      case "TEXT":
        renderText(ctx, entity);
        break;
      case "INSERT":
        // INSERT 숨기기
        break;
      default:
        console.log("지원하지 않는 엔티티 타입:", entity.type);
    }
  }

  function renderLine(ctx, entity) {
    if (entity.vertices?.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(entity.vertices[0].x, -entity.vertices[0].y);
      ctx.lineTo(entity.vertices[1].x, -entity.vertices[1].y);
      ctx.stroke();
    }
  }

  function renderPolyline(ctx, entity) {
    if (!entity.vertices || entity.vertices.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(entity.vertices[0].x, -entity.vertices[0].y);
    for (let i = 1; i < entity.vertices.length; i++) {
      ctx.lineTo(entity.vertices[i].x, -entity.vertices[i].y);
    }
    if (entity.shape) ctx.closePath();
    ctx.stroke();
  }

  function renderCircle(ctx, entity) {
    if (entity.center && entity.radius) {
      ctx.beginPath();
      ctx.arc(entity.center.x, -entity.center.y, entity.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  function renderArc(ctx, entity) {
    if (entity.center && entity.radius) {
      let startAngle = entity.startAngle || 0;
      let endAngle = entity.endAngle || 360;
      if (endAngle > 7 || endAngle < -7) {
        startAngle = (startAngle * Math.PI) / 180;
        endAngle = (endAngle * Math.PI) / 180;
      }
      const angleDiff = Math.abs(endAngle - startAngle);
      ctx.beginPath();
      if (angleDiff >= 2 * Math.PI - 0.01 || angleDiff <= 0.01) {
        ctx.arc(entity.center.x, -entity.center.y, entity.radius, 0, 2 * Math.PI);
      } else {
        ctx.arc(entity.center.x, -entity.center.y, entity.radius, startAngle, endAngle);
      }
      ctx.stroke();
    }
  }

  function renderText(ctx, entity) {
    if (entity.startPoint && entity.text) {
      ctx.save();
      ctx.fillStyle = "#333333";
      ctx.font = `${entity.textHeight || 10}px Arial`;
      ctx.fillText(entity.text, entity.startPoint.x, -entity.startPoint.y);
      ctx.restore();
    }
  }

  function renderDXF(dxfData, currentScale = scale, currentOffset = offset) {
    console.log("🖌️ DXF 렌더링 중...", { scale: currentScale, offset: currentOffset });
    const canvas = canvasRef.current;
    if (!canvas || !dxfData || !dxfData.entities) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 900;
    canvas.height = 400;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e6f3ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(currentOffset.x, currentOffset.y);
    ctx.scale(currentScale, currentScale);

    dxfData.entities.forEach((entity) => renderEntity(ctx, entity));

    ctx.restore();
  }

  // ===================== 좌표 계산 =====================
  const calculateBounds = (entities) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let hasValidCoords = false;

    entities.forEach((entity) => {
      const coords = getEntityCoordinates(entity);
      coords.forEach((coord) => {
        if (typeof coord.x === "number" && typeof coord.y === "number") {
          minX = Math.min(minX, coord.x);
          minY = Math.min(minY, coord.y);
          maxX = Math.max(maxX, coord.x);
          maxY = Math.max(maxY, coord.y);
          hasValidCoords = true;
        }
      });
    });

    return hasValidCoords ? { minX, minY, maxX, maxY } : null;
  };

  const getEntityCoordinates = (entity) => {
    const coords = [];
    switch (entity.type) {
      case "LINE":
        if (entity.vertices?.length >= 2) coords.push(...entity.vertices);
        break;
      case "POLYLINE":
      case "LWPOLYLINE":
        if (entity.vertices) coords.push(...entity.vertices);
        break;
      case "CIRCLE":
      case "ARC":
        if (entity.center) {
          const r = entity.radius || 0;
          coords.push(
            { x: entity.center.x - r, y: entity.center.y - r },
            { x: entity.center.x + r, y: entity.center.y + r }
          );
        }
        break;
      case "TEXT":
        if (entity.startPoint) coords.push(entity.startPoint);
        break;
      case "INSERT":
        if (entity.position) coords.push(entity.position);
        else if (entity.insertionPoint) coords.push(entity.insertionPoint);
        else if (entity.x !== undefined && entity.y !== undefined) {
          coords.push({ x: entity.x, y: entity.y });
        }
        break;
    }
    return coords;
  };

  const calculateScale = (bounds, canvasWidth, canvasHeight) => {
    const dxfWidth = bounds.maxX - bounds.minX;
    const dxfHeight = bounds.maxY - bounds.minY;
    if (dxfWidth === 0 || dxfHeight === 0) return 1;

    const scaleX = (canvasWidth * 0.6) / dxfWidth;
    const scaleY = (canvasHeight * 0.6) / dxfHeight;
    const finalScale = Math.min(scaleX, scaleY);

    const minScale = (Math.min(canvasWidth, canvasHeight) / Math.max(dxfWidth, dxfHeight)) * 0.1;
    return Math.max(finalScale, minScale);
  };

  const calculateOffset = (bounds, canvasWidth, canvasHeight, scale) => {
    const dxfWidth = bounds.maxX - bounds.minX;
    const dxfHeight = bounds.maxY - bounds.minY;

    const scaledWidth = dxfWidth * scale;
    const scaledHeight = dxfHeight * scale;

    return {
      x: (canvasWidth - scaledWidth) / 2 - bounds.minX * scale,
      y: canvasHeight - (canvasHeight - scaledHeight) / 2 + bounds.minY * scale,
    };
  };

  // ===================== 파일 로드 =====================
  const loadFile = async (filePathOrBlobUrl) => {
    setLoading(true);
    setError(null);

    console.log(`📂 CADDisplay: 파일 로딩 시작 -> ${filePathOrBlobUrl}`);

    try {
      let dxfText;
      if (filePathOrBlobUrl.startsWith("blob:")) {
        console.log('📦 Blob URL 처리');
        const res = await fetch(filePathOrBlobUrl);
        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder("utf-8");
        dxfText = decoder.decode(buffer);
      } else {
        console.log('📄 일반 파일 경로 처리');
        const fullPath = `/cadfiles/${filePathOrBlobUrl}`;
        const res = await fetch(fullPath);
        if (!res.ok) throw new Error(`파일을 찾을 수 없습니다: ${fullPath}`);
        dxfText = await res.text();
      }

      console.log('📝 DXF 파싱 시작, 내용 길이:', dxfText.length);

      const parser = new DxfParser();
      const dxf = parser.parseSync(dxfText);
      setDxfData(dxf);

      console.log("✅ DXF 파싱 완료, 엔티티 수:", dxf.entities.length);

      const bounds = calculateBounds(dxf.entities);
      if (bounds) {
        const autoScale = calculateScale(bounds, 900, 400);
        const autoOffset = calculateOffset(bounds, 900, 400, autoScale);
        setScale(autoScale);
        setOffset(autoOffset);
        renderDXF(dxf, autoScale, autoOffset);
      } else {
        renderDXF(dxf);
      }
    } catch (err) {
      console.error("❌ DXF 로딩/파싱 실패:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===================== useEffect =====================
  useEffect(() => {
    if (cadFilePath) loadFile(cadFilePath);
  }, [cadFilePath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dxfData) return;

    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const handleWheel = (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseCanvasX = event.clientX - rect.left;
      const mouseCanvasY = event.clientY - rect.top;

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = scale * zoomFactor;

      const newOffset = {
        x: mouseCanvasX - (mouseCanvasX - offset.x) * zoomFactor,
        y: mouseCanvasY - (mouseCanvasY - offset.y) * zoomFactor,
      };

      setScale(newScale);
      setOffset(newOffset);
      renderDXF(dxfData, newScale, newOffset);
    };

    const handleMouseDown = (event) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleMouseMove = (event) => {
      if (!isMouseDown) return;
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      const newOffset = {
        x: offset.x + deltaX,
        y: offset.y + deltaY,
      };

      setOffset(newOffset);
      mouseX = event.clientX;
      mouseY = event.clientY;

      renderDXF(dxfData, scale, newOffset);
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [dxfData, scale, offset]);

  // ===================== 줌/팬 제어 =====================
  const handleZoomIn = () => {
    const newScale = scale * 1.2;
    setScale(newScale);
    if (dxfData) renderDXF(dxfData, newScale, offset);
  };

  const handleZoomOut = () => {
    const newScale = scale * 0.8;
    setScale(newScale);
    if (dxfData) renderDXF(dxfData, newScale, offset);
  };

  const handleFitToView = () => {
    if (dxfData) {
      const bounds = calculateBounds(dxfData.entities);
      if (bounds) {
        const autoScale = calculateScale(bounds, 900, 400);
        const autoOffset = calculateOffset(bounds, 900, 400, autoScale);
        setScale(autoScale);
        setOffset(autoOffset);
        renderDXF(dxfData, autoScale, autoOffset);
      }
    }
  };

  // ===================== 렌더링 JSX =====================
  return (
    <div className="cad-display-panel">
      <div className="panel-header">CAD 도면 표시 영역</div>
      <div className="cad-content">
        <div className="cad-toolbar">
          <button className="tool-button" onClick={handleZoomIn}>+</button>
          <button className="tool-button" onClick={handleZoomOut}>-</button>
          <button className="tool-button magnifier" onClick={handleFitToView}>🔍</button>
        </div>
        <div className="cad-canvas" style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", display: "block" }}
          />
          {loading && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.9)", padding: "10px", borderRadius: "5px"
            }}>
              🔄 DXF 파일 로딩 중...
            </div>
          )}
          {error && (
            <div style={{
              position: "absolute", top: "10px", left: "10px",
              background: "rgba(255,0,0,0.1)", color: "red",
              padding: "5px 10px", borderRadius: "5px", fontSize: "12px"
            }}>
              ❌ {error}
            </div>
          )}
          {cadFilePath && !loading && !error && (
            <div style={{
              position: "absolute", bottom: "10px", left: "10px",
              background: "rgba(255,255,255,0.8)", padding: "5px 10px",
              borderRadius: "5px", fontSize: "12px"
            }}>
              📁 {cadFilePath}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CADDisplay;