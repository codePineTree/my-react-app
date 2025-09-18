import React, { useRef, useEffect, useState } from "react";
import DxfParser from "dxf-parser";
import AreaDrawing from "./AreaDrawing";
import AreaManager from "./AreaManager";

const CADDisplay = ({ cadFilePath, modelId, onSave }) => {
  const canvasRef = useRef(null);
  const areaManagerRef = useRef(null);

  const [dxfData, setDxfData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPenMode, setIsPenMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(null);
  const [completedAreas, setCompletedAreas] = useState([]);

  const MAX_RETRIES = 15;
  const RETRY_DELAY = 3000;

  useEffect(() => { if (modelId) setCurrentModelId(modelId); }, [modelId]);
  useEffect(() => { if (currentModelId) loadSavedAreas(currentModelId); }, [currentModelId]);

  // ==================== DXF 렌더링 함수 ====================
  const renderEntity = (ctx, entity) => {
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1 / ctx.getTransform().a;
    switch (entity.type) {
      case "LINE": renderLine(ctx, entity); break;
      case "POLYLINE":
      case "LWPOLYLINE": renderPolyline(ctx, entity); break;
      case "CIRCLE": renderCircle(ctx, entity); break;
      case "ARC": renderArc(ctx, entity); break;
      case "TEXT": renderText(ctx, entity); break;
      case "INSERT": break;
      default: console.log("지원하지 않는 엔티티 타입:", entity.type);
    }
  };

  const renderLine = (ctx, entity) => {
    if (entity.vertices?.length >= 2) { ctx.beginPath(); ctx.moveTo(entity.vertices[0].x, -entity.vertices[0].y); ctx.lineTo(entity.vertices[1].x, -entity.vertices[1].y); ctx.stroke(); }
  };
  const renderPolyline = (ctx, entity) => {
    if (!entity.vertices || entity.vertices.length < 2) return;
    ctx.beginPath(); ctx.moveTo(entity.vertices[0].x, -entity.vertices[0].y);
    for (let i = 1; i < entity.vertices.length; i++) ctx.lineTo(entity.vertices[i].x, -entity.vertices[i].y);
    if (entity.shape) ctx.closePath(); ctx.stroke();
  };
  const renderCircle = (ctx, entity) => { if (entity.center && entity.radius) { ctx.beginPath(); ctx.arc(entity.center.x, -entity.center.y, entity.radius, 0, 2 * Math.PI); ctx.stroke(); } };
  const renderArc = (ctx, entity) => {
    if (entity.center && entity.radius) {
      let startAngle = entity.startAngle || 0;
      let endAngle = entity.endAngle || 360;
      if (endAngle > 7 || endAngle < -7) { startAngle = (startAngle * Math.PI) / 180; endAngle = (endAngle * Math.PI) / 180; }
      const angleDiff = Math.abs(endAngle - startAngle);
      ctx.beginPath();
      if (angleDiff >= 2 * Math.PI - 0.01 || angleDiff <= 0.01) ctx.arc(entity.center.x, -entity.center.y, entity.radius, 0, 2 * Math.PI);
      else ctx.arc(entity.center.x, -entity.center.y, entity.radius, startAngle, endAngle);
      ctx.stroke();
    }
  };
  const renderText = (ctx, entity) => { if (entity.startPoint && entity.text) { ctx.save(); ctx.fillStyle = "#333333"; ctx.font = `${entity.textHeight || 10}px Arial`; ctx.fillText(entity.text, entity.startPoint.x, -entity.startPoint.y); ctx.restore(); } };
  const renderDXF = (dxfData, currentScale = scale, currentOffset = offset) => {
    const canvas = canvasRef.current; if (!canvas || !dxfData || !dxfData.entities) return;
    const ctx = canvas.getContext("2d"); canvas.width = 900; canvas.height = 400;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e6f3ff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(currentOffset.x, currentOffset.y); ctx.scale(currentScale, currentScale); dxfData.entities.forEach((entity) => renderEntity(ctx, entity)); ctx.restore();
  };

  // ==================== 파일 로드 ====================
  const loadFile = async (filePathOrBlobUrl, retryCount = 0) => {
    if (retryCount === 0) { setLoading(true); setError(null); }
    try {
      let dxfText;
      if (filePathOrBlobUrl.startsWith("blob:")) {
        const res = await fetch(filePathOrBlobUrl); const buffer = await res.arrayBuffer(); dxfText = new TextDecoder("utf-8").decode(buffer);
      } else {
        const apiUrl = `http://localhost:8080/api/cad/convertAndGetDxf?fileName=${filePathOrBlobUrl}`;
        const res = await fetch(apiUrl); if (!res.ok) throw new Error(`API 요청 실패: ${res.status}`); dxfText = await res.text();
      }
      const parser = new DxfParser(); const dxf = parser.parseSync(dxfText); setDxfData(dxf);
      const bounds = calculateBounds(dxf.entities);
      if (bounds) { const autoScale = calculateScale(bounds, 900, 400); const autoOffset = calculateOffset(bounds, 900, 400, autoScale); setScale(autoScale); setOffset(autoOffset); renderDXF(dxf, autoScale, autoOffset); } 
      else renderDXF(dxf);
    } catch (err) {
      console.error(err);
      if (err.message.includes("EOF group not read") && retryCount < MAX_RETRIES) setTimeout(() => loadFile(filePathOrBlobUrl, retryCount + 1), RETRY_DELAY);
      else setError(err.message);
    } finally { if (retryCount === 0) setLoading(false); }
  };

  const calculateBounds = (entities) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity; let hasValidCoords = false;
    entities.forEach((entity) => { const coords = getEntityCoordinates(entity); coords.forEach((coord) => { if (typeof coord.x === "number" && typeof coord.y === "number") { minX = Math.min(minX, coord.x); minY = Math.min(minY, coord.y); maxX = Math.max(maxX, coord.x); maxY = Math.max(maxY, coord.y); hasValidCoords = true; } }); });
    return hasValidCoords ? { minX, minY, maxX, maxY } : null;
  };
  const getEntityCoordinates = (entity) => {
    const coords = [];
    switch (entity.type) {
      case "LINE": if (entity.vertices?.length >= 2) coords.push(...entity.vertices); break;
      case "POLYLINE":
      case "LWPOLYLINE": if (entity.vertices) coords.push(...entity.vertices); break;
      case "CIRCLE":
      case "ARC": if (entity.center) { const r = entity.radius || 0; coords.push({ x: entity.center.x - r, y: entity.center.y - r }, { x: entity.center.x + r, y: entity.center.y + r }); } break;
      case "TEXT": if (entity.startPoint) coords.push(entity.startPoint); break;
      case "INSERT": if (entity.position) coords.push(entity.position); else if (entity.insertionPoint) coords.push(entity.insertionPoint); else if (entity.x !== undefined && entity.y !== undefined) coords.push({ x: entity.x, y: entity.y }); break;
    }
    return coords;
  };
  const calculateScale = (bounds, canvasWidth, canvasHeight) => { const dxfWidth = bounds.maxX - bounds.minX; const dxfHeight = bounds.maxY - bounds.minY; if (!dxfWidth || !dxfHeight) return 1; const scaleX = (canvasWidth * 0.6) / dxfWidth; const scaleY = (canvasHeight * 0.6) / dxfHeight; return Math.max(Math.min(scaleX, scaleY), (Math.min(canvasWidth, canvasHeight) / Math.max(dxfWidth, dxfHeight)) * 0.1); };
  const calculateOffset = (bounds, canvasWidth, canvasHeight, scale) => { const dxfWidth = bounds.maxX - bounds.minX; const dxfHeight = bounds.maxY - bounds.minY; const scaledWidth = dxfWidth * scale; const scaledHeight = dxfHeight * scale; return { x: (canvasWidth - scaledWidth) / 2 - bounds.minX * scale, y: canvasHeight - (canvasHeight - scaledHeight) / 2 + bounds.minY * scale }; };

  // ==================== 저장된 구역 로드 ====================
  const loadSavedAreas = async (modelId) => {
    try {
      console.log('🔍 저장된 구역 데이터 로드 시작:', modelId);
      const response = await fetch(`http://localhost:8080/api/cad/area/list/${modelId}`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.areas && result.areas.length > 0) {
          const loadedAreas = result.areas.map(area => area.coordinates.sort((a, b) => a.pointOrder - b.pointOrder).map(coord => ({ x: coord.x, y: coord.y })));
          setCompletedAreas(loadedAreas);
          if (areaManagerRef.current) loadedAreas.forEach(coordinates => areaManagerRef.current.addArea(coordinates));
        }
      }
    } catch (error) { console.error('❌ 구역 데이터 로드 중 오류:', error); }
  };

  // ==================== 마우스 이벤트 ====================
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas || !dxfData) return;
    let isMouseDown = false, mouseX = 0, mouseY = 0;
    const handleWheel = (event) => { event.preventDefault(); const rect = canvas.getBoundingClientRect(); const mouseCanvasX = event.clientX - rect.left; const mouseCanvasY = event.clientY - rect.top; const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1; const newScale = scale * zoomFactor; const newOffset = { x: mouseCanvasX - (mouseCanvasX - offset.x) * zoomFactor, y: mouseCanvasY - (mouseCanvasY - offset.y) * zoomFactor }; setScale(newScale); setOffset(newOffset); renderDXF(dxfData, newScale, newOffset); };
    const handleMouseDown = (event) => { if (isPenMode || isDeleteMode) return; isMouseDown = true; mouseX = event.clientX; mouseY = event.clientY; };
    const handleMouseMove = (event) => { if (isPenMode || isDeleteMode || !isMouseDown) return; const deltaX = event.clientX - mouseX; const deltaY = event.clientY - mouseY; const newOffset = { x: offset.x + deltaX, y: offset.y + deltaY }; setOffset(newOffset); mouseX = event.clientX; mouseY = event.clientY; renderDXF(dxfData, scale, newOffset); };
    const handleMouseUp = () => { isMouseDown = false; };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    return () => { canvas.removeEventListener("wheel", handleWheel); canvas.removeEventListener("mousedown", handleMouseDown); canvas.removeEventListener("mousemove", handleMouseMove); canvas.removeEventListener("mouseup", handleMouseUp); canvas.removeEventListener("mouseleave", handleMouseUp); };
  }, [dxfData, scale, offset, isPenMode, isDeleteMode]);

  // ==================== 버튼 이벤트 ====================
  const handlePenMode = () => { const newPen = !isPenMode; setIsPenMode(newPen); if (newPen) setIsDeleteMode(false); };
  const handleEraser = () => { const newDel = !isDeleteMode; setIsDeleteMode(newDel); if (newDel) setIsPenMode(false); };
  const handleFitToView = () => { if (dxfData) { const bounds = calculateBounds(dxfData.entities); if (bounds) { const s = calculateScale(bounds, 900, 400); const o = calculateOffset(bounds, 900, 400, s); setScale(s); setOffset(o); renderDXF(dxfData, s, o); } } };

  const handleAreaComplete = (coordinates) => { setCompletedAreas(prev => [...prev, coordinates]); if (areaManagerRef.current) areaManagerRef.current.addArea(coordinates); };
  const handleAreasChange = (areas) => { setCompletedAreas(areas.map(a => a.coordinates)); };

  // ==================== 저장 시 서버 API 호출 (drawingStatus: 'I' 추가) ====================
 const handleSaveJSON = async () => {
  if (!currentModelId || completedAreas.length === 0) return;

  try {
    for (let areaIndex = 0; areaIndex < completedAreas.length; areaIndex++) {
      const coordinates = completedAreas[areaIndex];

      // 이미 저장된 구역이면 skip
      if (coordinates.saved) continue;

      const calculateArea = (coords) => {
        if (coords.length < 3) return 0.0;
        let area = 0.0;
        const n = coords.length;
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n;
          area += coords[i].x * coords[j].y;
          area -= coords[j].x * coords[i].y;
        }
        return Math.abs(area / 2.0);
      };

      const areaData = {
        modelId: currentModelId,
        areaNm: `구역_${areaIndex + 1}`,
        areaDesc: `구역 ${areaIndex + 1} 설명`,
        areaColor: "#FF0000",
        areaSize: Math.round(calculateArea(coordinates)),
        areaStyle: "SOLID",
        drawingStatus: 'I',
        coordinates: coordinates.map((pt, order) => ({ pointOrder: order + 1, x: Math.round(pt.x * 1000) / 1000, y: Math.round(pt.y * 1000) / 1000 }))
      };

      await fetch('http://localhost:8080/api/cad/area/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(areaData)
      });

      // 저장 완료 표시
      coordinates.saved = true;
    }

    if (onSave) onSave({ savedCount: completedAreas.filter(a => a.saved).length, totalAreas: completedAreas.length });

  } catch (error) {
    console.error(error);
  }
};

  useEffect(() => { if (cadFilePath) loadFile(cadFilePath); }, [cadFilePath]);

  // ==================== 렌더링 ====================
  return (
    <div className="cad-display-panel">
      <div className="panel-header">CAD 도면 표시 영역</div>
      <div className="cad-content">
        <div className="cad-toolbar">
          <button className={`tool-button pen-mode ${isPenMode ? 'active' : ''}`} onClick={handlePenMode}>🖊️</button>
          <button className={`tool-button eraser-button ${isDeleteMode ? 'active' : ''}`} onClick={handleEraser}>🧽</button>
          <button className="tool-button magnifier" onClick={handleFitToView}></button>
        </div>
        {onSave && <button onClick={handleSaveJSON} style={{ position: 'absolute', bottom: '60px', right: '50px', background: '#1976D2', color: 'white', padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px', zIndex: 20 }}>저장</button>}
        <div className="cad-canvas" style={{ position: 'relative' }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', cursor: isPenMode ? 'crosshair' : (isDeleteMode ? 'pointer' : 'default') }} />
          <AreaDrawing canvasRef={canvasRef} isPenMode={isPenMode} dxfData={dxfData} scale={scale} offset={offset} onAreaComplete={handleAreaComplete} completedAreas={completedAreas} />
          <AreaManager ref={areaManagerRef} canvasRef={canvasRef} modelId={currentModelId} scale={scale} offset={offset} onAreasChange={handleAreasChange} isDeleteMode={isDeleteMode} isPenMode={isPenMode} />
        </div>
      </div>
    </div>
  );
};

export default CADDisplay;
