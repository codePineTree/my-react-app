import React, { useState, useEffect } from 'react';

const AreaPropertyForm = ({ 
  areaId, 
  area,
  editData,
  onClose,
  onUpdate,
  bringToFront,
  isFront,
  zIndex 
}) => {
  const [localValues, setLocalValues] = useState({
    areaName: editData?.areaName || '',
    areaDesc: editData?.areaDesc || '',
    areaColor: editData?.areaColor || '#CCCCCC'
  });

  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({
    x: 20,
    y: 350
  });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // editData 변경 시 localValues 업데이트 (초기 로드 시)
  useEffect(() => {
    if (editData) {
      setLocalValues({
        areaName: editData.areaName || '',
        areaDesc: editData.areaDesc || '',
        areaColor: editData.areaColor || '#CCCCCC'
      });
    }
  }, [editData?.areaName, editData?.areaDesc, editData?.areaColor]);

  const handleInputChange = (field, value) => {
    console.log(`⌨️ [입력 이벤트] field: ${field}, value: "${value}"`);
    
    // ✅ 로컬 state 즉시 업데이트
    setLocalValues(prev => ({
      ...prev,
      [field]: value
    }));

    // ✅ onChange에서 바로 부모에게 알림 (도면 리스트 방식!)
    onUpdate(areaId, field, value);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      e.preventDefault();
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    const handleMouseUp = (e) => {
      e.preventDefault();
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart.x, dragStart.y]);

  if (!area) return null;

  const handleMouseDown = (e) => {
    if (e.target.closest('.drag-handle')) {
      e.preventDefault();
      e.stopPropagation();
      
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
      bringToFront(areaId);
    }
  };

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        bringToFront(areaId);
      }}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        top: `${position.y}px`,
        left: `${position.x}px`,
        background: 'white',
        padding: '20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: zIndex,
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
        <h3 style={{ margin: 0 }}>구역 속성 편집 - {localValues.areaName || '이름없음'}</h3>
        <button 
          onClick={() => onClose(areaId)}
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
          value={localValues.areaName}
          onChange={(e) => handleInputChange('areaName', e.target.value)}
          style={{ width: '100%', padding: '5px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '10px' }}>
        <label>설명:</label>
        <textarea 
          value={localValues.areaDesc}
          onChange={(e) => handleInputChange('areaDesc', e.target.value)}
          rows={3}
          style={{ width: '100%', padding: '5px', marginTop: '5px' }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>색상:</label>
        <input 
          type="color" 
          value={localValues.areaColor}
          onChange={(e) => handleInputChange('areaColor', e.target.value)}
          style={{ marginTop: '5px', marginLeft: '10px' }}
        />
      </div>
    </div>
  );
};

export default AreaPropertyForm;