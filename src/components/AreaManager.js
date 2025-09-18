import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";

/**
 * AreaManager 컴포넌트 
 * 역할: 생성된 구역들의 로컬 상태 관리 (DB 연동 없음)
 * 
 * 주요 기능:
 * 1. 로컬 구역들의 상태 관리
 * 2. 구역 클릭 감지 및 속성 폼 표시
 * 3. 구역 삭제 처리 (로컬에서만)
 * 4. 저장된 구역들을 Canvas에 렌더링
 */
const AreaManager = forwardRef(({ 
  canvasRef,
  modelId,
  scale,
  offset,
  onAreasChange,
  isDeleteMode,
  isPenMode
}, ref) => {

  const [savedAreas, setSavedAreas] = useState([]);
  const [selectedArea, setSelectedArea] = useState(null);
  const [showPropertyForm, setShowPropertyForm] = useState(false);

  const worldToCanvasCoord = (worldCoord) => ({
    x: worldCoord.x * scale + offset.x,
    y: -worldCoord.y * scale + offset.y
  });

  const isPointInPolygon = (point, polygon) => {
    if (polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  };

  const findAreaByPoint = (worldCoord) => {
    for (let i = savedAreas.length - 1; i >= 0; i--) {
      const area = savedAreas[i];
      if (area.coordinates && isPointInPolygon(worldCoord, area.coordinates)) {
        return area;
      }
    }
    return null;
  };

  const handleCanvasClick = (event) => {
    if (isPenMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;

    const worldCoord = {
      x: (canvasX - offset.x) / scale,
      y: -((canvasY - offset.y) / scale)
    };

    const clickedArea = findAreaByPoint(worldCoord);

    if (clickedArea) {
      if (isDeleteMode) {
        setSavedAreas(prev => prev.filter(area => area.areaId !== clickedArea.areaId));
      } else {
        setSelectedArea(clickedArea);
        setShowPropertyForm(true);
      }
    } else {
      setSelectedArea(null);
      setShowPropertyForm(false);
    }
  };

  const renderSavedAreas = () => {
    const canvas = canvasRef.current;
    if (!canvas || savedAreas.length === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.save();

    savedAreas.forEach(area => {
      if (!area.coordinates || area.coordinates.length < 3) return;

      ctx.fillStyle = area.areaColor || '#CCCCCC';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();

      area.coordinates.forEach((point, index) => {
        const canvasCoord = worldToCanvasCoord(point);
        if (index === 0) ctx.moveTo(canvasCoord.x, canvasCoord.y);
        else ctx.lineTo(canvasCoord.x, canvasCoord.y);
      });

      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = area.areaColor || '#999999';
      ctx.lineWidth = 2;
      ctx.stroke();

      if (selectedArea && selectedArea.areaId === area.areaId) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    ctx.restore();
  };

  useImperativeHandle(ref, () => ({
    addArea: (coordinates) => {
      if (!coordinates || coordinates.length < 3) {
        alert('구역을 그리려면 최소 3개의 점이 필요합니다.');
        return;
      }

      const newArea = {
        areaId: `temp_${Date.now()}`,
        coordinates: coordinates,
        areaName: `구역_${savedAreas.length + 1}`,
        areaDesc: '',
        areaColor: '#CCCCCC',
        drawingStatus: 'I' // 새로 생성된 구역 상태

      };

      setSavedAreas(prev => [...prev, newArea]);
    },

    refreshAreas: () => {
      console.log('새로고침 요청 무시 (로컬 모드)');
    },

    getSavedAreas: () => savedAreas,

    saveAllAreasToDb: () => {
      const newAreas = savedAreas.filter(area => area.RowStatus === 'I');
      console.log(`${newAreas.length}개 구역 저장 예정 (API 호출)`);

      setSavedAreas(prev => 
        prev.map(area => area.RowStatus === 'I' ? { ...area, RowStatus: 'U' } : area)
      );

      return true;
    },

    clearTempAreas: () => {
      setSavedAreas(prev => prev.filter(area => area.RowStatus !== 'I'));
    }
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);
    return () => canvas.removeEventListener('click', handleCanvasClick);
  }, [savedAreas, isDeleteMode, isPenMode, scale, offset]);

  useEffect(() => {
    renderSavedAreas();
  }, [savedAreas, selectedArea, scale, offset]);

  const PropertyForm = () => {
    const [areaName, setAreaName] = useState(selectedArea?.areaName || '');
    const [description, setDescription] = useState(selectedArea?.areaDesc || '');
    const [color, setColor] = useState(selectedArea?.areaColor || '#CCCCCC');

    const handleSave = () => {
      if (!selectedArea) return;
      const updatedArea = {
        ...selectedArea,
        areaName,
        areaDesc: description,
        areaColor: color
      };
      setSavedAreas(prev => 
        prev.map(area => area.areaId === selectedArea.areaId ? updatedArea : area)
      );
      setShowPropertyForm(false);
      setSelectedArea(null);
    };

    const handleCancel = () => {
      setShowPropertyForm(false);
      setSelectedArea(null);
    };

    return (
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
        minWidth: '300px'
      }}>
        <h3>구역 속성 편집</h3>
        <div style={{ marginBottom: '10px' }}>
          <label>구역명:</label>
          <input 
            type="text" 
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>설명:</label>
          <textarea 
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>색상:</label>
          <input 
            type="color" 
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{ marginTop: '5px', marginLeft: '10px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button onClick={handleCancel} style={{ padding: '8px 16px' }}>취소</button>
          <button 
            onClick={handleSave} 
            style={{ padding: '8px 16px', backgroundColor: '#1976D2', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            저장
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {savedAreas.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '10px',
          right: '10px',
          background: 'rgba(0, 123, 255, 0.1)',
          color: '#1976D2',
          padding: '5px 10px',
          borderRadius: '4px',
          fontSize: '12px',
          border: '1px solid #1976D2',
          zIndex: 999
        }}>
          저장된 구역: {savedAreas.length}개
        </div>
      )}

      {isDeleteMode && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '10px',
          background: 'rgba(255, 0, 0, 0.1)',
          color: '#FF0000',
          padding: '8px 12px',
          borderRadius: '4px',
          fontSize: '12px',
          border: '2px solid #FF0000',
          fontWeight: 'bold',
          zIndex: 999
        }}>
          🧽 구역 삭제 모드 - 삭제할 구역을 클릭하세요
        </div>
      )}

      {showPropertyForm && selectedArea && <PropertyForm />}
    </>
  );
});

export default AreaManager;
