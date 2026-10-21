// Content Script - Runs in page context to extract content
(function () {
  'use strict';

  let analyzed = false;
  let analyzing = false;
  let bypassAttempts = 0;

  function extractPageContent() {
    // Extract meaningful text (limit to 3000 chars)
    const title = document.title || '';
    const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.content || '';
    
    // Get body text, prioritizing main content
    const contentSelectors = ['main', 'article', '#content', '.content', 'body'];
    let bodyText = '';
    
    for (const sel of contentSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        bodyText = el.innerText || el.textContent || '';
        if (bodyText.length > 100) break;
      }
    }
    
    // Combine and clean
    const combined = `${title} ${metaDesc} ${metaKeywords} ${bodyText}`;
    return combined.replace(/\s+/g, ' ').trim().substring(0, 3000);
  }

  async function analyzeCurrentPage() {
    if (analyzing) return;
    analyzing = true;
    
    try {
      const text = extractPageContent();
      const response = await chrome.runtime.sendMessage({
        action: 'ANALYZE_CONTENT',
        data: {
          url: window.location.href,
          title: document.title,
          text: text,
        },
      });
      
      if (response?.block) {
        // Redirect to block page
        const params = new URLSearchParams({
          url: window.location.href,
          reason: response.reason || 'blocked',
          category: response.category || 'unknown',
          confidence: response.confidence?.toString() || '0',
          explanation: response.explanation || '',
        });
        
        window.location.replace(
          chrome.runtime.getURL(`block.html?${params}`)
        );
      }
    } catch (e) {
      // Extension context invalidated or other error - ignore
    } finally {
      analyzing = false;
      analyzed = true;
    }
  }

  // Analyze page when DOM is ready
  function init() {
    if (analyzed) return;
    
    // Wait for page to have meaningful content
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(analyzeCurrentPage, 500);
      });
    } else {
      setTimeout(analyzeCurrentPage, 500);
    }
  }

  // Listen for messages from service worker or popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        title: document.title,
        text: extractPageContent(),
      });
    }
    
    if (message.action === 'ANALYZE_NOW') {
      analyzed = false;
      analyzeCurrentPage().then(() => sendResponse({ done: true }));
      return true;
    }
  });

  // Track bypass attempts (accessing blocked content via back navigation)
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) {
      analyzed = false;
      analyzeCurrentPage();
    }
  });

  // Detect attempts to access previously blocked content
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(this, args);
    analyzed = false;
    setTimeout(analyzeCurrentPage, 300);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    analyzed = false;
    setTimeout(analyzeCurrentPage, 300);
  };

  init();
})();
