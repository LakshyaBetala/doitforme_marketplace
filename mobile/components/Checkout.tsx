import { useMemo } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { c } from '../lib/theme';

// Razorpay order as returned by /api/payments/create-order and /api/gig/hire.
export type RazorpayOrder = {
  order_id?: string;
  orderId?: string;
  amount: number; // paise
  currency?: string;
  key_id: string;
  gig_title?: string | null;
  prefill?: { name?: string; email?: string; contact?: string };
};

export type CheckoutResult =
  | { type: 'success'; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  | { type: 'failed'; message: string }
  | { type: 'dismiss' };

// Razorpay Standard Checkout inside a WebView, same as lib/razorpayCheckout.ts on the
// website. This component decides nothing about money: the server fixed the amount when
// it created the order, and /api/payments/verify-payment re-checks the signature and
// re-reads the payment before escrow is funded.
export function Checkout({ order, onResult }: { order: RazorpayOrder | null; onResult: (r: CheckoutResult) => void }) {
  const html = useMemo(() => {
    if (!order) return '';
    const options = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      order_id: order.order_id || order.orderId,
      name: 'DoItForMe',
      description: (order.gig_title || 'Escrow funding').slice(0, 80),
      prefill: order.prefill || {},
      theme: { color: '#8825F5' },
    };
    // </ would end the script tag early; the values come from our own server, but be safe.
    const json = JSON.stringify(options).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#fff9ef"><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>
var post=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))};
window.onload=function(){
  var o=${json};
  o.handler=function(r){post({type:'success',razorpay_order_id:r.razorpay_order_id,razorpay_payment_id:r.razorpay_payment_id,razorpay_signature:r.razorpay_signature})};
  o.modal={ondismiss:function(){post({type:'dismiss'})}};
  var rzp=new Razorpay(o);
  rzp.on('payment.failed',function(r){post({type:'failed',message:(r&&r.error&&r.error.description)||'Payment failed.'})});
  rzp.open();
};
</script></body></html>`;
  }, [order]);

  return (
    <Modal visible={!!order} animationType="slide" onRequestClose={() => onResult({ type: 'dismiss' })}>
      <View style={s.wrap}>
        <View style={s.bar}>
          <Text style={s.title}>Secure payment</Text>
          <Pressable onPress={() => onResult({ type: 'dismiss' })} hitSlop={12}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        </View>
        {order ? (
          <WebView
            originWhitelist={['*']}
            source={{ html, baseUrl: 'https://www.doitforme.in' }}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            // UPI and bank apps are opened by custom schemes (upi:, intent:, gpay:...).
            // A WebView can't load those, so hand them to the OS instead.
            onShouldStartLoadWithRequest={(req) => {
              if (/^(https?:|about:|data:|blob:)/i.test(req.url)) return true;
              void Linking.openURL(req.url).catch(() => {});
              return false;
            }}
            onMessage={(e) => {
              try {
                onResult(JSON.parse(e.nativeEvent.data));
              } catch {
                /* ignore malformed messages */
              }
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: c.page, paddingTop: 36 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  title: { color: c.inkStrong, fontSize: 17, fontWeight: '700' },
  cancel: { color: c.violet, fontWeight: '600' },
});
