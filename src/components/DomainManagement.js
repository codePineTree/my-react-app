import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DomainTemplete.css';
import DomainList from './DomainList';

const DomainManagement = ({ onDomainDoubleClick }) => {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [newDomainCounter, setNewDomainCounter] = useState(0);
  const API_BASE_URL = 'http://localhost:8080';

  useEffect(() => { 
    fetchDomains();
    
    // 팝업 창에서 오는 메시지 처리
    const handleMessage = (event) => {
      if (event.data.type === 'DOMAIN_SAVED') {
        fetchDomains(); // 저장 완료 → 목록 새로고침
      } else if (event.data.type === 'DOMAIN_DELETED') {
        fetchDomains(); // 삭제 완료 → 목록 새로고침
      } else if (event.data.type === 'POPUP_CLOSED_WITHOUT_SAVE') {
        // 저장 없이 팝업 닫힘 → 임시 항목 제거
        setDomains(prev => prev.filter(d => d.RowStatus !== 'I'));
      } else if (event.data.type === 'DOMAIN_DATA_CHANGED') {
        // 실시간 데이터 변경
        const { domainId, fieldName, fieldValue } = event.data;
        
        setDomains(prev => prev.map(d => {
          if (d.MODEL_ID === domainId) {
            if (fieldName === 'domainName') {
              return { ...d, MODEL_NM: fieldValue };
            } else if (fieldName === 'buildingName') {
              return { ...d, BUILDING_NM: fieldValue };
            } else if (fieldName === 'area') {
              return { ...d, MODEL_SIZE: fieldValue !== '' ? Number(fieldValue) : 0 };
            } else if (fieldName === 'version') {
              return { ...d, VERSION_INFO: fieldValue };
            } else if (fieldName === 'description') {
              return { ...d, MODEL_DESC: fieldValue };
            }
          }
          return d;
        }));
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const fetchDomains = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/cad/models/getCadModelList`, {});
      if (Array.isArray(res.data)) {
        setDomains(res.data.map(d => ({ ...d, RowStatus: '' })));
      } else { 
        setDomains([]); 
        console.warn('데이터 형식 오류', res.data); 
      }
    } catch (e) { 
      console.error('도면 조회 실패', e); 
      alert('도면 목록 조회 중 오류'); 
    }
  };

  // 새 창 열기 함수
  const openPopupWindow = (mode, domainId = null) => {
    const width = 900;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;
    
    let url = `/domain-form?mode=${mode}`;
    if (domainId) {
      url += `&domainId=${domainId}`;
    }
    
    const popup = window.open(
      url,
      'DomainFormWindow',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    // 팝업이 닫혔는지 체크
    const checkPopupClosed = setInterval(() => {
      if (popup && popup.closed) {
        clearInterval(checkPopupClosed);
        // 팝업 닫힘 - 저장 없이 닫힌 경우 임시 항목 제거
        setDomains(prev => prev.filter(d => d.RowStatus !== 'I'));
      }
    }, 500);
  };

  // 신규 버튼 클릭
  const handleNewClick = () => {
    const tempId = `NEW_${newDomainCounter}`;
    setNewDomainCounter(prev => prev + 1);
    
    // 리스트에 임시 항목 추가 (빈 이름으로 시작)
    const newDomain = { 
      MODEL_ID: tempId, 
      MODEL_NM: '', // 빈 문자열로 시작
      BUILDING_NM: '', 
      MODEL_SIZE: 0, 
      VERSION_INFO: '', 
      MODEL_DESC: '', 
      RowStatus: 'I', 
      FILE_PATH: '' 
    };
    
    setDomains(prev => [newDomain, ...prev]); // 맨 위에 추가
    setSelectedDomain(newDomain);
    
    // 팝업 열기
    openPopupWindow('new', tempId);
  };

  // 단일 클릭 - 새 창으로 수정
  const selectDomain = (domain) => {
    // 임시 항목(신규) 클릭 시 팝업 열지 않음
    if (domain.RowStatus === 'I') {
      return;
    }
    
    setSelectedDomain(domain);
    openPopupWindow('edit', domain.MODEL_ID);
  };

  // 조회
  const handleSearch = async () => { 
    await fetchDomains(); 
    alert('조회 완료'); 
  };

  // 더블 클릭 - CAD 화면으로 이동
  const handleDomainDoubleClick = (domain) => {
    // 임시 항목(신규)은 더블클릭 불가
    if (domain.RowStatus === 'I') {
      alert('저장 후 사용할 수 있습니다.');
      return;
    }
    
    console.log('도메인 더블클릭:', domain.FILE_PATH);
    
    if (!domain.FILE_PATH) {
      alert('저장된 CAD 파일이 없습니다.');
      return;
    }

    const finalData = {
      ...domain,
      MODEL_ID: domain.MODEL_ID,
      cadFilePath: domain.FILE_PATH,
      fileType: domain.FILE_PATH.toLowerCase().endsWith('.dwf') ? 'dwf' : 'dxf'
    };

    console.log('App.js로 전달:', finalData);
    onDomainDoubleClick(finalData);
  };

  return (
    <div className="domain-container">
      <DomainList
        domains={domains}
        selectedDomain={selectedDomain}
        onDomainSelect={selectDomain}
        onSearch={handleSearch}
        onRowDoubleClick={handleDomainDoubleClick}
        onNewClick={handleNewClick}
      />
    </div>
  );
};

export default DomainManagement;