import React, { useRef, useEffect } from 'react';
import './DomainTemplete.css';

const DomainForm = ({ formData, onInputChange, onSave, onAdd, onRemove, selectedDomain, onFileChange, uploadedFiles, showDeleteButton, formTitle }) => {
  const previousAreaValue = useRef(formData.area);

  // formData.area가 변경될 때마다 previousAreaValue 업데이트
  useEffect(() => {
    console.log('📌 formData.area 변경됨:', formData.area);
    previousAreaValue.current = formData.area;
  }, [formData.area]);

  const handleButtonClick = () => {
    document.getElementById('file-input').click();
  };

  // 면적 입력 처리
  const handleAreaChange = (e) => {
    const newValue = e.target.value;
    
    console.log('=== handleAreaChange 호출 ===');
    console.log('입력된 값:', newValue);
    console.log('이전 값:', previousAreaValue.current);
    console.log('정규식 테스트 결과:', /^\d*\.?\d*$/.test(newValue));
    
    // 빈 문자열이거나 숫자+소수점만 포함된 경우
    if (newValue === '' || /^\d*\.?\d*$/.test(newValue)) {
      console.log('✅ 유효한 입력 - 저장');
      previousAreaValue.current = newValue; // 유효한 값 저장
      onInputChange(e); // 부모로 전달
    } else {
      console.log('❌ 잘못된 입력 - 복원');
      console.log('복원할 값:', previousAreaValue.current);
      // 잘못된 입력이면 이전 값으로 복원
      e.target.value = previousAreaValue.current;
      
      // 강제로 이벤트 발생시켜서 React state도 업데이트
      const syntheticEvent = {
        target: {
          name: 'area',
          value: previousAreaValue.current
        }
      };
      onInputChange(syntheticEvent);
    }
    console.log('=========================\n');
  };

  return (
    <div className="domain-form-section">
      <div className="domain-form-header">
        <h2 className="domain-form-title">{formTitle || '도면 정보'}</h2>
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
              onChange={handleAreaChange}
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

            <div className="file-upload-section" style={{ position: 'relative', display: 'inline-block' }}>
              {/* 실제 input (완전히 숨김) */}
              <input 
                id="file-input"
                type="file" 
                onChange={onFileChange} 
                accept=".dwf,.dxf"
                style={{ display: 'none' }}
              />
              
              {/* 보이는 커스텀 버튼 */}
              <button 
                type="button" 
                onClick={handleButtonClick}
                style={{
                  padding: '4px 8px',
                  border: '1px solid #ccc',
                  background: '#f5f5f5',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                파일 선택
              </button>

              {/* 파일명 표시 */}
              {uploadedFiles?.length > 0 && 
                uploadedFiles.map((file, idx) => (
                  <span key={idx} style={{ marginLeft: '10px' }}>{file.name}</span>
                ))
              }
            </div>

            {/* 버튼 그룹 */}
            <div className="domain-form-buttons-inline">
              {/* + 버튼은 onAdd가 있을 때만 표시 */}
              {onAdd && (
                <button className="domain-action-btn" onClick={onAdd}>+</button>
              )}
              
              {/* 삭제 버튼은 수정 모드일 때만 표시 */}
              {showDeleteButton && onRemove && (
                <button 
                  className="domain-action-btn" 
                  onClick={onRemove}
                  style={{ width: 'auto', padding: '12px 20px' }}
                >
                  삭제
                </button>
              )}
              
              <button className="domain-save-btn" onClick={onSave}>저장</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DomainForm;