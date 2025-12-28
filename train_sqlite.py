"""
Model Eğitimi - SQLite
"""

import sqlite3
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report
import joblib
import os

DB_PATH = 'nilufer_waste.db'

def train_model():
    """Modeli eğit"""
    print("=" * 60)
    print("MODEL EĞİTİMİ BAŞLIYOR")
    print("=" * 60)
    
    # Veriyi yükle
    conn = sqlite3.connect(DB_PATH)
    
    query = """
    SELECT 
        c.container_id,
        c.container_type,
        c.capacity_liters,
        c.last_collection_date,
        c.current_fill_level,
        n.population,
        n.population_density,
        n.area_km2,
        COUNT(DISTINCT ce.event_id) as collection_count,
        AVG(ce.tonnage_collected) as avg_tonnage,
        AVG(ce.fill_level_before) as avg_fill_before
    FROM containers c
    LEFT JOIN neighborhoods n ON c.neighborhood_id = n.neighborhood_id
    LEFT JOIN collection_events ce ON c.container_id = ce.container_id
    WHERE c.status = 'active'
    GROUP BY c.container_id
    HAVING collection_count > 0
    """
    
    df = pd.read_sql_query(query, conn)
    conn.close()
    
    print(f"\n📊 {len(df)} konteyner verisi yüklendi")
    
    if len(df) < 50:
        print("\n⚠️ Yeterli veri yok!")
        return False
    
    # Özellikler oluştur
    features = []
    
    for _, row in df.iterrows():
        # Zaman özellikleri
        if row['last_collection_date']:
            last_date = datetime.fromisoformat(row['last_collection_date'])
            hours_since = (datetime.now() - last_date).total_seconds() / 3600
        else:
            hours_since = 168
        
        days_since = hours_since / 24
        
        now = datetime.now()
        day_of_week = now.weekday()
        is_weekend = int(now.weekday() >= 5)
        month = now.month
        season = (month % 12) // 3
        
        # Konteyner özellikleri
        capacity = row['capacity_liters']
        container_type_map = {'underground': 4, '770lt': 3, '400lt': 2, 'plastic': 1}
        container_type_encoded = container_type_map.get(row['container_type'], 2)
        
        # Nüfus özellikleri
        population = row['population'] if row['population'] else 10000
        pop_density = row['population_density'] if row['population_density'] else 5000
        area = row['area_km2'] if row['area_km2'] else 2.0
        
        # Tarihsel
        avg_tonnage = row['avg_tonnage'] if row['avg_tonnage'] else 0.5
        avg_fill = row['avg_fill_before'] if row['avg_fill_before'] else 0.5
        collection_count = row['collection_count']
        capacity_usage = (avg_tonnage / (capacity / 1000)) if capacity > 0 else 0.5
        
        feature_vector = [
            hours_since, days_since, day_of_week, is_weekend, month, season,
            capacity, container_type_encoded, population, pop_density, area,
            avg_tonnage, avg_fill, collection_count, capacity_usage
        ]
        
        features.append(feature_vector)
    
    X = np.array(features)
    y = (df['current_fill_level'] >= 0.75).astype(int).values
    
    print(f"✓ {X.shape[1]} özellik oluşturuldu")
    print(f"\n📊 Sınıf Dağılımı:")
    print(f"  Dolu: {y.sum()} ({y.sum()/len(y)*100:.1f}%)")
    print(f"  Dolu değil: {len(y)-y.sum()} ({(len(y)-y.sum())/len(y)*100:.1f}%)")
    
    # Veriyi böl
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    print(f"\n📦 Eğitim: {len(X_train)}, Test: {len(X_test)}")
    
    # Eğit
    print("\n🤖 Random Forest eğitiliyor...")
    model = RandomForestClassifier(
        n_estimators=100,
        max_depth=10,
        random_state=42,
        class_weight='balanced'
    )
    
    model.fit(X_train, y_train)
    
    # Değerlendir
    y_pred_test = model.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred_test)
    
    print("\n" + "=" * 60)
    print("SONUÇLAR")
    print("=" * 60)
    print(f"\n✓ Test Doğruluğu: {test_acc:.4f} ({test_acc*100:.2f}%)")
    print("\n📋 Rapor:")
    print(classification_report(y_test, y_pred_test, target_names=['Dolu Değil', 'Dolu']))
    
    # Kaydet
    os.makedirs('models', exist_ok=True)
    model_data = {
        'model': model,
        'version': 'v1.0.0',
        'trained_at': datetime.now().isoformat()
    }
    
    joblib.dump(model_data, 'models/fill_predictor.pkl')
    print("\n💾 Model kaydedildi: models/fill_predictor.pkl")
    
    return True

if __name__ == "__main__":
    train_model()
