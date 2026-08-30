@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo กำลังปิด dev database (docker)...
docker compose -f docker-compose.dev.yml down
if errorlevel 1 (
  echo [ERROR] ปิด dev database ไม่สำเร็จ
  pause
  exit /b 1
)

echo.
echo ปิด dev database แล้ว (ข้อมูลใน volume ยังอยู่ครบ ไม่ได้ลบ — ครั้งหน้ารัน dev.bat ได้ข้อมูลเดิม)
echo อย่าลืมปิดหน้าต่าง backend/frontend dev server ด้วยตัวเอง (ถ้ายังเปิดอยู่)
echo.
pause
