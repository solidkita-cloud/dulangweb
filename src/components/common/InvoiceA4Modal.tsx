import React from 'react';
import { OrderRecord, StoreConfig } from '../../types';
import { BRAND } from '../../lib/constants';

interface InvoiceA4ModalProps {
  order: OrderRecord | null;
  onClose: () => void;
  storeConfig: StoreConfig;
  onShowToast: (msg: string) => void;
}

export const InvoiceA4Modal: React.FC<InvoiceA4ModalProps> = ({
  order,
  onClose,
  storeConfig,
  onShowToast,
}) => {
  if (!order) return null;

  const invoiceNumber = `INV/DULANG/${order.created_at.slice(0, 10).replace(/-/g, '')}/${order.id.replace('ORD-', '')}`;
  const formattedDate = new Date(order.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const subtotalItems = order.items.reduce((sum, it) => sum + (it.harga * it.qty), 0);
  const shippingCost = order.shipping_cost || 0;
  const isLunas = order.status === 'lunas';
  const isDP = order.status === 'dp';
  const dpAmount = order.dp_amount || 0;
  const remainingAmount = order.remaining_amount !== undefined ? order.remaining_amount : (isLunas ? 0 : order.total_price);

  const handlePrint = () => {
    window.print();
  };

  const handleShareWA = () => {
    let msg = `*📄 INVOICE RESMI DULANG INDONESIA*\n`;
    msg += `No: ${invoiceNumber}\n`;
    msg += `Tanggal: ${formattedDate}\n`;
    msg += `Kepada: Kak ${order.customer_name}\n`;
    msg += `Jadwal Kirim: ${order.delivery_schedule || 'Hari Ini (Fresh Panas)'}\n`;
    msg += `--------------------------------------\n`;
    order.items.forEach((it, idx) => {
      msg += `${idx + 1}. ${it.qty}x ${it.nama} (Rp ${(it.qty * it.harga).toLocaleString('id-ID')})\n`;
    });
    if (shippingCost > 0) {
      msg += `Ongkir Kurir: Rp ${shippingCost.toLocaleString('id-ID')}\n`;
    }
    msg += `--------------------------------------\n`;
    msg += `*TOTAL: Rp ${order.total_price.toLocaleString('id-ID')}*\n`;

    if (isDP) {
      msg += `🟡 *DP Diterima:* Rp ${dpAmount.toLocaleString('id-ID')}\n`;
      msg += `*SISA TAGIHAN:* Rp ${remainingAmount.toLocaleString('id-ID')}\n`;
      msg += `Status: *UANG MUKA (DP) DITERIMA*\n`;
    } else if (isLunas) {
      msg += `Status: *✓ LUNAS (${(order.payment_method || 'TUNAI').toUpperCase()})*\n`;
    } else {
      msg += `Status: *MENUNGGU PEMBAYARAN*\n`;
    }

    msg += `\nTerima kasih atas kepercayaannya pada Dapur Dulang Indonesia! 🙏✨`;

    const waNum = (order.customer_wa || '').replace(/\D/g, '');
    const url = waNum ? `https://wa.me/${waNum}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    onShowToast('Invoice dikirim ke WhatsApp! 📲');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      {/* Container A4 Modal */}
      <div className="bg-white rounded-[24px] max-w-3xl w-full border-2 border-[#111111] shadow-[8px_8px_0_#111111] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        
        {/* Top Control Bar (Hidden on print) */}
        <div className="print:hidden bg-[#111111] text-[#FFD700] px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#111111]">
          <div className="flex items-center gap-2">
            <span className="text-xl">📄</span>
            <div>
              <h3 className="font-hand font-bold text-lg sm:text-xl text-white leading-tight">
                Invoice & Kuitansi Resmi Instansi (A4)
              </h3>
              <p className="font-sans text-[11px] text-[#FFD700]/90">
                Format resmi berstempel untuk pesanan kantor, kampus, & hajatan.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="cursor-pointer bg-[#FFD700] hover:brightness-105 text-[#111111] px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border border-[#111111] shadow-xs flex items-center gap-1.5 transition"
            >
              <span>🖨️</span>
              <span>Cetak / PDF</span>
            </button>
            <button
              type="button"
              onClick={handleShareWA}
              className="cursor-pointer bg-[#25D366] hover:brightness-105 text-white px-3.5 py-1.5 rounded-full font-sans font-bold text-xs border border-emerald-800 shadow-xs flex items-center gap-1.5 transition"
            >
              <span>📲</span>
              <span>Kirim WA</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer text-white/70 hover:text-white px-2 py-1 text-lg font-bold ml-1"
              title="Tutup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* PRINTABLE INVOICE SHEET (Styled as standard A4 Sheet) */}
        <div className="p-6 sm:p-10 bg-white font-sans text-gray-800 max-h-[75vh] print:max-h-none overflow-y-auto print:overflow-visible print:p-0">
          <div className="border border-gray-200 print:border-none p-6 sm:p-8 rounded-[16px] print:rounded-none bg-white relative">
            
            {/* Kop Surat Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-[#111111] pb-6 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl sm:text-3xl">🥟</span>
                  <h1 className="font-hand font-extrabold text-2xl sm:text-3xl text-[#111111] tracking-wide">
                    DULANG INDONESIA
                  </h1>
                </div>
                <p className="text-xs text-gray-600 mt-1 font-medium">
                  Spesialis Risoles Lumer, Snack Box Hajatan & Katering Sidoarjo
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {storeConfig.pickupAddressNote || 'Sedati - Kabupaten Sidoarjo, Jawa Timur'} • WA: {BRAND.whatsapp}
                </p>
              </div>

              <div className="text-left sm:text-right">
                <span className="inline-block bg-[#111111] text-[#FFD700] px-3 py-1 rounded-md text-xs font-bold tracking-wider uppercase">
                  INVOICE & KUITANSI
                </span>
                <div className="font-mono text-xs text-gray-700 mt-1.5 font-bold">
                  {invoiceNumber}
                </div>
                <div className="text-xs text-gray-500">
                  Tanggal: {formattedDate}
                </div>
              </div>
            </div>

            {/* Informasi Pemesan & Pengiriman */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 my-6 text-xs bg-amber-50/40 p-4 rounded-xl border border-amber-200/60">
              <div>
                <span className="font-bold text-[#5C3D2E] block uppercase tracking-wider text-[10px]">
                  Ditujukan Kepada (Pemesan / Instansi):
                </span>
                <div className="font-bold text-sm text-[#111111] mt-1">
                  {order.customer_name}
                </div>
                {order.customer_wa && (
                  <div className="text-gray-600 mt-0.5">
                    WhatsApp: +{order.customer_wa.replace(/\D/g, '')}
                  </div>
                )}
                <div className="text-gray-600 mt-0.5">
                  Metode: {order.delivery_method === 'pickup' ? 'Ambil Sendiri di Dapur Dulang' : `Kurir Antar (${order.shipping_district || 'Sidoarjo'})`}
                </div>
              </div>

              <div className="sm:text-right">
                <span className="font-bold text-[#5C3D2E] block uppercase tracking-wider text-[10px]">
                  Jadwal Kirim / Waktu Acara:
                </span>
                <div className="font-bold text-sm text-[#111111] mt-1 text-emerald-800">
                  {order.delivery_schedule || 'Kloter Hari Ini (Fresh Panas)'}
                </div>
                {order.notes && (
                  <div className="text-gray-600 mt-1 italic text-[11px]">
                    Catatan: "{order.notes}"
                  </div>
                )}
              </div>
            </div>

            {/* Tabel Rincian Menu */}
            <div className="overflow-x-auto my-4">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-y border-gray-300 font-bold text-gray-800 uppercase text-[10px]">
                    <th className="py-2.5 px-3 w-8 text-center">No</th>
                    <th className="py-2.5 px-3">Item Menu / Rincian Paket</th>
                    <th className="py-2.5 px-3 text-center">Tipe</th>
                    <th className="py-2.5 px-3 text-center">Jumlah</th>
                    <th className="py-2.5 px-3 text-right">Harga Satuan</th>
                    <th className="py-2.5 px-3 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 font-medium">
                  {order.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="py-2.5 px-3 text-center text-gray-500">{idx + 1}</td>
                      <td className="py-2.5 px-3">
                        <strong className="text-gray-900">{it.nama}</strong>
                        {it.pilihanOpsi && (
                          <span className="text-gray-500 block text-[11px] font-normal">
                            Opsi: {it.pilihanOpsi}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          it.variantType === 'frozen' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-900'
                        }`}>
                          {it.variantType === 'frozen' ? 'Frozen' : 'Matang'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-gray-800">
                        {it.qty}x
                      </td>
                      <td className="py-2.5 px-3 text-right text-gray-600">
                        Rp {it.harga.toLocaleString('id-ID')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold text-gray-900">
                        Rp {(it.harga * it.qty).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Ringkasan Finansial & Status Cap */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t-2 border-gray-200 pt-4 mt-6 gap-6">
              
              {/* Cap Stempel Status Pembayaran */}
              <div className="flex items-center gap-4">
                {isLunas && (
                  <div className="border-3 border-emerald-600 text-emerald-700 px-4 py-2 rounded-xl rotate-[-3deg] uppercase font-bold text-sm tracking-widest flex items-center gap-2 shadow-xs bg-emerald-50/60">
                    <span className="text-xl">✓</span>
                    <div>
                      <div>LUNAS / PAID</div>
                      <div className="text-[9px] font-normal tracking-normal text-emerald-800">
                        Via {(order.payment_method || 'TUNAI').toUpperCase()}
                      </div>
                    </div>
                  </div>
                )}

                {isDP && (
                  <div className="border-3 border-amber-600 text-amber-800 px-4 py-2 rounded-xl rotate-[-2deg] uppercase font-bold text-xs tracking-wider bg-amber-50/80">
                    <div>DP DITERIMA</div>
                    <div className="text-[10px] font-bold text-amber-900">
                      Rp {dpAmount.toLocaleString('id-ID')}
                    </div>
                  </div>
                )}

                {!isLunas && !isDP && (
                  <div className="border-2 border-dashed border-gray-400 text-gray-500 px-4 py-2 rounded-xl text-xs uppercase font-bold">
                    MENUNGGU PEMBAYARAN
                  </div>
                )}

                <div className="text-[11px] text-gray-500 max-w-xs">
                  Pembayaran resmi via <strong>QRIS Dulang Indonesia</strong> (NMID: {storeConfig.qrisNmid || 'ID1020057244342'}){storeConfig.bankBCA ? ` • BCA: ${storeConfig.bankBCA}` : ''} atau Tunai di Dapur.
                </div>
              </div>

              {/* Rincian Angka */}
              <div className="w-full sm:w-64 space-y-1.5 text-xs text-right">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal Menu:</span>
                  <span className="font-semibold text-gray-800">Rp {subtotalItems.toLocaleString('id-ID')}</span>
                </div>

                {shippingCost > 0 && (
                  <div className="flex justify-between text-gray-600">
                    <span>Ongkir Kurir:</span>
                    <span className="font-semibold text-gray-800">Rp {shippingCost.toLocaleString('id-ID')}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-bold text-[#111111] border-t border-gray-300 pt-1.5">
                  <span>Total Tagihan:</span>
                  <span className="text-[#111111]">Rp {order.total_price.toLocaleString('id-ID')}</span>
                </div>

                {isDP && (
                  <>
                    <div className="flex justify-between text-amber-800 font-bold bg-amber-100/60 p-1 rounded">
                      <span>Uang Muka (DP):</span>
                      <span>- Rp {dpAmount.toLocaleString('id-ID')}</span>
                    </div>
                    <div className="flex justify-between text-rose-800 font-extrabold text-sm border-t border-amber-300 pt-1">
                      <span>Sisa Pelunasan:</span>
                      <span>Rp {remainingAmount.toLocaleString('id-ID')}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Kolom Tanda Tangan Resmi */}
            <div className="grid grid-cols-2 gap-8 pt-10 mt-6 border-t border-gray-200 text-xs">
              <div className="text-center">
                <p className="text-gray-500 mb-14">Tanda Terima / Bendahara:</p>
                <div className="border-b border-gray-400 w-44 mx-auto" />
                <p className="text-gray-600 mt-1 font-bold">({order.customer_name})</p>
              </div>

              <div className="text-center">
                <p className="text-gray-500 mb-14">Hormat Kami,</p>
                <div className="border-b border-gray-400 w-44 mx-auto" />
                <p className="text-gray-800 mt-1 font-bold">DAPUR DULANG INDONESIA</p>
              </div>
            </div>

            {/* Footer Note */}
            <div className="mt-8 pt-4 border-t border-dashed border-gray-300 text-center text-[10px] text-gray-500">
              Terima kasih atas pesanan Anda. Risoles Dulang dibuat hangat dengan bahan pilihan & higienis. 🙏✨
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
