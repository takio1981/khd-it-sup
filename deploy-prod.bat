@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo ================================================================
echo  KHD-IT-SUP — Deploy ขึ้น PRODUCTION (docker จริงที่ผู้ใช้งานใช้อยู่)
echo  ตรวจสอบให้แน่ใจว่าทดสอบผ่าน dev.bat เรียบร้อยแล้วก่อนดำเนินการต่อ
echo ================================================================
echo.
set /p confirm="ยืนยัน deploy ขึ้น production ใช่หรือไม่? (y/N): "
if /i not "%confirm%"=="y" (
  echo ยกเลิกการ deploy
  pause
  exit /b 0
)

echo.
echo [1/5] ตรวจสอบ backend (typecheck + build)...
pushd backend
call npm run build
if errorlevel 1 (
  echo [ERROR] backend build ไม่ผ่าน — หยุด deploy
  popd
  pause
  exit /b 1
)
popd

echo.
echo [2/5] ตรวจสอบ frontend (typecheck + build)...
pushd frontend
call npx tsc --noEmit -p tsconfig.app.json
if errorlevel 1 (
  echo [ERROR] frontend typecheck ไม่ผ่าน — หยุด deploy
  popd
  pause
  exit /b 1
)
call npx ng build --configuration production
if errorlevel 1 (
  echo [ERROR] frontend build ไม่ผ่าน — หยุด deploy
  popd
  pause
  exit /b 1
)
popd

echo.
echo [3/5] กำลัง build docker image (backend + frontend)...
docker compose build backend frontend
if errorlevel 1 (
  echo [ERROR] docker build ไม่สำเร็จ — หยุด deploy (production ยังรันเวอร์ชันเดิมอยู่ ไม่ถูกกระทบ)
  pause
  exit /b 1
)

echo.
echo [4/5] กำลัง recreate container (backend + frontend)...
docker compose up -d backend frontend
if errorlevel 1 (
  echo [ERROR] docker up ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo [5/5] กำลัง restart nginx (จำเป็นหลัง recreate container เพื่อไม่ให้ nginx แคช IP เดิม)...
docker compose restart nginx
if errorlevel 1 (
  echo [ERROR] restart nginx ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo ================================================================
echo  Deploy สำเร็จ — ตรวจสอบเว็บจริงอีกครั้งก่อนปิดหน้าต่างนี้
echo ================================================================
echo.
pause
