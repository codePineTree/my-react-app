import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './components/AreaTemplete.css';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import CADDisplay from './components/CADDisplay';
import DomainManagement from './components/DomainManagement';
import DomainFormPopup from './components/DomainFormPopup';

// 메인 앱 컴포넌트
const MainApp = () => {
  const [activeTab, setActiveTab] = useState('도면관리');
  const [selectedAreaId, setSelectedAreaId] = useState(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
  const [currentAreas, setCurrentAreas] = useState([]); // ✅ 추가: 현재 구역 목록

  // CAD 파일 상태
  const [cadFilePath, setCadFilePath] = useState('');
  const [cadFileType, setCadFileType] = useState('');
  const [modelId, setModelId] = useState(null);

  // ✅ modelId 변경 시 구역 목록 초기화
  useEffect(() => {
    console.log('🔄 modelId 변경됨:', modelId);
    setCurrentAreas([]);
    setSelectedAreaId(null);
  }, [modelId]);

  // 도메인 더블클릭
  const handleDomainDoubleClick = (domainData) => {
    console.log('도메인 더블클릭:', domainData);

    if (!domainData.cadFilePath) {
      alert('CAD 파일 경로가 없습니다.');
      return;
    }

    setCadFileType(domainData.cadFilePath.toLowerCase().endsWith('.dwf') ? 'dwf' : 'dxf');
    setCadFilePath(domainData.cadFilePath);
    setModelId(domainData.MODEL_ID);
    setSelectedAreaId(null); // 새 도면 로드 시 선택 영역 초기화
    setCurrentAreas([]); // ✅ 추가: 새 도면 로드 시 구역 목록 초기화
    setActiveTab('구역관리');
  };

  const handleAreaSelect = (areaId) => {
    console.log('🎯 App.js - 구역 선택됨 (ID):', areaId);
    setSelectedAreaId(areaId);
  };

  // ✅ 추가: 선택 해제 핸들러
  const handleClearSelection = () => {
    console.log('🔄 App.js - 구역 선택 해제');
    setSelectedAreaId(null);
  };

  // ✅ 추가: 구역 목록 업데이트 핸들러
  const handleAreasChange = (areas) => {
    console.log('📋 App.js - 구역 목록 업데이트:', areas.length);
    setCurrentAreas(areas);
  };

  const triggerSidebarRefresh = () => {
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  const handleSaveComplete = (result) => {
    console.log('저장 완료:', result);

    if (result.savedCount > 0) {
      triggerSidebarRefresh();
          setSelectedAreaId(null); // ✅ 
    }
    alert(result.error || result.message || '저장되었습니다.');
           setSelectedAreaId(null); // ✅ 
  };

  const renderContent = () => {
    switch (activeTab) {
      case '도면관리':
        return <DomainManagement onDomainDoubleClick={handleDomainDoubleClick} />;

      case '구역관리':
        return (
          <>
            <Sidebar
              selectedArea={selectedAreaId}
              handleAreaSelect={handleAreaSelect}
              modelId={modelId}
              refreshTrigger={sidebarRefreshTrigger}
              currentAreas={currentAreas} // ✅ 추가
            />
            <main className="main-area" style={{ flexDirection: 'column', gap: '20px' }}>
              <CADDisplay
                cadFilePath={cadFilePath}
                cadFileType={cadFileType}
                modelId={modelId}
                onSave={handleSaveComplete}
                selectedAreaId={selectedAreaId}
                onClearSelection={handleClearSelection}
                onSidebarRefresh={triggerSidebarRefresh}
                onAreasChange={handleAreasChange} // ✅ 이 prop이 CADDisplay에서 받아서 처리되어야 함
              />
              <div style={{ height: '100px' }}></div>
            </main>
          </>
        );

      default:
        return <div className="main-area">구현 중...</div>;
    }
  };

  return (
    <div className="app-container">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <div className="main-content">{renderContent()}</div>
    </div>
  );
};

// 라우터 설정
const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainApp />} />
        <Route path="/domain-form" element={<DomainFormPopup />} />
      </Routes>
    </Router>
  );
};

export default App;