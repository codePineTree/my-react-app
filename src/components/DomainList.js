import React, { useState } from 'react';
import './DomainTemplete.css';

const DomainList = ({ domains = [], selectedDomain, onDomainSelect, onRowDoubleClick, onSearch, onNewClick }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [clickTimer, setClickTimer] = useState(null);
  
  // 페이징 관련 state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15; // 고정 15개

  // 검색 실행
  const handleSearch = () => {
    setActiveSearchTerm(searchTerm);
    setCurrentPage(1); // 검색 시 첫 페이지로
  };

  // 엔터키 처리
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  // 활성화된 검색어로 필터링
  const filteredDomains = Array.isArray(domains) 
    ? domains.filter(domain =>
        domain.MODEL_NM?.toLowerCase().includes(activeSearchTerm.toLowerCase())
      )
    : [];

  // 페이징 계산
  const totalPages = Math.ceil(filteredDomains.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentDomains = filteredDomains.slice(startIndex, endIndex);

  // 페이지 변경
  const handlePageChange = (pageNum) => {
    setCurrentPage(pageNum);
  };

  // 이전 페이지
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // 다음 페이지
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  // 페이지 번호 배열 생성 (최대 5개씩 표시)
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);
    
    if (endPage - startPage < maxVisible - 1) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  };

  // 단일클릭과 더블클릭 구분
  const handleItemClick = (domain) => {
    if (clickTimer) {
      // 더블클릭
      clearTimeout(clickTimer);
      setClickTimer(null);
      console.log('6️⃣ DomainList: 더블클릭 - onRowDoubleClick 호출', domain);
      if (onRowDoubleClick) onRowDoubleClick(domain);
    } else {
      // 단일클릭 (300ms 대기)
      const timer = setTimeout(() => {
        console.log('5️⃣ DomainList: 단일클릭 - 팝업 열기', domain);
        if (onDomainSelect) onDomainSelect(domain);
        setClickTimer(null);
      }, 300);
      setClickTimer(timer);
    }
  };

  return (
    <div className="domain-list-section">
      {/* 헤더: 제목 + 버튼들 + 검색창 + 조회 버튼 */}
      <div className="domain-list-header">
        <h2 className="domain-list-title">도면 리스트</h2>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 신규 버튼 */}
          <button 
            className="domain-search-btn"
            onClick={onNewClick}
            style={{ marginRight: '17px' }}
          >
            New
          </button>

          {/* 검색창 */}
          <input
            type="text"
            placeholder="도면명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={handleKeyPress}
            className="domain-search-input"
          />

          {/* 조회 버튼 */}
          <button
            onClick={() => {
              handleSearch();
              if (onSearch) onSearch();
            }}
            className="domain-search-btn"
          >
            조회
          </button>
        </div>
      </div>

{/* 도메인 리스트 */}
<div className="domain-list-content">
  {currentDomains.length === 0 ? (
    <div className="domain-empty">
      {activeSearchTerm ? '검색 결과가 없습니다.' : '도면이 없습니다.'}
    </div>
  ) : (
    <div className="domain-items">
      {currentDomains.map((domain) => (
        <div
          key={domain.MODEL_ID}
          onClick={() => handleItemClick(domain)}
          className={`domain-item ${selectedDomain?.MODEL_ID === domain.MODEL_ID ? 'selected' : ''}`}
        >
          {domain.MODEL_NM}
        </div>
      ))}
    </div>
  )}
</div>

      {/* 페이징 버튼 - 항상 표시 */}
      {totalPages >= 1 && (
        <div style={{ 
          padding: '15px 20px', 
          display: 'flex', 
          justifyContent: 'center',
          gap: '5px',
          borderTop: '1px solid #e0e0e0',
          backgroundColor: '#f8f9fa'
        }}>
          {/* 이전 버튼 */}
          <button
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              backgroundColor: currentPage === 1 ? '#f0f0f0' : 'white',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontSize: '14px',
              color: currentPage === 1 ? '#999' : '#333'
            }}
          >
            ◀
          </button>

          {/* 페이지 번호들 */}
          {getPageNumbers().map(pageNum => (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              style={{
                padding: '6px 12px',
                border: '1px solid #ddd',
                backgroundColor: currentPage === pageNum ? '#1976D2' : 'white',
                color: currentPage === pageNum ? 'white' : '#333',
                cursor: 'pointer',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: currentPage === pageNum ? 'bold' : 'normal',
                minWidth: '35px'
              }}
            >
              {pageNum}
            </button>
          ))}

          {/* 다음 버튼 */}
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            style={{
              padding: '6px 12px',
              border: '1px solid #ddd',
              backgroundColor: currentPage === totalPages ? '#f0f0f0' : 'white',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              borderRadius: '4px',
              fontSize: '14px',
              color: currentPage === totalPages ? '#999' : '#333'
            }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
};

export default DomainList;