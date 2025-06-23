export interface StripePrice {
    id: string;
    unit_amount: number;
    currency: string;
    recurring: {
      interval: string;
    };
    product: {
      id: string;
      name: string;
      description: string;
      metadata: any;
    };
  }
  
  export interface CheckoutSessionRequest {
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }
  
  export interface CheckoutSessionResponse {
    success: boolean;
    checkoutUrl: string;
  }

  export interface PaymentVerificationResponse {
    success: boolean;
    message: string;
    payment?: {
      status: string;
      planName: string;
      planId: number;
      amount: number;
      currency: string;
    };
    newToken?: string;
  }