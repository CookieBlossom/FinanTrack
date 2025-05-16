export interface IBaseResponse {
  success: boolean;
  message?: string;
}

export interface IDataResponse<T> extends IBaseResponse {
  data: T;
}

export interface IPaginatedResponse<T> extends IBaseResponse {
  data: T[];
  pagination: {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    hasMore: boolean;
  };
}

export interface IErrorResponse extends IBaseResponse {
  error: {
    code: string;
    message: string;
    details?: any;
  };
} 