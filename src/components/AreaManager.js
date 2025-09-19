import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";

/**
 * AreaManager 컴포넌트 - 다중 팝업 지원 버전
 * 여러 구역의 속성을 동시에 편집하고 일괄 저장 가능
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
  
  // 다중 팝업을 위한 상태 변경
  const [openPopups, setOpenPopups] = useState([]); // 열린 팝업들의 areaId 배열
  const [editingAreas, setEditingAreas] = useState({}); // 편집 중인 구역 데이터들

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

  // 선택된 팝업을 위로 올리기 위한 상태
  const [frontPopup, setFrontPopup] = useState(null);
  
  // 팝업 열기/닫기 함수들
  const openPopup = (areaId) => {
    const area = savedAreas.find(a => a.areaId === areaId);
    if (!area) return;

    // 이미 열린 팝업이면 무시
    if (openPopups.includes(areaId)) return;

    // 팝업 목록에 추가
    setOpenPopups(prev => [...prev, areaId]);
    
    // 편집 데이터 초기화
    setEditingAreas(prev => ({
      ...prev,
      [areaId]: {
        areaName: area.areaName,
        areaDesc: area.areaDesc,
        areaColor: area.areaColor
      }
    }));
  };

  const closePopup = (areaId) => {
    setOpenPopups(prev => prev.filter(id => id !== areaId));
    setEditingAreas(prev => {
      const newState = { ...prev };
      delete newState[areaId];
      return newState;
    });
    // 닫은 팝업이 앞에 있었다면 frontPopup 초기화
    if (frontPopup === areaId) {
      setFrontPopup(null);
    }
  };

  // 팝업을 앞으로 가져오기
  const bringToFront = (areaId) => {
    setFrontPopup(areaId);
  };

  const closeAllPopups = () => {
    setOpenPopups([]);
    setEditingAreas({});
    setFrontPopup(null);
  };

  const updateEditingArea = (areaId, field, value) => {
    setEditingAreas(prev => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        [field]: value
      }
    }));
  };

  // 개별 저장
  const saveArea = (areaId) => {
    const editData = editingAreas[areaId];
    if (!editData) return;

    setSavedAreas(prev => 
      prev.map(area => 
        area.areaId === areaId 
          ? { ...area, ...editData }
          : area
      )
    );
    closePopup(areaId);
  };

  // 일괄 저장
  const saveAllAreas = () => {
    setSavedAreas(prev => 
      prev.map(area => {
        const editData = editingAreas[area.areaId];
        return editData ? { ...area, ...editData } : area;
      })
    );
    closeAllPopups();
  };

  // 삭제 함수
  const deleteAreaById = async (areaId) => {
    const areaToDelete = savedAreas.find(area => area.areaId === areaId);
    if (!areaToDelete) {
      console.log(`삭제할 구역을 찾을 수 없음: ${areaId}`);
      return false;
    }

    console.log(`구역 삭제 시작: ${areaId}`, areaToDelete);

    if (areaToDelete.areaId && !areaToDelete.areaId.startsWith('temp_')) {
      try {
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
          console.log(`DB에서 구역 삭제 성공: ${areaId}`);
          setSavedAreas(prev => {
            const newAreas = prev.filter(area => area.areaId !== areaId);
            const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
            if (onAreasChange) onAreasChange(activeAreas);
            return newAreas;
          });
        } else {
          console.error(`DB 삭제 실패:`, result.message);
          setSavedAreas(prev => {
            const newAreas = prev.map(area => 
              area.areaId === areaId 
                ? { ...area, drawingStatus: 'D' } 
                : area
            );
            const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
            if (onAreasChange) onAreasChange(activeAreas);
            return newAreas;
          });
        }
      } catch (error) {
        console.error(`DB 삭제 중 오류:`, error);
        setSavedAreas(prev => {
          const newAreas = prev.map(area => 
            area.areaId === areaId 
              ? { ...area, drawingStatus: 'D' } 
              : area
          );
          const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
          if (onAreasChange) onAreasChange(activeAreas);
          return newAreas;
        });
      }
    } else if (areaToDelete.areaId.startsWith('temp_')) {
      console.log(`임시 구역 로컬 삭제: ${areaId}`);
      setSavedAreas(prev => {
        const newAreas = prev.filter(area => area.areaId !== areaId);
        const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
        if (onAreasChange) onAreasChange(activeAreas);
        return newAreas;
      });
    }

    // 삭제된 구역의 팝업도 닫기
    closePopup(areaId);
    return true;
  };

  // 클릭 이벤트 수정 - 지우개 모드 제외하고 팝업 열기 허용
  const handleCanvasClick = async (event) => {
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
        // 지우개 모드일 때만 삭제
        console.log(`구역 삭제 요청: ${clickedArea.areaId}`);
        const confirmed = window.confirm(`"${clickedArea.areaName}"을(를) 삭제하시겠습니까?`);
        if (confirmed) {
          await deleteAreaById(clickedArea.areaId);
        }
      } else {
        // 펜모드, 일반모드에서 팝업 열기 (지우개 모드 제외)
        openPopup(clickedArea.areaId);
      }
    }
  };

  // 지우개 모드 활성화 시 모든 팝업 닫기
  useEffect(() => {
    if (isDeleteMode) {
      closeAllPopups();
      console.log('지우개 모드 활성화 - 모든 팝업 닫기');
    }
  }, [isDeleteMode]);

  // 렌더링 함수들
  const renderAreasOnly = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const activeAreas = savedAreas.filter(area => area.drawingStatus !== 'D');

    activeAreas.forEach((area) => {
      if (!area.coordinates || area.coordinates.length < 3) return;

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

      // 팝업이 열린 구역 강조 표시
      if (openPopups.includes(area.areaId)) {
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  };

  const renderSavedAreas = () => {
    if (onRequestCADRedraw) {
      onRequestCADRedraw();
    }
    requestAnimationFrame(() => {
      renderAreasOnly();
    });
  };

  useImperativeHandle(ref, () => ({
    addSavedArea: (areaData) => {
      const newArea = {
        areaId: areaData.areaId,
        coordinates: areaData.coordinates,
        areaName: areaData.areaName || '',
        areaDesc: areaData.areaDesc || '',
        areaColor: areaData.areaColor || '#CCCCCC',
        drawingStatus: 'U'
      };
      setSavedAreas(prev => [...prev, newArea]);
      console.log('저장된 구역 추가:', newArea.areaId);
    },

    addArea: (coordinates) => {
      if (!coordinates || coordinates.length < 3) {
        alert('구역을 그리려면 최소 3개의 점이 필요합니다.');
        return;
      }

      // 현재 전체 구역 수 기준으로 번호 부여
      const tempAreaCount = savedAreas.filter(area => 
        area.drawingStatus !== 'D' // 삭제되지 않은 구역만 카운트
      ).length;

      const newArea = {
        areaId: `temp_${Date.now()}`,
        coordinates: coordinates,
        areaName: `구역_${tempAreaCount + 1}`,
        areaDesc: '',
        areaColor: '#CCCCCC',
        drawingStatus: 'I'
      };

      setSavedAreas(prev => [...prev, newArea]);
      console.log('임시 구역 추가:', newArea.areaId);
    },

    deleteArea: (areaId) => {
      return deleteAreaById(areaId);
    },

    refreshAreas: () => {
      console.log('새로고침 요청 무시 (로컬 모드)');
    },

    getSavedAreas: () => savedAreas.filter(area => area.drawingStatus !== 'D'),

    getAreasToSave: () => {
      return savedAreas.filter(area => 
        area.drawingStatus === 'I' && 
        area.areaId.startsWith('temp_')
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

    // 현재 편집 중인 팝업 데이터만 저장용으로 반환
    getEditingAreasForSave: () => {
      const editingData = [];
      
      // 현재 열린 팝업들 중 편집된 데이터가 있는 것만 처리
      openPopups.forEach(areaId => {
        const area = savedAreas.find(a => a.areaId === areaId);
        const editData = editingAreas[areaId];
        
        if (area && editData) {
          editingData.push({
            ...area,
            ...editData // 편집된 데이터로 덮어쓰기
          });
        }
      });
      
      return editingData;
    },

    // 편집된 데이터를 실제 savedAreas에 적용
    applyEditingChanges: () => {
      setSavedAreas(prev => 
        prev.map(area => {
          const editData = editingAreas[area.areaId];
          return editData ? { ...area, ...editData } : area;
        })
      );
    },

    clearTempAreas: () => {
      setSavedAreas(prev => prev.filter(area => !area.areaId.startsWith('temp_')));
    },

    redrawAreasOnly: () => {
      renderAreasOnly();
    },

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
  }, [savedAreas, openPopups, scale, offset]);

  // 다중 PropertyForm 컴포넌트
  const PropertyForm = ({ areaId }) => {
    const area = savedAreas.find(a => a.areaId === areaId);
    const editData = editingAreas[areaId] || {};
    
    // 드래그 상태 관리
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [position, setPosition] = useState({
      x: 20 + ((openPopups.indexOf(areaId) % 2) * 350),
      y: 350 + (Math.floor(openPopups.indexOf(areaId) / 2) * 200)
    });

    if (!area) return null;

    const handleMouseDown = (e) => {
      if (e.target.closest('.drag-handle')) {
        e.preventDefault(); // 기본 동작 방지
        e.stopPropagation(); // 이벤트 전파 방지
        
        setIsDragging(true);
        setDragOffset({
          x: e.clientX - position.x,
          y: e.clientY - position.y
        });
        bringToFront(areaId);
        
        // 드래그 이벤트 핸들러 등록
        const handleMouseMove = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setPosition({
            x: e.clientX - dragOffset.x,
            y: e.clientY - dragOffset.y
          });
        };

        const handleMouseUp = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    };

    return (
      <div 
        onClick={(e) => {
          e.stopPropagation();
          bringToFront(areaId);
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          handleMouseDown(e);
        }}
        onMouseMove={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        style={{
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: frontPopup === areaId ? 2000 : (1000 + openPopups.indexOf(areaId)),
        minWidth: '300px',
        border: '2px solid #1976D2',
        cursor: isDragging ? 'grabbing' : 'default'
      }}>
        <div 
          className="drag-handle"
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px',
            borderBottom: '1px solid #eee',
            paddingBottom: '10px',
            cursor: 'grab'
          }}
        >
          <h3 style={{ margin: 0 }}>구역 속성 편집 - {editData.areaName || area.areaName || '이름없음'}</h3>
          <button 
            onClick={() => closePopup(areaId)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '18px',
              cursor: 'pointer',
              padding: '0',
              width: '24px',
              height: '24px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>구역명:</label>
          <input 
            type="text" 
            value={editData.areaName || ''}
            onChange={(e) => updateEditingArea(areaId, 'areaName', e.target.value)}
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label>설명:</label>
          <textarea 
            value={editData.areaDesc || ''}
            onChange={(e) => updateEditingArea(areaId, 'areaDesc', e.target.value)}
            rows={3}
            style={{ width: '100%', padding: '5px', marginTop: '5px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>색상:</label>
          <input 
            type="color" 
            value={editData.areaColor || '#CCCCCC'}
            onChange={(e) => updateEditingArea(areaId, 'areaColor', e.target.value)}
            style={{ marginTop: '5px', marginLeft: '10px' }}
          />
        </div>
      </div>
    );
  };

  const activeAreaCount = savedAreas.filter(area => area.drawingStatus !== 'D').length;

  return (
    <>
      {/* 다중 팝업 렌더링 */}
      {openPopups.map(areaId => (
        <PropertyForm key={areaId} areaId={areaId} />
      ))}

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
          구역 삭제 모드 - 삭제할 구역을 클릭하세요
        </div>
      )}
    </>
  );
});

export default AreaManager;