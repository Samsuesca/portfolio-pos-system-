import type { PaginatedResponse } from '../types/api';

/**
 * Fetch every page of a paginated endpoint and return the flattened items.
 *
 * Use when a consumer needs the COMPLETE dataset (e.g. the catalog grid groups
 * products by garment type, so a truncated page would silently drop whole
 * groups). `maxPages` is a safety stop against a broken `has_more`.
 */
export async function fetchAllPages<T>(
  fetchPage: (skip: number, limit: number) => Promise<PaginatedResponse<T>>,
  pageSize = 500,
  maxPages = 100,
): Promise<T[]> {
  const all: T[] = [];
  let skip = 0;
  for (let page = 0; page < maxPages; page++) {
    const res = await fetchPage(skip, pageSize);
    all.push(...res.items);
    if (!res.has_more || res.items.length === 0) break;
    skip += pageSize;
  }
  return all;
}

export function unwrapPaginated<T>(data: T[] | PaginatedResponse<T>): PaginatedResponse<T> {
  if (Array.isArray(data)) {
    return {
      items: data,
      total: data.length,
      skip: 0,
      limit: data.length,
      page: 1,
      total_pages: 1,
      has_more: false,
    };
  }
  return data;
}
