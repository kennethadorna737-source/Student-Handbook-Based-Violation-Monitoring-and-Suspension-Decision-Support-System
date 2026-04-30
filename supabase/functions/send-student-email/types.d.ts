declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
  connectTls: (options: { hostname: string; port: number }) => Promise<{
    read(p: Uint8Array): Promise<number | null>;
    write(p: Uint8Array): Promise<number>;
    close(): void;
  }>;
  hostname: () => string;
};

// Global btoa polyfill declaration for base64 (Deno Deploy has atob/btoa)
declare function btoa(data: string): string;

declare module "$supabase/supabase-js" {
  export function createClient(url: string, key: string, options?: any): any;
}

declare module "@supabase/supabase-js" {
  export function createClient(url: string, key: string, options?: any): any;
}

// SMTP types (unused but kept)
declare module "https://deno.land/x/deno_smtp@0.8.1/mod.ts" {
  export class SMTPClient {
    constructor();
    connectTLS(options: { hostname: string, port: number, username: string, password: string }): Promise<void>;
    send(options: { from: string, to: string, subject: string, content: string }): Promise<void>;
    close(): Promise<void>;
  }
}

