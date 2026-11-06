const STORAGE_KEY = "llista-compartida-demo-v1";

const products = [
  { id: "tomato", name: "Tomàquet de branca", category: "Fruita i verdura", price: 2.49, unit: "kg", emoji: "🍅" },
  { id: "avocado", name: "Alvocat madur", category: "Fruita i verdura", price: 1.35, unit: "u.", emoji: "🥑" },
  { id: "apples", name: "Pomes Golden", category: "Fruita i verdura", price: 2.18, unit: "kg", emoji: "🍎" },
  { id: "bananas", name: "Plàtans", category: "Fruita i verdura", price: 1.79, unit: "kg", emoji: "🍌" },
  { id: "spinach", name: "Espinacs frescos", category: "Fruita i verdura", price: 1.69, unit: "bossa", emoji: "🥬" },
  { id: "bread", name: "Pa de pagès", category: "Forn", price: 2.35, unit: "barra", emoji: "🥖" },
  { id: "croissants", name: "Croissants", category: "Forn", price: 2.10, unit: "paquet", emoji: "🥐" },
  { id: "milk", name: "Llet sencera", category: "Làctics i ous", price: 1.12, unit: "l", emoji: "🥛" },
  { id: "eggs", name: "Ous de pagès", category: "Làctics i ous", price: 3.45, unit: "dotzena", emoji: "🥚" },
  { id: "yogurt", name: "Iogurt natural", category: "Làctics i ous", price: 2.28, unit: "pack", emoji: "🥣" },
  { id: "rice", name: "Arròs rodó", category: "Rebost", price: 1.65, unit: "kg", emoji: "🍚" },
  { id: "chickpeas", name: "Cigrons cuits", category: "Rebost", price: 1.19, unit: "pot", emoji: "🫘" },
  { id: "oil", name: "Oli d’oliva", category: "Rebost", price: 8.75, unit: "l", emoji: "🫒" },
  { id: "soap", name: "Sabó de mans", category: "Casa", price: 2.60, unit: "ampolla", emoji: "🧼" }
];

const categories = ["Tot", "Fruita i verdura", "Forn", "Làctics i ous", "Rebost", "Casa"];
const $ = (selector) => document.querySelector(selector);

function validItem(item) {
  return item &&
    typeof item.id === "string" &&
    typeof item.productId === "string" &&
    typeof item.name === "string" &&
    typeof item.category === "string" &&
    typeof item.price === "number" &&
    item.price >= 0 &&
    typeof item.unit === "string" &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    typeof item.checked === "boolean";
}

function readSavedState(raw = localStorage.getItem(STORAGE_KEY)) {
  const defaults = {
    listName: "La compra de casa",
    items: [],
    theme: "light",
    sound: false,
    screen: "welcome"
  };

  if (!raw) return defaults;

  try {
    const saved = JSON.parse(raw);
    return {
      listName: typeof saved.listName === "string" && saved.listName.trim()
        ? saved.listName.slice(0, 60)
        : defaults.listName,
      items: Array.isArray(saved.items) ? saved.items.filter(validItem) : [],
      theme: saved.theme === "dark" ? "dark" : "light",
      sound: saved.sound === true,
      screen: ["welcome", "shopping", "profile"].includes(saved.screen)
        ? saved.screen
        : "welcome"
    };
  } catch {
    return defaults;
  }
}

let state = readSavedState();
let activeCategory = "Tot";
let toastTimer;
let audioContext;

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    showToast("No s’han pogut desar les dades en aquest navegador.");
    return false;
  }
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} €`;
}

function makeId() {
  return globalThis.crypto?.randomUUID?.() ||
    `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

function playSuccessSound() {
  if (!state.sound || !window.AudioContext) return;

  try {
    audioContext ||= new window.AudioContext();
    if (audioContext.state === "suspended") void audioContext.resume();

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const now = audioContext.currentTime;

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, now);
    oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(now + 0.21);
  } catch {
    // L’aplicació continua funcionant si el navegador no admet àudio.
  }
}

function setScreen(screen) {
  state.screen = screen;
  saveState();
  render();
}

function getTotal() {
  return state.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function renderCategories() {
  $("#category-list").innerHTML = categories.map((category) => `
    <button class="category-button ${activeCategory === category ? "active" : ""}"
      type="button" data-category="${escapeHTML(category)}">
      ${escapeHTML(category)}
    </button>
  `).join("");
}

function renderProducts() {
  const search = $("#search-input").value.trim().toLocaleLowerCase("ca");
  const matchingProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "Tot" || product.category === activeCategory;
    const matchesSearch = product.name.toLocaleLowerCase("ca").includes(search);
    return matchesCategory && matchesSearch;
  });

  if (!matchingProducts.length) {
    $("#product-list").innerHTML = `
      <div class="empty-state">No hem trobat cap producte. Prova una altra cerca.</div>
    `;
    return;
  }

  $("#product-list").innerHTML = matchingProducts.map((product) => {
    const existing = state.items.find((item) => item.productId === product.id && !item.checked);
    return `
      <div class="product-row">
        <span class="product-emoji" aria-hidden="true">${product.emoji}</span>
        <div>
          <div class="product-name">${escapeHTML(product.name)}</div>
          <div class="product-meta">${escapeHTML(product.category)} · per ${escapeHTML(product.unit)}</div>
        </div>
        <span class="product-price">${formatPrice(product.price)}</span>
        <button class="add-button" type="button" data-add-id="${product.id}"
          aria-label="Afegeix ${escapeHTML(product.name)}">${existing ? existing.quantity : "+"}</button>
      </div>
    `;
  }).join("");
}

function renderItems() {
  const list = $("#shopping-items");

  if (!state.items.length) {
    list.innerHTML = `
      <div class="empty-state">
        La llista encara és buida.<br>
        <span class="product-meta">Afegeix-hi els primers productes del catàleg.</span>
      </div>
    `;
  } else {
    list.innerHTML = state.items.map((item) => `
      <div class="shopping-item ${item.checked ? "checked" : ""}">
        <button class="check-button ${item.checked ? "checked" : ""}" type="button"
          data-item-action="toggle" data-item-id="${escapeHTML(item.id)}"
          aria-label="${item.checked ? "Desmarca" : "Marca"} ${escapeHTML(item.name)}"
          aria-pressed="${item.checked}">${item.checked ? "✓" : ""}</button>
        <div>
          <div class="product-name">${escapeHTML(item.name)}</div>
          <div class="item-details">${formatPrice(item.price)} / ${escapeHTML(item.unit)} · ${item.quantity} ×</div>
        </div>
        <div class="quantity-control">
          <button type="button" data-item-action="decrease" data-item-id="${escapeHTML(item.id)}"
            aria-label="Redueix la quantitat de ${escapeHTML(item.name)}">−</button>
          <span class="quantity-number">${item.quantity}</span>
          <button type="button" data-item-action="increase" data-item-id="${escapeHTML(item.id)}"
            aria-label="Augmenta la quantitat de ${escapeHTML(item.name)}">+</button>
          <button class="remove-button" type="button" data-item-action="remove"
            data-item-id="${escapeHTML(item.id)}" aria-label="Elimina ${escapeHTML(item.name)}">×</button>
        </div>
      </div>
    `).join("");
  }

  const pending = state.items.filter((item) => !item.checked).length;
  const checked = state.items.filter((item) => item.checked).length;
  $("#pending-count").textContent = `${pending} per comprar`;
  $("#total-count").textContent = `${state.items.length} articles`;
  $("#total-price").textContent = formatPrice(getTotal());
  $("#clear-checked").disabled = checked === 0;
}

function renderProfile() {
  const pending = state.items.filter((item) => !item.checked).length;
  const checked = state.items.filter((item) => item.checked).length;

  $("#profile-list-name").textContent = state.listName;
  $("#stat-total").textContent = state.items.length;
  $("#stat-pending").textContent = pending;
  $("#stat-price").textContent = formatPrice(getTotal());
  $("#profile-checked-count").textContent = `${checked} fets`;

  if (!state.items.length) {
    $("#profile-items").innerHTML = `<div class="empty-state">Encara no hi ha cap article.</div>`;
  } else {
    $("#profile-items").innerHTML = state.items.map((item) => `
      <div class="profile-item">
        <span class="product-emoji" aria-hidden="true">${item.checked ? "✓" : "🧺"}</span>
        <div>
          <div class="product-name">${escapeHTML(item.name)}</div>
          <div class="product-meta">${item.quantity} × ${escapeHTML(item.unit)}${item.checked ? " · Fet" : ""}</div>
        </div>
        <span class="product-price">${formatPrice(item.price * item.quantity)}</span>
      </div>
    `).join("");
  }
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.hidden = screen.id !== `${state.screen}-screen`;
  });

  const inApp = state.screen !== "welcome";
  $("#main-nav").hidden = !inApp;
  $("#mobile-nav").hidden = !inApp;

  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === state.screen);
  });

  $("#theme-button").innerHTML = state.theme === "dark"
    ? "<span aria-hidden='true'>☼</span>"
    : "<span aria-hidden='true'>☾</span>";
  $("#theme-button").setAttribute("aria-label", state.theme === "dark" ? "Activa el mode clar" : "Activa el mode fosc");
  $("#theme-button").setAttribute("aria-pressed", String(state.theme === "dark"));

  $("#sound-button").setAttribute("aria-pressed", String(state.sound));
  $("#sound-button").setAttribute("aria-label", state.sound ? "Desactiva els sons" : "Activa els sons");
  $("#sound-button").innerHTML = `<span aria-hidden="true">${state.sound ? "♫" : "♪"}</span>`;

  if (document.activeElement !== $("#list-name")) {
    $("#list-name").value = state.listName;
  }

  renderCategories();
  renderProducts();
  renderItems();
  renderProfile();
}

function addProduct(product) {
  const existing = state.items.find((item) => item.productId === product.id && !item.checked);

  if (existing) {
    existing.quantity += 1;
  } else {
    state.items.push({
      id: makeId(),
      productId: product.id,
      name: product.name,
      category: product.category,
      price: product.price,
      unit: product.unit,
      quantity: 1,
      checked: false
    });
  }

  saveState();
  render();
  showToast(`${product.name} afegit a la llista`);
  playSuccessSound();
}

function shareText() {
  const lines = state.items.map((item) =>
    `${item.checked ? "✓ Fet" : "□ Per comprar"} · ${item.quantity} × ${item.name}`
  );
  return `${state.listName}\n${lines.join("\n")}\n\nTotal orientatiu: ${formatPrice(getTotal())}`;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  } catch {
    return false;
  }
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, a");
  if (!target) return;

  if (target.id === "brand-home") {
    event.preventDefault();
    setScreen("welcome");
  }

  if (target.dataset.screen) {
    setScreen(target.dataset.screen);
  }

  if (target.dataset.category) {
    activeCategory = target.dataset.category;
    renderCategories();
    renderProducts();
  }

  if (target.dataset.addId) {
    const product = products.find((item) => item.id === target.dataset.addId);
    if (product) addProduct(product);
  }

  if (target.dataset.itemAction) {
    const item = state.items.find((entry) => entry.id === target.dataset.itemId);
    if (!item) return;

    switch (target.dataset.itemAction) {
      case "toggle":
        item.checked = !item.checked;
        if (item.checked) playSuccessSound();
        break;
      case "increase":
        item.quantity += 1;
        break;
      case "decrease":
        if (item.quantity > 1) item.quantity -= 1;
        else state.items = state.items.filter((entry) => entry.id !== item.id);
        break;
      case "remove":
        if (window.confirm(`Vols eliminar “${item.name}” de la llista?`)) {
          state.items = state.items.filter((entry) => entry.id !== item.id);
        }
        break;
    }

    saveState();
    render();
  }

  if (target.id === "clear-checked") {
    const checkedCount = state.items.filter((item) => item.checked).length;
    if (!checkedCount) return;
    state.items = state.items.filter((item) => !item.checked);
    saveState();
    render();
    showToast("Articles marcats eliminats");
    playSuccessSound();
  }

  if (target.id === "theme-button") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveState();
    render();
  }

  if (target.id === "sound-button") {
    state.sound = !state.sound;
    if (state.sound && window.AudioContext) {
      try {
        audioContext ||= new window.AudioContext();
        void audioContext.resume();
      } catch {
        // Els sons són opcionals.
      }
    }
    saveState();
    render();
    showToast(state.sound ? "Sons activats" : "Sons desactivats");
  }

  if (target.id === "refresh-button") {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      showToast("Encara no hi ha cap còpia guardada.");
      return;
    }
    state = readSavedState(saved);
    render();
    showToast("Dades guardades actualitzades");
  }

  if (target.id === "share-whatsapp") {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank", "noopener,noreferrer");
  }

  if (target.id === "share-email") {
    const subject = encodeURIComponent(state.listName);
    const body = encodeURIComponent(shareText());
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  if (target.id === "share-instagram") {
    const instagramWindow = window.open("https://www.instagram.com/", "_blank", "noopener,noreferrer");
    void copyText(shareText()).then((copied) => {
      showToast(copied ? "Resum copiat. Enganxa’l a Instagram." : "No s’ha pogut copiar el resum.");
    });
    if (instagramWindow) instagramWindow.opener = null;
  }

  if (target.id === "share-native") {
    if (navigator.share) {
      void navigator.share({ title: state.listName, text: shareText() })
        .catch((error) => {
          if (error.name !== "AbortError") showToast("No s’ha pogut obrir el menú per compartir.");
        });
    } else {
      void copyText(shareText()).then((copied) => {
        showToast(copied ? "Resum copiat al porta-retalls." : "No s’ha pogut copiar el resum.");
      });
    }
  }
});

$("#search-input").addEventListener("input", renderProducts);

$("#custom-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#custom-name").value.trim();
  const priceValue = Number($("#custom-price").value.replace(",", "."));
  if (!name) {
    $("#custom-name").focus();
    return;
  }

  state.items.push({
    id: makeId(),
    productId: makeId(),
    name,
    category: "Altres",
    price: Number.isFinite(priceValue) && priceValue >= 0 ? priceValue : 0,
    unit: "u.",
    quantity: 1,
    checked: false
  });

  $("#custom-name").value = "";
  $("#custom-price").value = "";
  saveState();
  render();
  showToast(`${name} afegit a la llista`);
  playSuccessSound();
});

$("#list-name").addEventListener("change", (event) => {
  const name = event.target.value.trim();
  state.listName = name || "La compra de casa";
  event.target.value = state.listName;
  saveState();
  renderProfile();
});

window.addEventListener("storage", (event) => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  state = readSavedState(event.newValue);
  render();
  showToast("Llista actualitzada des d’una altra pestanya");
});

render();
