#!/bin/sh
# Generate/regenerate a self-signed TLS certificate for the Nginx reverse proxy, covering localhost
# plus every IPv4 address currently assigned to this host (needed so getUserMedia/camera works when
# staff reach the app via a LAN IP over HTTPS — browsers only treat HTTPS, localhost, or 127.0.0.1 as
# a "secure context"; plain HTTP via IP never qualifies, no server-side setting can change that).
#
# Re-run this script whenever the host's LAN IP changes (DHCP lease renewal, switching Ethernet<->Wi-Fi,
# etc.) then run `docker compose restart nginx` to pick up the new certificate.
set -e

CERT_DIR="$(cd "$(dirname "$0")" && pwd)/certs"
DAYS=3650

mkdir -p "$CERT_DIR"

# รวบรวม IPv4 ของเครื่องนี้ทุกใบ (ตัด loopback/APIPA ออก) มาใส่เป็น SAN เพิ่มเติมจาก localhost/127.0.0.1 เสมอ
IP_LIST=$(powershell -NoProfile -Command \
  "Get-NetIPAddress -AddressFamily IPv4 | Where-Object { \$_.IPAddress -notlike '169.254.*' -and \$_.IPAddress -ne '127.0.0.1' } | Select-Object -ExpandProperty IPAddress" \
  2>/dev/null | tr -d '\r')

SAN="DNS:localhost,IP:127.0.0.1"
for ip in $IP_LIST; do
  SAN="$SAN,IP:$ip"
done

echo "Generating self-signed certificate with SAN: $SAN"

# เติม "/" นำหน้าซ้ำใน -subj (//C=...) กัน Git-Bash/MSYS แปลง argument นี้เป็น Windows path ให้อัตโนมัติ
# (heuristic เดียวกับที่ต้องใช้แปลง -keyout/-out ให้ถูกต้อง จึงไม่ปิด path conversion ทั้งหมด)
openssl req -x509 -nodes -newkey rsa:2048 -days "$DAYS" \
  -keyout "$CERT_DIR/khd-it-sup.key" \
  -out "$CERT_DIR/khd-it-sup.crt" \
  -subj "//C=TH/O=KHD-IT-SUP/CN=khd-it-sup.local" \
  -addext "subjectAltName=$SAN"

echo "Done. Certificate: $CERT_DIR/khd-it-sup.crt"
echo "Restart nginx to apply: docker compose restart nginx"
