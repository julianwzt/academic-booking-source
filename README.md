# Academic Classroom Booking System (TULT)

Aplikasi web reservasi ruang kelas Telkom University Landmark Tower (TULT) lantai 6 & 7 menggunakan FastAPI (Python), MongoDB, dan React (Vite + TypeScript).

## Prasyarat
- Python 3.11+
- Node.js 18+ & Yarn
- MongoDB lokal berjalan di `mongodb://localhost:27017`

## Cara Menjalankan

### 1. Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Linux/macOS: source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```
Berjalan di `http://localhost:8001` (data awal otomatis terisi saat pertama kali dijalankan; `python seed.py` tetap bisa dijalankan manual jika diperlukan).

### 2. Frontend
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
