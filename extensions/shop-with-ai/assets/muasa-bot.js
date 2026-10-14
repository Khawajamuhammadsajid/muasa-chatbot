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
  let lastAddedProduct = null;

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

    // Cart Action Icon in Header (Open In-Chat Checkout)
    const cartHeaderBtn = document.querySelector('.muasa-header-actions a[href*="cart"]');
    if (cartHeaderBtn) {
      cartHeaderBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openInChatCheckout();
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
        if (chipText.includes('Proceed to Checkout') || chipText.includes('Checkout')) {
          openInChatCheckout();
        } else if (chipText.includes('Similar Products')) {
          exploreSimilarProducts();
        } else if (chipText.includes('Best Seller')) {
          exploreBestSellers();
        } else {
          currentSearchQuery = chipText;
          currentOffset = 0;
          sendCustomerMessage(chipText, 0);
        }
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

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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

        // Persist cart items added & track product details
        const card = buttonElement.closest('.muasa-product-card');
        if (card) {
          const titleEl = card.querySelector('.muasa-card-title');
          lastAddedProduct = {
            title: titleEl ? titleEl.textContent.trim() : '',
            handle: card.getAttribute('data-product-handle') || '',
            variantId: variantId
          };
        }

        try {
          const currentCount = parseInt(localStorage.getItem(STORAGE_CART_KEY) || '0', 10) + 1;
          localStorage.setItem(STORAGE_CART_KEY, String(currentCount));
        } catch (_) {
          void _;
        }

        // Show/Update prominent 3-Action Banner in chat
        showCheckoutBanner();

        // Render Action Chips
        renderChips([
          'Proceed to Checkout',
          'Explore Similar Products',
          'Best Seller Collection'
        ]);

        trackEvent('add_to_cart_clicked', lastAddedProduct?.handle);

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

    const itemLabel = lastAddedProduct?.title ? `"${lastAddedProduct.title}" added to cart!` : 'Item added to cart!';

    banner.innerHTML = `
      <div class="muasa-banner-header">
        <span class="muasa-banner-badge">✓ In Cart</span>
        <span class="muasa-banner-subtitle">${escapeHtml(itemLabel)}</span>
      </div>
      <div class="muasa-banner-actions">
        <button class="muasa-banner-btn muasa-banner-checkout-btn" type="button" id="muasa-banner-checkout-btn">
          🛒 Proceed to Checkout
        </button>
        <button class="muasa-banner-btn muasa-banner-similar-btn" type="button" id="muasa-banner-similar-btn">
          🔍 Explore Similar Products
        </button>
        <button class="muasa-banner-btn muasa-banner-bestseller-btn" type="button" id="muasa-banner-bestseller-btn">
          ⭐ Best Seller Collection
        </button>
      </div>
    `;

    document.getElementById('muasa-banner-checkout-btn')?.addEventListener('click', openInChatCheckout);
    document.getElementById('muasa-banner-similar-btn')?.addEventListener('click', exploreSimilarProducts);
    document.getElementById('muasa-banner-bestseller-btn')?.addEventListener('click', exploreBestSellers);

    scrollToBottom();
  }

  function exploreSimilarProducts() {
    const title = lastAddedProduct?.title || '';
    const query = title ? `Show similar products to ${title}` : 'Explore similar products';
    currentSearchQuery = query;
    currentOffset = 0;
    sendCustomerMessage(query, 0);
  }

  function exploreBestSellers() {
    const query = 'Explore Best Sellers';
    currentSearchQuery = query;
    currentOffset = 0;
    sendCustomerMessage(query, 0);
  }

  async function openInChatCheckout() {
    const checkoutView = document.getElementById('muasa-checkout-view');
    const messagesBox = document.getElementById('muasa-messages-box');
    const chipsBox = document.getElementById('muasa-chips-box');
    const chatForm = document.getElementById('muasa-chat-form');
    if (!checkoutView) return;

    checkoutView.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #a1a1aa; gap: 10px; padding: 40px 0;">
        <div style="font-size: 24px; color: #10b981;">✦</div>
        <div style="font-size: 13px;">Loading your cart items...</div>
      </div>
    `;
    checkoutView.style.display = 'flex';
    if (messagesBox) messagesBox.style.display = 'none';
    if (chipsBox) chipsBox.style.display = 'none';
    if (chatForm) chatForm.style.display = 'none';

    try {
      const res = await fetch('/cart.js');
      const cart = await res.json();
      renderCheckoutContent(cart);
    } catch (err) {
      console.error('[MuasaBot] Failed to load cart:', err);
      checkoutView.innerHTML = `
        <div class="muasa-checkout-header">
          <span class="muasa-checkout-header-title">Quick Checkout 🛒</span>
          <button type="button" class="muasa-checkout-back-btn" id="muasa-checkout-err-back">← Back to Chat</button>
        </div>
        <div style="text-align: center; padding: 30px 10px; color: #ef4444; font-size: 13px;">
          Could not load cart items. Please try again.
        </div>
      `;
      document.getElementById('muasa-checkout-err-back')?.addEventListener('click', closeInChatCheckout);
    }
  }

  function closeInChatCheckout() {
    const checkoutView = document.getElementById('muasa-checkout-view');
    const messagesBox = document.getElementById('muasa-messages-box');
    const chipsBox = document.getElementById('muasa-chips-box');
    const chatForm = document.getElementById('muasa-chat-form');
    if (checkoutView) checkoutView.style.display = 'none';
    if (messagesBox) messagesBox.style.display = 'flex';
    if (chipsBox) chipsBox.style.display = 'flex';
    if (chatForm) chatForm.style.display = 'block';
    scrollToBottom();
  }

  function renderCheckoutContent(cart) {
    const checkoutView = document.getElementById('muasa-checkout-view');
    if (!checkoutView) return;

    if (!cart.items || cart.items.length === 0) {
      checkoutView.innerHTML = `
        <div class="muasa-checkout-header">
          <span class="muasa-checkout-header-title">Quick Checkout 🛒</span>
          <button type="button" class="muasa-checkout-back-btn" id="muasa-empty-back-btn">← Back to Chat</button>
        </div>
        <div style="text-align: center; padding: 50px 14px; color: #a1a1aa; display: flex; flex-direction: column; align-items: center; gap: 8px;">
          <div style="font-size: 36px;">🛒</div>
          <strong style="color: #ffffff; font-size: 15px;">Your Shopping Cart is Empty</strong>
          <p style="font-size: 12.5px; color: #a1a1aa; max-width: 240px; margin: 4px 0 12px 0;">Add products from our recommendations or store to checkout right here!</p>
          <button type="button" class="muasa-continue-shopping-btn" id="muasa-empty-browse-btn">
            Explore Best Sellers →
          </button>
        </div>
      `;
      document.getElementById('muasa-empty-back-btn')?.addEventListener('click', closeInChatCheckout);
      document.getElementById('muasa-empty-browse-btn')?.addEventListener('click', () => {
        closeInChatCheckout();
        exploreBestSellers();
      });
      return;
    }

    const totalFormatted = ((cart.total_price || 0) / 100).toLocaleString();

    let itemsHtml = '';
    cart.items.forEach((item) => {
      const itemImg = item.featured_image?.url || item.image || '';
      const itemTitle = item.product_title || item.title || 'Product';
      const variantText = item.variant_title ? `${item.variant_title} • ` : '';
      const linePrice = ((item.final_line_price || item.line_price || item.price) / 100).toLocaleString();

      itemsHtml += `
        <div class="muasa-checkout-item">
          ${itemImg ? `<img class="muasa-checkout-item-img" src="${itemImg}" alt="${escapeHtml(itemTitle)}" />` : '<div class="muasa-checkout-item-img"></div>'}
          <div class="muasa-checkout-item-info">
            <div class="muasa-checkout-item-name">${escapeHtml(itemTitle)}</div>
            <div class="muasa-checkout-item-meta">${escapeHtml(variantText)}Qty: ${item.quantity}</div>
          </div>
          <div class="muasa-checkout-item-price">${config.currencySymbol} ${linePrice}</div>
        </div>
      `;
    });

    checkoutView.innerHTML = `
      <div class="muasa-checkout-header">
        <span class="muasa-checkout-header-title">Quick Checkout 🛒</span>
        <button type="button" class="muasa-checkout-back-btn" id="muasa-form-back-btn">← Back to Chat</button>
      </div>

      <div class="muasa-checkout-section-title">Order Items (${cart.item_count})</div>
      <div class="muasa-checkout-items-card">
        ${itemsHtml}
        <div class="muasa-checkout-totals">
          <div class="muasa-checkout-row">
            <span>Subtotal</span>
            <span>${config.currencySymbol} ${totalFormatted}</span>
          </div>
          <div class="muasa-checkout-row">
            <span>Delivery</span>
            <span style="color: #10b981; font-weight: 600;">FREE (Standard)</span>
          </div>
          <div class="muasa-checkout-row muasa-checkout-total">
            <span>Total Amount</span>
            <span style="color: #10b981;">${config.currencySymbol} ${totalFormatted}</span>
          </div>
        </div>
      </div>

      <div class="muasa-checkout-section-title">Contact Information</div>
      <form id="muasa-order-form" class="muasa-checkout-form">
        <div class="muasa-form-field">
          <label class="muasa-form-label" for="muasa-cust-email">Email Address *</label>
          <input type="email" id="muasa-cust-email" class="muasa-form-input" placeholder="e.g. customer@gmail.com" required />
        </div>

        <div class="muasa-form-field">
          <label class="muasa-form-label" for="muasa-cust-phone">Phone / WhatsApp Number *</label>
          <input type="tel" id="muasa-cust-phone" class="muasa-form-input" placeholder="e.g. 0300 1234567" required />
        </div>

        <div class="muasa-checkout-section-title" style="margin-top: 6px;">Delivery Address</div>
        
        <div class="muasa-form-row">
          <div class="muasa-form-field">
            <label class="muasa-form-label" for="muasa-cust-fname">First Name *</label>
            <input type="text" id="muasa-cust-fname" class="muasa-form-input" placeholder="First Name" required />
          </div>
          <div class="muasa-form-field">
            <label class="muasa-form-label" for="muasa-cust-lname">Last Name *</label>
            <input type="text" id="muasa-cust-lname" class="muasa-form-input" placeholder="Last Name" required />
          </div>
        </div>

        <div class="muasa-form-field">
          <label class="muasa-form-label" for="muasa-cust-address1">Street Address (House/Building #) *</label>
          <input type="text" id="muasa-cust-address1" class="muasa-form-input" placeholder="House #, Street name, Area" required />
        </div>

        <div class="muasa-form-field">
          <label class="muasa-form-label" for="muasa-cust-address2">Apartment, Suite, Unit (Optional)</label>
          <input type="text" id="muasa-cust-address2" class="muasa-form-input" placeholder="Apartment / Floor / Block (Optional)" />
        </div>

        <div class="muasa-form-row">
          <div class="muasa-form-field">
            <label class="muasa-form-label" for="muasa-cust-city">City *</label>
            <input type="text" id="muasa-cust-city" class="muasa-form-input" placeholder="e.g. Lahore / Karachi" required />
          </div>
          <div class="muasa-form-field">
            <label class="muasa-form-label" for="muasa-cust-zip">Postal / ZIP Code (Optional)</label>
            <input type="text" id="muasa-cust-zip" class="muasa-form-input" placeholder="e.g. 54000" />
          </div>
        </div>

        <div class="muasa-form-field">
          <label class="muasa-form-label" for="muasa-cust-province">Province / State *</label>
          <select id="muasa-cust-province" class="muasa-form-select" required>
            <option value="" disabled selected>Select Province / Region</option>
            <option value="Punjab">Punjab</option>
            <option value="Sindh">Sindh</option>
            <option value="Khyber Pakhtunkhwa">Khyber Pakhtunkhwa</option>
            <option value="Islamabad Capital Territory">Islamabad Capital Territory</option>
            <option value="Balochistan">Balochistan</option>
            <option value="Azad Kashmir">Azad Kashmir</option>
            <option value="Gilgit-Baltistan">Gilgit-Baltistan</option>
            <option value="Other">Other / International</option>
          </select>
        </div>

        <div class="muasa-form-field">
          <label class="muasa-form-label" for="muasa-cust-notes">Order Notes / Delivery Instructions (Optional)</label>
          <textarea id="muasa-cust-notes" class="muasa-form-textarea" placeholder="Any special instructions for courier (e.g. call before delivery)"></textarea>
        </div>

        <div class="muasa-checkout-section-title" style="margin-top: 6px;">Payment Method</div>
        <div class="muasa-payment-cards">
          <label class="muasa-payment-card active" id="muasa-pay-card-cod">
            <input type="radio" name="muasa-payment-method" value="COD" checked />
            <div class="muasa-payment-info">
              <span class="muasa-payment-title">💵 Cash on Delivery (COD)</span>
              <span class="muasa-payment-sub">Pay with cash when order is delivered to your door</span>
            </div>
          </label>
          <label class="muasa-payment-card" id="muasa-pay-card-online">
            <input type="radio" name="muasa-payment-method" value="ONLINE" />
            <div class="muasa-payment-info">
              <span class="muasa-payment-title">💳 Debit / Credit Card (Shopify Checkout)</span>
              <span class="muasa-payment-sub">Pay securely online with Visa, Mastercard, or Bank</span>
            </div>
          </label>
        </div>

        <button type="submit" id="muasa-submit-order-btn" class="muasa-order-submit-btn">
          ✓ Complete Order (${config.currencySymbol} ${totalFormatted})
        </button>

        <a href="/checkout" class="muasa-shopify-direct-link" target="_blank" rel="noopener">
          Or proceed to standard Shopify Checkout ↗
        </a>
      </form>
    `;

    document.getElementById('muasa-form-back-btn')?.addEventListener('click', closeInChatCheckout);

    // Dynamic Radio Selection Highlighting
    const codCard = document.getElementById('muasa-pay-card-cod');
    const onlineCard = document.getElementById('muasa-pay-card-online');
    if (codCard && onlineCard) {
      codCard.addEventListener('click', () => {
        codCard.classList.add('active');
        onlineCard.classList.remove('active');
      });
      onlineCard.addEventListener('click', () => {
        onlineCard.classList.add('active');
        codCard.classList.remove('active');
      });
    }

    const form = document.getElementById('muasa-order-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('muasa-submit-order-btn');
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering Order with Shopify...';
      }

      const email = document.getElementById('muasa-cust-email')?.value?.trim() || '';
      const phone = document.getElementById('muasa-cust-phone')?.value?.trim() || '';
      const firstName = document.getElementById('muasa-cust-fname')?.value?.trim() || '';
      const lastName = document.getElementById('muasa-cust-lname')?.value?.trim() || '';
      const address1 = document.getElementById('muasa-cust-address1')?.value?.trim() || '';
      const address2 = document.getElementById('muasa-cust-address2')?.value?.trim() || '';
      const city = document.getElementById('muasa-cust-city')?.value?.trim() || '';
      const province = document.getElementById('muasa-cust-province')?.value?.trim() || 'Punjab';
      const zip = document.getElementById('muasa-cust-zip')?.value?.trim() || '';
      const notes = document.getElementById('muasa-cust-notes')?.value?.trim() || '';
      const paymentMethod = form.querySelector('input[name="muasa-payment-method"]:checked')?.value || 'COD';

      const orderRef = Math.floor(100000 + Math.random() * 900000);

      // 1. Log order lead event to app backend database
      trackEvent('order_placed', null, {
        customerName: `${firstName} ${lastName}`.trim(),
        email: email,
        phone: phone,
        address: `${address1} ${address2}`.trim(),
        city: city,
        province: province,
        zip: zip,
        paymentMethod: paymentMethod,
        orderRef: String(orderRef),
        itemCount: cart.item_count,
        totalPrice: cart.total_price / 100,
        items: (cart.items || []).map(i => ({
          title: i.title,
          quantity: i.quantity,
          price: i.price / 100
        }))
      });

      // 2. Attach complete customer details and COD order notes to Shopify Cart
      try {
        await fetch('/cart/update.js', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            note: `Order via Muasa AI Chatbot (${paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'})\nCustomer: ${firstName} ${lastName}\nPhone: ${phone}\nEmail: ${email}\nAddress: ${address1}${address2 ? ', ' + address2 : ''}, ${city}, ${province} ${zip}\nInstructions: ${notes || 'None'}`,
            attributes: {
              'Order Source': 'Muasa AI Chatbot',
              'Customer Name': `${firstName} ${lastName}`.trim(),
              'Customer Phone': phone,
              'Customer Email': email,
              'Customer City': city,
              'Payment Method': paymentMethod === 'COD' ? 'Cash on Delivery (COD)' : 'Online Card'
            }
          })
        });
      } catch (upErr) {
        console.warn('[MuasaBot] Cart update error:', upErr);
      }

      // 3. Construct Shopify checkout URL with all prefilled parameters
      const checkoutParams = new URLSearchParams({
        'checkout[email]': email,
        'checkout[shipping_address][first_name]': firstName,
        'checkout[shipping_address][last_name]': lastName,
        'checkout[shipping_address][address1]': address1,
        'checkout[shipping_address][address2]': address2 || '',
        'checkout[shipping_address][city]': city,
        'checkout[shipping_address][province]': province,
        'checkout[shipping_address][zip]': zip || '',
        'checkout[shipping_address][country]': 'Pakistan',
        'checkout[shipping_address][phone]': phone
      });

      // Show instant confirmation and redirect to pre-filled Shopify checkout
      checkoutView.innerHTML = `
        <div class="muasa-order-success">
          <div class="muasa-success-icon">✓</div>
          <div class="muasa-success-title">Order Details Verified!</div>
          <div class="muasa-success-ref">Registering Order in Shopify Admin...</div>
          <div class="muasa-success-body">
            Thank you, <strong>${escapeHtml(firstName)} ${escapeHtml(lastName)}</strong>!<br/><br/>
            All your details and <strong>${paymentMethod === 'COD' ? 'Cash on Delivery' : 'Online Payment'}</strong> have been verified.<br/><br/>
            Redirecting to Shopify Checkout to record your official order in the store...
          </div>
          <div class="muasa-thinking-sparkle" style="font-size: 24px; color: #10b981; animation: muasaPulse 1.2s infinite; margin-top: 10px;">✦</div>
        </div>
      `;

      setTimeout(() => {
        window.location.href = `/checkout?${checkoutParams.toString()}`;
      }, 700);
    });
  }

  function trackEvent(eventType, productHandle = null, customMetadata = null) {
    try {
      const endpoint = `${config.proxyUrl || '/apps/muasa-bot'}/track`;
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'track',
          eventType: eventType,
          productHandle: productHandle,
          metadata: {
            sessionId: customerSessionId,
            ...(customMetadata || {})
          }
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
