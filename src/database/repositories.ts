import { db } from "./db";
import { DexieRepository } from "./repository";
import { Product, Category, SaleOrder } from "../types/pos";

/**
 * One repository per module, all built on the same DexieRepository<T, K>
 * base class. This is the single data-access pattern every module
 * (Products, Categories, Sales, and any future module) should use —
 * add a Dexie table in db.ts, then instantiate a repository for it here.
 */
export const productsRepository = new DexieRepository<Product, string>(db.products);
export const categoriesRepository = new DexieRepository<Category, string>(db.categories);
export const salesRepository = new DexieRepository<SaleOrder, string>(db.sales);
