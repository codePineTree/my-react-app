// Sidebar.js - 왼쪽 사이드바 컴포넌트
import React, { useState, useEffect } from 'react';

const Sidebar = ({ 
  selectedArea, 
  handleAreaSelect, 
  modelId, 
  refreshTrigger // 새로 추가: 구역 변경시 전달받을 트리거
}) => {
  const [areas, setAreas] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(5);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = 'http://localhost:8080';

  // 구역 목록 로드
  const loadAreaList = async (page = 1) => {
    if (!modelId) {
      console.log('ModelId가 없어서 구역 목록을 로드하지 않습니다.');
      setAreas([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/cad/area/names/${modelId}?page=${page}&size=${pageSize}`
      );

      const result = await response.json();

      if (result.success) {
        const data = result.data;
        setAreas(data.areas || []);
        setTotalPages(data.totalPages || 0);
        setCurrentPage(data.currentPage || 1);

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
    setCurrentPage(1);
    loadAreaList(1);
  }, [modelId]);

  // refreshTrigger 변경 시 구역 목록 새로고침
  useEffect(() => {
    if (refreshTrigger && modelId) {
      console.log('구역 변경 감지 - 목록 새로고침');
      loadAreaList(currentPage);
    }
  }, [refreshTrigger]);

  // 페이지 변경
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && !loading) {
      loadAreaList(newPage);
    }
  };

  // 구역 클릭 처리
  const handleAreaClick = (area) => {
    handleAreaSelect(area.areaNm); // area_nm으로 전달
  };

  // 로컬 구역 업데이트 메서드 (외부에서 호출 가능하도록)
  const updateLocalAreas = (updatedAreas) => {
    setAreas(updatedAreas);
  };

  // 로컬 구역 추가
  const addLocalArea = (newArea) => {
    setAreas(prev => [...prev, newArea]);
  };

  // 로컬 구역 삭제
  const removeLocalArea = (areaId) => {
    setAreas(prev => prev.filter(area => area.areaId !== areaId));
  };

  // 로컬 구역 수정
  const updateLocalArea = (areaId, updatedData) => {
    setAreas(prev => prev.map(area => 
      area.areaId === areaId ? { ...area, ...updatedData } : area
    ));
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

          {!loading && !error && areas.length === 0 && (
            <div className="empty-message">구역이 없습니다.</div>
          )}

          {!loading && !error && areas.length > 0 && (
            <>
              {areas.map(area => (
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

        {/* 페이징 버튼 */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1 || loading}
            >
              ‹ 이전
            </button>

            <span className="page-info">
              {currentPage} / {totalPages}
            </span>

            <button
              className="page-btn"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages || loading}
            >
              다음 ›
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;