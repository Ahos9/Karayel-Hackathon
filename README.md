# Nilüfer Belediyesi - Akıllı Atık Yönetim Sistemi

Bu depo, Nilüfer için geliştirilmiş bir akıllı atık yönetimi prototipini içerir. Buradaki örneklerde repo içindeki SQLite tabanlı backend `app_sqlite.py` esas alınmıştır.

------------------------------------------------------------
İçindekiler
- Proje özeti
- Hızlı başlat (SQLite)
- Önemli dosyalar
- Önemli API endpoint'leri (örneklerle)
- ML model notları
- Büyük dosyalar / git notu
- Sorun giderme

------------------------------------------------------------
1) Kısa Proje Özeti
--------------------
Bu proje, konteyner doluluk tahmini yapan bir ML modeli, vatandaşların bildirim gönderebildiği bir frontend ve yönetici için filo optimizasyonu/simülasyon araçları içerir. Demo amaçlı olarak SQLite veri kaynağı (`nilufer_waste.db`) kullanılır.

2) Hızlı Başlat (SQLite)
-------------------------
Ön koşullar: Python 3.9+ yüklü olmalı.

PowerShell örnekleri:

```powershell
# 1) Sanal ortam
python -m venv venv
venv\Scripts\activate

# 2) Bağımlılıklar
pip install -r requirements.txt

# 3) Backend'i başlat
python app_sqlite.py
```

Tarayıcı:
- Vatandaş paneli: http://localhost:5000/
- Yönetici paneli: http://localhost:5000/admin

3) Önemli Dosyalar
-------------------
- `app_sqlite.py` — Flask backend (SQLite). Ana API burada.
- `nilufer_waste.db` — Örnek SQLite veritabanı (büyük olabilir).
- `models/fill_predictor.pkl` — Eğitilmiş model (varsa yüklenir).
- `public/` — Frontend: `index.html`, `admin.html`, `script.js`, `admin-script.js`.
- `data/` — Ham CSV verileri (büyük dosyalar `.gitignore` içinde olabilir).

4) Önemli API Endpoint'leri (kısa)
----------------------------------
- `GET /` — Vatandaş paneli
- `GET /admin` — Yönetici paneli
- `GET /api/dashboard/stats` — Genel istatistikler
- `GET /api/leaderboard` — Liderlik tablosu
- `GET /api/containers/map` — Harita için konteyner lokasyonları (lat,lng)
- `GET /api/containers/all` — Tüm konteynerler
- `GET /api/predict/<container_id>` — Tek konteyner tahmini
- `GET /api/fleet/optimize-routes` — Araç bazlı optimize rotalar (admin)
- `POST /api/reports/submit` — Vatandaş bildirimi gönderir (güven puanı hesaplaması içerir)

Endpoint örnekleri:

```bash
curl -s "http://localhost:5000/api/fleet/optimize-routes" | jq
curl -s "http://localhost:5000/api/predict/123" | jq
```

5) ML Model ve Yeniden Eğitim
-----------------------------
- Model `joblib.load('models/fill_predictor.pkl')` ile yüklenir. Eğer bulunmazsa bazı tahmin endpoint'leri hata dönebilir.
- `submit_report` endpoint'i doğrulanmış rapor sayısına göre `retrain_model()` çağırarak modeli yeniden eğitebilir.

6) Büyük Dosyalar / Git
------------------------
- Repo'ya büyük ham veri dosyaları yüklenmemiştir; örn `data/all_merged_data.csv` genellikle `.gitignore` içindedir.
- Eğer büyük dosyaları depolamak isterseniz `git-lfs` kullanın veya veriyi ayrı bir depoya/artefakt depolama servisine koyun.

7) Sorun Giderme (kısa)
-----------------------
- Model yüklenemiyor: `models/fill_predictor.pkl` dosyasını kontrol edin veya `train_model.py` ile eğitin.
- `optimize-routes` boş dönüyorsa: veritabanında >=%70 dolu konteyner yok olabilir veya OSRM çağrısı başarısız olmuştur (fallback uygulanır).
- Frontend harita cache sorunları: tarayıcıda hard refresh deneyin (Ctrl+F5).

8) Geliştirme Notları
----------------------
- Kodda değişiklik yapmadan önce lokal olarak çalıştırıp endpointleri test edin.
- `app_sqlite.py` içinde SQL sorguları parametreli olarak yazılmıştır; yeni sorgu eklerken SQL injection riskine dikkat edin.

------------------------------------------------------------
