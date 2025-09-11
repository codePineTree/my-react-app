// App.js
import React, { useState } from 'react';
import './components/AreaTemplete.css';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import CADDisplay from './components/CADDisplay';
import PropertyPanel from './components/PropertyPanel';
import DomainManagement from './components/DomainManagement';

const App = () => {
  const [activeTab, setActiveTab] = useState('도면관리');
  const [selectedArea, setSelectedArea] = useState('구역명 2');
  const [areaName, setAreaName] = useState('구역명 2');
  const [usage, setUsage] = useState('');
  const [operation, setOperation] = useState('자동/수동 업력');

  // CAD 파일 상태
  const [cadFilePath, setCadFilePath] = useState('');
  const [cadFileType, setCadFileType] = useState(''); // dxf / dwf

  // ------------------ 도메인 더블클릭 (DomainManagement 연동) ------------------
  const handleDomainDoubleClick = (domainData) => {
    console.log('=== App.js 도메인 더블클릭 처리 시작 ===');
    console.log('받은 데이터:', domainData);

    if (!domainData.cadFilePath) {
      alert('CAD 파일 경로가 없습니다.');
      return;
    }

    // DomainManagement에서 이미 처리된 데이터를 그대로 사용
    setCadFileType('dxf');
    setCadFilePath(domainData.cadFilePath);
    setActiveTab('구역관리');

    if (domainData.isConverted) {
      console.log('✅ 변환된 DWF 파일을 CADDisplay에 전달');
    } else {
      console.log('✅ DXF 파일을 CADDisplay에 전달');
    }

    console.log('📁 CADDisplay에 전달된 파일 경로:', domainData.cadFilePath);
    console.log('=== App.js 처리 완료 ===');
  };

  const handleAreaSelect = (area) => {
    setSelectedArea(area);
    setAreaName(area);
  };

  const handleSave = () => alert('저장되었습니다.');

  // ------------------ 탭별 렌더링 ------------------
  const renderContent = () => {
    switch(activeTab) {
      case '도면관리':
        return <DomainManagement onDomainDoubleClick={handleDomainDoubleClick} />;

      case '구역관리':
        return (
          <>
            <Sidebar
              selectedArea={selectedArea}
              handleAreaSelect={handleAreaSelect}
            />
            <main className="main-area">
              <CADDisplay cadFilePath={cadFilePath} cadFileType={cadFileType} />
              <PropertyPanel
                areaName={areaName}
                setAreaName={setAreaName}
                usage={usage}
                setUsage={setUsage}
                operation={operation}
                setOperation={setOperation}
                handleSave={handleSave}
              />
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