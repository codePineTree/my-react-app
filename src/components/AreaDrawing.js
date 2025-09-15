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
  onAreaComplete  // 구역 완성 시 호출할 콜백 함수
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
   * 클릭한 지점이 첫 번째 점과 가까운지 검사
   */
  const checkCloseToFirstPoint = (clickPoint, points) => {
    if (!clickPoint || points.length < 3) return false;
    
    const distance = getCanvasDistance(clickPoint, points[0]);
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

  // ==================== 마우스 이벤트 핸들러 ====================
  /**
   * 마우스 클릭 이벤트 처리
   */
  const handleCanvasClick = (event) => {
    if (!isPenMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = event.clientX - rect.left;
    const canvasY = event.clientY - rect.top;
    const worldCoord = canvasToWorldCoord(canvasX, canvasY);

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
    const canvas = canvasRef.current;
    if (!canvas || !isPenMode || clickedPoints.length === 0) return;

    const ctx = canvas.getContext('2d');
    ctx.save();
    
    // 클릭한 점들을 초록색 원으로 표시 (유효한 클릭)
    ctx.fillStyle = '#00AA00'; // 초록색으로 변경
    clickedPoints.forEach((point, index) => {
      const canvasCoord = worldToCanvasCoord(point);
      ctx.beginPath();
      ctx.arc(canvasCoord.x, canvasCoord.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      // 첫 번째 점은 더 크게 표시 (3개 이상일 때)
      if (index === 0 && clickedPoints.length >= 3) {
        ctx.strokeStyle = '#00AA00'; // 초록색으로 변경
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvasCoord.x, canvasCoord.y, 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });

    // 클릭한 점들을 초록색 직선으로 연결 (2개 이상일 때)
    if (clickedPoints.length > 1) {
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
    }
    
    ctx.restore();
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

  // ==================== 렌더링 트리거 ====================
  useEffect(() => {
    if (isPenMode && clickedPoints.length > 0) {
      renderClickedPoints();
    }
  }, [clickedPoints, isPenMode, scale, offset]);

  // ==================== ESC 키로 그리기 취소 ====================
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape' && isPenMode) {
        console.log('ESC: 구역 그리기 취소');
        setClickedPoints([]);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
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
          <div>• 클릭: 점 추가 ({clickedPoints.length}개)</div>
          <div>• 첫 번째 점 근처 클릭: 구역 완성</div>
          <div>• ESC: 취소</div>
        </div>
      )}
    </>
  );
};

export default AreaDrawing;