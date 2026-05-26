const money = (v) => Number(v || 0).toLocaleString();

const InvoicePrint = ({ sale }) => {
  if (!sale) return null;

  return (
    <div id={`invoice-print-${sale.id}`} className="bg-white text-black p-8 w-full">
      <div className="text-center border-b pb-4 mb-6">
        <img src="/logo.png" className="h-20 mx-auto mb-2" />
        <h1 className="text-2xl font-bold">Master Electronics</h1>
        <p>Sales Invoice</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <p><b>Invoice No:</b> {sale.invoiceNo}</p>
        <p><b>Date:</b> {new Date(sale.createdAt).toLocaleDateString()}</p>
        <p><b>Sale Type:</b> {sale.saleType}</p>
        <p><b>Status:</b> {sale.status}</p>
        <p><b>Customer:</b> {sale.customer?.name || "Cash Customer"}</p>
        <p><b>Phone:</b> {sale.customer?.phone || "-"}</p>
      </div>

      <table className="w-full border-collapse text-sm mb-6">
        <thead>
          <tr>
            <th className="border p-2 text-left">Product</th>
            <th className="border p-2">Qty</th>
            <th className="border p-2">Price</th>
            <th className="border p-2">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border p-2">
              {sale.product?.productName || `Product #${sale.productId}`}
            </td>
            <td className="border p-2 text-center">{sale.quantity}</td>
            <td className="border p-2 text-center">Rs. {money(sale.salePrice)}</td>
            <td className="border p-2 text-center">Rs. {money(sale.finalAmount)}</td>
          </tr>
        </tbody>
      </table>

      <div className="ml-auto w-full max-w-sm text-sm">
        <div className="flex justify-between border-b py-2">
          <b>Final Amount</b>
          <span>Rs. {money(sale.finalAmount)}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <b>Paid</b>
          <span>Rs. {money(sale.paidAmount)}</span>
        </div>
        <div className="flex justify-between border-b py-2">
          <b>Remaining</b>
          <span>Rs. {money(sale.remainingAmount)}</span>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-2 gap-10 text-center text-sm">
        <div className="border-t pt-2">Customer Signature</div>
        <div className="border-t pt-2">Authorized Signature</div>
      </div>
    </div>
  );
};

export default InvoicePrint;