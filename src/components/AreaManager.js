import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";

/**
 * AreaManager 컴포넌트 
 * 역할: 생성된 구역들의 로컬 상태 관리 및 AREA_ID 기준 삭제
 * 
 * 주요 기능:
 * 1. 로컬 구역들의 상태 관리
 * 2. 구역 클릭 감지 및 속성 폼 표시
 * 3. AREA_ID 기준 구역 삭제 처리 (로컬 + DB)
 * 4. 저장된 구역들을 Canvas에 렌더링 (CAD 모델 위에 오버레이)
 */
const AreaManager = forwardRef(({ 
  canvasRef,
  modelId,
  scale,
  offset,
  onAreasChange,
  isDeleteMode,
  isPenMode,
  onRequestCADRedraw
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
      if (area.coordinates && area.drawingStatus !== 'D' && isPointInPolygon(worldCoord, area.coordinates)) {
        return area;
      }
    }
    return null;
  };

  // ✅ AREA_ID 기준 삭제 처리 함수 - 통합 API 사용
  const deleteAreaById = async (areaId) => {
    const areaToDelete = savedAreas.find(area => area.areaId === areaId);
    if (!areaToDelete) {
      console.log(`❌ 삭제할 구역을 찾을 수 없음: ${areaId}`);
      return false;
    }

    console.log(`🗑️ 구역 삭제 시작: ${areaId}`, areaToDelete);

    // 케이스 1: 이미 DB에 저장된 구역 (실제 AREA_ID 존재)
    if (areaToDelete.areaId && !areaToDelete.areaId.startsWith('temp_')) {
      try {
        // ✅ 통합 API로 삭제 요청 (drawingStatus: 'D')
        const deleteData = {
          drawingStatus: 'D',
          areaId: areaId
        };

        const response = await fetch('http://localhost:8080/api/cad/area/save', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(deleteData)
        });

        const result = await response.json();
        if (result.success) {
          console.log(`✅ DB에서 구역 삭제 성공: ${areaId}`);
          // 로컬에서도 제거
          setSavedAreas(prev => {
            const newAreas = prev.filter(area => area.areaId !== areaId);
            // ✅ 상위 컴포넌트에 변경사항 알림 (활성 구역만)
            const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
            if (onAreasChange) onAreasChange(activeAreas);
            return newAreas;
          });
        } else {
          console.error(`❌ DB 삭제 실패:`, result.message);
          // DB 삭제 실패시에도 로컬에서는 삭제 상태로 표시
          setSavedAreas(prev => {
            const newAreas = prev.map(area => 
              area.areaId === areaId 
                ? { ...area, drawingStatus: 'D' } 
                : area
            );
            // ✅ 상위 컴포넌트에 변경사항 알림 (활성 구역만)
            const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
            if (onAreasChange) onAreasChange(activeAreas);
            return newAreas;
          });
        }
      } catch (error) {
        console.error(`❌ DB 삭제 중 오류:`, error);
        // 네트워크 오류시에도 로컬에서는 삭제 상태로 표시
        setSavedAreas(prev => {
          const newAreas = prev.map(area => 
            area.areaId === areaId 
              ? { ...area, drawingStatus: 'D' } 
              : area
          );
          // ✅ 상위 컴포넌트에 변경사항 알림 (활성 구역만)
          const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
          if (onAreasChange) onAreasChange(activeAreas);
          return newAreas;
        });
      }
    } 
    // 케이스 2: 저장 전 임시 구역 (temp_로 시작하는 ID)
    else if (areaToDelete.areaId.startsWith('temp_')) {
      console.log(`🗑️ 임시 구역 로컬 삭제: ${areaId}`);
      // 로컬에서만 완전히 제거 (DB 호출 불필요)
      setSavedAreas(prev => {
        const newAreas = prev.filter(area => area.areaId !== areaId);
        // ✅ 상위 컴포넌트에 변경사항 알림 (활성 구역만)
        const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
        if (onAreasChange) onAreasChange(activeAreas);
        return newAreas;
      });
    }

    return true;
  };

  const handleCanvasClick = async (event) => {
    // 팬모드이면서 지우개 모드가 아니면 클릭 무시
    if (isPenMode && !isDeleteMode) return;

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
        console.log(`🗑️ 구역 삭제 요청: ${clickedArea.areaId}`);
        
        // 사용자 확인
        const confirmed = window.confirm(`해당 구역을 삭제하시겠습니까?`);
        if (confirmed) {
          await deleteAreaById(clickedArea.areaId);
        }
      } else {
        setSelectedArea(clickedArea);
        setShowPropertyForm(true);
      }
    } else {
      setSelectedArea(null);
      setShowPropertyForm(false);
    }
  };

  // ✅ 구역만 렌더링하는 함수 - CAD 모델은 건드리지 않음
  const renderAreasOnly = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // 활성 구역만 필터링 (삭제되지 않은 구역만)
    const activeAreas = savedAreas.filter(area => area.drawingStatus !== 'D');

    activeAreas.forEach((area) => {
      if (!area.coordinates || area.coordinates.length < 3) {
        return;
      }

      ctx.save();

      ctx.fillStyle = area.areaColor || '#CCCCCC';
      ctx.globalAlpha = 0.3;
      ctx.beginPath();

      area.coordinates.forEach((point, pointIndex) => {
        const canvasCoord = worldToCanvasCoord(point);
        if (pointIndex === 0) ctx.moveTo(canvasCoord.x, canvasCoord.y);
        else ctx.lineTo(canvasCoord.x, canvasCoord.y);
      });

      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = area.areaColor || '#999999';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 선택된 구역 강조 표시
      if (selectedArea && selectedArea.areaId === area.areaId) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  };

  // ✅ 전체 다시 그리기 (CAD + 구역)
  const renderSavedAreas = () => {
    // CAD 모델 먼저 렌더링
    if (onRequestCADRedraw) {
      onRequestCADRedraw();
    }
    
    // 구역들을 CAD 모델 위에 그리기
    requestAnimationFrame(() => {
      renderAreasOnly();
    });
  };

  useImperativeHandle(ref, () => ({
    // ✅ 저장된 구역 추가 (DB에서 로드할 때 사용)
    addSavedArea: (areaData) => {
      const newArea = {
        areaId: areaData.areaId, // 실제 DB의 AREA_ID
        coordinates: areaData.coordinates,
        areaName: areaData.areaName || `구역_${areaData.areaId}`,
        areaDesc: areaData.areaDesc || '',
        areaColor: areaData.areaColor || '#CCCCCC',
        drawingStatus: 'U' // 기존 저장된 구역
      };
      
      setSavedAreas(prev => [...prev, newArea]);
      console.log('✅ 저장된 구역 추가:', newArea.areaId);
    },

    // ✅ 임시 구역 추가 (새로 그릴 때 사용)
    addArea: (coordinates) => {
      if (!coordinates || coordinates.length < 3) {
        alert('구역을 그리려면 최소 3개의 점이 필요합니다.');
        return;
      }

      const newArea = {
        areaId: `temp_${Date.now()}`, // 임시 ID
        coordinates: coordinates,
        areaName: `임시구역_${Date.now()}`,
        areaDesc: '',
        areaColor: '#CCCCCC',
        drawingStatus: 'I' // 새로 생성된 구역 상태
      };

      setSavedAreas(prev => [...prev, newArea]);
      console.log('✅ 임시 구역 추가:', newArea.areaId);
    },

    // ✅ 특정 구역 삭제 (외부에서 호출 가능)
    deleteArea: (areaId) => {
      return deleteAreaById(areaId);
    },

    refreshAreas: () => {
      console.log('새로고침 요청 무시 (로컬 모드)');
    },

    getSavedAreas: () => savedAreas.filter(area => area.drawingStatus !== 'D'),

    // ✅ 저장할 구역만 반환 (임시 구역 중 삭제되지 않은 것들)
    getAreasToSave: () => {
      return savedAreas.filter(area => 
        area.drawingStatus === 'I' && // 새로 생성된 구역만
        area.areaId.startsWith('temp_') // 임시 구역만
      );
    },

    saveAllAreasToDb: () => {
      const areasToSave = savedAreas.filter(area => 
        area.drawingStatus === 'I' && 
        area.areaId.startsWith('temp_')
      );
      
      console.log(`${areasToSave.length}개 구역 저장 예정 (API 호출)`);
      return areasToSave;
    },

    clearTempAreas: () => {
      setSavedAreas(prev => prev.filter(area => !area.areaId.startsWith('temp_')));
    },

    // ✅ 외부에서 구역만 다시 그리기 (CAD 모델 건드리지 않음)
    redrawAreasOnly: () => {
      renderAreasOnly();
    },

    // ✅ 외부에서 전체 다시 그리기 (CAD + 구역)
    redrawAreas: () => {
      renderSavedAreas();
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

  // ✅ 활성 구역 수만 표시 (삭제된 구역 제외)
  const activeAreaCount = savedAreas.filter(area => area.drawingStatus !== 'D').length;

  return (
    <>
      {activeAreaCount > 0 && (
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
          활성 구역: {activeAreaCount}개
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