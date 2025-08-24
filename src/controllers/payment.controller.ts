import { Request, Response } from "express";
import { db } from "../utils/firebase";

export const handleFlipWebhook = async (req: Request, res: Response) => {
  const flipSignature = req.header("x-flip-signature");
  const validationToken = process.env.FLIP_VALIDATION_TOKEN;

  // 1. Verifikasi Keaslian Webhook
  if (flipSignature !== validationToken) {
    return res.status(401).send("Unauthorized");
  }

  try {
    const payload = req.body; // Payload dalam format application/json

    // 2. Proses Payload
    if (payload.event === "bill_payment.successful") {
      const billId = payload.data.bill_id;

      // Cari order dengan bill_id yang sesuai
      const orderQuery = await db
        .collection("orders")
        .where("paymentDetails.flipBillId", "==", billId)
        .limit(1)
        .get();

      if (!orderQuery.empty) {
        const orderDoc = orderQuery.docs[0];

        // 3. Update Status Order
        await orderDoc.ref.update({
          status: "processing",
          updatedAt: new Date(),
        });
        console.log(`Order ${orderDoc.id} status updated to processing.`);
      }
    }

    // 4. Kirim response OK ke Flip
    res.status(200).send("Webhook received.");
  } catch (error) {
    console.error("Error processing Flip webhook:", error);
    res.status(500).send("Internal Server Error");
  }
};
