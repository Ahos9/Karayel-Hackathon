"""
Flask Backend - SQLite
Basitleştirilmiş Demo
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
from datetime import datetime
import joblib
import numpy as np
import os
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
import requests
import json

app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

DB_PATH = 'nilufer_waste.db'
MODEL_PATH = 'models/fill_predictor.pkl'

# Model yükle
model_data = None
try:
    model_data = joblib.load(MODEL_PATH)
    print(f"✓ Model yüklendi")
except:
    print(f"⚠️ Model bulunamadı")

# Model eğitim sayacı (her 10 doğru bildirimde bir eğit)
training_counter = {'verified_count': 0, 'threshold': 10}

def retrain_model():
    """Model'i güncel verilerle yeniden eğit"""
    global model_data
    
    try:
        conn = sqlite3.connect(DB_PATH)
        
        # Eğitim verilerini hazırla - hem eski hem yeni veriler
        query = """
        SELECT 
            c.container_id,
            c.container_type,
            c.capacity_liters,
            c.current_fill_level,
            n.population_density,
            CASE 
                WHEN c.current_fill_level >= 0.75 THEN 1 
                ELSE 0 
            END as is_full
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.status = 'active'
        """
        
        df = pd.read_sql_query(query, conn)
        
        if len(df) < 50:  # Minimum veri kontrolü
            conn.close()
            return False
        
        # Feature engineering
        df['type_glass'] = (df['container_type'] == 'Cam').astype(int)
        df['type_paper'] = (df['container_type'] == 'Kağıt').astype(int)
        df['type_plastic'] = (df['container_type'] == 'Plastik').astype(int)
        df['type_metal'] = (df['container_type'] == 'Metal').astype(int)
        df['type_organic'] = (df['container_type'] == 'Organik').astype(int)
        df['type_general'] = (df['container_type'] == 'Genel').astype(int)
        
        df['capacity_large'] = (df['capacity_liters'] >= 1100).astype(int)
        df['capacity_medium'] = ((df['capacity_liters'] >= 800) & (df['capacity_liters'] < 1100)).astype(int)
        df['density_high'] = (df['population_density'] > 10000).astype(int)
        
        # Features ve target
        feature_cols = ['container_id', 'capacity_liters', 'population_density',
                       'type_glass', 'type_paper', 'type_plastic', 'type_metal', 
                       'type_organic', 'type_general', 'capacity_large', 
                       'capacity_medium', 'density_high', 'current_fill_level']
        
        X = df[feature_cols].fillna(0)
        y = df['is_full']
        
        # Train-test split
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Model eğit
        model = RandomForestClassifier(n_estimators=100, random_state=42, max_depth=10)
        model.fit(X_train, y_train)
        
        # Accuracy hesapla
        train_accuracy = model.score(X_train, y_train)
        test_accuracy = model.score(X_test, y_test)
        
        # Model'i kaydet
        model_data = {
            'model': model,
            'feature_columns': feature_cols,
            'train_accuracy': train_accuracy,
            'test_accuracy': test_accuracy,
            'trained_at': datetime.now().isoformat()
        }
        
        joblib.dump(model_data, MODEL_PATH)
        conn.close()
        
        print(f"✅ Model yeniden eğitildi! Train: {train_accuracy:.3f}, Test: {test_accuracy:.3f}")
        return True
        
    except Exception as e:
        print(f"❌ Model eğitim hatası: {e}")
        return False

@app.route('/')
def index():
    return send_from_directory('public', 'index.html')

@app.route('/admin')
def admin():
    return send_from_directory('public', 'admin.html')

@app.route('/api/dashboard/stats')
def dashboard_stats():
    """Dashboard istatistikleri - Gerçek veritabanı verileri"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Toplam konteyner
    cursor.execute("SELECT COUNT(*) FROM containers WHERE status='active'")
    total = cursor.fetchone()[0]
    
    # Dolu konteynerler
    cursor.execute("SELECT COUNT(*) FROM containers WHERE current_fill_level >= 0.75")
    full = cursor.fetchone()[0]
    
    # Toplam araç
    cursor.execute("SELECT COUNT(*) FROM vehicles")
    vehicles = cursor.fetchone()[0]
    
    # Mahalleler
    cursor.execute("SELECT COUNT(*) FROM neighborhoods")
    neighborhoods = cursor.fetchone()[0]
    
    # Bugünkü bildirimler (gerçek veri)
    cursor.execute("""
        SELECT COUNT(*) FROM citizen_reports 
        WHERE DATE(submitted_at) = DATE('now')
    """)
    today_reports = cursor.fetchone()[0]
    
    # Bugünkü toplama olayları (gerçek veri)
    cursor.execute("""
        SELECT COUNT(*) FROM collection_events 
        WHERE DATE(collection_date) = DATE('now')
    """)
    today_collections = cursor.fetchone()[0]
    
    # Bu ay tonaj (gerçek veri - tonnage_statistics tablosundan)
    cursor.execute("""
        SELECT total_tonnage FROM tonnage_statistics 
        ORDER BY rowid DESC LIMIT 1
    """)
    tonnage_row = cursor.fetchone()
    month_tonnage = tonnage_row[0] if tonnage_row else 0
    
    # Toplam bildiri sayısı
    cursor.execute("SELECT COUNT(*) FROM citizen_reports")
    total_reports = cursor.fetchone()[0]
    
    # Doğrulanmış bildiri sayısı
    cursor.execute("SELECT COUNT(*) FROM citizen_reports WHERE is_verified = 1")
    verified_reports = cursor.fetchone()[0]
    
    conn.close()
    
    return jsonify({
        'total_containers': total,
        'full_containers': full,
        'fill_rate': full / total if total > 0 else 0,
        'total_vehicles': vehicles,
        'neighborhoods': neighborhoods,
        'today_reports': today_reports,
        'today_collections': today_collections,
        'month_tonnage': float(month_tonnage),
        'total_reports': total_reports,
        'verified_reports': verified_reports,
        'verification_rate': verified_reports / total_reports if total_reports > 0 else 0
    })

@app.route('/api/leaderboard')
def leaderboard():
    """Kullanıcı liderlik tablosu"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT name, trust_score, total_reports
        FROM users
        WHERE role = 'citizen' AND total_reports > 0
        ORDER BY trust_score DESC, total_reports DESC
        LIMIT 10
    """)
    
    users = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'leaderboard': [
            {
                'rank': idx + 1,
                'name': u[0],
                'trust_score': float(u[1]),
                'total_reports': u[2]
            }
            for idx, u in enumerate(users)
        ]
    })

@app.route('/api/predict/<int:container_id>')
def predict_container(container_id):
    """Tek konteyner tahmini - Gerçek ML modeli ile"""
    if not model_data:
        return jsonify({'error': 'Model yüklü değil'}), 503
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Konteyner bilgilerini ve tarihsel verileri çek
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.capacity_liters,
            c.last_collection_date,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            n.neighborhood_name,
            n.population,
            n.population_density,
            n.area_km2
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.container_id = ?
    """, (container_id,))
    
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        return jsonify({'error': 'Konteyner bulunamadı'}), 404
    
    # Tarihsel toplama verilerini çek (gerçek veri)
    cursor.execute("""
        SELECT 
            AVG(tonnage_collected) as avg_tonnage,
            AVG(fill_level_before) as avg_fill_before,
            COUNT(*) as collection_count
        FROM collection_events
        WHERE container_id = ?
    """, (container_id,))
    
    historical = cursor.fetchone()
    avg_tonnage = historical[0] if historical and historical[0] else 0.5
    avg_fill_before = historical[1] if historical and historical[1] else 0.5
    collection_count = historical[2] if historical and historical[2] else 10
    
    conn.close()
    
    # Özellikleri oluştur (gerçek verilerle)
    if row[3]:
        try:
            last_date = datetime.fromisoformat(row[3])
            hours_since = (datetime.now() - last_date).total_seconds() / 3600
        except:
            hours_since = 168
    else:
        hours_since = 168
    
    days_since = hours_since / 24
    now = datetime.now()
    day_of_week = now.weekday()
    is_weekend = int(now.weekday() >= 5)
    month = now.month
    season = (month % 12) // 3
    
    capacity = row[2] or 770
    container_type_map = {'underground': 4, '770lt': 3, '400lt': 2, 'plastic': 1}
    container_type_encoded = container_type_map.get(row[1], 2)
    
    population = row[8] if row[8] else 10000
    pop_density = row[9] if row[9] else 5000
    area = row[10] if row[10] else 2.0
    
    # Kapasite kullanım oranı (gerçek veri)
    capacity_usage_rate = avg_tonnage / (capacity / 1000) if capacity > 0 else 0.5
    
    features = [
        hours_since, days_since, day_of_week, is_weekend, month, season,
        capacity, container_type_encoded, population, pop_density, area,
        avg_tonnage, avg_fill_before, collection_count, capacity_usage_rate
    ]
    
    # Tahmin
    model = model_data['model']
    probabilities = model.predict_proba([features])[0]
    fill_probability = probabilities[1]
    
    return jsonify({
        'container_id': container_id,
        'neighborhood': row[7],
        'container_type': row[1],
        'capacity_liters': row[2],
        'current_fill_level': float(row[4]),
        'fill_probability': float(fill_probability),
        'is_full': bool(fill_probability >= 0.75),
        'confidence': float(max(probabilities)),
        'latitude': float(row[5]),
        'longitude': float(row[6]),
        'model_version': model_data['version'],
        'prediction_timestamp': datetime.now().isoformat()
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    """Kullanıcı kaydı - TC numarası ile"""
    from flask import request
    from werkzeug.security import generate_password_hash
    
    data = request.json
    
    required = ['name', 'tc_number', 'phone', 'password']
    if not all(k in data for k in required):
        return jsonify({'error': 'Tüm alanları doldurun'}), 400
    
    # TC numarası doğrulama (11 haneli)
    tc = str(data['tc_number']).strip()
    if len(tc) != 11 or not tc.isdigit():
        return jsonify({'error': 'TC numarası 11 haneli olmalıdır'}), 400
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # TC kontrolü
    cursor.execute("SELECT user_id FROM users WHERE tc_number = ?", (tc,))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Bu TC numarası zaten kayıtlı'}), 400
    
    # Şifre hash
    password_hash = generate_password_hash(data['password'])
    
    # Kullanıcıyı kaydet (email TC numarasından oluşturulur)
    email = f"{tc}@nilufer.local"
    cursor.execute("""
        INSERT INTO users (name, email, tc_number, phone, password_hash, role, trust_score)
        VALUES (?, ?, ?, ?, ?, 'citizen', 0.5)
    """, (data['name'], email, tc, data['phone'], password_hash))
    
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'success': True,
        'user_id': user_id,
        'message': 'Kayıt başarılı! Şimdi giriş yapabilirsiniz.'
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    """Kullanıcı girişi - TC numarası ile"""
    from flask import request
    from werkzeug.security import check_password_hash
    
    data = request.json
    
    if not data.get('tc_number') or not data.get('password'):
        return jsonify({'error': 'TC numarası ve şifre gerekli'}), 400
    
    tc = str(data['tc_number']).strip()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT user_id, name, tc_number, password_hash, role, trust_score, total_reports
        FROM users WHERE tc_number = ?
    """, (tc,))
    
    user = cursor.fetchone()
    conn.close()
    
    if not user or not check_password_hash(user[3], data['password']):
        return jsonify({'error': 'TC numarası veya şifre hatalı'}), 401
    
    return jsonify({
        'success': True,
        'user': {
            'id': user[0],
            'name': user[1],
            'tc_number': user[2],
            'role': user[4],
            'trust_score': float(user[5]),
            'total_reports': user[6]
        }
    })

@app.route('/api/containers/full')
def full_containers():
    """Dolu konteynerleri listele"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            n.neighborhood_name
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.current_fill_level >= 0.75
        ORDER BY c.current_fill_level DESC
        LIMIT 50
    """)
    
    containers = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'count': len(containers),
        'containers': [
            {
                'id': c[0],
                'type': c[1],
                'fill_level': float(c[2]),
                'latitude': float(c[3]),
                'longitude': float(c[4]),
                'neighborhood': c[5]
            }
            for c in containers
        ]
    })

@app.route('/api/containers/all')
def all_containers():
    """Tüm konteynerleri listele"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            c.capacity_liters,
            c.status,
            n.neighborhood_name
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.status = 'active'
        ORDER BY c.container_id ASC
    """)
    
    containers = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'count': len(containers),
        'containers': [
            {
                'id': c[0],
                'type': c[1],
                'fill_level': float(c[2]),
                'latitude': float(c[3]),
                'longitude': float(c[4]),
                'capacity': c[5],
                'status': c[6],
                'neighborhood': c[7]
            }
            for c in containers
        ]
    })

@app.route('/api/containers/map')
def containers_map():
    """Harita için tüm konteynerlerin lokasyonlarını döndür"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            c.container_id,
            c.container_type,
            c.current_fill_level,
            c.latitude,
            c.longitude,
            c.capacity_liters,
            n.neighborhood_name,
            c.last_collection_date
        FROM containers c
        LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
        WHERE c.status = 'active' 
        AND c.latitude IS NOT NULL 
        AND c.longitude IS NOT NULL
        ORDER BY c.current_fill_level DESC
    """)
    
    containers = cursor.fetchall()
    conn.close()
    
    return jsonify({
        'count': len(containers),
        'containers': [
            {
                'id': c[0],
                'type': c[1],
                'fill_level': float(c[2]),
                'lat': float(c[3]),
                'lng': float(c[4]),
                'capacity': c[5],
                'neighborhood': c[6],
                'last_collection': c[7]
            }
            for c in containers
        ]
    })

@app.route('/api/reports/submit', methods=['POST'])
def submit_report():
    """Vatandaş bildirimi gönder"""
    from flask import request
    
    data = request.json
    
    # Zorunlu alanlar
    if not all(k in data for k in ['user_id', 'container_id', 'fill_level']):
        return jsonify({'error': 'Eksik bilgi'}), 400
    
    user_id = data['user_id']
    container_id = data['container_id']
    fill_level = float(data['fill_level']) / 100.0  # Yüzdeyi 0-1 arasına çevir
    notes = data.get('notes', '')
    has_photo = data.get('has_photo', False)
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Kullanıcı bilgilerini al
    cursor.execute("SELECT trust_score, total_reports FROM users WHERE user_id = ?", (user_id,))
    user_info = cursor.fetchone()
    
    if not user_info:
        conn.close()
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
    
    current_trust = user_info[0]
    total_reports = user_info[1] if user_info[1] else 0
    
    # Konteyner mevcut doluluk seviyesini al
    cursor.execute("SELECT current_fill_level FROM containers WHERE container_id = ?", (container_id,))
    container_info = cursor.fetchone()
    
    if not container_info:
        conn.close()
        return jsonify({'error': 'Konteyner bulunamadı'}), 404
    
    actual_fill = container_info[0]
    
    # Doğruluk hesapla (fark ne kadar küçükse o kadar doğru)
    accuracy = 1.0 - abs(fill_level - actual_fill)
    accuracy = max(0.0, min(1.0, accuracy))  # 0-1 arası sınırla
    
    # Güven puanını güncelle
    # Doğru bildirim (+0.05), yanlış bildirim (-0.03)
    if accuracy >= 0.7:  # Doğru bildirim
        trust_change = 0.05
        status = 'verified'
    elif accuracy >= 0.4:  # Orta seviye
        trust_change = 0.01
        status = 'pending'
    else:  # Yanlış bildirim
        trust_change = -0.03
        status = 'rejected'
    
    # Fotoğraf varsa bonus
    if has_photo and current_trust < 0.7:
        trust_change += 0.02
    
    new_trust = current_trust + trust_change
    new_trust = max(0.0, new_trust)  # Sadece 0'ın altına düşmesin, üst sınır yok
    
    # Bildirimi kaydet (citizen_reports tablosu kullan)
    cursor.execute("""
        INSERT INTO citizen_reports 
        (user_id, container_id, fill_level_estimate, latitude, longitude, 
         notes, prediction_diff, is_verified, actual_full, submitted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, container_id, fill_level, 40.2, 28.9, 
          notes, abs(fill_level - actual_fill), 
          1 if status == 'verified' else 0, 
          int(actual_fill >= 0.75),
          datetime.now().isoformat()))
    
    # Kullanıcı istatistiklerini güncelle
    cursor.execute("""
        UPDATE users 
        SET trust_score = ?, 
            total_reports = ?,
            accurate_reports = CASE WHEN ? = 'verified' THEN accurate_reports + 1 ELSE accurate_reports END
        WHERE user_id = ?
    """, (new_trust, total_reports + 1, status, user_id))
    
    # Eğer bildirim doğrulanmışsa, konteyner doluluk seviyesini güncelle
    if status == 'verified' and accuracy >= 0.8:  # Çok doğru tahminlerde güncelle
        cursor.execute("""
            UPDATE containers 
            SET current_fill_level = ?,
                last_collection_date = ?
            WHERE container_id = ?
        """, (fill_level, datetime.now().isoformat(), container_id))
        
        # Model eğitim sayacını artır
        training_counter['verified_count'] += 1
        
        # Belirli sayıda doğru bildirimde model'i yeniden eğit
        if training_counter['verified_count'] >= training_counter['threshold']:
            conn.commit()
            conn.close()
            
            # Model'i arka planda eğit
            print(f"🔄 {training_counter['verified_count']} doğru bildirim toplandı, model yeniden eğitiliyor...")
            retrain_success = retrain_model()
            
            if retrain_success:
                training_counter['verified_count'] = 0  # Sayacı sıfırla
            
            return jsonify({
                'success': True,
                'message': 'Bildirim kaydedildi ve model güncellendi!',
                'report_status': status,
                'accuracy': round(accuracy * 100, 1),
                'trust_score': round(new_trust, 2),
                'total_reports': total_reports + 1,
                'trust_change': round(trust_change, 3),
                'model_updated': retrain_success
            })
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'success': True,
        'message': 'Bildirim başarıyla kaydedildi!',
        'report_status': status,
        'accuracy': round(accuracy * 100, 1),
        'trust_score': round(new_trust, 2),
        'total_reports': total_reports + 1,
        'trust_change': round(trust_change, 3)
    })

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """Basit simülasyon - Gerçek verilerle"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) FROM containers WHERE current_fill_level >= 0.75")
    full_containers = cursor.fetchone()[0]
    
    cursor.execute("SELECT COUNT(*) FROM vehicles")
    total_vehicles = cursor.fetchone()[0]
    
    # Araç tipleri ve sayıları
    cursor.execute("""
        SELECT vt.type_name, COUNT(v.vehicle_id) as count
        FROM vehicles v
        JOIN vehicle_types vt ON v.type_id = vt.type_id
        GROUP BY vt.type_name
    """)
    vehicle_counts = {row[0]: row[1] for row in cursor.fetchall()}
    
    conn.close()
    
    # Gerçek hesaplama
    small_count = vehicle_counts.get('Küçük Çöp Kamyonu', 0)
    large_count = vehicle_counts.get('Büyük Çöp Kamyonu', 0)
    crane_count = vehicle_counts.get('Vinçli Araç', 0)
    
    # Kapasite: küçük 4.5t, büyük 8t, vinçli 11.5t
    total_capacity = (small_count * 4.5 + large_count * 8 + crane_count * 11.5) * 8  # 8 saat
    
    estimated_hours = (full_containers * 0.5 / total_capacity) * 8 if total_capacity > 0 else 24
    estimated_cost = small_count * 500 + large_count * 800 + crane_count * 400
    
    return jsonify({
        'success': True,
        'results': {
            'total_vehicles': total_vehicles,
            'small_trucks': small_count,
            'large_trucks': large_count,
            'crane_vehicles': crane_count,
            'estimated_hours': round(estimated_hours, 2),
            'estimated_cost': estimated_cost,
            'containers_to_collect': full_containers,
            'efficiency': min(100, 100 - (estimated_hours / 24 * 100))
        }
    })

@app.route('/api/fleet/summary')
def fleet_summary():
    """Filo özeti - Gerçek CSV verilerinden"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Araç tipleri ve sayıları
    cursor.execute("""
        SELECT vt.type_name, COUNT(v.vehicle_id) as count, 
               AVG(vt.capacity_tons) as avg_capacity,
               SUM(vt.hourly_cost) as total_cost
        FROM vehicles v
        JOIN vehicle_types vt ON v.type_id = vt.type_id
        WHERE v.status = 'active'
        GROUP BY vt.type_name
    """)
    vehicle_data = cursor.fetchall()
    
    # Türkçe tip adlarını İngilizceye çevir
    type_mapping = {
        'Küçük Çöp Kamyonu': 'small_trucks',
        'Büyük Çöp Kamyonu': 'large_trucks',
        'Vinçli Araç': 'crane_vehicles'
    }
    
    result = {
        'small_trucks': 0,
        'large_trucks': 0,
        'crane_vehicles': 0,
        'total_vehicles': 0,
        'total_capacity_tons': 0
    }
    
    for row in vehicle_data:
        type_name, count, avg_cap, _ = row
        key = type_mapping.get(type_name, 'other')
        if key in result:
            result[key] = count
            result['total_vehicles'] += count
            result['total_capacity_tons'] += count * (avg_cap or 0)
    
    conn.close()
    
    return jsonify(result)

@app.route('/api/tonnage/monthly')
def tonnage_monthly():
    """Aylık tonaj verileri - Gerçek CSV verilerinden"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Son 12 ay tonaj verisi
    cursor.execute("""
        SELECT month, surface_tonnage, underground_tonnage, total_tonnage
        FROM tonnage_statistics
        ORDER BY rowid DESC
        LIMIT 12
    """)
    tonnage_data = cursor.fetchall()
    
    if tonnage_data:
        # Ortalama günlük tonaj hesapla
        total_monthly = sum(row[3] for row in tonnage_data if row[3]) / len(tonnage_data)
        avg_daily_tonnage = total_monthly / 30
        
        # Ortalama km (araç sayısına göre tahmin)
        cursor.execute("SELECT COUNT(*) FROM vehicles WHERE status='active'")
        vehicle_count = cursor.fetchone()[0]
        avg_daily_km = vehicle_count * 4  # Araç başına günde ortalama 4 km
    else:
        avg_daily_tonnage = 550
        avg_daily_km = 180
    
    conn.close()
    
    return jsonify({
        'monthly_data': [
            {
                'month': row[0],
                'surface_tonnage': row[1],
                'underground_tonnage': row[2],
                'total_tonnage': row[3]
            }
            for row in tonnage_data
        ],
        'avg_daily_tonnage': round(avg_daily_tonnage, 2),
        'avg_daily_km': round(avg_daily_km, 2)
    })

@app.route('/api/user/<int:user_id>/stats')
def user_stats(user_id):
    """Kullanıcı istatistikleri"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT name, trust_score, total_reports, accurate_reports
        FROM users WHERE user_id = ?
    """, (user_id,))
    
    user = cursor.fetchone()
    conn.close()
    
    if not user:
        return jsonify({'error': 'Kullanıcı bulunamadı'}), 404
    
    return jsonify({
        'name': user[0],
        'trust_score': float(user[1]) if user[1] else 0.5,
        'total_reports': user[2] or 0,
        'accurate_reports': user[3] or 0,
        'accuracy_rate': (user[3] / user[2] * 100) if user[2] and user[2] > 0 else 0
    })

# ============== FLEET ROUTE OPTIMIZATION ==============
@app.route('/api/fleet/optimize-routes', methods=['GET'])
def optimize_routes():
    """Her araç için optimize edilmiş rota oluştur"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        # Aktif araçları getir
        cursor.execute("""
            SELECT v.vehicle_id, v.plate_number, vt.type_name, vt.capacity_tons, vt.hourly_cost
            FROM vehicles v
            JOIN vehicle_types vt ON v.type_id = vt.type_id
            WHERE v.status = 'active'
            ORDER BY v.vehicle_id
        """)
        vehicles = [dict(row) for row in cursor.fetchall()]
        
        # Dolu konteynerleri getir (>%70 dolu olanlar)
        cursor.execute("""
            SELECT 
                container_id,
                latitude,
                longitude,
                container_type,
                current_fill_level,
                capacity_liters,
                neighborhood_id
            FROM containers
            WHERE status = 'active' 
            AND latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND current_fill_level >= 0.7
            ORDER BY current_fill_level DESC, neighborhood_id
        """)
        containers = [dict(row) for row in cursor.fetchall()]
        
        if not vehicles:
            conn.close()
            return jsonify({'success': False, 'message': 'Aktif araç bulunamadı'})
        
        if not containers:
            conn.close()
            return jsonify({'success': False, 'message': 'Toplanacak konteyner bulunamadı'})
        
        # Her araç için rota oluştur (Round-Robin + Geographic Clustering)
        routes = []
        containers_per_vehicle = len(containers) // len(vehicles)
        
        # Mahalleye göre grupla
        neighborhood_groups = {}
        for container in containers:
            nh_id = container['neighborhood_id']
            if nh_id not in neighborhood_groups:
                neighborhood_groups[nh_id] = []
            neighborhood_groups[nh_id].append(container)
        
        # Mahalle gruplarını sırala (en fazla konteynerden aza)
        sorted_neighborhoods = sorted(neighborhood_groups.items(), key=lambda x: len(x[1]), reverse=True)
        
        # Araçlara adil dağıt
        vehicle_assignments = {v['vehicle_id']: [] for v in vehicles}
        vehicle_idx = 0
        
        for nh_id, nh_containers in sorted_neighborhoods:
            # Bu mahalleyi bir araca ata
            target_vehicle = vehicles[vehicle_idx]['vehicle_id']
            vehicle_assignments[target_vehicle].extend(nh_containers)
            vehicle_idx = (vehicle_idx + 1) % len(vehicles)
        
        # Her araç için rota detayları oluştur
        for vehicle in vehicles:
            vehicle_id = vehicle['vehicle_id']
            assigned_containers = vehicle_assignments[vehicle_id]
            
            if not assigned_containers:
                continue
            
            # Gerçek yol rotası oluştur (OSRM kullanarak)
            route_geometry = []
            total_distance = 0
            total_time = 0
            
            # Konteynerleri koordinatlara çevir
            coordinates = [[c['longitude'], c['latitude']] for c in assigned_containers]
            
            if len(coordinates) > 1:
                # OSRM API'sine istek gönder (Demo sunucu)
                coords_str = ';'.join([f"{lon},{lat}" for lon, lat in coordinates])
                osrm_url = f"http://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=geojson"
                
                try:
                    response = requests.get(osrm_url, timeout=10)
                    if response.status_code == 200:
                        osrm_data = response.json()
                        if osrm_data.get('code') == 'Ok' and 'routes' in osrm_data:
                            route = osrm_data['routes'][0]
                            # Geometri (yol çizgisi)
                            route_geometry = route['geometry']['coordinates']
                            # Mesafe (metre -> km)
                            total_distance = route['distance'] / 1000
                            # Süre (saniye -> dakika) + her konteyner için 5 dk
                            total_time = (route['duration'] / 60) + (len(assigned_containers) * 5)
                        else:
                            # Fallback: düz çizgi
                            route_geometry = coordinates
                            total_distance = len(assigned_containers) * 2.5
                            total_time = (total_distance / 35) * 60 + (len(assigned_containers) * 5)
                    else:
                        # Fallback
                        route_geometry = coordinates
                        total_distance = len(assigned_containers) * 2.5
                        total_time = (total_distance / 35) * 60 + (len(assigned_containers) * 5)
                except Exception as e:
                    print(f"OSRM error for vehicle {vehicle_id}: {e}")
                    # Fallback
                    route_geometry = coordinates
                    total_distance = len(assigned_containers) * 2.5
                    total_time = (total_distance / 35) * 60 + (len(assigned_containers) * 5)
            else:
                # Tek konteyner
                route_geometry = coordinates
                total_distance = 2.5
                total_time = 10
            
            # Toplam ağırlık (ton cinsinden)
            total_weight_tons = sum(c['capacity_liters'] * c['current_fill_level'] * 0.0002 for c in assigned_containers)
            capacity_tons = vehicle['capacity_tons']
            
            # Rota noktaları (konteyner konumları - marker'lar için)
            route_points = [[c['latitude'], c['longitude']] for c in assigned_containers]
            
            routes.append({
                'vehicle_id': vehicle_id,
                'plate_number': vehicle['plate_number'],
                'vehicle_type': vehicle['type_name'],
                'capacity_tons': capacity_tons,
                'total_containers': len(assigned_containers),
                'total_distance_km': round(total_distance, 2),
                'estimated_time_min': round(total_time, 0),
                'total_weight_tons': round(total_weight_tons, 2),
                'capacity_usage': round((total_weight_tons / capacity_tons) * 100, 1) if capacity_tons > 0 else 0,
                'route_points': route_points,  # Konteyner konumları
                'route_geometry': [[lat, lon] for lon, lat in route_geometry],  # Gerçek yol geometrisi (Leaflet için lat,lon)
                'container_details': assigned_containers
            })
        
        # Genel istatistikler
        total_containers = len(containers)
        total_distance = sum(r['total_distance_km'] for r in routes)
        total_time = sum(r['estimated_time_min'] for r in routes)
        
        conn.close()
        
        return jsonify({
            'success': True,
            'summary': {
                'total_vehicles': len(vehicles),
                'total_containers': total_containers,
                'assigned_containers': sum(r['total_containers'] for r in routes),
                'total_distance_km': round(total_distance, 2),
                'total_time_hours': round(total_time / 60, 2),
                'avg_containers_per_vehicle': round(total_containers / len(vehicles), 1)
            },
            'routes': routes
        })
        
    except Exception as e:
        conn.close()
        return jsonify({'success': False, 'message': str(e)})

if __name__ == '__main__':
    print("=" * 60)
    print("NİLÜFER BELEDİYESİ - BACKEND API")
    print("=" * 60)
    print(f"\n✓ Model: {'Yüklü ✓' if model_data else 'YÜKLENMEDİ ✗'}")
    print(f"✓ Veritabanı: {DB_PATH}")
    print("\n🌐 URL'ler:")
    print("  Vatandaş: http://localhost:5000/")
    print("  Admin: http://localhost:5000/admin")
    print("\n" + "=" * 60 + "\n")
    
    app.run(debug=True, host='0.0.0.0', port=5000)
