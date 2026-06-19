export type HttpResponse = {
  data: unknown;
  headers?: Record<string, string>;
  status: number;
  url?: string;
};

export const Capacitor = {
  getPlatform: () => "web",
  isNativePlatform: () => false
};

export const CapacitorHttp = {
  request: async (): Promise<HttpResponse> => {
    throw new Error("CapacitorHttp test stub was called without a mock transport.");
  }
};
