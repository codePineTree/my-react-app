import React, { useEffect, useState } from "react";

/**
 * AreaDrawing 컴포넌트
 * 역할: 사용자가 도면 위에 정확한 점들을 클릭하여 구역을 그리는 기능
 * 
 * 주요 기능:
 * 1. 마우스 클릭으로 정확한 점들만 수집
 * 2. 클릭한 점들 사이를 직선으로 연결
 * 3. 마지막 점이 첫 번째 점 근처에 오면 구역 완성
 * 4. 실시간 미리보기 없이 클릭한 지점만 표시
 */
const AreaDrawing = ({ 
  canvasRef,      // Canvas DOM 요소 참조
  isPenMode,      // 펜 모드 활성화 여부
  dxfData,        // DXF 도면 데이터 (필요시 참조)
  scale,          // 현재 줌 배율
  offset,         // 현재 팬 오프셋
  onAreaComplete, // 구역 완성 시 호출할 콜백 함수
  completedAreas = [], // 이미 완성된 구역들 배열
  onRedrawCanvas  // Canvas 전체 다시 그리기 함수
}) => {
  
  // ==================== 상태 관리 ====================
  // 사용자가 클릭한 점들 배열
  const [clickedPoints, setClickedPoints] = useState([]);

  // 닫힌 구역 감지를 위한 허용 거리 (픽셀)
  const CLOSE_DISTANCE = 15;

  // ==================== 좌표 변환 함수 ====================
  /**
   * Canvas 화면 좌표를 DXF 월드 좌표로 변환
   */
  const canvasToWorldCoord = (canvasX, canvasY) => {
    return {
      x: (canvasX - offset.x) / scale,
      y: -((canvasY - offset.y) / scale) // DXF는 Y축이 반대
    };
  };

  /**
   * DXF 월드 좌표를 Canvas 화면 좌표로 변환
   */
  const worldToCanvasCoord = (worldCoord) => {
    return {
      x: worldCoord.x * scale + offset.x,
      y: -worldCoord.y * scale + offset.y // DXF Y축 반전
    };
  };

  // ==================== 구역 완성 검사 ====================
  /**
   * 두 점 사이의 거리 계산 (Canvas 좌표계에서)
   */
  const getCanvasDistance = (point1, point2) => {
    const canvas1 = worldToCanvasCoord(point1);
    const canvas2 = worldToCanvasCoord(point2);
    return Math.sqrt(
      Math.pow(canvas1.x - canvas2.x, 2) + Math.pow(canvas1.y - canvas2.y, 2)
    );
  };

  /**
   * 클릭한 지점이 첫 번째 점과 정확히 가까운지 검사 (더 엄격한 검사)
   */
  const checkCloseToFirstPoint = (clickPoint, points) => {
    if (!clickPoint || points.length < 3) return false;
    
    const distance = getCanvasDistance(clickPoint, points[0]);
    console.log(`첫 번째 점과의 거리: ${distance.toFixed(2)}px (기준: ${CLOSE_DISTANCE}px)`);
    return distance <= CLOSE_DISTANCE;
  };

  /**
   * 폴리곤 면적 계산 (Shoelace 공식)
   */
  const calculatePolygonArea = (points) => {
    if (points.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < points.length; i++) {
      const j = (i + 1) % points.length;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }
    return Math.abs(area / 2);
  };

  // ==================== 도형 내부/외부 검사 함수들 ====================
  /**
   * 점이 폴리곤 내부에 있는지 판단 (Ray Casting 알고리즘)
   */
  const isPointInPolygon = (point, polygon) => {
    if (polygon.length < 3) return false;
    
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      if (((polygon[i].y > point.y) !== (polygon[j].y > point.y)) &&
          (point.x < (polygon[j].x - polygon[i].x) * (point.y - polygon[i].y) / (polygon[j].y - polygon[i].y) + polygon[i].x)) {
        inside = !inside;
      }
    }
    return inside;
  };

  /**
   * 점이 원 내부에 있는지 판단
   */
  const isPointInCircle = (point, center, radius) => {
    const distance = Math.sqrt(
      Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
    );
    return distance <= radius;
  };

  /**
   * DXF 엔터티들로부터 닫힌 영역들 추출
   */
  const getClosedAreas = () => {
    if (!dxfData || !dxfData.entities) {
      console.log('❌ DXF 데이터가 없습니다.');
      return [];
    }
    
    console.log('🔍 DXF 엔터티 분석 시작...');
    console.log('📊 총 엔터티 수:', dxfData.entities.length);
    
    const closedAreas = [];
    
    dxfData.entities.forEach((entity, index) => {
      console.log(`엔터티 ${index}:`, entity.type, entity);
      
      switch (entity.type) {
        case "CIRCLE":
          if (entity.center && entity.radius) {
            console.log(`✅ 원 발견: 중심(${entity.center.x}, ${entity.center.y}), 반지름: ${entity.radius}`);
            closedAreas.push({
              type: 'circle',
              center: entity.center,
              radius: entity.radius
            });
          }
          break;
          
        case "ARC":
          if (entity.center && entity.radius) {
            // ARC의 시작각과 끝각 확인 (다양한 속성명 시도)
            const startAngle = entity.startAngle || entity.startAngle || entity['50'] || 0;
            const endAngle = entity.endAngle || entity.endAngle || entity['51'] || 360;
            
            console.log(`ARC 발견: 중심(${entity.center.x}, ${entity.center.y}), 반지름: ${entity.radius}, 각도: ${startAngle}~${endAngle}`);
            console.log(`ARC 엔터티 전체:`, entity);
            
            // 각도 차이 계산
            let angleDiff = Math.abs(endAngle - startAngle);
            let originalAngleDiff = angleDiff;
            
            // 라디안을 도로 변환 (2π ≈ 6.28은 360도)
            if (angleDiff > 7) { // 7 이상이면 라디안으로 판단
              angleDiff = angleDiff * (180 / Math.PI); // 라디안을 도로 변환
              console.log(`라디안을 도로 변환: ${originalAngleDiff.toFixed(4)} 라디안 → ${angleDiff.toFixed(2)}도`);
            } else if (angleDiff > 6 && angleDiff < 7) { // 6~7 사이는 2π 라디안 (360도)
              angleDiff = 360;
              console.log(`2π 라디안 감지: ${originalAngleDiff.toFixed(4)} → 360도로 처리`);
            }
            
            // 완전한 원인지 확인
            const isFullCircle = angleDiff >= 359 || angleDiff === 0 || 
                               (startAngle === 0 && endAngle >= 359) ||
                               Math.abs(angleDiff - 360) < 1 || // 359~361도 범위
                               (originalAngleDiff > 6.2 && originalAngleDiff < 6.3); // 2π 라디안 직접 체크
            
            console.log(`각도 차이: ${angleDiff.toFixed(2)}도 (원본: ${originalAngleDiff.toFixed(4)}), 완전한 원 여부: ${isFullCircle}`);
            
            if (isFullCircle) {
              console.log(`✅ 완전한 원형 ARC 추가`);
              closedAreas.push({
                type: 'circle',
                center: entity.center,
                radius: entity.radius
              });
            } else {
              console.log(`❌ 부분 호(Arc) - 닫힌 영역 아님 (${startAngle}°~${endAngle}°, 차이: ${angleDiff.toFixed(2)}°)`);
            }
          }
          break;
          
        case "POLYLINE":
        case "LWPOLYLINE":
          console.log(`폴리라인 발견: shape=${entity.shape}, vertices=${entity.vertices?.length}개`);
          if (entity.vertices && entity.vertices.length >= 3) {
            // 닫힌 폴리라인 검사: shape 속성 또는 첫/마지막 점이 같은 경우
            const isClosedByShape = entity.shape;
            const isClosedByVertices = entity.vertices.length > 3 && 
              Math.abs(entity.vertices[0].x - entity.vertices[entity.vertices.length - 1].x) < 0.01 &&
              Math.abs(entity.vertices[0].y - entity.vertices[entity.vertices.length - 1].y) < 0.01;
            
            if (isClosedByShape || isClosedByVertices) {
              // 마지막 중복 점 제거
              const vertices = isClosedByVertices ? 
                entity.vertices.slice(0, -1) : entity.vertices;
              console.log(`✅ 닫힌 폴리라인 추가 (shape: ${isClosedByShape}, vertices: ${isClosedByVertices}):`, vertices);
              closedAreas.push({
                type: 'polygon',
                vertices: vertices
              });
            } else {
              console.log(`❌ 열린 폴리라인`);
            }
          } else {
            console.log(`❌ 점이 부족함`);
          }
          break;
          
        default:
          console.log(`⚠️ 지원하지 않는 엔터티: ${entity.type}`);
      }
    });
    
    // 개별 LINE 엔터티들로 구성된 닫힌 영역 찾기 추가
    const lineEntities = dxfData.entities.filter(entity => entity.type === 'LINE');
    if (lineEntities.length >= 3) {
      console.log(`🔍 LINE 엔터티 ${lineEntities.length}개로 닫힌 영역 찾기 시도...`);
      const connectedPolygon = findConnectedPolygon(lineEntities);
      if (connectedPolygon) {
        console.log(`✅ 연결된 폴리곤 발견:`, connectedPolygon);
        closedAreas.push({
          type: 'polygon',
          vertices: connectedPolygon
        });
      }
    }
    
    console.log(`🎯 최종 닫힌 영역 수: ${closedAreas.length}개`);
    return closedAreas;
  };

  /**
   * 클릭한 점이 어떤 닫힌 영역 내부에 있는지 검사
   */
  const isClickInsideClosedArea = (clickPoint) => {
    console.log(`🖱️ 클릭 지점 검사: (${clickPoint.x.toFixed(2)}, ${clickPoint.y.toFixed(2)})`);
    
    // 1단계: 이미 완성된 구역들 내부인지 검사
    if (completedAreas && completedAreas.length > 0) {
      console.log(`🚫 완성된 구역 ${completedAreas.length}개 검사 중...`);
      for (let i = 0; i < completedAreas.length; i++) {
        const completedArea = completedAreas[i];
        if (isPointInPolygon(clickPoint, completedArea)) {
          console.log(`❌ 이미 완성된 구역 ${i} 내부입니다 - 클릭 거부`);
          return false;
        }
      }
      console.log(`✅ 완성된 구역들 외부 - 계속 검사`);
    }
    
    // 2단계: DXF 닫힌 영역 내부인지 검사
    const closedAreas = getClosedAreas();
    
    if (closedAreas.length === 0) {
      console.log('❌ 닫힌 영역이 없어서 모든 클릭 거부');
      return false; // 닫힌 영역이 없으면 모든 클릭 거부
    }
    
    for (let i = 0; i < closedAreas.length; i++) {
      const area = closedAreas[i];
      console.log(`영역 ${i} 검사 (${area.type}):`, area);
      
      if (area.type === 'circle') {
        const isInside = isPointInCircle(clickPoint, area.center, area.radius);
        console.log(`원 내부 검사 결과: ${isInside}`);
        if (isInside) {
          console.log('✅ 원 내부에 있음 - 클릭 허용');
          return true;
        }
      } else if (area.type === 'polygon') {
        const isInside = isPointInPolygon(clickPoint, area.vertices);
        console.log(`폴리곤 내부 검사 결과: ${isInside}`);
        if (isInside) {
          console.log('✅ 폴리곤 내부에 있음 - 클릭 허용');
          return true;
        }
      }
    }
    
    console.log('❌ 모든 닫힌 영역 외부 - 클릭 거부');
    return false;
  };

  /**
   * 개별 LINE 엔터티들이 연결되어 닫힌 폴리곤을 형성하는지 검사
   */
  const findConnectedPolygon = (lineEntities) => {
    console.log('LINE 엔터티들로 닫힌 영역 찾기 시작...');
    
    if (lineEntities.length < 3) return null;
    
    // 각 LINE의 시작점과 끝점 추출
    const lines = lineEntities.map(entity => ({
      start: entity.vertices[0],
      end: entity.vertices[1]
    }));
    
    console.log('LINE 데이터:', lines);
    
    // 간단한 연결성 검사 (실제로는 더 복잡한 알고리즘 필요)
    // 여기서는 모든 점들을 모아서 중복 제거하여 폴리곤 형성 시도
    const allPoints = [];
    lines.forEach(line => {
      allPoints.push(line.start, line.end);
    });
    
    // 중복 점 제거
    const uniquePoints = [];
    const tolerance = 0.01;
    
    allPoints.forEach(point => {
      const isDuplicate = uniquePoints.some(existing => 
        Math.abs(existing.x - point.x) < tolerance && 
        Math.abs(existing.y - point.y) < tolerance
      );
      
      if (!isDuplicate) {
        uniquePoints.push(point);
      }
    });
    
    console.log('고유 점들:', uniquePoints);
    
    // 3개 이상의 고유 점이 있고, 각 점이 정확히 2번씩 사용되면 닫힌 폴리곤
    if (uniquePoints.length >= 3) {
      return uniquePoints;
    }
    
    return null;
  };

  // ==================== Canvas 완전 지우기 함수 ====================
  /**
   * Canvas를 완전히 지우고 DXF 데이터만 다시 그리는 함수
   */
  const clearAndRedrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('🧹 Canvas 완전 지우기 시작');
    const ctx = canvas.getContext('2d');
    
    // Canvas 전체 지우기
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    console.log('✅ Canvas 지우기 완료');
    
    // DXF 데이터 다시 그리기
    if (onRedrawCanvas) {
      console.log('🔄 DXF 데이터 다시 그리기 시작');
      onRedrawCanvas();
      console.log('✅ DXF 데이터 다시 그리기 완료');
    }
  };

  // ==================== 마우스 이벤트 핸들러 ====================
  /**
   * 마우스 클릭 이벤트 처리
   */
  const handleCanvasClick = (event) => {
    console.log('🖱️ 클릭 이벤트 시작');
    
    if (!isPenMode) {
      console.log('❌ 펜 모드가 아님 - 클릭 무시');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('❌ Canvas가 없음');
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const worldCoord = canvasToWorldCoord(canvasX, canvasY);

    console.log(`🖱️ 클릭 이벤트: Canvas(${canvasX}, ${canvasY}) -> World(${worldCoord.x.toFixed(2)}, ${worldCoord.y.toFixed(2)})`);

    // 클릭한 지점이 닫힌 영역 내부에 있는지 검사
    let isInsideValid = false;
    try {
      console.log('🔍 유효성 검사 시작...');
      isInsideValid = isClickInsideClosedArea(worldCoord);
      console.log(`🎯 클릭 유효성 검사 결과: ${isInsideValid}`);
    } catch (error) {
      console.error('❌ 유효성 검사 중 에러 발생:', error);
      isInsideValid = false;
    }
    
    if (!isInsideValid) {
      console.log('❌ 클릭 지점이 유효한 영역 외부입니다. 클릭 무시.');
      return;
    }

    console.log('✅ 유효한 영역 내부 클릭 - 점 추가 진행');

    // 첫 번째 점 근처를 클릭했고, 이미 3개 이상의 점이 있으면 구역 완성
    if (clickedPoints.length >= 3 && checkCloseToFirstPoint(worldCoord, clickedPoints)) {
      console.log('구역 완성: 첫 번째 점과 정확히 연결됨');
      completeArea();
      return;
    }

    // 새로운 점 추가 (첫 번째 점 근처가 아닌 경우에만)
    const newPoints = [...clickedPoints, worldCoord];
    setClickedPoints(newPoints);
    
    console.log(`점 추가: (${worldCoord.x.toFixed(2)}, ${worldCoord.y.toFixed(2)}) - 총 ${newPoints.length}개`);
  };

  /**
   * 구역 완성 처리
   */
  const completeArea = () => {
    if (clickedPoints.length < 3) return;

    // 면적이 있는 유효한 폴리곤인지 검사
    const area = calculatePolygonArea(clickedPoints);
    if (area <= 0) {
      console.log('유효하지 않은 구역: 면적이 0');
      return;
    }

    console.log(`구역 완성: ${clickedPoints.length}개 점, 면적: ${area.toFixed(2)}`);
    
    // 부모 컴포넌트에 완성된 구역 전달
    onAreaComplete([...clickedPoints]);
    
    // 상태 초기화
    setClickedPoints([]);
  };

  // ==================== 렌더링 함수 ====================
  /**
   * 클릭한 점들과 연결선만 Canvas에 렌더링
   */
  const renderClickedPoints = () => {
    console.log('🎨 renderClickedPoints 호출 - 점 개수:', clickedPoints.length);
    const canvas = canvasRef.current;
    if (!canvas || !isPenMode || clickedPoints.length === 0) {
      console.log('❌ renderClickedPoints 중단 - canvas:', !!canvas, 'isPenMode:', isPenMode, 'points:', clickedPoints.length);
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    
    console.log('🟢 점들을 초록색 원으로 그리기 시작');
    // 클릭한 점들을 초록색 원으로 표시 (유효한 클릭)
    ctx.fillStyle = '#00AA00'; // 초록색으로 변경
    clickedPoints.forEach((point, index) => {
      const canvasCoord = worldToCanvasCoord(point);
      ctx.beginPath();
      ctx.arc(canvasCoord.x, canvasCoord.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      console.log(`점 ${index} 그리기 완료: (${canvasCoord.x.toFixed(1)}, ${canvasCoord.y.toFixed(1)})`);
      
      // 첫 번째 점은 더 크게 표시 (3개 이상일 때)
      if (index === 0 && clickedPoints.length >= 3) {
        ctx.strokeStyle = '#00AA00'; // 초록색으로 변경
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvasCoord.x, canvasCoord.y, 8, 0, 2 * Math.PI);
        ctx.stroke();
        console.log('첫 번째 점 강조 표시 완료');
      }
    });

    // 클릭한 점들을 초록색 직선으로 연결 (2개 이상일 때)
    if (clickedPoints.length > 1) {
      console.log('🔗 점들을 선으로 연결 시작');
      ctx.strokeStyle = '#00AA00'; // 초록색으로 변경
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // 점선
      ctx.beginPath();
      
      clickedPoints.forEach((point, index) => {
        const canvasCoord = worldToCanvasCoord(point);
        if (index === 0) {
          ctx.moveTo(canvasCoord.x, canvasCoord.y);
        } else {
          ctx.lineTo(canvasCoord.x, canvasCoord.y);
        }
      });
      
      ctx.stroke();
      ctx.setLineDash([]); // 점선 해제
      console.log('✅ 점들 연결 완료');
    }
    
    ctx.restore();
    console.log('✅ renderClickedPoints 완료');
  };

  // ==================== 이벤트 리스너 등록 ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [isPenMode, clickedPoints, scale, offset]);

  // ==================== 렌더링 트리거 개선 ====================
  useEffect(() => {
    console.log('🔄 렌더링 트리거 - isPenMode:', isPenMode, 'clickedPoints.length:', clickedPoints.length);
    // 펜 모드일 때만 점들을 렌더링
    if (isPenMode) {
      // 약간의 딜레이를 주어 상태 변경이 완전히 적용된 후 렌더링
      const timeoutId = setTimeout(() => {
        console.log('⏱️ 딜레이 후 renderClickedPoints 호출');
        renderClickedPoints();
      }, 10);
      
      return () => {
        console.log('🧹 렌더링 타이머 클리어');
        clearTimeout(timeoutId);
      };
    }
  }, [clickedPoints, isPenMode, scale, offset]);

  // ==================== ESC 키로 마지막 점 되돌리기 (수정됨) ====================
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape' && isPenMode) {
        if (clickedPoints.length > 0) {
          console.log('🔍 ESC 키 눌림 - 마지막 점 제거 시작');
          console.log('현재 점 개수:', clickedPoints.length);
          
          // 마지막 점 하나만 제거
          const newPoints = clickedPoints.slice(0, -1);
          setClickedPoints(newPoints);
          console.log(`ESC: 마지막 점 제거 (${clickedPoints.length} -> ${newPoints.length}개)`);
          
          // Canvas 완전히 지우고 DXF만 다시 그리기
          console.log('🧹 Canvas 완전 지우기 및 DXF 재그리기 시작');
          clearAndRedrawCanvas();
          
          // 남은 점들이 있으면 잠깐 후 다시 그리기
          if (newPoints.length > 0) {
            setTimeout(() => {
              console.log('⏱️ 남은 점들 다시 그리기');
              // 상태가 업데이트된 후 renderClickedPoints가 자동으로 호출됨
            }, 50);
          }
          
          console.log('✅ ESC 처리 완료');
        } else {
          console.log('ESC: 제거할 점이 없습니다.');
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPenMode, clickedPoints, onRedrawCanvas]);

  // ==================== 펜 모드 해제 시 점들 초기화 ====================
  useEffect(() => {
    if (!isPenMode && clickedPoints.length > 0) {
      console.log('펜 모드 해제 - 클릭된 점들 초기화');
      setClickedPoints([]);
    }
  }, [isPenMode]);

  // ==================== 사용법 안내 UI ====================
  return (
    <>
      {isPenMode && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px',
          borderRadius: '5px',
          fontSize: '12px',
          zIndex: 1000,
          border: '1px solid #ccc'
        }}>
          <div><strong>구역 그리기 모드</strong></div>
          <div>• 닫힌 도형 내부만 클릭 가능</div>
          <div>• 완성된 구역({completedAreas?.length || 0}개) 내부는 클릭 불가</div>
          <div>• 클릭: 점 추가 ({clickedPoints.length}개)</div>
          <div>• 첫 번째 점 근처 클릭: 구역 완성</div>
          <div>• ESC: 마지막 점 되돌리기</div>
          {!onRedrawCanvas && (
            <div style={{color: 'orange', fontSize: '10px', marginTop: '5px'}}>
              ⚠️ onRedrawCanvas 함수 없음 - ESC 시 화면 깨질 수 있음
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AreaDrawing;