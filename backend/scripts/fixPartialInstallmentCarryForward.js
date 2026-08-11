/*
 * Historically, an underpaid ("partial") installment just sat there with its
 * own leftover remainingAmount — unlike an overpayment, the shortfall was
 * never carried forward onto future installments. payInstallment() now does
 * that automatically going forward (see installmentController.js), but
 * installments that were already left partial before that fix need a one-off
 * retroactive correction.
 *
 * For every sale with a "partial" installment that has at least one later
 * pending/partial installment to absorb it: the shortfall is spread across
 * those future installments (growing their amount/remainingAmount, same math
 * payInstallment uses for excess re-amortization) and the partial one is
 * closed out as "paid" at the amount actually collected. A partial
 * installment with nothing after it (already the last one for its sale) is
 * left untouched, matching live payInstallment behavior.
 *
 * Sale.paidAmount/remainingAmount are untouched — this only redistributes
 * already-known balances across installment rows, no cash amounts change —
 * so no shop-ledger recalculation is needed either.
 *
 * Usage:
 *   node backend/scripts/fixPartialInstallmentCarryForward.js            (dry run)
 *   node backend/scripts/fixPartialInstallmentCarryForward.js --commit   (writes changes)
 */

const dotenv = require("dotenv");
dotenv.config();

const { getSequelize } = require("../config/db");
const sequelize = getSequelize();

const todayDate = () => new Date().toISOString().split("T")[0];

const run = async () => {
  const commit = process.argv.includes("--commit");

  await sequelize.authenticate();
  const { Installment } = require("../models");

  const partialRows = await Installment.findAll({
    where: { status: "partial" },
    attributes: ["saleId"],
    group: ["saleId"],
    raw: true,
  });

  const saleIds = partialRows.map((r) => r.saleId);

  console.log(`Sales with at least one partial installment: ${saleIds.length}`);

  const touched = [];
  let closedCount = 0;
  let skippedNoFutureCount = 0;
  let totalShortfallMoved = 0;

  for (const saleId of saleIds) {
    const installments = await Installment.findAll({
      where: { saleId },
      order: [["installmentNo", "ASC"]],
    });

    for (const inst of installments) {
      if (inst.status !== "partial") continue;

      const shortfall = Number(inst.remainingAmount || 0);
      if (shortfall <= 0) continue;

      const future = installments.filter(
        (f) =>
          f.installmentNo > inst.installmentNo &&
          ["pending", "partial"].includes(f.status)
      );

      if (future.length === 0) {
        skippedNoFutureCount += 1;
        continue;
      }

      const futureBefore = future.map((f) => ({
        installmentNo: f.installmentNo,
        amount: Number(f.amount || 0),
        remainingAmount: Number(f.remainingAmount || 0),
        status: f.status,
      }));

      const futureTotalRemaining = future.reduce(
        (sum, f) => sum + Number(f.remainingAmount || 0),
        0
      );

      const newFutureTotal = futureTotalRemaining + shortfall;
      const count = future.length;
      let allocated = 0;

      for (let i = 0; i < count; i++) {
        const f = future[i];
        const isFinalShare = i === count - 1;
        const share = isFinalShare
          ? Math.round((newFutureTotal - allocated) * 100) / 100
          : Math.round((newFutureTotal / count) * 100) / 100;

        allocated += share;

        const paidPart = Number(f.paidAmount || 0);
        f.amount = paidPart + share;
        f.remainingAmount = share;

        if (share <= 0) {
          f.remainingAmount = 0;
          f.status = "paid";
          f.paidDate = f.paidDate || todayDate();
        } else {
          f.status = paidPart > 0 ? "partial" : "pending";
        }
      }

      const instBefore = {
        installmentNo: inst.installmentNo,
        amount: Number(inst.amount || 0),
        remainingAmount: Number(inst.remainingAmount || 0),
        status: inst.status,
      };

      inst.amount = Number(inst.paidAmount || 0);
      inst.remainingAmount = 0;
      inst.status = "paid";
      inst.paidDate = inst.paidDate || todayDate();

      closedCount += 1;
      totalShortfallMoved += shortfall;

      touched.push({
        saleId,
        installmentClosed: instBefore,
        shortfall,
        futureBefore,
        futureAfter: future.map((f) => ({
          installmentNo: f.installmentNo,
          amount: f.amount,
          remainingAmount: f.remainingAmount,
          status: f.status,
        })),
      });
    }

    if (commit) {
      const dirty = installments.filter((inst) => inst.changed());

      if (dirty.length > 0) {
        const t = await sequelize.transaction();
        try {
          for (const inst of dirty) {
            await inst.save({ transaction: t });
          }
          await t.commit();
        } catch (error) {
          await t.rollback();
          console.error(`Failed to commit sale ${saleId}:`, error.message);
          throw error;
        }
      }
    }
  }

  console.log(`Partial installments closed out: ${closedCount}`);
  console.log(
    `Partial installments skipped (no future installment to carry into): ${skippedNoFutureCount}`
  );
  console.log(`Total shortfall carried forward: Rs. ${totalShortfallMoved}`);

  if (!commit) {
    console.log("\nSample corrections (up to 10):");
    touched.slice(0, 10).forEach((c) => {
      console.log(
        `  Sale #${c.saleId}: Installment #${c.installmentClosed.installmentNo} shortfall Rs. ${c.shortfall} -> closed as paid, spread across ${c.futureBefore.length} future installment(s)`
      );
    });
    console.log(
      "\nDry run only — no changes written. Re-run with --commit to apply."
    );
    return;
  }

  console.log("\nDone.");
};

run()
  .then(() => process.exit())
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
