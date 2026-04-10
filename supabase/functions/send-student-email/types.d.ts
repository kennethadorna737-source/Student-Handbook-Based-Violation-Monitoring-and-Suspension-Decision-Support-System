declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

declare module "https://esm.sh/@supabase/supabase-js@2" {
  export function createClient(url: string, key: string, options?: unknown): any;
}

// SMTP types
declare module "https://deno.land/x/smtp@v0.5.1/mod.ts" {
  export class SMTPClient {
    constructor();
    connect(host: string, port: number): Promise<void>;
    login(user: string, pass: string): Promise<void>;
    sendMessage(options: {from: string, to: string[], subject: string, text: string}): Promise<void>;
    quit(): Promise<void>;
  }
}
