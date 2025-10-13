import React, { useState } from 'react';
import './DomainTemplete.css';

const DomainList = ({ domains, selectedDomain, onDomainSelect, onRowDoubleClick, onSearch }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // 검색 실행
  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
  };

  // 엔터키 처리
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 활성화된 검색어로 필터링
  const filteredDomains = domains.filter(domain => 
    domain.MODEL_NM?.toLowerCase().includes(activeSearchTerm.toLowerCase())
  );

  return (
    <div className="domain-list-section">
      {/* 헤더: 제목 + 검색창 + 조회 버튼 */}
      <div className="domain-list-header">
        <h2 className="domain-list-title">도면 리스트</h2>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 검색창 */}
          <input 
            type="text"
            placeholder="도면명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              width: '500px',  // ⭐ 180px → 300px
              fontSize: '14px'
            }}
          />
          
          {/* 조회 버튼 */}
          <button
            onClick={() => {
              handleSearch();
              onSearch();
            }}
            className="domain-search-btn"
          >
            조회
          </button>
        </div>
      </div>

      {/* 도메인 리스트 (필터링된 결과 표시) */}
      <div className="domain-list-content">
        {filteredDomains.length === 0 ? (
          <div className="domain-empty">
            {activeSearchTerm ? '검색 결과가 없습니다.' : '도면이 없습니다.'}
          </div>
        ) : (
          <div className="domain-items">
            {filteredDomains.map((domain) => (
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