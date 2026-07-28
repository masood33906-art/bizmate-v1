import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Product, Category, CartItem, SaleOrder, Customer, CustomerPayment,
  Supplier, Expense, StoreSettings, User, Notification, MainTab,
  SalesSubTab, InventorySubTab, MoreSubTab, PaymentMethod, SaleItem
} from '../types/pos';
import {
  INITIAL_PRODUCTS, INITIAL_CATEGORIES, INITIAL_CUSTOMERS,
  INITIAL_SUPPLIERS, INITIAL_SALES, INITIAL_EXPENSES,
  INITIAL_SETTINGS, INITIAL_USERS
} from '../data/initialData';
import { sounds } from '../utils/sound';
import { productsRepository, categoriesRepository, salesRepository } from '../database/repositories';

interface HeldSale {
  id: string;
  name: string;
  items: CartItem[];
  customer?: Customer;
  time: string;
}

interface POSContextType {
  // Navigation & Frame
  activeMainTab: MainTab;
  activeSalesSubTab: SalesSubTab;
  activeInventorySubTab: InventorySubTab;
  activeMoreSubTab: MoreSubTab;
  deviceView: 'phone' | 'tablet';
  showDeviceFrame: boolean;
  
  setActiveMainTab: (tab: MainTab) => void;
  setActiveSalesSubTab: (subTab: SalesSubTab) => void;
  setActiveInventorySubTab: (subTab: InventorySubTab) => void;
  setActiveMoreSubTab: (subTab: MoreSubTab) => void;
  setDeviceView: (view: 'phone' | 'tablet') => void;
  setShowDeviceFrame: (show: boolean) => void;
  navigateAndOpen: (tab: MainTab, subTab?: string) => void;

  // State
  products: Product[];
  categories: Category[];
  sales: SaleOrder[];
  customers: Customer[];
  customerPayments: CustomerPayment[];
  suppliers: Supplier[];
  expenses: Expense[];
  settings: StoreSettings;
  users: User[];
  currentUser: User;
  cart: CartItem[];
  selectedCustomer: Customer | null;
  notifications: Notification[];
  heldSales: HeldSale[];

  // Cart operations
  addToCart: (product: Product, qty?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  updateCartItemDiscount: (productId: string, discount: number, discountType: 'percentage' | 'fixed') => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  setSelectedCustomer: (customer: Customer | null) => void;
  holdSale: (name?: string) => void;
  resumeSale: (heldSaleId: string) => void;
  deleteHeldSale: (heldSaleId: string) => void;
  processCheckout: (params: { paymentMethod: PaymentMethod; amountPaid: number; notes?: string }) => SaleOrder;

  // Product & Inventory operations
  addProduct: (productData: Omit<Product, 'id'>) => Product;
  updateProduct: (product: Product) => void;
  deleteProduct: (id: string) => void;
  addStock: (productId: string, qtyToAdd: number) => void;
  addCategory: (categoryData: Omit<Category, 'id'>) => void;

  // Customer operations
  addCustomer: (custData: Omit<Customer, 'id' | 'totalDue' | 'totalPurchases'>) => Customer;
  updateCustomer: (customer: Customer) => void;
  recordCustomerPayment: (customerId: string, amount: number, paymentMethod: 'cash' | 'card' | 'upi', notes?: string) => void;

  // Supplier operations
  addSupplier: (supplierData: Omit<Supplier, 'id' | 'balanceDue'> & { balanceDue?: number }) => Supplier;
  deleteSupplier: (id: string) => void;

  // Expense operations
  addExpense: (expenseData: Omit<Expense, 'id'>) => void;

  // Returns
  processReturn: (orderId: string, itemReturns: { productId: string; quantity: number }[]) => void;

  // Settings & System
  updateSettings: (newSettings: Partial<StoreSettings>) => void;
  setCurrentUser: (user: User) => void;
  resetToSampleData: () => void;
  clearAllData: () => void;
  exportData: () => string;
  importData: (jsonData: string) => boolean;

  // Launching & Persistence State
  isLaunching: boolean;
  setIsLaunching: (launching: boolean) => void;

  // Modals state & controls
  isStoreSetupOpen: boolean;
  setIsStoreSetupOpen: (open: boolean) => void;
  isDummyDataCleared: boolean;
  setIsDummyDataCleared: (cleared: boolean) => void;
  isBarcodeModalOpen: boolean;
  setIsBarcodeModalOpen: (open: boolean) => void;
  isReceiptModalOpen: boolean;
  setIsReceiptModalOpen: (open: boolean) => void;
  currentReceiptOrder: SaleOrder | null;
  openReceiptModal: (order: SaleOrder) => void;
  
  // Quick Actions Modals
  isQuickProductModalOpen: boolean;
  setIsQuickProductModalOpen: (open: boolean) => void;
  editingProduct: Product | null;
  setEditingProduct: (product: Product | null) => void;
  isQuickStockModalOpen: boolean;
  setIsQuickStockModalOpen: (open: boolean) => void;
  selectedStockProductId: string;
  setSelectedStockProductId: (id: string) => void;
  isQuickCustomerModalOpen: boolean;
  setIsQuickCustomerModalOpen: (open: boolean) => void;

  // Helpers
  getLowStockProducts: () => Product[];
  getTodayMetrics: () => { sales: number; profit: number; ordersCount: number; lowStockCount: number };
}

const POSContext = createContext<POSContextType | undefined>(undefined);

const STORAGE_KEY = 'bizmate_pos_data_v1';

export const POSProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('dashboard');
  const [activeSalesSubTab, setActiveSalesSubTab] = useState<SalesSubTab>('billing');
  const [activeInventorySubTab, setActiveInventorySubTab] = useState<InventorySubTab>('products');
  const [activeMoreSubTab, setActiveMoreSubTab] = useState<MoreSubTab>('reports');
  
  const [deviceView, setDeviceView] = useState<'phone' | 'tablet'>('phone');
  const [showDeviceFrame, setShowDeviceFrame] = useState<boolean>(true);

  // Core domain state
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [sales, setSales] = useState<SaleOrder[]>(INITIAL_SALES);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [customerPayments, setCustomerPayments] = useState<CustomerPayment[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [settings, setSettings] = useState<StoreSettings>(INITIAL_SETTINGS);
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [currentUser, setCurrentUser] = useState<User>(INITIAL_USERS[0]);
  
  // Active POS Session state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Launching & Hydration flag
  const [isLaunching, setIsLaunching] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);

  // Modals & Store Flags
  const [isStoreSetupOpen, setIsStoreSetupOpen] = useState(() => !localStorage.getItem('bizmate_store_setup_completed'));
  const [isDummyDataCleared, setIsDummyDataCleared] = useState(() => localStorage.getItem('bizmate_dummy_cleared') === 'true');
  const [isBarcodeModalOpen, setIsBarcodeModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [currentReceiptOrder, setCurrentReceiptOrder] = useState<SaleOrder | null>(null);

  const [isQuickProductModalOpen, setIsQuickProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isQuickStockModalOpen, setIsQuickStockModalOpen] = useState(false);
  const [selectedStockProductId, setSelectedStockProductId] = useState<string>('');
  const [isQuickCustomerModalOpen, setIsQuickCustomerModalOpen] = useState(false);

  // Load from local storage on startup
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.customers) setCustomers(parsed.customers);
        if (parsed.customerPayments) setCustomerPayments(parsed.customerPayments);
        if (parsed.suppliers) setSuppliers(parsed.suppliers);
        if (parsed.expenses) setExpenses(parsed.expenses);
        if (parsed.settings) {
          const loadedSettings = parsed.settings;
          if (loadedSettings.currencySymbol === '$') {
            loadedSettings.currencySymbol = 'PKR';
          }
          setSettings(loadedSettings);
        }
        if (parsed.heldSales) setHeldSales(parsed.heldSales);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.selectedCustomer) setSelectedCustomer(parsed.selectedCustomer);
        if (parsed.activeMainTab) setActiveMainTab(parsed.activeMainTab);
        if (parsed.activeSalesSubTab) setActiveSalesSubTab(parsed.activeSalesSubTab);
        if (parsed.activeInventorySubTab) setActiveInventorySubTab(parsed.activeInventorySubTab);
        if (parsed.activeMoreSubTab) setActiveMoreSubTab(parsed.activeMoreSubTab);
        if (parsed.deviceView) setDeviceView(parsed.deviceView);
        if (parsed.currentUser) setCurrentUser(parsed.currentUser);
      }
    } catch (e) {
      console.error('Failed to parse saved POS data', e);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save complete state to local storage whenever state changes (after load)
  useEffect(() => {
    if (!isLoaded) return;
    try {
      const dataToSave = {
        customers, customerPayments,
        suppliers, expenses, settings, heldSales, cart, selectedCustomer,
        activeMainTab, activeSalesSubTab, activeInventorySubTab, activeMoreSubTab,
        deviceView, currentUser
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.error('Failed to save POS data', e);
    }
  }, [
    isLoaded, customers, customerPayments,
    suppliers, expenses, settings, heldSales, cart, selectedCustomer,
    activeMainTab, activeSalesSubTab, activeInventorySubTab, activeMoreSubTab,
    deviceView, currentUser
  ]);

  // Products, Categories & Sales modules: load from IndexedDB (Dexie) via the
  // shared repository layer on startup, seeding sample data on first run only
  // (never re-seeding after the user has intentionally cleared their data).
  useEffect(() => {
    (async () => {
      const dummyCleared = localStorage.getItem('bizmate_dummy_cleared') === 'true';
      try {
        setProducts(await productsRepository.loadOrSeed(INITIAL_PRODUCTS, !dummyCleared));
      } catch (e) {
        console.error('Failed to load products from IndexedDB', e);
      }
      try {
        setCategories(await categoriesRepository.loadOrSeed(INITIAL_CATEGORIES, !dummyCleared));
      } catch (e) {
        console.error('Failed to load categories from IndexedDB', e);
      }
      try {
        setSales(await salesRepository.loadOrSeed(INITIAL_SALES, !dummyCleared));
      } catch (e) {
        console.error('Failed to load sales from IndexedDB', e);
      }
    })();
  }, []);

  // Generate low stock notifications on mount/changes
  useEffect(() => {
    const lowStockList = products.filter(p => p.currentStock <= p.minStockLevel);
    const notifs: Notification[] = lowStockList.map(p => ({
      id: `notif-stock-${p.id}`,
      type: 'warning',
      title: 'Low Stock Alert',
      message: `${p.name} is down to ${p.currentStock} pcs (min level: ${p.minStockLevel} pcs).`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      linkTab: 'inventory'
    }));

    // Add high customer due notification if any
    const highDues = customers.filter(c => c.totalDue > 0);
    if (highDues.length > 0) {
      const totalDueSum = highDues.reduce((sum, c) => sum + c.totalDue, 0);
      notifs.push({
        id: 'notif-dues-summary',
        type: 'info',
        title: 'Outstanding Customer Dues',
        message: `${highDues.length} customers have outstanding balances totaling ${settings.currencySymbol} ${Math.round(totalDueSum)}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
        linkTab: 'sales'
      });
    }

    setNotifications(notifs);
  }, [products, customers, settings]);

  // Navigation Helper
  const navigateAndOpen = (tab: MainTab, subTab?: string) => {
    setActiveMainTab(tab);
    if (tab === 'sales' && subTab) setActiveSalesSubTab(subTab as SalesSubTab);
    if (tab === 'inventory' && subTab) setActiveInventorySubTab(subTab as InventorySubTab);
    if (tab === 'more' && subTab) setActiveMoreSubTab(subTab as MoreSubTab);
  };

  // Cart operations
  const addToCart = (product: Product, qty: number = 1) => {
    sounds.playBeep();
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        const newQty = existing.quantity + qty;
        const subtotal = newQty * existing.unitPrice - (existing.discountType === 'percentage' 
          ? (newQty * existing.unitPrice * (existing.discount / 100)) 
          : existing.discount);

        return prev.map(item => item.product.id === product.id ? {
          ...item,
          quantity: newQty,
          subtotal: Math.max(0, subtotal)
        } : item);
      } else {
        const subtotal = qty * product.sellingPrice;
        return [...prev, {
          product,
          quantity: qty,
          unitPrice: product.sellingPrice,
          discount: 0,
          discountType: 'percentage',
          subtotal
        }];
      }
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const disc = item.discountType === 'percentage' 
          ? (quantity * item.unitPrice * (item.discount / 100)) 
          : item.discount;
        const subtotal = Math.max(0, (quantity * item.unitPrice) - disc);
        return { ...item, quantity, subtotal };
      }
      return item;
    }));
  };

  const updateCartItemDiscount = (productId: string, discount: number, discountType: 'percentage' | 'fixed') => {
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        const discAmount = discountType === 'percentage' 
          ? (item.quantity * item.unitPrice * (discount / 100)) 
          : discount;
        const subtotal = Math.max(0, (item.quantity * item.unitPrice) - discAmount);
        return { ...item, discount, discountType, subtotal };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
  };

  const holdSale = (name?: string) => {
    if (cart.length === 0) return;
    const newHold: HeldSale = {
      id: `hold-${Date.now()}`,
      name: name || `Hold #${heldSales.length + 1} (${cart.length} items)`,
      items: [...cart],
      customer: selectedCustomer || undefined,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setHeldSales(prev => [newHold, ...prev]);
    clearCart();
    sounds.playAlert();
  };

  const resumeSale = (heldSaleId: string) => {
    const target = heldSales.find(h => h.id === heldSaleId);
    if (!target) return;
    setCart(target.items);
    if (target.customer) setSelectedCustomer(target.customer);
    setHeldSales(prev => prev.filter(h => h.id !== heldSaleId));
    sounds.playBeep();
  };

  const deleteHeldSale = (heldSaleId: string) => {
    setHeldSales(prev => prev.filter(h => h.id !== heldSaleId));
  };

  const openReceiptModal = (order: SaleOrder) => {
    setCurrentReceiptOrder(order);
    setIsReceiptModalOpen(true);
  };

  // Process Checkout
  const processCheckout = ({ paymentMethod, amountPaid, notes }: { paymentMethod: PaymentMethod; amountPaid: number; notes?: string }): SaleOrder => {
    const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const discountTotal = cart.reduce((sum, item) => {
      const disc = item.discountType === 'percentage'
        ? (item.quantity * item.unitPrice * (item.discount / 100))
        : item.discount;
      return sum + disc;
    }, 0);

    const taxTotal = settings.taxRate > 0 ? (subtotal - discountTotal) * (settings.taxRate / 100) : 0;
    const grandTotal = Math.max(0, subtotal - discountTotal + taxTotal);

    // Calculate total cost & profit
    let totalCost = 0;
    const saleItems: SaleItem[] = cart.map(item => {
      const itemCost = item.product.costPrice * item.quantity;
      totalCost += itemCost;
      const itemDiscount = item.discountType === 'percentage'
        ? (item.quantity * item.unitPrice * (item.discount / 100))
        : item.discount;
      return {
        productId: item.product.id,
        productName: item.product.name,
        sku: item.product.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        costPrice: item.product.costPrice,
        discount: itemDiscount,
        total: Math.max(0, (item.quantity * item.unitPrice) - itemDiscount)
      };
    });

    const profit = Math.max(0, (grandTotal - taxTotal) - totalCost);
    const dueAmount = paymentMethod === 'due' ? grandTotal : Math.max(0, grandTotal - amountPaid);

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const receiptNum = `INV-${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`;

    const newOrder: SaleOrder = {
      id: `ord-${Date.now()}`,
      receiptNumber: receiptNum,
      date: todayStr,
      timestamp: Date.now(),
      items: saleItems,
      subtotal,
      discountTotal,
      taxTotal,
      grandTotal,
      profit,
      paymentMethod,
      amountPaid: paymentMethod === 'due' ? 0 : amountPaid,
      dueAmount,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name,
      customerPhone: selectedCustomer?.phone,
      status: 'completed',
      cashierName: currentUser.name,
      notes
    };

    // Deduct stock for each item (inventory update after this sale)
    setProducts(prevProducts => {
      const updatedProducts = prevProducts.map(prod => {
        const cartMatch = cart.find(c => c.product.id === prod.id);
        if (cartMatch) {
          return {
            ...prod,
            currentStock: Math.max(0, prod.currentStock - cartMatch.quantity)
          };
        }
        return prod;
      });
      const changed = updatedProducts.filter(p => cart.some(c => c.product.id === p.id));
      if (changed.length > 0) {
        productsRepository.bulkPut(changed).catch(e => console.error('Failed to update stock in IndexedDB', e));
      }
      return updatedProducts;
    });

    // Update customer due & total purchases if customer selected
    if (selectedCustomer) {
      setCustomers(prev => prev.map(c => {
        if (c.id === selectedCustomer.id) {
          return {
            ...c,
            totalDue: c.totalDue + dueAmount,
            totalPurchases: c.totalPurchases + grandTotal,
            lastPurchaseDate: todayStr
          };
        }
        return c;
      }));
    }

    // Append to sales list and persist the new order
    setSales(prev => [newOrder, ...prev]);
    salesRepository.add(newOrder).catch(e => console.error('Failed to save sale to IndexedDB', e));

    // Play chime sound
    sounds.playSuccess();

    // Clear cart and show receipt
    clearCart();
    openReceiptModal(newOrder);

    return newOrder;
  };

  // Products & Stock operations
  const addProduct = (productData: Omit<Product, 'id'>): Product => {
    const newProduct: Product = {
      ...productData,
      id: `prod-${Date.now()}`
    };
    setProducts(prev => [newProduct, ...prev]);
    productsRepository.add(newProduct).catch(e => console.error('Failed to save product to IndexedDB', e));
    return newProduct;
  };

  const updateProduct = (updatedProduct: Product) => {
    setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
    productsRepository.put(updatedProduct).catch(e => console.error('Failed to update product in IndexedDB', e));
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    productsRepository.delete(id).catch(e => console.error('Failed to delete product from IndexedDB', e));
  };

  const addStock = (productId: string, qtyToAdd: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        const updated = { ...p, currentStock: p.currentStock + qtyToAdd };
        productsRepository.put(updated).catch(e => console.error('Failed to update stock in IndexedDB', e));
        return updated;
      }
      return p;
    }));
    sounds.playBeep();
  };

  const addCategory = (categoryData: Omit<Category, 'id'>) => {
    const newCat: Category = {
      ...categoryData,
      id: `cat-${Date.now()}`
    };
    setCategories(prev => [...prev, newCat]);
    categoriesRepository.add(newCat).catch(e => console.error('Failed to save category to IndexedDB', e));
  };

  // Customers & Dues
  const addCustomer = (custData: Omit<Customer, 'id' | 'totalDue' | 'totalPurchases'>): Customer => {
    const newCustomer: Customer = {
      ...custData,
      id: `cust-${Date.now()}`,
      totalDue: 0,
      totalPurchases: 0
    };
    setCustomers(prev => [...prev, newCustomer]);
    return newCustomer;
  };

  const updateCustomer = (updatedCust: Customer) => {
    setCustomers(prev => prev.map(c => c.id === updatedCust.id ? updatedCust : c));
  };

  const recordCustomerPayment = (customerId: string, amount: number, paymentMethod: 'cash' | 'card' | 'upi', notes?: string) => {
    const targetCustomer = customers.find(c => c.id === customerId);
    if (!targetCustomer) return;

    const receiptNumber = `PAY-${Date.now().toString().slice(-6)}`;
    const newPayment: CustomerPayment = {
      id: `pay-${Date.now()}`,
      customerId,
      customerName: targetCustomer.name,
      amount,
      paymentMethod,
      date: new Date().toISOString().split('T')[0],
      receiptNumber,
      notes
    };

    setCustomerPayments(prev => [newPayment, ...prev]);
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        return {
          ...c,
          totalDue: Math.max(0, c.totalDue - amount)
        };
      }
      return c;
    }));

    sounds.playSuccess();
  };

  // Suppliers
  const addSupplier = (supplierData: Omit<Supplier, 'id' | 'balanceDue'> & { balanceDue?: number }): Supplier => {
    const newSupplier: Supplier = {
      ...supplierData,
      id: `sup-${Date.now()}`,
      balanceDue: supplierData.balanceDue || 0
    };
    setSuppliers(prev => [...prev, newSupplier]);
    return newSupplier;
  };

  const deleteSupplier = (id: string) => {
    setSuppliers(prev => prev.filter(s => s.id !== id));
  };

  // Expense
  const addExpense = (expenseData: Omit<Expense, 'id'>) => {
    const newExpense: Expense = {
      ...expenseData,
      id: `exp-${Date.now()}`
    };
    setExpenses(prev => [newExpense, ...prev]);
  };

  // Return Processing
  const processReturn = (orderId: string, itemReturns: { productId: string; quantity: number }[]) => {
    const targetOrder = sales.find(o => o.id === orderId);
    if (!targetOrder) return;

    // Restore stock for returned items (inventory update after this return)
    setProducts(prevProducts => {
      const updatedProducts = prevProducts.map(p => {
        const retItem = itemReturns.find(r => r.productId === p.id);
        if (retItem) {
          return { ...p, currentStock: p.currentStock + retItem.quantity };
        }
        return p;
      });
      const changed = updatedProducts.filter(p => itemReturns.some(r => r.productId === p.id));
      if (changed.length > 0) {
        productsRepository.bulkPut(changed).catch(e => console.error('Failed to restore stock in IndexedDB', e));
      }
      return updatedProducts;
    });

    // Update order status and persist it
    const updatedOrder: SaleOrder = { ...targetOrder, status: 'refunded' as const };
    setSales(prev => prev.map(o => o.id === orderId ? updatedOrder : o));
    salesRepository.put(updatedOrder).catch(e => console.error('Failed to update sale in IndexedDB', e));

    sounds.playBeep();
  };

  // Settings & Reset
  const updateSettings = (newSettings: Partial<StoreSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const resetToSampleData = () => {
    setProducts(INITIAL_PRODUCTS);
    productsRepository.reset(INITIAL_PRODUCTS).catch(e => console.error('Failed to reset products in IndexedDB', e));
    setCategories(INITIAL_CATEGORIES);
    categoriesRepository.reset(INITIAL_CATEGORIES).catch(e => console.error('Failed to reset categories in IndexedDB', e));
    setSales(INITIAL_SALES);
    salesRepository.reset(INITIAL_SALES).catch(e => console.error('Failed to reset sales in IndexedDB', e));
    setCustomers(INITIAL_CUSTOMERS);
    setCustomerPayments([]);
    setSuppliers(INITIAL_SUPPLIERS);
    setExpenses(INITIAL_EXPENSES);
    setSettings(INITIAL_SETTINGS);
    setCart([]);
    setHeldSales([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('bizmate_dummy_cleared');
    setIsDummyDataCleared(false);
    sounds.playSuccess();
  };

  const clearAllData = () => {
    setProducts([]);
    productsRepository.clear().catch(e => console.error('Failed to clear products in IndexedDB', e));
    setSales([]);
    salesRepository.clear().catch(e => console.error('Failed to clear sales in IndexedDB', e));
    setCustomers([]);
    setCustomerPayments([]);
    setSuppliers([]);
    setExpenses([]);
    setCart([]);
    setHeldSales([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.setItem('bizmate_dummy_cleared', 'true');
    setIsDummyDataCleared(true);
    sounds.playSuccess();
  };

  const exportData = (): string => {
    return JSON.stringify({
      products, categories, sales, customers, customerPayments,
      suppliers, expenses, settings, heldSales
    }, null, 2);
  };

  const importData = (jsonData: string): boolean => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.products) {
        setProducts(parsed.products);
        productsRepository.reset(parsed.products).catch(e => console.error('Failed to import products into IndexedDB', e));
      }
      if (parsed.categories) {
        setCategories(parsed.categories);
        categoriesRepository.reset(parsed.categories).catch(e => console.error('Failed to import categories into IndexedDB', e));
      }
      if (parsed.sales) {
        setSales(parsed.sales);
        salesRepository.reset(parsed.sales).catch(e => console.error('Failed to import sales into IndexedDB', e));
      }
      if (parsed.customers) setCustomers(parsed.customers);
      if (parsed.customerPayments) setCustomerPayments(parsed.customerPayments);
      if (parsed.suppliers) setSuppliers(parsed.suppliers);
      if (parsed.expenses) setExpenses(parsed.expenses);
      if (parsed.settings) setSettings(parsed.settings);
      sounds.playSuccess();
      return true;
    } catch {
      return false;
    }
  };

  // Metrics Helpers
  const getLowStockProducts = () => products.filter(p => p.currentStock <= p.minStockLevel);

  const getTodayMetrics = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const todayOrders = sales.filter(s => s.date === todayStr && s.status !== 'cancelled');
    const totalSales = todayOrders.reduce((sum, o) => sum + o.grandTotal, 0);
    const totalProfit = todayOrders.reduce((sum, o) => sum + o.profit, 0);
    const lowStockCount = getLowStockProducts().length;

    return {
      sales: totalSales,
      profit: totalProfit,
      ordersCount: todayOrders.length,
      lowStockCount
    };
  };

  return (
    <POSContext.Provider value={{
      activeMainTab, setActiveMainTab,
      activeSalesSubTab, setActiveSalesSubTab,
      activeInventorySubTab, setActiveInventorySubTab,
      activeMoreSubTab, setActiveMoreSubTab,
      deviceView, setDeviceView,
      showDeviceFrame, setShowDeviceFrame,
      navigateAndOpen,
      products, categories, sales, customers, customerPayments,
      suppliers, expenses, settings, users, currentUser,
      cart, selectedCustomer, notifications, heldSales,
      addToCart, updateCartQuantity, updateCartItemDiscount, removeFromCart,
      clearCart, setSelectedCustomer, holdSale, resumeSale, deleteHeldSale, processCheckout,
      addProduct, updateProduct, deleteProduct, addStock, addCategory,
      addCustomer, updateCustomer, recordCustomerPayment,
      addSupplier, deleteSupplier,
      addExpense, processReturn, updateSettings, setCurrentUser,
      resetToSampleData, clearAllData, exportData, importData,
      isLaunching, setIsLaunching,
      isStoreSetupOpen, setIsStoreSetupOpen,
      isDummyDataCleared, setIsDummyDataCleared,
      isBarcodeModalOpen, setIsBarcodeModalOpen,
      isReceiptModalOpen, setIsReceiptModalOpen,
      currentReceiptOrder, openReceiptModal,
      isQuickProductModalOpen, setIsQuickProductModalOpen,
      editingProduct, setEditingProduct,
      isQuickStockModalOpen, setIsQuickStockModalOpen,
      selectedStockProductId, setSelectedStockProductId,
      isQuickCustomerModalOpen, setIsQuickCustomerModalOpen,
      getLowStockProducts, getTodayMetrics
    }}>
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
