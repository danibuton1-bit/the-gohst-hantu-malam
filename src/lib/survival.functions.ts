import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  role: z.enum(["hunter", "ghost"]),
  map: z.string().max(40),
  keys: z.number().int().min(0).max(5),
  floor: z.number().int().min(1).max(2),
  battery: z.number().min(0).max(100),
  room: z.string().max(60),
  situation: z.string().trim().min(2).max(300),
});

export const askSurvivalTip = createServerFn({ method: "POST" })
  .inputValidator((d) => Input.parse(d))
  .handler(async ({ data }) => {
    const { generateChatCompletion, GatewayError } = await import("@lovable.dev/ai-gateway");
    const roleTxt = data.role === "hunter"
      ? "PEMBURU: kumpulkan 5 kunci lalu kabur lewat gerbang keluar, hindari Kuyang. Bisa teriak, pakai senter (baterai), buka/tutup pintu (pintu menghalangi), naik lift di map hotel."
      : "HANTU KUYANG: melayang, buru dan tangkap semua pemburu sebelum waktu habis. Pemburu bisa menutup pintu dan kabur lewat lift.";
    try {
      const res = await generateChatCompletion({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `Kamu operator radio darurat di game horor "Hantu Malam". Jawab dalam bahasa Indonesia santai, maksimal 3 poin singkat (tiap poin 1 kalimat), taktis dan sesuai mekanik game. Peran pemain: ${roleTxt}` },
          { role: "user", content: `Map: ${data.map}. Ruangan: ${data.room || "-"}. Lantai: ${data.floor}. Kunci: ${data.keys}/5. Baterai senter: ${Math.round(data.battery)}%. Situasiku: ${data.situation}` },
        ],
      });
      const text = res.choices?.[0]?.message?.content;
      return { tip: typeof text === "string" && text.trim() ? text.trim() : "Sinyal lemah... coba lagi.", error: null as string | null };
    } catch (e) {
      console.error("survival tip failed", e);
      if (e instanceof GatewayError && e.httpStatus === 429) return { tip: null, error: "Radio sibuk, tunggu sebentar lalu coba lagi." };
      if (e instanceof GatewayError && e.httpStatus === 402) return { tip: null, error: "Kredit AI habis." };
      return { tip: null, error: "Sinyal radio terputus. Coba lagi." };
    }
  });
