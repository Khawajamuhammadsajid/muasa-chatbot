/**
 * ============================================================================
 * Muasa Bot - Production Storefront Theme Extension JavaScript
 * Features:
 * - barebeautypk.com Obsidian Dark UI/UX
 * - Dynamic Category & Collections Carousel
 * - 5-Product Batching with "Load More Products"
 * - In-Cart State & Direct Checkout Conversion Flow
 * - Sub-Second Fast Customer Care Intelligence
 * ============================================================================
 */

(function () {
  'use strict';

  const config = window.MUASA_BOT_CONFIG || {
    shopDomain: window.location.hostname,
    shopName: 'Store',
    currency: 'PKR',
    currencySymbol: 'Rs.',
    proxyUrl: '/apps/muasa-bot',
    welcomeMessage: 'Welcome to our store! Ask me anything you are interested in.',
    supportEmail: ''
  };

  let isOpen = false;
  let isSending = false;
  let isSoundEnabled = false;
  let conversationHistory = [];
  let savedMessages = [];
  let currentSearchQuery = '';
  let currentOffset = 0;

  // Persistent storage keys per shop domain
  const shopKey = (config.shopDomain || window.location.hostname || 'store').replace(/\W+/g, '_');
  const STORAGE_CHAT_KEY = 'muasa_chat_msgs_' + shopKey;
  const STORAGE_CONV_KEY = 'muasa_conv_hist_' + shopKey;
  const STORAGE_SID_KEY = 'muasa_chat_sid_' + shopKey;
  const STORAGE_CART_KEY = 'muasa_chat_cart_' + shopKey;

  // Retrieve or create anonymous session ID (stored in localStorage across reloads)
  let customerSessionId = '';
  try {
    customerSessionId = window.localStorage.getItem(STORAGE_SID_KEY);
    if (!customerSessionId) {
      customerSessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
      window.localStorage.setItem(STORAGE_SID_KEY, customerSessionId);
    }
  } catch (e) {
    void e;
    customerSessionId = 'sess_anon_' + Date.now();
  }

  function playSoftChime() {
    if (!isSoundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      void e;
    }
  }

  function init() {
    const launcherBtn = document.getElementById('muasa-launcher-btn');
    const modal = document.getElementById('muasa-chat-modal');
    const closeBtn = document.getElementById('muasa-close-btn');
    const soundBtn = document.getElementById('muasa-sound-btn');
    const soundOffIcon = document.getElementById('muasa-sound-off-icon');
    const soundOnIcon = document.getElementById('muasa-sound-on-icon');
    const chatForm = document.getElementById('muasa-chat-form');
    const userInput = document.getElementById('muasa-user-input');
    const carouselTrack = document.getElementById('muasa-collections-carousel');
    const carouselNext = document.getElementById('muasa-carousel-next');

    if (!launcherBtn || !modal) return;

    function openModal() {
      isOpen = true;
      modal.style.display = 'flex';
      launcherBtn.setAttribute('aria-expanded', 'true');
      if (userInput) userInput.focus();
      scrollToBottom();
      trackEvent('chat_started');
    }

    function closeModal() {
      isOpen = false;
      modal.style.display = 'none';
      launcherBtn.setAttribute('aria-expanded', 'false');
      launcherBtn.focus();
    }

    launcherBtn.addEventListener('click', () => {
      if (isOpen) {
        closeModal();
      } else {
        openModal();
      }
    });

    closeBtn.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isOpen) {
        closeModal();
      }
    });

    // Sound Toggle
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        if (soundOffIcon && soundOnIcon) {
          soundOffIcon.style.display = isSoundEnabled ? 'none' : 'block';
          soundOnIcon.style.display = isSoundEnabled ? 'block' : 'none';
        }
        if (isSoundEnabled) playSoftChime();
      });
    }

    // Carousel Scroll Next Button
    if (carouselNext && carouselTrack) {
      carouselNext.addEventListener('click', () => {
        carouselTrack.scrollBy({ left: 160, behavior: 'smooth' });
      });
    }

    // Load Collections for Carousel from Proxy
    loadInitialCollections();

    // Default Quick Chips
    renderChips([
      'Explore Best Sellers',
      'Delivery & COD Info',
      'Return & Exchange',
      'Contact Support'
    ]);

    // Options (3 Dots) Dropdown Handlers
    const optionsBtn = document.getElementById('muasa-options-btn');
    const optionsMenu = document.getElementById('muasa-options-menu');
    const newChatBtn = document.getElementById('muasa-new-chat-btn');

    if (optionsBtn && optionsMenu) {
      optionsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = optionsMenu.style.display === 'none';
        optionsMenu.style.display = isHidden ? 'flex' : 'none';
        optionsBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
      });

      document.addEventListener('click', (e) => {
        if (!optionsBtn.contains(e.target) && !optionsMenu.contains(e.target)) {
          optionsMenu.style.display = 'none';
          optionsBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    if (newChatBtn) {
      newChatBtn.addEventListener('click', (e) => {
        e.preventDefault();
        clearChatAndStartNew();
      });
    }

    function submitChat() {
      if (!userInput) return;
      const query = (userInput.value || '').trim();
      if (!query || isSending) return;

      userInput.value = '';
      currentSearchQuery = query;
      currentOffset = 0;
      sendCustomerMessage(query, 0);
    }

    // Submit handler via Form Submit
    if (chatForm) {
      chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        submitChat();
      });
    }

    // Submit handler via Enter key on Input
    if (userInput) {
      userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitChat();
        }
      });
    }

    // Submit handler via Send Button Click
    const sendBtn = document.getElementById('muasa-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        submitChat();
      });
    }

    // Restore chat from persistent storage on page refresh
    loadStateFromStorage();
  }

  async function loadInitialCollections() {
    const track = document.getElementById('muasa-collections-carousel');
    if (!track) return;

    try {
      const res = await fetch(`${config.proxyUrl || '/apps/muasa-bot'}?shop=${config.shopDomain}`);
      const data = await res.json();

      if (data && data.currencySymbol) {
        config.currencySymbol = data.currencySymbol;
      }
      if (data && data.currency) {
        config.currency = data.currency;
      }

      let collections = data.collections || [];

      // Fallback collections if none exist in dev store
      if (collections.length === 0) {
        collections = [
          { title: 'Best Sellers', handle: 'best-sellers', image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=200&auto=format&fit=crop&q=60' },
          { title: 'Cleansers', handle: 'cleansers', image: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=200&auto=format&fit=crop&q=60' },
          { title: 'Moisturizers', handle: 'moisturizers', image: 'https://images.unsplash.com/photo-1608248597359-597525dfc4a1?w=200&auto=format&fit=crop&q=60' },
          { title: 'Serums', handle: 'serums', image: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=200&auto=format&fit=crop&q=60' }
        ];
      }

      track.innerHTML = '';
      collections.forEach((col, idx) => {
        const card = document.createElement('div');
        card.className = 'muasa-carousel-card';
        let displayTitle = col.title || 'Collection';
        if (displayTitle.toLowerCase().includes('automated')) displayTitle = 'Best Sellers';

        const fallbackImages = [
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=300&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=300&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1608248597359-597525dfc4a1?w=300&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=300&auto=format&fit=crop&q=80'
        ];
        const defaultImg = fallbackImages[idx % fallbackImages.length];
        const imgUrl = (col.image && !col.image.includes('placeholder')) ? col.image : defaultImg;

        card.innerHTML = `
          <div class="muasa-carousel-img-box">
            <img src="${imgUrl}" alt="${displayTitle}" loading="lazy"/>
          </div>
          <div class="muasa-carousel-label" title="${displayTitle}">${displayTitle}</div>
        `;

        card.addEventListener('click', () => {
          const q = `Show me ${displayTitle}`;
          currentSearchQuery = q;
          currentOffset = 0;
          sendCustomerMessage(q, 0);
        });

        track.appendChild(card);
      });
    } catch (e) {
      void e;
    }
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_CHAT_KEY, JSON.stringify(savedMessages));
      localStorage.setItem(STORAGE_CONV_KEY, JSON.stringify(conversationHistory));
    } catch (e) {
      void e;
    }
  }

  function loadStateFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_CHAT_KEY);
      if (stored) {
        const msgs = JSON.parse(stored);
        if (Array.isArray(msgs) && msgs.length > 0) {
          savedMessages = [];
          msgs.forEach((m) => {
            if (m && m.sender) {
              appendMessage(m.sender, m.text || '', m.products || [], m.heading || null, Boolean(m.hasMore), false);
            }
          });
          savedMessages = msgs;
        }
      }

      const storedConv = localStorage.getItem(STORAGE_CONV_KEY);
      if (storedConv) {
        const conv = JSON.parse(storedConv);
        if (Array.isArray(conv)) conversationHistory = conv;
      }

      const hasCart = localStorage.getItem(STORAGE_CART_KEY);
      if (hasCart && parseInt(hasCart, 10) > 0) {
        showCheckoutBanner();
      }
    } catch (e) {
      console.warn('[MuasaBot] Error loading saved chat:', e);
    }
  }

  function clearChatAndStartNew() {
    try {
      localStorage.removeItem(STORAGE_CHAT_KEY);
      localStorage.removeItem(STORAGE_CONV_KEY);
      localStorage.removeItem(STORAGE_CART_KEY);
      customerSessionId = 'sess_' + Math.random().toString(36).substring(2, 12);
      localStorage.setItem(STORAGE_SID_KEY, customerSessionId);
    } catch (e) {
      void e;
    }

    isSending = false;
    savedMessages = [];
    conversationHistory = [];

    const messagesBox = document.getElementById('muasa-messages-box');
    if (messagesBox) {
      // Remove all message divs and checkout banner
      messagesBox.querySelectorAll('.muasa-msg, #muasa-checkout-banner').forEach((el) => el.remove());
      // Show welcome hero
      const welcomeHero = document.getElementById('muasa-welcome-hero');
      if (welcomeHero) welcomeHero.style.display = 'block';
    }

    // Reset default exploration chips
    renderChips([
      'Explore Best Sellers',
      'Delivery & COD Info',
      'Return & Exchange',
      'Contact Support'
    ]);

    // Close options menu
    const menu = document.getElementById('muasa-options-menu');
    if (menu) menu.style.display = 'none';

    const optionsBtn = document.getElementById('muasa-options-btn');
    if (optionsBtn) optionsBtn.setAttribute('aria-expanded', 'false');

    scrollToBottom();
  }

  function appendMessage(sender, text, products = [], heading = null, hasMore = false, save = true) {
    const messagesBox = document.getElementById('muasa-messages-box');
    if (!messagesBox) return;

    // Hide welcome hero whenever any message is present
    const welcomeHero = document.getElementById('muasa-welcome-hero');
    if (welcomeHero) {
      welcomeHero.style.display = 'none';
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `muasa-msg muasa-msg-${sender}`;

    let html = '';
    if (heading && sender === 'ai') {
      html += `<div class="muasa-msg-heading">${heading}</div>`;
    }

    // Render Product Cards if any
    if (products && products.length > 0) {
      products.forEach((p) => {
        const imgUrl = p.image || 'https://via.placeholder.com/85?text=Product';
        let priceText = 'In Stock';
        if (p.price) {
          const pStr = String(p.price).trim();
          if (/^[^\d\s]|^(Rs|PKR|USD|INR|EUR|GBP)\b/i.test(pStr)) {
            priceText = pStr;
          } else {
            priceText = `${config.currencySymbol ? config.currencySymbol + ' ' : ''}${pStr}`;
          }
        }
        const variantId = p.primaryVariantId || p.variantId || '';
        const productUrl = p.url || `/products/${p.handle || ''}`;

        html += `
          <div class="muasa-product-card" data-product-handle="${p.handle || ''}">
            <div class="muasa-product-card-top">
              <div class="muasa-card-img-wrap">
                <img class="muasa-card-img" src="${imgUrl}" alt="${p.title}" loading="lazy"/>
              </div>
              <div class="muasa-card-details">
                <a class="muasa-card-title" href="${productUrl}" target="_blank" rel="noopener">${p.title}</a>
                <div class="muasa-card-price">${priceText}</div>
              </div>
            </div>
            <div class="muasa-card-actions">
              <button class="muasa-card-btn muasa-btn-add" data-variant-id="${variantId}" type="button">
                🛒 Add to cart
              </button>
              <a class="muasa-card-btn muasa-btn-view" href="${productUrl}" target="_blank" rel="noopener">
                View product ↗
              </a>
            </div>
          </div>
        `;
      });
    }

    // Format text
    const escaped = (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const formatted = escaped
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');

    html += `<div style="margin-top: ${products.length > 0 ? '12px' : '0'}; line-height: 1.5;">${formatted}</div>`;

    // Load More Button if hasMore is true
    if (hasMore && sender === 'ai') {
      html += `
        <button class="muasa-load-more-btn" type="button">
          Load More Products ▾
        </button>
      `;
    }

    msgDiv.innerHTML = html;
    messagesBox.appendChild(msgDiv);

    // Attach event listeners to Add to Cart buttons
    msgDiv.querySelectorAll('.muasa-btn-add').forEach((btn) => {
      btn.addEventListener('click', () => {
        const vId = btn.getAttribute('data-variant-id');
        handleAddToCart(vId, btn);
      });
    });

    // Attach event listener to Load More button
    const loadMoreBtn = msgDiv.querySelector('.muasa-load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.addEventListener('click', () => {
        loadMoreBtn.remove();
        currentOffset += 5;
        sendCustomerMessage(currentSearchQuery, currentOffset, true);
      });
    }

    if (save) {
      savedMessages.push({ sender, text, products, heading, hasMore });
      if (savedMessages.length > 30) savedMessages.shift();

      conversationHistory.push({
        role: sender === 'user' ? 'user' : 'assistant',
        content: text
      });
      if (conversationHistory.length > 6) conversationHistory.shift();

      saveStateToStorage();
    }

    scrollToBottom();
  }

  function renderChips(chips = []) {
    const chipsBox = document.getElementById('muasa-chips-box');
    if (!chipsBox) return;

    chipsBox.innerHTML = '';
    chips.forEach((chipText) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'muasa-chip';
      chip.textContent = chipText;
      chip.addEventListener('click', () => {
        currentSearchQuery = chipText;
        currentOffset = 0;
        sendCustomerMessage(chipText, 0);
      });
      chipsBox.appendChild(chip);
    });
  }

  function showTypingIndicator() {
    const messagesBox = document.getElementById('muasa-messages-box');
    if (!messagesBox) return null;

    const ind = document.createElement('div');
    ind.id = 'muasa-typing-indicator';
    ind.className = 'muasa-msg muasa-msg-ai';
    ind.setAttribute('aria-label', 'AI Assistant is thinking...');
    ind.innerHTML = `
      <div class="muasa-thinking-pill">
        <span class="muasa-thinking-sparkle">✦</span>
        <div class="muasa-thinking-content">
          <span class="muasa-thinking-text">Thinking</span>
          <div class="muasa-thinking-bars">
            <span class="muasa-thinking-bar"></span>
            <span class="muasa-thinking-bar"></span>
            <span class="muasa-thinking-bar"></span>
          </div>
        </div>
      </div>
    `;
    messagesBox.appendChild(ind);
    scrollToBottom();
    return ind;
  }

  function removeTypingIndicator() {
    const ind = document.getElementById('muasa-typing-indicator');
    if (ind) ind.remove();
  }

  async function sendCustomerMessage(messageText, offset = 0, isPagination = false) {
    if (!isPagination) {
      appendMessage('user', messageText);
    }

    isSending = true;
    showTypingIndicator();

    try {
      const endpoint = `${config.proxyUrl || '/apps/muasa-bot'}/chat`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: messageText,
          sessionId: customerSessionId,
          currency: config.currency,
          offset: offset,
          conversationHistory: conversationHistory.slice(-4)
        })
      });

      removeTypingIndicator();

      if (!response.ok) {
        console.warn('[MuasaBot] Proxy responded with status:', response.status);
        appendMessage('ai', "I'm checking our catalog. How can I assist you with your shopping or order today?");
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch (jsonErr) {
        console.error('[MuasaBot] Failed to parse JSON response:', jsonErr);
        appendMessage('ai', "I am ready to help! Please ask about any products, sizing, or store delivery.");
        return;
      }

      if (data && data.reply) {
        appendMessage('ai', data.reply, data.products || [], data.heading, data.hasMore);
        playSoftChime();

        if (data.chips && data.chips.length > 0) {
          renderChips(data.chips);
        }
      } else {
        appendMessage('ai', "I am ready to help! Please ask about any products, sizing, or store delivery.");
      }

    } catch (err) {
      console.error('[MuasaBot] Request failed:', err);
      removeTypingIndicator();
      appendMessage('ai', "I'm checking our inventory. Please feel free to ask about any product or policy!");
    } finally {
      isSending = false;
      scrollToBottom();
    }
  }

  async function handleAddToCart(variantId, buttonElement) {
    if (!variantId) {
      buttonElement.textContent = 'Check in Store';
      buttonElement.disabled = true;
      return;
    }

    buttonElement.disabled = true;
    buttonElement.textContent = 'Adding...';

    try {
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: variantId,
          quantity: 1
        })
      });

      if (res.ok) {
        buttonElement.textContent = '✓ Added to cart';
        buttonElement.classList.add('in-cart');
        buttonElement.disabled = false;

        // Persist cart items added
        try {
          const currentCount = parseInt(localStorage.getItem(STORAGE_CART_KEY) || '0', 10) + 1;
          localStorage.setItem(STORAGE_CART_KEY, String(currentCount));
        } catch (_) {
          void _;
        }

        // Show/Update prominent Proceed to Checkout Banner
        showCheckoutBanner();

        // Render Checkout & Next steps Chips
        renderChips([
          'Proceed to Checkout',
          'View Shopping Cart',
          'Explore More Products',
          'Delivery & COD Info'
        ]);

        trackEvent('add_to_cart_clicked');

        // Fire Shopify theme cart events for header cart counters without leaving chat
        document.dispatchEvent(new CustomEvent('cart:updated', { bubbles: true }));
        document.dispatchEvent(new CustomEvent('ajaxCart.success', { bubbles: true }));

      } else {
        buttonElement.textContent = 'Out of Stock';
        buttonElement.disabled = true;
      }
    } catch (e) {
      buttonElement.textContent = 'Out of Stock';
      buttonElement.disabled = true;
    }
  }

  function showCheckoutBanner() {
    const messagesBox = document.getElementById('muasa-messages-box');
    if (!messagesBox) return;

    let banner = document.getElementById('muasa-checkout-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'muasa-checkout-banner';
      banner.className = 'muasa-checkout-banner';
      messagesBox.appendChild(banner);
    } else {
      messagesBox.appendChild(banner);
    }

    banner.innerHTML = `
      <div>
        <strong style="color: #ffffff; font-size: 13.5px;">✓ Item added to cart!</strong>
        <div style="color: #a1a1aa; font-size: 11.5px;">Ready to complete your order?</div>
      </div>
      <a class="muasa-checkout-btn" href="/checkout">
        Proceed to Checkout →
      </a>
    `;
    scrollToBottom();
  }

  function trackEvent(eventType, productHandle = null) {
    try {
      const endpoint = `${config.proxyUrl || '/apps/muasa-bot'}/track`;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track',
          eventType: eventType,
          productHandle: productHandle,
          metadata: { sessionId: customerSessionId }
        })
      }).catch((err) => {
        void err;
      });
    } catch (err) {
      void err;
    }
  }

  function scrollToBottom() {
    const box = document.getElementById('muasa-messages-box');
    if (box) {
      box.scrollTop = box.scrollHeight;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
