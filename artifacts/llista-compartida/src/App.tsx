import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { caES } from '@clerk/localizations';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useParams } from 'wouter';
import {
  ArrowRight, Check, CheckCheck, CircleUserRound, Clipboard, CloudOff, Copy, Egg, Flower2,
  House, ListChecks, Mail, Minus, Plus, Search, Share2, ShoppingBasket, ShoppingCart,
  Sun, Moon, Volume2, VolumeX, Trash2, Wheat, X, Users, ChevronDown, LoaderCircle, LogOut, Link2, RefreshCw,
} from 'lucide-react';
import {
  getGetShoppingListQueryKey, getGetShoppingListsQueryKey,
  useAcceptShoppingListInvite, useAddShoppingListItem, useClearCompletedShoppingListItems,
  useCreateShoppingList, useCreateShoppingListInvite, useDeleteShoppingListItem,
  useGetShoppingList, useGetShoppingLists, useUpdateShoppingList, useUpdateShoppingListItem,
  type ShoppingListItemInput,
} from '@workspace/api-client-react';
import type { ShoppingList, ShoppingListItem, ShoppingListSummary } from '@workspace/api-client-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 8_000, retry: 1 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const products = [
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
const categories = ['Tot', 'Fruita i verdura', 'Forn', 'Làctics i ous', 'Rebost', 'Casa'];
const euros = (value: number) => `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
const makeId = () => globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const localListCacheKey = (userId: string, listId: string) => `llista-cache-v1:${userId}:${listId}`;

function readCachedShoppingList(userId: string | undefined, listId: string): ShoppingList | undefined {
  if (!userId || !listId) return undefined;
  try {
    const cached = JSON.parse(localStorage.getItem(localListCacheKey(userId, listId)) || 'null') as Partial<ShoppingList> | null;
    if (!cached || cached.id !== listId || typeof cached.name !== 'string' || !Array.isArray(cached.items)) return undefined;
    return cached as ShoppingList;
  } catch {
    return undefined;
  }
}

function usePersistedTheme() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('llista-theme') === 'dark');
  useEffect(() => { localStorage.setItem('llista-theme', isDark ? 'dark' : 'light'); }, [isDark]);
  return [isDark, setIsDark] as const;
}

function authRedirectTarget() {
  const fallback = `${basePath}/compra` || '/compra';
  const requested = new URLSearchParams(window.location.search).get('redirect_url');
  if (!requested) return fallback;
  try {
    const target = new URL(requested, window.location.origin);
    const joinPath = `${basePath}/join/` || '/join/';
    if (target.origin === window.location.origin && target.pathname.startsWith(joinPath)) {
      return `${target.pathname}${target.search}${target.hash}`;
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  const appearance = {
    theme: shadcn,
    cssLayerName: 'clerk',
    options: { logoPlacement: 'inside' as const, logoLinkUrl: basePath || '/', logoImageUrl: `${window.location.origin}${basePath}/logo.svg` },
    variables: {
      colorPrimary: '#286748', colorForeground: '#203a32', colorMutedForeground: '#788378', colorDanger: '#bd5947',
      colorBackground: '#fbfaf4', colorInput: '#f4f2e9', colorInputForeground: '#203a32', colorNeutral: '#d9ded1',
      fontFamily: 'DM Sans, sans-serif', borderRadius: '1rem',
    },
    elements: {
      rootBox: 'w-full flex justify-center', cardBox: 'bg-[#fbfaf4] rounded-[24px] w-[min(440px,_calc(100vw_-_36px))] max-w-full overflow-hidden shadow-none',
      card: '!shadow-none !border-0 !bg-transparent !rounded-none', footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
      headerTitle: 'text-[#203a32] font-semibold', headerSubtitle: 'text-[#788378]', socialButtonsBlockButtonText: 'text-[#315b43] font-semibold',
      formFieldLabel: 'text-[#425c4c] font-semibold', footerActionLink: 'text-[#286748] font-semibold', footerActionText: 'text-[#788378]',
      dividerText: 'text-[#788378]', identityPreviewEditButton: 'text-[#286748]', formFieldSuccessText: 'text-[#286748]', alertText: 'text-[#9d4739]',
      logoBox: 'rounded-xl', logoImage: 'rounded-xl', socialButtonsBlockButton: 'border-[#d9ded1] bg-[#f7f6ef] hover:bg-[#edf0e4]',
      formButtonPrimary: 'bg-[#286748] hover:bg-[#1d553b] shadow-none', formFieldInput: 'border-[#d9ded1] bg-[#f4f2e9] text-[#203a32] focus:border-[#286748]',
      footerAction: 'text-[#788378]', dividerLine: 'bg-[#e2e1d7]', alert: 'bg-[#fff0e9]', otpCodeFieldInput: 'border-[#d9ded1] bg-[#f4f2e9]',
      formFieldRow: 'mb-4', main: 'gap-5',
    },
  };
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={caES}
    routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <QueryClientProvider client={queryClient}><ClerkCacheSync /><Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/compra"><ProtectedPage view="shopping" /></Route>
      <Route path="/perfil"><ProtectedPage view="profile" /></Route>
      <Route path="/join/:token" component={JoinPage} />
      <Route component={NotFound} />
    </Switch></QueryClientProvider>
  </ClerkProvider>;
}

function ClerkCacheSync() {
  const { addListener } = useClerk(); const client = useQueryClient();
  useEffect(() => { let previous: string | null | undefined; return addListener(({ user }) => { const id = user?.id ?? null; if (previous !== undefined && previous !== id) client.clear(); previous = id; }); }, [addListener, client]);
  return null;
}
function SignInPage() { return <div className="auth-page"><div className="auth-side"><Link className="brand" href="/"><span className="brand-mark"><ShoppingBasket size={20} /></span><span className="brand-name">llista compartida</span></Link><p>Una compra més fàcil, perquè la feu entre tots.</p></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up${window.location.search}`} forceRedirectUrl={authRedirectTarget()} /></div>; }
function SignUpPage() { return <div className="auth-page"><div className="auth-side"><Link className="brand" href="/"><span className="brand-mark"><ShoppingBasket size={20} /></span><span className="brand-name">llista compartida</span></Link><p>Comenceu avui. Compartiu-la amb qui vulgueu.</p></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in${window.location.search}`} forceRedirectUrl={authRedirectTarget()} /></div>; }
function HomeRedirect() { return <><Show when="signed-in"><Redirect to="/compra" /></Show><Show when="signed-out"><Home /></Show></>; }
function ProtectedPage({ view }: { view: 'shopping' | 'profile' }) { return <><Show when="signed-in"><AppFrame view={view} /></Show><Show when="signed-out"><Redirect to="/" /></Show></>; }

function Home() {
  const [isDark, setIsDark] = usePersistedTheme();
  return <div className={`app-shell${isDark ? ' dark' : ''}`}><div className="grain" aria-hidden="true" /><header className="topbar"><Link href="/" className="brand" data-testid="link-brand-home"><span className="brand-mark"><ShoppingBasket size={20} /></span><span className="brand-name">llista compartida</span></Link><div className="topbar-actions"><nav className="nav-links"><Link href="/sign-in" className="nav-link" data-testid="link-sign-in">Inicia sessió</Link><Link href="/sign-up" className="button button-primary" data-testid="link-sign-up">Crea un compte <ArrowRight size={16} /></Link></nav><button className="utility-button" onClick={() => setIsDark(value => !value)} aria-label={isDark ? 'Canvia al mode clar' : 'Canvia al mode fosc'} title={isDark ? 'Mode clar' : 'Mode fosc'} data-testid="button-theme-toggle">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button></div></header>
    <main className="wrap welcome-wrap"><section className="hero-grid"><div className="reveal"><div className="eyebrow">La compra, entre tots</div><h1 className="hero-title">Una llista.<br />Més <em>fàcil.</em></h1><p className="hero-copy">Apunteu el que falta, marqueu el que ja teniu i convideu qui vulgueu. La compra de cada setmana, al mateix lloc i al mateix temps.</p><div className="hero-actions"><Link href="/sign-up" className="button button-primary" data-testid="button-start-shopping">Comença la llista <ArrowRight size={17} /></Link><Link href="/sign-in" className="text-link" data-testid="link-home-sign-in">Ja tens compte? Entra <ArrowRight size={15} /></Link></div><div className="privacy-note" data-testid="text-privacy-note"><Users size={15} /> Les llistes són teves. Tu decideixes amb qui compartir-les.</div></div>
    <div className="produce-art reveal-delay" role="img" aria-label="Cistella il·lustrada plena de productes frescos" data-testid="illustration-grocery-basket"><div className="produce-basket"><span className="fruit fruit-a" /><span className="fruit fruit-b" /><span className="fruit fruit-c" /><span className="fruit fruit-d" /><span className="fruit fruit-e" /><span className="basket" /></div><div className="art-tag"><ListChecks size={16} /> Una llista per compartir</div><div className="art-note">COMPRA D’AQUESTA SETMANA <span>— 04</span></div></div></section>
    <section className="section-band reveal-delay" aria-label="Com funciona"><article className="feature"><ShoppingBasket className="feature-icon" size={23} /><h3>Afegeix al teu ritme</h3><p>Troba productes o apunta allò que no surt al catàleg.</p></article><article className="feature"><CheckCheck className="feature-icon" size={23} /><h3>Marca i continua</h3><p>La llista es posa al dia per a tothom, al moment.</p></article><article className="feature"><Share2 className="feature-icon" size={23} /><h3>Convideu-vos</h3><p>Una invitació privada i la compra ja és compartida.</p></article></section>
    <section className="welcome-bottom"><div className="eyebrow">Per a les coses de cada dia</div><p>Menys missatges de “què faltava?”<br /><em>Més estona per a la resta.</em></p><Link href="/sign-up" className="button button-line" data-testid="button-welcome-bottom">Fes la primera llista <ArrowRight size={16} /></Link></section></main></div>;
}

function AppFrame({ view }: { view: 'shopping' | 'profile' }) {
  const [location] = useLocation(); const [, setLocation] = useLocation(); const queryClient = useQueryClient();
  const { signOut } = useClerk(); const { user } = useUser();
  const [toast, setToast] = useState(''); const [selectedId, setSelectedId] = useState(() => localStorage.getItem('llista-selected-id') || '');
  const [isDark, setIsDark] = usePersistedTheme();
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('llista-sounds') === 'true');
  const audioContextRef = useRef<AudioContext | null>(null);
  const playSuccessSound = () => {
    if (!soundEnabled || !window.AudioContext) return;
    try {
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      if (context.state === 'suspended') void context.resume();
      const oscillator = context.createOscillator();
      const volume = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(660, context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.12);
      volume.gain.setValueAtTime(0.0001, context.currentTime);
      volume.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.02);
      volume.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
      oscillator.connect(volume);
      volume.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.21);
    } catch {
      // Audio is optional; visual feedback and list updates still work when unavailable.
    }
  };
  const toggleSound = () => {
    const enable = !soundEnabled;
    setSoundEnabled(enable);
    if (!enable || !window.AudioContext) return;
    try {
      const context = audioContextRef.current ?? new window.AudioContext();
      audioContextRef.current = context;
      void context.resume();
    } catch {
      // The app remains fully usable if this browser does not support audio.
    }
  };
  const [listMenu, setListMenu] = useState(false); const [newListName, setNewListName] = useState(''); const [createOpen, setCreateOpen] = useState(false);
  useEffect(() => { localStorage.setItem('llista-sounds', String(soundEnabled)); }, [soundEnabled]);
  const listsQuery = useGetShoppingLists({ query: { queryKey: getGetShoppingListsQueryKey(), refetchInterval: 5000 } }); const summaries = listsQuery.data ?? [];
  useEffect(() => {
    if (!listsQuery.isSuccess) return;
    if (!summaries.length) { if (selectedId) setSelectedId(''); return; }
    if (!selectedId || !summaries.some(list => list.id === selectedId)) setSelectedId(summaries[0].id);
  }, [listsQuery.isSuccess, summaries, selectedId]);
  useEffect(() => { if (selectedId) localStorage.setItem('llista-selected-id', selectedId); }, [selectedId]);
  const listQuery = useGetShoppingList(selectedId || '', { query: { enabled: Boolean(selectedId), queryKey: getGetShoppingListQueryKey(selectedId || ''), refetchInterval: 2000 } });
  const localSnapshot = useMemo(() => readCachedShoppingList(user?.id, selectedId), [user?.id, selectedId]);
  const list = listQuery.data ?? localSnapshot;
  const isOfflineSnapshot = !listQuery.data && listQuery.isError && Boolean(localSnapshot);
  useEffect(() => {
    if (!user?.id || !listQuery.data) return;
    try {
      localStorage.setItem(localListCacheKey(user.id, listQuery.data.id), JSON.stringify(listQuery.data));
    } catch {
      setToast('No s’ha pogut desar la còpia local en aquest dispositiu.');
    }
  }, [user?.id, listQuery.data]);
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: getGetShoppingListsQueryKey() }); if (selectedId) void queryClient.invalidateQueries({ queryKey: getGetShoppingListQueryKey(selectedId) }); };
  const createList = useCreateShoppingList({ mutation: { onSuccess: result => { refresh(); setSelectedId(result.id); setCreateOpen(false); setNewListName(''); setToast('Llista creada'); playSuccessSound(); } } });
  const migrationAttempted = useRef(false);
  useEffect(() => {
    if (!listsQuery.isSuccess || summaries.length || migrationAttempted.current) return;
    migrationAttempted.current = true;
    const legacyKey = 'llista-compartida-v1';
    const raw = localStorage.getItem(legacyKey);
    if (!raw) return;
    try {
      const legacy = JSON.parse(raw) as { name?: unknown; items?: unknown };
      if (typeof legacy.name !== 'string' || !legacy.name.trim() || !Array.isArray(legacy.items)) {
        setToast('No hem pogut recuperar la llista desada en aquest dispositiu.');
        return;
      }
      const items = legacy.items.filter((value): value is ShoppingListItemInput => {
        if (!value || typeof value !== 'object') return false;
        const item = value as Record<string, unknown>;
        return typeof item.id === 'string' && typeof item.productId === 'string' &&
          typeof item.name === 'string' && typeof item.category === 'string' &&
          typeof item.price === 'number' && item.price >= 0 && typeof item.unit === 'string' &&
          typeof item.quantity === 'number' && Number.isInteger(item.quantity) && item.quantity >= 1 &&
          typeof item.checked === 'boolean';
      });
      createList.mutate({ data: { name: legacy.name.trim(), items } }, {
        onSuccess: () => localStorage.removeItem(legacyKey),
        onError: () => { migrationAttempted.current = false; setToast('No hem pogut importar la llista. Torna-ho a provar més tard.'); },
      });
    } catch {
      setToast('No hem pogut recuperar la llista desada en aquest dispositiu.');
    }
  }, [listsQuery.isSuccess, summaries.length, createList.mutate, setToast]);
  const renameList = useUpdateShoppingList({ mutation: { onSuccess: () => { refresh(); playSuccessSound(); } } });
  const addItem = useAddShoppingListItem({ mutation: { onSuccess: () => { refresh(); playSuccessSound(); } } });
  const patchItem = useUpdateShoppingListItem({ mutation: { onSuccess: () => { refresh(); playSuccessSound(); } } });
  const deleteItem = useDeleteShoppingListItem({ mutation: { onSuccess: () => { refresh(); playSuccessSound(); } } });
  const clearItems = useClearCompletedShoppingListItems({ mutation: { onSuccess: () => { refresh(); playSuccessSound(); } } });
  const makeInvite = useCreateShoppingListInvite();
  const [inviteUrl, setInviteUrl] = useState('');
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 2800); return () => window.clearTimeout(timer); }, [toast]);
  const total = list?.items.reduce((sum, item) => sum + item.price * item.quantity, 0) ?? 0;
  const checkedCount = list?.items.filter(item => item.checked).length ?? 0;
  const selectList = (id: string) => { setSelectedId(id); setListMenu(false); setInviteUrl(''); };
  const createNewList = (event: FormEvent) => { event.preventDefault(); const name = newListName.trim(); if (name) createList.mutate({ data: { name, items: [] } }); };
  const invite = async () => {
    if (!selectedId) return;
    makeInvite.mutate({ listId: selectedId }, { onSuccess: async result => { playSuccessSound(); const url = `${window.location.origin}${basePath}/join/${result.token}`; setInviteUrl(url); try { await navigator.clipboard.writeText(url); setToast('Invitació copiada. Comparteix l’enllaç amb qui vulguis.'); } catch { setToast('Invitació creada. Copia l’enllaç per compartir-la.'); } } });
  };
  const copyInvite = async () => { if (!inviteUrl) return; try { await navigator.clipboard.writeText(inviteUrl); setToast('Enllaç copiat'); } catch { setToast('No s’ha pogut copiar l’enllaç'); } };
  const shareListText = list ? `${list.name}\n${list.items.map(item => `${item.checked ? 'Fet' : 'Per comprar'} · ${item.quantity} × ${item.name}`).join('\n')}\n\nTotal orientatiu: ${euros(total)}${inviteUrl ? `\n\nUneix-te a la llista: ${inviteUrl}` : ''}` : '';
  const shareNative = async () => { if (navigator.share && list) { try { await navigator.share({ title: list.name, text: shareListText, url: inviteUrl || undefined }); } catch (error) { if ((error as Error).name !== 'AbortError') setToast('No s’ha pogut compartir.'); } } else if (inviteUrl) copyInvite(); else setToast('Crea una invitació per compartir la llista.'); };
  const shareWhatsapp = () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareListText}${inviteUrl ? `\n\nUneix-te a la llista: ${inviteUrl}` : ''}`)}`, '_blank', 'noopener,noreferrer');
  const shareMail = () => { window.location.href = `mailto:?subject=${encodeURIComponent(list?.name ?? 'Llista compartida')}&body=${encodeURIComponent(`${shareListText}${inviteUrl ? `\n\nUneix-te a la llista: ${inviteUrl}` : ''}`)}`; };
  const shareInstagram = async () => { try { await navigator.clipboard.writeText(shareListText); setToast('Llista copiada. Enganxa-la a Instagram.'); window.open('https://www.instagram.com/', '_blank', 'noopener,noreferrer'); } catch { setToast('No s’ha pogut copiar la llista.'); } };
  const activeView = isOfflineSnapshot && localSnapshot
    ? <OfflineSnapshot list={localSnapshot} retry={() => { void listsQuery.refetch(); void listQuery.refetch(); }} />
    : view === 'shopping'
      ? <ShoppingPage list={list} loading={listsQuery.isLoading || (!!selectedId && listQuery.isLoading && !localSnapshot)} error={listsQuery.isError || listQuery.isError} retry={() => { void listsQuery.refetch(); void listQuery.refetch(); }} summaries={summaries} onCreateList={() => setCreateOpen(true)} onAdd={(item) => selectedId && addItem.mutate({ listId: selectedId, data: item })} onUpdate={(itemId, patch) => selectedId && patchItem.mutate({ listId: selectedId, itemId, data: patch })} onDelete={itemId => selectedId && deleteItem.mutate({ listId: selectedId, itemId })} onRename={name => selectedId && renameList.mutate({ listId: selectedId, data: { name } })} onClear={() => selectedId && clearItems.mutate({ listId: selectedId })} toast={setToast} />
      : <ProfilePage list={list} summaries={summaries} total={total} checkedCount={checkedCount} inviteUrl={inviteUrl} onInvite={invite} onCopyInvite={copyInvite} invitePending={makeInvite.isPending} shareWhatsapp={shareWhatsapp} shareMail={shareMail} shareNative={shareNative} shareInstagram={shareInstagram} />;
  return <div className={`app-shell${isDark ? ' dark' : ''}`}><div className="grain" aria-hidden="true" /><header className="topbar"><Link href="/compra" className="brand" data-testid="link-brand-app"><span className="brand-mark"><ShoppingBasket size={20} /></span><span className="brand-name">llista compartida</span></Link><div className="topbar-actions"><nav className="nav-links" aria-label="Navegació principal"><Link href="/compra" className={`nav-link ${location === '/compra' ? 'active' : ''}`} data-testid="link-compra">La compra</Link><Link href="/perfil" className={`nav-link ${location === '/perfil' ? 'active' : ''}`} data-testid="link-perfil">El meu resum</Link><button className="nav-link logout-link" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={15} /> Surt</button></nav><button className="utility-button" onClick={() => setIsDark(value => !value)} aria-label={isDark ? 'Canvia al mode clar' : 'Canvia al mode fosc'} aria-pressed={isDark} title={isDark ? 'Mode clar' : 'Mode fosc'} data-testid="button-theme-toggle">{isDark ? <Sun size={17} /> : <Moon size={17} />}</button><button className={`utility-button${soundEnabled ? ' utility-active' : ''}`} onClick={toggleSound} aria-label={soundEnabled ? 'Desactiva els sons' : 'Activa els sons'} aria-pressed={soundEnabled} title={soundEnabled ? 'Sons activats' : 'Activa els sons'} data-testid="button-sound-toggle">{soundEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}</button></div></header>
    <main className="wrap app-wrap"><div className="list-switcher-row"><div className="list-switcher-wrap"><button className="list-switcher" onClick={() => setListMenu(!listMenu)} aria-expanded={listMenu} data-testid="button-switch-list"><span className="switcher-icon"><Clipboard size={17} /></span><span className="switcher-copy"><small>LLISTA SELECCIONADA</small><strong data-testid="text-selected-list">{list?.name ?? 'Tria una llista'}</strong></span><ChevronDown size={17} /></button>{listMenu && <div className="list-dropdown" data-testid="menu-shopping-lists">{summaries.map((summary: ShoppingListSummary) => <button className={`list-option ${selectedId === summary.id ? 'selected' : ''}`} key={summary.id} onClick={() => selectList(summary.id)} data-testid={`button-select-list-${summary.id}`}><span>{summary.name}</span><small>{summary.memberCount} {summary.memberCount === 1 ? 'persona' : 'persones'} · {summary.itemCount} articles</small></button>)}<button className="list-option new-list-option" onClick={() => { setCreateOpen(true); setListMenu(false); }} data-testid="button-create-list-open"><Plus size={16} /> Crea una llista nova</button></div>}</div><div className="members-indicator" data-testid="text-member-count"><Users size={16} /><strong>{list?.memberCount ?? summaries.find(s => s.id === selectedId)?.memberCount ?? 0}</strong><span>{(list?.memberCount ?? 0) === 1 ? 'persona' : 'persones'}</span></div><button className="refresh-button" onClick={() => { void listQuery.refetch(); void listsQuery.refetch(); }} aria-label="Actualitza la llista" data-testid="button-refresh-list"><RefreshCw size={16} /></button></div>
      {createOpen && <form className="create-list-form" onSubmit={createNewList}><label htmlFor="new-list-name">Nom de la llista</label><div><input id="new-list-name" autoFocus value={newListName} onChange={e => setNewListName(e.target.value)} placeholder="La compra de casa" maxLength={80} data-testid="input-new-list-name" /><button className="button button-primary" type="submit" disabled={!newListName.trim() || createList.isPending} data-testid="button-create-list-submit">{createList.isPending ? 'Creant…' : 'Crea llista'}</button><button className="icon-button" type="button" onClick={() => setCreateOpen(false)} aria-label="Tanca" data-testid="button-close-create-list"><X size={17} /></button></div></form>}
      {activeView}
    </main><nav className="mobile-nav" aria-label="Navegació mòbil"><Link href="/compra" className={view === 'shopping' ? 'active' : ''} data-testid="mobile-link-compra"><ShoppingCart /><span>La compra</span></Link><Link href="/perfil" className={view === 'profile' ? 'active' : ''} data-testid="mobile-link-perfil"><CircleUserRound /><span>Resum</span></Link><button onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="mobile-button-sign-out"><LogOut /><span>Surt</span></button></nav>{toast && <div className="toast" role="status" data-testid="status-feedback">{toast}</div>}</div>;
}

function ShoppingPage({ list, loading, error, retry, summaries, onCreateList, onAdd, onUpdate, onDelete, onRename, onClear, toast }: {
  list?: ShoppingList; loading: boolean; error: boolean; retry: () => void; summaries: ShoppingListSummary[]; onCreateList: () => void;
  onAdd: (item: ShoppingListItemInput) => void; onUpdate: (id: string, patch: { quantity?: number; checked?: boolean }) => void;
  onDelete: (id: string) => void; onRename: (name: string) => void; onClear: () => void; toast: (message: string) => void;
}) {
  const [search, setSearch] = useState(''); const [category, setCategory] = useState('Tot'); const [customName, setCustomName] = useState(''); const [customPrice, setCustomPrice] = useState(''); const [titleDraft, setTitleDraft] = useState(''); const [confirmDeleteId, setConfirmDeleteId] = useState('');
  useEffect(() => { if (list) setTitleDraft(list.name); }, [list?.id, list?.name]);
  const filtered = useMemo(() => products.filter(product => (category === 'Tot' || product.category === category) && product.name.toLocaleLowerCase('ca').includes(search.toLocaleLowerCase('ca'))), [category, search]);
  const append = (product: typeof products[number]) => { if (!list) return; const existing = list.items.find(item => item.productId === product.id && !item.checked); if (existing) onUpdate(existing.id, { quantity: existing.quantity + 1 }); else onAdd({ id: makeId(), productId: product.id, name: product.name, category: product.category, price: product.price, unit: product.unit, quantity: 1, checked: false }); toast(`${product.name} afegit a la llista`); };
  const addCustom = (event: FormEvent) => { event.preventDefault(); const name = customName.trim(); if (!name) return; const parsed = Number(customPrice.replace(',', '.')); onAdd({ id: makeId(), productId: `custom-${makeId()}`, name, category: 'Altres', price: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0, unit: 'u.', quantity: 1, checked: false }); setCustomName(''); setCustomPrice(''); toast(`${name} afegit a la llista`); };
  if (loading) return <main className="loading-layout"><div className="skeleton heading-skeleton" /><div className="skeleton-panels"><div className="skeleton" /><div className="skeleton" /></div></main>;
  if (error) return <section className="card error-state"><div className="error-mark"><RefreshCw /></div><h2>No hem pogut carregar la llista</h2><p>Comprova la connexió i torna-ho a provar.</p><button className="button button-primary" onClick={retry} data-testid="button-retry-list">Torna-ho a provar</button></section>;
  if (!list) return <section className="card empty-lists"><div className="empty-basket"><ShoppingBasket size={27} /></div><div className="eyebrow">Comencem de zero</div><h2>Encara no tens cap llista</h2><p>Crea una llista per apuntar-hi la compra i convidar-hi la resta.</p><button className="button button-primary" onClick={onCreateList} data-testid="button-empty-create-list">Crea la primera llista <ArrowRight size={16} /></button><small>{summaries.length ? 'També pots canviar a una altra llista des del selector de dalt.' : 'La primera llista és el punt de partida.'}</small></section>;
  const total = list.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const confirmDeleteItem = list.items.find(item => item.id === confirmDeleteId);
  return <><div className="page-heading reveal"><div><div className="eyebrow">El que necessiteu</div><h1>La compra</h1></div><div className="list-count" data-testid="text-active-items">{list.items.filter(item => !item.checked).length} per comprar</div></div><div className="shopping-layout">
    <section className="card panel reveal" aria-label="Catàleg de productes"><div className="panel-head"><h2 className="panel-title">Troba-ho al catàleg</h2><ShoppingBasket size={20} color="#6a8a68" /></div><label className="search-box"><Search size={18} /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Busca un producte..." aria-label="Busca un producte" data-testid="input-product-search" /></label><div className="chips" role="group" aria-label="Filtra per categoria">{categories.map(item => <button key={item} className={`chip ${category === item ? 'active' : ''}`} onClick={() => setCategory(item)} data-testid={`filter-category-${item.toLowerCase().replaceAll(' ', '-')}`}>{item}</button>)}</div><div className="product-list">{filtered.length ? filtered.map(product => <div className="product-row" key={product.id} data-testid={`row-product-${product.id}`}><div className="product-dot">{iconForCategory(product.category)}</div><div className="product-info"><div className="product-name">{product.name}</div><div className="product-meta">{product.category} · per {product.unit}</div></div><div className="product-price">{euros(product.price)}</div><button className="add-button" onClick={() => append(product)} aria-label={`Afegeix ${product.name}`} data-testid={`button-add-${product.id}`}><Plus size={17} /></button></div>) : <div className="empty-state" data-testid="empty-catalog"><Search size={23} /><div>No hem trobat cap producte.</div><small>Prova una altra cerca o afegeix-lo a mà.</small></div>}</div><form className="custom-entry" onSubmit={addCustom}><input value={customName} onChange={event => setCustomName(event.target.value)} placeholder="Un producte a mà..." aria-label="Nom del producte personalitzat" data-testid="input-custom-product-name" /><input value={customPrice} onChange={event => setCustomPrice(event.target.value)} inputMode="decimal" placeholder="Preu €" aria-label="Preu aproximat" data-testid="input-custom-product-price" /><button type="submit" className="add-button" aria-label="Afegeix producte personalitzat" data-testid="button-add-custom"><Plus size={18} /></button></form></section>
    <section className="card panel reveal-delay" aria-label="Llista editable"><div className="panel-head"><h2 className="panel-title">La vostra llista</h2><span className="list-count" data-testid="text-list-item-count">{list.items.length} articles</span></div><div className="list-top"><input className="title-input" value={titleDraft} onChange={event => setTitleDraft(event.target.value)} onBlur={() => { const name = titleDraft.trim(); if (name && name !== list.name) onRename(name); else if (!name) setTitleDraft(list.name); }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} aria-label="Títol de la llista" data-testid="input-list-title" maxLength={80} /><Clipboard size={17} color="#8a9486" /></div><div className="list-items">{list.items.length ? list.items.map(item => <div className={`list-item ${item.checked ? 'item-checked' : ''}`} key={item.id} data-testid={`row-list-item-${item.id}`}><button className={`check-btn ${item.checked ? 'checked' : ''}`} onClick={() => onUpdate(item.id, { checked: !item.checked })} aria-label={item.checked ? `Desmarca ${item.name}` : `Marca ${item.name}`} data-testid={`button-check-${item.id}`}>{item.checked && <Check size={14} />}</button><div className="item-main"><div className="item-name">{item.name}</div><div className="item-detail">{euros(item.price)} / {item.unit} · {euros(item.price * item.quantity)}</div></div><div className="qty-controls"><button className="qty-btn" onClick={() => item.quantity > 1 ? onUpdate(item.id, { quantity: item.quantity - 1 }) : setConfirmDeleteId(item.id)} aria-label={`Redueix ${item.name}`} data-testid={`button-quantity-minus-${item.id}`}><Minus size={13} /></button><span className="qty-number" data-testid={`text-quantity-${item.id}`}>{item.quantity}</span><button className="qty-btn" onClick={() => onUpdate(item.id, { quantity: item.quantity + 1 })} aria-label={`Augmenta ${item.name}`} data-testid={`button-quantity-plus-${item.id}`}><Plus size={13} /></button><button className="remove-btn" onClick={() => setConfirmDeleteId(item.id)} aria-label={`Elimina ${item.name}`} data-testid={`button-remove-${item.id}`}><X size={16} /></button></div></div>) : <div className="empty-state" data-testid="empty-shopping-list"><ShoppingBasket size={25} /><div>La llista encara és buida.</div><small>Afegeix-hi els primers productes des del catàleg.</small></div>}</div><div className="list-footer"><div><div className="total-label">Total orientatiu</div><div className="total-value" data-testid="text-list-total">{euros(total)}</div></div><button className="clear-btn" onClick={onClear} data-testid="button-clear-checked"><Trash2 size={14} /> Neteja els marcats</button></div></section>
  </div>{confirmDeleteItem && <div className="dialog-backdrop" role="presentation"><section className="confirm-dialog card" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div className="eyebrow">Eliminar producte</div><h2 id="delete-dialog-title">Vols treure “{confirmDeleteItem.name}”?</h2><p>Aquest canvi també es veurà a la llista compartida.</p><div className="dialog-actions"><button className="button button-line" onClick={() => setConfirmDeleteId('')} data-testid="button-cancel-delete-item">Cancel·la</button><button className="button delete-confirm" onClick={() => { onDelete(confirmDeleteItem.id); setConfirmDeleteId(''); }} data-testid="button-confirm-delete-item">Elimina</button></div></section></div>}</>;
}

function OfflineSnapshot({ list, retry }: { list: ShoppingList; retry: () => void }) {
  const total = list.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  return <section className="card offline-snapshot" data-testid="offline-list-snapshot">
    <div className="offline-icon"><CloudOff size={22} /></div>
    <div className="eyebrow">Còpia local</div>
    <h1>{list.name}</h1>
    <p>No hem pogut connectar amb la llista compartida. Aquesta és la darrera còpia desada en aquest dispositiu; és només de lectura fins que es recuperi la connexió.</p>
    <button className="button button-primary" onClick={retry} data-testid="button-retry-offline-list"><RefreshCw size={16} /> Torna-ho a provar</button>
    <div className="offline-items">{list.items.length ? list.items.map(item => <div className={`list-item ${item.checked ? 'item-checked' : ''}`} key={item.id}><span className={`check-btn${item.checked ? ' checked' : ''}`}>{item.checked && <Check size={14} />}</span><div className="item-main"><div className="item-name">{item.name}</div><div className="item-detail">{item.quantity} × {item.unit}</div></div><div className="product-price">{euros(item.price * item.quantity)}</div></div>) : <div className="empty-state">La còpia local no conté cap article.</div>}</div>
    <div className="offline-total"><span>{list.items.filter(item => item.checked).length} marcats</span><strong>Total orientatiu · {euros(total)}</strong></div>
  </section>;
}

function ProfilePage({ list, summaries, total, checkedCount, inviteUrl, onInvite, onCopyInvite, invitePending, shareWhatsapp, shareMail, shareNative, shareInstagram }: {
  list?: ShoppingList; summaries: ShoppingListSummary[]; total: number; checkedCount: number; inviteUrl: string; onInvite: () => void; onCopyInvite: () => void; invitePending: boolean;
  shareWhatsapp: () => void; shareMail: () => void; shareNative: () => void; shareInstagram: () => void;
}) {
  if (!list) return <section className="card empty-lists"><div className="empty-basket"><Users size={25} /></div><div className="eyebrow">Un lloc per a tothom</div><h2>Tria o crea una llista</h2><p>Fes servir el selector de dalt per veure una llista compartida.</p><Link href="/compra" className="button button-primary" data-testid="link-profile-to-shopping">Ves a la compra <ArrowRight size={16} /></Link><small>{summaries.length} llistes disponibles</small></section>;
  const count = list.items.length; const pending = count - checkedCount;
  return <><div className="page-heading reveal"><div><div className="eyebrow">Tot a punt</div><h1>El vostre resum</h1></div><Link href="/compra" className="button button-quiet" data-testid="link-edit-list"><ShoppingCart size={17} /> Edita la llista</Link></div><div className="profile-grid"><div className="reveal"><section className="card profile-card"><div className="profile-icon"><CircleUserRound size={28} /></div><div className="eyebrow">La llista compartida</div><h2 data-testid="text-profile-list-name">{list.name}</h2><p>Una llista per tenir-ho tot a mà i coordinar la propera compra. Els canvis de tothom s’hi veuen al moment.</p><div className="profile-members" data-testid="text-profile-member-count"><Users size={16} /><strong>{list.memberCount}</strong> {list.memberCount === 1 ? 'persona' : 'persones'} amb accés</div></section><section className="summary-head" style={{ marginTop: 15 }}><h2>La compra, d’un cop d’ull</h2><p>El resum s’actualitza amb la vostra llista.</p></section><div className="stats"><article className="card stat"><div className="stat-label">Articles</div><div className="stat-value" data-testid="text-summary-items">{count}</div><div className="stat-note">a la llista</div></article><article className="card stat"><div className="stat-label">Per comprar</div><div className="stat-value" data-testid="text-summary-pending">{pending}</div><div className="stat-note">encara pendents</div></article><article className="card stat"><div className="stat-label">Total orientatiu</div><div className="stat-value" data-testid="text-summary-total">{euros(total)}</div><div className="stat-note">preu aproximat</div></article></div></div>
    <div className="reveal-delay"><section className="card share-panel invite-panel"><div className="invite-icon"><Link2 size={18} /></div><h3>Convideu a la llista</h3><p>L’enllaç dona accés a aquesta llista compartida. Envia’l només a qui vulguis que pugui veure i editar la compra.</p><button className="button button-primary invite-button" onClick={onInvite} disabled={invitePending} data-testid="button-create-invite">{invitePending ? <LoaderCircle className="spin" size={16} /> : <Share2 size={16} />}{invitePending ? 'Preparant enllaç…' : 'Crea un enllaç d’invitació'}</button>{inviteUrl && <div className="invite-link-box"><label htmlFor="invite-url">Enllaç d’invitació</label><div><input id="invite-url" readOnly value={inviteUrl} data-testid="input-invite-url" /><button className="copy-invite" onClick={onCopyInvite} aria-label="Copia l’enllaç d’invitació" data-testid="button-copy-invite"><Copy size={17} /></button></div><small>Qui tingui l’enllaç podrà entrar amb el seu compte (o crear-ne un) i editar la llista durant 7 dies.</small></div>}<div className="share-divider"><span>O comparteix el resum</span></div><div className="share-options"><button className="share-option" onClick={shareWhatsapp} data-testid="button-share-whatsapp"><Share2 size={18} />WhatsApp</button><button className="share-option" onClick={shareMail} data-testid="button-share-email"><Mail size={18} />Correu</button><button className="share-option" onClick={shareInstagram} data-testid="button-share-instagram"><Copy size={18} />Instagram</button><button className="share-option" onClick={shareNative} data-testid="button-share-native"><Share2 size={18} />Més opcions</button></div></section><section className="card share-panel" style={{ marginTop: 15 }}><div className="panel-head" style={{ marginBottom: 12 }}><h3 style={{ margin: 0 }}>A la llista</h3><span className="list-count" data-testid="text-profile-checked">{checkedCount} fets</span></div>{list.items.length ? <div className="product-list">{list.items.map(item => <div className="product-row" key={item.id} data-testid={`profile-item-${item.id}`}><div className="product-dot">{item.checked ? <Check size={17} /> : <ShoppingBasket size={16} />}</div><div className="product-info"><div className="product-name">{item.name}</div><div className="product-meta">{item.quantity} × {item.unit}{item.checked ? ' · Fet' : ''}</div></div><div className="product-price">{euros(item.price * item.quantity)}</div></div>)}</div> : <div className="empty-state" data-testid="empty-profile-list"><ShoppingBasket size={24} /><div>Encara no hi ha cap article.</div></div>}</section></div></div></>;
}

function JoinPage() {
  const { token } = useParams<{ token: string }>(); const [, setLocation] = useLocation(); const queryClient = useQueryClient(); const acceptance = useAcceptShoppingListInvite();
  const [started, setStarted] = useState(false);
  const accept = () => { if (!token || started) return; setStarted(true); acceptance.mutate({ data: { token } }, { onSuccess: joinedList => { localStorage.setItem('llista-selected-id', joinedList.id); void queryClient.invalidateQueries({ queryKey: getGetShoppingListsQueryKey() }); void queryClient.invalidateQueries({ queryKey: getGetShoppingListQueryKey(joinedList.id) }); setLocation('/compra'); }, onError: () => setStarted(false) }); };
  return <><Show when="signed-in"><div className="app-shell"><div className="grain" aria-hidden="true" /><header className="topbar"><Link href="/" className="brand" data-testid="link-join-brand"><span className="brand-mark"><ShoppingBasket size={20} /></span><span className="brand-name">llista compartida</span></Link></header><main className="join-wrap"><section className="card join-card"><div className="join-illustration"><Users size={26} /><span>+</span><ShoppingBasket size={27} /></div><div className="eyebrow">T’han convidat</div><h1>La compra és cosa de tots.</h1><p>En unir-te, podràs veure i editar aquesta llista juntament amb les altres persones que hi tenen accés.</p><button className="button button-primary" onClick={accept} disabled={acceptance.isPending || started} data-testid="button-accept-invite">{acceptance.isPending ? 'Unint-te…' : 'Uneix-me a la llista'} <ArrowRight size={16} /></button>{acceptance.isError && <p className="inline-error" role="alert" data-testid="text-invite-error">Aquest enllaç no és vàlid o ja ha caducat. Demana una invitació nova.</p>}<Link href="/compra" className="text-link" data-testid="link-join-cancel">Torna a les meves llistes</Link></section></main></div></Show><Show when="signed-out"><Redirect to={`/sign-in?redirect_url=${encodeURIComponent(`${window.location.origin}${basePath}/join/${token ?? ''}`)}`} /></Show></>;
}
function NotFound() { return <main className="not-found"><div className="eyebrow">404 · Pàgina no trobada</div><h1>Aquesta llista no hi és.</h1><Link href="/" className="button button-primary" data-testid="link-not-found-home">Torna a l’inici</Link></main>; }
function iconForCategory(category: string) { if (category.includes('verdura')) return <Flower2 size={17} />; if (category === 'Forn') return <Wheat size={17} />; if (category === 'Làctics i ous') return <Egg size={17} />; return <ShoppingBasket size={16} />; }
export default App;
