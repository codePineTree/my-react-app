// DomainList.js
import React from 'react';
import './DomainTemplete.css';

const DomainList = ({ domains, selectedDomain, onDomainSelect, onRowDoubleClick, onSearch }) => {
  return (
    <div className="domain-list-section">
      {/* 헤더: 제목 + 조회 버튼 */}
      <div className="domain-list-header">
        <h2 className="domain-list-title">도면 리스트</h2>
        <button 
          onClick={onSearch}
          className="domain-search-btn"
        >
          조회
        </button>
      </div>

      {/* 도메인 리스트 */}
      <div className="domain-list-content">
        {domains.length === 0 ? (
          <div className="domain-empty">
            도메인이 없습니다.
          </div>
        ) : (
          <div className="domain-items">
            {domains.map((domain) => (
              <div
                key={domain.MODEL_ID}
                onClick={() => {
                  console.log('5️⃣ DomainList: 클릭 - 도메인 선택', domain);
                  onDomainSelect(domain);
                }}
                onDoubleClick={() => {
                  console.log('6️⃣ DomainList: 더블클릭 - onRowDoubleClick 호출', domain);
                  onRowDoubleClick(domain);
                }}
                className={`domain-item ${selectedDomain?.MODEL_ID === domain.MODEL_ID ? 'selected' : ''}`}
              >
                {domain.MODEL_NM}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DomainList;
