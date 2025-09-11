import React from 'react';
import './DomainTemplete.css';

const DomainForm = ({ formData, onInputChange, onSave, onAdd, onRemove, selectedDomain, onFileChange, uploadedFiles }) => {
  return (
    <div className="domain-form-section">
      {/* 헤더 */}
      <div className="domain-form-header">
        <h2 className="domain-form-title">도면 정보</h2>
      </div>

      <div className="domain-form-content">
        <div className="domain-form-grid-2col">
          {/* 1행: 도면명 + 건물명 */}
          <div className="domain-form-row">
            <label className="domain-form-label">도면명</label>
            <input
              type="text"
              name="domainName"
              value={formData.domainName}
              onChange={onInputChange}
              className="domain-form-input"
              placeholder="도면명을 입력하세요"
            />
          </div>
          <div className="domain-form-row">
            <label className="domain-form-label">건물명</label>
            <input
              type="text"
              name="buildingName"
              value={formData.buildingName}
              onChange={onInputChange}
              className="domain-form-input"
              placeholder="건물명을 입력하세요"
            />
          </div>

          {/* 2행: 면적 + 버전정보 */}
          <div className="domain-form-row">
            <label className="domain-form-label">면적</label>
            <input
              type="text"
              name="area"
              value={formData.area}
              onChange={onInputChange}
              className="domain-form-input"
              placeholder="면적을 입력하세요"
            />
          </div>
          <div className="domain-form-row">
            <label className="domain-form-label">버전정보</label>
            <input
              type="text"
              name="version"
              value={formData.version}
              onChange={onInputChange}
              className="domain-form-input"
              placeholder="버전정보를 입력하세요"
            />
          </div>

          {/* 3행: 도면 설명 (전체 폭) */}
          <div className="domain-form-row domain-form-full">
            <label className="domain-form-label">도면 설명</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={onInputChange}
              className="domain-form-textarea"
              placeholder="도면 설명을 입력하세요"
            />
          </div>

          {/* 4행: 도면 파일 + 버튼 */}
          <div className="domain-form-row domain-form-full domain-form-file-row">
            <label className="domain-form-label">도면 파일</label>
            <div className="file-upload-section">
              <input type="file" multiple onChange={onFileChange} />
              <div className="uploaded-files">
                {uploadedFiles && uploadedFiles.map((file, idx) => (
                  <div key={idx}>{file.name}</div>
                ))}
              </div>
            </div>

            {/* 버튼 그룹 */}
            <div className="domain-form-buttons-inline">
              <button className="domain-action-btn" onClick={onAdd}>+</button>
              <button className="domain-action-btn" onClick={onRemove} disabled={!selectedDomain}>-</button>
              <button className="domain-save-btn" onClick={onSave}>저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainForm;
