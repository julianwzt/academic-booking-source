# Academic Classroom Booking System (TULT)

Aplikasi web reservasi ruang kelas Telkom University Landmark Tower (TULT) lantai 6 & 7 menggunakan FastAPI (Python), MongoDB, dan React (Vite + TypeScript).

## Struktur Folder
```text
academic-booking-source/
├── backend/         # REST API (FastAPI + MongoDB)
├── frontend/        # Web App (React + TypeScript + Vite)
├── database_dump/   # Cadangan data awal (JSON + skrip import)
└── README.md
```

## Prasyarat
- Python 3.11+
- Node.js 18+ & Yarn
- Docker Desktop (atau MongoDB lokal di `mongodb://localhost:27017`)

## Cara Menjalankan

### 1. Database (MongoDB via Docker)

**Opsi A — Lewat Terminal (PowerShell / CMD):**
```powershell
# Buat network khusus
docker network create academic-net

# Jalankan MongoDB (port 27017)
docker run -d --name mongodb-academic --network academic-net -p 27017:27017 -v mongodb_academic_data:/data/db mongo:7

# Opsional: Jalankan Mongo Express sebagai Web UI database (port 8085)
docker run -d --name mongo-express --network academic-net -p 8085:8081 -e ME_CONFIG_MONGODB_URL="mongodb://mongodb-academic:27017/" -e ME_CONFIG_BASICAUTH_USERNAME="admin" -e ME_CONFIG_BASICAUTH_PASSWORD="123" mongo-express
```

**Opsi B — Lewat Docker Desktop (GUI):**
1. Buka **Docker Desktop**, masuk ke menu **Images**, cari `mongo` (tag `7`) lalu klik **Run**.
2. Buka **Optional settings**, isi:
   - **Container name**: `mongodb-academic`
   - **Host port**: `27017`
   - **Volumes**: `mongodb_academic_data` -> `/data/db`
3. Klik **Run** hingga status container **Running**.

*(Web UI database Mongo Express dapat diakses di `http://localhost:8085` dengan login `admin` / `123`.)*

### 2. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Berjalan di `http://localhost:8001`.

**Catatan Pengisian Data Awal (`database_dump/`):**
- Secara otomatis, backend akan mengisi database `academic_booking` saat pertama kali dijalankan jika database masih kosong.
- Folder `database_dump/` berisi file JSON mentah (`classrooms.json`, `instructors.json`, `users.json`, `bookings.json`, `counters.json`) dan skrip `import_db.py` sebagai cadangan apabila ingin mereset atau mengimpor ulang data secara manual:
  ```bash
  cd database_dump
  ..\backend\venv\Scripts\python import_db.py
  ```

### 3. Frontend
Buka terminal baru:
```bash
cd frontend
yarn install
yarn dev
```
Berjalan di `http://localhost:3000`.

## Akun Default
- **Admin**: `admin@telkom.ac.id` / `admin123`
- **Dosen**: `andi.pratama@telkom.ac.id` / `password123`
- **Asisten Dosen**: `budi.santoso@telkom.ac.id` / `password123`
