// ============================================================
//  ZRS PERFORMANCE — app.js
//  Firebase + ImgBB + Web3Forms
// ============================================================

// ── FIREBASE CONFIG ──────────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDoc, getDocs,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, where, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjNGxd8tPBrGFZAxPRxF5fB9HIzWZYb3A",
  authDomain: "zrsperformance.firebaseapp.com",
  projectId: "zrsperformance",
  storageBucket: "zrsperformance.firebasestorage.app",
  messagingSenderId: "317253693500",
  appId: "1:317253693500:web:22b50a962ffcf46f989339",
  measurementId: "G-F9HXL1S135"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ── CONSTANTS ────────────────────────────────────────────────
const IMGBB_KEY = "d211e3c978e38683b377b28c7a8cd5e4";
const WEB3FORMS_KEY = "31979fb4-863b-4127-a137-088a357fd5e6";
const ADMIN_PASS = "pauze360";
const ORDER_EMAIL = "uzerouze@gmail.com";
const PICKUP_ADDRESS = "Uze00, Quintos St. Sampaloc Manila";
const LALAMOVE_FORM = "https://delivery.lalamove.com/forms/PH5dd68764ef7b4c99878bbd860ce34476";
const GCASH_NUMBER = "0927 968 1135 UZE Ramos";

// ── STATE ────────────────────────────────────────────────────
let cart = {}; // { productId: { product, qty } }
let products = [];
let preorders = [];
let vouchers = [];
let orders = [];
let reservations = [];
let galleryItems = [];
let posts = [];
let qrCodes = {};
let appearance = {};
let appliedVoucher = null;
let selectedShipping = null;
let selectedPayment = null;
let checkoutStep = 1;
let editingProductId = null;
let editingPostId = null;
let editingPreorderId = null;

// ── HELPERS ──────────────────────────────────────────────────
function $(id) { return document.getElementById(id); }
function formatPrice(n) { return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 }); }
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}
function genId() { return Math.random().toString(36).substr(2, 9).toUpperCase(); }

function toast(msg, type = 'info') {
  const c = $('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✅', error: '❌', info: '🔔' };
  t.innerHTML = `<span>${icons[type] || '🔔'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function showModal(id) { $(id).classList.remove('hidden'); }
function hideModal(id) { $(id).classList.add('hidden'); }

async function uploadToImgBB(file) {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: 'POST', body: fd });
  const data = await res.json();
  if (data.success) return data.data.display_url || data.data.url;
  throw new Error('Image upload failed');
}

function stockLabel(stock) {
  if (stock <= 0) return '<span class="stock-out">OUT OF STOCK</span>';
  if (stock <= 2) return '<span class="stock-low">⚠ LOW STOCK</span>';
  return '';
}

// ── PANEL NAVIGATION ─────────────────────────────────────────
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  $(`panel-${name}`).classList.add('active');
  document.querySelector(`[data-panel="${name}"]`).classList.add('active');
  if (name === 'admin') checkAdminAuth();
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
});

// ── ADMIN AUTH ───────────────────────────────────────────────
function checkAdminAuth() {
  const authed = sessionStorage.getItem('zrs_admin');
  if (authed === 'true') {
    $('admin-login-screen').classList.add('hidden');
    $('admin-main').classList.remove('hidden');
  } else {
    $('admin-login-screen').classList.remove('hidden');
    $('admin-main').classList.add('hidden');
  }
}

$('admin-login-form').addEventListener('submit', e => {
  e.preventDefault();
  const pw = $('admin-password-input').value;
  if (pw === ADMIN_PASS) {
    sessionStorage.setItem('zrs_admin', 'true');
    checkAdminAuth();
    loadAdminData();
    toast('Welcome back, Admin!', 'success');
  } else {
    toast('Incorrect password.', 'error');
  }
});

$('admin-logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem('zrs_admin');
  checkAdminAuth();
});

// ── ADMIN NAV ────────────────────────────────────────────────
document.querySelectorAll('.admin-nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    $(`admin-${btn.dataset.section}`).classList.add('active');
  });
});

// ── FIREBASE LISTENERS ───────────────────────────────────────
function startListeners() {
  // Products (onhand)
  onSnapshot(query(collection(db, 'products'), orderBy('createdAt', 'desc')), snap => {
    products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderOrderProducts();
    renderAdminProducts();
  });

  // Preorders
  onSnapshot(query(collection(db, 'preorders'), orderBy('createdAt', 'desc')), snap => {
    preorders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPreorders();
    renderAdminPreorders();
    renderAdminReservations();
  });

  // Orders
  onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc')), snap => {
    orders = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminOrders();
  });

  // Vouchers
  onSnapshot(collection(db, 'vouchers'), snap => {
    vouchers = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAdminVouchers();
  });

  // Gallery
  onSnapshot(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')), snap => {
    galleryItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderGallery();
    renderAdminGallery();
  });

  // Posts
  onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), snap => {
    posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderPosts();
    renderAdminPosts();
  });

  // Appearance
  onSnapshot(doc(db, 'settings', 'appearance'), snap => {
    if (snap.exists()) {
      appearance = snap.data();
      applyAppearance();
      renderAdminAppearance();
    }
  });

  // QR Codes
  onSnapshot(doc(db, 'settings', 'qrcodes'), snap => {
    if (snap.exists()) {
      qrCodes = snap.data();
      renderAdminQRs();
    }
  });
}

// ── APPLY APPEARANCE ─────────────────────────────────────────
function applyAppearance() {
  if (appearance.accentColor) {
    document.documentElement.style.setProperty('--red', appearance.accentColor);
  }
  if (appearance.siteName) {
    document.querySelectorAll('.site-name').forEach(el => el.textContent = appearance.siteName);
  }
  if (appearance.heroText) {
    const el = $('general-hero-text');
    if (el) el.textContent = appearance.heroText;
  }
  if (appearance.heroSub) {
    const el = $('general-hero-sub');
    if (el) el.textContent = appearance.heroSub;
  }
}

// ════════════════════════════════════════════════════════════
//  GENERAL PANEL
// ════════════════════════════════════════════════════════════

// ── PREORDERS ───────────────────────────────────────────────
function renderPreorders() {
  const grid = $('preorder-grid');
  if (!grid) return;
  if (!preorders.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No pre-orders available</p></div>';
    return;
  }
  grid.innerHTML = preorders.map(p => `
    <div class="card preorder-card">
      <div class="preorder-badge">PRE-ORDER</div>
      ${p.imageUrl ? `<img class="card-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy">` : '<div class="card-img-placeholder">📦</div>'}
      <div class="card-body">
        <div class="card-title">${p.name}</div>
        <div class="card-price">${formatPrice(p.price)}</div>
        <div class="card-desc">${p.description || ''}</div>
        <button class="btn btn-primary w-full" onclick="openReserveModal('${p.id}')">Reserve Now</button>
      </div>
    </div>
  `).join('');
}

let reservingProductId = null;
window.openReserveModal = function(id) {
  reservingProductId = id;
  const p = preorders.find(x => x.id === id);
  if (!p) return;
  $('reserve-product-name').textContent = p.name;
  $('reserve-product-price').textContent = formatPrice(p.price);
  $('reserve-form').reset();
  showModal('reserve-modal');
};

$('reserve-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('reserve-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Reserving...';
  try {
    await addDoc(collection(db, 'reservations'), {
      productId: reservingProductId,
      productName: preorders.find(x => x.id === reservingProductId)?.name || '',
      name: $('reserve-name').value.trim(),
      contact: $('reserve-contact').value.trim(),
      fbLink: $('reserve-fb').value.trim(),
      createdAt: serverTimestamp()
    });
    hideModal('reserve-modal');
    toast('Reservation submitted! We\'ll contact you soon.', 'success');
    $('reserve-form').reset();
  } catch (err) {
    toast('Failed to submit. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Reserve';
  }
});

// Also load reservations separately (not in preorders listener)
onSnapshot(query(collection(db, 'reservations'), orderBy('createdAt', 'desc')), snap => {
  reservations = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderAdminReservations();
});

// ── GALLERY ─────────────────────────────────────────────────
function renderGallery() {
  const grid = $('gallery-grid');
  if (!grid) return;
  if (!galleryItems.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📸</div><p>No photos yet</p></div>';
    return;
  }
  grid.innerHTML = galleryItems.map(g => `
    <div class="gallery-item" onclick="openLightbox('${g.imageUrl}')">
      <img src="${g.imageUrl}" alt="${g.caption || ''}" loading="lazy">
    </div>
  `).join('');
}

window.openLightbox = function(url) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${url}" alt="Gallery image">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
};

// ── POSTS ────────────────────────────────────────────────────
function renderPosts() {
  const grid = $('posts-grid');
  if (!grid) return;
  if (!posts.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No announcements yet</p></div>';
    return;
  }
  grid.innerHTML = posts.map(p => `
    <div class="post-card" onclick="openPostModal('${p.id}')">
      ${p.imageUrl ? `<img class="post-card-img" src="${p.imageUrl}" alt="${p.title}" loading="lazy">` : ''}
      <div class="post-card-body">
        <div class="post-card-date">${formatDate(p.createdAt)}</div>
        <div class="post-card-title">${p.title}</div>
        <div class="post-card-excerpt">${(p.content || '').substring(0, 120)}${p.content?.length > 120 ? '...' : ''}</div>
      </div>
    </div>
  `).join('');
}

window.openPostModal = function(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  $('post-modal-title').textContent = p.title;
  $('post-modal-date').textContent = formatDate(p.createdAt);
  $('post-modal-img').innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" alt="${p.title}">` : '';
  $('post-modal-content').textContent = p.content || '';
  showModal('post-modal');
};

// ════════════════════════════════════════════════════════════
//  ORDER PANEL
// ════════════════════════════════════════════════════════════
function renderOrderProducts() {
  const grid = $('order-products-grid');
  if (!grid) return;
  const inhand = products;
  if (!inhand.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>No products available</p></div>';
    return;
  }
  grid.innerHTML = inhand.map(p => {
    const inCart = cart[p.id]?.qty || 0;
    const outOfStock = p.stock <= 0;
    return `
    <div class="card">
      ${p.imageUrl ? `<img class="card-img" src="${p.imageUrl}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\"card-img-placeholder\">🏷️</div>'">` : '<div class="card-img-placeholder">🏷️</div>'}
      <div class="card-body">
        <div class="card-title">${p.name}</div>
        <div class="card-price">${formatPrice(p.price)}</div>
        <div class="card-desc">${p.description || ''}</div>
        ${stockLabel(p.stock) ? `<div style="margin-bottom:0.8rem;">${stockLabel(p.stock)}</div>` : ""}
        ${outOfStock
          ? '<button class="btn btn-outline w-full" disabled>Out of Stock</button>'
          : inCart > 0
            ? `<div class="qty-control" style="justify-content:center;gap:1rem;">
                <button class="qty-btn" onclick="changeCartQty('${p.id}',-1)">−</button>
                <span class="qty-val">${inCart}</span>
                <button class="qty-btn" onclick="changeCartQty('${p.id}',1)">+</button>
               </div>`
            : `<button class="btn btn-primary w-full" onclick="addToCart('${p.id}')">Add to Cart</button>`
        }
      </div>
    </div>`;
  }).join('');
}

window.addToCart = function(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  if (!cart[id]) cart[id] = { product: p, qty: 0 };
  if (cart[id].qty >= p.stock) { toast('Max stock reached', 'error'); return; }
  cart[id].qty++;
  updateCart();
};

window.changeCartQty = function(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  else if (cart[id].qty > cart[id].product.stock) { cart[id].qty = cart[id].product.stock; toast('Max stock reached', 'error'); }
  updateCart();
};

function updateCart() {
  renderOrderProducts();
  renderCartSidebar();
}

function getCartSubtotal() {
  return Object.values(cart).reduce((sum, item) => sum + item.product.price * item.qty, 0);
}

function getDiscount() {
  if (!appliedVoucher) return 0;
  const sub = getCartSubtotal();
  if (appliedVoucher.type === 'fixed') return Math.min(appliedVoucher.value, sub);
  if (appliedVoucher.type === 'percent') return sub * (appliedVoucher.value / 100);
  return 0;
}

function renderCartSidebar() {
  const sidebar = $('cart-sidebar');
  const items = Object.values(cart);
  const subtotal = getCartSubtotal();
  const discount = getDiscount();
  const total = subtotal - discount;
  const count = items.reduce((s, i) => s + i.qty, 0);

  $('cart-item-count').textContent = count;

  if (!items.length) {
    sidebar.innerHTML = `
      <div class="empty-state" style="padding:2rem 1rem">
        <div class="empty-icon">🛒</div>
        <p>Cart is empty</p>
      </div>`;
    return;
  }

  sidebar.innerHTML = `
    <h3 style="font-family:var(--font-display);font-size:1.2rem;font-weight:900;text-transform:uppercase;margin-bottom:1rem;letter-spacing:.05em">
      Your Cart <span style="color:var(--red)">(${count})</span>
    </h3>
    <div id="cart-items-list">
      ${items.map(item => `
        <div class="cart-item">
          ${item.product.imageUrl ? `<img class="cart-item-img" src="${item.product.imageUrl}" alt="${item.product.name}">` : '<div class="cart-item-img" style="background:var(--dark3);display:flex;align-items:center;justify-content:center;">🏷️</div>'}
          <div class="cart-item-info">
            <div class="cart-item-name">${item.product.name}</div>
            <div class="cart-item-price">${formatPrice(item.product.price)} × ${item.qty}</div>
          </div>
          <div class="qty-control">
            <button class="qty-btn" onclick="changeCartQty('${item.product.id}',-1)">−</button>
            <span class="qty-val">${item.qty}</span>
            <button class="qty-btn" onclick="changeCartQty('${item.product.id}',1)">+</button>
          </div>
        </div>
      `).join('')}
    </div>
    <div style="margin-top:1rem;">
      <div class="cart-total-row"><span>Subtotal</span><span>${formatPrice(subtotal)}</span></div>
      ${discount > 0 ? `<div class="cart-total-row" style="color:var(--green)"><span>Discount</span><span>−${formatPrice(discount)}</span></div>` : ''}
      <div class="cart-total-row grand"><span>Total</span><span class="amount">${formatPrice(total)}</span></div>
    </div>
    <div class="shipping-note">⚠ Total does not include shipping fee. Final amount with SF and payment confirmation will be discussed via DM on our Facebook page.</div>
    ${items.length > 0 ? `<button class="btn btn-primary w-full mt-2" onclick="startCheckout()">Proceed to Checkout →</button>` : ''}
  `;
}

// ── CHECKOUT ─────────────────────────────────────────────────
window.startCheckout = function() {
  if (!Object.keys(cart).length) { toast('Your cart is empty!', 'error'); return; }
  checkoutStep = 1;
  appliedVoucher = null;
  selectedShipping = null;
  selectedPayment = null;
  $('voucher-input').value = '';
  $('voucher-feedback').innerHTML = '';
  $('checkout-form').reset();
  renderCheckoutSteps();
  showModal('checkout-modal');
};

function renderCheckoutSteps() {
  document.querySelectorAll('.step-tab').forEach((t, i) => {
    t.classList.remove('active', 'done');
    if (i + 1 === checkoutStep) t.classList.add('active');
    else if (i + 1 < checkoutStep) t.classList.add('done');
  });
  document.querySelectorAll('.checkout-step').forEach((s, i) => {
    s.classList.toggle('active', i + 1 === checkoutStep);
  });
  if (checkoutStep === 3) renderOrderReview();
}

window.goCheckoutStep = function(n) {
  checkoutStep = n;
  renderCheckoutSteps();
};

// Voucher
$('apply-voucher-btn').addEventListener('click', () => {
  const code = $('voucher-input').value.trim().toUpperCase();
  const v = vouchers.find(x => x.code === code && x.active !== false);
  const fb = $('voucher-feedback');
  if (!v) {
    fb.innerHTML = '<span class="voucher-error">Invalid voucher code.</span>';
    appliedVoucher = null;
  } else {
    appliedVoucher = v;
    const desc = v.type === 'fixed' ? `₱${v.value} off` : `${v.value}% off`;
    fb.innerHTML = `<span class="voucher-success">✓ Voucher applied — ${desc}!</span>`;
    toast('Voucher applied!', 'success');
  }
  renderCartSidebar();
});

// Shipping selection
window.selectShipping = function(method) {
  selectedShipping = method;
  document.querySelectorAll('.shipping-option').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll(`[data-ship="${method}"]`).forEach(o => o.classList.add('selected'));
  const llWrap = $('lalamove-embed-wrap');
  const pickupAddr = $('pickup-address-show');
  if (method === 'Lalamove') {
    llWrap.classList.remove('hidden');
    pickupAddr.classList.add('hidden');
  } else if (method === 'Pickup') {
    llWrap.classList.add('hidden');
    pickupAddr.classList.remove('hidden');
  } else {
    llWrap.classList.add('hidden');
    pickupAddr.classList.add('hidden');
  }
};

// Payment selection
window.selectPayment = function(method) {
  selectedPayment = method;
  document.querySelectorAll('.payment-option').forEach(o => o.classList.remove('selected'));
  document.querySelectorAll(`[data-pay="${method}"]`).forEach(o => o.classList.add('selected'));
  renderPaymentDetails(method);
};

function renderPaymentDetails(method) {
  const wrap = $('payment-details-wrap');
  if (method === 'GCash') {
    const qr = qrCodes['gcash'];
    wrap.innerHTML = `
      <div class="qr-display">
        ${qr ? `<img src="${qr}" alt="GCash QR">` : '<div style="color:var(--muted);font-size:0.85rem;margin-bottom:0.5rem;">QR not yet uploaded</div>'}
        <div class="qr-label">GCash</div>
        <div class="qr-number">${GCASH_NUMBER}</div>
      </div>`;
  } else if (method === 'MariBank') {
    const qr = qrCodes['maribank'];
    wrap.innerHTML = `<div class="qr-display">${qr ? `<img src="${qr}" alt="MariBank QR">` : '<div style="color:var(--muted);font-size:0.85rem">QR not yet uploaded</div>'}<div class="qr-label">MariBank</div></div>`;
  } else if (method === 'Maya') {
    const qr = qrCodes['maya'];
    wrap.innerHTML = `<div class="qr-display">${qr ? `<img src="${qr}" alt="Maya QR">` : '<div style="color:var(--muted);font-size:0.85rem">QR not yet uploaded</div>'}<div class="qr-label">Maya</div></div>`;
  } else if (method === 'ChinaBank') {
    const qr = qrCodes['chinabank'];
    wrap.innerHTML = `<div class="qr-display">${qr ? `<img src="${qr}" alt="ChinaBank QR">` : '<div style="color:var(--muted);font-size:0.85rem">QR not yet uploaded</div>'}<div class="qr-label">ChinaBank</div></div>`;
  } else if (method === 'COD/COP-LBC') {
    wrap.innerHTML = `<div class="qr-display"><div class="qr-label">COD / COP via LBC</div><p style="font-size:0.85rem;color:var(--muted);margin-top:0.5rem;">DP coordinate amount on our Facebook page.</p></div>`;
  } else if (method === 'Cash on Pickup') {
    wrap.innerHTML = `<div class="qr-display"><div class="qr-label">Cash on Pickup</div><p style="font-size:0.85rem;color:var(--muted);margin-top:0.5rem;">Pay when you pick up at: <strong style="color:var(--white)">${PICKUP_ADDRESS}</strong></p></div>`;
  } else {
    wrap.innerHTML = '';
  }
}

function renderOrderReview() {
  const items = Object.values(cart);
  const sub = getCartSubtotal();
  const disc = getDiscount();
  const total = sub - disc;

  $('review-items').innerHTML = `
    <table class="review-items-table">
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead>
      <tbody>
        ${items.map(i => `
          <tr>
            <td>${i.product.name}</td>
            <td>${i.qty}</td>
            <td>${formatPrice(i.product.price * i.qty)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  $('review-subtotal').textContent = formatPrice(sub);
  $('review-discount').textContent = disc > 0 ? `−${formatPrice(disc)}` : '—';
  $('review-total').textContent = formatPrice(total);
  $('review-shipping').textContent = selectedShipping || '—';
  $('review-payment').textContent = selectedPayment || '—';

  const fd = new FormData($('checkout-form'));
  $('review-name').textContent = `${fd.get('profile_name') || ''} / ${fd.get('full_name') || ''}`;
  $('review-contact').textContent = fd.get('contact') || '';
  $('review-address').textContent = fd.get('address') || '';
  $('review-note').textContent = fd.get('note') || '—';
}

// Checkout step navigation
$('checkout-next-1').addEventListener('click', () => {
  if (!selectedShipping) { toast('Please select a shipping method.', 'error'); return; }
  if (selectedShipping === 'Lalamove') {
    if (!confirm('Please make sure you have filled out the Lalamove form above before proceeding.')) return;
  }
  checkoutStep = 2;
  renderCheckoutSteps();
});

$('checkout-back-2').addEventListener('click', () => { checkoutStep = 1; renderCheckoutSteps(); });
$('checkout-next-2').addEventListener('click', () => {
  const form = $('checkout-form');
  const fields = ['profile_name','full_name','contact','address'];
  for (const f of fields) {
    if (!form.elements[f]?.value?.trim()) { toast('Please fill all required fields.', 'error'); return; }
  }
  if (!selectedPayment) { toast('Please select a payment method.', 'error'); return; }
  checkoutStep = 3;
  renderCheckoutSteps();
});

$('checkout-back-3').addEventListener('click', () => { checkoutStep = 2; renderCheckoutSteps(); });

$('place-order-btn').addEventListener('click', async () => {
  const btn = $('place-order-btn');
  btn.disabled = true;
  btn.textContent = 'Placing Order...';

  try {
    const form = $('checkout-form');
    const fd = new FormData(form);
    const items = Object.values(cart).map(i => ({
      productId: i.product.id,
      name: i.product.name,
      price: i.product.price,
      qty: i.qty,
      subtotal: i.product.price * i.qty
    }));
    const sub = getCartSubtotal();
    const disc = getDiscount();
    const total = sub - disc;
    const orderId = 'ZRS-' + genId();

    const orderData = {
      orderId,
      profileName: fd.get('profile_name'),
      fullName: fd.get('full_name'),
      contact: fd.get('contact'),
      fbLink: fd.get('fb_link') || '',
      address: fd.get('address'),
      note: fd.get('note') || '',
      shipping: selectedShipping,
      payment: selectedPayment,
      voucher: appliedVoucher?.code || null,
      items,
      subtotal: sub,
      discount: disc,
      total,
      status: 'pending',
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'orders'), orderData);

    // Deduct stock
    for (const item of items) {
      const prodRef = doc(db, 'products', item.productId);
      const prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        const newStock = Math.max(0, prodSnap.data().stock - item.qty);
        await updateDoc(prodRef, { stock: newStock });
      }
    }

    // Send email via Web3Forms
    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: `New ZRS Order — ${orderId}`,
        from_name: 'ZRS Order System',
        to: ORDER_EMAIL,
        message: `
NEW ORDER RECEIVED — ${orderId}

Customer: ${fd.get('profile_name')} / ${fd.get('full_name')}
Contact: ${fd.get('contact')}
FB: ${fd.get('fb_link') || 'N/A'}
Address: ${fd.get('address')}
Note: ${fd.get('note') || 'None'}

Shipping: ${selectedShipping}
Payment: ${selectedPayment}
Voucher: ${appliedVoucher?.code || 'None'}

Items:
${items.map(i => `  • ${i.name} x${i.qty} — ${formatPrice(i.subtotal)}`).join('\n')}

Subtotal: ${formatPrice(sub)}
Discount: −${formatPrice(disc)}
TOTAL: ${formatPrice(total)}
(Shipping fee not included)
        `
      })
    });

    // Success
    cart = {};
    updateCart();
    hideModal('checkout-modal');
    showModal('order-success-modal');
    $('order-success-id').textContent = orderId;

  } catch (err) {
    console.error(err);
    toast('Order failed. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Place Order';
  }
});

// ════════════════════════════════════════════════════════════
//  ADMIN PANEL
// ════════════════════════════════════════════════════════════

// ── PRODUCTS (ONHAND) ────────────────────────────────────────
function renderAdminProducts() {
  const grid = $('admin-products-grid');
  if (!grid) return;
  if (!products.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No products yet</p></div>';
    return;
  }
  grid.innerHTML = products.map(p => `
    <div class="admin-product-card">
      ${p.imageUrl ? `<img class="admin-product-card-img" src="${p.imageUrl}" alt="${p.name}" onerror="this.style.display='none'">` : '<div class="admin-product-card-img-placeholder">🏷️</div>'}
      <div class="admin-product-card-body">
        <div class="admin-product-card-name">${p.name}</div>
        <div style="font-family:var(--font-mono);color:var(--red);font-size:0.95rem;">${formatPrice(p.price)}</div>
        <div style="margin-top:0.3rem;">${stockLabel(p.stock)}</div>
      </div>
      <div class="admin-product-card-footer">
        <button class="btn btn-ghost btn-sm" onclick="editProduct('${p.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProduct('${p.id}')">🗑 Delete</button>
      </div>
    </div>
  `).join('');
}

window.openAddProductModal = function() {
  editingProductId = null;
  $('product-modal-title').textContent = 'Add Product';
  $('product-form').reset();
  $('product-img-preview').innerHTML = '';
  showModal('product-modal');
};

window.editProduct = function(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  editingProductId = id;
  $('product-modal-title').textContent = 'Edit Product';
  $('product-name').value = p.name;
  $('product-price').value = p.price;
  $('product-stock').value = p.stock;
  $('product-desc').value = p.description || '';
  $('product-img-preview').innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" style="max-height:100px;border-radius:4px;">` : '';
  showModal('product-modal');
};

window.deleteProduct = async function(id) {
  if (!confirm('Delete this product?')) return;
  await deleteDoc(doc(db, 'products', id));
  toast('Product deleted.', 'success');
};

$('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('product-save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';
  try {
    const imgFile = $('product-img-file').files[0];
    let imageUrl = editingProductId ? products.find(x => x.id === editingProductId)?.imageUrl || '' : '';
    if (imgFile) {
      toast('Uploading image...', 'info');
      imageUrl = await uploadToImgBB(imgFile);
      console.log('Uploaded image URL:', imageUrl);
    }

    const data = {
      name: $('product-name').value.trim(),
      price: parseFloat($('product-price').value),
      stock: parseInt($('product-stock').value),
      description: $('product-desc').value.trim(),
      imageUrl: imageUrl || '',
    };

    if (editingProductId) {
      await updateDoc(doc(db, 'products', editingProductId), data);
      toast('Product updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'products'), data);
      toast('Product added!', 'success');
    }
    hideModal('product-modal');
  } catch (err) {
    console.error(err);
    toast('Failed to save product.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Product';
  }
});

// Live image preview
$('product-img-file').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) {
    const url = URL.createObjectURL(f);
    $('product-img-preview').innerHTML = `<img src="${url}" style="max-height:100px;border-radius:4px;margin-top:0.5rem;">`;
  }
});

// ── PREORDERS ADMIN ──────────────────────────────────────────
function renderAdminPreorders() {
  const grid = $('admin-preorders-grid');
  if (!grid) return;
  if (!preorders.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No pre-orders yet</p></div>';
    return;
  }
  grid.innerHTML = preorders.map(p => `
    <div class="admin-product-card">
      ${p.imageUrl ? `<img class="admin-product-card-img" src="${p.imageUrl}" alt="${p.name}">` : '<div class="admin-product-card-img-placeholder">📦</div>'}
      <div class="admin-product-card-body">
        <div class="admin-product-card-name">${p.name}</div>
        <div style="font-family:var(--font-mono);color:var(--red);font-size:0.95rem;">${formatPrice(p.price)}</div>
      </div>
      <div class="admin-product-card-footer">
        <button class="btn btn-ghost btn-sm" onclick="editPreorder('${p.id}')">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deletePreorder('${p.id}')">🗑 Delete</button>
      </div>
    </div>
  `).join('');
}

window.openAddPreorderModal = function() {
  editingPreorderId = null;
  $('preorder-modal-title').textContent = 'Add Pre-Order Item';
  $('preorder-form').reset();
  $('preorder-img-preview').innerHTML = '';
  showModal('preorder-modal');
};

window.editPreorder = function(id) {
  const p = preorders.find(x => x.id === id);
  if (!p) return;
  editingPreorderId = id;
  $('preorder-modal-title').textContent = 'Edit Pre-Order Item';
  $('preorder-name').value = p.name;
  $('preorder-price').value = p.price;
  $('preorder-desc').value = p.description || '';
  $('preorder-img-preview').innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" style="max-height:100px;border-radius:4px;">` : '';
  showModal('preorder-modal');
};

window.deletePreorder = async function(id) {
  if (!confirm('Delete this pre-order item?')) return;
  await deleteDoc(doc(db, 'preorders', id));
  toast('Pre-order deleted.', 'success');
};

$('preorder-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('preorder-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const imgFile = $('preorder-img-file').files[0];
    let imageUrl = editingPreorderId ? preorders.find(x => x.id === editingPreorderId)?.imageUrl || '' : '';
    if (imgFile) imageUrl = await uploadToImgBB(imgFile);
    const data = {
      name: $('preorder-name').value.trim(),
      price: parseFloat($('preorder-price').value),
      description: $('preorder-desc').value.trim(),
      imageUrl
    };
    if (editingPreorderId) {
      await updateDoc(doc(db, 'preorders', editingPreorderId), data);
      toast('Pre-order updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'preorders'), data);
      toast('Pre-order added!', 'success');
    }
    hideModal('preorder-modal');
  } catch (err) { toast('Failed to save.', 'error'); console.error(err); }
  finally { btn.disabled = false; btn.textContent = 'Save'; }
});

$('preorder-img-file').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) $('preorder-img-preview').innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-height:100px;border-radius:4px;margin-top:.5rem">`;
});

// ── ORDERS ADMIN ─────────────────────────────────────────────
function renderAdminOrders() {
  const list = $('admin-orders-list');
  if (!list) return;
  const active = orders.filter(o => o.status !== 'complete');
  if (!active.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No pending orders</p></div>';
    return;
  }
  list.innerHTML = active.map(o => `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <div class="order-id">${o.orderId}</div>
          <div class="order-name">${o.profileName} / ${o.fullName}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-success btn-sm" onclick="markOrderComplete('${o.id}')">✓ Complete</button>
          <button class="btn btn-danger btn-sm" onclick="deleteOrder('${o.id}')">🗑</button>
        </div>
      </div>
      <div class="order-items-list">${o.items?.map(i => `${i.name} ×${i.qty}`).join(', ')}</div>
      <div class="flex justify-between items-center">
        <span class="order-total">${formatPrice(o.total)}</span>
        <span style="font-size:0.8rem;color:var(--muted)">${o.shipping} · ${o.payment} · ${formatDate(o.createdAt)}</span>
      </div>
      <div style="font-size:0.82rem;color:var(--muted);margin-top:0.4rem">
        ${o.address} | ${o.contact} ${o.fbLink ? `| <a href="${o.fbLink}" target="_blank" style="color:var(--red)">FB</a>` : ''}
      </div>
      ${o.note ? `<div style="font-size:0.82rem;color:var(--light);margin-top:.3rem">Note: ${o.note}</div>` : ''}
    </div>
  `).join('');
}

window.markOrderComplete = async function(id) {
  await updateDoc(doc(db, 'orders', id), { status: 'complete' });
  toast('Order marked as complete!', 'success');
};

window.deleteOrder = async function(id) {
  if (!confirm('Remove this order?')) return;
  await deleteDoc(doc(db, 'orders', id));
  toast('Order removed.', 'success');
};

// ── RESERVATIONS ADMIN ───────────────────────────────────────
function renderAdminReservations() {
  const list = $('admin-reservations-list');
  if (!list) return;
  if (!reservations.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No reservations yet</p></div>';
    return;
  }
  list.innerHTML = reservations.map(r => `
    <div class="reservation-card">
      <div class="reservation-info">
        <div class="name">${r.name}</div>
        <div class="product">${r.productName}</div>
        <div class="contact">${r.contact} ${r.fbLink ? `· <a href="${r.fbLink}" target="_blank" style="color:var(--red)">FB Profile</a>` : ''}</div>
        <div style="font-size:0.78rem;color:var(--muted)">${formatDate(r.createdAt)}</div>
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteReservation('${r.id}')">🗑</button>
    </div>
  `).join('');
}

window.deleteReservation = async function(id) {
  if (!confirm('Remove this reservation?')) return;
  await deleteDoc(doc(db, 'reservations', id));
  toast('Reservation removed.', 'success');
};

// ── VOUCHERS ADMIN ───────────────────────────────────────────
function renderAdminVouchers() {
  const list = $('admin-vouchers-list');
  if (!list) return;
  if (!vouchers.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">🎟️</div><p>No vouchers yet</p></div>';
    return;
  }
  list.innerHTML = vouchers.map(v => `
    <div class="voucher-card">
      <div>
        <div class="voucher-code">${v.code}</div>
        <div style="font-size:0.8rem;color:var(--muted)">${v.type === 'fixed' ? 'Fixed amount' : 'Percentage'}</div>
      </div>
      <div class="voucher-discount">${v.type === 'fixed' ? '₱' + v.value + ' off' : v.value + '% off'}</div>
      <div class="flex gap-1">
        <button class="btn btn-ghost btn-sm" onclick="toggleVoucher('${v.id}','${v.active !== false}')">${v.active !== false ? 'Disable' : 'Enable'}</button>
        <button class="btn btn-danger btn-sm" onclick="deleteVoucher('${v.id}')">🗑</button>
      </div>
    </div>
  `).join('');
}

$('voucher-add-form').addEventListener('submit', async e => {
  e.preventDefault();
  const code = $('voucher-code-input').value.trim().toUpperCase();
  const type = $('voucher-type-select').value;
  const value = parseFloat($('voucher-value-input').value);
  if (!code || !value) { toast('Fill all fields.', 'error'); return; }
  const exists = vouchers.find(v => v.code === code);
  if (exists) { toast('Code already exists.', 'error'); return; }
  await addDoc(collection(db, 'vouchers'), { code, type, value, active: true });
  $('voucher-add-form').reset();
  toast('Voucher added!', 'success');
});

window.toggleVoucher = async function(id, currentActive) {
  await updateDoc(doc(db, 'vouchers', id), { active: currentActive === 'true' ? false : true });
};

window.deleteVoucher = async function(id) {
  if (!confirm('Delete voucher?')) return;
  await deleteDoc(doc(db, 'vouchers', id));
  toast('Voucher deleted.', 'success');
};

// ── GALLERY ADMIN ────────────────────────────────────────────
function renderAdminGallery() {
  const grid = $('admin-gallery-grid');
  if (!grid) return;
  if (!galleryItems.length) {
    grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📸</div><p>No photos yet</p></div>';
    return;
  }
  grid.innerHTML = galleryItems.map(g => `
    <div style="position:relative;">
      <div class="gallery-item" style="cursor:default;">
        <img src="${g.imageUrl}" alt="${g.caption || ''}">
      </div>
      ${g.caption ? `<div style="font-size:0.78rem;color:var(--muted);padding:0.3rem 0;">${g.caption}</div>` : ''}
      <button class="btn btn-danger btn-sm" style="position:absolute;top:4px;right:4px;" onclick="deleteGalleryItem('${g.id}')">🗑</button>
    </div>
  `).join('');
}

$('gallery-upload-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('gallery-upload-btn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    const file = $('gallery-file-input').files[0];
    if (!file) { toast('Select an image.', 'error'); return; }
    const imageUrl = await uploadToImgBB(file);
    const caption = $('gallery-caption-input').value.trim();
    await addDoc(collection(db, 'gallery'), { imageUrl, caption, createdAt: serverTimestamp() });
    $('gallery-upload-form').reset();
    toast('Photo added!', 'success');
  } catch (err) { toast('Upload failed.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Upload Photo'; }
});

window.deleteGalleryItem = async function(id) {
  if (!confirm('Delete this photo?')) return;
  await deleteDoc(doc(db, 'gallery', id));
  toast('Photo deleted.', 'success');
};

// ── POSTS ADMIN ──────────────────────────────────────────────
function renderAdminPosts() {
  const list = $('admin-posts-list');
  if (!list) return;
  if (!posts.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No posts yet</p></div>';
    return;
  }
  list.innerHTML = posts.map(p => `
    <div class="order-card">
      <div class="order-card-header">
        <div>
          <div style="font-family:var(--font-display);font-size:1rem;font-weight:800;text-transform:uppercase;">${p.title}</div>
          <div style="font-size:0.78rem;color:var(--muted)">${formatDate(p.createdAt)}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-sm" onclick="editPost('${p.id}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deletePost('${p.id}')">🗑</button>
        </div>
      </div>
      <div style="font-size:0.85rem;color:var(--muted)">${(p.content||'').substring(0,100)}...</div>
    </div>
  `).join('');
}

window.openAddPostModal = function() {
  editingPostId = null;
  $('post-form-modal-title').textContent = 'New Post';
  $('post-form').reset();
  $('post-img-preview').innerHTML = '';
  showModal('post-form-modal');
};

window.editPost = function(id) {
  const p = posts.find(x => x.id === id);
  if (!p) return;
  editingPostId = id;
  $('post-form-modal-title').textContent = 'Edit Post';
  $('post-title-input').value = p.title;
  $('post-content-input').value = p.content || '';
  $('post-img-preview').innerHTML = p.imageUrl ? `<img src="${p.imageUrl}" style="max-height:100px;border-radius:4px;">` : '';
  showModal('post-form-modal');
};

window.deletePost = async function(id) {
  if (!confirm('Delete this post?')) return;
  await deleteDoc(doc(db, 'posts', id));
  toast('Post deleted.', 'success');
};

$('post-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = $('post-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    const imgFile = $('post-img-file').files[0];
    let imageUrl = editingPostId ? posts.find(x => x.id === editingPostId)?.imageUrl || '' : '';
    if (imgFile) imageUrl = await uploadToImgBB(imgFile);
    const data = {
      title: $('post-title-input').value.trim(),
      content: $('post-content-input').value.trim(),
      imageUrl
    };
    if (editingPostId) {
      await updateDoc(doc(db, 'posts', editingPostId), data);
      toast('Post updated!', 'success');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'posts'), data);
      toast('Post published!', 'success');
    }
    hideModal('post-form-modal');
  } catch (err) { toast('Failed.', 'error'); console.error(err); }
  finally { btn.disabled = false; btn.textContent = 'Save Post'; }
});

$('post-img-file').addEventListener('change', e => {
  const f = e.target.files[0];
  if (f) $('post-img-preview').innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-height:100px;border-radius:4px;margin-top:.5rem">`;
});

// ── QR CODES ADMIN ───────────────────────────────────────────
function renderAdminQRs() {
  const methods = ['gcash','maribank','maya','chinabank'];
  const labels = { gcash:'GCash', maribank:'MariBank', maya:'Maya', chinabank:'ChinaBank' };
  const grid = $('admin-qr-grid');
  if (!grid) return;
  grid.innerHTML = methods.map(m => `
    <div class="qr-admin-card">
      <div class="qr-name">${labels[m]}</div>
      ${qrCodes[m] ? `<img src="${qrCodes[m]}" alt="${labels[m]} QR">` : '<div class="qr-placeholder">📷</div>'}
      <label class="btn btn-ghost btn-sm w-full" style="cursor:pointer;">
        Upload QR
        <input type="file" accept="image/*" style="display:none" onchange="uploadQR('${m}', this)">
      </label>
    </div>
  `).join('');
}

window.uploadQR = async function(method, input) {
  const file = input.files[0];
  if (!file) return;
  try {
    toast('Uploading QR...', 'info');
    const url = await uploadToImgBB(file);
    await setDoc(doc(db, 'settings', 'qrcodes'), { ...qrCodes, [method]: url }, { merge: true });
    toast('QR uploaded!', 'success');
  } catch (err) { toast('QR upload failed.', 'error'); console.error(err); }
};

// ── APPEARANCE ADMIN ─────────────────────────────────────────
function renderAdminAppearance() {
  if ($('appear-site-name')) $('appear-site-name').value = appearance.siteName || 'ZRS';
  if ($('appear-hero-text')) $('appear-hero-text').value = appearance.heroText || '';
  if ($('appear-hero-sub')) $('appear-hero-sub').value = appearance.heroSub || '';
  if ($('appear-accent')) $('appear-accent').value = appearance.accentColor || '#E8001D';
}

$('appearance-form').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await setDoc(doc(db, 'settings', 'appearance'), {
      siteName: $('appear-site-name').value.trim(),
      heroText: $('appear-hero-text').value.trim(),
      heroSub: $('appear-hero-sub').value.trim(),
      accentColor: $('appear-accent').value
    });
    toast('Appearance saved!', 'success');
  } catch (err) { toast('Failed to save.', 'error'); }
});

// ── ADMIN DATA LOAD ──────────────────────────────────────────
function loadAdminData() {
  // Listeners already running, just render
  renderAdminOrders();
  renderAdminProducts();
  renderAdminPreorders();
  renderAdminReservations();
  renderAdminVouchers();
  renderAdminGallery();
  renderAdminPosts();
  renderAdminQRs();
  renderAdminAppearance();
}

// ── MODAL CLOSE HANDLERS ─────────────────────────────────────
document.querySelectorAll('[data-close-modal]').forEach(btn => {
  btn.addEventListener('click', () => hideModal(btn.dataset.closeModal));
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.add('hidden');
  });
});

// ── INIT ─────────────────────────────────────────────────────
startListeners();
switchPanel('general');
renderCartSidebar();

// Hide loader
setTimeout(() => {
  const loader = $('app-loader');
  if (loader) { loader.style.opacity = '0'; setTimeout(() => loader.remove(), 400); }
}, 1200);
