import React, { useEffect, useState, forwardRef, useImperativeHandle } from "react";

const AreaDrawing = forwardRef(({ 
  canvasRef,
  isPenMode,
  dxfData,
  scale,
  offset,
  onAreaComplete,
  completedAreas = [],
  onRedrawCanvas
}, ref) => {
  
  const [clickedPoints, setClickedPoints] = useState([]);
  const [pointsOnBoundary, setPointsOnBoundary] = useState([]);
  const CLOSE_DISTANCE = 15;
  const BOUNDARY_THRESHOLD = 10; // 외곽선 판정 거리 (픽셀)

  useImperativeHandle(ref, () => ({
    hasIncompleteArea: () => {
      return clickedPoints.length > 0;
    },
    
    getClickedPointsCount: () => {
      return clickedPoints.length;
    },
    
    clearClickedPoints: () => {
      setClickedPoints([]);
      setPointsOnBoundary([]);
    }
  }));

  const canvasToWorldCoord = (canvasX, canvasY) => {
    return {
      x: (canvasX - offset.x) / scale,
      y: -((canvasY - offset.y) / scale)
    };
  };

  const worldToCanvasCoord = (worldCoord) => {
    return {
      x: worldCoord.x * scale + offset.x,
      y: -worldCoord.y * scale + offset.y
    };
  };

  const getCanvasDistance = (point1, point2) => {
    const canvas1 = worldToCanvasCoord(point1);
    const canvas2 = worldToCanvasCoord(point2);
    return Math.sqrt(
      Math.pow(canvas1.x - canvas2.x, 2) + Math.pow(canvas1.y - canvas2.y, 2)
    );
  };

  const checkCloseToFirstPoint = (clickPoint, points) => {
    if (!clickPoint || points.length < 3) return false;
    
    const distance = getCanvasDistance(clickPoint, points[0]);
    console.log(`첫 번째 점과의 거리: ${distance.toFixed(2)}px (기준: ${CLOSE_DISTANCE}px)`);
    return distance <= CLOSE_DISTANCE;
  };

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

  const isPointInCircle = (point, center, radius) => {
    const distance = Math.sqrt(
      Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
    );
    return distance <= radius;
  };

  // 점-선분 거리 계산
  const pointToSegmentDistance = (point, segStart, segEnd) => {
    const A = point.x - segStart.x;
    const B = point.y - segStart.y;
    const C = segEnd.x - segStart.x;
    const D = segEnd.y - segStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) param = dot / lenSq;

    let xx, yy;

    if (param < 0) {
      xx = segStart.x;
      yy = segStart.y;
    } else if (param > 1) {
      xx = segEnd.x;
      yy = segEnd.y;
    } else {
      xx = segStart.x + param * C;
      yy = segStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // 점이 외곽선 위에 있는지 확인 (캔버스 좌표 기준)
  const isPointOnBoundary = (worldPoint) => {
    const closedAreas = getClosedAreas();
    
    for (const area of closedAreas) {
      if (area.type === 'polygon') {
        const vertices = area.vertices;
        
        for (let i = 0; i < vertices.length; i++) {
          const start = vertices[i];
          const end = vertices[(i + 1) % vertices.length];
          
          const distance = pointToSegmentDistance(worldPoint, start, end);
          const canvasDistance = distance * scale; // 월드 좌표를 캔버스 거리로 변환
          
          if (canvasDistance <= BOUNDARY_THRESHOLD) {
            console.log(`✅ 외곽선 위 점 감지: 거리 ${canvasDistance.toFixed(2)}px`);
            return true;
          }
        }
      }
      // 원의 경우 외곽선 체크
      else if (area.type === 'circle') {
        const distance = Math.sqrt(
          Math.pow(worldPoint.x - area.center.x, 2) + 
          Math.pow(worldPoint.y - area.center.y, 2)
        );
        const radiusDiff = Math.abs(distance - area.radius);
        const canvasRadiusDiff = radiusDiff * scale;
        
        if (canvasRadiusDiff <= BOUNDARY_THRESHOLD) {
          console.log(`✅ 원 외곽선 위 점 감지: 거리 ${canvasRadiusDiff.toFixed(2)}px`);
          return true;
        }
      }
    }
    
    return false;
  };

  const getClosedAreas = () => {
    if (!dxfData || !dxfData.entities) {
      console.log('❌ CAD 데이터가 없습니다.');
      return [];
    }
    
    console.log('🔍 CAD 엔터티 분석 시작...');
    console.log('📊 총 엔터티 수:', dxfData.entities.length);
    
    const closedAreas = [];
    
    dxfData.entities.forEach((entity, index) => {
      console.log(`엔터티 ${index}:`, entity.type, entity);
      
      const type = entity.type;
      
      // DWF Ellipse (원/타원)
      if (type === "DwfWhipOutlineEllipse" || type === "DwfWhipFilledEllipse") {
        if (entity.centerX !== undefined && entity.majorRadius) {
          console.log(`✅ DWF 타원 발견: 중심(${entity.centerX}, ${entity.centerY}), 반지름: ${entity.majorRadius}`);
          closedAreas.push({
            type: 'circle',
            center: { x: entity.centerX, y: entity.centerY },
            radius: entity.majorRadius
          });
        }
      }
      
      // DWF Polygon
      else if (type === "DwfWhipPolygon" && entity.points?.length >= 3) {
        console.log(`✅ DWF 닫힌 폴리곤 발견: ${entity.points.length}개 점`);
        closedAreas.push({
          type: 'polygon',
          vertices: entity.points
        });
      }
      
      // DWF Polyline
      else if (type === "DwfWhipPolyline" && entity.points?.length >= 3) {
        const points = entity.points;
        
        // 첫/마지막 점이 거의 같으면 중복으로 판단
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        const isDuplicate = Math.abs(firstPoint.x - lastPoint.x) < 0.01 &&
                            Math.abs(firstPoint.y - lastPoint.y) < 0.01;
        
        if (isDuplicate && points.length > 3) {
          // 마지막 중복 점 제거
          const vertices = points.slice(0, -1);
          console.log(`✅ DWF 닫힌 폴리라인 발견: ${vertices.length}개 점 (중복 제거됨)`);
          closedAreas.push({
            type: 'polygon',
            vertices: vertices
          });
        } else if (points.length >= 3) {
          // 중복 없는 닫힌 폴리라인
          console.log(`✅ DWF 닫힌 폴리라인 발견: ${points.length}개 점`);
          closedAreas.push({
            type: 'polygon',
            vertices: points
          });
        }
      }
      
      // DXF Circle
      else if (type === "CadCircle" && entity.centerX !== undefined) {
        console.log(`✅ DXF 원 발견: 중심(${entity.centerX}, ${entity.centerY}), 반지름: ${entity.radius}`);
        closedAreas.push({
          type: 'circle',
          center: { x: entity.centerX, y: entity.centerY },
          radius: entity.radius
        });
      }
      
      // DXF Arc (완전한 원만)
      else if (type === "CadArc" && entity.centerX !== undefined) {
        const startAngle = entity.startAngle || 0;
        const endAngle = entity.endAngle || 360;
        
        let angleDiff = Math.abs(endAngle - startAngle);
        if (angleDiff > 7) {
          angleDiff = angleDiff * (180 / Math.PI);
        }
        
        const isFullCircle = angleDiff >= 359 || angleDiff === 0 || Math.abs(angleDiff - 360) < 1;
        
        if (isFullCircle) {
          console.log(`✅ DXF 완전한 원형 ARC 추가`);
          closedAreas.push({
            type: 'circle',
            center: { x: entity.centerX, y: entity.centerY },
            radius: entity.radius
          });
        }
      }
      
      // DXF Polyline (vertices 사용)
      else if ((type === "POLYLINE" || type === "LWPOLYLINE") && entity.vertices?.length >= 3) {
        const isClosedByShape = entity.shape;
        const isClosedByVertices = entity.vertices.length > 3 && 
          Math.abs(entity.vertices[0].x - entity.vertices[entity.vertices.length - 1].x) < 0.01 &&
          Math.abs(entity.vertices[0].y - entity.vertices[entity.vertices.length - 1].y) < 0.01;
        
        if (isClosedByShape || isClosedByVertices) {
          const vertices = isClosedByVertices ? entity.vertices.slice(0, -1) : entity.vertices;
          console.log(`✅ DXF 닫힌 폴리라인 추가`);
          closedAreas.push({
            type: 'polygon',
            vertices: vertices
          });
        }
      }
      
      // DXF LWPolyline (points 사용)
      else if (type === "CadLwPolyline" && entity.points?.length >= 3) {
        const points = entity.points;
        const isClosedByFlag = entity.closed;
        const isClosedByPoints = points.length > 3 && 
          Math.abs(points[0].x - points[points.length - 1].x) < 0.01 &&
          Math.abs(points[0].y - points[points.length - 1].y) < 0.01;
        
        if (isClosedByFlag || isClosedByPoints) {
          const vertices = isClosedByPoints ? points.slice(0, -1) : points;
          console.log(`✅ DXF 닫힌 LWPolyline 추가`);
          closedAreas.push({
            type: 'polygon',
            vertices: vertices
          });
        }
      }
    });
    
    console.log(`🎯 최종 닫힌 영역 수: ${closedAreas.length}개`);
    return closedAreas;
  };

  const isClickInsideClosedArea = (clickPoint) => {
    console.log(`🖱️ 클릭 지점 검사: (${clickPoint.x.toFixed(2)}, ${clickPoint.y.toFixed(2)})`);
    
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
    
    const closedAreas = getClosedAreas();
    
    if (closedAreas.length === 0) {
      console.log('❌ 닫힌 영역이 없어서 모든 클릭 거부');
      return false;
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

  const clearAndRedrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('🧹 Canvas 완전 지우기 시작');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    console.log('✅ Canvas 지우기 완료');
    
    if (onRedrawCanvas) {
      console.log('🔄 CAD 데이터 다시 그리기 시작');
      onRedrawCanvas();
      console.log('✅ CAD 데이터 다시 그리기 완료');
    }
  };

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

    if (clickedPoints.length >= 3 && checkCloseToFirstPoint(worldCoord, clickedPoints)) {
      console.log('구역 완성: 첫 번째 점과 정확히 연결됨');
      completeArea();
      return;
    }

    const newPoints = [...clickedPoints, worldCoord];
    const isOnBoundary = isPointOnBoundary(worldCoord);
    const newBoundaryFlags = [...pointsOnBoundary, isOnBoundary];
    
    console.log(`점 추가: (${worldCoord.x.toFixed(2)}, ${worldCoord.y.toFixed(2)}) - 총 ${newPoints.length}개, 외곽선 위: ${isOnBoundary}`);
    
    // 외곽선 위 점이 2개 이상이면 자동 완성
    const boundaryCount = newBoundaryFlags.filter(flag => flag).length;
    if (boundaryCount >= 2 && newPoints.length >= 3) {
      console.log(`🎯 외곽선 위 점 ${boundaryCount}개 감지 - 바로 자동 완성!`);
      
      // 바로 완성
      const area = calculatePolygonArea(newPoints);
      if (area > 0) {
        onAreaComplete(newPoints);
        setClickedPoints([]);
        setPointsOnBoundary([]);
        return;  // 여기서 종료
      }
    }

    // 일반 점 추가
    setClickedPoints(newPoints);
    setPointsOnBoundary(newBoundaryFlags);
  };

  const completeArea = () => {
    if (clickedPoints.length < 3) return;

    const area = calculatePolygonArea(clickedPoints);
    if (area <= 0) {
      console.log('유효하지 않은 구역: 면적이 0');
      return;
    }

    console.log(`구역 완성: ${clickedPoints.length}개 점, 면적: ${area.toFixed(2)}`);
    
    onAreaComplete([...clickedPoints]);
    setClickedPoints([]);
    setPointsOnBoundary([]);
  };

  const renderClickedPoints = () => {
    console.log('🎨 renderClickedPoints 호출 - 점 개수:', clickedPoints.length);
    const canvas = canvasRef.current;
    if (!canvas || !isPenMode || clickedPoints.length === 0) {
      console.log('❌ renderClickedPoints 중단');
      return;
    }

    const ctx = canvas.getContext('2d');
    ctx.save();
    
    console.log('🟢 점들을 초록색 원으로 그리기 시작');
    clickedPoints.forEach((point, index) => {
      const canvasCoord = worldToCanvasCoord(point);
      const isOnBoundary = pointsOnBoundary[index];
      
      // 외곽선 위 점은 파란색, 일반 점은 초록색
      ctx.fillStyle = isOnBoundary ? '#0066FF' : '#00AA00';
      ctx.beginPath();
      ctx.arc(canvasCoord.x, canvasCoord.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      
      if (index === 0 && clickedPoints.length >= 3) {
        ctx.strokeStyle = isOnBoundary ? '#0066FF' : '#00AA00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(canvasCoord.x, canvasCoord.y, 8, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });

    if (clickedPoints.length > 1) {
      console.log('🔗 점들을 선으로 연결 시작');
      ctx.strokeStyle = '#00AA00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
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
      ctx.setLineDash([]);
    }
    
    ctx.restore();
    console.log('✅ renderClickedPoints 완료');
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.addEventListener('click', handleCanvasClick);

    return () => {
      canvas.removeEventListener('click', handleCanvasClick);
    };
  }, [isPenMode, clickedPoints, scale, offset]);

  useEffect(() => {
    console.log('🔄 렌더링 트리거 - isPenMode:', isPenMode, 'clickedPoints.length:', clickedPoints.length);
    if (isPenMode) {
      console.log('⏱️ renderClickedPoints 호출');
      renderClickedPoints();
    }
  }, [clickedPoints, isPenMode, scale, offset]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === 'Escape' && isPenMode) {
        if (clickedPoints.length > 0) {
          console.log('🔍 ESC 키 눌림 - 마지막 점 제거 시작');
          
          const newPoints = clickedPoints.slice(0, -1);
          const newBoundaryFlags = pointsOnBoundary.slice(0, -1);
          setClickedPoints(newPoints);
          setPointsOnBoundary(newBoundaryFlags);
          console.log(`ESC: 마지막 점 제거`);
          
          console.log('🧹 Canvas 완전 지우기 및 재그리기');
          clearAndRedrawCanvas();
          
          if (newPoints.length > 0) {
            setTimeout(() => {
              console.log('⏱️ 남은 점들 다시 그리기');
            }, 50);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isPenMode, clickedPoints, onRedrawCanvas]);

  useEffect(() => {
    if (!isPenMode && clickedPoints.length > 0) {
      console.log('펜 모드 해제 - 클릭된 점들 초기화');
      setClickedPoints([]);
      setPointsOnBoundary([]);
    }
  }, [isPenMode]);

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
          <div>• 외곽선 위 점 2개 이상: 자동 완성 (파란색)</div>
          <div>• 첫 번째 점 근처 클릭: 구역 완성</div>
          <div>• ESC: 마지막 점 되돌리기</div>
        </div>
      )}
    </>
  );
});

export default AreaDrawing;