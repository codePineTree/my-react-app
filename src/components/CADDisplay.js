import React, { useRef, useEffect, useState } from "react";
import AreaDrawing from "./AreaDrawing";
import AreaManager from "./AreaManager";

const CADDisplay = ({ 
  cadFilePath, 
  modelId, 
  onSave, 
  cadFileType, 
  selectedAreaId, 
  onClearSelection,
  onSidebarRefresh,
  onAreasChange  // ✅ 추가
}) => {
  const canvasRef = useRef(null);
  const areaManagerRef = useRef(null);
  const areaDrawingRef = useRef(null);

  const [cadData, setCadData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPenMode, setIsPenMode] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [currentModelId, setCurrentModelId] = useState(null);
  const [completedAreas, setCompletedAreas] = useState([]);

  useEffect(() => { 
    if (modelId) setCurrentModelId(modelId); 
  }, [modelId]);

  useEffect(() => { 
    if (currentModelId) loadSavedAreas(currentModelId); 
  }, [currentModelId]);

  const renderEntity = (ctx, entity) => {
    ctx.strokeStyle = "#333333";
    const baseLineWidth = 1 / ctx.getTransform().a;

    const type = entity.type;

    if ((type === "DwfWhipOutlineEllipse" || type === "DwfWhipFilledEllipse") && entity.centerX !== undefined) {
      ctx.save();
      ctx.translate(entity.centerX, -entity.centerY);
      ctx.rotate((entity.rotation || 0) * Math.PI / 180);
      ctx.scale(entity.majorRadius, entity.minorRadius);
      ctx.lineWidth = baseLineWidth / Math.min(entity.majorRadius, entity.minorRadius);
      ctx.beginPath();
      ctx.arc(0, 0, 1, 0, 2 * Math.PI);
      if (entity.filled) {
        ctx.fillStyle = "#333333";
        ctx.fill();
      } else {
        ctx.stroke();
      }
      ctx.restore();
    }
    else if (type === "DwfWhipPolyline" && entity.points?.length > 0) {
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.moveTo(entity.points[0].x, -entity.points[0].y);
      for (let i = 1; i < entity.points.length; i++) {
        ctx.lineTo(entity.points[i].x, -entity.points[i].y);
      }
      ctx.stroke();
    }
    else if (type === "DwfWhipPolygon" && entity.points?.length > 0) {
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.moveTo(entity.points[0].x, -entity.points[0].y);
      for (let i = 1; i < entity.points.length; i++) {
        ctx.lineTo(entity.points[i].x, -entity.points[i].y);
      }
      if (entity.closed) ctx.closePath();
      ctx.stroke();
    }
    else if (type === "CadLine" && entity.startX !== undefined) {
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.moveTo(entity.startX, -entity.startY);
      ctx.lineTo(entity.endX, -entity.endY);
      ctx.stroke();
    }
    else if (type === "CadCircle" && entity.centerX !== undefined) {
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.arc(entity.centerX, -entity.centerY, entity.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
    else if (type === "CadArc" && entity.centerX !== undefined) {
      ctx.lineWidth = baseLineWidth;
      let startAngle = entity.startAngle || 0;
      let endAngle = entity.endAngle || 360;
      
      if (endAngle > 7 || endAngle < -7) {
        startAngle = (startAngle * Math.PI) / 180;
        endAngle = (endAngle * Math.PI) / 180;
      }
      
      ctx.beginPath();
      ctx.arc(entity.centerX, -entity.centerY, entity.radius, startAngle, endAngle);
      ctx.stroke();
    }
    else if (type === "CadLwPolyline" && entity.points?.length > 0) {
      ctx.lineWidth = baseLineWidth;
      ctx.beginPath();
      ctx.moveTo(entity.points[0].x, -entity.points[0].y);
      for (let i = 1; i < entity.points.length; i++) {
        ctx.lineTo(entity.points[i].x, -entity.points[i].y);
      }
      if (entity.closed) ctx.closePath();
      ctx.stroke();
    }
    else if (type === "CadText" && entity.text) {
      ctx.save();
      ctx.fillStyle = "#333333";
      ctx.font = `${entity.height || 10}px Arial`;
      ctx.fillText(entity.text, entity.x, -entity.y);
      ctx.restore();
    }
    else if (type === "CadMText" && entity.text) {
      ctx.save();
      ctx.fillStyle = "#333333";
      ctx.font = `${entity.height || 10}px Arial`;
      ctx.fillText(entity.text, entity.x, -entity.y);
      ctx.restore();
    }
  };

  const renderCADModelOnly = (currentScale = scale, currentOffset = offset) => {
    const canvas = canvasRef.current;
    if (!canvas || !cadData || !cadData.entities) return;

    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e6f3ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(currentOffset.x, currentOffset.y);
    ctx.scale(currentScale, currentScale);
    cadData.entities.forEach((entity) => renderEntity(ctx, entity));
    ctx.restore();
  };

  const handleRedrawCanvas = () => {
    renderCADModelOnly();
    if (areaManagerRef.current) {
      setTimeout(() => {
        areaManagerRef.current.redrawAreasOnly();
      }, 10);
    }
  };

  const loadFile = async (fileName) => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = `http://localhost:8080/api/cad/parseWithAspose`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: fileName })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('서버 에러 응답:', errorText);
        throw new Error(`API 요청 실패: ${response.status}`);
      }

      const data = await response.json();
      setCadData(data);

      const bounds = calculateBounds(data.entities);
      if (bounds) {
        const autoScale = calculateScale(bounds, 900, 400);
        const autoOffset = calculateOffset(bounds, 900, 400, autoScale);
        setScale(autoScale);
        setOffset(autoOffset);
        setTimeout(() => renderCADModelOnly(autoScale, autoOffset), 0);
      } else {
        setTimeout(() => renderCADModelOnly(), 0);
      }
    } catch (err) {
      console.error('❌ 파일 로드 실패:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateBounds = (entities) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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
    const type = entity.type;

    if ((type === "DwfWhipOutlineEllipse" || type === "DwfWhipFilledEllipse") && entity.centerX !== undefined) {
      const r = Math.max(entity.majorRadius, entity.minorRadius);
      coords.push(
        { x: entity.centerX - r, y: entity.centerY - r },
        { x: entity.centerX + r, y: entity.centerY + r }
      );
    }
    else if ((type === "DwfWhipPolyline" || type === "DwfWhipPolygon") && entity.points) {
      coords.push(...entity.points);
    }
    else if (type === "CadLine" && entity.startX !== undefined) {
      coords.push({ x: entity.startX, y: entity.startY });
      coords.push({ x: entity.endX, y: entity.endY });
    } 
    else if ((type === "CadCircle" || type === "CadArc") && entity.centerX !== undefined) {
      const r = entity.radius || 0;
      coords.push(
        { x: entity.centerX - r, y: entity.centerY - r },
        { x: entity.centerX + r, y: entity.centerY + r }
      );
    } 
    else if (type === "CadLwPolyline" && entity.points) {
      coords.push(...entity.points);
    } 
    else if ((type === "CadText" || type === "CadMText") && entity.x !== undefined) {
      coords.push({ x: entity.x, y: entity.y });
    }

    return coords;
  };

  const calculateScale = (bounds, canvasWidth, canvasHeight) => {
    const dxfWidth = bounds.maxX - bounds.minX;
    const dxfHeight = bounds.maxY - bounds.minY;
    if (!dxfWidth || !dxfHeight) return 1;

    const scaleX = (canvasWidth * 0.6) / dxfWidth;
    const scaleY = (canvasHeight * 0.6) / dxfHeight;
    return Math.max(
      Math.min(scaleX, scaleY),
      (Math.min(canvasWidth, canvasHeight) / Math.max(dxfWidth, dxfHeight)) * 0.1
    );
  };

  const calculateOffset = (bounds, canvasWidth, canvasHeight, scale) => {
    const dxfWidth = bounds.maxX - bounds.minX;
    const dxfHeight = bounds.maxY - bounds.minY;
    const scaledWidth = dxfWidth * scale;
    const scaledHeight = dxfHeight * scale;

    return {
      x: (canvasWidth - scaledWidth) / 2 - bounds.minX * scale,
      y: canvasHeight - (canvasHeight - scaledHeight) / 2 + bounds.minY * scale
    };
  };

  const loadSavedAreas = async (modelId) => {
    try {
      const response = await fetch(`http://localhost:8080/api/cad/area/list/${modelId}`);

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.areas && result.areas.length > 0) {
          result.areas.forEach(areaData => {
            const coordinates = areaData.coordinates
              .sort((a, b) => a.pointOrder - b.pointOrder)
              .map(coord => ({ x: coord.x, y: coord.y }));

            if (areaManagerRef.current) {
              areaManagerRef.current.addSavedArea({
                areaId: areaData.areaId,
                coordinates: coordinates,
                areaName: areaData.areaNm || `구역_${areaData.areaId}`,
                areaDesc: areaData.areaDesc || '',
                areaColor: areaData.areaColor || '#CCCCCC'
              });
            }
          });

          const loadedCoordinates = result.areas.map(area =>
            area.coordinates
              .sort((a, b) => a.pointOrder - b.pointOrder)
              .map(coord => ({ x: coord.x, y: coord.y }))
          );
          setCompletedAreas(loadedCoordinates);
        }
      }
    } catch (error) {
      console.error('구역 로드 오류:', error);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !cadData) return;

    let isMouseDown = false, mouseX = 0, mouseY = 0;

    const handleWheel = (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseCanvasX = event.clientX - rect.left;
      const mouseCanvasY = event.clientY - rect.top;
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = scale * zoomFactor;
      const newOffset = {
        x: mouseCanvasX - (mouseCanvasX - offset.x) * zoomFactor,
        y: mouseCanvasY - (mouseCanvasY - offset.y) * zoomFactor
      };
      setScale(newScale);
      setOffset(newOffset);

      renderCADModelOnly(newScale, newOffset);
      if (areaManagerRef.current) {
        setTimeout(() => areaManagerRef.current.redrawAreasOnly(), 50);
      }
    };

    const handleMouseDown = (event) => {
      if (isPenMode || isDeleteMode) return;
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleMouseMove = (event) => {
      if (isPenMode || isDeleteMode || !isMouseDown) return;
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      const newOffset = { x: offset.x + deltaX, y: offset.y + deltaY };
      setOffset(newOffset);
      mouseX = event.clientX;
      mouseY = event.clientY;

      renderCADModelOnly(scale, newOffset);
      if (areaManagerRef.current) {
        setTimeout(() => areaManagerRef.current.redrawAreasOnly(), 50);
      }
    };

    const handleMouseUp = () => { isMouseDown = false; };

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
  }, [cadData, scale, offset, isPenMode, isDeleteMode]);

  const handlePenMode = () => {
    const newPen = !isPenMode;
    setIsPenMode(newPen);
    if (newPen) setIsDeleteMode(false);
  };

  const handleEraser = () => {
    const newDel = !isDeleteMode;
    setIsDeleteMode(newDel);
    if (newDel) setIsPenMode(false);
  };

  const handleFitToView = () => {
    if (cadData) {
      const bounds = calculateBounds(cadData.entities);
      if (bounds) {
        const s = calculateScale(bounds, 900, 400);
        const o = calculateOffset(bounds, 900, 400, s);
        setScale(s);
        setOffset(o);
        renderCADModelOnly(s, o);
        if (areaManagerRef.current) {
          setTimeout(() => areaManagerRef.current.redrawAreasOnly(), 50);
        }
      }
    }
  };

  const handleAreaComplete = (coordinates) => {
    setCompletedAreas(prev => [...prev, coordinates]);
    if (areaManagerRef.current) {
      areaManagerRef.current.addArea(coordinates);
      setTimeout(() => {
        renderCADModelOnly();
        setTimeout(() => {
          areaManagerRef.current.redrawAreasOnly();
        }, 10);
      }, 50);
    }
  };

  // ✅ 수정: App.js로 구역 정보 전달 (실시간 업데이트)
  const handleAreasChange = (areas) => {
    console.log('📋 CADDisplay - handleAreasChange 호출:', areas.length);
    setCompletedAreas(areas.map(a => a.coordinates));
    
    // ✅ App.js로 구역 정보 전달 (Sidebar 실시간 반영)
    if (onAreasChange) {
      console.log('🔼 CADDisplay → App.js: onAreasChange 호출');
      onAreasChange(areas);
    }
  };

  const handleSaveJSON = async () => {
    if (!currentModelId || !areaManagerRef.current) return;

    const hasIncompleteArea = areaDrawingRef.current?.hasIncompleteArea();
    if (hasIncompleteArea) {
      const confirmed = window.confirm("미완성된 구역이 존재합니다. 구역을 저장하시겠습니까?");
      if (confirmed) {
        areaDrawingRef.current?.clearClickedPoints();
        handleRedrawCanvas();
      } else {
        return;
      }
    }

    try {
      const newAreasToSave = areaManagerRef.current.getAreasToSave();
      const editingAreasToSave = areaManagerRef.current.getEditingAreasForSave();
      const deletedAreasToSave = areaManagerRef.current.getDeletedAreasForSave();

      let savedCount = 0;

      for (const area of newAreasToSave) {
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

        const editData = editingAreasToSave.find(editArea => editArea.areaId === area.areaId);
        const finalAreaData = editData || area;

        const areaData = {
          modelId: currentModelId,
          areaNm: finalAreaData.areaName || `구역_${savedCount + 1}`,
          areaDesc: finalAreaData.areaDesc || '',
          areaColor: finalAreaData.areaColor || "#CCCCCC",
          areaSize: Math.round(calculateArea(area.coordinates)),
          areaStyle: "SOLID",
          drawingStatus: 'I',
          coordinates: area.coordinates.map((pt, order) => ({
            pointOrder: order + 1,
            x: Math.round(pt.x * 1000) / 1000,
            y: Math.round(pt.y * 1000) / 1000
          }))
        };

        const response = await fetch('http://localhost:8080/api/cad/area/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(areaData)
        });

        if (response.ok) savedCount++;
      }

      for (const area of editingAreasToSave) {
        const areaData = {
          areaId: area.areaId,
          areaNm: area.areaName,
          areaDesc: area.areaDesc,
          areaColor: area.areaColor,
          areaStyle: area.areaStyle || "SOLID",
          drawingStatus: 'U'
        };

        const response = await fetch('http://localhost:8080/api/cad/area/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(areaData)
        });

        if (response.ok) savedCount++;
      }

      for (const area of deletedAreasToSave) {
        const deleteData = {
          areaId: area.areaId,
          drawingStatus: 'D'
        };

        const response = await fetch('http://localhost:8080/api/cad/area/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deleteData)
        });

        if (response.ok) savedCount++;
      }

      if (editingAreasToSave.length > 0) {
        areaManagerRef.current.applyEditingChanges();
      }

      if (newAreasToSave.length > 0) {
        areaManagerRef.current.clearTempAreas();
      }

      if (deletedAreasToSave.length > 0) {
        areaManagerRef.current.clearDeletedAreas();
      }

      if (savedCount > 0) {
        await loadSavedAreas(currentModelId);
        if (areaManagerRef.current) {
          areaManagerRef.current.closeAllPopupsAfterSave();
        }
        // ✅ 저장 후 선택 해제
        if (onClearSelection) {
          onClearSelection();
        }
        // ✅ 저장 후 사이드바 새로고침
        if (onSidebarRefresh) {
          onSidebarRefresh();
        }
      }

      const totalChanges = newAreasToSave.length + editingAreasToSave.length + deletedAreasToSave.length;

      if (onSave) {
        onSave({
          savedCount,
          totalAreas: totalChanges,
          message: totalChanges === 0 ? '저장할 변경사항이 없습니다.' : '저장되었습니다.'
        });
      }
    } catch (error) {
      console.error('저장 오류:', error);
      if (onSave) {
        onSave({
          savedCount: 0,
          totalAreas: 0,
          error: '저장 중 오류가 발생했습니다.'
        });
      }
    }
  };

  useEffect(() => {
    if (cadFilePath) loadFile(cadFilePath);
  }, [cadFilePath]);

  return (
    <div className="cad-display-panel">
      <div className="panel-header">CAD 도면 표시 영역</div>
      <div className="cad-content">
        {loading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.9)',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            textAlign: 'center'
          }}>
            <div>로딩 중...</div>
            <div style={{ fontSize: '14px', color: '#666' }}>CAD 파일 파싱 중...</div>
          </div>
        )}

        {error && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 0, 0, 0.1)',
            color: '#FF0000',
            padding: '20px',
            borderRadius: '8px',
            border: '2px solid #FF0000',
            zIndex: 1000
          }}>
            <div>오류 발생</div>
            <div style={{ fontSize: '14px' }}>{error}</div>
          </div>
        )}

        <div className="cad-toolbar">
          <button className={`tool-button pen-mode ${isPenMode ? 'active' : ''}`} onClick={handlePenMode} disabled={loading}>🖊️</button>
          <button className={`tool-button eraser-button ${isDeleteMode ? 'active' : ''}`} onClick={handleEraser} disabled={loading}>🧽</button>
          <button className="tool-button magnifier" onClick={handleFitToView} disabled={loading}></button>
        </div>

        {onSave && (
          <button
            onClick={handleSaveJSON}
            disabled={loading}
            style={{
              position: 'absolute',
              bottom: '60px',
              right: '50px',
              background: loading ? '#ccc' : '#1976D2',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '4px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 'bold',
              zIndex: 20
            }}
          >
            저장
          </button>
        )}

        <div className="cad-canvas" style={{ position: 'relative', opacity: loading ? 0.5 : 1 }}>
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: isPenMode ? 'crosshair' : (isDeleteMode ? 'pointer' : 'default')
            }}
          />
          <AreaDrawing
            ref={areaDrawingRef}
            canvasRef={canvasRef}
            isPenMode={isPenMode}
            dxfData={cadData}
            scale={scale}
            offset={offset}
            onAreaComplete={handleAreaComplete}
            completedAreas={completedAreas}
            onRedrawCanvas={handleRedrawCanvas}
          />
          <AreaManager
            ref={areaManagerRef}
            canvasRef={canvasRef}
            modelId={currentModelId}
            scale={scale}
            offset={offset}
            onAreasChange={handleAreasChange}
            isDeleteMode={isDeleteMode}
            isPenMode={isPenMode}
            onRequestCADRedraw={renderCADModelOnly}
            selectedAreaId={selectedAreaId}
          />
        </div>
      </div>
    </div>
  );
};

export default CADDisplay;