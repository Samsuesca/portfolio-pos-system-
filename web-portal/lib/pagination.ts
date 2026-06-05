export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  page: number;
  total_pages: number;
  has_more: boolean;
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
