import React, { useState, useEffect } from 'react';

const Sidebar = ({ 
  selectedArea, 
  handleAreaSelect, 
  modelId, 
  refreshTrigger,
  currentAreas = [] // ✅ 추가: 실시간 구역 목록
}) => {
  const [serverAreas, setServerAreas] = useState([]); // 서버에서 가져온 구역
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasCurrentAreasUpdated, setHasCurrentAreasUpdated] = useState(false); // ✅ 추가

  const API_BASE_URL = 'http://localhost:8080';

  // 서버에서 구역 목록 로드
  const loadAreaList = async () => {
    if (!modelId) {
      console.log('ModelId가 없어서 구역 목록을 로드하지 않습니다.');
      setServerAreas([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cad/area/names/${modelId}?page=1&size=1000`
      );

      const result = await response.json();

      if (result.success) {
        const data = result.data;
        setServerAreas(data.areas || []);
        setCurrentPage(1);
        console.log(`서버 구역 목록 로드 완료: ${data.areas?.length || 0}개`);
      } else {
        setError(result.message || '구역 목록을 불러올 수 없습니다.');
        setServerAreas([]);
      }
    } catch (err) {
      console.error('구역 목록 로드 실패:', err);
      setError('서버 연결에 실패했습니다.');
      setServerAreas([]);
    } finally {
      setLoading(false);
    }
  };

  // modelId 변경 시 구역 목록 다시 로드
  useEffect(() => {
    setHasCurrentAreasUpdated(false); // ✅ 새 모델 로드 시 플래그 리셋
    loadAreaList();
  }, [modelId]);

  // refreshTrigger 변경 시 구역 목록 새로고침
  useEffect(() => {
    if (refreshTrigger && modelId) {
      console.log('구역 변경 감지 - 목록 새로고침');
      loadAreaList();
    }
  }, [refreshTrigger]);

  // ✅ currentAreas 변경 감지 로그
  useEffect(() => {
    console.log('🔄 [Sidebar] currentAreas 변경됨:', currentAreas.length);
    console.log('   currentAreas 데이터:', currentAreas);
    
    // currentAreas가 한 번이라도 업데이트되었다면 플래그 설정
    if (currentAreas.length >= 0) {
      setHasCurrentAreasUpdated(true);
    }
  }, [currentAreas]);

  // ✅ 서버 데이터와 현재 편집 중인 데이터를 병합
  const getMergedAreas = () => {
    console.log('🔍 [Sidebar] getMergedAreas 호출');
    console.log('   - serverAreas 개수:', serverAreas.length);
    console.log('   - currentAreas 개수:', currentAreas.length);
    console.log('   - hasCurrentAreasUpdated:', hasCurrentAreasUpdated);
    
    // ✅ currentAreas가 한 번이라도 업데이트되었으면 currentAreas 사용 (빈 배열이어도!)
    // 아니면 serverAreas 사용 (초기 로드 상태)
    const baseAreas = hasCurrentAreasUpdated ? currentAreas : serverAreas;
    
    const result = baseAreas.map(area => ({
      areaId: area.areaId,
      areaNm: area.areaName || area.areaNm || '이름없음'
    }));

    console.log('   → 최종 표시 구역 개수:', result.length);
    console.log('   → 표시할 데이터:', result);
    return result;
  };

  // ✅ 병합된 구역 목록 사용
  const areas = getMergedAreas();
  
  console.log('📊 [Sidebar] 최종 표시할 구역 수:', areas.length);

  // 페이징 계산
  const totalPages = Math.ceil(areas.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentAreas_display = areas.slice(startIndex, endIndex);

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
    handleAreaSelect(area.areaId);
  };

  return (
    <aside className="sidebar">
      <div className="area-list-panel">
        <div className="panel-header">구역 리스트</div>

        <div className="area-list">
          {loading && (
            <div className="loading-message">구역 목록을 불러오는 중...</div>
          )}

          {error && (
            <div className="error-message">{error}</div>
          )}

          {!loading && !error && currentAreas_display.length === 0 && (
            <div className="empty-message">구역이 없습니다.</div>
          )}

          {!loading && !error && currentAreas_display.length > 0 && (
            <>
              {currentAreas_display.map(area => (
                <div
                  key={area.areaId}
                  className={`area-item ${selectedArea === area.areaId ? 'selected' : ''}`}
                  onClick={() => handleAreaClick(area)}
                >
                  • {area.areaNm}
                </div>
              ))}
            </>
          )}
        </div>

        {/* 페이징 버튼 */}
        {totalPages >= 1 && (
          <div style={{ 
            padding: '15px 10px', 
            display: 'flex', 
            justifyContent: 'center',
            gap: '5px',
            borderTop: '1px solid #e0e0e0',
            backgroundColor: '#f8f9fa'
          }}>
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