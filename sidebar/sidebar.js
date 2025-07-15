
// Sidebar script for SDG Badge extension
document.addEventListener('DOMContentLoaded', function() {
    const refreshButton = document.getElementById('refresh-sidebar');
    const analysisContent = document.getElementById('sidebar-analysis-content');
    const modeToggle = document.getElementById('sidebar-mode-toggle');
    const modeIndicator = document.getElementById('sidebar-mode-indicator');
    const sizeSlider = document.getElementById('sidebar-size-slider');
    const sizeValue = document.getElementById('sidebar-size-value');

    // Load saved settings
    loadSettings();

    // Event listeners
    refreshButton.addEventListener('click', function() {
        loadAnalysisData();
    });

    modeToggle.addEventListener('change', function() {
        const isSelectMode = this.checked;
        const mode = isSelectMode ? 'select' : 'page';
        const modeText = isSelectMode ? 'Text Selection' : 'Page Content';
        
        modeIndicator.textContent = modeText;
        saveSetting('mode', mode);
        sendToActiveTab({ action: 'updateMode', mode: mode });
    });

    sizeSlider.addEventListener('input', function() {
        const size = parseInt(this.value);
        sizeValue.textContent = size + 'px';
        saveSetting('badgeSize', size);
        sendToActiveTab({ action: 'updateSize', size: size });
    });

    // Load initial analysis data
    loadAnalysisData();

    // Auto-refresh every 30 seconds
    setInterval(loadAnalysisData, 30000);

    // Load settings from storage
    function loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['mode', 'badgeSize'], function(result) {
                const mode = result.mode || 'page';
                const size = result.badgeSize || 250;
                
                modeToggle.checked = mode === 'select';
                modeIndicator.textContent = mode === 'select' ? 'Text Selection' : 'Page Content';
                sizeSlider.value = size;
                sizeValue.textContent = size + 'px';
            });
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

    // Display analysis data in sidebar
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
            sdgWheel.setAttribute('data-wheel-height', '280');
            
            // Attach data to element
            sdgWheel.sdgData = data;
            
            wheelContainer.appendChild(sdgWheel);
            analysisContent.innerHTML = '';
            analysisContent.appendChild(wheelContainer);
            
            // Load and execute the official widget script
            loadOfficialWidgetForSidebar();
        } else {
            analysisContent.innerHTML = `
                <div class="analysis-loading">
                    <div class="loading-text">No SDG classification found for this page.</div>
                </div>
            `;
        }
    }

    // Load official widget script for sidebar
    function loadOfficialWidgetForSidebar() {
        if (!window.sdgWidgetLoaded) {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('scripts/widget.js');
            script.onload = () => {
                window.sdgWidgetLoaded = true;
                console.log('Official SDG widget loaded in sidebar');
            };
            document.head.appendChild(script);
        }
    }
});
