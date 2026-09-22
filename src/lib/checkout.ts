import { supabase } from './supabase';
export type CheckoutItem = { product_id:string; variation_id?:string|null; quantity:number };
export async function secureCheckout(input:{items:CheckoutItem[];payment_method:'cod'|'stripe'|'paypal';destination_country:string;customer_name:string;customer_phone:string;shipping_address:string;city:string;notes?:string;idempotency_key?:string}) {
  const { data, error } = await supabase.functions.invoke('checkout', { body: input });
  if (error) throw error;
  return data as {order_id:string;subtotal:number;tax:number;shipping:number;total:number;currency:string};
}
