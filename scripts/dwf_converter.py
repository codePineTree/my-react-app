#!/usr/bin/env python3
"""
DWF to DXF Converter using FreeCAD (Windows Version)
Usage: python dwf_converter.py input.dwf output.dxf
"""

import sys
import os
import traceback
from pathlib import Path

# Windows FreeCAD 경로들
FREECAD_PATHS = [
    "C:/Program Files/FreeCAD 1.0/bin",        # FreeCAD 1.0 기본 경로
    "C:/Program Files/FreeCAD 0.21/bin",       # FreeCAD 0.21
    "C:/Program Files/FreeCAD 0.20/bin",       # FreeCAD 0.20
    "C:/Program Files (x86)/FreeCAD 1.0/bin",  # 32비트 버전
    "C:/FreeCAD/bin",                          # 포터블 버전
]

def setup_freecad():
    """FreeCAD 모듈 로드를 위한 경로 설정"""
    print("=== FreeCAD 설정 시작 ===")
    
    for path in FREECAD_PATHS:
        print(f"경로 확인 중: {path}")
        if os.path.exists(path):
            sys.path.insert(0, path)
            print(f"✅ FreeCAD 경로 추가: {path}")
            break
    else:
        print("❌ FreeCAD 설치 경로를 찾을 수 없습니다.")
        print("다음 경로들을 확인했습니다:")
        for path in FREECAD_PATHS:
            exists = "존재함" if os.path.exists(path) else "없음"
            print(f"  - {path} ({exists})")
        return False
    
    try:
        print("FreeCAD 모듈 로딩 시도...")
        import FreeCAD
        import Import
        print(f"✅ FreeCAD 로드 성공!")
        print(f"FreeCAD 버전: {FreeCAD.Version()}")
        return True
    except ImportError as e:
        print(f"❌ FreeCAD 모듈 로드 실패: {e}")
        print("추가 시도: PYTHONPATH 환경변수 설정...")
        
        # PYTHONPATH에 FreeCAD 경로 추가 시도
        freecad_lib_path = path.replace('/bin', '/lib')
        if os.path.exists(freecad_lib_path):
            sys.path.insert(0, freecad_lib_path)
            try:
                import FreeCAD
                import Import
                print(f"✅ FreeCAD 로드 성공! (lib 경로 사용)")
                return True
            except ImportError:
                pass
        
        print("❌ FreeCAD 모듈을 로드할 수 없습니다.")
        return False

def convert_dwf_to_dxf(input_path, output_path):
    """DWF 파일을 DXF로 변환"""
    
    print("\n=== DWF → DXF 변환 시작 ===")
    
    if not setup_freecad():
        return False
    
    import FreeCAD
    import Import
    
    input_file = Path(input_path)
    output_file = Path(output_path)
    
    print(f"입력 파일: {input_file.absolute()}")
    print(f"출력 파일: {output_file.absolute()}")
    
    # 입력 파일 존재 확인
    if not input_file.exists():
        print(f"❌ 입력 파일이 존재하지 않습니다: {input_file}")
        return False
    
    # 파일 크기 확인
    file_size = input_file.stat().st_size
    print(f"입력 파일 크기: {file_size} bytes")
    
    # 출력 디렉토리 생성
    output_file.parent.mkdir(parents=True, exist_ok=True)
    
    doc_name = f"DwfConvert_{os.getpid()}"
    doc = None
    
    try:
        print("📁 FreeCAD 문서 생성 중...")
        doc = FreeCAD.newDocument(doc_name)
        print(f"✅ 문서 생성 완료: {doc_name}")
        
        print("📥 DWF 파일 로드 시도...")
        # DWF 파일 import 시도
        Import.insert(str(input_file), doc_name)
        print(f"✅ DWF 파일 로드 완료")
        
        print(f"📊 로드된 객체 수: {len(doc.Objects)}")
        
        if len(doc.Objects) == 0:
            print("⚠️  경고: 로드된 객체가 없습니다.")
            print("이는 다음 이유일 수 있습니다:")
            print("  - DWF 파일이 FreeCAD에서 지원하지 않는 형식")
            print("  - DWF 파일이 손상됨")
            print("  - DWF 버전 호환성 문제")
            return False
        
        # 객체 정보 출력 (디버깅용)
        print("\n📋 로드된 객체 목록:")
        for i, obj in enumerate(doc.Objects):
            print(f"  {i+1}. {obj.Label} ({obj.TypeId})")
        
        print(f"\n📤 DXF로 내보내기 중...")
        # 모든 객체를 DXF로 내보내기
        Import.export(doc.Objects, str(output_file))
        print(f"✅ DXF 내보내기 완료")
        
        # 결과 파일 확인
        if output_file.exists():
            output_size = output_file.stat().st_size
            print(f"✅ 변환 완료! 출력 파일 크기: {output_size} bytes")
            
            # DXF 파일 내용 일부 확인
            try:
                with open(output_file, 'r', encoding='utf-8') as f:
                    first_lines = [f.readline().strip() for _ in range(10)]
                    if any('SECTION' in line for line in first_lines):
                        print("✅ 유효한 DXF 파일 형식으로 보입니다.")
                    else:
                        print("⚠️  DXF 파일 형식이 올바르지 않을 수 있습니다.")
            except Exception as e:
                print(f"⚠️  DXF 파일 검증 중 오류: {e}")
            
            return True
        else:
            print("❌ 출력 파일이 생성되지 않았습니다.")
            return False
            
    except Exception as e:
        print(f"❌ 변환 중 오류 발생: {e}")
        print("\n🔍 상세 오류:")
        traceback.print_exc()
        
        print("\n💡 해결 방법:")
        print("  1. DWF 파일이 유효한지 확인")
        print("  2. FreeCAD가 해당 DWF 버전을 지원하는지 확인") 
        print("  3. 다른 DWF 파일로 테스트")
        
        return False
    
    finally:
        # 문서 정리
        if doc and doc.Name in [d.Name for d in FreeCAD.listDocuments().values()]:
            try:
                FreeCAD.closeDocument(doc.Name)
                print("🧹 FreeCAD 문서 정리 완료")
            except Exception as cleanup_error:
                print(f"⚠️  문서 정리 중 오류: {cleanup_error}")

def main():
    if len(sys.argv) != 3:
        print("사용법: python dwf_converter.py input.dwf output.dxf")
        print("예시: python dwf_converter.py triangle-Model_test.dwf converted.dxf")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    print("=" * 60)
    print("🔄 DWF to DXF Converter (Windows)")
    print("=" * 60)
    print(f"Python 버전: {sys.version}")
    print(f"작업 디렉토리: {os.getcwd()}")
    
    success = convert_dwf_to_dxf(input_path, output_path)
    
    if success:
        print("\n" + "=" * 60)
        print("🎉 변환 성공!")
        print("=" * 60)
        sys.exit(0)
    else:
        print("\n" + "=" * 60)
        print("💥 변환 실패!")
        print("=" * 60)
        sys.exit(1)

if __name__ == "__main__":
    main()