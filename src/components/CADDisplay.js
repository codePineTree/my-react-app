import React, { useRef, useEffect, useState } from "react";
import DxfParser from "dxf-parser";
import AreaDrawing from "./AreaDrawing";
import AreaManager from "./AreaManager";

/**
 * CADDisplay 컴포넌트 - 메인 CAD 뷰어
 * 
 * 역할: 
 * 1. DXF 파일 로딩 및 기본 CAD 도면 렌더링
 * 2. 줌/팬 등 기본 뷰 조작 기능
 * 3. 펜 모드 및 지우개 모드 상태 관리
 * 4. AreaDrawing과 AreaManager 컴포넌트들을 조율하는 컨트롤러 역할
 */
const CADDisplay = ({ cadFilePath }) => {
  const canvasRef = useRef(null);
  const areaManagerRef = useRef(null); // AreaManager 참조용
  
  // ==================== 기존 CAD 렌더링 상태 ====================
  const [dxfData, setDxfData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  
  // ==================== 구역 관리 모드 상태 ====================
  // 펜 모드: 구역 그리기 활성화
  const [isPenMode, setIsPenMode] = useState(false);
  
  // 지우개 모드: 구역 삭제 활성화  
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  
  // 현재 모델 ID (파일명에서 추출)
  const [currentModelId, setCurrentModelId] = useState(null);

  // ==================== 완성된 구역들 상태 (새로 추가) ====================
  const [completedAreas, setCompletedAreas] = useState([]);

  const MAX_RETRIES = 15;
  const RETRY_DELAY = 3000;

  // ==================== DXF 렌더링 함수들 (기존 코드 유지) ====================
  function renderEntity(ctx, entity) {
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 1 / ctx.getTransform().a;

    switch (entity.type) {
      case "LINE":
        renderLine(ctx, entity);
        break;
      case "POLYLINE":
      case "LWPOLYLINE":
        renderPolyline(ctx, entity);
        break;
      case "CIRCLE":
        renderCircle(ctx, entity);
        break;
      case "ARC":
        renderArc(ctx, entity);
        break;
      case "TEXT":
        renderText(ctx, entity);
        break;
      case "INSERT":
        // INSERT 숨기기
        break;
      default:
        console.log("지원하지 않는 엔티티 타입:", entity.type);
    }
  }

  function renderLine(ctx, entity) {
    if (entity.vertices?.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(entity.vertices[0].x, -entity.vertices[0].y);
      ctx.lineTo(entity.vertices[1].x, -entity.vertices[1].y);
      ctx.stroke();
    }
  }

  function renderPolyline(ctx, entity) {
    if (!entity.vertices || entity.vertices.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(entity.vertices[0].x, -entity.vertices[0].y);
    for (let i = 1; i < entity.vertices.length; i++) {
      ctx.lineTo(entity.vertices[i].x, -entity.vertices[i].y);
    }
    if (entity.shape) ctx.closePath();
    ctx.stroke();
  }

  function renderCircle(ctx, entity) {
    if (entity.center && entity.radius) {
      ctx.beginPath();
      ctx.arc(entity.center.x, -entity.center.y, entity.radius, 0, 2 * Math.PI);
      ctx.stroke();
    }
  }

  function renderArc(ctx, entity) {
    if (entity.center && entity.radius) {
      let startAngle = entity.startAngle || 0;
      let endAngle = entity.endAngle || 360;
      if (endAngle > 7 || endAngle < -7) {
        startAngle = (startAngle * Math.PI) / 180;
        endAngle = (endAngle * Math.PI) / 180;
      }
      const angleDiff = Math.abs(endAngle - startAngle);
      ctx.beginPath();
      if (angleDiff >= 2 * Math.PI - 0.01 || angleDiff <= 0.01) {
        ctx.arc(entity.center.x, -entity.center.y, entity.radius, 0, 2 * Math.PI);
      } else {
        ctx.arc(entity.center.x, -entity.center.y, entity.radius, startAngle, endAngle);
      }
      ctx.stroke();
    }
  }

  function renderText(ctx, entity) {
    if (entity.startPoint && entity.text) {
      ctx.save();
      ctx.fillStyle = "#333333";
      ctx.font = `${entity.textHeight || 10}px Arial`;
      ctx.fillText(entity.text, entity.startPoint.x, -entity.startPoint.y);
      ctx.restore();
    }
  }

  /**
   * DXF 도면을 Canvas에 렌더링하는 메인 함수
   * 구역 렌더링은 AreaManager에서 별도 처리됨
   */
  function renderDXF(dxfData, currentScale = scale, currentOffset = offset) {
    console.log("🖌️ DXF 렌더링 중...", { scale: currentScale, offset: currentOffset });
    const canvas = canvasRef.current;
    if (!canvas || !dxfData || !dxfData.entities) return;

    const ctx = canvas.getContext("2d");
    canvas.width = 900;
    canvas.height = 400;

    // 캔버스 초기화
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e6f3ff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // DXF 엔티티 렌더링
    ctx.save();
    ctx.translate(currentOffset.x, currentOffset.y);
    ctx.scale(currentScale, currentScale);

    dxfData.entities.forEach((entity) => renderEntity(ctx, entity));

    ctx.restore();

    // DXF 렌더링 완료 후 구역들도 다시 렌더링
    // AreaManager가 useEffect로 자동 감지하여 렌더링함
  }

  // ==================== 좌표 계산 함수들 (기존 코드 유지) ====================
  const calculateBounds = (entities) => {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    let hasValidCoords = false;

    entities.forEach((entity) => {
      const coords = getEntityCoordinates(entity);
      coords.forEach((coord) => {
        if (typeof coord.x === "number" && typeof coord.y === "number") {
          minX = Math.min(minX, coord.x);
          minY = Math.min(minY, coord.y);
          maxX = Math.max(maxX, coord.x);
          maxY = Math.max(maxY, coord.y);
          hasValidCoords = true;
        }
      });
    });

    return hasValidCoords ? { minX, minY, maxX, maxY } : null;
  };

  const getEntityCoordinates = (entity) => {
    const coords = [];
    switch (entity.type) {
      case "LINE":
        if (entity.vertices?.length >= 2) coords.push(...entity.vertices);
        break;
      case "POLYLINE":
      case "LWPOLYLINE":
        if (entity.vertices) coords.push(...entity.vertices);
        break;
      case "CIRCLE":
      case "ARC":
        if (entity.center) {
          const r = entity.radius || 0;
          coords.push(
            { x: entity.center.x - r, y: entity.center.y - r },
            { x: entity.center.x + r, y: entity.center.y + r }
          );
        }
        break;
      case "TEXT":
        if (entity.startPoint) coords.push(entity.startPoint);
        break;
      case "INSERT":
        if (entity.position) coords.push(entity.position);
        else if (entity.insertionPoint) coords.push(entity.insertionPoint);
        else if (entity.x !== undefined && entity.y !== undefined) {
          coords.push({ x: entity.x, y: entity.y });
        }
        break;
    }
    return coords;
  };

  const calculateScale = (bounds, canvasWidth, canvasHeight) => {
    const dxfWidth = bounds.maxX - bounds.minX;
    const dxfHeight = bounds.maxY - bounds.minY;
    if (dxfWidth === 0 || dxfHeight === 0) return 1;

    const scaleX = (canvasWidth * 0.6) / dxfWidth;
    const scaleY = (canvasHeight * 0.6) / dxfHeight;
    const finalScale = Math.min(scaleX, scaleY);

    const minScale = (Math.min(canvasWidth, canvasHeight) / Math.max(dxfWidth, dxfHeight)) * 0.1;
    return Math.max(finalScale, minScale);
  };

  const calculateOffset = (bounds, canvasWidth, canvasHeight, scale) => {
    const dxfWidth = bounds.maxX - bounds.minX;
    const dxfHeight = bounds.maxY - bounds.minY;

    const scaledWidth = dxfWidth * scale;
    const scaledHeight = dxfHeight * scale;

    return {
      x: (canvasWidth - scaledWidth) / 2 - bounds.minX * scale,
      y: canvasHeight - (canvasHeight - scaledHeight) / 2 + bounds.minY * scale,
    };
  };

  // ==================== 파일 로드 함수 (기존 코드 유지) ====================
  const loadFile = async (filePathOrBlobUrl, retryCount = 0) => {
    if (retryCount === 0) {
      setLoading(true);
      setError(null);
    }

    console.log(`📂 CADDisplay: 파일 로딩 시작 -> ${filePathOrBlobUrl} (시도: ${retryCount + 1}/${MAX_RETRIES + 1})`);

    try {
      let dxfText;
      if (filePathOrBlobUrl.startsWith("blob:")) {
        console.log('📦 Blob URL 처리');
        const res = await fetch(filePathOrBlobUrl);
        const buffer = await res.arrayBuffer();
        const decoder = new TextDecoder("utf-8");
        dxfText = decoder.decode(buffer);
      } else {
        console.log('📄 백엔드 API를 통한 DXF 내용 가져오기');
        const apiUrl = `http://localhost:8080/api/cad/convertAndGetDxf?fileName=${filePathOrBlobUrl}`;
        console.log('📡 API 호출:', apiUrl);
        
        const res = await fetch(apiUrl);
        if (!res.ok) {
          throw new Error(`API 요청 실패: ${res.status} ${res.statusText}`);
        }
        
        dxfText = await res.text();
        console.log('📄 DXF 내용 가져오기 완료, 길이:', dxfText.length);
        
        if (dxfText.includes('<html') || dxfText.includes('<!DOCTYPE')) {
          throw new Error('DXF 파일 대신 HTML 페이지가 반환되었습니다.');
        }
      }

      console.log('📝 DXF 파싱 시작, 내용 길이:', dxfText.length);

      const parser = new DxfParser();
      const dxf = parser.parseSync(dxfText);
      setDxfData(dxf);

      // 모델 ID 설정 (파일명에서 추출)
      const modelId = extractModelIdFromPath(filePathOrBlobUrl);
      setCurrentModelId(modelId);

      console.log("✅ DXF 파싱 완료, 엔티티 수:", dxf.entities.length);

      const bounds = calculateBounds(dxf.entities);
      if (bounds) {
        const autoScale = calculateScale(bounds, 900, 400);
        const autoOffset = calculateOffset(bounds, 900, 400, autoScale);
        setScale(autoScale);
        setOffset(autoOffset);
        renderDXF(dxf, autoScale, autoOffset);
      } else {
        renderDXF(dxf);
      }

      setError(null);

    } catch (err) {
      console.error("❌ DXF 로딩/파싱 실패:", err.message);
      
      if (err.message.includes("EOF group not read") && retryCount < MAX_RETRIES) {
        console.log(`🔄 재시도 ${retryCount + 1}/${MAX_RETRIES} - ${RETRY_DELAY/1000}초 후 다시 시도...`);
        setError(`파일 생성 중... (${retryCount + 1}/${MAX_RETRIES}) - ${RETRY_DELAY/1000}초 후 재시도`);
        
        setTimeout(() => {
          loadFile(filePathOrBlobUrl, retryCount + 1);
        }, RETRY_DELAY);
        return;
      }
      
      if (retryCount >= MAX_RETRIES) {
        console.log(`❌ 최대 재시도 횟수 초과: ${retryCount + 1}/${MAX_RETRIES + 1}`);
        setError(`파일 로딩 실패: 최대 재시도 횟수 초과 (${MAX_RETRIES}회)`);
      } else {
        setError(`파일 로딩 실패: ${err.message}`);
      }
    } finally {
      if (retryCount === 0) {
        setLoading(false);
      }
    }
  };

  /**
   * 파일 경로에서 모델 ID 추출
   * @param {string} filePath - 파일 경로
   * @returns {string} 모델 ID
   */
  const extractModelIdFromPath = (filePath) => {
    if (!filePath) return 'DEFAULT_MODEL';
    
    // 파일명만 추출 (경로 제거)
    const fileName = filePath.split('/').pop() || filePath;
    
    // 확장자 제거
    const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
    
    return nameWithoutExt || 'DEFAULT_MODEL';
  };

  // ==================== 기존 마우스 이벤트 (줌/팬) ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dxfData) return;

    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;

    const handleWheel = (event) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseCanvasX = event.clientX - rect.left;
      const mouseCanvasY = event.clientY - rect.top;

      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newScale = scale * zoomFactor;

      const newOffset = {
        x: mouseCanvasX - (mouseCanvasX - offset.x) * zoomFactor,
        y: mouseCanvasY - (mouseCanvasY - offset.y) * zoomFactor,
      };

      setScale(newScale);
      setOffset(newOffset);
      renderDXF(dxfData, newScale, newOffset);
    };

    const handleMouseDown = (event) => {
      // 구역 관리 모드들에서는 드래그 비활성화
      if (isPenMode || isDeleteMode) return;
      
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const handleMouseMove = (event) => {
      // 구역 관리 모드들에서는 이동 비활성화
      if (isPenMode || isDeleteMode || !isMouseDown) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;

      const newOffset = {
        x: offset.x + deltaX,
        y: offset.y + deltaY,
      };

      setOffset(newOffset);
      mouseX = event.clientX;
      mouseY = event.clientY;

      renderDXF(dxfData, scale, newOffset);
    };

    const handleMouseUp = () => {
      isMouseDown = false;
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);

    return () => {
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
    };
  }, [dxfData, scale, offset, isPenMode, isDeleteMode]);

  // ==================== 버튼 이벤트 핸들러들 ====================
  /**
   * 펜 모드 토글 핸들러
   * 펜 모드 활성화 시 지우개 모드는 자동 비활성화
   */
  const handlePenMode = () => {
    const newPenMode = !isPenMode;
    setIsPenMode(newPenMode);
    
    // 펜 모드 활성화 시 지우개 모드 비활성화
    if (newPenMode) {
      setIsDeleteMode(false);
    }
    
    console.log("펜 모드:", newPenMode);
  };

  /**
   * 지우개 모드 토글 핸들러  
   * 지우개 모드 활성화 시 펜 모드는 자동 비활성화
   */
  const handleEraser = () => {
    const newDeleteMode = !isDeleteMode;
    setIsDeleteMode(newDeleteMode);
    
    // 지우개 모드 활성화 시 펜 모드 비활성화
    if (newDeleteMode) {
      setIsPenMode(false);
    }
    
    console.log("지우개 모드:", newDeleteMode);
  };

  /**
   * 전체보기 핸들러 (기존 기능 유지)
   */
  const handleFitToView = () => {
    if (dxfData) {
      const bounds = calculateBounds(dxfData.entities);
      if (bounds) {
        const autoScale = calculateScale(bounds, 900, 400);
        const autoOffset = calculateOffset(bounds, 900, 400, autoScale);
        setScale(autoScale);
        setOffset(autoOffset);
        renderDXF(dxfData, autoScale, autoOffset);
      }
    }
  };

  /**
   * 구역 그리기 완료 콜백
   * AreaDrawing에서 호출됨
   */
  const handleAreaComplete = (coordinates) => {
    console.log('CADDisplay: 구역 그리기 완료됨', coordinates);
    
    // 완성된 구역을 상태에 추가
    setCompletedAreas(prev => {
      const updated = [...prev, coordinates];
      console.log('완성된 구역 업데이트:', updated.length, '개');
      return updated;
    });
    
    // AreaManager에게 새 구역 추가 요청
    if (areaManagerRef.current) {
      areaManagerRef.current.addArea(coordinates);
    }
    
    // 구역 완성 후 펜 모드 비활성화 (선택사항)
    // setIsPenMode(false);
  };

  /**
   * 구역 변경 콜백
   * AreaManager에서 호출됨 (구역 삭제 등)
   */
  const handleAreasChange = (areas) => {
    console.log('CADDisplay: 구역 데이터 변경됨', areas.length, '개');
    
    // AreaManager의 구역 데이터로 completedAreas 동기화
    const coordinates = areas.map(area => area.coordinates);
    setCompletedAreas(coordinates);
  };

  // ==================== 초기화 ====================
  useEffect(() => {
    if (cadFilePath) loadFile(cadFilePath);
  }, [cadFilePath]);

  // ==================== 컴포넌트 렌더링 ====================
  return (
    <div className="cad-display-panel">
      <div className="panel-header">CAD 도면 표시 영역</div>
      <div className="cad-content">
        {/* 툴바 */}
        <div className="cad-toolbar">
          <button 
            className={`tool-button pen-mode ${isPenMode ? 'active' : ''}`}
            onClick={handlePenMode}
            title="구역 그리기 모드"
          >
            🖊️
          </button>
          <button 
            className={`tool-button eraser-button ${isDeleteMode ? 'active' : ''}`}
            onClick={handleEraser}
            title="구역 삭제 모드"
          >
            🧽
          </button>
          <button 
            className="tool-button magnifier" 
            onClick={handleFitToView}
            title="전체 보기"
          >
          </button>
        </div>

        {/* 메인 캔버스 영역 */}
        <div className="cad-canvas" style={{ position: "relative" }}>
          <canvas
            ref={canvasRef}
            style={{ 
              width: "100%", 
              height: "100%", 
              display: "block",
              cursor: isPenMode ? 'crosshair' : (isDeleteMode ? 'pointer' : 'default')
            }}
          />

          {/* 구역 그리기 컴포넌트 */}
          <AreaDrawing
            canvasRef={canvasRef}
            isPenMode={isPenMode}
            dxfData={dxfData}
            scale={scale}
            offset={offset}
            onAreaComplete={handleAreaComplete}
            completedAreas={completedAreas} // 🎯 완성된 구역들 전달
          />

          {/* 구역 관리 컴포넌트 */}
          <AreaManager
            ref={areaManagerRef}
            canvasRef={canvasRef}
            modelId={currentModelId}
            scale={scale}
            offset={offset}
            onAreasChange={handleAreasChange}
            isDeleteMode={isDeleteMode}
            isPenMode={isPenMode} 
          />

          {/* 로딩 표시 */}
          {loading && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(255,255,255,0.9)", padding: "10px", borderRadius: "5px"
            }}>
              🔄 CAD 파일 로딩 중...
            </div>
          )}

          {/* 에러 표시 */}
          {error && (
            <div style={{
              position: "absolute", top: "10px", left: "10px",
              background: "rgba(255,0,0,0.1)", color: "red",
              padding: "5px 10px", borderRadius: "5px", fontSize: "12px",
              maxWidth: "300px"
            }}>
              ❌ {error}
            </div>
          )}

          {/* 펜 모드 안내 */}
          {isPenMode && (
            <div style={{
              position: "absolute", top: "10px", right: "10px",
              background: "rgba(255,255,0,0.9)", color: "#333",
              padding: "8px 12px", borderRadius: "5px", fontSize: "13px",
              border: "2px solid #ff4444",
              fontWeight: "bold"
            }}>
              🖊️ 구역 그리기 모드 활성화
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CADDisplay;