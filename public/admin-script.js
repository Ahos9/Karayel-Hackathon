// Admin Dashboard JavaScript

// ============== TAB NAVIGATION ==============
function showTab(tabName) {
    // Hide all tabs
    const tabs = document.querySelectorAll('.tab-content');
    tabs.forEach(tab => tab.style.display = 'none');
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.admin-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    
    // Show selected tab
    document.getElementById(`${tabName}-tab`).style.display = 'block';
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// ============== FLEET CHANGE CALCULATIONS ==============
document.addEventListener('DOMContentLoaded', function() {
    // Set default dates
    const today = new Date();
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');
    
    if (startDateInput) {
        startDateInput.value = today.toISOString().split('T')[0];
    }
    
    if (endDateInput) {
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 30); // 30 days later
        endDateInput.value = endDate.toISOString().split('T')[0];
    }
    
    const fleetInputs = [
        { input: 'smallTruckChange', current: 5, total: 'smallTruckTotal' },
        { input: 'largeTruckChange', current: 10, total: 'largeTruckTotal' },
        { input: 'compactorChange', current: 3, total: 'compactorTotal' }
    ];
    
    fleetInputs.forEach(fleet => {
        const input = document.getElementById(fleet.input);
        const totalElement = document.getElementById(fleet.total);
        
        if (input && totalElement) {
            input.addEventListener('input', function() {
                const change = parseInt(this.value) || 0;
                const newTotal = fleet.current + change;
                totalElement.textContent = newTotal;
                
                // Highlight if changed
                if (change !== 0) {
                    totalElement.style.fontWeight = '700';
                    totalElement.style.color = change > 0 ? '#00A651' : '#E74C3C';
                } else {
                    totalElement.style.fontWeight = 'normal';
                    totalElement.style.color = 'inherit';
                }
            });
        }
    });
});

// ============== SIMULATION ENGINE ==============
async function runSimulation() {
    const button = document.querySelector('.run-simulation-btn');
    const resultsPanel = document.getElementById('resultsPanel');
    
    // Get input values
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    const simName = document.getElementById('simName').value || 'Adsız Simülasyon';
    
    const fleetChanges = {
        small_trucks: parseInt(document.getElementById('smallTruckChange').value) || 0,
        large_trucks: parseInt(document.getElementById('largeTruckChange').value) || 0,
        compactors: parseInt(document.getElementById('compactorChange').value) || 0
    };
    
    const parameters = {
        fuel_price: parseFloat(document.getElementById('fuelPrice').value) || 44.50,
        max_route_duration: parseInt(document.getElementById('maxRouteDuration').value) || 8
    };
    
    // Validate
    if (!startDate || !endDate) {
        alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
        return;
    }
    
    // Calculate days between dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    
    if (daysDiff <= 0) {
        alert('Bitiş tarihi başlangıç tarihinden sonra olmalıdır.');
        return;
    }
    
    parameters.days = daysDiff;
    
    // Show loading state
    button.disabled = true;
    button.textContent = 'Gerçek Veriler Analiz Ediliyor...';
    resultsPanel.classList.remove('visible');
    
    try {
        // Gerçek verilerle simülasyon hesapla
        const results = await calculateSimulation(fleetChanges, parameters);
        
        // Display results
        displayResults(results);
        
        // Gerçek veri kullanıldığını göster
        if (results.real_data) {
            console.log('✓ Simülasyon gerçek API verileriyle hesaplandı');
        } else {
            console.log('⚠ Simülasyon fallback verileriyle hesaplandı');
        }
        
        // Show results panel
        resultsPanel.classList.add('visible');
        
        // Scroll to results
        resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (error) {
        console.error('Simülasyon hatası:', error);
        alert('Simülasyon sırasında bir hata oluştu.');
    } finally {
        // Reset button
        button.disabled = false;
        button.textContent = 'Simülasyonu Çalıştır';
    }
}

// ============== SIMULATION CALCULATIONS WITH REAL DATA ==============
async function calculateSimulation(fleetChanges, parameters) {
    // Gerçek veritabanı verilerini API'den çek
    try {
        const statsResponse = await fetch('/api/dashboard/stats');
        const stats = await statsResponse.json();
        
        const fleetResponse = await fetch('/api/fleet/summary');
        const fleetData = await fleetResponse.json();
        
        const tonnageResponse = await fetch('/api/tonnage/monthly');
        const tonnageData = await tonnageResponse.json();
        
        // Gerçek filo bilgileri
        const currentFleet = {
            small_trucks: fleetData?.small_trucks || 5,
            large_trucks: fleetData?.large_trucks || 20,
            crane_vehicles: fleetData?.crane_vehicles || 10
        };
        
        // Gerçek günlük ortalama değerler (veritabanından)
        const avgDailyTonnage = tonnageData?.avg_daily_tonnage || 550; // ton/gün
        const avgDailyKm = tonnageData?.avg_daily_km || 180; // km/gün
        
        // Gerçek araç verimliliği ve maliyetleri
        const vehicleSpecs = {
            small: { 
                capacity_tons: 4.5, 
                fuel_per_km: 0.20, 
                co2_per_km: 0.52,
                daily_maintenance: 150,  // TL/gün bakım
                daily_driver_cost: 800   // TL/gün şoför
            },
            large: { 
                capacity_tons: 8.0, 
                fuel_per_km: 0.35, 
                co2_per_km: 0.91,
                daily_maintenance: 250,
                daily_driver_cost: 900
            },
            crane: { 
                capacity_tons: 11.5, 
                fuel_per_km: 0.45, 
                co2_per_km: 1.17,
                daily_maintenance: 350,
                daily_driver_cost: 1000
            }
        };
        
        // Gerçek yakıt fiyatı ve parametreler
        const days = parameters.days || 30;
        const fuelPrice = parameters.fuel_price || 44.50; // TL/L gerçek fiyat
        
        // Her araç tipi için günlük ortalama km (dağılım ağırlıklı)
        const dailyKmPerVehicle = {
            small: avgDailyKm * 0.8,  // Küçük araçlar daha az km
            large: avgDailyKm * 1.0,  // Büyük araçlar normal
            crane: avgDailyKm * 0.6   // Vinçli araçlar en az
        };
        
        // ===== BASELINE (MEVCUT DURUM) HESAPLAMA =====
        const baselineFuelPerDay = 
            currentFleet.small_trucks * dailyKmPerVehicle.small * vehicleSpecs.small.fuel_per_km +
            currentFleet.large_trucks * dailyKmPerVehicle.large * vehicleSpecs.large.fuel_per_km +
            currentFleet.crane_vehicles * dailyKmPerVehicle.crane * vehicleSpecs.crane.fuel_per_km;
        
        const baselineCO2PerDay = 
            currentFleet.small_trucks * dailyKmPerVehicle.small * vehicleSpecs.small.co2_per_km +
            currentFleet.large_trucks * dailyKmPerVehicle.large * vehicleSpecs.large.co2_per_km +
            currentFleet.crane_vehicles * dailyKmPerVehicle.crane * vehicleSpecs.crane.co2_per_km;
        
        const baselineKmPerDay = 
            currentFleet.small_trucks * dailyKmPerVehicle.small +
            currentFleet.large_trucks * dailyKmPerVehicle.large +
            currentFleet.crane_vehicles * dailyKmPerVehicle.crane;
        
        const baselineMaintenancePerDay = 
            currentFleet.small_trucks * vehicleSpecs.small.daily_maintenance +
            currentFleet.large_trucks * vehicleSpecs.large.daily_maintenance +
            currentFleet.crane_vehicles * vehicleSpecs.crane.daily_maintenance;
        
        const baselinePersonnelPerDay = 
            currentFleet.small_trucks * vehicleSpecs.small.daily_driver_cost +
            currentFleet.large_trucks * vehicleSpecs.large.daily_driver_cost +
            currentFleet.crane_vehicles * vehicleSpecs.crane.daily_driver_cost;
        
        const baselineFuelCostPerDay = baselineFuelPerDay * fuelPrice;
        const baselineTotalCostPerDay = baselineFuelCostPerDay + baselineMaintenancePerDay + baselinePersonnelPerDay;
        
        const baselineCapacity = 
            currentFleet.small_trucks * vehicleSpecs.small.capacity_tons +
            currentFleet.large_trucks * vehicleSpecs.large.capacity_tons +
            currentFleet.crane_vehicles * vehicleSpecs.crane.capacity_tons;
        
        const baseline = {
            km_driven: Math.round(baselineKmPerDay * days),
            fuel_consumed: Math.round(baselineFuelPerDay * days),
            co2_emissions: Math.round(baselineCO2PerDay * days),
            cost: Math.round(baselineTotalCostPerDay * days),
            collection_rate: 100,
            satisfaction: 95,
            routes: Math.round((currentFleet.small_trucks + currentFleet.large_trucks + currentFleet.crane_vehicles) * 1.5 * days),
            tonnage: Math.round(avgDailyTonnage * days * 1000) // kg cinsinden
        };
        
        // ===== SİMÜLE EDİLEN DURUM (YENİ FİLO) =====
        const newSmall = Math.max(0, currentFleet.small_trucks + fleetChanges.small_trucks);
        const newLarge = Math.max(0, currentFleet.large_trucks + fleetChanges.large_trucks);
        const newCrane = Math.max(0, currentFleet.crane_vehicles + fleetChanges.compactors);
        const totalVehicles = newSmall + newLarge + newCrane;
        const baselineTotalVehicles = currentFleet.small_trucks + currentFleet.large_trucks + currentFleet.crane_vehicles;
        
        // Yeni filo kapasitesi
        const newCapacity = 
            newSmall * vehicleSpecs.small.capacity_tons +
            newLarge * vehicleSpecs.large.capacity_tons +
            newCrane * vehicleSpecs.crane.capacity_tons;
        
        // Kapasite oranı - toplama ihtiyacını karşılama durumu
        const capacityRatio = newCapacity / avgDailyTonnage;
        
        // Yeni filo günlük yakıt tüketimi
        const simFuelPerDay = 
            newSmall * dailyKmPerVehicle.small * vehicleSpecs.small.fuel_per_km +
            newLarge * dailyKmPerVehicle.large * vehicleSpecs.large.fuel_per_km +
            newCrane * dailyKmPerVehicle.crane * vehicleSpecs.crane.fuel_per_km;
        
        // Yeni filo günlük CO2
        const simCO2PerDay = 
            newSmall * dailyKmPerVehicle.small * vehicleSpecs.small.co2_per_km +
            newLarge * dailyKmPerVehicle.large * vehicleSpecs.large.co2_per_km +
            newCrane * dailyKmPerVehicle.crane * vehicleSpecs.crane.co2_per_km;
        
        // Yeni filo günlük km
        const simKmPerDay = 
            newSmall * dailyKmPerVehicle.small +
            newLarge * dailyKmPerVehicle.large +
            newCrane * dailyKmPerVehicle.crane;
        
        // Yeni filo günlük bakım maliyeti
        const simMaintenancePerDay = 
            newSmall * vehicleSpecs.small.daily_maintenance +
            newLarge * vehicleSpecs.large.daily_maintenance +
            newCrane * vehicleSpecs.crane.daily_maintenance;
        
        // Yeni filo günlük personel maliyeti
        const simPersonnelPerDay = 
            newSmall * vehicleSpecs.small.daily_driver_cost +
            newLarge * vehicleSpecs.large.daily_driver_cost +
            newCrane * vehicleSpecs.crane.daily_driver_cost;
        
        // Yeni filo günlük yakıt maliyeti
        const simFuelCostPerDay = simFuelPerDay * fuelPrice;
        
        // Yeni filo toplam günlük maliyet
        const simTotalCostPerDay = simFuelCostPerDay + simMaintenancePerDay + simPersonnelPerDay;
        
        // Toplama oranı - kapasite yetersizse düşer
        const collectionRate = Math.min(100, Math.round(capacityRatio * 100));
        
        // Memnuniyet - kapasite düşerse hizmet kalitesi düşer
        let satisfaction = 95;
        if (capacityRatio < 1.0) {
            satisfaction = Math.round(95 * capacityRatio); // Kapasite yetersizse memnuniyet düşer
        } else if (capacityRatio > 1.2) {
            satisfaction = 97; // Fazla kapasite biraz memnuniyet artırır
        }
        
        const simulated = {
            km_driven: Math.round(simKmPerDay * days),
            fuel_consumed: Math.round(simFuelPerDay * days),
            co2_emissions: Math.round(simCO2PerDay * days),
            cost: Math.round(simTotalCostPerDay * days),
            collection_rate: collectionRate,
            satisfaction: satisfaction,
            routes: Math.round(totalVehicles * 1.5 * days),
            tonnage: Math.round(Math.min(avgDailyTonnage, newCapacity) * days * 1000) // Kapasite kadar toplanabilir
        };
        
        // Değişim hesaplamaları
        const changes = {
            km: simulated.km_driven - baseline.km_driven,
            fuel: simulated.fuel_consumed - baseline.fuel_consumed,
            co2: simulated.co2_emissions - baseline.co2_emissions,
            cost: simulated.cost - baseline.cost,
            collection_rate: simulated.collection_rate - baseline.collection_rate,
            satisfaction: simulated.satisfaction - baseline.satisfaction,
            routes: simulated.routes - baseline.routes,
            tonnage: simulated.tonnage - baseline.tonnage
        };
        
        const percentages = {
            km: ((changes.km / baseline.km_driven) * 100).toFixed(1),
            fuel: ((changes.fuel / baseline.fuel_consumed) * 100).toFixed(1),
            co2: ((changes.co2 / baseline.co2_emissions) * 100).toFixed(1),
            cost: ((changes.cost / baseline.cost) * 100).toFixed(1),
            collection_rate: (changes.collection_rate).toFixed(1),
            routes: ((changes.routes / baseline.routes) * 100).toFixed(1),
            tonnage: ((changes.tonnage / baseline.tonnage) * 100).toFixed(1)
        };
        
        const recommendation = generateRecommendation(changes, 
            fleetChanges.small_trucks + fleetChanges.large_trucks + fleetChanges.compactors, days);
        
        return {
            baseline,
            simulated,
            changes,
            percentages,
            recommendation,
            fleetChanges,
            days,
            real_data: true
        };
        
    } catch (error) {
        console.error('Gerçek veri çekme hatası, fallback kullanılıyor:', error);
        // Fallback: Dosyadan okunan gerçek değerler
        return calculateSimulationFallback(fleetChanges, parameters);
    }
}

// Fallback fonksiyonu - API çalışmazsa CSV'deki gerçek verilerle hesapla
function calculateSimulationFallback(fleetChanges, parameters) {
    // Gerçek CSV verilerinden: tonnages.csv ortalaması
    const realMonthlyTonnage = 17000; // ton/ay (CSV ortalaması)
    const realDailyTonnage = realMonthlyTonnage / 30; // ~567 ton/gün
    
    // fleet.csv'den gerçek araç sayıları
    const currentFleet = {
        small_trucks: 5,  // Small Garbage Truck sayısı
        large_trucks: 20, // Large Garbage Truck sayısı  
        crane_vehicles: 20 // Crane Vehicle sayısı
    };
    
    // truck_types.csv'den gerçek kapasiteler ve maliyetler
    const vehicleSpecs = {
        small: { 
            capacity_tons: 4.5, 
            fuel_per_km: 0.20, 
            co2_per_km: 0.52,
            daily_maintenance: 150,
            daily_driver_cost: 800,
            daily_km: 144  // 180 * 0.8
        },
        large: { 
            capacity_tons: 8.0, 
            fuel_per_km: 0.35, 
            co2_per_km: 0.91,
            daily_maintenance: 250,
            daily_driver_cost: 900,
            daily_km: 180
        },
        crane: { 
            capacity_tons: 11.5, 
            fuel_per_km: 0.45, 
            co2_per_km: 1.17,
            daily_maintenance: 350,
            daily_driver_cost: 1000,
            daily_km: 108  // 180 * 0.6
        }
    };
    
    const days = parameters.days || 30;
    const fuelPrice = parameters.fuel_price || 44.50;
    
    // ===== BASELINE HESAPLAMA =====
    const baselineFuelPerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_km * vehicleSpecs.small.fuel_per_km +
        currentFleet.large_trucks * vehicleSpecs.large.daily_km * vehicleSpecs.large.fuel_per_km +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.fuel_per_km;
    
    const baselineCO2PerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_km * vehicleSpecs.small.co2_per_km +
        currentFleet.large_trucks * vehicleSpecs.large.daily_km * vehicleSpecs.large.co2_per_km +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.co2_per_km;
    
    const baselineKmPerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_km +
        currentFleet.large_trucks * vehicleSpecs.large.daily_km +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_km;
    
    const baselineMaintenancePerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_maintenance +
        currentFleet.large_trucks * vehicleSpecs.large.daily_maintenance +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_maintenance;
    
    const baselinePersonnelPerDay = 
        currentFleet.small_trucks * vehicleSpecs.small.daily_driver_cost +
        currentFleet.large_trucks * vehicleSpecs.large.daily_driver_cost +
        currentFleet.crane_vehicles * vehicleSpecs.crane.daily_driver_cost;
    
    const baselineFuelCostPerDay = baselineFuelPerDay * fuelPrice;
    const baselineTotalCostPerDay = baselineFuelCostPerDay + baselineMaintenancePerDay + baselinePersonnelPerDay;
    
    const baselineCapacity = 
        currentFleet.small_trucks * vehicleSpecs.small.capacity_tons +
        currentFleet.large_trucks * vehicleSpecs.large.capacity_tons +
        currentFleet.crane_vehicles * vehicleSpecs.crane.capacity_tons;
    
    const baselineTotalVehicles = currentFleet.small_trucks + currentFleet.large_trucks + currentFleet.crane_vehicles;
    
    const baseline = {
        km_driven: Math.round(baselineKmPerDay * days),
        fuel_consumed: Math.round(baselineFuelPerDay * days),
        co2_emissions: Math.round(baselineCO2PerDay * days),
        cost: Math.round(baselineTotalCostPerDay * days),
        collection_rate: 100,
        satisfaction: 95,
        routes: Math.round(baselineTotalVehicles * 1.5 * days),
        tonnage: Math.round(realDailyTonnage * days * 1000)
    };
    
    // ===== YENİ FİLO İLE HESAPLAMA =====
    const newSmall = Math.max(0, currentFleet.small_trucks + fleetChanges.small_trucks);
    const newLarge = Math.max(0, currentFleet.large_trucks + fleetChanges.large_trucks);
    const newCrane = Math.max(0, currentFleet.crane_vehicles + fleetChanges.compactors);
    const totalVehicles = newSmall + newLarge + newCrane;
    
    // Yeni kapasite
    const newCapacity = 
        newSmall * vehicleSpecs.small.capacity_tons +
        newLarge * vehicleSpecs.large.capacity_tons +
        newCrane * vehicleSpecs.crane.capacity_tons;
    
    const capacityRatio = newCapacity / realDailyTonnage;
    
    // Yeni filo günlük değerleri
    const simFuelPerDay = 
        newSmall * vehicleSpecs.small.daily_km * vehicleSpecs.small.fuel_per_km +
        newLarge * vehicleSpecs.large.daily_km * vehicleSpecs.large.fuel_per_km +
        newCrane * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.fuel_per_km;
    
    const simCO2PerDay = 
        newSmall * vehicleSpecs.small.daily_km * vehicleSpecs.small.co2_per_km +
        newLarge * vehicleSpecs.large.daily_km * vehicleSpecs.large.co2_per_km +
        newCrane * vehicleSpecs.crane.daily_km * vehicleSpecs.crane.co2_per_km;
    
    const simKmPerDay = 
        newSmall * vehicleSpecs.small.daily_km +
        newLarge * vehicleSpecs.large.daily_km +
        newCrane * vehicleSpecs.crane.daily_km;
    
    const simMaintenancePerDay = 
        newSmall * vehicleSpecs.small.daily_maintenance +
        newLarge * vehicleSpecs.large.daily_maintenance +
        newCrane * vehicleSpecs.crane.daily_maintenance;
    
    const simPersonnelPerDay = 
        newSmall * vehicleSpecs.small.daily_driver_cost +
        newLarge * vehicleSpecs.large.daily_driver_cost +
        newCrane * vehicleSpecs.crane.daily_driver_cost;
    
    const simFuelCostPerDay = simFuelPerDay * fuelPrice;
    const simTotalCostPerDay = simFuelCostPerDay + simMaintenancePerDay + simPersonnelPerDay;
    
    // Toplama oranı
    const collectionRate = Math.min(100, Math.round(capacityRatio * 100));
    
    // Memnuniyet
    let satisfaction = 95;
    if (capacityRatio < 1.0) {
        satisfaction = Math.round(95 * capacityRatio);
    } else if (capacityRatio > 1.2) {
        satisfaction = 97;
    }
    
    const simulated = {
        km_driven: Math.round(simKmPerDay * days),
        fuel_consumed: Math.round(simFuelPerDay * days),
        co2_emissions: Math.round(simCO2PerDay * days),
        cost: Math.round(simTotalCostPerDay * days),
        collection_rate: collectionRate,
        satisfaction: satisfaction,
        routes: Math.round(totalVehicles * 1.5 * days),
        tonnage: Math.round(Math.min(realDailyTonnage, newCapacity) * days * 1000)
    };
    
    const changes = {
        km: simulated.km_driven - baseline.km_driven,
        fuel: simulated.fuel_consumed - baseline.fuel_consumed,
        co2: simulated.co2_emissions - baseline.co2_emissions,
        cost: simulated.cost - baseline.cost,
        collection_rate: simulated.collection_rate - baseline.collection_rate,
        satisfaction: simulated.satisfaction - baseline.satisfaction,
        routes: simulated.routes - baseline.routes,
        tonnage: simulated.tonnage - baseline.tonnage
    };
    
    const percentages = {
        km: baseline.km_driven !== 0 ? ((changes.km / baseline.km_driven) * 100).toFixed(1) : '0.0',
        fuel: baseline.fuel_consumed !== 0 ? ((changes.fuel / baseline.fuel_consumed) * 100).toFixed(1) : '0.0',
        co2: baseline.co2_emissions !== 0 ? ((changes.co2 / baseline.co2_emissions) * 100).toFixed(1) : '0.0',
        cost: baseline.cost !== 0 ? ((changes.cost / baseline.cost) * 100).toFixed(1) : '0.0',
        collection_rate: (changes.collection_rate).toFixed(1),
        routes: baseline.routes !== 0 ? ((changes.routes / baseline.routes) * 100).toFixed(1) : '0.0',
        tonnage: baseline.tonnage !== 0 ? ((changes.tonnage / baseline.tonnage) * 100).toFixed(1) : '0.0'
    };
    
    const totalChange = fleetChanges.small_trucks + fleetChanges.large_trucks + fleetChanges.compactors;
    const recommendation = generateRecommendation(changes, totalChange, days);
    
    return {
        baseline,
        simulated,
        changes,
        percentages,
        recommendation,
        fleetChanges,
        days,
        real_data: false
    };
}

// ============== RECOMMENDATION ENGINE ==============
function generateRecommendation(changes, totalChange, days) {
    let score = 0;
    const reasons = [];
    const periodText = days === 1 ? '1 günlük' : `${days} günlük`;
    
    // Maliyet değerlendirmesi (en önemli faktör)
    if (changes.cost < 0) {
        score += 35;
        reasons.push(`${periodText} ${Math.abs(changes.cost).toLocaleString('tr-TR')} ₺ tasarruf sağlar`);
    } else if (changes.cost > 0) {
        score -= 25;
        reasons.push(`${periodText} ${Math.abs(changes.cost).toLocaleString('tr-TR')} ₺ ek maliyet getirir`);
    }
    
    // Yakıt tasarrufu
    if (changes.fuel < 0) {
        score += 15;
        reasons.push(`${Math.abs(changes.fuel).toLocaleString('tr-TR')} L yakıt tasarrufu`);
    } else if (changes.fuel > 0) {
        score -= 10;
        reasons.push(`${Math.abs(changes.fuel).toLocaleString('tr-TR')} L ek yakıt tüketimi`);
    }
    
    // Çevresel etki
    if (changes.co2 < 0) {
        score += 15;
        reasons.push(`${Math.abs(changes.co2).toLocaleString('tr-TR')} kg CO₂ emisyon azalması`);
    } else if (changes.co2 > 0) {
        score -= 10;
        reasons.push(`${Math.abs(changes.co2).toLocaleString('tr-TR')} kg CO₂ emisyon artışı`);
    }
    
    // Hizmet kalitesi - toplama oranı (kritik)
    if (changes.collection_rate >= 0) {
        score += 20;
        reasons.push('Hizmet kalitesi korunuyor veya artıyor');
    } else if (changes.collection_rate >= -5) {
        score += 5;
        reasons.push(`Hizmet kalitesinde minimal düşüş (%${Math.abs(changes.collection_rate).toFixed(1)})`);
    } else if (changes.collection_rate >= -15) {
        score -= 20;
        reasons.push(`Hizmet kalitesinde düşüş (%${Math.abs(changes.collection_rate).toFixed(1)})`);
    } else {
        score -= 40;
        reasons.push(`⚠️ Kritik: Hizmet kalitesinde ciddi düşüş (%${Math.abs(changes.collection_rate).toFixed(1)})`);
    }
    
    // Memnuniyet
    if (changes.satisfaction >= 0) {
        score += 10;
    } else if (changes.satisfaction < -5) {
        score -= 15;
        reasons.push(`Vatandaş memnuniyetinde düşüş (${changes.satisfaction} puan)`);
    }
    
    // Determine recommendation level
    let level, cssClass, action;
    
    if (score >= 60) {
        level = 'ŞIDDETLE TAVSİYE EDİLİR';
        cssClass = 'recommended';
        action = 'Bu filo konfigürasyonunu hemen uygulayın. Maliyet ve verimlilik optimum.';
    } else if (score >= 35) {
        level = 'TAVSİYE EDİLİR';
        cssClass = 'recommended';
        action = 'Bu değişiklik faydalı görünüyor. Uygulama öncesi detaylı analiz yapın.';
    } else if (score >= 10) {
        level = 'NÖTR';
        cssClass = 'neutral';
        action = 'Marjinal faydalar mevcut. İsteğe bağlı uygulama yapılabilir.';
    } else if (score >= -15) {
        level = 'DİKKATLİ OLUN';
        cssClass = 'neutral';
        action = 'Bu değişiklik bazı riskleri beraberinde getirir. Dikkatli değerlendirin.';
    } else {
        level = 'TAVSİYE EDİLMEZ';
        cssClass = 'not-recommended';
        action = 'Bu konfigürasyon hizmet kalitesini olumsuz etkiler. Uygulamayın.';
    }
    
    return {
        level,
        cssClass,
        action,
        score,
        reasons
    };
}

// ============== DISPLAY RESULTS ==============
function displayResults(results) {
    const { baseline, simulated, changes, percentages, recommendation } = results;
    
    // Update recommendation box
    const recBox = document.getElementById('recommendationBox');
    recBox.className = `recommendation-box ${recommendation.cssClass}`;
    
    document.getElementById('recommendationTitle').textContent = 
        `📊 TAVSİYE: ${recommendation.level}`;
    document.getElementById('recommendationText').textContent = 
        recommendation.action;
    
    // Update reasons list
    const reasonsList = document.getElementById('recommendationReasons');
    reasonsList.innerHTML = recommendation.reasons
        .map(reason => `<li>${reason}</li>`)
        .join('');
    
    // Update metric cards
    updateMetricCard('km', simulated.km_driven, changes.km, percentages.km);
    updateMetricCard('fuel', simulated.fuel_consumed, changes.fuel, percentages.fuel, 'L');
    updateMetricCard('co2', simulated.co2_emissions, changes.co2, percentages.co2, 'kg');
    updateMetricCard('cost', simulated.cost, changes.cost, percentages.cost, '₺');
    updateMetricCard('collectionRate', simulated.collection_rate.toFixed(1), changes.collection_rate, percentages.collection_rate, '%');
    updateMetricCard('satisfaction', simulated.satisfaction, changes.satisfaction, null);
    
    // Update detailed comparison table
    updateComparisonTable(baseline, simulated, changes, percentages);
}

function updateComparisonTable(baseline, simulated, changes, percentages) {
    const tbody = document.getElementById('comparisonTableBody');
    if (!tbody) return;
    
    const rows = [
        {
            label: 'Toplanan Atık (kg)',
            baseline: baseline.tonnage,
            simulated: simulated.tonnage,
            change: changes.tonnage,
            percentage: percentages.tonnage
        },
        {
            label: 'Toplam Kilometre',
            baseline: baseline.km_driven,
            simulated: simulated.km_driven,
            change: changes.km,
            percentage: percentages.km
        },
        {
            label: 'Yakıt Tüketimi (L)',
            baseline: baseline.fuel_consumed,
            simulated: simulated.fuel_consumed,
            change: changes.fuel,
            percentage: percentages.fuel
        }
    ];
    
    tbody.innerHTML = rows.map(row => {
        const changeClass = row.change < 0 ? 'positive' : 'negative';
        const changeSign = row.change >= 0 ? '+' : '';
        const changeText = `${changeSign}${row.change.toLocaleString('tr-TR')} (${changeSign}${row.percentage}%)`;
        
        return `
            <tr>
                <td>${row.label}</td>
                <td>${row.baseline.toLocaleString('tr-TR')}</td>
                <td>${row.simulated.toLocaleString('tr-TR')}</td>
                <td class="${changeClass}">${changeText}</td>
            </tr>
        `;
    }).join('');
}

function updateMetricCard(prefix, value, change, percentage, unit = '') {
    const valueElement = document.getElementById(`${prefix}Value`);
    const changeElement = document.getElementById(`${prefix}Change`);
    
    if (valueElement) {
        if (unit === '₺' || unit === '') {
            valueElement.textContent = `${value.toLocaleString('tr-TR')} ${unit}`;
        } else if (unit === '%') {
            valueElement.textContent = `${value}${unit}`;
        } else {
            valueElement.textContent = `${value.toLocaleString('tr-TR')} ${unit}`;
        }
    }
    
    if (changeElement) {
        const isPositive = change < 0; // For cost/emissions, negative is good
        changeElement.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
        
        const sign = change >= 0 ? '+' : '';
        
        if (percentage !== null) {
            if (unit === '%') {
                changeElement.textContent = `${sign}${change.toFixed(1)} puan`;
            } else {
                changeElement.textContent = `${sign}${change.toLocaleString('tr-TR')} ${unit} (${sign}${percentage}%)`;
            }
        } else {
            changeElement.textContent = `${sign}${change} puan`;
        }
    }
}

// ============== EXPORT & SAVE FUNCTIONS ==============
function exportReport() {
    alert('Rapor PDF olarak indiriliyor...\n(Bu özellik geliştirme aşamasındadır)');
    console.log('Export report functionality would generate PDF here');
}

// ============== FLEET ROUTE OPTIMIZATION ==============
let fleetMap = null;
let routeData = null;
let routeLayers = {};
let selectedVehicleId = null;

function optimizeRoutes() {
    const button = event.target;
    button.disabled = true;
    button.textContent = 'Rotalar Optimize Ediliyor...';
    
    fetch('/api/fleet/optimize-routes')
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                routeData = data;
                displayRouteSummary(data.summary);
                displayVehicleList(data.routes);
                initializeMap();
            } else {
                alert('Hata: ' + data.message);
            }
        })
        .catch(err => {
            console.error('Route optimization error:', err);
            alert('Rota optimizasyonu sırasında hata oluştu');
        })
        .finally(() => {
            button.disabled = false;
            button.textContent = 'Rotaları Optimize Et';
        });
}

function displayRouteSummary(summary) {
    document.getElementById('routeSummary').style.display = 'block';
    document.getElementById('summaryVehicles').textContent = summary.total_vehicles;
    document.getElementById('summaryContainers').textContent = summary.assigned_containers;
    document.getElementById('summaryDistance').textContent = summary.total_distance_km + ' km';
    document.getElementById('summaryTime').textContent = summary.total_time_hours + ' saat';
}

function displayVehicleList(routes) {
    const vehicleList = document.getElementById('vehicleList');
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    
    vehicleList.innerHTML = routes.map((route, index) => {
        const color = colors[index % colors.length];
        return `
            <div class="vehicle-list-item" 
                 data-vehicle-id="${route.vehicle_id}"
                 onclick="selectVehicle(${route.vehicle_id})"
                 style="padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 6px; cursor: pointer; border-left: 4px solid ${color}; background: #f8f9fa; transition: all 0.2s;">
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: ${color}; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 0.8rem; font-weight: bold;">${index + 1}</span>
                    <strong style="font-size: 0.9rem;">${route.plate_number}</strong>
                </div>
                <div style="font-size: 0.75rem; color: #666; margin-left: 32px;">
                    ${route.total_containers} konteyner • ${route.total_distance_km} km
                </div>
            </div>
        `;
    }).join('');
}

function initializeMap() {
    const mapContainer = document.getElementById('fleetMapContainer');
    mapContainer.style.display = 'block';
    
    // Harita zaten varsa temizle
    if (fleetMap) {
        fleetMap.remove();
    }
    
    // Yeni harita oluştur
    fleetMap = L.map('fleetMap').setView([40.19, 28.87], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(fleetMap);
    
    // Tüm rotalar için layer grupları oluştur
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    routeLayers = {};
    
    routeData.routes.forEach((route, index) => {
        const color = colors[index % colors.length];
        const layerGroup = L.layerGroup();
        
        if (route.route_points && route.route_points.length > 0) {
            // Gerçek yol geometrisini kullan (OSRM'den gelen)
            const routeLine = route.route_geometry && route.route_geometry.length > 0 
                ? route.route_geometry 
                : route.route_points;
            
            // Rota çizgisi (gerçek yollar)
            const polyline = L.polyline(routeLine, {
                color: color,
                weight: 4,
                opacity: 0.8
            });
            layerGroup.addLayer(polyline);
            
            // Konteyner marker'ları
            route.route_points.forEach((point, idx) => {
                const marker = L.circleMarker(point, {
                    radius: 7,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.9
                });
                
                marker.bindPopup(`
                    <strong>${route.plate_number}</strong><br>
                    Konteyner #${idx + 1}<br>
                    Tip: ${route.container_details[idx].container_type}
                `);
                
                layerGroup.addLayer(marker);
            });
            
            // Başlangıç marker'ı
            const startMarker = L.marker(route.route_points[0], {
                icon: L.divIcon({
                    html: `<div style="background: ${color}; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 2px solid white;">${index + 1}</div>`,
                    className: '',
                    iconSize: [30, 30]
                })
            });
            
            startMarker.bindPopup(`<strong>Başlangıç</strong><br>${route.plate_number}`);
            layerGroup.addLayer(startMarker);
        }
        
        routeLayers[route.vehicle_id] = layerGroup;
    });
    
    // Tüm rotaları haritaya ekle (başlangıçta hepsi görünür)
    Object.values(routeLayers).forEach(layer => layer.addTo(fleetMap));
    
    // Haritayı tüm rotaları gösterecek şekilde ayarla
    const allPoints = routeData.routes.flatMap(r => r.route_points);
    if (allPoints.length > 0) {
        fleetMap.fitBounds(allPoints);
    }
}

function selectVehicle(vehicleId) {
    selectedVehicleId = vehicleId;
    
    // Tüm list itemlerden active class'ını kaldır
    document.querySelectorAll('.vehicle-list-item').forEach(item => {
        if (parseInt(item.dataset.vehicleId) === vehicleId) {
            item.style.background = '#e3f2fd';
            item.style.fontWeight = 'bold';
        } else {
            item.style.background = '#f8f9fa';
            item.style.fontWeight = 'normal';
        }
    });
    
    // Haritadan tüm layer'ları kaldır
    Object.entries(routeLayers).forEach(([vId, layer]) => {
        fleetMap.removeLayer(layer);
    });
    
    // Sadece seçili aracın layer'ını ekle
    if (routeLayers[vehicleId]) {
        routeLayers[vehicleId].addTo(fleetMap);
        
        // Seçili aracın rotasına zoom yap
        const selectedRoute = routeData.routes.find(r => r.vehicle_id === vehicleId);
        if (selectedRoute && selectedRoute.route_points.length > 0) {
            fleetMap.fitBounds(selectedRoute.route_points);
        }
    }
    
    // Detayları göster
    displaySelectedVehicleDetails(vehicleId);
}

function displaySelectedVehicleDetails(vehicleId) {
    const selectedRoute = routeData.routes.find(r => r.vehicle_id === vehicleId);
    if (!selectedRoute) return;
    
    const colors = ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C', '#E67E22', '#34495E', '#E91E63', '#FF5722'];
    const index = routeData.routes.findIndex(r => r.vehicle_id === vehicleId);
    const color = colors[index % colors.length];
    
    document.getElementById('routeDetails').style.display = 'block';
    document.getElementById('routeDetailContent').innerHTML = `
        <div style="background: white; border-radius: 8px; padding: 1.5rem; border-left: 4px solid ${color}; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h4 style="color: ${color}; margin: 0;">
                    <span style="display: inline-block; width: 30px; height: 30px; background: ${color}; color: white; border-radius: 50%; text-align: center; line-height: 30px; margin-right: 10px;">${index + 1}</span>
                    ${selectedRoute.plate_number} - ${selectedRoute.vehicle_type}
                </h4>
                <span style="background: ${color}20; color: ${color}; padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600;">
                    ${selectedRoute.capacity_usage}% Doluluk
                </span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-top: 1rem;">
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Konteyner Sayısı</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.total_containers}</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Mesafe</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.total_distance_km} km</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Tahmini Süre</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.estimated_time_min} dk</div>
                </div>
                <div>
                    <div style="font-size: 0.9rem; color: #666;">Toplam Ağırlık</div>
                    <div style="font-size: 1.3rem; font-weight: 600; color: #333;">${selectedRoute.total_weight_tons} ton</div>
                </div>
            </div>
        </div>
    `;
}

function displayRouteMap(routes) {
    // Bu fonksiyon artık kullanılmıyor ama uyumluluk için bırakıldı
    initializeMap();
}

function displayRouteDetails(routes) {
    // Bu fonksiyon artık kullanılmıyor - selectVehicle kullanılıyor
}

// ============== INITIALIZATION ==============
console.log('Admin dashboard loaded successfully');
