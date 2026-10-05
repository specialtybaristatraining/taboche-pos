/* =========================================================
   TABOCHE — SCRIPT v3 (premium redesign)
   ========================================================= */

document.addEventListener('DOMContentLoaded', () => {

    /* =========================================================
       CONSTANTS & UTILITIES
    ========================================================= */
    const SUPPORT_PHONE = document.querySelector('meta[name="support-phone"]')?.content || '+9779824926296';
    const SUPPORT_WHATSAPP_NUMBER = SUPPORT_PHONE.replace(/\D/g, '');
    const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

    const safeStorage = {
        canUse: (() => {
            try {
                localStorage.setItem('__taboche_test__', '1');
                localStorage.removeItem('__taboche_test__');
                return true;
            } catch (e) { return false; }
        })(),
        getItem(key, fallback = null) {
            if (!this.canUse) return fallback;
            try { return localStorage.getItem(key); } catch (e) { return fallback; }
        },
        setItem(key, value) {
            if (!this.canUse) return;
            try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
        },
        removeItem(key) {
            if (!this.canUse) return;
            try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        }
    };

    const sanitizeForWhatsApp = (msg) => {
        try {
            let text = String(msg || '');
            text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
            return encodeURIComponent(text.substring(0, 1500));
        } catch (e) {
            return encodeURIComponent(String(msg).substring(0, 1500));
        }
    };

    const getWhatsAppUrl = (message) =>
        `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${sanitizeForWhatsApp(message)}`;

    const escapeHtml = (str) => String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));

    let toastTimer;
    const toastRegion = document.getElementById('toast-region');
    const showToast = (message, duration = 2600) => {
        if (toastRegion) {
            toastRegion.textContent = message;
            clearTimeout(toastTimer);
            toastTimer = setTimeout(() => { toastRegion.textContent = ''; }, duration);
        }
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = 'position:fixed;bottom:90px;right:20px;background:#2D2424;color:#F8E9D3;padding:12px 18px;border-radius:12px;z-index:10000;box-shadow:0 14px 32px rgba(0,0,0,0.18);font-weight:600;opacity:0;transform:translateY(6px);transition:opacity .25s ease,transform .25s ease;max-width:90vw;';
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(6px)';
            setTimeout(() => toast.remove(), 280);
        }, duration);
    };

    const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
    const $ = (sel, root = document) => root.querySelector(sel);

    /* =========================================================
       IMAGE FALLBACKS
    ========================================================= */
    $$('img').forEach(img => {
        img.addEventListener('error', () => {
            if (!img.dataset.fallbackApplied) {
                img.dataset.fallbackApplied = 'true';
                img.src = 'images/logo.png';
            }
        }, { once: true });
    });

    /* =========================================================
       LAZY IMAGES
    ========================================================= */
    const lazyImages = $$('img.lazy-image, img[data-src]');
    const markLoaded = (img) => img.classList.add('loaded');
    const loadImage = (img) => {
        if (img.dataset.src) img.src = img.dataset.src;
        img.decoding = 'async';
    };

    if ('IntersectionObserver' in window && lazyImages.length) {
        const io = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                const img = entry.target;
                loadImage(img);
                if (img.complete && img.naturalWidth > 0) markLoaded(img);
                else img.addEventListener('load', () => markLoaded(img), { once: true });
                observer.unobserve(img);
            });
        }, { rootMargin: '150px 0px', threshold: 0.05 });
        lazyImages.forEach(img => io.observe(img));
    } else {
        lazyImages.forEach(img => {
            loadImage(img);
            if (img.complete && img.naturalWidth > 0) markLoaded(img);
            else img.addEventListener('load', () => markLoaded(img), { once: true });
        });
    }

    /* =========================================================
       STAGGER REVEAL DELAYS
    ========================================================= */
    const applyStaggerDelays = () => {
        const groups = new Map();
        $$('.reveal').forEach(el => {
            const parent = el.parentElement;
            if (!parent) return;
            if (!groups.has(parent)) groups.set(parent, []);
            groups.get(parent).push(el);
        });
        groups.forEach((els) => {
            if (els.length <= 1) {
                els[0]?.style.setProperty('--reveal-delay', '0ms');
                return;
            }
            els.forEach((el, i) => {
                el.style.setProperty('--reveal-delay', `${Math.min(i * 60, 300)}ms`);
            });
        });
    };
    applyStaggerDelays();

    /* =========================================================
       REVEAL ANIMATIONS
    ========================================================= */
    const revealables = $$('.reveal');
    if ('IntersectionObserver' in window && revealables.length) {
        const ro = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('active');
                    ro.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -80px 0px' });
        revealables.forEach(el => ro.observe(el));
    } else {
        revealables.forEach(el => el.classList.add('active'));
    }
    document.documentElement.classList.add('js');

    /* =========================================================
       NAVBAR SCROLL EFFECT
    ========================================================= */
    const navbar = document.getElementById('navbar');
    let scrollPending = false;
    const onScroll = () => {
        if (scrollPending) return;
        scrollPending = true;
        requestAnimationFrame(() => {
            scrollPending = false;
            if (!navbar) return;
            navbar.classList.toggle('nav-glass', window.scrollY > 60);
            updateActiveNav();
        });
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    /* =========================================================
       MOBILE MENU
    ========================================================= */
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');
    const mainContent = document.getElementById('main-content');
    const siteFooter = document.querySelector('.site-footer');

    if (mobileMenuButton && mobileMenu) {
        let menuTrigger = null;
        const openMenu = () => {
            menuTrigger = document.activeElement;
            mobileMenu.classList.add('open');
            mobileMenu.setAttribute('aria-hidden', 'false');
            mobileMenuButton.setAttribute('aria-expanded', 'true');
            mobileMenuButton.setAttribute('aria-label', 'Close menu');
            if (mainContent) mainContent.inert = true;
            if (siteFooter) siteFooter.inert = true;
            document.body.style.overflow = 'hidden';
            $$('a[href], button:not([disabled])', mobileMenu)[0]?.focus();
        };
        const closeMenu = () => {
            mobileMenu.classList.remove('open');
            mobileMenu.setAttribute('aria-hidden', 'true');
            mobileMenuButton.setAttribute('aria-expanded', 'false');
            mobileMenuButton.setAttribute('aria-label', 'Open menu');
            if (mainContent) mainContent.inert = false;
            if (siteFooter) siteFooter.inert = false;
            document.body.style.overflow = '';
            if (menuTrigger && menuTrigger.offsetParent !== null) menuTrigger.focus();
            menuTrigger = null;
        };

        mobileMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            mobileMenu.classList.contains('open') ? closeMenu() : openMenu();
        });

        $$('a', mobileMenu).forEach(link => link.addEventListener('click', closeMenu));

        document.addEventListener('click', (e) => {
            if (!mobileMenu.classList.contains('open')) return;
            if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) closeMenu();
        });

        document.addEventListener('keydown', (e) => {
            if (!mobileMenu.classList.contains('open')) return;
            if (e.key === 'Escape') {
                closeMenu();
                return;
            }
            if (e.key !== 'Tab') return;
            const focusable = $$('a[href], button:not([disabled])', mobileMenu).filter(el => el.offsetParent !== null);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && (document.activeElement === first || !mobileMenu.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && (document.activeElement === last || !mobileMenu.contains(document.activeElement))) {
                e.preventDefault();
                first.focus();
            }
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth >= 768 && mobileMenu.classList.contains('open')) closeMenu();
        });
    }

    /* =========================================================
       SMOOTH SCROLL FOR ANCHOR LINKS
    ========================================================= */
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        const href = link.getAttribute('href');
        if (!href || href === '#') return;
        const target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    });

    /* =========================================================
       ACTIVE NAV LINK
    ========================================================= */
    const navSections = $$('section[id], header[id]');
    const navLinks = $$('#navbar .nav-link');

    function updateActiveNav() {
        let current = '';
        navSections.forEach(section => {
            if (window.scrollY >= section.offsetTop - 200) current = section.id;
        });
        navLinks.forEach(link => {
            const active = link.getAttribute('href') === `#${current}`;
            link.classList.toggle('active', active);
            if (active) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
    }

    /* =========================================================
       TABS
    ========================================================= */
    const tabButtons = $$('.tab-btn');
    const tabContents = $$('.tab-content');

    const showTab = (id, { resetFilters = true, skipFallback = false } = {}) => {
        tabButtons.forEach(btn => {
            const active = btn.dataset.tab === id;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-selected', active ? 'true' : 'false');
            btn.tabIndex = active ? 0 : -1;
        });
        tabContents.forEach(tab => {
            const active = tab.id === id;
            tab.hidden = !active;
            if (active) {
                tab.style.animation = 'none';
                void tab.offsetWidth;
                tab.style.animation = '';
            }
        });
        if (resetFilters && menuSearch) menuSearch.value = '';
        applyMenuFilters({ skipFallback });
    };

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab));
        btn.addEventListener('keydown', e => {
            const index = tabButtons.indexOf(btn);
            let nextIndex = index;
            if (e.key === 'ArrowRight') nextIndex = (index + 1) % tabButtons.length;
            if (e.key === 'ArrowLeft') nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
            if (e.key === 'Home') nextIndex = 0;
            if (e.key === 'End') nextIndex = tabButtons.length - 1;
            if (nextIndex === index) return;
            e.preventDefault();
            const next = tabButtons[nextIndex];
            showTab(next.dataset.tab);
            next.focus();
        });
    });

    /* =========================================================
       MENU SEARCH
    ========================================================= */
    const menuSearch = document.getElementById('menu-search');
    let menuStatusTimer;

    const applyMenuFilters = ({ skipFallback = false } = {}) => {
        const query = (menuSearch?.value || '').trim().toLowerCase();
        const visibleTab = document.querySelector('.tab-content:not([hidden])');
        const menuStatus = document.getElementById('menu-status');

        tabContents.forEach(tab => {
            const cards = $$('.menu-card', tab);
            cards.forEach(card => {
                const text = card.textContent.toLowerCase();
                const matchesSearch = !query || text.includes(query);
                card.classList.toggle('hide', !matchesSearch);
            });
            tab.querySelectorAll('.no-results').forEach(n => n.remove());

            const visible = $$('.menu-card:not(.hide)', tab);
            if (tab === visibleTab && visible.length === 0) {
                const note = document.createElement('div');
                note.className = 'no-results';
                note.setAttribute('role', 'status');
                note.textContent = 'No items match your search. Try clearing it.';
                tab.appendChild(note);
            }
        });

        if (menuStatus && visibleTab) {
            const count = $$('.menu-card:not(.hide)', visibleTab).length;
            clearTimeout(menuStatusTimer);
            menuStatusTimer = setTimeout(() => {
                menuStatus.textContent = `${count} menu item${count === 1 ? '' : 's'} shown`;
            }, 400);
        }

        if (!skipFallback && query && visibleTab) {
            const currentHas = $$('.menu-card:not(.hide)', visibleTab).length > 0;
            if (!currentHas) {
                const fallback = tabContents.find(t => $$('.menu-card:not(.hide)', t).length > 0);
                if (fallback) showTab(fallback.id, { resetFilters: false, skipFallback: true });
            }
        }
    };

    if (menuSearch) {
        let t = null;
        menuSearch.addEventListener('input', () => {
            clearTimeout(t);
            t = setTimeout(applyMenuFilters, 200);
        });
    }

    /* =========================================================
       CURRENCY CONVERSION
    ========================================================= */
    const STORAGE_RATE_KEY = 'taboche_usd_rate';
    const STORAGE_RATE_TS_KEY = 'taboche_usd_rate_ts';
    const RATE_CACHE_TTL = 6 * 60 * 60 * 1000;
    const FALLBACK_RATE = 133;

    let conversionRate = FALLBACK_RATE;

    try {
        const cached = Number(safeStorage.getItem(STORAGE_RATE_KEY));
        const cachedAt = Number(safeStorage.getItem(STORAGE_RATE_TS_KEY));
        if (cached > 0 && cachedAt && Date.now() - cachedAt < RATE_CACHE_TTL) {
            conversionRate = cached;
        }
    } catch (e) { /* ignore */ }

    const priceEls = $$('.menu-price');
    priceEls.forEach(el => {
        const match = el.textContent.match(/(\d+)/);
        if (match) el.dataset.npr = match[1];
    });

    const applyCurrency = (currency) => {
        priceEls.forEach(el => {
            const npr = el.dataset.npr;
            if (!npr) return;
            if (currency === 'usd') {
                const usd = Number(npr) / conversionRate;
                el.textContent = `$ ${usd.toFixed(2)}`;
            } else {
                el.textContent = `रू ${npr}`;
            }
        });
    };

    const getActiveCurrency = () =>
        document.querySelector('.currency-btn.active')?.dataset.currency || 'npr';

    const refreshPrices = () => applyCurrency(getActiveCurrency());

    async function fetchLiveRate(retry = 0) {
        const btn = document.querySelector('.currency-btn[data-currency="usd"]');
        const isSupportedProtocol = window.location.protocol === 'https:' ||
            window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';

        if (!isSupportedProtocol || !navigator.onLine) {
            if (btn) btn.textContent = `USD (≈${Math.round(conversionRate)} NPR)`;
            return;
        }

        try {
            const res = await fetch('https://open.er-api.com/v6/latest/NPR', { cache: 'no-store' });
            if (!res.ok) throw new Error('Network error');
            const data = await res.json();
            if (data && data.result === 'success' && data.rates && data.rates.USD) {
                conversionRate = 1 / data.rates.USD;
                if (btn) btn.textContent = `USD (≈${Math.round(conversionRate)} NPR)`;
                safeStorage.setItem(STORAGE_RATE_KEY, String(conversionRate));
                safeStorage.setItem(STORAGE_RATE_TS_KEY, String(Date.now()));
                if (getActiveCurrency() === 'usd') refreshPrices();
            } else {
                throw new Error('Invalid payload');
            }
        } catch (err) {
            if (btn) btn.textContent = `USD (≈${Math.round(conversionRate)} NPR)`;
            if (retry < 2) setTimeout(() => fetchLiveRate(retry + 1), 4000);
        }
    }

    let hasRequestedLiveRate = false;
    $$('.currency-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            $$('.currency-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.currency === 'usd' && !hasRequestedLiveRate) {
                hasRequestedLiveRate = true;
                fetchLiveRate();
            }
            refreshPrices();
        });
    });

    /* =========================================================
       SIGNATURE CARDS → SCROLL TO MENU
    ========================================================= */
    $$('.signature-card').forEach(card => {
        card.addEventListener('click', () => {
            // Let the anchor navigation scroll, then reveal Hot Coffee tab
            setTimeout(() => {
                if (typeof showTab === 'function') showTab('coffee');
            }, 450);
        });
    });

    /* =========================================================
       LIGHTBOX
    ========================================================= */
    const galleryItems = $$('.gallery-item');
    const lightbox = document.getElementById('lightbox');
    const lightboxClose = document.getElementById('lightbox-close');
    const lightboxPrevious = document.getElementById('lightbox-previous');
    const lightboxNext = document.getElementById('lightbox-next');
    const lightboxImage = document.getElementById('lightbox-image');
    const lightboxVideo = document.getElementById('lightbox-video');
    let currentIndex = 0;
    let lightboxTrigger = null;
    const getFocusable = root => $$('button, a[href], input, select, textarea, video[controls]', root)
        .filter(el => !el.disabled && !el.hidden && el.offsetParent !== null);

    const openLightbox = (index) => {
        const item = galleryItems[index];
        if (!item || !lightbox) return;
        currentIndex = index;
        lightboxTrigger = document.activeElement;
        const { type, src } = item.dataset;
        lightbox.hidden = false;
        if (type === 'video') {
            lightboxImage.hidden = true;
            lightboxImage.src = '';
            lightboxVideo.hidden = false;
            lightboxVideo.src = src;
            lightboxVideo.load();
            lightboxVideo.play().catch(() => {});
        } else {
            lightboxVideo.pause();
            lightboxVideo.hidden = true;
            lightboxVideo.src = '';
            lightboxImage.hidden = false;
            lightboxImage.src = src;
            lightboxImage.alt = item.querySelector('img')?.alt || '';
        }
        document.body.style.overflow = 'hidden';
        lightboxClose?.focus();
    };

    const closeLightbox = () => {
        if (!lightbox) return;
        lightbox.hidden = true;
        lightboxVideo.pause();
        lightboxVideo.src = '';
        lightboxImage.src = '';
        document.body.style.overflow = '';
        lightboxTrigger?.focus();
        lightboxTrigger = null;
    };

    if (lightbox) {
        galleryItems.forEach((item, idx) => item.addEventListener('click', () => openLightbox(idx)));
        lightboxClose?.addEventListener('click', closeLightbox);
        lightboxPrevious?.addEventListener('click', () => openLightbox((currentIndex - 1 + galleryItems.length) % galleryItems.length));
        lightboxNext?.addEventListener('click', () => openLightbox((currentIndex + 1) % galleryItems.length));
        lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
        let touchStartX = null;
        lightbox.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0]?.clientX ?? null; }, { passive: true });
        lightbox.addEventListener('touchend', e => {
            if (touchStartX === null) return;
            const deltaX = e.changedTouches[0].clientX - touchStartX;
            touchStartX = null;
            if (Math.abs(deltaX) < 50) return;
            const nextIndex = deltaX < 0
                ? (currentIndex + 1) % galleryItems.length
                : (currentIndex - 1 + galleryItems.length) % galleryItems.length;
            openLightbox(nextIndex);
        }, { passive: true });
        document.addEventListener('keydown', e => {
            if (lightbox.hidden) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft') openLightbox((currentIndex - 1 + galleryItems.length) % galleryItems.length);
            if (e.key === 'ArrowRight') openLightbox((currentIndex + 1) % galleryItems.length);
            if (e.key === 'Tab') {
                const focusable = getFocusable(lightbox);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        });
    }

    /* =========================================================
       MENU MODAL
    ========================================================= */
    const createMenuModal = () => {
        if (document.getElementById('menu-modal')) return;
        const modal = document.createElement('div');
        modal.id = 'menu-modal';
        modal.className = 'menu-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-labelledby', 'menu-modal-title');
        modal.innerHTML = `
            <div class="menu-modal-panel">
                <button type="button" class="menu-modal-close" aria-label="Close menu item">×</button>
                <h3 id="menu-modal-title" class="menu-modal-title"></h3>
                <p class="menu-modal-desc"></p>
                <div class="menu-modal-price"></div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => {
            modal.classList.remove('open');
            document.body.style.overflow = '';
            modal._trigger?.focus();
            modal._trigger = null;
        };
        modal.querySelector('.menu-modal-close').addEventListener('click', close);
        modal.addEventListener('click', e => { if (e.target === modal) close(); });
        document.addEventListener('keydown', e => {
            if (!modal.classList.contains('open')) return;
            if (e.key === 'Escape') close();
            if (e.key !== 'Tab') return;
            const focusable = getFocusable(modal);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
            else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        });
    };

    $$('.menu-card').forEach(card => {
        card.setAttribute('aria-haspopup', 'dialog');
        card.addEventListener('click', () => {
            createMenuModal();
            const modal = document.getElementById('menu-modal');
            const title = card.querySelector('.menu-card-title, h4')?.innerText || '';
            const desc = card.querySelector('.menu-card-desc, p')?.innerText || '';
            const price = card.querySelector('.menu-price')?.textContent || '';
            modal.querySelector('.menu-modal-title').textContent = title;
            modal.querySelector('.menu-modal-desc').textContent = desc;
            modal.querySelector('.menu-modal-price').textContent = price;
            modal._trigger = card;
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
            modal.querySelector('.menu-modal-close').focus();
        });
    });

    /* =========================================================
       RESERVATION FORM
    ========================================================= */
    const reservationForm = document.getElementById('reservation-form');
    const dateInput = document.getElementById('res-date');

    if (dateInput) {
        const today = new Date();
        const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
        dateInput.min = iso(today);
        const max = new Date(today);
        max.setDate(max.getDate() + 90);
        dateInput.max = iso(max);
    }

    const makeReference = () => {
        const stamp = Date.now().toString(36).toUpperCase().slice(-5);
        const rand = Math.floor(Math.random() * 36 ** 2).toString(36).toUpperCase().padStart(2, '0');
        return `TAB-${stamp}${rand}`;
    };

    const buildWhatsAppMessage = (data, reference) => {
        let msg = '';
        msg += `🌟 *Reservation ${reference}*\n\n`;
        msg += `👤 Name: ${data.name}\n`;
        msg += `📞 Phone: ${data.phone}\n`;
        if (data.email) msg += `✉️ Email: ${data.email}\n`;
        msg += `👥 Guests: ${data.guests}\n`;
        msg += `📅 Date: ${data.date || 'Not specified'}\n`;
        msg += `🕒 Time: ${data.time || 'Not specified'}\n`;
        if (data.notes) msg += `📝 Notes: ${data.notes}\n`;
        msg += `\nSent from taboche.netlify.app`;
        return msg;
    };

    const renderReservationSuccess = (reference, data) => {
        const card = document.querySelector('.reservation-card');
        if (!card) return;

        const whatsappUrl = getWhatsAppUrl(buildWhatsAppMessage(data, reference));
        const safeName = escapeHtml((data.name.split(' ')[0] || 'friend'));

        card.innerHTML = `
            <div class="reservation-success" role="status" aria-live="polite">
                <div class="success-icon" aria-hidden="true">✓</div>
                <h2 class="section-heading">Reservation received</h2>
                <p class="lead">Thank you, ${safeName}. We'll confirm your reservation on WhatsApp shortly.</p>
                <p class="success-ref">Reference: <strong>${reference}</strong></p>
                <div class="success-actions">
                    <a href="${whatsappUrl}" target="_blank" rel="noopener noreferrer" class="button button-primary">Confirm on WhatsApp</a>
                    <button type="button" class="button button-ghost" id="new-reservation">New Reservation</button>
                </div>
                <p class="success-note">
                    A copy was sent to our team. If you don't hear back within 30 minutes, please call
                    <a href="tel:+9779824926296">+977-9824926296</a>.
                </p>
            </div>
        `;

        document.getElementById('new-reservation')?.addEventListener('click', () => {
            window.location.reload();
        });
    };

    const clearFormErrors = (form) => {
        $$('.form-error', form).forEach(el => {
            el.hidden = true;
            el.textContent = '';
        });
        ['res-name', 'res-phone', 'res-email', 'res-date', 'res-time'].forEach(id => {
            document.getElementById(id)?.setAttribute('aria-invalid', 'false');
        });
    };

    const validateReservation = (data) => {
        let valid = true;

        if (!data.name) {
            const el = document.getElementById('res-name-error');
            if (el) { el.textContent = 'Please enter your full name.'; el.hidden = false; }
            document.getElementById('res-name')?.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        if (!data.phone || data.phone.replace(/\D/g, '').length < 7) {
            const el = document.getElementById('res-phone-error');
            if (el) { el.textContent = 'Please enter a valid phone number.'; el.hidden = false; }
            document.getElementById('res-phone')?.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        if (!data.date || (dateInput?.min && data.date < dateInput.min) || (dateInput?.max && data.date > dateInput.max)) {
            const el = document.getElementById('res-date-error');
            if (el) { el.textContent = 'Please choose a date within the next 90 days.'; el.hidden = false; }
            document.getElementById('res-date')?.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        const [hour, minute] = (data.time || '').split(':').map(Number);
        if (!data.time || !Number.isInteger(hour) || !Number.isInteger(minute) || hour < 7 || hour > 20 || (hour === 20 && minute > 0)) {
            const el = document.getElementById('res-time-error');
            if (el) { el.textContent = 'Please choose a time between 07:00 and 20:00.'; el.hidden = false; }
            document.getElementById('res-time')?.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) {
            const el = document.getElementById('res-email-error');
            if (el) { el.textContent = 'Please enter a valid email address.'; el.hidden = false; }
            document.getElementById('res-email')?.setAttribute('aria-invalid', 'true');
            valid = false;
        }
        return valid;
    };

    const submitToNetlify = async (form, payload) => {
        const body = new URLSearchParams();
        Object.entries(payload).forEach(([k, v]) => body.append(k, v ?? ''));
        body.append('form-name', 'reservation');

        const res = await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
        });
        return res.ok;
    };

    if (reservationForm) {
        reservationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearFormErrors(reservationForm);

            const fd = new FormData(reservationForm);
            const data = {
                name: (fd.get('name') || '').toString().trim(),
                phone: (fd.get('phone') || '').toString().trim(),
                email: (fd.get('email') || '').toString().trim(),
                date: (fd.get('date') || '').toString().trim(),
                time: (fd.get('time') || '').toString().trim(),
                guests: (fd.get('guests') || '').toString().trim(),
                notes: (fd.get('notes') || '').toString().trim()
            };

            if (!validateReservation(data)) {
                reservationForm.querySelector('[aria-invalid="true"]')?.focus();
                return;
            }

            const reference = makeReference();
            const referenceField = reservationForm.querySelector('[name="reference"]');
            if (referenceField) referenceField.value = reference;
            const submitBtn = document.getElementById('reservation-submit');
            const statusEl = document.getElementById('reservation-status');

            const localRecord = { ...data, reference, reservedAt: new Date().toISOString() };
            try {
                const existing = JSON.parse(safeStorage.getItem('taboche_reservations') || '[]');
                existing.push(localRecord);
                if (existing.length > 200) existing.splice(0, existing.length - 200);
                safeStorage.setItem('taboche_reservations', JSON.stringify(existing));
            } catch (err) { /* ignore */ }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.classList.add('btn-loading');
                submitBtn.textContent = 'Sending…';
            }
            if (statusEl) statusEl.textContent = 'Submitting your reservation…';

            let delivered = false;
            try {
                delivered = await submitToNetlify(reservationForm, { ...data, reference });
            } catch (err) {
                if (isLocalDev) console.warn('Netlify submission failed:', err);
                delivered = false;
            }

            if (delivered) {
                renderReservationSuccess(reference, data);
                showToast('Reservation received. Confirmation sent.');
            } else {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.classList.remove('btn-loading');
                    submitBtn.textContent = 'Reserve Table';
                }
                if (statusEl) statusEl.textContent = 'We could not reach our server. Opening WhatsApp so you can confirm directly.';
                showToast('Server unavailable — sending via WhatsApp.');
                window.open(getWhatsAppUrl(buildWhatsAppMessage(data, reference)), '_blank', 'noopener');
                setTimeout(() => renderReservationSuccess(reference, data), 400);
            }
        });
    }

    /* =========================================================
       COPY PHONE ON CLICK
    ========================================================= */
    $$('.contact-number').forEach(el => {
        el.addEventListener('click', async () => {
            const href = el.getAttribute('href');
            if (!href || !href.startsWith('tel:')) return;
            const phone = href.replace('tel:', '');
            try {
                await navigator.clipboard.writeText(phone);
                showToast('Phone number copied to clipboard');
            } catch (err) { /* silent */ }
        });
    });

    /* =========================================================
       MAP — lazy-load when scrolled into view
    ========================================================= */
    const renderMap = () => {
        const container = document.getElementById('map-container');
        if (!container || container.querySelector('iframe')) return;

        const inject = () => {
            const canEmbed = window.location.protocol.startsWith('http') && navigator.onLine;
            if (canEmbed) {
                container.innerHTML = `
                    <iframe
                        src="https://www.google.com/maps?q=Taboche%20Restaurant%20Bhaktapur&z=16&output=embed"
                        title="Taboche Restaurant location"
                        loading="lazy"
                        referrerpolicy="no-referrer-when-downgrade"
                        allowfullscreen></iframe>
                `;
            } else {
                container.innerHTML = `
                    <div class="map-fallback">
                        <div class="map-fallback-content">
                            <span class="map-fallback-icon" aria-hidden="true">⌖</span>
                            <p class="map-fallback-kicker">Visit Taboche</p>
                            <p><strong>Opposite Siddhapokhari</strong></p>
                            <p class="map-fallback-copy">Open the full location in Google Maps for directions.</p>
                            <a class="button button-primary" href="https://www.google.com/maps/search/?api=1&query=Taboche+Restaurant+Bhaktapur" target="_blank" rel="noopener noreferrer">Open in Google Maps</a>
                        </div>
                    </div>
                `;
            }
        };

        if ('IntersectionObserver' in window) {
            const mo = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        inject();
                        mo.disconnect();
                    }
                });
            }, { rootMargin: '200px 0px' });
            mo.observe(container);
        } else {
            inject();
        }
    };
    renderMap();

    /* =========================================================
       THEME TOGGLE
    ========================================================= */
    const themeToggles = [
        document.getElementById('theme-toggle'),
        document.getElementById('theme-toggle-mobile')
    ].filter(Boolean);
    const applyTheme = (theme) => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
        themeToggles.forEach(toggle => toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false'));
        safeStorage.setItem('theme', theme);
    };

    if (themeToggles.length) {
        const saved = safeStorage.getItem('theme') ||
            (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        applyTheme(saved);
        themeToggles.forEach(toggle => toggle.addEventListener('click', () => {
            const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(next);
        }));
    }

    /* =========================================================
       PWA INSTALL
    ========================================================= */
    let deferredInstallPrompt = null;
    const installBtn = document.getElementById('install-pwa-btn');
    const installBanner = document.getElementById('install-banner');
    const bannerInstallBtn = document.getElementById('install-pwa-banner-btn');
    const bannerDismissBtn = document.getElementById('install-pwa-dismiss');

    const bannerDismissalTtl = 30 * 24 * 60 * 60 * 1000;
    const isBannerDismissed = () => {
        const dismissedAt = Number(safeStorage.getItem('pwaBannerDismissedAt'));
        if (!dismissedAt) return false;
        if (Date.now() - dismissedAt >= bannerDismissalTtl) {
            safeStorage.removeItem('pwaBannerDismissedAt');
            return false;
        }
        return true;
    };
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true;
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isSafari = /^((?!chrome|android|crios|fxios|edgios|opios).)*safari/i.test(navigator.userAgent);

    if (isStandalone || safeStorage.getItem('pwaInstalled') === 'true') {
        installBtn?.classList.remove('is-available');
        installBanner?.classList.remove('show');
    } else if (isIOS && isSafari && installBanner && !isBannerDismissed()) {
        installBanner.classList.add('ios-hint', 'show');
        installBanner.querySelector('.text-sm').textContent =
            'Tap Share, then “Add to Home Screen” to install Taboche.';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        if (isStandalone) return;
        safeStorage.removeItem('pwaInstalled');
        deferredInstallPrompt = e;
        installBtn?.classList.add('is-available');
        installBanner?.classList.remove('ios-hint');
        if (installBanner && !isBannerDismissed() && window.innerWidth < 900) {
            installBanner.classList.add('show');
        }
    });

    const triggerInstall = async () => {
        if (!deferredInstallPrompt) return false;
        deferredInstallPrompt.prompt();
        const choice = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        installBanner?.classList.remove('show');
        installBtn?.classList.remove('is-available');
        return choice.outcome === 'accepted';
    };

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        installBtn?.classList.remove('is-available');
        installBanner?.classList.remove('show');
        safeStorage.setItem('pwaInstalled', 'true');
        showToast('Taboche installed. Thanks!');
    });

    installBtn?.addEventListener('click', triggerInstall);
    bannerInstallBtn?.addEventListener('click', triggerInstall);
    bannerDismissBtn?.addEventListener('click', () => {
        installBanner?.classList.remove('show');
        safeStorage.setItem('pwaBannerDismissedAt', String(Date.now()));
    });

    /* =========================================================
       ADMIN FUNCTIONS
    ========================================================= */
    if (new URLSearchParams(window.location.search).get('admin') === '1') window.tabocheAdmin = {
        viewReservations() {
            const list = JSON.parse(safeStorage.getItem('taboche_reservations') || '[]');
            console.table(list);
            return list;
        },
        exportReservations() {
            const list = JSON.parse(safeStorage.getItem('taboche_reservations') || '[]');
            const blob = new Blob([JSON.stringify(list, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `taboche-reservations-${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        clearReservations() {
            if (confirm('Delete ALL stored reservations? This cannot be undone.')) {
                safeStorage.removeItem('taboche_reservations');
                if (isLocalDev) console.log('All reservations cleared.');
            }
        },
        viewSubscribers() {
            const list = JSON.parse(safeStorage.getItem('taboche_newsletter') || '[]');
            console.table(list);
            return list;
        }
    };

    /* =========================================================
       SERVICE WORKER
    ========================================================= */
    if ('serviceWorker' in navigator &&
        (window.location.protocol === 'https:' ||
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
                .then(registration => {
                    const updateBanner = document.getElementById('sw-update-banner');
                    const showUpdate = () => {
                        if (registration.waiting && navigator.serviceWorker.controller && updateBanner) {
                            updateBanner.hidden = false;
                        }
                    };
                    let reloadForUpdate = false;
                    document.getElementById('sw-update-apply')?.addEventListener('click', () => {
                        if (!registration.waiting) return;
                        reloadForUpdate = true;
                        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                    });
                    document.getElementById('sw-update-dismiss')?.addEventListener('click', () => {
                        if (updateBanner) updateBanner.hidden = true;
                    });
                    navigator.serviceWorker.addEventListener('controllerchange', () => {
                        if (reloadForUpdate) window.location.reload();
                    });
                    showUpdate();
                    registration.addEventListener('updatefound', () => {
                        const worker = registration.installing;
                        worker?.addEventListener('statechange', () => {
                            if (worker.state === 'installed') showUpdate();
                        });
                    });
                })
                .catch(err => { if (isLocalDev) console.warn('Service worker registration failed:', err); });
        });
    }

    /* =========================================================
       FOOTER YEAR
    ========================================================= */
    const yearEl = document.getElementById('footer-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    /* =========================================================
       INITIAL STATE
    ========================================================= */
    showTab('coffee');
    updateActiveNav();

});