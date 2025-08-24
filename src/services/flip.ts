import axios from "axios";
import { Order } from "../models/orders";

// Konfigurasi API Flip
const FLIP_API_URL = "https://big.flip.id/api/v2";
const secretKey = process.env.FLIP_SECRET_KEY;

// Enkripsi Secret Key untuk header Authorization
const encodedKey = Buffer.from(`${secretKey}:`).toString("base64");

const flipApi = axios.create({
  baseURL: FLIP_API_URL,
  headers: {
    Authorization: `Basic ${encodedKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
});

export const createFlipBill = async (orderId: string, order: Order) => {
  try {
    const params = new URLSearchParams();
    params.append("title", `Pembayaran untuk Order #${orderId}`);
    params.append("type", "SINGLE");
    params.append("external_id", orderId); // ID unik untuk tagihan ini
    params.append("amount", order.totalAmount.toString());
    params.append("redirect_url", "https://website-anda.com/payment-success"); // URL tujuan setelah bayar
    params.append("callback_url", "https://website-anda.com/payment-callback"); // URL untuk notifikasi
    // Tambahkan parameter lain jika perlu (misal: expired_date, customer details)
    // ...
    params.append(
      "customer_details",
      JSON.stringify({
        email: "email@customer.com",
        phone: "08123456789",
        name: "John Doe",
      })
    );

    // Lakukan permintaan POST ke API Flip untuk membuat tagihan
    const response = await flipApi.post("/pwf/bill", params);

    return response.data; // Harusnya berisi { link_url, bill_id, dll }
  } catch (error: any) {
    console.error("Error creating Flip bill:", error.response?.data);
    throw new Error("Gagal membuat tagihan pembayaran.");
  }
};
