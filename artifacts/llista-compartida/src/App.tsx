import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, Route, Router, Switch, useLocation } from 'wouter';
import {
  ArrowRight, Check, CheckCheck, CircleUserRound, Clipboard, Copy, Egg, Flower2,
  House, ListChecks, Mail, Minus, Plus, Search, Share2, ShoppingBasket, ShoppingCart,
  Trash2, Wheat, X,
} from 'lucide-react';

type Product = { id: string; name: string; category: string; price: number; unit: string };
type Entry = Product & { productId: string; quantity: number; checked: boolean };
type ListData = { name: string; items: Entry[] };

const products: Product[] = [
  { id: 'p1', name: 'Tomàquet de branca', category: 'Fruita i verdura', price: 2.49, unit: 'kg' },
  { id: 'p2', name: 'Alvocat madur', category: 'Fruita i verdura', price: 1.35, unit: 'u.' },
  { id: 'p3', name: 'Pomes Golden', category: 'Fruita i verdura', price: 2.18, unit: 'kg' },
  { id: 'p4', name: 'Plàtans', category: 'Fruita i verdura', price: 1.79, unit: 'kg' },
  { id: 'p5', name: 'Espinacs frescos', category: 'Fruita i verdura', price: 1.69, unit: 'bossa' },
  { id: 'p6', name: 'Pa de pagès', category: 'Forn', price: 2.35, unit: 'barra' },
  { id: 'p7', name: 'Croissants', category: 'Forn', price: 2.10, unit: 'paquet' },
  { id: 'p8', name: 'Llet sencera', category: 'Làctics i ous', price: 1.12, unit: 'l' },
  { id: 'p9', name: 'Ous de pagès', category: 'Làctics i ous', price: 3.45, unit: 'dotzena' },
  { id: 'p10', name: 'Iogurt natural', category: 'Làctics i ous', price: 2.28, unit: 'pack' },
  { id: 'p11', name: 'Formatge tendre', category: 'Làctics i ous', price: 3.89, unit: 'peça' },
  { id: 'p12', name: 'Arròs rodó', category: 'Rebost', price: 1.65, unit: 'kg' },
  { id: 'p13', name: 'Cigrons cuits', category: 'Rebost', price: 1.19, unit: 'pot' },
  { id: 'p14', name: 'Oli d’oliva', category: 'Rebost', price: 8.75, unit: 'l' },
  { id: 'p15', name: 'Cafè mòlt', category: 'Rebost', price: 4.25, unit: 'paquet' },
  { id: 'p16', name: 'Sabó de mans', category: 'Casa', price: 2.60, unit: 'ampolla' },
];
const defaultList: ListData = {
  name: 'La compra de casa',
  items: [
    { ...products[0], productId: products[0].id, quantity: 1, checked: false },
    { ...products[5], productId: products[5].id, quantity: 1, checked: false },
    { ...products[8], productId: products[8].id, quantity: 1, checked: false },
  ],
};
const storageKey = 'llista-compartida-v1';
const categories = ['Tot', 'Fruita i verdura', 'Forn', 'Làctics i ous', 'Rebost', 'Casa'];
const euros = (value: number) => `${value.toFixed(2).replace('.', ',')} €`;

function readList(): ListData {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return defaultList;
    const parsed = JSON.parse(raw) as ListData;
    if (!Array.isArray(parsed.items) || typeof parsed.name !== 'string') return defaultList;
    return parsed;
  } catch {
    return defaultList;
  }
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const [location] = useLocation();
  const [list, setList] = useState<ListData>(readList);
  const [toast, setToast] = useState('');
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(list)); }, [list]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const addItem = (product: Product) => {
    setList(current => {
      const found = current.items.find(item => item.productId === product.id && !item.checked);
      return {
        ...current,
        items: found
          ? current.items.map(item => item === found ? { ...item, quantity: item.quantity + 1 } : item)
          : [...current.items, { ...product, productId: product.id, quantity: 1, checked: false }],
      };
    });
    setToast(`${product.name} afegit a la llista`);
  };
  const updateItem = (id: string, patch: Partial<Entry>) =>
    setList(current => ({ ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item) }));
  const removeItem = (id: string) =>
    setList(current => ({ ...current, items: current.items.filter(item => item.id !== id) }));
  const setTitle = (name: string) => setList(current => ({ ...current, name }));
  const clearChecked = () => {
    const count = list.items.filter(item => item.checked).length;
    if (!count) { setToast('Encara no has marcat cap producte'); return; }
    setList(current => ({ ...current, items: current.items.filter(item => !item.checked) }));
    setToast(`${count} ${count === 1 ? 'producte eliminat' : 'productes eliminats'} de la llista`);
  };
  const total = list.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const checkedCount = list.items.filter(item => item.checked).length;
  const shareText = `${list.name}\n${list.items.map(item => `${item.checked ? '✓' : '□'} ${item.quantity} × ${item.name}`).join('\n')}\n\nTotal orientatiu: ${euros(total)}`;
  const shareGeneral = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: list.name, text: shareText }); }
      catch (error) { if ((error as Error).name !== 'AbortError') setToast('No s’ha pogut compartir. Torna-ho a provar.'); }
    } else {
      await copyText(shareText, setToast);
    }
  };
  const shareInstagram = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: list.name, text: shareText }); }
      catch (error) { if ((error as Error).name !== 'AbortError') setToast('No s’ha pogut obrir el menú per compartir.'); }
      return;
    }
    const copied = await copyText(shareText, setToast, true);
    if (copied) {
      try { window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer'); }
      catch { setToast('Llista copiada. Obre Instagram per enganxar-la.'); }
      setToast('Llista copiada. Enganxa-la a Instagram.');
    }
  };

  return (
    <div className="app-shell">
      <div className="grain" aria-hidden="true" />
      <header className="topbar">
        <Link href="/" className="brand" data-testid="link-brand-home">
          <span className="brand-mark"><ShoppingBasket size={20} strokeWidth={2.3} /></span>
          <span className="brand-name">llista compartida</span>
        </Link>
        <nav className="nav-links" aria-label="Navegació principal">
          <Link href="/" className={`nav-link ${location === '/' ? 'active' : ''}`} data-testid="link-inici">Inici</Link>
          <Link href="/compra" className={`nav-link ${location === '/compra' ? 'active' : ''}`} data-testid="link-compra">La compra</Link>
          <Link href="/perfil" className={`nav-link ${location === '/perfil' ? 'active' : ''}`} data-testid="link-perfil">El meu resum</Link>
        </nav>
      </header>
      <Switch>
        <Route path="/">
          <Home />
        </Route>
        <Route path="/compra">
          <ShoppingPage list={list} setTitle={setTitle} addItem={addItem} updateItem={updateItem} removeItem={removeItem} clearChecked={clearChecked} total={total} />
        </Route>
        <Route path="/perfil">
          <ProfilePage list={list} total={total} checkedCount={checkedCount} shareGeneral={shareGeneral} shareInstagram={shareInstagram} setToast={setToast} />
        </Route>
        <Route>
          <Home />
        </Route>
      </Switch>
      <nav className="mobile-nav" aria-label="Navegació mòbil">
        <Link href="/" className={location === '/' ? 'active' : ''} data-testid="mobile-link-inici"><House /><span>Inici</span></Link>
        <Link href="/compra" className={location === '/compra' ? 'active' : ''} data-testid="mobile-link-compra"><ShoppingCart /><span>La compra</span></Link>
        <Link href="/perfil" className={location === '/perfil' ? 'active' : ''} data-testid="mobile-link-perfil"><CircleUserRound /><span>Resum</span></Link>
      </nav>
      {toast && <div className="toast" role="status" data-testid="status-feedback">{toast}</div>}
    </div>
  );
}

function Home() {
  return (
    <main className="wrap">
      <section className="hero-grid">
        <div className="reveal">
          <div className="eyebrow">La compra, entre tots</div>
          <h1 className="hero-title">Una llista.<br />Més <em>fàcil.</em></h1>
          <p className="hero-copy">Apunteu el que falta, marqueu el que ja teniu i envieu la llista a qui vulgueu. La compra de cada setmana, una mica més compartida.</p>
          <Link href="/compra" className="button button-primary" data-testid="button-start-shopping">
            Comença la llista <ArrowRight size={17} />
          </Link>
          <div style={{ marginTop: 20, color: '#8b9387', fontSize: 12 }} data-testid="text-privacy-note">Sense comptes ni complicacions. La teva llista queda al teu dispositiu.</div>
        </div>
        <div className="produce-art reveal-delay" aria-label="Il·lustració d’una cistella plena de fruita i verdura" role="img" data-testid="illustration-grocery-basket">
          <div className="produce-basket">
            <span className="fruit fruit-a" /><span className="fruit fruit-b" /><span className="fruit fruit-c" /><span className="fruit fruit-d" /><span className="fruit fruit-e" /><span className="basket" />
          </div>
          <div className="art-tag"><ListChecks size={16} style={{ verticalAlign: 'middle', marginRight: 7, color: '#286748' }} /> Una llista per compartir</div>
        </div>
      </section>
      <section className="section-band reveal-delay" aria-label="Com funciona">
        <article className="feature"><ShoppingBasket className="feature-icon" size={23} /><h3>Afegeix al teu ritme</h3><p>Troba productes o apunta allò que no surt al catàleg.</p></article>
        <article className="feature"><CheckCheck className="feature-icon" size={23} /><h3>Marca i continua</h3><p>Una llista clara per saber què falta mentre compres.</p></article>
        <article className="feature"><Share2 className="feature-icon" size={23} /><h3>Envia-la fàcilment</h3><p>Comparteix-la amb família o amistats en un moment.</p></article>
      </section>
    </main>
  );
}

function ShoppingPage({ list, setTitle, addItem, updateItem, removeItem, clearChecked, total }: {
  list: ListData; setTitle: (name: string) => void; addItem: (product: Product) => void;
  updateItem: (id: string, patch: Partial<Entry>) => void; removeItem: (id: string) => void;
  clearChecked: () => void; total: number;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tot');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const filtered = useMemo(() => products.filter(product =>
    (category === 'Tot' || product.category.trim() === category) &&
    product.name.toLocaleLowerCase('ca').includes(search.toLocaleLowerCase('ca'))
  ), [category, search]);
  const addCustom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    const price = Number(customPrice.replace(',', '.'));
    addItem({ id: `custom-${Date.now()}`, name, category: 'Altres', price: Number.isFinite(price) && price > 0 ? price : 0, unit: 'u.' });
    setCustomName('');
    setCustomPrice('');
  };
  return (
    <main className="wrap">
      <div className="page-heading reveal">
        <div><div className="eyebrow">El que necessiteu</div><h1>La compra</h1></div>
        <div className="list-count" data-testid="text-active-items">{list.items.filter(item => !item.checked).length} per comprar</div>
      </div>
      <div className="shopping-layout">
        <section className="card panel reveal" aria-label="Catàleg de productes">
          <div className="panel-head"><h2 className="panel-title">Troba-ho al catàleg</h2><ShoppingBasket size={20} color="#6a8a68" /></div>
          <label className="search-box"><Search size={18} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Busca un producte..." aria-label="Busca un producte" data-testid="input-product-search" /></label>
          <div className="chips" role="group" aria-label="Filtra per categoria">
            {categories.map(item => <button key={item} className={`chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} data-testid={`filter-category-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}
          </div>
          <div className="product-list">
            {filtered.length ? filtered.map((product, index) => (
              <div className="product-row" key={product.id} data-testid={`row-product-${product.id}`}>
                <div className="product-dot">{iconForCategory(product.category)}</div>
                <div className="product-info"><div className="product-name">{product.name}</div><div className="product-meta">{product.category.trim()} · per {product.unit}</div></div>
                <div className="product-price">{euros(product.price)}</div>
                <button className="add-button" onClick={() => addItem(product)} aria-label={`Afegeix ${product.name}`} data-testid={`button-add-${product.id}`}><Plus size={17} /></button>
              </div>
            )) : <div className="empty-state" data-testid="empty-catalog"><Search size={23} /><div>No hem trobat cap producte.</div><small>Prova una altra cerca o afegeix-lo a mà.</small></div>}
          </div>
          <form className="custom-entry" onSubmit={addCustom}>
            <input value={customName} onChange={event => setCustomName(event.target.value)} placeholder="Un producte a mà..." aria-label="Nom del producte personalitzat" data-testid="input-custom-product-name" />
            <input value={customPrice} onChange={event => setCustomPrice(event.target.value)} inputMode="decimal" placeholder="Preu €" aria-label="Preu aproximat" data-testid="input-custom-product-price" />
            <button type="submit" className="add-button" aria-label="Afegeix producte personalitzat" data-testid="button-add-custom"><Plus size={18} /></button>
          </form>
        </section>
        <section className="card panel reveal-delay" aria-label="Llista editable">
          <div className="panel-head"><h2 className="panel-title">La vostra llista</h2><span className="list-count" data-testid="text-list-item-count">{list.items.length} articles</span></div>
          <div className="list-top">
            <input className="title-input" value={list.name} onChange={event => setTitle(event.target.value)} aria-label="Títol de la llista" data-testid="input-list-title" maxLength={48} />
            <Clipboard size={17} color="#8a9486" />
          </div>
          <div className="list-items">
            {list.items.length ? list.items.map(item => (
              <div className={`list-item ${item.checked ? 'item-checked' : ''}`} key={item.id} data-testid={`row-list-item-${item.id}`}>
                <button className={`check-btn ${item.checked ? 'checked' : ''}`} onClick={() => updateItem(item.id, { checked: !item.checked })} aria-label={item.checked ? `Desmarca ${item.name}` : `Marca ${item.name}`} data-testid={`button-check-${item.id}`}>{item.checked && <Check size={14} />}</button>
                <div className="item-main"><div className="item-name">{item.name}</div><div className="item-detail">{euros(item.price)} / {item.unit} · {euros(item.price * item.quantity)}</div></div>
                <div className="qty-controls">
                  <button className="qty-btn" onClick={() => item.quantity > 1 ? updateItem(item.id, { quantity: item.quantity - 1 }) : removeItem(item.id)} aria-label={`Redueix ${item.name}`} data-testid={`button-quantity-minus-${item.id}`}><Minus size={13} /></button>
                  <span className="qty-number" data-testid={`text-quantity-${item.id}`}>{item.quantity}</span>
                  <button className="qty-btn" onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })} aria-label={`Augmenta ${item.name}`} data-testid={`button-quantity-plus-${item.id}`}><Plus size={13} /></button>
                  <button className="remove-btn" onClick={() => removeItem(item.id)} aria-label={`Elimina ${item.name}`} data-testid={`button-remove-${item.id}`}><X size={16} /></button>
                </div>
              </div>
            )) : <div className="empty-state" data-testid="empty-shopping-list"><ShoppingBasket size={25} /><div>La llista encara és buida.</div><small>Afegeix-hi els primers productes des del catàleg.</small></div>}
          </div>
          <div className="list-footer">
            <div><div className="total-label">Total orientatiu</div><div className="total-value" data-testid="text-list-total">{euros(total)}</div></div>
            <button className="clear-btn" onClick={clearChecked} data-testid="button-clear-checked"><Trash2 size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} />Neteja els marcats</button>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfilePage({ list, total, checkedCount, shareGeneral, shareInstagram, setToast }: {
  list: ListData; total: number; checkedCount: number; shareGeneral: () => Promise<void>;
  shareInstagram: () => Promise<void>; setToast: (message: string) => void;
}) {
  const count = list.items.length;
  const pending = count - checkedCount;
  const message = `Llista “${list.name}” — ${count} articles, total orientatiu ${euros(total)}.`;
  const shareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${list.name}\n${list.items.map(item => `${item.checked ? '✓' : '□'} ${item.quantity} × ${item.name}`).join('\n')}\n\nTotal orientatiu: ${euros(total)}`)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const shareMail = () => {
    window.location.href = `mailto:?subject=${encodeURIComponent(list.name)}&body=${encodeURIComponent(`${message}\n\n${list.items.map(item => `${item.checked ? '✓' : '□'} ${item.quantity} × ${item.name}`).join('\n')}`)}`;
  };
  return (
    <main className="wrap">
      <div className="page-heading reveal"><div><div className="eyebrow">Tot a punt</div><h1>El vostre resum</h1></div><Link href="/compra" className="button button-quiet" data-testid="link-edit-list"><ShoppingCart size={17} />Edita la llista</Link></div>
      <div className="profile-grid">
        <div className="reveal">
          <section className="card profile-card">
            <div className="profile-icon"><CircleUserRound size={28} /></div>
            <div className="eyebrow">La llista compartida</div>
            <h2 data-testid="text-profile-list-name">{list.name}</h2>
            <p>Una llista per tenir-ho tot a mà i coordinar la propera compra. Canvia’n el nom des de la pantalla de compra.</p>
          </section>
          <section className="summary-head" style={{ marginTop: 15 }}>
            <h2>La compra, d’un cop d’ull</h2><p>El resum s’actualitza amb la vostra llista.</p>
          </section>
          <div className="stats">
            <article className="card stat"><div className="stat-label">Articles</div><div className="stat-value" data-testid="text-summary-items">{count}</div><div className="stat-note">a la llista</div></article>
            <article className="card stat"><div className="stat-label">Per comprar</div><div className="stat-value" data-testid="text-summary-pending">{pending}</div><div className="stat-note">encara pendents</div></article>
            <article className="card stat"><div className="stat-label">Total orientatiu</div><div className="stat-value" data-testid="text-summary-total">{euros(total)}</div><div className="stat-note">preu aproximat</div></article>
          </div>
        </div>
        <div className="reveal-delay">
          <section className="card share-panel">
            <h3>Fes córrer la llista</h3>
            <p>Envia-la a qui vingui a comprar. Els preus són orientatius i la llista es comparteix com a text.</p>
            <div className="share-options">
              <button className="share-option" onClick={shareWhatsApp} data-testid="button-share-whatsapp"><Share2 size={18} />WhatsApp</button>
              <button className="share-option" onClick={shareMail} data-testid="button-share-gmail"><Mail size={18} />Gmail / correu</button>
              <button className="share-option" onClick={shareInstagram} data-testid="button-share-instagram"><Copy size={18} />Instagram</button>
              <button className="share-option" onClick={shareGeneral} data-testid="button-share-native"><Share2 size={18} />Més opcions</button>
            </div>
          </section>
          <section className="card share-panel" style={{ marginTop: 15 }}>
            <div className="panel-head" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>A la llista</h3><span className="list-count" data-testid="text-profile-checked">{checkedCount} fets</span></div>
            {list.items.length ? <div className="product-list">{list.items.map(item => <div className="product-row" key={item.id} data-testid={`profile-item-${item.id}`}><div className="product-dot">{item.checked ? <Check size={17} /> : <ShoppingBasket size={16} />}</div><div className="product-info"><div className="product-name">{item.name}</div><div className="product-meta">{item.quantity} × {item.unit}{item.checked ? ' · Fet' : ''}</div></div><div className="product-price">{euros(item.price * item.quantity)}</div></div>)}</div> : <div className="empty-state" data-testid="empty-profile-list"><ShoppingBasket size={24} /><div>Encara no hi ha cap article.</div></div>}
          </section>
        </div>
      </div>
    </main>
  );
}

function iconForCategory(category: string) {
  if (category.includes('verdura')) return <Flower2 size={17} />;
  if (category === 'Forn') return <Wheat size={17} />;
  if (category === 'Làctics i ous') return <Egg size={17} />;
  return <ShoppingBasket size={16} />;
}

async function copyText(text: string, setToast: (message: string) => void, quiet = false): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard unavailable');
    await navigator.clipboard.writeText(text);
    if (!quiet) setToast('Llista copiada al porta-retalls');
    return true;
  } catch {
    setToast('El navegador no permet copiar-ho. Prova una altra opció per compartir.');
    return false;
  }
}

export default App;
