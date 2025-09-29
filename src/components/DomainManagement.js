import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './DomainTemplete.css';
import DomainList from './DomainList';
import DomainForm from './DomainForm';

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

  const deleteFileFromServer = async (fileName) => {
    try {
      console.log('서버에서 파일 삭제:', fileName);
      const response = await axios.delete(`${API_BASE_URL}/api/cad/deleteFile`, {
        params: { fileName: fileName }
      });
      
      if (response.data.success) {
        console.log('파일 삭제 성공');
        return true;
      }
      return false;
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      return false;
    }
  };

  const clearAllAreasFromDB = async (modelId) => {
    try {
      console.log('전체 구역 삭제:', modelId);
      
      const deleteAllData = {
        drawingStatus: 'D',
        areaId: 'ALL',
        modelId: modelId
      };

      const response = await axios.post(`${API_BASE_URL}/api/cad/area/save`, deleteAllData);
      
      if (response.data.success) {
        console.log('전체 구역 삭제 성공');
        return true;
      }
      return false;
    } catch (error) {
      console.error('전체 삭제 오류:', error);
      return false;
    }
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

        if (d.RowStatus === 'D') {
          console.log('도메인 삭제:', d.MODEL_ID);
          
          if (d.FILE_PATH) {
            await deleteFileFromServer(d.FILE_PATH);
          }
          
          await clearAllAreasFromDB(d.MODEL_ID);
        }
        
        else if (d.RowStatus === 'U' && file) {
          console.log('파일 교체:', d.MODEL_ID);
          
          const originalDomains = await axios.post(`${API_BASE_URL}/api/cad/models/getCadModelList`, {});
          const originalDomain = originalDomains.data.find(orig => orig.MODEL_ID === d.MODEL_ID);
          
          if (originalDomain && originalDomain.FILE_PATH && originalDomain.FILE_PATH !== file.name) {
            const confirmed = window.confirm(
              `CAD 파일이 변경되었습니다.\n` +
              `기존 파일: ${originalDomain.FILE_PATH}\n` +
              `새 파일: ${file.name}\n\n` +
              `모든 구역 데이터를 삭제하고 저장하시겠습니까?`
            );
            
            if (confirmed) {
              const fileDeleted = await deleteFileFromServer(originalDomain.FILE_PATH);
              if (!fileDeleted) {
                alert('기존 파일 삭제 실패');
                return;
              }
              
              const areasDeleted = await clearAllAreasFromDB(d.MODEL_ID);
              if (!areasDeleted) {
                alert('구역 삭제 실패');
                return;
              }
            } else {
              alert('저장 취소');
              return;
            }
          }
        }
      }

      for (const d of changedRows) {
        const file = pendingFiles[d.MODEL_ID];
        if (file && d.RowStatus !== 'D') {
          console.log('파일 업로드:', file.name);
          
          const fileExt = file.name.split('.').pop().toLowerCase();
          const formDataObj = new FormData();
          formDataObj.append('file', file);
          formDataObj.append('modelId', d.MODEL_ID);
          
          try {
            if (fileExt === 'dxf') {
              await axios.post(`${API_BASE_URL}/api/cad/uploadDXF`, formDataObj, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } else if (fileExt === 'dwf') {
              await axios.post(`${API_BASE_URL}/api/cad/uploadDWF`, formDataObj, {
                headers: { 'Content-Type': 'multipart/form-data' }
              });
            } else {
              alert(`지원하지 않는 파일 형식: ${fileExt}`);
              return;
            }
            
            d.FILE_PATH = file.name;
          } catch (uploadError) {
            console.error('파일 업로드 실패:', uploadError);
            alert('파일 업로드 실패');
            return;
          }
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
      
      alert('저장 완료');
      
      setFormData({ domainName: '', buildingName: '', area: '', version: '', description: '' });
      setSelectedDomain(null);
      setPendingFiles({});
      setUploadedFiles([]);
      
      await fetchDomains();
      
    } catch (e) { 
      console.error('저장 오류', e); 
      alert('저장 중 오류'); 
    }
  };

  const handleSearch = async () => { 
    await fetchDomains(); 
    alert('조회 완료'); 
  };

  // ==================== ABViewer 제거, Aspose로 직접 처리 ====================
  const handleDomainDoubleClick = (domain) => {
    console.log('도메인 더블클릭:', domain.FILE_PATH);
    
    if (!domain.FILE_PATH) {
      alert('파일 경로가 없습니다.');
      return;
    }

    // DXF든 DWF든 Aspose가 직접 파싱
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