@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"

echo ================================================================
echo  KHD-IT-SUP — Dev environment
echo  (แยกจาก production โดยสิ้นเชิง — ไม่กระทบระบบจริงที่ผู้ใช้ใช้งานอยู่)
echo ================================================================
echo.

echo [1/4] กำลัง start dev database (docker)...
docker compose -f docker-compose.dev.yml up -d
if errorlevel 1 (
  echo.
  echo [ERROR] start dev database ไม่สำเร็จ — ตรวจสอบว่า Docker Desktop เปิดอยู่หรือไม่
  pause
  exit /b 1
)

echo.
echo [2/4] กำลังรอ dev database พร้อมใช้งาน...
set /a tries=0
:waitdb
docker inspect --format="{{.State.Health.Status}}" khd_it_sup_dev_db 2>nul | findstr /c:"healthy" >nul
if not errorlevel 1 goto dbready
set /a tries+=1
if !tries! geq 30 (
  echo [ERROR] dev database ยังไม่ healthy หลังจากรอ — ตรวจสอบด้วย: docker logs khd_it_sup_dev_db
  pause
  exit /b 1
)
timeout /t 2 /nobreak >nul
goto waitdb
:dbready
echo       dev database พร้อมแล้ว (localhost:3308)

echo.
echo [3/4] กำลังเปิดหน้าต่าง backend dev server...
start "KHD-IT-SUP Backend (dev :3500)" cmd /k "cd /d "%~dp0backend" && npm run dev"

echo.
echo       กำลังรอ backend พร้อมใช้งานก่อนเปิด frontend...
echo       (กันไม่ให้ frontend เชื่อมต่อ backend ไม่ทันตอนเริ่ม จนขึ้น proxy error ชั่วคราวใน console)
set /a btries=0
:waitbackend
curl -s -o nul http://localhost:3500/health
if not errorlevel 1 goto backendready
set /a btries+=1
if !btries! geq 60 (
  echo [WARNING] backend ยังไม่ตอบสนองหลังจากรอนาน — จะเปิด frontend ต่อไปก่อน ตรวจสอบหน้าต่าง backend ว่ามี error หรือไม่
  goto openfrontend
)
timeout /t 2 /nobreak >nul
goto waitbackend
:backendready
echo       backend พร้อมแล้ว (localhost:3500)

:openfrontend
echo.
echo [4/4] กำลังเปิดหน้าต่าง frontend dev server...
start "KHD-IT-SUP Frontend (dev :4500)" cmd /k "cd /d "%~dp0frontend" && npm start"

echo.
echo ================================================================
echo  พร้อมใช้งาน (URL รูปแบบเดียวกับ production — ใต้ path /khd-it-sup/):
echo    เว็บแอป  : http://localhost:4500/khd-it-sup/
echo    Backend  : http://localhost:3500/api/v1  (เข้าผ่าน frontend proxy ให้อัตโนมัติแล้ว)
echo    Swagger  : http://localhost:3500/api-docs
echo.
echo  ปิดการทำงาน: ปิดหน้าต่าง backend/frontend ที่เปิดขึ้นมา แล้วรัน stop-dev.bat
echo ================================================================
echo.
pause