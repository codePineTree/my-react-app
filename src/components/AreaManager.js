import React, { useState, useEffect, useImperativeHandle, forwardRef } from "react";
import AreaPropertyForm from "./AreaPropertyForm";

const AreaManager = forwardRef(({ 
  canvasRef,
  modelId,
  scale,
  offset,
  onAreasChange,
  isDeleteMode,
  isPenMode,
  onRequestCADRedraw,
  selectedAreaId
}, ref) => {

  const [savedAreas, setSavedAreas] = useState([]);
  const [openPopups, setOpenPopups] = useState([]);
  const [editingAreas, setEditingAreas] = useState({});
  const [frontPopup, setFrontPopup] = useState(null);

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

  const openPopup = (areaId) => {
    const area = savedAreas.find(a => a.areaId === areaId);
    if (!area) return;

    if (openPopups.includes(areaId)) return;

    setOpenPopups(prev => [...prev, areaId]);
    
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
    if (frontPopup === areaId) {
      setFrontPopup(null);
    }
  };

  const bringToFront = (areaId) => {
    setFrontPopup(areaId);
  };

  const closeAllPopups = () => {
    setOpenPopups([]);
    setEditingAreas({});
    setFrontPopup(null);
  };

  // ✅ AreaPropertyForm에서 호출될 업데이트 함수 (도면 리스트 방식!)
  const handlePropertyUpdate = (areaId, field, value) => {
    console.log(`🔼 [handlePropertyUpdate] areaId: ${areaId}, field: ${field}, value: "${value}"`);
    
    // editingAreas 업데이트
    setEditingAreas(prev => ({
      ...prev,
      [areaId]: {
        ...prev[areaId],
        [field]: value
      }
    }));

    // savedAreas 즉시 업데이트 + Sidebar 알림 (도면 리스트와 동일!)
    setSavedAreas(prev => {
      const updated = prev.map(area => 
        area.areaId === areaId 
          ? { 
              ...area, 
              areaName: field === 'areaName' ? value : area.areaName,
              areaDesc: field === 'areaDesc' ? value : area.areaDesc,
              areaColor: field === 'areaColor' ? value : area.areaColor
            }
          : area
      );
      
      const activeAreas = updated.filter(area => area.drawingStatus !== 'D');
      if (onAreasChange) {
        console.log('🔔 [Sidebar 실시간 업데이트] onChange 즉시 반영');
        onAreasChange(activeAreas);
      }
      
      return updated;
    });
  };

  const deleteAreaLocally = (areaId) => {
    const areaToDelete = savedAreas.find(area => area.areaId === areaId);
    if (!areaToDelete) {
      console.log(`삭제할 구역을 찾을 수 없음: ${areaId}`);
      return false;
    }

    console.log(`구역 로컬 삭제 표시: ${areaId}`, areaToDelete);

    if (areaToDelete.areaId && areaToDelete.areaId.startsWith('temp_')) {
      console.log(`임시 구역 즉시 삭제: ${areaId}`);
      setSavedAreas(prev => {
        const newAreas = prev.filter(area => area.areaId !== areaId);
        const activeAreas = newAreas.filter(area => area.drawingStatus !== 'D');
        if (onAreasChange) onAreasChange(activeAreas);
        return newAreas;
      });
    } else {
      console.log(`기존 구역 삭제 표시: ${areaId}`);
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

    closePopup(areaId);
    return true;
  };

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
        console.log(`구역 로컬 삭제 요청: ${clickedArea.areaId}`);
        const confirmed = window.confirm(`"${clickedArea.areaName}"을(를) 삭제하시겠습니까?`);
        if (confirmed) {
          deleteAreaLocally(clickedArea.areaId);
        }
      } else {
        openPopup(clickedArea.areaId);
      }
    }
  };

  useEffect(() => {
    if (isDeleteMode) {
      closeAllPopups();
      console.log('지우개 모드 활성화 - 모든 팝업 닫기');
    }
  }, [isDeleteMode]);

  const renderAreasOnly = () => {
    console.log('🎨 renderAreasOnly 호출됨');
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ canvas 없음');
      return;
    }

    const ctx = canvas.getContext('2d');
    const activeAreas = savedAreas.filter(area => area.drawingStatus !== 'D');
    console.log('📊 렌더링할 구역 수:', activeAreas.length);
    console.log('선택된 구역 ID:', selectedAreaId);

    activeAreas.forEach((area, index) => {
      if (!area.coordinates || area.coordinates.length < 3) {
        console.log(`⚠️ 구역 ${index} 좌표 부족:`, area.coordinates?.length);
        return;
      }

      console.log(`✏️ 구역 ${index} 그리기 시작:`, area.areaName, area.areaColor);
      
      ctx.save();

      const isSelected = selectedAreaId && area.areaId === selectedAreaId;
      
      if (isSelected) {
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 5;
        console.log('🔴 선택된 구역 (ID):', area.areaId, area.areaName);
      } else {
        ctx.fillStyle = area.areaColor || '#CCCCCC';
        ctx.strokeStyle = area.areaColor || '#999999';
        ctx.lineWidth = 2;
      }

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
      ctx.stroke();

      ctx.restore();
      console.log(`✅ 구역 ${index} 그리기 완료`);
    });
  };

  useEffect(() => {
    console.log('🔄 선택된 구역 변경 (ID):', selectedAreaId);
    if (onRequestCADRedraw) {
      onRequestCADRedraw();
      setTimeout(() => {
        renderAreasOnly();
      }, 10);
    } else {
      renderAreasOnly();
    }
  }, [selectedAreaId]);

  const renderSavedAreas = () => {
    console.log('🔄 renderSavedAreas 호출됨');
    if (onRequestCADRedraw) {
      console.log('📐 CAD 다시 그리기 요청');
      onRequestCADRedraw();
      setTimeout(() => {
        console.log('⏰ setTimeout 후 renderAreasOnly 호출');
        renderAreasOnly();
      }, 0);
    } else {
      console.log('📐 CAD 다시 그리기 없음 - 바로 구역 그리기');
      renderAreasOnly();
    }
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
      setSavedAreas(prev => {
        const updated = [...prev, newArea];
        console.log('저장된 구역 추가:', newArea.areaId);
        
        const activeAreas = updated.filter(area => area.drawingStatus !== 'D');
        if (onAreasChange) {
          console.log('🔔 [Sidebar 업데이트] 서버 구역 로드 반영');
          onAreasChange(activeAreas);
        }
        
        return updated;
      });
    },

    addArea: (coordinates) => {
      if (!coordinates || coordinates.length < 3) {
        alert('구역을 그리려면 최소 3개의 점이 필요합니다.');
        return;
      }

      const tempAreaCount = savedAreas.filter(area => 
        area.drawingStatus !== 'D'
      ).length;

      const newArea = {
        areaId: `temp_${Date.now()}`,
        coordinates: coordinates,
        areaName: `구역_${tempAreaCount + 1}`,
        areaDesc: '',
        areaColor: '#CCCCCC',
        drawingStatus: 'I'
      };

      setSavedAreas(prev => {
        const updated = [...prev, newArea];
        console.log('✅ 구역 추가됨:', newArea);
        console.log('📊 전체 구역 수:', updated.length);
        
        const activeAreas = updated.filter(area => area.drawingStatus !== 'D');
        if (onAreasChange) {
          console.log('🔔 [Sidebar 업데이트] 신규 구역 추가 반영');
          onAreasChange(activeAreas);
        }
        
        return updated;
      });
    },

    deleteArea: (areaId) => {
      return deleteAreaLocally(areaId);
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

    getDeletedAreasForSave: () => {
      return savedAreas.filter(area => 
        area.drawingStatus === 'D' && 
        !area.areaId.startsWith('temp_')
      );
    },

    getEditingAreasForSave: () => {
      const editingData = [];
      
      openPopups.forEach(areaId => {
        const area = savedAreas.find(a => a.areaId === areaId);
        const editData = editingAreas[areaId];
        
        if (area && editData) {
          editingData.push({
            ...area,
            ...editData
          });
        }
      });
      
      return editingData;
    },

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

    clearDeletedAreas: () => {
      setSavedAreas(prev => prev.filter(area => area.drawingStatus !== 'D'));
    },

    closeAllPopupsAfterSave: () => {
      console.log('저장 완료 후 모든 팝업 닫기');
      closeAllPopups();
    },

    clearSelection: () => {
      console.log('선택 해제 요청 - 부모에게 알림 필요');
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
    console.log('🔄 useEffect 트리거 - savedAreas 변경됨');
    
    if (isPenMode) {
      console.log('✅ 펜모드 - renderAreasOnly만 호출');
      renderAreasOnly();
    } else {
      console.log('✅ 일반모드 - renderSavedAreas 호출');
      renderSavedAreas();
    }
  }, [savedAreas, openPopups, scale, offset, isPenMode]);

  return (
    <>
      {openPopups.map((areaId, index) => {
        const area = savedAreas.find(a => a.areaId === areaId);
        const editData = editingAreas[areaId];
        
        return (
          <AreaPropertyForm
            key={areaId}
            areaId={areaId}
            area={area}
            editData={editData}
            onClose={closePopup}
            onUpdate={handlePropertyUpdate}
            bringToFront={bringToFront}
            isFront={frontPopup === areaId}
            zIndex={frontPopup === areaId ? 2000 : (1000 + index)}
          />
        );
      })}

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