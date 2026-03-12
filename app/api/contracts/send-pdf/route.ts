import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

export const runtime = "nodejs";

const requestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(3).max(200),
  messageText: z.string().min(3).max(5000),
  fileName: z.string().min(3).max(200),
  pdfBase64: z.string().min(20),
});

const toHtml = (messageText: string): string =>
  messageText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => `<p>${line.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`)
    .join("");

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido para envio de correo." }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Falta RESEND_API_KEY en variables de entorno." },
      { status: 503 },
    );
  }

  const fromEmailRaw = process.env.CONTRACTS_FROM_EMAIL?.trim();
  if (!fromEmailRaw) {
    return NextResponse.json(
      { error: "Falta CONTRACTS_FROM_EMAIL en variables de entorno." },
      { status: 503 },
    );
  }

  const fromEmailValidation = z.string().email().safeParse(fromEmailRaw);
  if (!fromEmailValidation.success) {
    return NextResponse.json(
      { error: "CONTRACTS_FROM_EMAIL no tiene un formato de correo valido." },
      { status: 503 },
    );
  }

  const fromEmail = fromEmailValidation.data;
  const resend = new Resend(resendApiKey);

  try {
    await resend.emails.send({
      from: fromEmail,
      to: [parsed.data.to],
      subject: parsed.data.subject,
      text: parsed.data.messageText,
      html: toHtml(parsed.data.messageText),
      attachments: [
        {
          filename: parsed.data.fileName,
          content: parsed.data.pdfBase64,
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo enviar el correo con el PDF adjunto." },
      { status: 502 },
    );
  }
}
