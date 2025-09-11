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
    const getSafe = (v) => (v !== undefined && !isNaN(v) ? v : 0);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const group = new THREE.Group();
    scene.add(group);

    let camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(150, 150, 200);
    camera.lookAt(50, 50, 0);

    const animate = () => {
      requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    fetch(dxfUrl)
      .then((res) => res.text())
      .then((text) => {
        const parser = new DxfParser();
        const dxf = parser.parseSync(text);

        dxf.entities.forEach((entity, idx) => {
          let points = [];
          let color = 0x000000;

          switch (entity.type) {
            case "LINE":
              points.push(
                new THREE.Vector3(getSafe(entity.x1), getSafe(entity.y1), getSafe(entity.z1 || 0)),
                new THREE.Vector3(getSafe(entity.x2), getSafe(entity.y2), getSafe(entity.z2 || 0))
              );
              color = 0xff0000;
              break;

            case "CIRCLE":
              const segments = 32;
              for (let i = 0; i < segments; i++) {
                const theta1 = (i / segments) * Math.PI * 2;
                const theta2 = ((i + 1) / segments) * Math.PI * 2;
                const x1 = getSafe(entity.cx + entity.radius * Math.cos(theta1));
                const y1 = getSafe(entity.cy + entity.radius * Math.sin(theta1));
                const x2 = getSafe(entity.cx + entity.radius * Math.cos(theta2));
                const y2 = getSafe(entity.cy + entity.radius * Math.sin(theta2));
                const z = getSafe(entity.cz || 0);
                points.push(new THREE.Vector3(x1, y1, z), new THREE.Vector3(x2, y2, z));
              }
              color = 0x0000ff;
              break;

            default:
              console.log("Unhandled entity type:", entity.type);
              break;
          }

          if (points.length > 0) {
            for (let i = 0; i < points.length; i += 2) {
              const geometry = new THREE.BufferGeometry().setFromPoints([points[i], points[i + 1]]);
              const material = new THREE.LineBasicMaterial({ color });
              const line = new THREE.Line(geometry, material);
              group.add(line);
            }
          }
        });
      })
      .catch((err) => console.error("DXF 로드 오류:", err));

    return () => {
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [dxfUrl]);

  return <div ref={mountRef} style={{ width: "800px", height: "600px", border: "1px solid #000" }}></div>;
};

export default TestCadViewer;
