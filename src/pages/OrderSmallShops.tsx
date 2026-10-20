import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Minus, Plus, ShoppingCart } from 'lucide-react';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { CrossStoreModal } from '../components/CrossStoreModal';
import { fetchProductsByStore, fetchStoreById } from '../services/storeService';
import { buildAvailableTabs, Product } from '../data/storesData';
import { DEFAULT_ITEM_KG, parseUnitToKg } from '../utils/weightUtils';

type SmallShopTab = { label: string; value: string };

const smallShopTabDefinitions: SmallShopTab[] = [
  { label: 'Groceries & Staples', value: 'groceries' },
  { label: 'Fresh Produce & Meat', value: 'fresh' },
  { label: 'Drinks', value: 'drinks' },
  { label: 'Household & Energy', value: 'household' },
  { label: 'Personal Care', value: 'personal_care' },
  { label: 'Other', value: 'other' },
];

const smallShopCategoryKeys = new Set(smallShopTabDefinitions.map(tab => tab.value));

const getSmallShopCategoryKey = (product: Product): string => {
  const key = product.foodCategory?.trim().toLowerCase();
  return key && smallShopCategoryKeys.has(key) ? key : 'other';
};

export const OrderSmallShops: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { cart, addToCart, decrementProduct, getProductCount, clearCart, blockedStoreAttempt, clearBlockedAttempt } = useGlobalCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [selectedTab, setSelectedTab] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const loadStore = async () => {
      if (!storeId) {
        navigate('/shop', { state: { category: 'small_shop' }, replace: true });
        return;
      }
      try {
        const store = await fetchStoreById(storeId);
        if (!store) {
          navigate('/shop', { state: { category: 'small_shop' }, replace: true });
          return;
        }
        setStoreName(store.storeName);
        setStoreAddress(store.address || '');
        setProducts(await fetchProductsByStore(storeId));
      } catch (error) {
        console.error('Error loading Small Shops products:', error);
        navigate('/shop', { state: { category: 'small_shop' }, replace: true });
      } finally {
        setLoading(false);
      }
    };
    void loadStore();
  }, [storeId, navigate]);

  const availableTabs = useMemo(
    () => buildAvailableTabs(products, smallShopTabDefinitions, getSmallShopCategoryKey),
    [products],
  );
  const activeTab = availableTabs.some(tab => tab.value === selectedTab)
    ? selectedTab
    : availableTabs[0]?.value ?? '';

  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some(tab => tab.value === selectedTab)) {
      setSelectedTab(availableTabs[0].value);
    }
  }, [availableTabs, selectedTab]);

  const visibleProducts = useMemo(
    () => products.filter(product => getSmallShopCategoryKey(product) === activeTab),
    [products, activeTab],
  );
  const cartCount = cart.length;
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const buildCartItem = (product: Product) => {
    const explicitKg = (product as Product & { weightKg?: number }).weightKg;
    return {
    id: `${product.id}-${Date.now()}`,
    storeId: storeId!,
    storeName,
    storeAddress,
    category: 'small_shop' as const,
    kg: typeof explicitKg === 'number' && explicitKg > 0
      ? explicitKg
      : parseUnitToKg(product.unit, DEFAULT_ITEM_KG.small_shop),
    unit: product.unit,
    name: product.name,
    image: product.imageUrl,
    price: product.price,
    };
  }

  const handleAdd = (product: Product) => {
    if (!addToCart(buildCartItem(product))) setPendingProduct(product);
  };

  const handleClearAndAdd = () => {
    clearCart();
    clearBlockedAttempt();
    if (pendingProduct) {
      const product = pendingProduct;
      setPendingProduct(null);
      setTimeout(() => addToCart(buildCartItem(product)), 0);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6 text-gray-500">Loading Small Shops...</div>;
  }

  if (!storeId || products.length === 0) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4"><p className="text-gray-600">Store not found or no items available</p><button onClick={() => navigate(-1)} className="rounded-2xl bg-purple-600 px-6 py-3 font-semibold text-white">Back to Shop</button></div>;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-screen flex-col bg-gray-50 dark:bg-gray-950">
      <header className="fixed inset-x-0 top-0 z-10 border-b border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div className="mb-3 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back"><ArrowLeft className="h-6 w-6" /></button>
          <div className="relative"><ShoppingCart className="h-6 w-6" />{cartCount > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs font-bold text-white">{cartCount}</span>}</div>
        </div>
        <p className="mb-1 text-xs text-gray-500">Small Shops</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{storeName}</h1>
        {availableTabs.length > 1 && <div className="mt-3 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Small shop categories">
          {availableTabs.map(tab => <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value} onClick={() => setSelectedTab(tab.value)} className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${activeTab === tab.value ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-600 shadow-sm hover:bg-purple-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}>{tab.label}</button>)}
        </div>}
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-24 pt-44">
        {visibleProducts.length === 0 ? <p className="py-12 text-center text-gray-500">No {availableTabs.find(tab => tab.value === activeTab)?.label.toLowerCase()} available.</p> : <div className="grid grid-cols-2 gap-4">{visibleProducts.map(product => { const count = getProductCount(product.id); return <motion.article key={product.id} whileTap={{ scale: 0.98 }} className={`overflow-hidden rounded-lg bg-white shadow-sm dark:bg-gray-900 ${count > 0 ? 'ring-2 ring-purple-400' : ''}`}><div className="relative h-32 bg-gray-200"><img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />{count > 0 && <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-purple-600 px-1.5 text-xs font-bold text-white">{count}</span>}</div><div className="p-3"><h2 className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-200">{product.name}</h2><div className="flex items-center justify-between"><span className="text-sm font-bold text-purple-600">K{product.price}{product.unit && <small className="ml-1 font-medium text-gray-500">{product.unit}</small>}</span>{count === 0 ? <button onClick={() => handleAdd(product)} className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white" aria-label={`Add ${product.name}`}><Plus size={16} /></button> : <div className="flex items-center gap-2"><button onClick={() => decrementProduct(product.id)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200" aria-label={`Remove one ${product.name}`}><Minus size={16} /></button><span className="w-4 text-center text-sm font-bold">{count}</span><button onClick={() => handleAdd(product)} className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-500 text-white" aria-label={`Add one ${product.name}`}><Plus size={16} /></button></div>}</div></div></motion.article>; })}</div>}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-100 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900"><button onClick={() => cartCount > 0 && navigate('/foodies-route')} disabled={cartCount === 0} className={`w-full rounded-lg py-3 font-semibold text-white ${cartCount > 0 ? 'bg-red-600' : 'cursor-not-allowed bg-gray-300'}`}>Complete Order ({cartCount})</button>{cartCount > 0 && <div className="mt-2 flex justify-between text-sm"><span>{cartCount} item{cartCount !== 1 ? 's' : ''} in cart</span><span className="font-bold">K{cartTotal}</span></div>}</footer>
      <CrossStoreModal open={!!blockedStoreAttempt} currentStoreName={blockedStoreAttempt?.currentStoreName || ''} attemptedStoreName={blockedStoreAttempt?.attemptedStoreName || ''} onClearCart={handleClearAndAdd} onCancel={() => { clearBlockedAttempt(); setPendingProduct(null); }} accentClassName="bg-purple-600 hover:bg-purple-700" />
    </motion.div>
  );
};

export default OrderSmallShops;
