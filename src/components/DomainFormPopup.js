import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import DomainForm from './DomainForm';
import './DomainTemplete.css';

const DomainFormPopup = () => {
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    domainName: '',
    buildingName: '',
    area: '',
    version: '',
    description: '',
    FILE_PATH: ''
  });
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const API_BASE_URL = 'http://localhost:8080';

  useEffect(() => {
    // URL에서 모드와 도메인 ID 가져오기
    const mode = searchParams.get('mode');
    const domainId = searchParams.get('domainId');

    if (mode === 'new') {
      // 신규 모드
      setSelectedDomain({
        MODEL_ID: domainId,
        MODEL_NM: '',
        BUILDING_NM: '',
        MODEL_SIZE: 0,
        VERSION_INFO: '',
        MODEL_DESC: '',
        RowStatus: 'I',
        FILE_PATH: ''
      });
    } else if (mode === 'edit' && domainId) {
      // 수정 모드 - 서버에서 데이터 가져오기
      fetchDomainData(domainId);
    }
  }, [searchParams]);

  // 팝업 닫힐 때 처리
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 저장 없이 닫힐 때만 메시지 전송
      if (window.opener && selectedDomain?.RowStatus === 'I') {
        window.opener.postMessage({ type: 'POPUP_CLOSED_WITHOUT_SAVE' }, '*');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [selectedDomain]);

  const fetchDomainData = async (domainId) => {
    try {
      const res = await axios.post(`${API_BASE_URL}/api/cad/models/getCadModelList`, {});
      const domain = res.data.find(d => d.MODEL_ID === domainId);
      
      if (domain) {
        setSelectedDomain({ ...domain, RowStatus: 'U' });
        setFormData({
          domainName: domain.MODEL_NM || '',
          buildingName: domain.BUILDING_NM || '',
          area: domain.MODEL_SIZE != null ? String(domain.MODEL_SIZE) : '',
          version: domain.VERSION_INFO || '',
          description: domain.MODEL_DESC || '',
          FILE_PATH: domain.FILE_PATH || ''
        });
        const files = domain.FILE_PATH ? [{ name: domain.FILE_PATH, isDB: true }] : [];
        setUploadedFiles(files);
      }
    } catch (e) {
      console.error('도면 조회 실패', e);
      alert('도면 데이터를 불러오는 중 오류가 발생했습니다.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    console.log('🔵 DomainFormPopup handleInputChange 호출');
    console.log('필드명:', name);
    console.log('값:', value);
    
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (selectedDomain) {
      setSelectedDomain(prev => ({
        ...prev,
        MODEL_NM: name === 'domainName' ? value : prev.MODEL_NM,
        BUILDING_NM: name === 'buildingName' ? value : prev.BUILDING_NM,
        MODEL_SIZE: name === 'area' ? (value !== '' ? Number(value) : 0) : prev.MODEL_SIZE,
        VERSION_INFO: name === 'version' ? value : prev.VERSION_INFO,
        MODEL_DESC: name === 'description' ? value : prev.MODEL_DESC
      }));

      // 부모 창에 실시간 업데이트 전송
      if (window.opener) {
        window.opener.postMessage({
          type: 'DOMAIN_DATA_CHANGED',
          domainId: selectedDomain.MODEL_ID,
          fieldName: name,
          fieldValue: value
        }, '*');
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setPendingFile(file);
    // ✅ 수정: 기존 파일 제거하고 새 파일만 표시
    setUploadedFiles([{ file, name: file.name, isDB: false }]);
    setFormData(prev => ({ ...prev, FILE_PATH: file.name }));
    
    if (selectedDomain) {
      setSelectedDomain(prev => ({
        ...prev,
        FILE_PATH: file.name
      }));
    }
  };

  const deleteFileFromServer = async (fileName) => {
    try {
      const response = await axios.delete(`${API_BASE_URL}/api/cad/deleteFile`, {
        params: { fileName: fileName }
      });
      return response.data.success;
    } catch (error) {
      console.error('파일 삭제 오류:', error);
      return false;
    }
  };

  const clearAllAreasFromDB = async (modelId) => {
    try {
      const deleteAllData = {
        drawingStatus: 'D',
        areaId: 'ALL',
        modelId: modelId
      };
      const response = await axios.post(`${API_BASE_URL}/api/cad/area/save`, deleteAllData);
      return response.data.success;
    } catch (error) {
      console.error('전체 삭제 오류:', error);
      return false;
    }
  };

  const handleSave = async () => {
    try {
      if (!selectedDomain) {
        alert('도면 정보가 없습니다.');
        return;
      }

      // 도면명 필수 검증 추가
      if (!formData.domainName || formData.domainName.trim() === '') {
        alert('도면명을 입력해주세요.');
        return;
      }

      // 파일 교체 확인 (수정 모드일 때)
      if (selectedDomain.RowStatus === 'U' && pendingFile) {
        const originalDomains = await axios.post(`${API_BASE_URL}/api/cad/models/getCadModelList`, {});
        const originalDomain = originalDomains.data.find(orig => orig.MODEL_ID === selectedDomain.MODEL_ID);
        
        if (originalDomain && originalDomain.FILE_PATH && originalDomain.FILE_PATH !== pendingFile.name) {
          const confirmed = window.confirm(
            `CAD 파일이 변경되었습니다.\n` +
            `기존 파일: ${originalDomain.FILE_PATH}\n` +
            `새 파일: ${pendingFile.name}\n\n` +
            `모든 구역 데이터를 삭제하고 저장하시겠습니까?`
          );
          
          if (confirmed) {
            await deleteFileFromServer(originalDomain.FILE_PATH);
            await clearAllAreasFromDB(selectedDomain.MODEL_ID);
          } else {
            alert('저장 취소');
            return;
          }
        }
      }

      // 파일 업로드 처리
      if (pendingFile) {
        const fileExt = pendingFile.name.split('.').pop().toLowerCase();
        const formDataObj = new FormData();
        formDataObj.append('file', pendingFile);
        formDataObj.append('modelId', selectedDomain.MODEL_ID);
        
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
        } catch (uploadError) {
          console.error('파일 업로드 실패:', uploadError);
          alert('파일 업로드 실패');
          return;
        }
      }

      // 도면 정보 저장
      const payload = [{
        MODEL_ID: selectedDomain.MODEL_ID,
        MODEL_NM: formData.domainName || '',
        BUILDING_NM: formData.buildingName || '',
        MODEL_DESC: formData.description || '',
        VERSION_INFO: formData.version || '',
        MODEL_SIZE: formData.area ? Number(formData.area) : 0,
        FILE_PATH: formData.FILE_PATH || '',
        RowStatus: selectedDomain.RowStatus
      }];

      await axios.post(`${API_BASE_URL}/api/cad/models/saveCadModelList`, payload);
      
      alert('저장 완료');
      
      // 부모 창에 저장 완료 알림
      if (window.opener) {
        window.opener.postMessage({ type: 'DOMAIN_SAVED' }, '*');
      }
      
      window.close();
      
    } catch (e) {
      console.error('저장 오류', e);
      alert('저장 중 오류가 발생했습니다.');
    }
  };

  const handleRemove = async () => {
    if (!selectedDomain) return;
    
    const confirmed = window.confirm('정말 삭제하시겠습니까?');
    if (!confirmed) return;

    try {
      if (selectedDomain.FILE_PATH) {
        await deleteFileFromServer(selectedDomain.FILE_PATH);
      }
      await clearAllAreasFromDB(selectedDomain.MODEL_ID);

      const payload = [{
        MODEL_ID: selectedDomain.MODEL_ID,
        MODEL_NM: selectedDomain.MODEL_NM || '',
        BUILDING_NM: selectedDomain.BUILDING_NM || '',
        MODEL_DESC: selectedDomain.MODEL_DESC || '',
        VERSION_INFO: selectedDomain.VERSION_INFO || '',
        MODEL_SIZE: selectedDomain.MODEL_SIZE || 0,
        FILE_PATH: selectedDomain.FILE_PATH || '',
        RowStatus: 'D'
      }];

      await axios.post(`${API_BASE_URL}/api/cad/models/saveCadModelList`, payload);
      
      alert('삭제 완료');
      
      // 부모 창에 삭제 완료 알림
      if (window.opener) {
        window.opener.postMessage({ type: 'DOMAIN_DELETED' }, '*');
      }
      
      window.close();
      
    } catch (e) {
      console.error('삭제 오류', e);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  return (
    <div style={{ padding: '20px', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <DomainForm
        formData={formData}
        onInputChange={handleInputChange}
        onSave={handleSave}
        onAdd={null}
        onRemove={selectedDomain?.RowStatus === 'U' ? handleRemove : null}
        selectedDomain={selectedDomain}
        onFileChange={handleFileChange}
        uploadedFiles={uploadedFiles}
        showDeleteButton={selectedDomain?.RowStatus === 'U'}
        formTitle={selectedDomain?.RowStatus === 'I' ? '도면 정보 (신규)' : '도면 정보 (변경)'}
      />
    </div>
  );
};

export default DomainFormPopup;