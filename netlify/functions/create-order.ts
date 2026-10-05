// netlify/functions/create-order.ts
export async function handler(event: any) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { customerId, qrCodeId, items, customerName, address } = JSON.parse(event.body || '{}');

    // 1. Validasi Input Ketat (Poin 7)
    if (!items || !Array.isArray(items) || items.length === 0 || items.length > 50) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Keranjang belanja tidak valid' }) };
    }

    const orderId = `ord-${Date.now()}`;
    const waNumber = '6287703397035';
    let waMessage = 'Dulang, aku kangen yang anget-anget!\n\n';
    waMessage += `Order ID: ${orderId} (${qrCodeId ? String(qrCodeId).slice(0, 30) : 'Umum'})\n`;
    if (customerName) waMessage += `Nama: ${String(customerName).slice(0, 100)}\n`;
    if (address) waMessage += `Alamat: ${String(address).slice(0, 300)}\n`;

    waMessage += '\nPesanan:\n';
    let total = 0;
    for (const it of items) {
      const price = Number(it.harga) || 0;
      const qty = Math.max(1, Math.min(Number(it.qty) || 1, 999));
      const sub = price * qty;
      total += sub;
      waMessage += `• ${qty}x ${String(it.nama).slice(0, 50)} (Rp ${sub.toLocaleString('id-ID')})\n`;
    }
    waMessage += `\nTotal: Rp ${total.toLocaleString('id-ID')}\nMohon info ketersediaan sekarang yaa! 🙏`;

    const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        orderId,
        totalAmount: total,
        status: 'CREATED',
        waLink,
      }),
    };
  } catch (err: any) {
    // 2. Error Sanitization (Poin 6)
    console.error('[Error create-order]:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Terjadi kendala saat membuat pesanan, silakan coba lagi.' }),
    };
  }
}
