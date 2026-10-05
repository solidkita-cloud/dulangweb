// netlify/functions/confirm-order.ts
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { orderId } = JSON.parse(event.body || '{}');
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length > 50) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Order ID wajib diisi dan valid' }) };
    }

    // According to PRD Section 7 & 14: total_orders counts COMPLETED only
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        orderId: orderId.trim(),
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
      }),
    };
  } catch (err: any) {
    console.error('[Error confirm-order]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Terjadi kendala saat memproses konfirmasi pesanan.' }),
    };
  }
}
