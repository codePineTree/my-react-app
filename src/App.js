// App.js
import React, { useState, useEffect } from 'react';
import './components/AreaTemplete.css';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import CADDisplay from './components/CADDisplay';
import DomainManagement from './components/DomainManagement';

const App = () => {
  const API_BASE_URL = 'http://localhost:8080';
  
  const [activeTab, setActiveTab] = useState('도면관리');
  const [selectedArea, setSelectedArea] = useState('구역명 2');

  // CAD 파일 상태
  const [cadFilePath, setCadFilePath] = useState('');
  const [cadFileType, setCadFileType] = useState(''); // dxf / dwf
  const [modelId, setModelId] = useState(null);

  // ------------------ 페이지 로딩시 변환된 파일 체크 ------------------
  useEffect(() => {
    console.log('🚀 App.js 초기화 시작');
    checkForConvertedFiles();
  }, []);

  const checkForConvertedFiles = async () => {
    try {
      console.log('🔍 변환된 파일 체크 시작...');
      const conversionRequested = sessionStorage.getItem('conversionRequested');
      const conversionSource = sessionStorage.getItem('conversionSource');
      const conversionModelId = sessionStorage.getItem('conversionModelId');
      
      if (!conversionRequested || conversionSource !== 'dwf_conversion') {
        console.log('❌ 변환 요청 없음 - 도면관리 탭 유지');
        return;
      }

      const requestedFile = sessionStorage.getItem('conversionFile');
      const requestUrl = `${API_BASE_URL}/api/cad/checkConvertedFiles?fileName=${requestedFile}&t=${Date.now()}`;
      const response = await fetch(requestUrl, { method: 'GET', cache: 'no-cache' });

      const data = await response.json();
      console.log('📋 체크 결과:', data);
      console.log('📋 복원된 MODEL_ID:', conversionModelId);
      
      if (data.hasFiles) {
        console.log('✅ 변환된 파일 발견:', data.fileName);

        // 플래그 제거
        sessionStorage.removeItem('conversionRequested');
        sessionStorage.removeItem('conversionFile');
        sessionStorage.removeItem('conversionSource');
        sessionStorage.removeItem('conversionModelId');

        setCadFilePath(data.fileName);
        setCadFileType('dwf');
        // ✅ sessionStorage에서 복원한 MODEL_ID 사용 (서버 응답보다 우선)
        setModelId(conversionModelId || data.MODEL_ID || null); 
        setActiveTab('구역관리');
      } else if (data.generating) {
        console.log('⏳ 파일 생성 중... 재시도');
        setTimeout(() => checkForConvertedFiles(), 3000);
      } else {
        console.log('❌ 변환된 파일 없음');
        sessionStorage.removeItem('conversionRequested');
        sessionStorage.removeItem('conversionFile');
        sessionStorage.removeItem('conversionSource');
        sessionStorage.removeItem('conversionModelId');
      }
    } catch (error) {
      console.log('❌ 변환 체크 실패', error);
      sessionStorage.removeItem('conversionRequested');
      sessionStorage.removeItem('conversionFile');
      sessionStorage.removeItem('conversionSource');
      sessionStorage.removeItem('conversionModelId');
    }
  };

  // ------------------ 도메인 더블클릭 ------------------
  const handleDomainDoubleClick = (domainData) => {
    console.log('=== App.js 도메인 더블클릭 처리 시작 ===', domainData);

    if (!domainData.cadFilePath) {
      alert('CAD 파일 경로가 없습니다.');
      return;
    }

    setCadFileType('dxf'); // 도메인에서 직접 선택한 파일은 DXF
    setCadFilePath(domainData.cadFilePath);
    setModelId(domainData.MODEL_ID);
    setActiveTab('구역관리');
  };

  const handleAreaSelect = (area) => {
    setSelectedArea(area);
  };

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
            <main className="main-area" style={{flexDirection: 'column', gap: '20px'}}>
              <CADDisplay 
                cadFilePath={cadFilePath} 
                cadFileType={cadFileType}
                modelId={modelId}
                onSave={() => alert('저장되었습니다.')}
              />
              <div style={{height: '100px'}}></div>
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