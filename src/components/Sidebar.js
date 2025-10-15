import React, { useState, useEffect } from 'react';

const Sidebar = ({ 
  selectedArea, 
  handleAreaSelect, 
  modelId, 
  refreshTrigger
}) => {
  const [areas, setAreas] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3; // 3개씩 표시
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = 'http://localhost:8080';

  // 구역 목록 로드
  const loadAreaList = async () => {
    if (!modelId) {
      console.log('ModelId가 없어서 구역 목록을 로드하지 않습니다.');
      setAreas([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 전체 구역을 한 번에 가져오기 (페이징은 프론트에서 처리)
      const response = await fetch(
        `${API_BASE_URL}/api/cad/area/names/${modelId}?page=1&size=1000`
      );

      const result = await response.json();

      if (result.success) {
        const data = result.data;
        setAreas(data.areas || []);
        setCurrentPage(1); // 첫 페이지로 리셋

        console.log(`구역 목록 로드 완료: ${data.areas?.length || 0}개`);
      } else {
        setError(result.message || '구역 목록을 불러올 수 없습니다.');
        setAreas([]);
      }
    } catch (err) {
      console.error('구역 목록 로드 실패:', err);
      setError('서버 연결에 실패했습니다.');
      setAreas([]);
    } finally {
      setLoading(false);
    }
  };

  // modelId 변경 시 구역 목록 다시 로드
  useEffect(() => {
    loadAreaList();
  }, [modelId]);

  // refreshTrigger 변경 시 구역 목록 새로고침
  useEffect(() => {
    if (refreshTrigger && modelId) {
      console.log('구역 변경 감지 - 목록 새로고침');
      loadAreaList();
    }
  }, [refreshTrigger]);

  // 페이징 계산
  const totalPages = Math.ceil(areas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAreas = areas.slice(startIndex, endIndex);

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

// 구역 클릭 처리
const handleAreaClick = (area) => {
  console.log('🖱️ Sidebar - 구역 클릭 (ID):', area.areaId);
  handleAreaSelect(area.areaId);  // ✅ 수정: area.areaId 전달
};
  return (
    <aside className="sidebar">
      {/* 구역 리스트 패널 */}
      <div className="area-list-panel">
        <div className="panel-header">구역 리스트</div>

        <div className="area-list">
          {loading && (
            <div className="loading-message">구역 목록을 불러오는 중...</div>
          )}

          {error && (
            <div className="error-message">{error}</div>
          )}

          {!loading && !error && currentAreas.length === 0 && (
            <div className="empty-message">구역이 없습니다.</div>
          )}

          {!loading && !error && currentAreas.length > 0 && (
            <>
              {currentAreas.map(area => (
                <div
                  key={area.areaId}
                  className={`area-item ${selectedArea === area.areaNm ? 'selected' : ''}`}
                  onClick={() => handleAreaClick(area)}
                >
                  • {area.areaNm}
                </div>
              ))}
            </>
          )}
        </div>

        {/* 페이징 버튼 - 도면리스트와 동일한 스타일 */}
        {totalPages >= 1 && (
          <div style={{ 
            padding: '15px 10px', 
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
    </aside>
  );
};

export default Sidebar;