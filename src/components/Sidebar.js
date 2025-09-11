// Sidebar.js - 왼쪽 사이드바 컴포넌트
import React from 'react';

const Sidebar = ({ selectedArea, handleAreaSelect }) => {
  const areas = [
    '구역명 1',
    '구역명 2', 
    '구역명 3'
  ];

  return (
    <aside className="sidebar">
      {/* 구역 리스트 패널 */}
      <div className="area-list-panel">
        <div className="panel-header">구역 리스트</div>
        <div className="area-list">
          {areas.map(area => (
            <div
              key={area}
              className={`area-item ${selectedArea === area ? 'selected' : ''}`}
              onClick={() => handleAreaSelect(area)}
            >
              • {area}
            </div>
          ))}
        </div>
      </div>


    </aside>
  );
};

export default Sidebar;