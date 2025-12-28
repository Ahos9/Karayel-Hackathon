# Nilüfer Belediyesi - Akıllı Atık Yönetim Sistemi

## 📋 Sistem Hakkında

Bu proje, Nilüfer Belediyesi için geliştirilmiş **gerçek verilerle çalışan** tam fonksiyonel bir akıllı atık yönetim sistemidir.

### ✨ Özellikler

- 🤖 **AI Tahmin Modeli**: Konteyner doluluk seviyelerini tahmin eder
- 👥 **Vatandaş Bildirimi**: Güven puanı sistemi ile akıllı doğrulama
- 📊 **Admin Paneli**: Filo simülasyonu ve optimizasyon
- 🗺️ **Mahalle Bazlı Analiz**: 66 mahalle için detaylı raporlama
- 📈 **Gerçek Veri**: fleet.csv, container_counts.csv, mahalle_nufus.csv, tonnages.csv

---

## 🚀 Kurulum Adımları

### Adım 1: MySQL Kurulumu ve Yapılandırma

1. **MySQL İndir ve Kur**:
   - [MySQL Community Server](https://dev.mysql.com/downloads/mysql/) indirin
   - Kurulum sırasında root şifresini belirleyin
   - MySQL Workbench'i de kurmanız önerilir

2. **Veritabanını Oluştur**:
   ```bash
   # MySQL'e bağlan
   mysql -u root -p
   
   # Veritabanını oluştur
   CREATE DATABASE nilufer_waste_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   
   # Çıkış
   exit;
   ```

3. **Şema Kurulumu**:
   ```bash
   # SQL dosyasını çalıştır
   mysql -u root -p nilufer_waste_db < database_setup.sql
   ```

### Adım 2: Python Ortamını Hazırlama

1. **Python 3.9+ Kurulu Olmalı**:
   ```bash
   python --version
   # Çıktı: Python 3.9.0 veya üzeri
   ```

2. **Sanal Ortam Oluştur** (Önerilen):
   ```bash
   python -m venv venv
   
   # Aktif et (Windows)
   venv\Scripts\activate
   
   # Aktif et (Linux/Mac)
   source venv/bin/activate
   ```

3. **Bağımlılıkları Yükle**:
   ```bash
   pip install -r requirements.txt
   ```

### Adım 3: Şifre Yapılandırması

Aşağıdaki dosyalarda `'your_password'` yazan yerlere MySQL root şifrenizi yazın:

- **load_data.py** (satır 13)
- **train_model.py** (satır 15)
- **app.py** (satır 27)

```python
# Örnek:
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',
    'password': 'Sizin_MySQL_Sifreniz',  # ← BURAYA YAZIN
    'database': 'nilufer_waste_db'
}
```

### Adım 4: Veriyi Yükle

```bash
python load_data.py
```

**Çıktı**:
```
============================================================
NİLÜFER BELEDİYESİ - VERİ YÜKLEME
============================================================

✓ 66 mahalle yüklendi
✓ 3 araç tipi yüklendi
✓ 47 araç yüklendi
✓ 1234 konteyner oluşturuldu
✓ 24 aylık tonaj verisi yüklendi
✓ 500 sentetik toplama olayı oluşturuldu

✅ TÜM VERİLER BAŞARIYLA YÜKLENDİ!
```

### Adım 5: Modeli Eğit

```bash
python train_model.py
```

**Çıktı**:
```
============================================================
MODEL EĞİTİMİ BAŞLIYOR
============================================================

📊 Eğitim verisi yükleniyor...
✓ 1234 konteyner verisi yüklendi

🔧 Özellikler oluşturuluyor...
✓ 16 özellik oluşturuldu

🤖 Random Forest modeli eğitiliyor...

============================================================
MODEL SONUÇLARI
============================================================

✓ Eğitim Doğruluğu: 0.9542 (95.42%)
✓ Test Doğruluğu: 0.8876 (88.76%)

✅ MODEL EĞİTİMİ VE KAYIT BAŞARILI!

📁 Model dosyası: models/fill_predictor.pkl
```

### Adım 6: Backend'i Başlat

```bash
python app.py
```

**Çıktı**:
```
============================================================
NİLÜFER BELEDİYESİ - BACKEND API
============================================================

✓ Model durumu: Yüklü
✓ Veritabanı: nilufer_waste_db
✓ Port: 5000

🌐 URL'ler:
  Vatandaş Paneli: http://localhost:5000/
  Admin Paneli: http://localhost:5000/admin
```

### Adım 7: Web Sitesini Kullan

Tarayıcınızda açın:

- **Vatandaş Paneli**: http://localhost:5000/
- **Admin Paneli**: http://localhost:5000/admin

---

## 📁 Dosya Yapısı

```
Hackathon/
│
├── data/                          # Gerçek veriler
│   ├── fleet.csv                  # 47 araç bilgisi
│   ├── container_counts.csv       # 66 mahalle konteyner sayıları
│   ├── mahalle_nufus.csv         # Mahalle nüfus verileri
│   └── tonnages.csv              # 24 aylık tonaj istatistikleri
│
├── public/                        # Frontend dosyaları
│   ├── index.html                # Vatandaş paneli
│   ├── admin.html                # Admin paneli
│   ├── styles.css                # Nilüfer tasarımı
│   ├── script.js                 # Vatandaş JS
│   └── admin-script.js           # Admin JS
│
├── models/                        # Eğitilmiş modeller
│   └── fill_predictor.pkl        # AI tahmin modeli
│
├── database_setup.sql            # Veritabanı şeması
├── load_data.py                  # Veri yükleme script'i
├── train_model.py                # Model eğitim script'i
├── app.py                        # Flask backend API
├── requirements.txt              # Python bağımlılıkları
└── README.md                     # Bu dosya
```

---

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Giriş

### Citizen Reports
- `POST /api/reports` - Bildirim gönder
- `POST /api/reports/validate/<id>` - Bildirimi doğrula (admin)

### Predictions
- `GET /api/predict/<container_id>` - Tek konteyner tahmini
- `GET /api/predict/neighborhood/<id>` - Mahalle tahmini

### Dashboard
- `GET /api/dashboard/stats` - Genel istatistikler
- `GET /api/leaderboard` - Kullanıcı sıralaması

### Simulation
- `POST /api/simulate` - Filo simülasyonu (admin)

---

## 🎨 Tasarım Kılavuzu

### Renkler (Nilüfer Belediyesi)
- **Birincil Mavi**: #0066B3
- **Birincil Yeşil**: #00A651
- **Arka Plan**: #F5F5F5 (90% beyaz)

### Fontlar
- **Başlıklar**: Roboto, sans-serif
- **Metin**: Arial, sans-serif

### Tasarım İlkeleri
- ✅ FLAT tasarım (gradient YOK)
- ✅ Kurumsal ve resmi görünüm
- ✅ Responsive (mobil uyumlu)

---

## 🧪 Test Kullanıcıları

Sistem otomatik olarak test kullanıcıları oluşturur:

| Ad | Email | Şifre | Rol | Güven Puanı |
|---|---|---|---|---|
| Ahmet Yılmaz | ahmet@test.com | test123 | Vatandaş | 0.85 |
| Ayşe Demir | ayse@test.com | test123 | Vatandaş | 0.92 |
| Mehmet Kaya | mehmet@test.com | test123 | Vatandaş | 0.45 |
| Admin User | admin@nilufer.gov.tr | admin123 | Admin | 1.00 |

---

## 📊 Veri Özeti

### Fleet (47 Araç)
- Küçük Çöp Kamyonu: 1 adet
- Büyük Çöp Kamyonu: 25 adet
- Vinçli Araç: 21 adet

### Konteynerler (66 Mahalle)
- Yeraltı Konteyner: ~200 adet
- 770 Lt Konteyner: ~300 adet
- 400 Lt Konteyner: ~500 adet
- Plastik Konteyner: ~200 adet

### Nüfus
- Toplam: 483,732 kişi
- En yüksek: Barış Mah. (23,320 kişi)
- En düşük: Çalı Mah. (178 kişi)

### Tonaj (24 Ay)
- Ortalama Aylık: ~3,500 ton
- Toplam: ~84,000 ton

---

## 🔧 Sorun Giderme

### Problem: MySQL bağlantı hatası
**Çözüm**: 
```bash
# MySQL servisinin çalıştığından emin olun
# Windows:
net start MySQL80

# Şifrenizi doğru yazdığınızdan emin olun
```

### Problem: Model yüklenemedi
**Çözüm**:
```bash
# Önce modeli eğitin
python train_model.py

# Sonra backend'i başlatın
python app.py
```

### Problem: Port 5000 kullanımda
**Çözüm**:
```python
# app.py son satırını değiştirin:
app.run(debug=True, host='0.0.0.0', port=5001)
```

### Problem: Türkçe karakter sorunu
**Çözüm**:
```sql
-- Veritabanını yeniden oluşturun:
DROP DATABASE nilufer_waste_db;
CREATE DATABASE nilufer_waste_db 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

---

## 📈 Model Performansı

### Fill-Level Predictor
- **Algoritma**: Random Forest Classifier
- **Özellikler**: 16 adet ( nüfus, kapasite vb.)
- **Eğitim Doğruluğu**: ~95%
- **Test Doğruluğu**: ~89%

### En Önemli Özellikler
1. population_density (Nüfus yoğunluğu)
2. container_capacity (Konteyner kapasitesi)


---

## 🎯 Kullanım Senaryoları

### Vatandaş Olarak
1. Siteye giriş yapın veya kayıt olun
2. Haritadan dolu konteyner seçin
3. Doluluk seviyesini tahmin edin (0-100%)
4. Fotoğraf ekleyin (güven puanı düşükse zorunlu)
5. Bildirinizi gönderin
6. Liderlik tablosunda yerinizi görün

### Admin Olarak
1. Admin paneline giriş yapın
2. Dashboard'da genel durumu görün
3. Mahalle bazlı analizleri inceleyin
4. Filo simülasyonu çalıştırın:
   - Araç sayılarını ayarlayın
   - Toplam maliyet ve süre görün
   - Optimum filoyu belirleyin

---

## 🔐 Güvenlik

- ✅ Şifreler bcrypt ile hash'leniyor
- ✅ JWT token ile authentication
- ✅ SQL injection koruması (parametreli sorgu)
- ✅ CORS yapılandırması
- ⚠️ Üretim için SECRET_KEY değiştirin!

---





---

## 📜 Lisans

Bu proje Nilüfer Belediyesi için özel olarak geliştirilmiştir.

---

## ✅ Checklist

Kurulum tamamlandıktan sonra:

- [ ] MySQL kurulu ve çalışıyor
- [ ] Veritabanı oluşturuldu
- [ ] database_setup.sql çalıştırıldı
- [ ] Python bağımlılıkları yüklendi
- [ ] Şifreler yapılandırıldı
- [ ] load_data.py çalıştırıldı (66 mahalle, 47 araç, 1234 konteyner)
- [ ] train_model.py çalıştırıldı (model eğitildi)
- [ ] app.py başlatıldı (backend çalışıyor)
- [ ] http://localhost:5000 açıldı
- [ ] Test kullanıcısı ile giriş yapıldı

---

**🎉 Tebrikler! Sistem hazır!**
