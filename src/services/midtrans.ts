// types/midtrans-client.d.ts
declare module 'midtrans-client' {
  export interface SnapOptions {
    isProduction: boolean;
    serverKey: string;
    clientKey: string;
  }

  export interface CreateTransactionPayload {
    transaction_details: {
      order_id: string;
      gross_amount: number;
    };
    item_details?: Array<{
      id?: string;
      price: number;
      quantity: number;
      name: string;
    }>;
    customer_details?: {
      first_name?: string;
      last_name?: string;
      email?: string;
      phone?: string;
    };
    enabled_payments?: string[];
    credit_card?: { secure?: boolean };
    callbacks?: {
      finish?: string;
      pending?: string;
      error?: string;
    };
    [k: string]: any;
  }

  export interface CreateTransactionResponse {
    token: string;
    redirect_url: string;
    [k: string]: any;
  }

  export class Snap {
    constructor(options: SnapOptions);
    createTransaction(
      payload: CreateTransactionPayload
    ): Promise<CreateTransactionResponse>;
  }

  const _default: { Snap: typeof Snap };
  export default _default;
}
