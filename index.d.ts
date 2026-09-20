export interface ClientOptions {
  baseUrl?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface CategoryScore {
  category: string;
  confidence: number | null;
}

export declare class Classification {
  query: string;
  categories: CategoryScore[];
  categoriesV2: CategoryScore[];
  filtering: CategoryScore[];
  language?: string;
  status?: number;
  total_credits?: number;
  remaining_credits?: number;
  buyer_personas?: string[];
  readonly categoryNames: string[];
  readonly primaryCategory: string | null;
  readonly iabCategories: string[];
  readonly iabV2Categories: string[];
  readonly filteringCategories: string[];
  readonly personas: string[];
  readonly remainingCredits: number | null;
  inCategory(names: string | string[]): boolean;
}

export interface ManyOptions {
  concurrency?: number;
  pauseMs?: number;
}

export interface FailedLookup {
  query: string;
  error: string;
  status: number | null;
}

export declare class CategorizationError extends Error {
  status?: number;
  body?: any;
}
export declare class AuthenticationError extends CategorizationError {}
export declare class ClassificationError extends CategorizationError {}
export declare class RateLimitError extends CategorizationError {}

export declare function normalizeQuery(input: string): string;

export declare class UrlCategorizationClient {
  constructor(apiKey: string, options?: ClientOptions);
  classify(domainOrUrl: string): Promise<Classification>;
  classifyV2(domainOrUrl: string): Promise<Classification>;
  category(domainOrUrl: string): Promise<string | null>;
  isInCategory(domainOrUrl: string, names: string | string[]): Promise<boolean>;
  classifyMany(domains: string[], options?: ManyOptions): Promise<Array<Classification | FailedLookup>>;
}

export default UrlCategorizationClient;
