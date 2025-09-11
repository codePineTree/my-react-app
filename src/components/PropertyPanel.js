// PropertyPanel.js - 구역 속성 입력/편집 패널 컴포넌트
import React from 'react';

const PropertyPanel = ({
  areaName,
  setAreaName,
  usage,
  setUsage,
  operation,
  setOperation,
  handleSave
}) => {
  return (
    <div className="property-panel">
      {/* 헤더는 패딩 없이 패널 경계에 딱 붙음 */}
      <div className="panel-header">구역 속성 입력 </div>

      {/* form-content div 추가 - CSS에서 패딩 적용 */}
      <div className="form-content">
        <div className="form-row">
          <label className="form-label">구역명</label>
          <input
            type="text"
            className="form-input"
            value={areaName}
            onChange={(e) => setAreaName(e.target.value)}
          />

          {/* 👉 면적 먼저 */}
          <label className="form-label">면적</label>
          <input
            type="text"
            className="form-input"
            value={operation}
            onChange={(e) => setOperation(e.target.value)}
          />
        </div>

        <div className="form-row">
          {/* 👉 용도를 아래쪽으로 이동 */}
          <label className="form-label">구역설명</label>
          <input
            type="text"
            className="form-input"
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
          />

          <button className="save-button" onClick={handleSave}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;
