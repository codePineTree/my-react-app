// src/components/TestCadViewer.js
import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import DxfParser from "dxf-parser";

const TestCadViewer = ({ dxfUrl }) => {
  const mountRef = useRef(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth || 800;
    const height = mountRef.current.clientHeight || 600;
    const safe = (v) => (v !== undefined && !isNaN(v) ? v : 0);

    // Scene & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf5f5f5);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // Light
    scene.add(new THREE.AmbientLight(0xffffff, 1.0));

    // ===== 카메라 초기 설정 (나중에 동적 조정) =====
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 10000);
    // 초기 위치는 임시로 설정, 나중에 바운딩 박스에 맞춰 조정됨
    camera.position.set(0, 0, 100);

    const group = new THREE.Group();
    scene.add(group);

    // ===== 동적 카메라 조정 함수 =====
    function fitCameraToObject(camera, object, fitRatio = 1.2) {
      const box = new THREE.Box3().setFromObject(object);
      
      if (box.isEmpty()) {
        console.log("빈 바운딩 박스 - 기본 카메라 위치 사용");
        camera.position.set(0, 0, 100);
        camera.lookAt(0, 0, 0);
        return;
      }

      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      
      // 가장 큰 차원을 기준으로 카메라 거리 계산
      const maxDim = Math.max(size.x, size.y);
      const fov = camera.fov * (Math.PI / 180);
      let cameraDistance = Math.abs(maxDim / Math.sin(fov / 2)) * fitRatio;
      
      // 최소/최대 거리 제한
      cameraDistance = Math.max(cameraDistance, maxDim * 2);
      cameraDistance = Math.min(cameraDistance, maxDim * 10);

      // 카메라를 오브젝트 중심에서 적절한 거리에 배치
      camera.position.set(
        center.x + cameraDistance * 0.5,
        center.y + cameraDistance * 0.5, 
        center.z + cameraDistance
      );
      camera.lookAt(center);
      camera.updateProjectionMatrix();

      console.log("===== 동적 카메라 조정 =====");
      console.log("DXF 바운딩 박스 크기:", size);
      console.log("DXF 바운딩 박스 중심:", center);
      console.log("계산된 카메라 거리:", cameraDistance);
      console.log("조정된 카메라 위치:", camera.position);
      console.log("===============================");
    }

    // ===== 디버깅용 함수 =====
    function checkCameraView(camera, group) {
      const box = new THREE.Box3().setFromObject(group);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      console.log("===== 상세 디버깅 정보 =====");
      console.log("총 렌더링된 선분 수:", group.children.length);
      console.log("Bounding Box Min:", box.min);
      console.log("Bounding Box Max:", box.max);
      console.log("Bounding Box Size:", size);
      console.log("Bounding Box Center:", center);

      // 각 엔티티의 좌표 출력
      group.children.forEach((line, index) => {
        const pos = line.geometry.attributes.position.array;
        console.log(`Line ${index}:`, [pos[0], pos[1], pos[2]], "to", [pos[3], pos[4], pos[5]]);
      });
      console.log("===============================");
    }

    // DXF Load & Parse
    fetch(dxfUrl)
      .then((res) => res.text())
      .then((text) => {
        console.log("DXF 파일 로드 성공");
        console.log("DXF 원본 텍스트 첫 200자:", text.substring(0, 200));
        
        const parser = new DxfParser();
        const dxf = parser.parseSync(text);

        console.log("파싱된 DXF 객체:", dxf);
        console.log("총 엔티티 수:", dxf.entities.length);

        dxf.entities.forEach((entity, idx) => {
          let points = [];
          let color = 0x000000;

          console.log(`엔티티 ${idx} (${entity.type}):`, entity);

          switch (entity.type) {
            case "LINE":
              // dxf-parser에서는 LINE도 vertices 배열을 사용합니다
              if (entity.vertices && entity.vertices.length >= 2) {
                const v1 = entity.vertices[0];
                const v2 = entity.vertices[1];
                const x1 = safe(v1.x);
                const y1 = safe(v1.y);
                const z1 = safe(v1.z);
                const x2 = safe(v2.x);
                const y2 = safe(v2.y);
                const z2 = safe(v2.z);

                points.push(
                  new THREE.Vector3(x1, y1, z1),
                  new THREE.Vector3(x2, y2, z2)
                );
                color = 0xff0000; // 빨간색
                console.log(`LINE ${idx} 좌표: (${x1},${y1},${z1}) -> (${x2},${y2},${z2})`);
              } else {
                console.log(`LINE ${idx}: vertices 배열이 없거나 부족함`, entity);
              }
              break;

            case "LWPOLYLINE":
            case "POLYLINE":
              if (!entity.vertices || entity.vertices.length < 2) {
                console.log(`POLYLINE ${idx}: vertices가 없거나 부족함`);
                break;
              }
              for (let i = 0; i < entity.vertices.length - 1; i++) {
                points.push(
                  new THREE.Vector3(safe(entity.vertices[i].x), safe(entity.vertices[i].y), safe(entity.vertices[i].z)),
                  new THREE.Vector3(safe(entity.vertices[i + 1].x), safe(entity.vertices[i + 1].y), safe(entity.vertices[i + 1].z))
                );
              }
              color = 0x00ff00; // 초록색
              break;

            case "CIRCLE":
              const segments = 64;
              // dxf-parser에서 CIRCLE은 center 객체를 사용합니다
              const centerX = safe(entity.center ? entity.center.x : entity.cx);
              const centerY = safe(entity.center ? entity.center.y : entity.cy);
              const centerZ = safe(entity.center ? entity.center.z : entity.cz);
              const radius = safe(entity.radius);

              console.log(`CIRCLE ${idx} 중심: (${centerX},${centerY},${centerZ}), 반지름: ${radius}`);

              for (let i = 0; i < segments; i++) {
                const theta1 = (i / segments) * Math.PI * 2;
                const theta2 = ((i + 1) / segments) * Math.PI * 2;
                const x1 = centerX + radius * Math.cos(theta1);
                const y1 = centerY + radius * Math.sin(theta1);
                const x2 = centerX + radius * Math.cos(theta2);
                const y2 = centerY + radius * Math.sin(theta2);
                points.push(
                  new THREE.Vector3(x1, y1, centerZ),
                  new THREE.Vector3(x2, y2, centerZ)
                );
              }
              color = 0x0000ff; // 파란색
              break;

            case "ARC":
              const arcSegments = 32;
              const startAngle = (safe(entity.startAngle) * Math.PI) / 180;
              const endAngle = (safe(entity.endAngle) * Math.PI) / 180;
              const arcCenterX = safe(entity.cx);
              const arcCenterY = safe(entity.cy);
              const arcCenterZ = safe(entity.cz);
              const arcRadius = safe(entity.radius);

              console.log(`ARC ${idx} 중심: (${arcCenterX},${arcCenterY}), 반지름: ${arcRadius}, 각도: ${entity.startAngle}° ~ ${entity.endAngle}°`);

              for (let i = 0; i < arcSegments; i++) {
                const t1 = startAngle + ((endAngle - startAngle) * i) / arcSegments;
                const t2 = startAngle + ((endAngle - startAngle) * (i + 1)) / arcSegments;
                points.push(
                  new THREE.Vector3(
                    arcCenterX + arcRadius * Math.cos(t1),
                    arcCenterY + arcRadius * Math.sin(t1),
                    arcCenterZ
                  ),
                  new THREE.Vector3(
                    arcCenterX + arcRadius * Math.cos(t2),
                    arcCenterY + arcRadius * Math.sin(t2),
                    arcCenterZ
                  )
                );
              }
              color = 0xffff00; // 노란색
              break;

            default:
              console.log("처리되지 않은 엔티티 타입:", entity.type);
              break;
          }

          // 선분 생성
          if (points.length > 0) {
            for (let i = 0; i < points.length; i += 2) {
              if (points[i] && points[i + 1]) {
                const geometry = new THREE.BufferGeometry().setFromPoints([points[i], points[i + 1]]);
                const material = new THREE.LineBasicMaterial({ 
                  color,
                  linewidth: 3 // 선 두께 증가
                });
                const line = new THREE.Line(geometry, material);
                group.add(line);
              }
            }
          }
        });

        // ===== 중요: 모든 엔티티 추가 후 카메라 동적 조정 =====
        fitCameraToObject(camera, group);
        checkCameraView(camera, group);
      })
      .catch((err) => console.error("DXF 로드 오류:", err));

    // 마우스 컨트롤 추가
    let isMouseDown = false;
    let mouseX = 0;
    let mouseY = 0;
    let targetPosition = new THREE.Vector3();

    const onMouseDown = (event) => {
      isMouseDown = true;
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseMove = (event) => {
      if (!isMouseDown) return;
      
      const deltaX = event.clientX - mouseX;
      const deltaY = event.clientY - mouseY;
      
      // 그룹을 회전
      group.rotation.y += deltaX * 0.01;
      group.rotation.x += deltaY * 0.01;
      
      mouseX = event.clientX;
      mouseY = event.clientY;
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (event) => {
      event.preventDefault();
      const scale = event.deltaY > 0 ? 0.9 : 1.1;
      
      // 줌 제한
      const currentScale = group.scale.x;
      if (currentScale * scale > 0.1 && currentScale * scale < 10) {
        group.scale.multiplyScalar(scale);
      }
    };

    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('wheel', onWheel);

    // Animate
    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        renderer.domElement.removeEventListener('mousedown', onMouseDown);
        renderer.domElement.removeEventListener('mousemove', onMouseMove);
        renderer.domElement.removeEventListener('mouseup', onMouseUp);
        renderer.domElement.removeEventListener('wheel', onWheel);
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [dxfUrl]);

  return <div ref={mountRef} style={{ width: "800px", height: "600px", border: "1px solid #000" }}></div>;
};

export default TestCadViewer;