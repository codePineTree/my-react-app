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
  canvasRef,        // Canvas DOM 요소 참조
  modelId,          // 현재 CAD 모델 ID
  scale,            // 현재 줌 배율
  offset,           // 현재 팬 오프셋
  onAreasChange,    // 구역 변경 시 호출할 콜백 (부모에게 알림)
  isDeleteMode,     // 지우개 모드 활성화 여부
  isPenMode         // 펜 모드 활성화 여부 (새로 추가)
}, ref) => {

  // ==================== 상태 관리 ====================
  // 저장된 모든 구역들 정보 (로컬에서만 관리)
  const [savedAreas, setSavedAreas] = useState([]);
  
  // 현재 선택된 구역 (속성 편집용)
  const [selectedArea, setSelectedArea] = useState(null);
  
  // 속성 입력 폼 표시 여부
  const [showPropertyForm, setShowPropertyForm] = useState(false);

  // ==================== 좌표 변환 함수 ====================
  /**
   * DXF 월드 좌표를 Canvas 화면 좌표로 변환
   * @param {object} worldCoord - {x, y} DXF 월드 좌표
   * @returns {object} {x, y} Canvas 픽셀 좌표
   */
  const worldToCanvasCoord = (worldCoord) => {
    return {
      x: worldCoord.x * scale + offset.x,
      y: -worldCoord.y * scale + offset.y // DXF Y축 반전
    };
  };

  // ==================== 구역 조작 함수들 ====================
  /**
   * 점이 폴리곤 내부에 있는지 판단 (Ray Casting 알고리즘)
   * @param {object} point - {x, y} 검사할 점
   * @param {array} polygon - [{x, y}, ...] 폴리곤 좌표 배열
   * @returns {boolean} 점이 폴리곤 내부에 있으면 true
   */
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

  /**
   * 클릭한 지점에서 해당하는 구역 찾기
   * @param {object} worldCoord - {x, y} DXF 월드 좌표
   * @returns {object|null} 찾은 구역 객체 또는 null
   */
  const findAreaByPoint = (worldCoord) => {
    // 역순으로 검사 (나중에 그린 구역이 우선)
    for (let i = savedAreas.length - 1; i >= 0; i--) {
      const area = savedAreas[i];
      if (area.coordinates && isPointInPolygon(worldCoord, area.coordinates)) {
        return area;
      }
    }
    return null;
  };

  /**
   * Canvas 클릭 이벤트 처리
   * 지우개 모드일 때는 구역 삭제, 일반 모드일 때는 구역 선택
   * 펜 모드일 때는 무시
   */
  const handleCanvasClick = (event) => {
    // 펜 모드일 때는 구역 클릭 이벤트 무시
    if (isPenMode) {
      console.log('펜 모드 활성화 중 - 구역 클릭 무시');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas 상의 클릭 좌표 계산
    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    
    // DXF 월드 좌표로 변환
    const worldCoord = {
      x: (canvasX - offset.x) / scale,
      y: -((canvasY - offset.y) / scale)
    };

    // 클릭한 지점의 구역 찾기
    const clickedArea = findAreaByPoint(worldCoord);
    
    if (clickedArea) {
      if (isDeleteMode) {
        // 지우개 모드: 로컬 상태에서만 구역 삭제
        console.log('구역 로컬에서 삭제:', clickedArea);
        setSavedAreas(prev => prev.filter(area => area.areaId !== clickedArea.areaId));
      } else {
        // 일반 모드: 구역 선택 및 속성 편집
        console.log('구역 선택:', clickedArea);
        setSelectedArea(clickedArea);
        setShowPropertyForm(true);
      }
    } else {
      // 빈 공간 클릭: 선택 해제
      setSelectedArea(null);
      setShowPropertyForm(false);
    }
  };

  // ==================== 렌더링 함수들 ====================
  /**
   * 저장된 모든 구역들을 Canvas에 렌더링
   */
  const renderSavedAreas = () => {
    const canvas = canvasRef.current;
    if (!canvas || savedAreas.length === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.save();

    savedAreas.forEach(area => {
      if (!area.coordinates || area.coordinates.length < 3) return;

      // 구역 채우기
      ctx.fillStyle = area.areaColor || '#CCCCCC';
      ctx.globalAlpha = 0.3; // 반투명
      ctx.beginPath();
      
      area.coordinates.forEach((point, index) => {
        const canvasCoord = worldToCanvasCoord(point);
        if (index === 0) {
          ctx.moveTo(canvasCoord.x, canvasCoord.y);
        } else {
          ctx.lineTo(canvasCoord.x, canvasCoord.y);
        }
      });
      
      ctx.closePath();
      ctx.fill();

      // 구역 테두리
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
    });

    ctx.restore();
  };

  // ==================== 부모 컴포넌트에서 호출할 수 있는 함수들 ====================
  useImperativeHandle(ref, () => ({
    /**
     * AreaDrawing에서 구역 그리기 완료 시 호출되는 함수
     * @param {array} coordinates - [{x, y}, ...] 구역 좌표 배열
     */
    addArea: (coordinates) => {
      console.log('새 구역 추가 요청:', coordinates);
      
      if (!coordinates || coordinates.length < 3) {
        alert('구역을 그리려면 최소 3개의 점이 필요합니다.');
        return;
      }

      // 로컬 상태에만 추가
      const newArea = {
        areaId: `temp_${Date.now()}`, // 임시 ID
        coordinates: coordinates,
        areaName: `구역_${savedAreas.length + 1}`,
        areaDesc: '',
        areaColor: '#CCCCCC',
        isNew: true // 새로 생성된 구역 표시
      };

      setSavedAreas(prev => [...prev, newArea]);
      console.log('새 구역 로컬 상태에 추가 완료');
    },

    /**
     * 모든 구역 새로고침 (로컬 모드에서는 무시)
     */
    refreshAreas: () => {
      console.log('새로고침 요청 무시 (로컬 모드)');
    },

    /**
     * 현재 저장된 구역들 반환
     */
    getSavedAreas: () => {
      return savedAreas;
    },

    /**
     * 나중에 저장 버튼 클릭 시 사용할 함수 (현재는 로그만)
     */
    saveAllAreasToDb: () => {
      const newAreas = savedAreas.filter(area => area.isNew);
      console.log(`${newAreas.length}개 구역 저장 예정 (API는 나중에 구현)`);
      
      // isNew 플래그만 제거
      setSavedAreas(prev => 
        prev.map(area => ({ ...area, isNew: false }))
      );
      
      return true;
    },

    /**
     * 임시 구역들 삭제 (저장하지 않고 취소)
     */
    clearTempAreas: () => {
      setSavedAreas(prev => prev.filter(area => !area.isNew));
    }
  }));

  // ==================== 이벤트 리스너 및 초기화 ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Canvas 클릭 이벤트 리스너 등록
    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [savedAreas, isDeleteMode, isPenMode, scale, offset]); // isPenMode 의존성 추가

  // 줌/팬 변경 시 구역 다시 렌더링
  useEffect(() => {
    renderSavedAreas();
  }, [savedAreas, selectedArea, scale, offset]);

  // ==================== 속성 편집 폼 컴포넌트 ====================
  const PropertyForm = () => {
    const [areaName, setAreaName] = useState(selectedArea?.areaName || '');
    const [description, setDescription] = useState(selectedArea?.areaDesc || '');
    const [color, setColor] = useState(selectedArea?.areaColor || '#CCCCCC');

    const handleSave = () => {
      if (!selectedArea) return;

      const updatedArea = {
        ...selectedArea,
        areaName: areaName,
        areaDesc: description,
        areaColor: color
      };

      // 로컬 상태만 업데이트
      setSavedAreas(prev => 
        prev.map(area => 
          area.areaId === selectedArea.areaId ? updatedArea : area
        )
      );
      
      setShowPropertyForm(false);
      setSelectedArea(null);
      console.log('구역 정보 로컬 업데이트 완료');
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
          <button onClick={handleCancel} style={{ padding: '8px 16px' }}>
            취소
          </button>
          <button 
            onClick={handleSave} 
            style={{ 
              padding: '8px 16px', 
              backgroundColor: '#1976D2', 
              color: 'white',
              border: 'none',
              borderRadius: '4px'
            }}
          >
            저장
          </button>
        </div>
      </div>
    );
  };

  // ==================== 컴포넌트 렌더링 ====================
  return (
    <>
      {/* 구역 개수 표시 */}
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

      {/* 삭제 모드 안내 */}
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

      {/* 구역 속성 편집 폼 */}
      {showPropertyForm && selectedArea && <PropertyForm />}
    </>
  );
});

export default AreaManager;