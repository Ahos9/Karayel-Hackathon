// Smart Waste Management System - Client-Side JavaScript

// ============== FORM SUBMISSION HANDLING ==============
document.addEventListener('DOMContentLoaded', function() {
    const reportForm = document.getElementById('reportForm');
    const formResult = document.getElementById('formResult');
    
    if (reportForm) {
        reportForm.addEventListener('submit', handleFormSubmit);
    }
    
    // Simulate user trust score check
    checkUserTrustScore();
});

async function handleFormSubmit(event) {
    event.preventDefault();
    
    const formResult = document.getElementById('formResult');
    const submitButton = event.target.querySelector('.submit-button');
    
    // Get form data
    const containerID = document.getElementById('containerID').value;
    const fillLevel = document.getElementById('fillLevel').value;
    const description = document.getElementById('description').value;
    const photoFile = document.getElementById('photoUpload').files[0];
    
    // Validate required fields
    if (!containerID || !fillLevel) {
        showFormResult('error', 'Lütfen tüm zorunlu alanları doldurunuz.');
        return;
    }
    
    // Show loading state
    submitButton.disabled = true;
    submitButton.textContent = 'Gönderiliyor...';
    
    try {
        // Gerçek API çağrısı - Kullanıcı ID'sini al (localStorage'dan veya session'dan)
        const userId = localStorage.getItem('user_id') || 1;
        
        const reportData = {
            user_id: parseInt(userId),
            container_id: parseInt(containerID),
            fill_level: parseInt(fillLevel === 'empty' ? 10 : fillLevel === 'half' ? 50 : fillLevel === 'full' ? 85 : 95),
            notes: description,
            has_photo: photoFile ? true : false,
            timestamp: new Date().toISOString()
        };
        
        // ML model ile doğrulama yap
        const validationResult = await validateWithMLModel(containerID, fillLevel);
        
        // Bildirimi API'ye gönder
        const submitResponse = await fetch('/api/reports/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        
        const submitResult = await submitResponse.json();
        
        if (submitResult.success) {
            // Gerçek API yanıtından güven puanını ve doğruluk oranını göster
            const trustScore = submitResult.trust_score || 0;
            const accuracy = submitResult.accuracy || 0;
            const trustChange = submitResult.trust_change || 0;
            
            if (validationResult.status === 'accepted' || submitResult.report_status === 'verified') {
                showFormResult('success', 
                    `✓ Bildiriminiz kaydedildi! Doğruluk: %${accuracy.toFixed(1)} | ` +
                    `Güven Puanı: ${trustScore.toFixed(2)} (${trustChange > 0 ? '+' : ''}${trustChange.toFixed(3)})`);
                updateUserStatsFromAPI(trustScore, submitResult.total_reports, true);
            } else if (validationResult.status === 'rejected' || submitResult.report_status === 'rejected') {
                showFormResult('error', 
                    `✗ Doğruluk düşük: %${accuracy.toFixed(1)}. ${validationResult.message}`);
                updateUserStatsFromAPI(trustScore, submitResult.total_reports, false);
            } else {
                showFormResult('success', 
                    `⏳ Bildirim incelemede. Doğruluk: %${accuracy.toFixed(1)} | ML Tahmin: ${validationResult.message}`);
                updateUserStatsFromAPI(trustScore, submitResult.total_reports, null);
            }
            
            document.getElementById('reportForm').reset();
        } else {
            showFormResult('error', `Hata: ${submitResult.error || 'Bildirim gönderilemedi'}`);
        }
        
    } catch (error) {
        showFormResult('error', 'Bir hata oluştu. Lütfen tekrar deneyin.');
        console.error('Form submission error:', error);
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Bildirimi Gönder';
    }
}

function showFormResult(type, message) {
    const formResult = document.getElementById('formResult');
    formResult.className = `form-result ${type}`;
    formResult.textContent = message;
    formResult.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        formResult.style.display = 'none';
    }, 5000);
}

// ============== REAL ML VALIDATION ==============
async function validateWithMLModel(containerId, reportedStatus) {
    // Gerçek ML model tahminini API'den al
    try {
        const response = await fetch(`/api/predict/${containerId}`);
        const prediction = await response.json();
        
        if (prediction.error) {
            return {
                status: 'review',
                message: 'Model tahmini alınamadı. Manuel inceleme yapılacak.',
                model_prediction: null
            };
        }
        
        const modelPrediction = prediction.fill_probability;
        const modelConfidence = prediction.confidence;
        
        // Map reported status to expected range
        const thresholds = {
            'empty': { min: 0.0, max: 0.25 },
            'half': { min: 0.25, max: 0.75 },
            'full': { min: 0.75, max: 0.90 },
            'overflowing': { min: 0.90, max: 1.0 }
        };
        
        const expected = thresholds[reportedStatus];
        
        if (modelPrediction >= expected.min && modelPrediction <= expected.max) {
            return {
                status: 'accepted',
                message: `Model tahminlerimizle uyumlu (${(modelPrediction * 100).toFixed(1)}%). Güven puanınız arttı.`,
                model_prediction: modelPrediction,
                model_confidence: modelConfidence
            };
        } else {
            const deviation = Math.abs(modelPrediction - (expected.min + expected.max) / 2);
            
            if (deviation < 0.20) {
                return {
                    status: 'review',
                    message: `Model tahmini: ${(modelPrediction * 100).toFixed(1)}%. Küçük sapma tespit edildi.`,
                    model_prediction: modelPrediction,
                    model_confidence: modelConfidence
                };
            } else {
                return {
                    status: 'rejected',
                    message: `Model tahmini: ${(modelPrediction * 100).toFixed(1)}%. Bildirilen: ${reportedStatus}. Uyumsuzluk.`,
                    model_prediction: modelPrediction,
                    model_confidence: modelConfidence
                };
            }
        }
    } catch (error) {
        console.error('ML validation error:', error);
        return {
            status: 'review',
            message: 'Doğrulama sistemi geçici olarak kullanılamıyor.',
            model_prediction: null
        };
    }
}

// ============== USER STATS UPDATE FROM API ==============
function updateUserStatsFromAPI(trustScore, totalReports, accepted) {
    const trustScoreValue = document.querySelector('.stat-value');
    const trustScoreFill = document.querySelector('.trust-score-fill');
    const totalReportsValue = document.querySelectorAll('.stat-value')[1];
    const acceptedReportsValue = document.querySelectorAll('.stat-value')[2];
    const accuracyValue = document.querySelectorAll('.stat-value')[3];
    
    // Gerçek değerlerle güncelle
    const displayScore = Math.round(trustScore * 100);
    
    // Update DOM with real API values
    if (trustScoreValue) {
        trustScoreValue.textContent = `${displayScore} / 100`;
    }
    if (trustScoreFill) {
        trustScoreFill.style.width = `${Math.min(displayScore, 100)}%`;
    }
    if (totalReportsValue) {
        totalReportsValue.textContent = totalReports;
    }
    
    // Kabul edilen bildirim sayısını güncelle
    if (acceptedReportsValue && accepted === true) {
        const currentAccepted = parseInt(acceptedReportsValue.textContent) || 0;
        acceptedReportsValue.textContent = currentAccepted + 1;
    }
    
    // Doğruluk oranını hesapla
    if (accuracyValue && totalReportsValue && acceptedReportsValue) {
        const total = parseInt(totalReportsValue.textContent) || 1;
        const acceptedCount = parseInt(acceptedReportsValue.textContent) || 0;
        const accuracy = ((acceptedCount / total) * 100).toFixed(1);
        accuracyValue.textContent = `${accuracy}%`;
    }
    
    // Check if photo requirement should be removed
    checkUserTrustScore();
}

// Eski fonksiyon uyumluluk için
function updateUserStats(accepted) {
    // API'den kullanıcı bilgilerini çek
    const userId = localStorage.getItem('user_id');
    if (!userId) return;
    
    fetch(`/api/user/${userId}/stats`)
        .then(res => res.json())
        .then(data => {
            if (data.trust_score !== undefined) {
                updateUserStatsFromAPI(data.trust_score, data.total_reports, accepted);
            }
        })
        .catch(err => console.error('User stats fetch error:', err));
}

function checkUserTrustScore() {
    const trustScoreValue = document.querySelector('.stat-value');
    const photoUploadGroup = document.getElementById('photoUploadGroup');
    const requiredNotice = document.querySelector('.required-notice');
    
    if (trustScoreValue && photoUploadGroup) {
        const currentScore = parseInt(trustScoreValue.textContent.split('/')[0]);
        
        if (currentScore >= 80) {
            // High trust - photo not required
            requiredNotice.textContent = '✓ Güven puanınız yüksek! Fotoğraf zorunluluğu kalktı.';
            requiredNotice.style.color = '#27AE60';
            document.getElementById('photoUpload').removeAttribute('required');
        } else {
            // Low trust - photo required
            requiredNotice.textContent = '⚠️ Güven puanınız 80\'in altında olduğu için fotoğraf zorunludur';
            document.getElementById('photoUpload').setAttribute('required', 'required');
        }
    }
}

// ============== UTILITY FUNCTIONS ==============
async function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// ============== SEARCH FUNCTIONALITY ==============
const searchInput = document.querySelector('.search-input');
const searchButton = document.querySelector('.search-button');

if (searchButton) {
    searchButton.addEventListener('click', handleSearch);
}

if (searchInput) {
    searchInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            handleSearch();
        }
    });
}

function handleSearch() {
    const query = searchInput.value.trim();
    
    if (query.length > 0) {
        console.log('Searching for:', query);
        // In production, this would navigate to search results page
        // window.location.href = `/search?q=${encodeURIComponent(query)}`;
        alert(`Arama yapılıyor: "${query}"\n(Geliştirme aşamasında)`);
    }
}

// ============== PHOTO UPLOAD PREVIEW ==============
const photoUpload = document.getElementById('photoUpload');

if (photoUpload) {
    photoUpload.addEventListener('change', function(event) {
        const file = event.target.files[0];
        const uploadLabel = document.querySelector('.upload-label span');
        
        if (file) {
            uploadLabel.textContent = `Seçildi: ${file.name}`;
            
            // Optional: Show image preview
            const reader = new FileReader();
            reader.onload = function(e) {
                console.log('Photo loaded:', file.name);
                // Could display preview here if desired
            };
            reader.readAsDataURL(file);
        }
    });
}

// ============== LEADERBOARD ANIMATION ==============
function animateLeaderboard() {
    const leaderboardRows = document.querySelectorAll('.leaderboard-table tbody tr');
    
    leaderboardRows.forEach((row, index) => {
        row.style.opacity = '0';
        row.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            row.style.transition = 'all 0.5s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Trigger animation when leaderboard comes into view
const leaderboardSection = document.querySelector('.leaderboard-section');

if (leaderboardSection && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateLeaderboard();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.2 });
    
    observer.observe(leaderboardSection);
}

// ============== COMPARISON TABLE HIGHLIGHTING ==============
const comparisonRows = document.querySelectorAll('.comparison-table tbody tr');

comparisonRows.forEach(row => {
    row.addEventListener('mouseenter', function() {
        const changeCell = this.querySelector('.positive');
        if (changeCell) {
            changeCell.style.transform = 'scale(1.1)';
            changeCell.style.transition = 'transform 0.2s';
        }
    });
    
    row.addEventListener('mouseleave', function() {
        const changeCell = this.querySelector('.positive');
        if (changeCell) {
            changeCell.style.transform = 'scale(1)';
        }
    });
});

// ============== RESPONSIVE MENU (for mobile - future enhancement) ==============
console.log('Smart Waste Management System initialized');
console.log('Frontend loaded successfully');
