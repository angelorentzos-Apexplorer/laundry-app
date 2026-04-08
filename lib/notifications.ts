import twilio from "twilio";

type ReadyNotificationInput = {
  customerName: string | null;
  customerPhone: string | null;
  orderId: number;
  deliveryDate?: Date | string | null;
};

function formatDate(value?: Date | string | null) {
  if (!value) return "σύντομα";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "σύντομα";
  return d.toLocaleDateString("el-GR");
}

function normalizeGreekPhone(phone: string) {
  const raw = phone.replace(/\s+/g, "").replace(/-/g, "");

  if (raw.startsWith("+")) return raw;
  if (raw.startsWith("00")) return `+${raw.slice(2)}`;
  if (raw.startsWith("69") && raw.length === 10) return `+30${raw}`;
  if (raw.startsWith("2") && raw.length === 10) return `+30${raw}`;

  return raw;
}

export async function sendReadyNotification({
  customerName,
  customerPhone,
  orderId,
  deliveryDate,
}: ReadyNotificationInput) {
  const channel = process.env.ORDER_READY_CHANNEL || "sms";

  if (!customerPhone) {
    return { ok: false, reason: "Δεν υπάρχει τηλέφωνο πελάτη." };
  }

  const message =
    `Γεια σας${customerName ? ` ${customerName}` : ""}! ` +
    `Η παραγγελία σας #${orderId} είναι έτοιμη για παραλαβή.` +
    `${deliveryDate ? ` Ημ/νία παράδοσης: ${formatDate(deliveryDate)}.` : ""} ` +
    ` Ευχαριστούμε.`;

  if (channel === "viber") {
    return {
      ok: false,
      reason:
        "Το Viber δεν έχει στηθεί ακόμα. Χρειάζεται Viber Business Messages ή bot/subscriber setup.",
    };
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

  if (!accountSid || !authToken || !messagingServiceSid) {
    return {
      ok: false,
      reason: "Λείπουν τα Twilio env variables.",
    };
  }

  const client = twilio(accountSid, authToken);

  const result = await client.messages.create({
    messagingServiceSid,
    to: normalizeGreekPhone(customerPhone),
    body: message,
  });

  return {
    ok: true,
    sid: result.sid,
    channel: "sms",
  };
}