
// Popup script for SDG Badge extension
document.addEventListener('DOMContentLoaded', function() {
    const viewModeSelect = document.getElementById('view-mode-select');
    const viewModeIndicator = document.getElementById('view-mode-indicator');
    const modeToggle = document.getElementById('mode-toggle');
    const modeIndicator = document.getElementById('mode-indicator');
    const sizeSlider = document.getElementById('size-slider');
    const sizeValue = document.getElementById('size-value');
    const testButton = document.getElementById('test-api');
    const apiStatus = document.getElementById('api-status');
    const popupAnalysis = document.getElementById('popup-analysis');
    const analysisContent = document.getElementById('analysis-content');
    const refreshButton = document.getElementById('refresh-analysis');

    // Load saved settings
    loadSettings();

    // View mode select event listener
    viewModeSelect.addEventListener('change', function() {
        const viewMode = this.value;
        const viewModeText = viewMode.charAt(0).toUpperCase() + viewMode.slice(1);
        
        viewModeIndicator.textContent = viewModeText;
        
        // Save setting
        saveSetting('viewMode', viewMode);
        
        // Show/hide popup analysis based on view mode
        updatePopupAnalysisVisibility(viewMode);
        
        // Notify content script
        sendToActiveTab({ action: 'updateViewMode', viewMode: viewMode });
        
        // If sidebar mode is selected, open the sidebar
        if (viewMode === 'sidebar') {
            openSidebarFromPopup();
        }
    });

    // Mode toggle event listener
    modeToggle.addEventListener('change', function() {
        const isSelectMode = this.checked;
        const mode = isSelectMode ? 'select' : 'page';
        const modeText = isSelectMode ? 'Text Selection' : 'Page Content';
        
        modeIndicator.textContent = modeText;
        
        // Save setting
        saveSetting('mode', mode);
        
        // Notify content script
        sendToActiveTab({ action: 'updateMode', mode: mode });
    });

    // Size slider event listener
    sizeSlider.addEventListener('input', function() {
        const size = parseInt(this.value);
        sizeValue.textContent = size + 'px';
        
        // Save setting
        saveSetting('badgeSize', size);
        
        // Notify content script
        sendToActiveTab({ action: 'updateSize', size: size });
    });

    // Test API button event listener
    testButton.addEventListener('click', function() {
        testApiConnection();
    });

    // Refresh analysis button event listener
    refreshButton.addEventListener('click', function() {
        loadAnalysisData();
    });

    // Load settings from storage
    function loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['viewMode', 'mode', 'badgeSize'], function(result) {
                const viewMode = result.viewMode || 'popup'; // Default to popup mode
                const mode = result.mode || 'page';
                const size = result.badgeSize || 250;
                
                viewModeSelect.value = viewMode;
                viewModeIndicator.textContent = viewMode.charAt(0).toUpperCase() + viewMode.slice(1);
                modeToggle.checked = mode === 'select';
                modeIndicator.textContent = mode === 'select' ? 'Text Selection' : 'Page Content';
                sizeSlider.value = size;
                sizeValue.textContent = size + 'px';
                
                // Show/hide popup analysis based on view mode
                updatePopupAnalysisVisibility(viewMode);
            });
        }
    }

    // Update popup analysis visibility based on view mode
    function updatePopupAnalysisVisibility(viewMode) {
        if (viewMode === 'popup') {
            popupAnalysis.style.display = 'block';
            loadAnalysisData();
        } else {
            popupAnalysis.style.display = 'none';
        }
    }

    // Load analysis data from content script
    function loadAnalysisData() {
        // Show loading state
        analysisContent.innerHTML = `
            <div class="analysis-loading">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading analysis...</div>
            </div>
        `;
        
        // Request analysis data from content script
        sendToActiveTab({ action: 'getAnalysisData' }, function(response) {
            if (response && response.data) {
                displayAnalysisData(response.data);
            } else {
                // No data available, show message
                analysisContent.innerHTML = `
                    <div class="analysis-loading">
                        <div class="loading-text">No analysis data available.<br>Visit a webpage to see SDG analysis.</div>
                    </div>
                `;
            }
        });
    }

    // Display analysis data in popup
    function displayAnalysisData(data) {
        if (data && data.predictions && data.predictions.length > 0) {
            // Create SDG wheel container
            const wheelContainer = document.createElement('div');
            wheelContainer.className = 'analysis-wheel';
            
            // Create SDG wheel element
            const sdgWheel = document.createElement('div');
            sdgWheel.className = 'sdg-wheel';
            sdgWheel.setAttribute('data-text', data.text || 'Current page content');
            sdgWheel.setAttribute('data-model', 'aurora-sdg-multi');
            sdgWheel.setAttribute('data-wheel-height', '200');
            
            // Attach data to element
            sdgWheel.sdgData = data;
            
            wheelContainer.appendChild(sdgWheel);
            analysisContent.innerHTML = '';
            analysisContent.appendChild(wheelContainer);
            
            // Load and execute the official widget script
            loadOfficialWidgetForPopup();
        } else {
            analysisContent.innerHTML = `
                <div class="analysis-loading">
                    <div class="loading-text">No SDG classification found for this page.</div>
                </div>
            `;
        }
    }

    // Load official widget script for popup
    function loadOfficialWidgetForPopup() {
        if (!window.sdgWidgetLoaded) {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('scripts/widget.js');
            script.onload = () => {
                window.sdgWidgetLoaded = true;
                console.log('Official SDG widget loaded in popup');
            };
            document.head.appendChild(script);
        }
    }

    // Save individual setting
    function saveSetting(key, value) {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.set({ [key]: value });
        }
    }

    // Send message to active tab
    function sendToActiveTab(message, callback) {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    if (callback) {
                        chrome.tabs.sendMessage(tabs[0].id, message, callback);
                    } else {
                        chrome.tabs.sendMessage(tabs[0].id, message);
                    }
                }
            });
        }
    }

    // Test API connection
    function testApiConnection() {
        const originalText = testButton.textContent;
        testButton.textContent = 'Testing...';
        testButton.disabled = true;
        
        // Send test message to background script
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'testApi',
                text: 'This is a test message to verify API connectivity.'
            }, function(response) {
                testButton.textContent = originalText;
                testButton.disabled = false;
                
                if (response && response.success) {
                    showApiStatus('API connection successful!', 'success');
                } else {
                    showApiStatus('API connection failed. Please check your internet connection.', 'error');
                }
            });
        }
    }

    // Show API status message
    function showApiStatus(message, type) {
        apiStatus.textContent = message;
        apiStatus.className = `api-status ${type} show`;
        
        setTimeout(() => {
            apiStatus.classList.remove('show');
        }, 3000);
    }
    
    // Open sidebar from popup (provides user gesture)
    function openSidebarFromPopup() {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                if (tabs[0]) {
                    chrome.runtime.sendMessage({
                        action: 'openSidebarFromPopup',
                        tabId: tabs[0].id
                    });
                    
                    // Close popup after opening sidebar
                    setTimeout(() => {
                        window.close();
                    }, 100);
                }
            });
        }
    }
});
