// App.js
import React, { useState, useEffect } from 'react';
import './components/AreaTemplete.css';
import Navigation from './components/Navigation';
import Sidebar from './components/Sidebar';
import CADDisplay from './components/CADDisplay';
import PropertyPanel from './components/PropertyPanel';
import DomainManagement from './components/DomainManagement';

const App = () => {
  const API_BASE_URL = 'http://localhost:8080';
  
  const [activeTab, setActiveTab] = useState('도면관리');
  const [selectedArea, setSelectedArea] = useState('구역명 2');
  const [areaName, setAreaName] = useState('구역명 2');
  const [usage, setUsage] = useState('');
  const [operation, setOperation] = useState('자동/수동 업력');

  // CAD 파일 상태
  const [cadFilePath, setCadFilePath] = useState('');
  const [cadFileType, setCadFileType] = useState(''); // dxf / dwf

  // ------------------ 페이지 로딩시 변환된 파일 체크 ------------------
  useEffect(() => {
    console.log('🚀 App.js 초기화 시작');
    checkForConvertedFiles();
  }, []);

  const checkForConvertedFiles = async () => {
    try {
      console.log('🔍 변환된 파일 체크 시작...');
      
      // 변환 요청 플래그 체크
      const conversionRequested = sessionStorage.getItem('conversionRequested');
      
      if (!conversionRequested) {
        console.log('❌ 변환 요청 없음 - 도면관리 탭 유지');
        return;
      }
      
      console.log('✅ 변환 요청 플래그 확인됨');
      console.log('API_BASE_URL 값:', API_BASE_URL);
      
      // 요청된 파일명을 URL 파라미터로 추가
      const requestedFile = sessionStorage.getItem('conversionFile');
      const requestUrl = `${API_BASE_URL}/api/cad/checkConvertedFiles?fileName=${requestedFile}&t=${Date.now()}`;
      console.log('📡 요청 보내는 주소:', requestUrl);
      console.log('🎯 체크할 파일:', requestedFile);
      
      const response = await fetch(requestUrl, {
        method: 'GET',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      console.log('📡 응답 상태:', response.status);
      console.log('📡 응답 헤더:', response.headers.get('content-type'));
      
      // 응답이 JSON인지 확인
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.log('❌ API가 아직 구현되지 않음 - 도면관리 탭 유지');
        // 실패 시 플래그 제거
        sessionStorage.removeItem('conversionRequested');
        sessionStorage.removeItem('conversionFile');
        return;
      }
      
      const data = await response.json();
      console.log('📋 체크 결과:', data);
      
      if (data.hasFiles) {
        console.log('✅ 변환된 파일 발견:', data.fileName);
        
        // 성공 시 플래그 제거
        sessionStorage.removeItem('conversionRequested');
        sessionStorage.removeItem('conversionFile');
        
        setCadFilePath(data.fileName);
        setCadFileType('dxf');
        setActiveTab('구역관리');
        console.log('📍 구역관리 탭으로 자동 전환');
      } else if (data.generating) {
        console.log('⏳ 파일 생성 중... 3초 후 재시도');
        setTimeout(() => {
          checkForConvertedFiles();
        }, 3000);
      } else {
        console.log('❌ 변환된 파일 없음 - 도면관리 탭 유지');
        // 실패 시 플래그 제거
        sessionStorage.removeItem('conversionRequested');
        sessionStorage.removeItem('conversionFile');
      }
    } catch (error) {
      console.log('❌ API 호출 실패 (아직 구현 안됨?) - 도면관리 탭 유지');
      // 에러 시 플래그 제거
      sessionStorage.removeItem('conversionRequested');
      sessionStorage.removeItem('conversionFile');
      // 에러 로그는 개발시에만 출력
      // console.error('파일 체크 오류:', error);
    }
  };

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