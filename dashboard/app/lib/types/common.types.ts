/** Shared primitive types used across all domains. */

export interface ApiErrorPayload {
  status: number;
  message: string;
  endpoint: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}
