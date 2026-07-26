# Deployment Diagram

ตรงกับ `docker-compose.yml` จริง — ดูคำอธิบายประกอบเต็มที่ [01-architecture.md § 1.8](../01-architecture.md#18-deployment-diagram)

```mermaid
flowchart LR
    subgraph Internet
        User(("ผู้ใช้งาน"))
    end

    subgraph DockerHost["Docker Host (docker compose up)"]
        subgraph NginxC["nginx container :80/:443"]
        end
        subgraph FEC["frontend container<br/>Angular build (static, served by Nginx ภายใน)"]
        end
        subgraph BEC["backend container<br/>Node.js API :3000"]
        end
        subgraph DBC["mariadb container :3306"]
        end
        Vol1[(backend-uploads volume)]
        Vol2[(mariadb-data volume)]
        Vol3[(backend-logs volume)]
    end

    User -- HTTPS --> NginxC
    NginxC -- "/" --> FEC
    NginxC -- "/api, /api-docs" --> BEC
    NginxC -- "/socket.io (WebSocket upgrade)" --> BEC
    BEC -- "Prisma" --> DBC
    BEC --> Vol1
    BEC --> Vol3
    DBC --> Vol2
```

## Container Images

| Container | Base Image | Build |
|---|---|---|
| `khd_it_sup_nginx` | `nginx:alpine` | ใช้ image สำเร็จรูป, mount `docker/nginx/nginx.conf` |
| `khd_it_sup_frontend` | `node:20-alpine` (build) → `nginx:1.27-alpine` (runtime) | `frontend/Dockerfile` (multi-stage) |
| `khd_it_sup_backend` | `node:20-alpine` (multi-stage: deps/build/prod-deps/runtime) | `backend/Dockerfile` |
| `khd_it_sup_db` | `mariadb:11` | official image, auto-init จาก `database/schema.sql` + `seed.sql` |

ทดสอบแล้วว่า `docker compose up -d --build` รันสำเร็จครบทั้ง 4 container จาก database ว่างเปล่า (ดู [00-roadmap.md](../00-roadmap.md))
