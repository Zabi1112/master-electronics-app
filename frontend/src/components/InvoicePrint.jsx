const money = (v) => Number(v || 0).toLocaleString();

const InvoicePrint = ({ sale }) => {
  if (!sale) return null;

  return (
    <div
      id={`invoice-print-${sale.id}`}
      className="invoice-root bg-[#050505] text-white p-8 w-full rounded-[32px] border border-yellow-500/20 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
        <div>
          <img src="/logo.png" className="h-20 mb-4" />
          <h1 className="text-3xl font-bold text-yellow-400">Master Electronics</h1>
          <p className="text-gray-400 mt-1">Sales Invoice</p>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 px-6 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-yellow-300 font-semibold">Invoice</p>
          <p className="text-xl font-bold mt-2">{sale.invoiceNo}</p>
          <p className="text-sm text-gray-400 mt-1">{new Date(sale.createdAt).toLocaleDateString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8 text-sm">
        <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5">
          <p className="text-gray-400 uppercase tracking-[0.2em] text-[11px] mb-3">Bill To</p>
          <p className="text-white font-semibold">{sale.customer?.name || "Cash Customer"}</p>
          <p className="text-gray-400 text-sm mt-1">{sale.customer?.phone || "-"}</p>
          {sale.customer?.address && <p className="text-gray-400 text-sm mt-1">{sale.customer.address}</p>}
        </div>

        <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5">
          <div className="grid gap-3 text-sm text-gray-300">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-300">Sale Type</p>
              <p className="mt-1">{sale.saleType}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-300">Status</p>
              <p className="mt-1 capitalize">{sale.status}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto mb-8">
        <table className="min-w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="bg-[#111827] text-left text-gray-300">
              <th className="px-4 py-3 border border-[#2b2b34]">Product</th>
              <th className="px-4 py-3 border border-[#2b2b34] text-center">Qty</th>
              <th className="px-4 py-3 border border-[#2b2b34] text-right">Price</th>
              <th className="px-4 py-3 border border-[#2b2b34] text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="bg-white/5 text-gray-200">
              <td className="px-4 py-4 border border-[#2b2b34]">{sale.product?.productName || `Product #${sale.productId}`}</td>
              <td className="px-4 py-4 border border-[#2b2b34] text-center">{sale.quantity}</td>
              <td className="px-4 py-4 border border-[#2b2b34] text-right">Rs. {money(sale.salePrice)}</td>
              <td className="px-4 py-4 border border-[#2b2b34] text-right">Rs. {money(sale.finalAmount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
        <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5 text-sm text-gray-300">
          <p className="font-semibold text-white mb-3">Notes</p>
          <p>This invoice is issued by Master Electronics. Please keep it safe for warranty and support.</p>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-[#111827] p-5 text-sm">
          <div className="flex justify-between mb-3 text-gray-300">
            <span>Final Amount</span>
            <span className="font-semibold text-white">Rs. {money(sale.finalAmount)}</span>
          </div>
          <div className="flex justify-between mb-3 text-gray-300">
            <span>Paid</span>
            <span className="font-semibold text-white">Rs. {money(sale.paidAmount)}</span>
          </div>
          <div className="flex justify-between text-gray-300">
            <span>Remaining</span>
            <span className="font-semibold text-white">Rs. {money(sale.remainingAmount)}</span>
          </div>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-10 text-sm text-gray-300">
        <div className="border-t border-white/10 pt-3 text-center">Customer Signature</div>
        <div className="border-t border-white/10 pt-3 text-center">Authorized Signature</div>
      </div>
    </div>
  );
};

export default InvoicePrint;