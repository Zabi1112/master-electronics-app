const money = (v) => Number(v || 0).toLocaleString();

const InstallmentReceiptPrint = ({
  installment,
  sale,
  installments = [],
  payment = null,
}) => {
  if (!installment) return null;

  const amountReceivedNow = payment
    ? Number(payment.totalPaid || 0)
    : Number(installment.paidAmount || 0);

  const totalPaidTillNow = installments.reduce(
    (sum, i) => sum + Number(i.paidAmount || 0),
    0
  );

  const pendingInstallments = installments.filter(
    (i) => i.status !== "paid"
  ).length;

  const paidInstallments = installments.filter(
    (i) => i.status === "paid"
  ).length;

  return (
    <div
      id={`receipt-print-${installment.id}`}
      className="receipt-root bg-[#050505] text-white p-8 w-full rounded-[32px] border border-yellow-500/20 shadow-[0_20px_80px_rgba(0,0,0,0.35)]"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
        <div>
          <img src="/logo.png" className="h-20 mb-4" />
          <h1 className="text-3xl font-bold text-yellow-400">Master Electronics</h1>
          <p className="text-gray-400 mt-1">Installment Payment Receipt</p>
        </div>

        <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/10 px-6 py-4 text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-yellow-300 font-semibold">Receipt</p>
          <p className="text-xl font-bold mt-2">RCP-{installment.id}</p>
          <p className="text-sm text-gray-400 mt-1">{installment.paidDate || "-"}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8 text-sm">
        <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5">
          <p className="text-gray-400 uppercase tracking-[0.2em] text-[11px] mb-3">Invoice</p>
          <p className="text-white font-semibold">{sale?.invoiceNo || installment.saleId}</p>
          <p className="text-gray-400 text-sm mt-1">Installment #{installment.installmentNo}</p>
        </div>

        <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5">
          <div className="grid gap-3 text-sm text-gray-300">
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-300">Customer</p>
              <p className="mt-1">{installment.customer?.name || sale?.customer?.name || "-"}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-yellow-300">Phone</p>
              <p className="mt-1">{installment.customer?.phone || sale?.customer?.phone || "-"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5 mb-5 text-sm text-gray-300">
        <h2 className="font-bold text-white mb-3">Item / Sale Details</h2>
        <div className="grid gap-3 lg:grid-cols-2">
          <p><span className="text-gray-400">Product:</span> {(sale?.items?.length
            ? sale.items.map((i) => i.product?.productName).filter(Boolean).join(", ")
            : sale?.product?.productName) || "-"}</p>
          <p><span className="text-gray-400">Sale Type:</span> {sale?.saleType || "installment"}</p>
          <p><span className="text-gray-400">Total Item Price:</span> Rs. {money(sale?.finalAmount)}</p>
          <p><span className="text-gray-400">Total Paid Till Now:</span> Rs. {money(totalPaidTillNow || sale?.paidAmount)}</p>
          <p><span className="text-gray-400">Total Remaining:</span> Rs. {money(sale?.remainingAmount)}</p>
          <p><span className="text-gray-400">Status:</span> {sale?.status || "-"}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-yellow-500/10 bg-white/5 p-5 mb-5 text-sm">
        <table className="w-full border-separate border-spacing-0">
          <tbody>
            <tr className="text-gray-300">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Current Installment Amount</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">Rs. {money(installment.amount)}</td>
            </tr>
            <tr className="bg-yellow-500/10 text-yellow-200">
              <td className="border border-[#2b2b34] px-4 py-3 font-bold">Total Amount Received</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right font-bold">Rs. {money(amountReceivedNow)}</td>
            </tr>
            <tr className="text-gray-300">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Fine Paid</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">Rs. {money(payment ? payment.finePaid : installment.finePaid)}</td>
            </tr>
            <tr className="bg-white/5 text-gray-200">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Fine Discount</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">Rs. {money(installment.fineDiscount)}</td>
            </tr>
            <tr className="text-gray-300">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Remaining of This Installment</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">Rs. {money(installment.remainingAmount)}</td>
            </tr>
            {payment?.reamortized && (
              <tr className="bg-blue-500/10 text-blue-200">
                <td className="border border-[#2b2b34] px-4 py-3 font-semibold">
                  {payment.excessAmount > 0
                    ? `Extra Rs. ${money(payment.excessAmount)} Applied Ahead`
                    : `Shortfall Rs. ${money(Math.abs(payment.excessAmount))} Carried Forward`}
                </td>
                <td className="border border-[#2b2b34] px-4 py-3 text-right">
                  {payment.excessAmount > 0 ? "Reduced" : "Increased"} next {payment.futureCount} installment(s)
                </td>
              </tr>
            )}
            {payment?.priceReduced && (
              <tr className="bg-green-500/10 text-green-200">
                <td className="border border-[#2b2b34] px-4 py-3 font-semibold">
                  Final Sale Amount Reduced
                </td>
                <td className="border border-[#2b2b34] px-4 py-3 text-right">
                  Rs. {money(payment.priceReduced.previousFinalAmount)} → Rs. {money(payment.priceReduced.newFinalAmount)}
                </td>
              </tr>
            )}
            <tr className="bg-white/5 text-gray-200">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Paid Installments</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">{paidInstallments}</td>
            </tr>
            <tr className="text-gray-300">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Pending Installments</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">{pendingInstallments}</td>
            </tr>
            <tr className="bg-white/5 text-gray-200">
              <td className="border border-[#2b2b34] px-4 py-3 font-semibold">Due Date</td>
              <td className="border border-[#2b2b34] px-4 py-3 text-right">{installment.dueDate}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-sm mb-10 text-gray-300">
        <span className="font-semibold text-white">Notes:</span>{" "}
        {installment.installmentNo === 1
          ? "Advance received as first installment."
          : installment.notes || "-"}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-center text-sm mt-16">
        <div className="border-t border-white/10 pt-2">Customer Signature</div>
        <div className="border-t border-white/10 pt-2">Receiver Signature</div>
      </div>

      <p className="text-center text-xs mt-8 text-gray-500">
        This receipt is generated by Master Electronics system.
      </p>
    </div>
  );};

export default InstallmentReceiptPrint;