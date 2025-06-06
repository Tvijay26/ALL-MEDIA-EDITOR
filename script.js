document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const canvas = document.getElementById('main-canvas');
    const ctx = canvas.getContext('2d');
    const fileModal = document.getElementById('file-modal');
    const exportModal = document.getElementById('export-modal');
    const openFileBtn = document.getElementById('open-file');
    const saveFileBtn = document.getElementById('save-file');
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    const fullscreenBtn = document.getElementById('fullscreen');
    const playPauseBtn = document.getElementById('play-pause');
    const rewindBtn = document.getElementById('rewind');
    const forwardBtn = document.getElementById('forward');
    const timelineScrubber = document.getElementById('timeline-scrubber');
    const currentTimeEl = document.getElementById('current-time');
    const totalTimeEl = document.getElementById('total-time');
    const addLayerBtn = document.getElementById('add-layer');
    const transformControls = document.querySelector('.transform-controls');
    const controlPoints = document.querySelectorAll('.control-point');
    const rotateControl = document.querySelector('.rotate-control');
    const closeModalBtns = document.querySelectorAll('.close-modal');
    const cancelOpenBtn = document.getElementById('cancel-open');
    const confirmOpenBtn = document.getElementById('confirm-open');
    const cancelExportBtn = document.getElementById('cancel-export');
    const confirmExportBtn = document.getElementById('confirm-export');
    const qualitySlider = document.getElementById('quality-slider');
    const qualityValue = document.getElementById('quality-value');
    const exportWidth = document.getElementById('export-width');
    const exportHeight = document.getElementById('export-height');
    const maintainAspect = document.getElementById('maintain-aspect');
    const resolutionPreset = document.getElementById('resolution-preset');

    // App State
    let state = {
        activeTab: 'image-tab',
        activePanel: 'layers-panel',
        zoomLevel: 1,
        canvasObjects: [],
        selectedObject: null,
        history: [],
        historyIndex: -1,
        isPlaying: false,
        currentTime: 0,
        totalTime: 0,
        fileToOpen: null,
        transform: {
            isDragging: false,
            isRotating: false,
            isResizing: false,
            activeControl: null,
            startX: 0,
            startY: 0,
            startWidth: 0,
            startHeight: 0,
            startRotation: 0,
            startPosX: 0,
            startPosY: 0
        }
    };

    // Initialize Canvas
    function initCanvas() {
        canvas.width = 800;
        canvas.height = 600;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        updateCanvas();
    }

    // Update Canvas
    function updateCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw checkerboard background
        const size = 20;
        for (let y = 0; y < canvas.height; y += size) {
            for (let x = 0; x < canvas.width; x += size) {
                const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
                ctx.fillStyle = isEven ? '#e0e0e0' : '#f0f0f0';
                ctx.fillRect(x, y, size, size);
            }
        }
        
        // Draw all objects
        state.canvasObjects.forEach(obj => {
            ctx.save();
            
            // Apply transformations
            ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.translate(-obj.width / 2, -obj.height / 2);
            
            // Draw the object
            if (obj.type === 'image') {
                ctx.drawImage(obj.image, 0, 0, obj.width, obj.height);
            } else if (obj.type === 'shape') {
                ctx.fillStyle = obj.color;
                if (obj.shape === 'rect') {
                    ctx.fillRect(0, 0, obj.width, obj.height);
                } else if (obj.shape === 'circle') {
                    ctx.beginPath();
                    ctx.arc(obj.width / 2, obj.height / 2, obj.width / 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            
            ctx.restore();
        });
        
        // Draw selection outline if an object is selected
        if (state.selectedObject) {
            const obj = state.selectedObject;
            ctx.save();
            
            // Apply same transformations as the object
            ctx.translate(obj.x + obj.width / 2, obj.y + obj.height / 2);
            ctx.rotate(obj.rotation * Math.PI / 180);
            ctx.translate(-obj.width / 2, -obj.height / 2);
            
            // Draw selection outline
            ctx.strokeStyle = '#4361ee';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(0, 0, obj.width, obj.height);
            ctx.setLineDash([]);
            
            ctx.restore();
            
            // Position transform controls
            positionTransformControls(obj);
            transformControls.style.display = 'block';
        } else {
            transformControls.style.display = 'none';
        }
    }

    // Position transform controls around selected object
    function positionTransformControls(obj) {
        transformControls.style.width = `${obj.width}px`;
        transformControls.style.height = `${obj.height}px`;
        transformControls.style.left = `${obj.x}px`;
        transformControls.style.top = `${obj.y}px`;
        transformControls.style.transform = `rotate(${obj.rotation}deg)`;
    }

    // Add object to canvas
    function addObject(type, options) {
        const defaultObj = {
            id: Date.now(),
            type,
            x: 100,
            y: 100,
            width: 200,
            height: 200,
            rotation: 0,
            opacity: 1,
            zIndex: state.canvasObjects.length
        };
        
        const newObj = {...defaultObj, ...options};
        state.canvasObjects.push(newObj);
        saveHistory();
        updateCanvas();
        updateLayersPanel();
        
        // Select the new object
        selectObject(newObj);
        
        return newObj;
    }

    // Select an object
    function selectObject(obj) {
        state.selectedObject = obj;
        updatePropertiesPanel();
        updateCanvas();
    }

    // Save current state to history
    function saveHistory() {
        // If we're not at the end of history, remove future states
        if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
        }
        
        // Save current state
        state.history.push({
            canvasObjects: JSON.parse(JSON.stringify(state.canvasObjects)),
            selectedObject: state.selectedObject ? {...state.selectedObject} : null
        });
        
        state.historyIndex = state.history.length - 1;
        updateHistoryPanel();
        updateUndoRedoButtons();
    }

    // Undo action
    function undo() {
        if (state.historyIndex > 0) {
            state.historyIndex--;
            const historyState = state.history[state.historyIndex];
            state.canvasObjects = JSON.parse(JSON.stringify(historyState.canvasObjects));
            state.selectedObject = historyState.selectedObject ? {...historyState.selectedObject} : null;
            updateCanvas();
            updateLayersPanel();
            updatePropertiesPanel();
            updateUndoRedoButtons();
        }
    }

    // Redo action
    function redo() {
        if (state.historyIndex < state.history.length - 1) {
            state.historyIndex++;
            const historyState = state.history[state.historyIndex];
            state.canvasObjects = JSON.parse(JSON.stringify(historyState.canvasObjects));
            state.selectedObject = historyState.selectedObject ? {...historyState.selectedObject} : null;
            updateCanvas();
            updateLayersPanel();
            updatePropertiesPanel();
            updateUndoRedoButtons();
        }
    }

    // Update undo/redo buttons state
    function updateUndoRedoButtons() {
        undoBtn.disabled = state.historyIndex <= 0;
        redoBtn.disabled = state.historyIndex >= state.history.length - 1;
    }

    // Update layers panel
    function updateLayersPanel() {
        const layersList = document.querySelector('.layers-list');
        layersList.innerHTML = '';
        
        // Sort objects by zIndex (reverse order for display)
        const sortedObjects = [...state.canvasObjects].sort((a, b) => b.zIndex - a.zIndex);
        
        sortedObjects.forEach(obj => {
            const layerItem = document.createElement('div');
            layerItem.className = `layer-item ${state.selectedObject && state.selectedObject.id === obj.id ? 'active' : ''}`;
            layerItem.innerHTML = `
                <i class="fas ${obj.type === 'image' ? 'fa-image' : 'fa-square'}"></i>
                ${obj.name || `${obj.type} ${obj.id}`}
                <i class="fas fa-eye layer-visibility"></i>
            `;
            
            layerItem.addEventListener('click', () => selectObject(obj));
            layersList.appendChild(layerItem);
        });
    }

    // Update properties panel
    function updatePropertiesPanel() {
        if (!state.selectedObject) return;
        
        const obj = state.selectedObject;
        document.getElementById('pos-x').value = Math.round(obj.x);
        document.getElementById('pos-y').value = Math.round(obj.y);
        document.getElementById('rotation').value = Math.round(obj.rotation);
        document.getElementById('scale-x').value = (obj.width / (obj.originalWidth || obj.width)).toFixed(2);
        document.getElementById('scale-y').value = (obj.height / (obj.originalHeight || obj.height)).toFixed(2);
        document.getElementById('opacity').value = Math.round(obj.opacity * 100);
        document.getElementById('blend-mode').value = obj.blendMode || 'normal';
    }

    // Update history panel
    function updateHistoryPanel() {
        const historyList = document.querySelector('.history-list');
        historyList.innerHTML = '';
        
        state.history.forEach((state, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = `history-item ${index === state.historyIndex ? 'active' : ''}`;
            historyItem.textContent = `Action ${index + 1}`;
            historyItem.addEventListener('click', () => {
                state.historyIndex = index;
                const historyState = state.history[index];
                state.canvasObjects = JSON.parse(JSON.stringify(historyState.canvasObjects));
                state.selectedObject = historyState.selectedObject ? {...historyState.selectedObject} : null;
                updateCanvas();
                updateLayersPanel();
                updatePropertiesPanel();
                updateUndoRedoButtons();
            });
            historyList.appendChild(historyItem);
        });
    }

    // Open file modal
    function openFileModal() {
        fileModal.classList.add('active');
    }

    // Close file modal
    function closeFileModal() {
        fileModal.classList.remove('active');
    }

    // Open export modal
    function openExportModal() {
        exportModal.classList.add('active');
    }

    // Close export modal
    function closeExportModal() {
        exportModal.classList.remove('active');
    }

    // Handle file selection
    function handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        if (file.type.startsWith('image/')) {
            reader.onload = function(event) {
                const img = new Image();
                img.onload = function() {
                    const newObj = addObject('image', {
                        image: img,
                        width: img.width,
                        height: img.height,
                        originalWidth: img.width,
                        originalHeight: img.height,
                        name: file.name
                    });
                    
                    // Center the image on canvas
                    newObj.x = (canvas.width - img.width) / 2;
                    newObj.y = (canvas.height - img.height) / 2;
                    updateCanvas();
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else if (file.type.startsWith('video/')) {
            // For video files, we'd need to implement video handling
            alert('Video support will be implemented in the full version');
        }
    }

    // Export canvas
    function exportCanvas() {
        const format = document.querySelector('input[name="export-format"]:checked').value;
        const quality = parseInt(qualitySlider.value) / 100;
        const width = parseInt(exportWidth.value);
        const height = parseInt(exportHeight.value);
        
        // Create a temporary canvas with the desired dimensions
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Draw the main canvas content scaled to the temp canvas
        tempCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, width, height);
        
        // Convert to the desired format
        let mimeType, fileName;
        switch (format) {
            case 'jpg':
                mimeType = 'image/jpeg';
                fileName = 'export.jpg';
                break;
            case 'png':
                mimeType = 'image/png';
                fileName = 'export.png';
                break;
            case 'gif':
                mimeType = 'image/gif';
                fileName = 'export.gif';
                break;
            case 'mp4':
                // For video export, we'd need to implement video encoding
                alert('Video export will be implemented in the full version');
                return;
            case 'webm':
                alert('WebM export will be implemented in the full version');
                return;
        }
        
        const dataUrl = tempCanvas.toDataURL(mimeType, quality);
        const link = document.createElement('a');
        link.download = fileName;
        link.href = dataUrl;
        link.click();
        
        closeExportModal();
    }

    // Event Listeners
    openFileBtn.addEventListener('click', openFileModal);
    saveFileBtn.addEventListener('click', openExportModal);
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    zoomInBtn.addEventListener('click', () => {
        state.zoomLevel += 0.1;
        canvas.style.transform = `scale(${state.zoomLevel})`;
    });
    zoomOutBtn.addEventListener('click', () => {
        if (state.zoomLevel > 0.2) {
            state.zoomLevel -= 0.1;
            canvas.style.transform = `scale(${state.zoomLevel})`;
        }
    });
    fullscreenBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            canvas.requestFullscreen().catch(err => {
                alert(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
        }
    });
    playPauseBtn.addEventListener('click', () => {
        state.isPlaying = !state.isPlaying;
        playPauseBtn.innerHTML = state.isPlaying ? '<i class="fas fa-pause"></i>' : '<i class="fas fa-play"></i>';
    });
    closeModalBtns.forEach(btn => btn.addEventListener('click', () => {
        closeFileModal();
        closeExportModal();
    }));
    cancelOpenBtn.addEventListener('click', closeFileModal);
    confirmOpenBtn.addEventListener('click', () => {
        if (state.fileToOpen) {
            // Handle file opening
        }
        closeFileModal();
    });
    cancelExportBtn.addEventListener('click', closeExportModal);
    confirmExportBtn.addEventListener('click', exportCanvas);
    qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = `${qualitySlider.value}%`;
    });
    resolutionPreset.addEventListener('change', function() {
        switch (this.value) {
            case '4k':
                exportWidth.value = 3840;
                exportHeight.value = 2160;
                break;
            case '1080p':
                exportWidth.value = 1920;
                exportHeight.value = 1080;
                break;
            case '720p':
                exportWidth.value = 1280;
                exportHeight.value = 720;
                break;
            case '480p':
                exportWidth.value = 854;
                exportHeight.value = 480;
                break;
        }
    });
    maintainAspect.addEventListener('change', function() {
        if (this.checked) {
            exportHeight.addEventListener('input', maintainAspectRatio);
            exportWidth.addEventListener('input', maintainAspectRatio);
        } else {
            exportHeight.removeEventListener('input', maintainAspectRatio);
            exportWidth.removeEventListener('input', maintainAspectRatio);
        }
    });
    document.getElementById('file-input').addEventListener('change', handleFileSelect);
    addLayerBtn.addEventListener('click', () => {
        addObject('shape', {
            shape: 'rect',
            color: `hsl(${Math.random() * 360}, 70%, 60%)`,
            name: `Shape ${state.canvasObjects.length + 1}`
        });
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(this.dataset.tab).classList.add('active');
            state.activeTab = this.dataset.tab;
        });
    });
    
    // Panel switching
    document.querySelectorAll('.panel-tab-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.panel-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel-content').forEach(c => c.classList.remove('active'));
            
            this.classList.add('active');
            document.getElementById(`${this.dataset.panel}-panel`).classList.add('active');
            state.activePanel = `${this.dataset.panel}-panel`;
        });
    });
    
    // Property controls
    document.getElementById('pos-x').addEventListener('change', function() {
        if (state.selectedObject) {
            state.selectedObject.x = parseInt(this.value);
            updateCanvas();
            saveHistory();
        }
    });
    document.getElementById('pos-y').addEventListener('change', function() {
        if (state.selectedObject) {
            state.selectedObject.y = parseInt(this.value);
            updateCanvas();
            saveHistory();
        }
    });
    document.getElementById('rotation').addEventListener('change', function() {
        if (state.selectedObject) {
            state.selectedObject.rotation = parseInt(this.value);
            updateCanvas();
            saveHistory();
        }
    });
    document.getElementById('scale-x').addEventListener('change', function() {
        if (state.selectedObject) {
            const scale = parseFloat(this.value);
            state.selectedObject.width = (state.selectedObject.originalWidth || state.selectedObject.width) * scale;
            updateCanvas();
            saveHistory();
        }
    });
    document.getElementById('scale-y').addEventListener('change', function() {
        if (state.selectedObject) {
            const scale = parseFloat(this.value);
            state.selectedObject.height = (state.selectedObject.originalHeight || state.selectedObject.height) * scale;
            updateCanvas();
            saveHistory();
        }
    });
    document.getElementById('opacity').addEventListener('input', function() {
        if (state.selectedObject) {
            state.selectedObject.opacity = parseInt(this.value) / 100;
            updateCanvas();
            saveHistory();
        }
    });
    document.getElementById('blend-mode').addEventListener('change', function() {
        if (state.selectedObject) {
            state.selectedObject.blendMode = this.value;
            updateCanvas();
            saveHistory();
        }
    });
    
    // Transform controls
    controlPoints.forEach(point => {
        point.addEventListener('mousedown', startTransform);
    });
    rotateControl.addEventListener('mousedown', startRotate);
    document.addEventListener('mousemove', handleTransform);
    document.addEventListener('mouseup', endTransform);
    canvas.addEventListener('click', function(e) {
        if (!state.transform.isDragging && !state.transform.isRotating && !state.transform.isResizing) {
            // Check if clicked on an object
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / state.zoomLevel;
            const y = (e.clientY - rect.top) / state.zoomLevel;
            
            // Find the topmost object at this position
            let selected = null;
            for (let i = state.canvasObjects.length - 1; i >= 0; i--) {
                const obj = state.canvasObjects[i];
                
                // Simple point-in-rectangle test (for demo purposes)
                // In a real app, you'd need to account for rotation
                if (x >= obj.x && x <= obj.x + obj.width &&
                    y >= obj.y && y <= obj.y + obj.height) {
                    selected = obj;
                    break;
                }
            }
            
            selectObject(selected);
        }
    });
    
    // Initialize app
    initCanvas();
    saveHistory(); // Save initial state
    
    // Helper functions
    function maintainAspectRatio() {
        const aspect = canvas.width / canvas.height;
        if (this === exportWidth) {
            exportHeight.value = Math.round(parseInt(exportWidth.value) / aspect);
        } else {
            exportWidth.value = Math.round(parseInt(exportHeight.value) * aspect);
        }
    }
    
    function startTransform(e) {
        if (!state.selectedObject) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        state.transform.isResizing = true;
        state.transform.activeControl = e.target.classList[1];
        state.transform.startX = e.clientX;
        state.transform.startY = e.clientY;
        state.transform.startWidth = state.selectedObject.width;
        state.transform.startHeight = state.selectedObject.height;
        state.transform.startPosX = state.selectedObject.x;
        state.transform.startPosY = state.selectedObject.y;
    }
    
    function startRotate(e) {
        if (!state.selectedObject) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        state.transform.isRotating = true;
        state.transform.startX = e.clientX;
        state.transform.startY = e.clientY;
        state.transform.startRotation = state.selectedObject.rotation;
    }
    
    function handleTransform(e) {
        if (!state.selectedObject) return;
        
        if (state.transform.isResizing) {
            e.preventDefault();
            
            const rect = canvas.getBoundingClientRect();
            const deltaX = (e.clientX - state.transform.startX) / state.zoomLevel;
            const deltaY = (e.clientY - state.transform.startY) / state.zoomLevel;
            const control = state.transform.activeControl;
            
            let newWidth = state.transform.startWidth;
            let newHeight = state.transform.startHeight;
            let newX = state.transform.startPosX;
            let newY = state.transform.startPosY;
            
            // Handle different control points
            if (control.includes('right')) {
                newWidth = Math.max(10, state.transform.startWidth + deltaX);
            }
            if (control.includes('left')) {
                newWidth = Math.max(10, state.transform.startWidth - deltaX);
                newX = state.transform.startPosX + deltaX;
            }
            if (control.includes('bottom')) {
                newHeight = Math.max(10, state.transform.startHeight + deltaY);
            }
            if (control.includes('top')) {
                newHeight = Math.max(10, state.transform.startHeight - deltaY);
                newY = state.transform.startPosY + deltaY;
            }
            
            // For center controls (maintain aspect ratio)
            if (control.includes('center') && !control.includes('middle')) {
                const aspect = state.transform.startHeight / state.transform.startWidth;
                if (control.includes('top') || control.includes('bottom')) {
                    newWidth = newHeight / aspect;
                    if (control.includes('left')) {
                        newX = state.transform.startPosX + (state.transform.startWidth - newWidth);
                    }
                } else {
                    newHeight = newWidth * aspect;
                    if (control.includes('top')) {
                        newY = state.transform.startPosY + (state.transform.startHeight - newHeight);
                    }
                }
            }
            
            state.selectedObject.width = newWidth;
            state.selectedObject.height = newHeight;
            state.selectedObject.x = newX;
            state.selectedObject.y = newY;
            
            updateCanvas();
            updatePropertiesPanel();
        } else if (state.transform.isRotating) {
            e.preventDefault();
            
            const rect = canvas.getBoundingClientRect();
            const centerX = state.selectedObject.x + state.selectedObject.width / 2;
            const centerY = state.selectedObject.y + state.selectedObject.height / 2;
            
            const startAngle = Math.atan2(
                state.transform.startY - rect.top - centerY * state.zoomLevel,
                state.transform.startX - rect.left - centerX * state.zoomLevel
            );
            
            const currentAngle = Math.atan2(
                e.clientY - rect.top - centerY * state.zoomLevel,
                e.clientX - rect.left - centerX * state.zoomLevel
            );
            
            const angleDiff = (currentAngle - startAngle) * 180 / Math.PI;
            state.selectedObject.rotation = state.transform.startRotation + angleDiff;
            
            updateCanvas();
            updatePropertiesPanel();
        } else if (state.transform.isDragging) {
            e.preventDefault();
            
            const deltaX = (e.clientX - state.transform.startX) / state.zoomLevel;
            const deltaY = (e.clientY - state.transform.startY) / state.zoomLevel;
            
            state.selectedObject.x = state.transform.startPosX + deltaX;
            state.selectedObject.y = state.transform.startPosY + deltaY;
            
            updateCanvas();
            updatePropertiesPanel();
        }
    }
    
    function endTransform() {
        if (state.transform.isResizing || state.transform.isRotating || state.transform.isDragging) {
            saveHistory();
        }
        
        state.transform.isResizing = false;
        state.transform.isRotating = false;
        state.transform.isDragging = false;
        state.transform.activeControl = null;
    }
    
    // Add hidden file input for opening files
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.id = 'file-input';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    // Simulate file browser for demo
    function simulateFileBrowser() {
        const fileList = document.querySelector('.file-list');
        const filePreviewImg = document.getElementById('file-preview-img');
        const filePreviewVideo = document.getElementById('file-preview-video');
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        const fileDimensions = document.getElementById('file-dimensions');
        const fileType = document.getElementById('file-type');
        
        // Sample files for demo
        const sampleFiles = [
            { name: 'nature.jpg', type: 'image/jpeg', size: '2.4 MB', dimensions: '1920×1080' },
            { name: 'portrait.png', type: 'image/png', size: '3.1 MB', dimensions: '1200×1800' },
            { name: 'logo.svg', type: 'image/svg+xml', size: '45 KB', dimensions: '300×300' },
            { name: 'presentation.mp4', type: 'video/mp4', size: '15.2 MB', dimensions: '1280×720' },
            { name: 'music.mp3', type: 'audio/mp3', size: '4.7 MB', dimensions: '-' },
            { name: 'project.aep', type: 'application/aep', size: '125 MB', dimensions: '-' }
        ];
        
        // Populate file list
        sampleFiles.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.textContent = file.name;
            fileItem.addEventListener('click', () => {
                document.querySelectorAll('.file-item').forEach(item => item.classList.remove('active'));
                fileItem.classList.add('active');
                
                // Update preview
                if (file.type.startsWith('image/')) {
                    filePreviewImg.style.display = 'block';
                    filePreviewVideo.style.display = 'none';
                    filePreviewImg.src = `https://placehold.co/600x400?text=${file.name}`;
                } else if (file.type.startsWith('video/')) {
                    filePreviewImg.style.display = 'none';
                    filePreviewVideo.style.display = 'block';
                    filePreviewVideo.src = '';
                    filePreviewVideo.poster = `https://placehold.co/600x400?text=${file.name}`;
                } else {
                    filePreviewImg.style.display = 'block';
                    filePreviewVideo.style.display = 'none';
                    filePreviewImg.src = `https://placehold.co/600x400?text=${file.name}`;
                }
                
                // Update file info
                fileName.textContent = file.name;
                fileSize.textContent = file.size;
                fileDimensions.textContent = file.dimensions;
                fileType.textContent = file.type;
                
                // Set file to open
                state.fileToOpen = file;
            });
            fileList.appendChild(fileItem);
        });
        
        // Select first file by default
        if (fileList.firstChild) {
            fileList.firstChild.click();
        }
    }
    
    // Initialize file browser for demo
    simulateFileBrowser();
});