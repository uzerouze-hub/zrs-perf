// ============================================================
//  ZRS PERFORMANCE — app.js
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, getDoc,
  updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAjNGxd8tPBrGFZAxPRxF5fB9HIzWZYb3A",
  authDomain: "zrsperformance.firebaseapp.com",
  projectId: "zrsperformance",
  storageBucket: "zrsperformance.firebasestorage.app",
  messagingSenderId: "317253693500",
  appId: "1:317253693500:web:22b50a962ffcf46f989339"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const CLOUDINARY_CLOUD = "dhtrmxwkk";
const CLOUDINARY_PRESET = "uv1gzi50";
const WEB3FORMS_KEY = "31979fb4-863b-4127-a137-088a357fd5e6";
const ADMIN_PASS = "pauze360";
const ORDER_EMAIL = "uzerouze@gmail.com";
const PICKUP_ADDRESS = "Uze00, Quintos St. Sampaloc Manila";
const GCASH_NUMBER = "0927 968 1135 UZE Ramos";

let cart = {};
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

function g(id) { return document.getElementById(id); }
function formatPrice(n) { return '₱' + Number(n).toLocaleString('en-PH', {minimumFractionDigits:2}); }
function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-PH', {year:'numeric',month:'short',day:'numeric'});
}
function genId() { return Math.random().toString(36).substr(2,9).toUpperCase(); }

function toast(msg, type) {
  type = type || 'info';
  const c = g('toast-container');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  const icons = {success:'✅', error:'❌', info:'🔔'};
  t.innerHTML = '<span>' + (icons[type]||'🔔') + '</span><span>' + msg + '</span>';
  c.appendChild(t);
  setTimeout(function() { t.remove(); }, 4000);
}

function showModal(id) { g(id).classList.remove('hidden'); }
function hideModal(id) { g(id).classList.add('hidden'); }

async function uploadToImgBB(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_PRESET);
  const res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD + '/image/upload', {method:'POST', body:fd});
  const data = await res.json();
  if (data.secure_url) return data.secure_url;
  throw new Error('Image upload failed: ' + JSON.stringify(data.error));
}

function stockLabel(stock) {
  if (stock <= 0) return '<span class="stock-out">OUT OF STOCK</span>';
  if (stock <= 2) return '<span class="stock-low">⚠ LOW STOCK</span>';
  return '';
}

// ── PANEL NAV ────────────────────────────────────────────────
function switchPanel(name) {
  document.querySelectorAll('.panel').forEach(function(p) { p.classList.remove('active'); });
  document.querySelectorAll('.nav-tab').forEach(function(t) { t.classList.remove('active'); });
  g('panel-' + name).classList.add('active');
  document.querySelector('[data-panel="' + name + '"]').classList.add('active');
  if (name === 'admin') checkAdminAuth();
}
document.querySelectorAll('.nav-tab').forEach(function(btn) {
  btn.addEventListener('click', function() { switchPanel(btn.dataset.panel); });
});

// ── ADMIN AUTH ───────────────────────────────────────────────
function checkAdminAuth() {
  if (sessionStorage.getItem('zrs_admin') === 'true') {
    g('admin-login-screen').classList.add('hidden');
    g('admin-main').classList.remove('hidden');
  } else {
    g('admin-login-screen').classList.remove('hidden');
    g('admin-main').classList.add('hidden');
  }
}
g('admin-login-form').addEventListener('submit', function(e) {
  e.preventDefault();
  if (g('admin-password-input').value === ADMIN_PASS) {
    sessionStorage.setItem('zrs_admin', 'true');
    checkAdminAuth();
    toast('Welcome back, Admin!', 'success');
  } else {
    toast('Incorrect password.', 'error');
  }
});
g('admin-logout-btn').addEventListener('click', function() {
  sessionStorage.removeItem('zrs_admin');
  checkAdminAuth();
});

// ── ADMIN NAV ────────────────────────────────────────────────
document.querySelectorAll('.admin-nav-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.admin-nav-btn').forEach(function(b) { b.classList.remove('active'); });
    document.querySelectorAll('.admin-section').forEach(function(s) { s.classList.remove('active'); });
    btn.classList.add('active');
    g('admin-' + btn.dataset.section).classList.add('active');
    if (btn.dataset.section === 'qr') renderAdminQRs();
  });
});

// ── FIREBASE LISTENERS ───────────────────────────────────────
function startListeners() {
  onSnapshot(query(collection(db,'products'), orderBy('createdAt','desc')), function(snap) {
    products = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderOrderProducts();
    renderAdminProducts();
  });
  onSnapshot(query(collection(db,'preorders'), orderBy('createdAt','desc')), function(snap) {
    preorders = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderPreorders();
    renderAdminPreorders();
  });
  onSnapshot(query(collection(db,'orders'), orderBy('createdAt','desc')), function(snap) {
    orders = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderAdminOrders();
  });
  onSnapshot(collection(db,'vouchers'), function(snap) {
    vouchers = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderAdminVouchers();
  });
  onSnapshot(query(collection(db,'gallery'), orderBy('createdAt','desc')), function(snap) {
    galleryItems = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderGallery();
    renderAdminGallery();
  });
  onSnapshot(query(collection(db,'posts'), orderBy('createdAt','desc')), function(snap) {
    posts = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderPosts();
    renderAdminPosts();
  });
  onSnapshot(query(collection(db,'reservations'), orderBy('createdAt','desc')), function(snap) {
    reservations = snap.docs.map(function(d) { return Object.assign({id:d.id}, d.data()); });
    renderAdminReservations();
  });
  onSnapshot(doc(db,'settings','appearance'), function(snap) {
    if (snap.exists()) { appearance = snap.data(); applyAppearance(); renderAdminAppearance(); }
  });
  onSnapshot(doc(db,'settings','qrcodes'), function(snap) {
    if (snap.exists()) { qrCodes = snap.data(); }
    renderAdminQRs();
  });
}

function applyAppearance() {
  if (appearance.accentColor) document.documentElement.style.setProperty('--accent', appearance.accentColor);
  if (appearance.heroText && g('general-hero-text')) g('general-hero-text').textContent = appearance.heroText;
  if (appearance.heroSub && g('general-hero-sub')) g('general-hero-sub').textContent = appearance.heroSub;
}

// ── HELPERS FOR SAFE HTML BUILDING ──────────────────────────
function el(tag, attrs, inner) {
  var a = '';
  if (attrs) Object.keys(attrs).forEach(function(k) { a += ' ' + k + '="' + attrs[k] + '"'; });
  return '<' + tag + a + '>' + (inner||'') + '</' + tag + '>';
}
function imgOrPlaceholder(url, cls, w, h, icon) {
  if (url) return '<img src="' + url + '" style="width:' + w + ';height:' + h + ';object-fit:cover;" class="' + cls + '">';
  return '<div class="' + cls + '-placeholder" style="width:' + w + ';height:' + h + ';background:var(--dark3);display:flex;align-items:center;justify-content:center;font-size:2rem;">' + icon + '</div>';
}

// ════════════════════════════════════════════════════════════
//  GENERAL PANEL
// ════════════════════════════════════════════════════════════
function renderPreorders() {
  var grid = g('preorder-grid');
  if (!grid) return;
  if (!preorders.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No pre-orders available</p></div>'; return; }
  var html = '';
  preorders.forEach(function(p) {
    var img = imgOrPlaceholder(p.imageUrl, 'card-img', '100%', '220px', '📦');
    html += '<div class="card preorder-card">';
    html += '<div class="preorder-badge">PRE-ORDER</div>';
    html += img;
    html += '<div class="card-body">';
    html += '<div class="card-title">' + p.name + '</div>';
    html += '<div class="card-price">' + formatPrice(p.price) + '</div>';
    html += '<div class="card-desc">' + (p.description||'') + '</div>';
    html += '<button class="btn btn-primary w-full" data-action="reserve" data-id="' + p.id + '">Reserve Now</button>';
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

function renderGallery() {
  var grid = g('gallery-grid');
  if (!grid) return;
  if (!galleryItems.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📸</div><p>No photos yet</p></div>'; return; }
  var html = '';
  galleryItems.forEach(function(item) {
    html += '<div class="gallery-item" data-action="lightbox" data-url="' + item.imageUrl + '">';
    html += '<img src="' + item.imageUrl + '" alt="" loading="lazy">';
    html += '</div>';
  });
  grid.innerHTML = html;
}

function renderPosts() {
  var grid = g('posts-grid');
  if (!grid) return;
  if (!posts.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No announcements yet</p></div>'; return; }
  var html = '';
  posts.forEach(function(p) {
    var excerpt = (p.content||'').substring(0,120) + ((p.content||'').length > 120 ? '...' : '');
    html += '<div class="post-card" data-action="viewpost" data-id="' + p.id + '">';
    if (p.imageUrl) html += '<img class="post-card-img" src="' + p.imageUrl + '" loading="lazy">';
    html += '<div class="post-card-body">';
    html += '<div class="post-card-date">' + formatDate(p.createdAt) + '</div>';
    html += '<div class="post-card-title">' + p.title + '</div>';
    html += '<div class="post-card-excerpt">' + excerpt + '</div>';
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

// Reserve modal
var reservingProductId = null;
function openReserveModal(id) {
  reservingProductId = id;
  var p = preorders.find(function(x) { return x.id === id; });
  if (!p) return;
  g('reserve-product-name').textContent = p.name;
  g('reserve-product-price').textContent = formatPrice(p.price);
  g('reserve-form').reset();
  showModal('reserve-modal');
}
g('reserve-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = g('reserve-submit-btn');
  btn.disabled = true; btn.textContent = 'Reserving...';
  try {
    var p = preorders.find(function(x) { return x.id === reservingProductId; });
    await addDoc(collection(db,'reservations'), {
      productId: reservingProductId,
      productName: p ? p.name : '',
      name: g('reserve-name').value.trim(),
      contact: g('reserve-contact').value.trim(),
      fbLink: g('reserve-fb').value.trim(),
      createdAt: serverTimestamp()
    });
    hideModal('reserve-modal');
    toast('Reservation submitted!', 'success');
    g('reserve-form').reset();
  } catch(err) { toast('Failed. Try again.', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Reserve'; }
});

function openPostModal(id) {
  var p = posts.find(function(x) { return x.id === id; });
  if (!p) return;
  g('post-modal-title').textContent = p.title;
  g('post-modal-date').textContent = formatDate(p.createdAt);
  g('post-modal-img').innerHTML = p.imageUrl ? '<img src="' + p.imageUrl + '" style="width:100%;border-radius:8px;margin-bottom:1rem;">' : '';
  g('post-modal-content').textContent = p.content || '';
  showModal('post-modal');
}

// ════════════════════════════════════════════════════════════
//  ORDER PANEL
// ════════════════════════════════════════════════════════════
function renderOrderProducts() {
  var grid = g('order-products-grid');
  if (!grid) return;
  if (!products.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>No products available</p></div>'; return; }
  var html = '<div class="product-list">';
  products.forEach(function(p) {
    var inCart = cart[p.id] ? cart[p.id].qty : 0;
    var outOfStock = p.stock <= 0;
    var sLabel = stockLabel(p.stock);
    var img = p.imageUrl ? '<img src="' + p.imageUrl + '" class="product-list-img">' : '<div class="product-list-img-placeholder">🏷️</div>';
    html += '<div class="product-list-item' + (outOfStock ? ' out-of-stock' : '') + '">';
    html += img;
    html += '<div class="product-list-info">';
    html += '<div class="product-list-name">' + p.name + (sLabel ? ' <span style="margin-left:.4rem">' + sLabel + '</span>' : '') + '</div>';
    html += '<div class="product-list-price">' + formatPrice(p.price) + '</div>';
    if (p.description) html += '<div class="product-list-desc">' + p.description + '</div>';
    html += '</div>';
    html += '<div class="product-list-right">';
    if (outOfStock) {
      html += '<span class="stock-out" style="font-size:.75rem;">OUT OF STOCK</span>';
    } else if (inCart > 0) {
      html += '<div class="qty-control">';
      html += '<button class="qty-btn" data-action="qty-minus" data-id="' + p.id + '">−</button>';
      html += '<span class="qty-val">' + inCart + '</span>';
      html += '<button class="qty-btn" data-action="qty-plus" data-id="' + p.id + '">+</button>';
      html += '</div>';
    } else {
      html += '<button class="btn btn-primary btn-sm" data-action="addcart" data-id="' + p.id + '">+ Add</button>';
    }
    html += '</div></div>';
  });
  html += '</div>';
  grid.innerHTML = html;
}

function addToCart(id) {
  var p = products.find(function(x) { return x.id === id; });
  if (!p) return;
  if (!cart[id]) cart[id] = {product:p, qty:0};
  if (cart[id].qty >= p.stock) { toast('Max stock reached', 'error'); return; }
  cart[id].qty++;
  updateCart();
}
function changeCartQty(id, delta) {
  if (!cart[id]) return;
  cart[id].qty += delta;
  if (cart[id].qty <= 0) delete cart[id];
  else if (cart[id].qty > cart[id].product.stock) { cart[id].qty = cart[id].product.stock; toast('Max stock reached','error'); }
  updateCart();
}
function updateCart() { renderOrderProducts(); renderCartSidebar(); }

function getCartSubtotal() {
  return Object.values(cart).reduce(function(s,i) { return s + i.product.price * i.qty; }, 0);
}
function getDiscount() {
  if (!appliedVoucher) return 0;
  var sub = getCartSubtotal();
  if (appliedVoucher.type === 'fixed') return Math.min(appliedVoucher.value, sub);
  if (appliedVoucher.type === 'percent') return sub * (appliedVoucher.value / 100);
  return 0;
}

function renderCartSidebar() {
  var sidebar = g('cart-sidebar');
  var items = Object.values(cart);
  var subtotal = getCartSubtotal();
  var discount = getDiscount();
  var total = subtotal - discount;
  var count = items.reduce(function(s,i) { return s + i.qty; }, 0);
  g('cart-item-count').textContent = count || '';
  if (!items.length) {
    sidebar.innerHTML = '<div class="empty-state" style="padding:2rem 1rem"><div class="empty-icon">🛒</div><p>Cart is empty</p></div>';
    return;
  }
  var html = '<h3 style="font-size:1.2rem;font-weight:900;text-transform:uppercase;margin-bottom:1rem;">Your Cart <span style="color:var(--accent)">(' + count + ')</span></h3>';
  items.forEach(function(item) {
    var img = item.product.imageUrl ? '<img class="cart-item-img" src="' + item.product.imageUrl + '">' : '<div class="cart-item-img" style="background:var(--dark3);"></div>';
    html += '<div class="cart-item">' + img;
    html += '<div class="cart-item-info"><div class="cart-item-name">' + item.product.name + '</div>';
    html += '<div class="cart-item-price">' + formatPrice(item.product.price) + ' × ' + item.qty + '</div></div>';
    html += '<div class="qty-control">';
    html += '<button class="qty-btn" data-action="qty-minus" data-id="' + item.product.id + '">−</button>';
    html += '<span class="qty-val">' + item.qty + '</span>';
    html += '<button class="qty-btn" data-action="qty-plus" data-id="' + item.product.id + '">+</button>';
    html += '</div></div>';
  });
  html += '<div style="margin-top:1rem;">';
  html += '<div class="cart-total-row"><span>Subtotal</span><span>' + formatPrice(subtotal) + '</span></div>';
  if (discount > 0) html += '<div class="cart-total-row" style="color:var(--green)"><span>Discount</span><span>−' + formatPrice(discount) + '</span></div>';
  html += '<div class="cart-total-row grand"><span>Total</span><span class="amount">' + formatPrice(total) + '</span></div>';
  html += '</div>';
  html += '<div class="shipping-note">⚠ Total does not include shipping fee. Final amount with SF and payment confirmation will be discussed via DM on our Facebook page.</div>';
  html += '<button class="btn btn-primary w-full mt-2" data-action="checkout">Proceed to Checkout →</button>';
  sidebar.innerHTML = html;
}

// ── CHECKOUT ─────────────────────────────────────────────────
function startCheckout() {
  if (!Object.keys(cart).length) { toast('Your cart is empty!','error'); return; }
  checkoutStep = 1;
  appliedVoucher = null;
  selectedShipping = null;
  selectedPayment = null;
  g('voucher-input').value = '';
  g('voucher-feedback').innerHTML = '';
  g('checkout-form').reset();
  g('payment-details-wrap').innerHTML = '';
  g('lalamove-embed-wrap').classList.add('hidden');
  g('pickup-address-show').classList.add('hidden');
  document.querySelectorAll('.shipping-option').forEach(function(o) { o.classList.remove('selected'); });
  document.querySelectorAll('.payment-option').forEach(function(o) { o.classList.remove('selected'); });
  renderCheckoutSteps();
  showModal('checkout-modal');
}

function renderCheckoutSteps() {
  document.querySelectorAll('.step-tab').forEach(function(t, i) {
    t.classList.remove('active','done');
    if (i+1 === checkoutStep) t.classList.add('active');
    else if (i+1 < checkoutStep) t.classList.add('done');
  });
  document.querySelectorAll('.checkout-step').forEach(function(s, i) {
    s.classList.toggle('active', i+1 === checkoutStep);
  });
  if (checkoutStep === 3) renderOrderReview();
}

function selectShipping(method) {
  selectedShipping = method;
  document.querySelectorAll('.shipping-option').forEach(function(o) { o.classList.remove('selected'); });
  document.querySelectorAll('[data-ship="' + method + '"]').forEach(function(o) { o.classList.add('selected'); });
  g('lalamove-embed-wrap').classList.toggle('hidden', method !== 'Lalamove');
  g('pickup-address-show').classList.toggle('hidden', method !== 'Pickup');
}

function selectPayment(method) {
  selectedPayment = method;
  document.querySelectorAll('.payment-option').forEach(function(o) { o.classList.remove('selected'); });
  document.querySelectorAll('[data-pay="' + method + '"]').forEach(function(o) { o.classList.add('selected'); });
  renderPaymentDetails(method);
}

function renderPaymentDetails(method) {
  var wrap = g('payment-details-wrap');
  var note = '<div class="messenger-note" style="margin-top:1rem;">📲 <strong>REMINDER:</strong> Kindly send a <strong>screenshot of your payment</strong> along with your <strong>confirmed order number</strong> to our Facebook Messenger.<br><span style="color:#ff6b6b;font-weight:700;">No screenshot + order number = not processed.</span></div>';
  var html = '';
  if (method === 'GCash') {
    var qr = qrCodes['gcash'];
    html = '<div class="qr-display">' + (qr ? '<img src="' + qr + '" style="max-width:200px;margin:0 auto .8rem;display:block;border-radius:4px;">' : '<div style="color:var(--muted);font-size:.85rem;margin-bottom:.5rem;">QR not yet uploaded</div>') + '<div class="qr-label">GCash</div><div class="qr-number">' + GCASH_NUMBER + '</div></div>';
  } else if (method === 'MariBank') {
    var qr2 = qrCodes['maribank'];
    html = '<div class="qr-display">' + (qr2 ? '<img src="' + qr2 + '" style="max-width:200px;margin:0 auto .8rem;display:block;border-radius:4px;">' : '<div style="color:var(--muted);font-size:.85rem;">QR not yet uploaded</div>') + '<div class="qr-label">MariBank</div></div>';
  } else if (method === 'Maya') {
    var qr3 = qrCodes['maya'];
    html = '<div class="qr-display">' + (qr3 ? '<img src="' + qr3 + '" style="max-width:200px;margin:0 auto .8rem;display:block;border-radius:4px;">' : '<div style="color:var(--muted);font-size:.85rem;">QR not yet uploaded</div>') + '<div class="qr-label">Maya</div></div>';
  } else if (method === 'ChinaBank') {
    var qr4 = qrCodes['chinabank'];
    html = '<div class="qr-display">' + (qr4 ? '<img src="' + qr4 + '" style="max-width:200px;margin:0 auto .8rem;display:block;border-radius:4px;">' : '<div style="color:var(--muted);font-size:.85rem;">QR not yet uploaded</div>') + '<div class="qr-label">ChinaBank</div></div>';
  } else if (method === 'COD/COP-LBC') {
    html = '<div class="qr-display"><div class="qr-label">COD / COP via LBC</div><p style="font-size:.85rem;color:var(--muted);margin-top:.5rem;">DP coordinate amount on our Facebook page.</p></div>';
  } else if (method === 'Cash on Pickup') {
    html = '<div class="qr-display"><div class="qr-label">Cash on Pickup</div><p style="font-size:.85rem;color:var(--muted);margin-top:.5rem;">Pay when you pick up at: <strong style="color:var(--white)">' + PICKUP_ADDRESS + '</strong></p></div>';
  }
  wrap.innerHTML = html + (html ? note : '');
}

function renderOrderReview() {
  var items = Object.values(cart);
  var sub = getCartSubtotal();
  var disc = getDiscount();
  var total = sub - disc;
  var rows = '';
  items.forEach(function(i) {
    rows += '<tr><td>' + i.product.name + '</td><td>' + i.qty + '</td><td>' + formatPrice(i.product.price * i.qty) + '</td></tr>';
  });
  g('review-items').innerHTML = '<table class="review-items-table"><thead><tr><th>Item</th><th>Qty</th><th>Price</th></tr></thead><tbody>' + rows + '</tbody></table>';
  g('review-subtotal').textContent = formatPrice(sub);
  g('review-discount').textContent = disc > 0 ? '−' + formatPrice(disc) : '—';
  g('review-total').textContent = formatPrice(total);
  g('review-shipping').textContent = selectedShipping || '—';
  g('review-payment').textContent = selectedPayment || '—';
  var fd = new FormData(g('checkout-form'));
  g('review-name').textContent = (fd.get('profile_name')||'') + ' / ' + (fd.get('full_name')||'');
  g('review-contact').textContent = fd.get('contact') || '';
  g('review-address').textContent = fd.get('address') || '';
  g('review-note').textContent = fd.get('note') || '—';
}

g('checkout-next-1').addEventListener('click', function() {
  if (!selectedShipping) { toast('Please select a shipping method.','error'); return; }
  if (selectedShipping === 'Lalamove' && !confirm('Please make sure you have filled out the Lalamove form above before proceeding.')) return;
  checkoutStep = 2; renderCheckoutSteps();
});
g('checkout-back-2').addEventListener('click', function() { checkoutStep = 1; renderCheckoutSteps(); });
g('checkout-next-2').addEventListener('click', function() {
  var form = g('checkout-form');
  var fields = ['profile_name','full_name','contact','address'];
  for (var i = 0; i < fields.length; i++) {
    if (!form.elements[fields[i]] || !form.elements[fields[i]].value.trim()) { toast('Please fill all required fields.','error'); return; }
  }
  if (!selectedPayment) { toast('Please select a payment method.','error'); return; }
  checkoutStep = 3; renderCheckoutSteps();
});
g('checkout-back-3').addEventListener('click', function() { checkoutStep = 2; renderCheckoutSteps(); });

g('apply-voucher-btn').addEventListener('click', async function() {
  var code = g('voucher-input').value.trim().toUpperCase();
  var fb = g('voucher-feedback');
  var v = vouchers.find(function(x) { return x.code === code && x.active !== false; });
  if (!v) { fb.innerHTML = '<span class="voucher-error">Invalid voucher code.</span>'; appliedVoucher = null; renderCartSidebar(); return; }

  // Check total usage limit
  if (v.maxUses && v.usedCount && v.usedCount >= v.maxUses) {
    fb.innerHTML = '<span class="voucher-error">This voucher has reached its usage limit.</span>';
    appliedVoucher = null; renderCartSidebar(); return;
  }

  // Check per-customer limit using contact field if filled, else use session
  var contact = g('checkout-form') ? (g('checkout-form').elements['contact'] ? g('checkout-form').elements['contact'].value.trim() : '') : '';
  var sessionKey = 'voucher_used_' + code;
  if (v.perCustomer) {
    var alreadyUsed = sessionStorage.getItem(sessionKey);
    if (alreadyUsed) {
      fb.innerHTML = '<span class="voucher-error">You have already used this voucher.</span>';
      appliedVoucher = null; renderCartSidebar(); return;
    }
  }

  appliedVoucher = v;
  var desc = v.type === 'fixed' ? '₱' + v.value + ' off' : v.value + '% off';
  var limitInfo = '';
  if (v.maxUses) limitInfo = ' (' + (v.maxUses - (v.usedCount||0)) + ' uses left)';
  fb.innerHTML = '<span class="voucher-success">✓ Voucher applied — ' + desc + limitInfo + '!</span>';
  toast('Voucher applied!', 'success');
  renderCartSidebar();
});

g('place-order-btn').addEventListener('click', async function() {
  var btn = g('place-order-btn');
  btn.disabled = true; btn.textContent = 'Placing Order...';
  try {
    var form = g('checkout-form');
    var fd = new FormData(form);
    var items = Object.values(cart).map(function(i) {
      return {productId:i.product.id, name:i.product.name, price:i.product.price, qty:i.qty, subtotal:i.product.price*i.qty};
    });
    var sub = getCartSubtotal();
    var disc = getDiscount();
    var total = sub - disc;
    var orderId = 'ZRS-' + genId();
    var orderData = {
      orderId: orderId,
      profileName: fd.get('profile_name'),
      fullName: fd.get('full_name'),
      contact: fd.get('contact'),
      fbLink: fd.get('fb_link') || '',
      address: fd.get('address'),
      note: fd.get('note') || '',
      shipping: selectedShipping,
      payment: selectedPayment,
      voucher: appliedVoucher ? appliedVoucher.code : null,
      items: items,
      subtotal: sub,
      discount: disc,
      total: total,
      status: 'pending',
      createdAt: serverTimestamp()
    };
    await addDoc(collection(db,'orders'), orderData);

    // Track voucher usage
    if (appliedVoucher) {
      var vRef = doc(db,'vouchers', appliedVoucher.id);
      var newCount = (appliedVoucher.usedCount || 0) + 1;
      await updateDoc(vRef, {usedCount: newCount});
      if (appliedVoucher.perCustomer) {
        sessionStorage.setItem('voucher_used_' + appliedVoucher.code, '1');
      }
    }
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var prodRef = doc(db,'products',item.productId);
      var prodSnap = await getDoc(prodRef);
      if (prodSnap.exists()) {
        var newStock = Math.max(0, prodSnap.data().stock - item.qty);
        await updateDoc(prodRef, {stock:newStock});
      }
    }
    var itemLines = items.map(function(i) { return '  • ' + i.name + ' x' + i.qty + ' — ' + formatPrice(i.subtotal); }).join('\n');
    await fetch('https://api.web3forms.com/submit', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject: 'New ZRS Order — ' + orderId,
        from_name: 'ZRS Order System',
        to: ORDER_EMAIL,
        message: 'ORDER: ' + orderId + '\nCustomer: ' + fd.get('profile_name') + ' / ' + fd.get('full_name') + '\nContact: ' + fd.get('contact') + '\nAddress: ' + fd.get('address') + '\nShipping: ' + selectedShipping + '\nPayment: ' + selectedPayment + '\n\nItems:\n' + itemLines + '\n\nTotal: ' + formatPrice(total)
      })
    });
    cart = {};
    updateCart();
    hideModal('checkout-modal');
    g('order-success-id').textContent = orderId;
    showModal('order-success-modal');
  } catch(err) { console.error(err); toast('Order failed. Please try again.','error'); }
  finally { btn.disabled = false; btn.textContent = 'Place Order'; }
});

// ════════════════════════════════════════════════════════════
//  ADMIN
// ════════════════════════════════════════════════════════════
function renderAdminProducts() {
  var grid = g('admin-products-grid');
  if (!grid) return;
  if (!products.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No products yet</p></div>'; return; }
  var html = '';
  products.forEach(function(p) {
    var img = imgOrPlaceholder(p.imageUrl, 'admin-product-card-img', '100%', '160px', '🏷️');
    html += '<div class="admin-product-card">' + img;
    html += '<div class="admin-product-card-body"><div class="admin-product-card-name">' + p.name + '</div>';
    html += '<div style="font-family:var(--font-mono);color:var(--accent)">' + formatPrice(p.price) + '</div>';
    html += '<div style="margin-top:.3rem">' + stockLabel(p.stock) + ' ' + p.stock + ' in stock</div></div>';
    html += '<div class="admin-product-card-footer">';
    html += '<button class="btn btn-ghost btn-sm" data-action="editprod" data-id="' + p.id + '">✏️ Edit</button>';
    html += '<button class="btn btn-danger btn-sm" data-action="delprod" data-id="' + p.id + '">🗑 Delete</button>';
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

function renderAdminPreorders() {
  var grid = g('admin-preorders-grid');
  if (!grid) return;
  if (!preorders.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div><p>No pre-orders yet</p></div>'; return; }
  var html = '';
  preorders.forEach(function(p) {
    var img = imgOrPlaceholder(p.imageUrl, 'admin-product-card-img', '100%', '160px', '📦');
    html += '<div class="admin-product-card">' + img;
    html += '<div class="admin-product-card-body"><div class="admin-product-card-name">' + p.name + '</div>';
    html += '<div style="font-family:var(--font-mono);color:var(--accent)">' + formatPrice(p.price) + '</div></div>';
    html += '<div class="admin-product-card-footer">';
    html += '<button class="btn btn-ghost btn-sm" data-action="editpre" data-id="' + p.id + '">✏️ Edit</button>';
    html += '<button class="btn btn-danger btn-sm" data-action="delpre" data-id="' + p.id + '">🗑 Delete</button>';
    html += '</div></div>';
  });
  grid.innerHTML = html;
}

function orderCardHtml(o, type) {
  var itemsList = o.items ? o.items.map(function(i) { return i.name + ' ×' + i.qty; }).join(', ') : '';
  var fbHtml = o.fbLink ? ' | <a href="' + o.fbLink + '" target="_blank" style="color:var(--accent)">FB</a>' : '';
  var noteHtml = o.note ? '<div style="font-size:.82rem;color:var(--light);margin-top:.3rem">Note: ' + o.note + '</div>' : '';
  var actions = '';
  if (type === 'pending') {
    actions += '<button class="btn btn-success btn-sm" data-action="completeorder" data-id="' + o.id + '">✓ Complete</button>';
    actions += '<button class="btn btn-danger btn-sm" data-action="removeorder" data-id="' + o.id + '">🗑 Remove</button>';
  } else if (type === 'complete') {
    actions += '<button class="btn btn-danger btn-sm" data-action="removeorder" data-id="' + o.id + '">🗑 Remove</button>';
  } else if (type === 'removed') {
    actions += '<button class="btn btn-ghost btn-sm" data-action="restoreorder" data-id="' + o.id + '">↩ Restore</button>';
    actions += '<button class="btn btn-danger btn-sm" data-action="permdelorder" data-id="' + o.id + '">✕ Delete</button>';
  }
  var statusBadge = type === 'complete' ? '<span class="badge badge-green" style="margin-left:.5rem">Completed</span>' : type === 'removed' ? '<span class="badge badge-gray" style="margin-left:.5rem">Removed</span>' : '';
  var html = '<div class="order-card">';
  html += '<div class="order-card-header"><div>';
  html += '<div class="order-id">' + o.orderId + statusBadge + '</div>';
  html += '<div class="order-name">' + o.profileName + ' / ' + o.fullName + '</div></div>';
  html += '<div class="flex gap-1">' + actions + '</div></div>';
  html += '<div class="order-items-list">' + itemsList + '</div>';
  html += '<div class="flex justify-between items-center"><span class="order-total">' + formatPrice(o.total) + '</span>';
  html += '<span style="font-size:.8rem;color:var(--muted)">' + (o.shipping||'') + ' · ' + (o.payment||'') + ' · ' + formatDate(o.createdAt) + '</span></div>';
  html += '<div style="font-size:.82rem;color:var(--muted);margin-top:.4rem">' + (o.address||'') + ' | ' + (o.contact||'') + fbHtml + '</div>';
  html += noteHtml + '</div>';
  return html;
}

var activeOrderTab = 'pending';

function renderAdminOrders() {
  var wrap = g('admin-orders-list');
  if (!wrap) return;

  var pending = orders.filter(function(o) { return o.status === 'pending'; });
  var completed = orders.filter(function(o) { return o.status === 'complete'; });
  var removed = orders.filter(function(o) { return o.status === 'removed'; });

  var tabHtml = '<div style="display:flex;gap:0;margin-bottom:1.5rem;border-bottom:1px solid var(--gray);">';
  var tabs = [{key:'pending',label:'Pending',count:pending.length},{key:'complete',label:'Completed',count:completed.length},{key:'removed',label:'Removed',count:removed.length}];
  tabs.forEach(function(t) {
    var active = activeOrderTab === t.key ? 'border-bottom:3px solid var(--accent);color:var(--white);' : 'border-bottom:3px solid transparent;color:var(--muted);';
    tabHtml += '<button data-action="ordertab" data-tab="' + t.key + '" style="' + active + 'padding:.8rem 1.2rem;font-size:.88rem;font-weight:700;text-transform:uppercase;background:none;border-top:none;border-left:none;border-right:none;cursor:pointer;">' + t.label + ' (' + t.count + ')</button>';
  });
  tabHtml += '</div>';

  var list = '';
  if (activeOrderTab === 'pending') {
    if (!pending.length) list = '<div class="empty-state"><div class="empty-icon">📋</div><p>No pending orders</p></div>';
    else pending.forEach(function(o) { list += orderCardHtml(o, 'pending'); });
  } else if (activeOrderTab === 'complete') {
    if (!completed.length) list = '<div class="empty-state"><div class="empty-icon">✅</div><p>No completed orders</p></div>';
    else completed.forEach(function(o) { list += orderCardHtml(o, 'complete'); });
  } else if (activeOrderTab === 'removed') {
    if (!removed.length) list = '<div class="empty-state"><div class="empty-icon">🗑️</div><p>No removed orders</p></div>';
    else removed.forEach(function(o) { list += orderCardHtml(o, 'removed'); });
  }

  wrap.innerHTML = tabHtml + list;
}

function renderAdminReservations() {
  var list = g('admin-reservations-list');
  if (!list) return;
  if (!reservations.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><p>No reservations yet</p></div>'; return; }
  var html = '';
  reservations.forEach(function(r) {
    var fbHtml = r.fbLink ? ' · <a href="' + r.fbLink + '" target="_blank" style="color:var(--accent)">FB Profile</a>' : '';
    html += '<div class="reservation-card"><div class="reservation-info">';
    html += '<div class="name">' + r.name + '</div>';
    html += '<div class="product">' + r.productName + '</div>';
    html += '<div class="contact">' + r.contact + fbHtml + '</div>';
    html += '<div style="font-size:.78rem;color:var(--muted)">' + formatDate(r.createdAt) + '</div></div>';
    html += '<button class="btn btn-danger btn-sm" data-action="delres" data-id="' + r.id + '">🗑</button></div>';
  });
  list.innerHTML = html;
}

function renderAdminVouchers() {
  var list = g('admin-vouchers-list');
  if (!list) return;
  if (!vouchers.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">🎟️</div><p>No vouchers yet</p></div>'; return; }
  var html = '';
  vouchers.forEach(function(v) {
    var disc = v.type === 'fixed' ? '₱' + v.value + ' off' : v.value + '% off';
    var isActive = v.active !== false;
    var usageInfo = '';
    if (v.maxUses) usageInfo += '<span style="color:var(--muted);font-size:.78rem;">Used: ' + (v.usedCount||0) + ' / ' + v.maxUses + '</span>';
    if (v.perCustomer) usageInfo += '<span style="color:var(--muted);font-size:.78rem;margin-left:.5rem;">1x per customer</span>';
    html += '<div class="voucher-card"><div><div class="voucher-code">' + v.code + '</div>';
    html += '<div style="font-size:.8rem;color:var(--muted)">' + (v.type === 'fixed' ? 'Fixed' : 'Percentage') + (usageInfo ? ' · ' : '') + usageInfo + '</div></div>';
    html += '<div class="voucher-discount">' + disc + '</div><div class="flex gap-1">';
    html += '<button class="btn btn-ghost btn-sm" data-action="togglevoucher" data-id="' + v.id + '" data-active="' + isActive + '">' + (isActive ? 'Disable' : 'Enable') + '</button>';
    html += '<button class="btn btn-danger btn-sm" data-action="delvoucher" data-id="' + v.id + '">🗑</button></div></div>';
  });
  list.innerHTML = html;
}

function renderAdminGallery() {
  var grid = g('admin-gallery-grid');
  if (!grid) return;
  if (!galleryItems.length) { grid.innerHTML = '<div class="empty-state"><div class="empty-icon">📸</div><p>No photos yet</p></div>'; return; }
  var html = '';
  galleryItems.forEach(function(item) {
    var cap = item.caption ? '<div style="font-size:.78rem;color:var(--muted);padding:.3rem 0;">' + item.caption + '</div>' : '';
    html += '<div style="position:relative;"><div class="gallery-item" style="cursor:default;"><img src="' + item.imageUrl + '" alt=""></div>' + cap;
    html += '<button class="btn btn-danger btn-sm" style="position:absolute;top:4px;right:4px;" data-action="delgallery" data-id="' + item.id + '">🗑</button></div>';
  });
  grid.innerHTML = html;
}

function renderAdminPosts() {
  var list = g('admin-posts-list');
  if (!list) return;
  if (!posts.length) { list.innerHTML = '<div class="empty-state"><div class="empty-icon">📝</div><p>No posts yet</p></div>'; return; }
  var html = '';
  posts.forEach(function(p) {
    html += '<div class="order-card"><div class="order-card-header"><div>';
    html += '<div style="font-size:1rem;font-weight:800;">' + p.title + '</div>';
    html += '<div style="font-size:.78rem;color:var(--muted)">' + formatDate(p.createdAt) + '</div></div>';
    html += '<div class="flex gap-1">';
    html += '<button class="btn btn-ghost btn-sm" data-action="editpost" data-id="' + p.id + '">✏️ Edit</button>';
    html += '<button class="btn btn-danger btn-sm" data-action="delpost" data-id="' + p.id + '">🗑</button>';
    html += '</div></div><div style="font-size:.85rem;color:var(--muted)">' + (p.content||'').substring(0,100) + '...</div></div>';
  });
  list.innerHTML = html;
}

function renderAdminQRs() {
  var methods = ['gcash','maribank','maya','chinabank'];
  var labels = {gcash:'GCash', maribank:'MariBank', maya:'Maya', chinabank:'ChinaBank'};
  var grid = g('admin-qr-grid');
  if (!grid) return;
  var html = '';
  methods.forEach(function(m) {
    var qrImg = qrCodes[m] ? '<img src="' + qrCodes[m] + '" style="max-width:120px;margin:0 auto .8rem;display:block;">' : '<div class="qr-placeholder">📷</div>';
    html += '<div class="qr-admin-card"><div class="qr-name">' + labels[m] + '</div>' + qrImg;
    html += '<label class="btn btn-ghost btn-sm w-full" style="cursor:pointer;">Upload QR<input type="file" accept="image/*" style="display:none" data-qrmethod="' + m + '" class="qr-upload-input"></label></div>';
  });
  grid.innerHTML = html;
  document.querySelectorAll('.qr-upload-input').forEach(function(inp) {
    inp.addEventListener('change', function() { uploadQR(this.dataset.qrmethod, this); });
  });
}

function renderAdminAppearance() {
  if (g('appear-site-name')) g('appear-site-name').value = appearance.siteName || 'ZRS';
  if (g('appear-hero-text')) g('appear-hero-text').value = appearance.heroText || '';
  if (g('appear-hero-sub')) g('appear-hero-sub').value = appearance.heroSub || '';
  if (g('appear-accent')) g('appear-accent').value = appearance.accentColor || '#fbb800';
}

// ── DELEGATED CLICK HANDLER ──────────────────────────────────
document.addEventListener('click', function(e) {
  var btn = e.target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  var id = btn.dataset.id;
  if (action === 'reserve') openReserveModal(id);
  else if (action === 'viewpost') openPostModal(id);
  else if (action === 'lightbox') openLightbox(btn.dataset.url);
  else if (action === 'addcart') addToCart(id);
  else if (action === 'qty-plus') changeCartQty(id, 1);
  else if (action === 'qty-minus') changeCartQty(id, -1);
  else if (action === 'checkout') startCheckout();
  else if (action === 'editprod') editProduct(id);
  else if (action === 'delprod') deleteProduct(id);
  else if (action === 'editpre') editPreorder(id);
  else if (action === 'delpre') deletePreorder(id);
  else if (action === 'completeorder') markOrderComplete(id);
  else if (action === 'removeorder') removeOrder(id);
  else if (action === 'restoreorder') restoreOrder(id);
  else if (action === 'permdelorder') permDeleteOrder(id);
  else if (action === 'ordertab') { activeOrderTab = btn.dataset.tab; renderAdminOrders(); }
  else if (action === 'delorder') deleteOrder(id);
  else if (action === 'delres') deleteReservation(id);
  else if (action === 'togglevoucher') toggleVoucher(id, btn.dataset.active);
  else if (action === 'delvoucher') deleteVoucher(id);
  else if (action === 'delgallery') deleteGalleryItem(id);
  else if (action === 'editpost') editPost(id);
  else if (action === 'delpost') deletePost(id);
});

function openLightbox(url) {
  var lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = '<img src="' + url + '">';
  lb.addEventListener('click', function() { lb.remove(); });
  document.body.appendChild(lb);
}

// ── PRODUCT CRUD ─────────────────────────────────────────────
window.openAddProductModal = function() {
  editingProductId = null;
  g('product-modal-title').textContent = 'Add Product';
  g('product-form').reset();
  g('product-img-preview').innerHTML = '';
  showModal('product-modal');
};
function editProduct(id) {
  var p = products.find(function(x) { return x.id === id; });
  if (!p) return;
  editingProductId = id;
  g('product-modal-title').textContent = 'Edit Product';
  g('product-name').value = p.name;
  g('product-price').value = p.price;
  g('product-stock').value = p.stock;
  g('product-desc').value = p.description || '';
  g('product-img-preview').innerHTML = p.imageUrl ? '<img src="' + p.imageUrl + '" style="max-height:100px;border-radius:4px;margin-top:.5rem">' : '';
  showModal('product-modal');
}
function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  deleteDoc(doc(db,'products',id)).then(function() { toast('Product deleted.','success'); });
}
g('product-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = g('product-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    var imgFile = g('product-img-file').files[0];
    var imageUrl = editingProductId ? (products.find(function(x) { return x.id === editingProductId; }) || {}).imageUrl || '' : '';
    if (imgFile) { toast('Uploading image...','info'); imageUrl = await uploadToImgBB(imgFile); }
    var data = {
      name: g('product-name').value.trim(),
      price: parseFloat(g('product-price').value),
      stock: parseInt(g('product-stock').value),
      description: g('product-desc').value.trim(),
      imageUrl: imageUrl || ''
    };
    if (editingProductId) { await updateDoc(doc(db,'products',editingProductId), data); toast('Product updated!','success'); }
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'products'), data); toast('Product added!','success'); }
    hideModal('product-modal');
  } catch(err) { console.error(err); toast('Failed to save.','error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Product'; }
});
g('product-img-file').addEventListener('change', function(e) {
  var f = e.target.files[0];
  if (f) g('product-img-preview').innerHTML = '<img src="' + URL.createObjectURL(f) + '" style="max-height:100px;border-radius:4px;margin-top:.5rem">';
});

// ── PREORDER CRUD ────────────────────────────────────────────
window.openAddPreorderModal = function() {
  editingPreorderId = null;
  g('preorder-modal-title').textContent = 'Add Pre-Order Item';
  g('preorder-form').reset();
  g('preorder-img-preview').innerHTML = '';
  showModal('preorder-modal');
};
function editPreorder(id) {
  var p = preorders.find(function(x) { return x.id === id; });
  if (!p) return;
  editingPreorderId = id;
  g('preorder-modal-title').textContent = 'Edit Pre-Order Item';
  g('preorder-name').value = p.name;
  g('preorder-price').value = p.price;
  g('preorder-desc').value = p.description || '';
  g('preorder-img-preview').innerHTML = p.imageUrl ? '<img src="' + p.imageUrl + '" style="max-height:100px;border-radius:4px;">' : '';
  showModal('preorder-modal');
}
function deletePreorder(id) {
  if (!confirm('Delete this pre-order item?')) return;
  deleteDoc(doc(db,'preorders',id)).then(function() { toast('Pre-order deleted.','success'); });
}
g('preorder-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = g('preorder-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    var imgFile = g('preorder-img-file').files[0];
    var imageUrl = editingPreorderId ? (preorders.find(function(x) { return x.id === editingPreorderId; }) || {}).imageUrl || '' : '';
    if (imgFile) { toast('Uploading image...','info'); imageUrl = await uploadToImgBB(imgFile); }
    var data = {name: g('preorder-name').value.trim(), price: parseFloat(g('preorder-price').value), description: g('preorder-desc').value.trim(), imageUrl: imageUrl || ''};
    if (editingPreorderId) { await updateDoc(doc(db,'preorders',editingPreorderId), data); toast('Pre-order updated!','success'); }
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'preorders'), data); toast('Pre-order added!','success'); }
    hideModal('preorder-modal');
  } catch(err) { toast('Failed.','error'); }
  finally { btn.disabled = false; btn.textContent = 'Save'; }
});
g('preorder-img-file').addEventListener('change', function(e) {
  var f = e.target.files[0];
  if (f) g('preorder-img-preview').innerHTML = '<img src="' + URL.createObjectURL(f) + '" style="max-height:100px;border-radius:4px;margin-top:.5rem">';
});

// ── ORDERS ───────────────────────────────────────────────────
function markOrderComplete(id) {
  updateDoc(doc(db,'orders',id), {status:'complete'}).then(function() { toast('Order marked complete!','success'); });
}

async function removeOrder(id) {
  if (!confirm('Remove this order? Stock will be restored.')) return;
  try {
    var o = orders.find(function(x) { return x.id === id; });
    if (o && o.items) {
      for (var i = 0; i < o.items.length; i++) {
        var item = o.items[i];
        var prodRef = doc(db,'products',item.productId);
        var prodSnap = await getDoc(prodRef);
        if (prodSnap.exists()) {
          var restored = prodSnap.data().stock + item.qty;
          await updateDoc(prodRef, {stock: restored});
        }
      }
    }
    await updateDoc(doc(db,'orders',id), {status:'removed'});
    toast('Order removed, stock restored.','success');
  } catch(err) { toast('Failed to remove order.','error'); console.error(err); }
}

function restoreOrder(id) {
  updateDoc(doc(db,'orders',id), {status:'pending'}).then(function() { toast('Order restored to pending.','success'); });
}

function permDeleteOrder(id) {
  if (!confirm('Permanently delete this order? This cannot be undone.')) return;
  deleteDoc(doc(db,'orders',id)).then(function() { toast('Order permanently deleted.','success'); });
}

// ── RESERVATIONS ─────────────────────────────────────────────
function deleteReservation(id) {
  if (!confirm('Remove this reservation?')) return;
  deleteDoc(doc(db,'reservations',id)).then(function() { toast('Removed.','success'); });
}

// ── VOUCHERS ─────────────────────────────────────────────────
g('voucher-add-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var code = g('voucher-code-input').value.trim().toUpperCase();
  var type = g('voucher-type-select').value;
  var value = parseFloat(g('voucher-value-input').value);
  var maxUsesVal = g('voucher-max-uses').value;
  var maxUses = maxUsesVal ? parseInt(maxUsesVal) : null;
  var perCustomer = g('voucher-per-customer').checked;
  if (!code || !value) { toast('Fill all fields.','error'); return; }
  if (vouchers.find(function(v) { return v.code === code; })) { toast('Code already exists.','error'); return; }
  var vData = {code:code, type:type, value:value, active:true, usedCount:0, perCustomer:perCustomer};
  if (maxUses) vData.maxUses = maxUses;
  await addDoc(collection(db,'vouchers'), vData);
  g('voucher-add-form').reset();
  toast('Voucher added!','success');
});
function toggleVoucher(id, currentActive) {
  updateDoc(doc(db,'vouchers',id), {active: currentActive === 'true' ? false : true});
}
function deleteVoucher(id) {
  if (!confirm('Delete voucher?')) return;
  deleteDoc(doc(db,'vouchers',id)).then(function() { toast('Voucher deleted.','success'); });
}

// ── GALLERY ──────────────────────────────────────────────────
g('gallery-upload-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = g('gallery-upload-btn');
  btn.disabled = true; btn.textContent = 'Uploading...';
  try {
    var file = g('gallery-file-input').files[0];
    if (!file) { toast('Select an image.','error'); return; }
    var imageUrl = await uploadToImgBB(file);
    var caption = g('gallery-caption-input').value.trim();
    await addDoc(collection(db,'gallery'), {imageUrl:imageUrl, caption:caption, createdAt:serverTimestamp()});
    g('gallery-upload-form').reset();
    toast('Photo added!','success');
  } catch(err) { toast('Upload failed.','error'); }
  finally { btn.disabled = false; btn.textContent = 'Upload Photo'; }
});
function deleteGalleryItem(id) {
  if (!confirm('Delete this photo?')) return;
  deleteDoc(doc(db,'gallery',id)).then(function() { toast('Photo deleted.','success'); });
}

// ── POSTS ────────────────────────────────────────────────────
window.openAddPostModal = function() {
  editingPostId = null;
  g('post-form-modal-title').textContent = 'New Post';
  g('post-form').reset();
  g('post-img-preview').innerHTML = '';
  showModal('post-form-modal');
};
function editPost(id) {
  var p = posts.find(function(x) { return x.id === id; });
  if (!p) return;
  editingPostId = id;
  g('post-form-modal-title').textContent = 'Edit Post';
  g('post-title-input').value = p.title;
  g('post-content-input').value = p.content || '';
  g('post-img-preview').innerHTML = p.imageUrl ? '<img src="' + p.imageUrl + '" style="max-height:100px;border-radius:4px;">' : '';
  showModal('post-form-modal');
}
function deletePost(id) {
  if (!confirm('Delete this post?')) return;
  deleteDoc(doc(db,'posts',id)).then(function() { toast('Post deleted.','success'); });
}
g('post-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  var btn = g('post-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';
  try {
    var imgFile = g('post-img-file').files[0];
    var imageUrl = editingPostId ? (posts.find(function(x) { return x.id === editingPostId; }) || {}).imageUrl || '' : '';
    if (imgFile) imageUrl = await uploadToImgBB(imgFile);
    var data = {title: g('post-title-input').value.trim(), content: g('post-content-input').value.trim(), imageUrl: imageUrl || ''};
    if (editingPostId) { await updateDoc(doc(db,'posts',editingPostId), data); toast('Post updated!','success'); }
    else { data.createdAt = serverTimestamp(); await addDoc(collection(db,'posts'), data); toast('Post published!','success'); }
    hideModal('post-form-modal');
  } catch(err) { toast('Failed.','error'); }
  finally { btn.disabled = false; btn.textContent = 'Save Post'; }
});
g('post-img-file').addEventListener('change', function(e) {
  var f = e.target.files[0];
  if (f) g('post-img-preview').innerHTML = '<img src="' + URL.createObjectURL(f) + '" style="max-height:100px;border-radius:4px;margin-top:.5rem">';
});

// ── QR CODES ─────────────────────────────────────────────────
async function uploadQR(method, input) {
  var file = input.files[0];
  if (!file) return;
  try {
    toast('Uploading QR...','info');
    var url = await uploadToImgBB(file);
    var updated = Object.assign({}, qrCodes);
    updated[method] = url;
    await setDoc(doc(db,'settings','qrcodes'), updated, {merge:true});
    toast('QR uploaded!','success');
  } catch(err) { toast('QR upload failed.','error'); }
}

// ── APPEARANCE ───────────────────────────────────────────────
g('appearance-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  try {
    await setDoc(doc(db,'settings','appearance'), {
      siteName: g('appear-site-name').value.trim(),
      heroText: g('appear-hero-text').value.trim(),
      heroSub: g('appear-hero-sub').value.trim(),
      accentColor: g('appear-accent').value
    });
    toast('Appearance saved!','success');
  } catch(err) { toast('Failed.','error'); }
});

// ── SHIPPING / PAYMENT CLICK ─────────────────────────────────
document.querySelectorAll('.shipping-option').forEach(function(opt) {
  opt.addEventListener('click', function() { selectShipping(opt.dataset.ship); });
});
document.querySelectorAll('.payment-option').forEach(function(opt) {
  opt.addEventListener('click', function() { selectPayment(opt.dataset.pay); });
});

// ── MODAL CLOSE ──────────────────────────────────────────────
document.querySelectorAll('[data-close-modal]').forEach(function(btn) {
  btn.addEventListener('click', function() { hideModal(btn.dataset.closeModal); });
});
document.querySelectorAll('.modal-overlay').forEach(function(overlay) {
  overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.classList.add('hidden'); });
});

// ── INIT ─────────────────────────────────────────────────────
startListeners();
switchPanel('general');
renderCartSidebar();
setTimeout(function() {
  var loader = g('app-loader');
  if (loader) { loader.style.opacity = '0'; setTimeout(function() { loader.remove(); }, 400); }
}, 1200);
