"""
Hızlı Demo - Basitleştirilmiş Veri Yükleme
"""

import sqlite3
import random
from datetime import datetime, timedelta

DB_PATH = 'nilufer_waste.db'

def quick_load():
    """Hızlı demo verisi yükle"""
    print("🚀 Hızlı demo verisi yükleniyor...")
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 10 mahalle ekle
    neighborhoods = [
        ('BARIŞ MAH.', 23320, 11660, 2.0),
        ('ÖZLÜCE MAH.', 15420, 7710, 2.0),
        ('KONAK MAH.', 12500, 6250, 2.0),
        ('BEŞEVLER MAH.', 18750, 9375, 2.0),
        ('ÇAMLICA MAH.', 9800, 4900, 2.0),
        ('ERTUğRUL MAH.', 11200, 5600, 2.0),
        ('GÖRÜKLE MAH.', 14300, 7150, 2.0),
        ('ALAADDINBEY MAH.', 8900, 4450, 2.0),
        ('YÜZÜNCÜYIL MAH.', 16800, 8400, 2.0),
        ('NİLÜFER MAH.', 13600, 6800, 2.0)
    ]
    
    for name, pop, dens, area in neighborhoods:
        cursor.execute("""
            INSERT OR IGNORE INTO neighborhoods 
            (neighborhood_name, population, population_density, area_km2)
            VALUES (?, ?, ?, ?)
        """, (name, pop, dens, area))
    
    # Konteynerleri oluştur
    cursor.execute("SELECT neighborhood_id, neighborhood_name FROM neighborhoods")
    neighborhoods_db = cursor.fetchall()
    
    container_count = 0
    for nid, nname in neighborhoods_db:
        # Her mahalle için 20-50 konteyner
        num_containers = random.randint(20, 50)
        
        for i in range(num_containers):
            container_type = random.choice(['underground', '770lt', '400lt', 'plastic'])
            capacity_map = {'underground': 5000, '770lt': 770, '400lt': 400, 'plastic': 240}
            capacity = capacity_map[container_type]
            
            # Rastgele koordinat
            lat = 40.2 + random.uniform(-0.05, 0.05)
            lng = 28.9 + random.uniform(-0.05, 0.05)
            
            # Son toplama (1-10 gün önce)
            days_ago = random.randint(1, 10)
            last_collection = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
            
            # Doluluk
            fill_level = min(0.95, days_ago * 0.08 + random.uniform(0, 0.2))
            
            cursor.execute("""
                INSERT INTO containers 
                (neighborhood_id, container_type, capacity_liters, latitude, longitude,
                 last_collection_date, current_fill_level, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
            """, (nid, container_type, capacity, lat, lng, last_collection, fill_level))
            
            container_count += 1
    
    # Toplama olayları (model eğitimi için)
    cursor.execute("SELECT container_id, capacity_liters FROM containers LIMIT 300")
    containers = cursor.fetchall()
    
    cursor.execute("SELECT vehicle_id FROM vehicles LIMIT 10")
    vehicles = [v[0] for v in cursor.fetchall()]
    
    if not vehicles:
        vehicles = [1]  # Fallback
    
    event_count = 0
    for container_id, capacity in containers:
        # Her konteyner için 2-4 toplama olayı
        for _ in range(random.randint(2, 4)):
            days_ago = random.randint(1, 60)
            collection_date = (datetime.now() - timedelta(days=days_ago)).strftime('%Y-%m-%d')
            
            fill_before = random.uniform(0.6, 0.95)
            tonnage = (capacity / 1000) * fill_before * random.uniform(0.8, 1.2)
            duration = random.randint(5, 20)
            
            cursor.execute("""
                INSERT INTO collection_events 
                (container_id, vehicle_id, collection_date, tonnage_collected,
                 fill_level_before, collection_duration_minutes)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (container_id, random.choice(vehicles), collection_date, tonnage, fill_before, duration))
            
            event_count += 1
    
    conn.commit()
    
    print(f"✓ {len(neighborhoods)} mahalle")
    print(f"✓ {container_count} konteyner")
    print(f"✓ {event_count} toplama olayı")
    
    conn.close()
    print("\n✅ Demo verisi hazır!\n")

if __name__ == "__main__":
    quick_load()
