import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, Plus, Minus } from 'lucide-react';
import { useGlobalCart } from '../contexts/GlobalCartContext';
import { CrossStoreModal } from '../components/CrossStoreModal';
import { fetchStoreById, fetchProductsByStore } from '../services/storeService';
import { buildAvailableTabs, getProductCategoryKey, getProductImages, Product } from '../data/storesData';
import { ImageLightbox } from '../components/ImageLightbox';
import { DEFAULT_ITEM_KG, parseUnitToKg } from '../utils/weightUtils';

type CategoryTab = { label: string; value: string };

const clothesCategoryDefinitions: CategoryTab[] = [
  { label: 'Men', value: 'men' },
  { label: 'Women', value: 'women' },
  { label: 'Kids', value: 'kids' },
  { label: 'Shoes', value: 'shoes' },
  { label: 'Bags & Accessories', value: 'bags_and_accessories' },
  { label: 'Chitenge & Traditional Wear', value: 'chitenge_and_traditional_wear' },
  { label: 'Sportswear', value: 'sportswear' },
  { label: 'Underwear & Socks', value: 'underwear_and_socks' },
  { label: 'Other', value: 'other' },
];

const clothesCategoryKeys = new Set(clothesCategoryDefinitions.map(tab => tab.value));

const getClothesCategoryKey = (product: Product): string => {
  const key = getProductCategoryKey(product);
  return clothesCategoryKeys.has(key) ? key : 'other';
};

// Skeleton Card Component - Uber/Bolt style animated placeholder
const ProductSkeletonCard: React.FC<{ index: number }> = ({ index }) => (
  <motion.div
    className="bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.05 }}
  >
    {/* Image placeholder */}
    <div className="h-32 bg-gray-200 dark:bg-gray-700 animate-pulse" />
    
    <div className="p-3">
      {/* Product name */}
      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
      
      {/* Price and button row */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  </motion.div>
);

export const OrderClothes: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const navigate = useNavigate();
  const { cart, addToCart, decrementProduct, getProductCount, clearCart, blockedStoreAttempt, clearBlockedAttempt } = useGlobalCart();

  const [products, setProducts] = useState<Product[]>([]);
  const [storeName, setStoreName] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [lightbox, setLightbox] = useState<{ images: string[]; startIndex: number } | null>(null);
  // Product the user tried to add when blocked by the cross-store guard
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const loadStoreData = async () => {
      if (!storeId) {
        navigate('/shop', { state: { category: 'clothes' }, replace: true });
        return;
      }

      setLoading(true);
      try {
        // Fetch store details
        const store = await fetchStoreById(storeId);
        if (!store) {
          navigate('/shop', { state: { category: 'clothes' }, replace: true });
          return;
        }

        setStoreName(store.storeName);
        setStoreAddress(store.address || ''); // CRITICAL: Use store.address (Firestore field), not store.storeAddress

        // Fetch products for this store
        const storeProducts = await fetchProductsByStore(storeId);
        setProducts(storeProducts);
      } catch (error) {
        console.error('Error loading store data:', error);
        navigate('/shop', { state: { category: 'clothes' }, replace: true });
      } finally {
        setLoading(false);
      }
    };

    loadStoreData();
  }, [storeId, navigate]);

  const availableCategoryTabs = useMemo(
    () => buildAvailableTabs(products, clothesCategoryDefinitions, getClothesCategoryKey),
    [products],
  );
  const activeCategory = availableCategoryTabs.length <= 1 ||
    (selectedCategory !== 'all' && !availableCategoryTabs.some(tab => tab.value === selectedCategory))
    ? 'all'
    : selectedCategory;

  useEffect(() => {
    if (selectedCategory !== activeCategory) setSelectedCategory(activeCategory);
  }, [activeCategory, selectedCategory]);

  const visibleProducts = useMemo(
    () => activeCategory === 'all'
      ? products
      : products.filter(product => getClothesCategoryKey(product) === activeCategory),
    [products, activeCategory],
  );

  const cartCount = cart.length;
  const cartTotal = cart.reduce((sum, item) => sum + item.price, 0);

  const buildCartItem = (product: Product) => {
    const explicitKg = (product as Product & { weightKg?: number }).weightKg;
    return {
    id: `${product.id}-${Date.now()}`,
    storeId: storeId!,
    storeName: storeName,
    storeAddress: storeAddress,
    category: 'clothes' as const,
    name: product.name,
    image: product.imageUrl,
    price: product.price,
    kg: typeof explicitKg === 'number' && explicitKg > 0
      ? explicitKg
      : parseUnitToKg(product.unit, DEFAULT_ITEM_KG.clothes),
    unit: product.unit,
    };
  }

  const handleAddToCart = (product: Product) => {
    const added = addToCart(buildCartItem(product));
    if (!added) setPendingProduct(product);
  };

  const handleDecrement = (productId: string) => {
    decrementProduct(productId);
  };

  // User chose to clear the cart in the cross-store modal — clear then add the pending item
  const handleClearAndAdd = () => {
    clearCart();
    clearBlockedAttempt();
    if (pendingProduct) {
      const product = pendingProduct;
      setPendingProduct(null);
      setTimeout(() => addToCart(buildCartItem(product)), 0);
    }
  };

  const handleCancelBlocked = () => {
    clearBlockedAttempt();
    setPendingProduct(null);
  };

  const handleCompleteOrder = () => {
    if (cartCount === 0) return;
    navigate('/foodies-route');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.4 }
    }
  };

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950"
      >
        {/* Header skeleton */}
        <div className="fixed top-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2" />
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Products skeleton */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-4" style={{ marginTop: '120px' }}>
          <div className="grid grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <ProductSkeletonCard key={index} index={index} />
            ))}
          </div>
        </div>

        {/* Footer skeleton */}
        <div className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      </motion.div>
    );
  }

  if (!storeId || products.length === 0) {
    return (
      <div className="flex flex-col h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-gray-600 dark:text-gray-300 mb-4">Store not found or no items available</p>
        <button
          onClick={() => navigate(-1)}
          className="px-6 py-3 bg-[#5B2EFF] text-white rounded-2xl font-semibold hover:bg-[#4A24D9]"
        >
          Back to Shop
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950"
    >
      <div className="fixed top-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <motion.button
            onClick={() => navigate(-1)}
            whileTap={{ scale: 0.95 }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" />
          </motion.button>
          <div className="relative">
            <ShoppingCart className="w-6 h-6 text-gray-800 dark:text-gray-200" />
            {cartCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2 bg-[#5B2EFF] text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
              >
                {cartCount}
              </motion.span>
            )}
          </div>
        </div>

        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Order Clothes</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">{storeName}</h1>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex-1 overflow-y-auto px-4 pb-24 pt-4"
        style={{ marginTop: '120px' }}
      >
        {availableCategoryTabs.length > 1 && (
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Clothing categories">
            <button
              type="button"
              role="tab"
              aria-selected={activeCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${activeCategory === 'all' ? 'bg-[#5B2EFF] text-white shadow-sm' : 'bg-white text-gray-600 shadow-sm hover:bg-purple-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
            >
              All
            </button>
            {availableCategoryTabs.map(tab => (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={activeCategory === tab.value}
                onClick={() => setSelectedCategory(tab.value)}
                className={`shrink-0 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${activeCategory === tab.value ? 'bg-[#5B2EFF] text-white shadow-sm' : 'bg-white text-gray-600 shadow-sm hover:bg-purple-50 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {visibleProducts.map((product) => {
            const count = getProductCount(product.id);
            const images = getProductImages(product);

            return (
              <motion.div
                key={product.id}
                variants={itemVariants}
                whileTap={{ scale: 0.98 }}
                className={`bg-white dark:bg-gray-900 rounded-lg overflow-hidden shadow-sm transition-all ${
                  count > 0 ? 'ring-2 ring-purple-400' : ''
                }`}
              >
                <div className="relative h-32 overflow-hidden bg-gray-200 dark:bg-gray-700">
                  {images.length > 0 ? (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setLightbox({ images, startIndex: 0 });
                      }}
                      aria-label={`View ${product.name} photos`}
                      className="relative h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#5B2EFF]"
                    >
                      <img src={images[0]} alt={product.name} className="h-full w-full object-cover" />
                      {images.length > 1 && (
                        <span className="absolute bottom-2 left-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-medium text-white">
                          1/{images.length}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div className="h-full w-full bg-gray-200 dark:bg-gray-700" aria-hidden="true" />
                  )}
                  {count > 0 && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 bg-[#5B2EFF] text-white text-xs font-bold rounded-full min-w-[24px] h-6 px-1.5 flex items-center justify-center shadow"
                    >
                      {count}
                    </motion.div>
                  )}
                </div>

                <div className="p-3">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-sm mb-1">
                    {product.name}
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 min-w-0">
                      <span className="text-[#5B2EFF] font-bold text-sm">
                        K{product.price}
                      </span>
                      {product.unit && (
                        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full truncate">
                          {product.unit}
                        </span>
                      )}
                    </div>
                    {count === 0 ? (
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-[#5B2EFF] text-white hover:bg-[#4A24D9]"
                        aria-label={`Add ${product.name}`}
                      >
                        <Plus size={16} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDecrement(product.id)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600"
                          aria-label={`Remove one ${product.name}`}
                        >
                          <Minus size={16} />
                        </button>
                        <span className="text-sm font-bold text-gray-900 dark:text-white w-4 text-center">{count}</span>
                        <button
                          onClick={() => handleAddToCart(product)}
                          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors bg-[#5B2EFF] text-white hover:bg-[#4A24D9]"
                          aria-label={`Add one ${product.name}`}
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <div className="fixed bottom-0 left-0 right-0 z-10 bg-white dark:bg-gray-900 px-4 py-3 border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={handleCompleteOrder}
          disabled={cartCount === 0}
          className={`w-full py-3 rounded-lg font-semibold text-white transition-colors ${
            cartCount > 0
              ? 'bg-[#5B2EFF] hover:bg-[#4A24D9]'
              : 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed'
          }`}
        >
          Complete Order ({cartCount})
        </button>
        {cartCount > 0 && (
          <motion.div
            className="flex justify-between items-center mt-3 text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-gray-600 dark:text-gray-300">
              <span className="font-bold text-gray-900 dark:text-white">{cartCount}</span> item{cartCount !== 1 ? 's' : ''} in cart
            </span>
            <span className="font-bold text-gray-900 dark:text-white">K{cartTotal}</span>
          </motion.div>
        )}
      </div>

      <CrossStoreModal
        open={!!blockedStoreAttempt}
        currentStoreName={blockedStoreAttempt?.currentStoreName || ''}
        attemptedStoreName={blockedStoreAttempt?.attemptedStoreName || ''}
        onClearCart={handleClearAndAdd}
        onCancel={handleCancelBlocked}
        accentClassName="bg-[#5B2EFF] hover:bg-[#4A24D9]"
      />
      <AnimatePresence>
        {lightbox && (
          <ImageLightbox
            images={lightbox.images}
            startIndex={lightbox.startIndex}
            onClose={() => setLightbox(null)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};
