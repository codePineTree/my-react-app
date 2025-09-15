import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DomainTemplete.css';
import DomainList from './DomainList';
import DomainForm from './DomainForm';

// ------------------ DomainManagement Component ------------------
const DomainManagement = ({ onDomainDoubleClick }) => {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [formData, setFormData] = useState({ 
    domainName: '', 
    buildingName: '', 
    area: '', 
    version: '', 
    description: '' 
  });
  const [pendingFiles, setPendingFiles] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [newDomainCounter, setNewDomainCounter] = useState(0);
  const API_BASE_URL = 'http://localhost:8080';

  useEffect(() => { 
    fetchDomains(); 
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

  const selectDomain = (domain) => {
    setSelectedDomain(domain);
    setFormData({
      domainName: domain.MODEL_NM || '',
      buildingName: domain.BUILDING_NM || '',
      area: domain.MODEL_SIZE != null ? String(domain.MODEL_SIZE) : '',
      version: domain.VERSION_INFO || '',
      description: domain.MODEL_DESC || ''
    });
    const files = domain.FILE_PATH ? [{ name: domain.FILE_PATH, isDB: true }] : [];
    setUploadedFiles(files);
    setPendingFiles({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (!selectedDomain) return;
    
    setDomains(prev => prev.map(d => 
      d.MODEL_ID === selectedDomain.MODEL_ID ? {
        ...d,
        RowStatus: d.RowStatus === 'I' ? 'I' : 'U',
        MODEL_NM: name === 'domainName' ? value : d.MODEL_NM,
        BUILDING_NM: name === 'buildingName' ? value : d.BUILDING_NM,
        MODEL_SIZE: name === 'area' ? (value !== '' ? Number(value) : 0) : d.MODEL_SIZE,
        VERSION_INFO: name === 'version' ? value : d.VERSION_INFO,
        MODEL_DESC: name === 'description' ? value : d.MODEL_DESC
      } : d
    ));
  };

  const handleFileChange = (e) => {
    if (!selectedDomain) return;
    const file = e.target.files[0];
    if (!file) return;
    
    setPendingFiles(prev => ({ ...prev, [selectedDomain.MODEL_ID]: file }));
    setUploadedFiles(prev => [...prev.filter(f => f.isDB), { file, name: file.name, isDB: false }]);
    setFormData(prev => ({ ...prev, FILE_PATH: file.name }));
    setDomains(prev => prev.map(d => 
      d.MODEL_ID === selectedDomain.MODEL_ID ? {
        ...d, 
        FILE_PATH: file.name, 
        RowStatus: d.RowStatus === 'I' ? 'I' : 'U'
      } : d
    ));
  };

  const addDomainVirtual = () => {
    const tempId = `NEW_${newDomainCounter}`;
    setNewDomainCounter(prev => prev + 1);
    const newDomain = { 
      MODEL_ID: tempId, 
      MODEL_NM: '', 
      BUILDING_NM: '', 
      MODEL_SIZE: 0, 
      VERSION_INFO: '', 
      MODEL_DESC: '', 
      RowStatus: 'I', 
      FILE_PATH: '' 
    };
    setDomains(prev => [...prev, newDomain]);
    setSelectedDomain(newDomain);
    setFormData({ domainName: '', buildingName: '', area: '', version: '', description: '' });
    setUploadedFiles([]);
    setPendingFiles({});
  };

  const removeDomainVirtual = () => {
    if (!selectedDomain) return;
    setDomains(prev => prev.map(d => 
      d.MODEL_ID === selectedDomain.MODEL_ID ? { ...d, RowStatus: 'D' } : d
    ));
    setSelectedDomain(null);
    setFormData({ domainName: '', buildingName: '', area: '', version: '', description: '' });
    setUploadedFiles([]);
    setPendingFiles({});
  };

  const saveDomain = async () => {
    try {
      const changedRows = domains.filter(d => ['I', 'U', 'D'].includes(d.RowStatus));
      if (!changedRows.length) { 
        alert('저장할 변경사항이 없습니다.'); 
        return; 
      }

      for (const d of changedRows) {
        const file = pendingFiles[d.MODEL_ID];
        if (file && d.RowStatus !== 'D') {
          const fileExt = file.name.split('.').pop().toLowerCase();
          const formDataObj = new FormData();
          formDataObj.append('file', file);
          formDataObj.append('modelId', d.MODEL_ID);
          
          if (fileExt === 'dxf') {
            await axios.post(`${API_BASE_URL}/api/cad/uploadDXF`, formDataObj, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          } else if (fileExt === 'dwf') {
            await axios.post(`${API_BASE_URL}/api/cad/uploadDWF`, formDataObj, {
              headers: { 'Content-Type': 'multipart/form-data' }
            });
          }
          d.FILE_PATH = file.name;
          delete pendingFiles[d.MODEL_ID];
        }
      }

      const payload = changedRows.map(d => ({
        MODEL_ID: d.MODEL_ID,
        MODEL_NM: d.MODEL_NM || '',
        BUILDING_NM: d.BUILDING_NM || '',
        MODEL_DESC: d.MODEL_DESC || '',
        VERSION_INFO: d.VERSION_INFO || '',
        MODEL_SIZE: d.MODEL_SIZE || 0,
        FILE_PATH: d.FILE_PATH || '',
        RowStatus: d.RowStatus
      }));

      await axios.post(`${API_BASE_URL}/api/cad/models/saveCadModelList`, payload);
      alert('변경사항과 파일이 서버에 저장되었습니다.');
      setFormData({ domainName: '', buildingName: '', area: '', version: '', description: '' });
      setSelectedDomain(null);
      setPendingFiles({});
      setUploadedFiles([]);
      await fetchDomains();
    } catch (e) { 
      console.error('저장 중 오류', e); 
      alert('저장 중 오류'); 
    }
  };

  const handleSearch = async () => { 
    await fetchDomains(); 
    alert('조회 완료'); 
  };

  // ------------------ 도메인 더블클릭 (convertAndGetDxf 사용) ------------------
  const handleDomainDoubleClick = async (domain) => {
    console.log('DomainManagement: 도메인 더블클릭 시작');
    console.log('파일 경로:', domain.FILE_PATH);
    
    if (!domain.FILE_PATH) {
      alert('파일 경로가 없습니다.');
      return;
    }

    // 변환 요청 플래그 설정
    sessionStorage.setItem('conversionRequested', 'true');
    sessionStorage.setItem('conversionFile', domain.FILE_PATH);

    let finalData = { ...domain };

    if (domain.FILE_PATH.toLowerCase().endsWith('.dwf')) {
      try {
        console.log('DWF 변환 시작:', domain.FILE_PATH);

        // /convertAndGetDxf 엔드포인트 사용 (DXF 텍스트 내용 반환)
        const response = await axios.get(`${API_BASE_URL}/api/cad/convertAndGetDxf`, {
          params: { fileName: domain.FILE_PATH }
        });

        console.log('변환 API 응답 status:', response.status);
        console.log('DXF 내용 길이:', response.data?.length);

        if (!response.data || response.data.length < 10) {
          console.warn('DXF 내용이 비어있음');
          alert('DWF 변환 결과가 없습니다.');
          // 실패 시 플래그 제거
          sessionStorage.removeItem('conversionRequested');
          sessionStorage.removeItem('conversionFile');
          return;
        }

        // DXF 형식 검증
        if (!response.data.includes('SECTION') && !response.data.includes('HEADER')) {
          console.warn('올바른 DXF 형식이 아님');
          alert('변환된 내용이 올바른 DXF 형식이 아닙니다.');
          // 실패 시 플래그 제거
          sessionStorage.removeItem('conversionRequested');
          sessionStorage.removeItem('conversionFile');
          return;
        }

        // DXF 텍스트를 Blob으로 생성
        const blob = new Blob([response.data], { type: 'text/plain; charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        console.log('DWF 변환 완료, blob URL 생성:', blobUrl);

        // App.js에 전달할 데이터 설정
        finalData = {
          ...domain,
          cadFilePath: blobUrl,  // 변환된 Blob URL
          fileType: 'dxf',       // DXF로 처리
          isConverted: true      // 변환된 파일임을 표시
        };

      } catch (e) {
        console.error('DWF 변환 실패:', e);
        alert('DWF 변환 실패: ' + e.message);
        // 실패 시 플래그 제거
        sessionStorage.removeItem('conversionRequested');
        sessionStorage.removeItem('conversionFile');
        return;
      }
    } else {
      // DXF 파일인 경우도 플래그는 설정 (구역관리로 이동하므로)
      finalData = {
        ...domain,
        cadFilePath: domain.FILE_PATH,  // 원본 파일명
        fileType: 'dxf',
        isConverted: false
      };
    }

    // App.js로 최종 데이터 전달
    console.log('App.js로 전달할 데이터:', finalData);
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
      />
      <DomainForm
        formData={formData}
        onInputChange={handleInputChange}
        onSave={saveDomain}
        onAdd={addDomainVirtual}
        onRemove={removeDomainVirtual}
        selectedDomain={selectedDomain}
        onFileChange={handleFileChange}
        uploadedFiles={uploadedFiles}
      />
    </div>
  );
};

export default DomainManagement;