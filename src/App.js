import React, { useState, useEffect } from 'react';
import './components/AreaTemplete.css';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import CADDisplay from './components/CADDisplay';
import DomainManagement from './components/DomainManagement';

const App = () => {
  const [activeTab, setActiveTab] = useState('도면관리');
  const [selectedArea, setSelectedArea] = useState(null);
  const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);

  // CAD 파일 상태
  const [cadFilePath, setCadFilePath] = useState('');
  const [cadFileType, setCadFileType] = useState(''); // dxf / dwf
  const [modelId, setModelId] = useState(null);

  // 도메인 더블클릭 - Aspose로 직접 파싱
  const handleDomainDoubleClick = (domainData) => {
    console.log('도메인 더블클릭:', domainData);

    if (!domainData.cadFilePath) {
      alert('CAD 파일 경로가 없습니다.');
      return;
    }

    // DXF든 DWF든 Aspose가 직접 처리
    setCadFileType(domainData.cadFilePath.toLowerCase().endsWith('.dwf') ? 'dwf' : 'dxf');
    setCadFilePath(domainData.cadFilePath);
    setModelId(domainData.MODEL_ID);
    setActiveTab('구역관리');
  };

  const handleAreaSelect = (area) => {
    setSelectedArea(area);
  };

  const triggerSidebarRefresh = () => {
    setSidebarRefreshTrigger(prev => prev + 1);
  };

  const handleSaveComplete = (result) => {
    console.log('저장 완료:', result);

    if (result.savedCount > 0) {
      triggerSidebarRefresh();
    }

    alert(result.error || result.message || '저장되었습니다.');
  };

  const renderContent = () => {
    switch (activeTab) {
      case '도면관리':
        return <DomainManagement onDomainDoubleClick={handleDomainDoubleClick} />;

      case '구역관리':
        return (
          <>
            <Sidebar
              selectedArea={selectedArea}
              handleAreaSelect={handleAreaSelect}
              modelId={modelId}
              refreshTrigger={sidebarRefreshTrigger}
            />
            <main className="main-area" style={{ flexDirection: 'column', gap: '20px' }}>
              <CADDisplay
                cadFilePath={cadFilePath}
                cadFileType={cadFileType}
                modelId={modelId}
                onSave={handleSaveComplete}
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

export default App;