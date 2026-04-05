const dropZone = document.getElementById('drop-zone');
const browseBtn = document.getElementById('browse-btn');
const fileInput = document.getElementById('file-input');
const resultContainer = document.getElementById('result-container');
const loadingOverlay = document.getElementById('loading-overlay');

const originalPreview = document.getElementById('original-preview');
const originalSizeEle = document.getElementById('original-size');
const compressedPreview = document.getElementById('compressed-preview');
const compressedSizeEle = document.getElementById('compressed-size');

const downloadBtn = document.getElementById('download-btn');
const resetBtn = document.getElementById('reset-btn');
const canvas = document.getElementById('compression-canvas');

const TARGET_SIZE_BYTES = 1000 * 1024; // ~1MB
let currentCompressedBlob = null;
let currentFileName = '';

// Event Listeners for Drag & Drop
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
});

browseBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', function() {
    handleFiles(this.files);
});

resetBtn.addEventListener('click', () => {
    resultContainer.classList.add('hidden');
    dropZone.classList.remove('hidden');
    fileInput.value = '';
    currentCompressedBlob = null;
    currentFileName = '';
});

downloadBtn.addEventListener('click', () => {
    if (currentCompressedBlob) {
        const url = URL.createObjectURL(currentCompressedBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        // Setup filename
        const extIndex = currentFileName.lastIndexOf('.');
        const baseName = extIndex !== -1 ? currentFileName.substring(0, extIndex) : (currentFileName || 'image');
        a.download = `${baseName}-reducer-under-1MB.jpg`; 
        
        document.body.appendChild(a);
        a.click();
        
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
});

function handleFiles(files) {
    if (files.length === 0) return;
    
    const file = files[0];
    if (!file.type.startsWith('image/')) {
        alert('Please upload an image file (JPEG, PNG, WebP).');
        return;
    }

    currentFileName = file.name;
    
    // Show original size
    const originalSizeKB = (file.size / 1024).toFixed(2);
    originalSizeEle.textContent = `${originalSizeKB} KB`;
    
    // Read Original Image
    const reader = new FileReader();
    reader.onload = (e) => {
        originalPreview.src = e.target.result;
        
        // Switch views and show loading
        dropZone.classList.add('hidden');
        resultContainer.classList.remove('hidden');
        loadingOverlay.classList.remove('hidden');
        
        // Start Compression
        const img = new Image();
        img.onload = () => {
            // Compress with a timeout to allow UI update
            setTimeout(() => compressImage(img, file.size), 100);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

async function compressImage(img, originalSize) {
    let quality = 0.9;
    let scale = 1.0;
    let resultBlob = null;
    
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    let isUnderTarget = false;
    
    // Initial max dimensions
    let maxWidth = 3840;
    let maxHeight = 3840;
    
    // Downscale broadly if the image is astronomically large
    if (img.width > maxWidth || img.height > maxHeight) {
        scale = Math.min(maxWidth / img.width, maxHeight / img.height);
    }
    
    // Helper function to convert canvas to blob
    const getBlob = (w, h, q) => {
        return new Promise((resolve) => {
            canvas.width = w;
            canvas.height = h;
            ctx.fillStyle = '#FFFFFF'; 
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob((blob) => resolve(blob), 'image/jpeg', q);
        });
    };

    let attemptCount = 0;
    const MAX_ATTEMPTS = 12;
    
    while (!isUnderTarget && attemptCount < MAX_ATTEMPTS) {
        attemptCount++;
        let currentWidth = Math.max(10, Math.floor(img.width * scale));
        let currentHeight = Math.max(10, Math.floor(img.height * scale));
        
        resultBlob = await getBlob(currentWidth, currentHeight, quality);
        
        if (resultBlob.size <= TARGET_SIZE_BYTES) {
            isUnderTarget = true;
        } else {
            // Adjust strategy based on how far we are
            let ratio = resultBlob.size / TARGET_SIZE_BYTES;
            if (ratio > 2) {
                scale *= 0.7; // aggressive size reduction
            } else if (quality > 0.3) {
                quality -= 0.15; // aggressive quality reduction
            } else {
                scale *= 0.8; // default size reduction
            }
        }
    }
    
    currentCompressedBlob = resultBlob;
    
    const compressedSizeKB = (resultBlob.size / 1024).toFixed(2);
    compressedSizeEle.textContent = `${compressedSizeKB} KB`;
    
    if (resultBlob.size > TARGET_SIZE_BYTES) {
        compressedSizeEle.classList.add('error');
    } else {
        compressedSizeEle.classList.remove('error');
    }
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(resultBlob);
    compressedPreview.src = previewUrl;
    
    // Hide loading
    loadingOverlay.classList.add('hidden');
}
