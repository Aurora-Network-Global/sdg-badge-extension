
// Content script for SDG Badge extension
class SDGBadgeWidget {
    constructor() {
        this.widget = null;
        this.isVisible = false;
        this.isDragging = false;
        this.currentMode = 'page';
        this.viewMode = 'popup'; // Default to popup mode
        this.badgeSize = 250;
        this.selectedText = '';
        this.isProcessing = false;
        this.lastAnalyzedText = '';
        this.lastAnalyzedData = null;
        
        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        
        // Initial analysis after page load
        setTimeout(() => {
            this.analyzeContent();
        }, 1000);
    }

    loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['viewMode', 'mode', 'badgeSize'], (result) => {
                this.viewMode = result.viewMode || 'popup';
                this.currentMode = result.mode || 'page';
                this.badgeSize = result.badgeSize || 250;
                
                if (this.widget) {
                    this.updateWidgetSize();
                }
                
                // Update widget visibility based on view mode
                this.updateWidgetVisibility();
            });
        }
    }

    setupEventListeners() {
        // Listen for text selection
        document.addEventListener('mouseup', () => {
            if (this.currentMode === 'select') {
                this.handleTextSelection();
            }
        });

        // Listen for keyboard selection
        document.addEventListener('keyup', (e) => {
            if (this.currentMode === 'select' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'End' || e.key === 'Home')) {
                this.handleTextSelection();
            }
        });

        // Listen for messages from popup
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'updateViewMode') {
                    this.viewMode = request.viewMode;
                    this.updateWidgetVisibility();
                } else if (request.action === 'updateMode') {
                    this.currentMode = request.mode;
                    this.updateModeIndicator();
                    if (request.mode === 'page') {
                        this.analyzeContent();
                    }
                } else if (request.action === 'updateSize') {
                    this.badgeSize = request.size;
                    this.updateWidgetSize();
                } else if (request.action === 'getAnalysisData') {
                    // Send current analysis data to popup
                    sendResponse({ data: this.lastAnalyzedData });
                }
            });
        }
    }

    updateWidgetVisibility() {
        if (this.viewMode === 'floating') {
            // Show floating widget
            if (!this.widget) {
                this.createWidget();
            } else {
                this.showWidget();
            }
        } else if (this.viewMode === 'sidebar') {
            // Hide floating widget - sidebar will be opened by user clicking extension icon
            if (this.widget) {
                this.hideWidget();
            }
            // Note: Sidebar is now opened by clicking the extension icon, not automatically
            console.log('Sidebar mode active - click extension icon to open sidebar');
        } else {
            // Hide floating widget for popup mode
            if (this.widget) {
                this.hideWidget();
            }
        }
    }

    createWidget() {
        // Only create widget in floating mode
        if (this.viewMode !== 'floating') {
            return;
        }

        if (this.widget) {
            this.widget.remove();
        }

        this.widget = document.createElement('div');
        this.widget.className = 'sdg-badge-widget';
        this.widget.style.width = this.badgeSize + 'px';
        this.widget.style.height = this.badgeSize + 'px';
        this.widget.innerHTML = `
            <button class="sdg-widget-close" title="Close SDG Badge">×</button>
            <div class="sdg-widget-content">
                <div class="sdg-widget-loading">
                    <div class="sdg-loading-spinner"></div>
                    <div class="sdg-loading-text">Analyzing content...</div>
                </div>
            </div>
            <div class="sdg-mode-indicator">${this.currentMode === 'select' ? 'Select Mode' : 'Page Mode'}</div>
        `;

        // Add event listeners
        this.widget.querySelector('.sdg-widget-close').addEventListener('click', (e) => {
            console.log('Close button clicked');
            e.preventDefault();
            e.stopPropagation();
            this.hideWidget();
        });

        // Make widget draggable
        this.makeDraggable();

        document.body.appendChild(this.widget);
        this.isVisible = true;
    }

    makeDraggable() {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const dragStart = (e) => {
            if (e.target.classList.contains('sdg-widget-close')) return;
            
            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }

            if (e.target === this.widget || this.widget.contains(e.target)) {
                isDragging = true;
                this.widget.classList.add('dragging');
            }
        };

        const dragEnd = (e) => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
            this.widget.classList.remove('dragging');
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }

                xOffset = currentX;
                yOffset = currentY;

                // Constrain to viewport
                const maxX = window.innerWidth - this.widget.offsetWidth;
                const maxY = window.innerHeight - this.widget.offsetHeight;
                
                currentX = Math.max(0, Math.min(currentX, maxX));
                currentY = Math.max(0, Math.min(currentY, maxY));

                this.widget.style.transform = `translate(${currentX}px, ${currentY}px)`;
            }
        };

        this.widget.addEventListener('mousedown', dragStart);
        this.widget.addEventListener('touchstart', dragStart);
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag);
        document.addEventListener('mouseup', dragEnd);
        document.addEventListener('touchend', dragEnd);
    }

    updateWidgetSize() {
        if (this.widget) {
            this.widget.style.width = this.badgeSize + 'px';
            this.widget.style.height = this.badgeSize + 'px';
        }
    }

    updateModeIndicator() {
        const indicator = this.widget?.querySelector('.sdg-mode-indicator');
        if (indicator) {
            indicator.textContent = this.currentMode === 'select' ? 'Select Mode' : 'Page Mode';
        }
    }

    handleTextSelection() {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        if (selectedText && selectedText !== this.selectedText && selectedText.length > 10) {
            this.selectedText = selectedText;
            this.analyzeText(selectedText);
        }
    }

    analyzeContent() {
        if (this.currentMode === 'page') {
            const pageText = this.extractPageText();
            if (pageText && pageText !== this.lastAnalyzedText) {
                this.lastAnalyzedText = pageText;
                this.analyzeText(pageText);
            }
        }
    }

    extractPageText() {
        // Get main content, excluding navigation, ads, etc.
        const contentSelectors = [
            'main',
            'article',
            '[role="main"]',
            '.content',
            '.main-content',
            '#content',
            '#main'
        ];
        
        let content = '';
        
        // Try to find main content area
        for (const selector of contentSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                content = element.innerText;
                break;
            }
        }
        
        // Fallback to body content
        if (!content) {
            content = document.body.innerText;
        }
        
        // Clean up text
        content = content.replace(/\s+/g, ' ').trim();
        
        // Limit text length for API
        const maxLength = 5000; // Reasonable limit for API
        if (content.length > maxLength) {
            content = content.substring(0, maxLength) + '...';
        }
        
        return content;
    }

    analyzeText(text) {
        if (!text || text.trim().length === 0 || this.isProcessing) {
            return;
        }

        this.isProcessing = true;
        this.showLoading();

        // Send text to background script for classification
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({
                action: 'classifyText',
                text: text
            }, (response) => {
                this.isProcessing = false;
                
                if (response && response.success) {
                    this.displayResults(response.data);
                } else {
                    this.showError(response?.error || 'Classification failed');
                }
            });
        }
    }

    showLoading() {
        const content = this.widget?.querySelector('.sdg-widget-content');
        if (content) {
            content.innerHTML = `
                <div class="sdg-widget-loading">
                    <div class="sdg-loading-spinner"></div>
                    <div class="sdg-loading-text">Analyzing content...</div>
                </div>
            `;
        }
    }

    displayResults(data) {
        // Store the analysis data for popup retrieval
        this.lastAnalyzedData = data;
        
        // Only display in floating widget if in floating mode
        if (this.viewMode === 'floating') {
            const content = this.widget?.querySelector('.sdg-widget-content');
            if (!content) return;

            if (data.predictions && data.predictions.length > 0) {
                // Create official SDG wheel widget
                const sdgWheelDiv = document.createElement('div');
                sdgWheelDiv.className = 'sdg-wheel';
                sdgWheelDiv.setAttribute('data-text', this.lastAnalyzedText || this.selectedText);
                sdgWheelDiv.setAttribute('data-model', 'aurora-sdg-multi');
                sdgWheelDiv.setAttribute('data-wheel-height', this.badgeSize - 20);
                
                // Attach the data to the element for the widget to use
                sdgWheelDiv.sdgData = data;
                
                content.innerHTML = '';
                content.appendChild(sdgWheelDiv);
                
                // Load and execute the official widget script
                this.loadOfficialWidget();
            } else {
                content.innerHTML = `
                    <div class="sdg-widget-error">
                        <div class="error-icon">🔍</div>
                        <div class="error-text">No SDG classification found</div>
                    </div>
                `;
            }
        }
    }

    loadOfficialWidget() {
        // Load the official widget script if not already loaded
        if (!window.sdgWidgetLoaded) {
            const script = document.createElement('script');
            script.src = chrome.runtime.getURL('scripts/widget.js');
            script.onload = () => {
                window.sdgWidgetLoaded = true;
                console.log('Official SDG widget loaded');
                // Trigger widget initialization after load
                setTimeout(() => {
                    this.initializeSDGWheel();
                }, 100);
            };
            document.head.appendChild(script);
        } else {
            // Widget already loaded, just initialize
            this.initializeSDGWheel();
        }
    }

    initializeSDGWheel() {
        // Manually trigger the widget initialization for our specific element
        const sdgWheelElement = this.widget?.querySelector('.sdg-wheel');
        if (sdgWheelElement && window.jQuery) {
            // Force the widget to process our element
            console.log('Initializing SDG wheel for element:', sdgWheelElement);
            // The widget.js script should automatically process .sdg-wheel elements
            // but we may need to trigger it manually
        }
    }

    addBadgeStyles() {
        if (document.querySelector('#sdg-badge-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'sdg-badge-styles';
        style.textContent = `
            .sdg-badge-display {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100%;
                padding: 20px;
                text-align: center;
            }
            
            .sdg-goal-number {
                font-size: 48px;
                font-weight: bold;
                color: #007bff;
                margin-bottom: 10px;
            }
            
            .sdg-confidence {
                margin-bottom: 15px;
            }
            
            .confidence-label {
                font-size: 12px;
                color: #666;
                margin-bottom: 4px;
            }
            
            .confidence-value {
                font-size: 18px;
                font-weight: bold;
                color: #28a745;
            }
            
            .sdg-icon {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                object-fit: cover;
            }
            
            .error-icon {
                font-size: 32px;
                margin-bottom: 10px;
            }
            
            .error-text {
                font-size: 14px;
                color: #666;
            }
        `;
        
        document.head.appendChild(style);
    }

    showError(error) {
        const content = this.widget?.querySelector('.sdg-widget-content');
        if (content) {
            content.innerHTML = `
                <div class="sdg-widget-error">
                    <div class="error-icon">⚠️</div>
                    <div class="error-text">${error}</div>
                </div>
            `;
        }
    }

    showWidget() {
        if (this.widget) {
            this.widget.style.display = 'flex';
            this.isVisible = true;
        }
    }

    hideWidget() {
        console.log('hideWidget called');
        if (this.widget) {
            this.widget.style.display = 'none';
            this.isVisible = false;
            console.log('Widget hidden');
        }
    }

    openSidebar() {
        // Sidebar is now opened by clicking the extension icon (user gesture)
        // This method is kept for compatibility but no longer sends messages
        console.log('Sidebar will open when user clicks extension icon');
    }
}

// Initialize the widget when the page loads
let sdgWidget = null;

function initSDGWidget() {
    // Only initialize once
    if (sdgWidget) return;
    
    // Don't initialize on certain pages
    if (window.location.hostname === 'chrome-extension' || 
        window.location.hostname === 'moz-extension' ||
        window.location.protocol === 'chrome-extension:' ||
        window.location.protocol === 'moz-extension:') {
        return;
    }
    
    sdgWidget = new SDGBadgeWidget();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSDGWidget);
} else {
    initSDGWidget();
}
