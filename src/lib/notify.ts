import { Resend } from 'resend';
import { prisma } from './prisma';
import { logger } from './logger';

const apiKey = process.env.RESEND_API_KEY;
// The example key in .env.example is a placeholder, not a real key
const resend = apiKey && !apiKey.startsWith('re_your') ? new Resend(apiKey) : null;
const FROM = process.env.EMAIL_FROM || 'FocusFix <support@focusfix.net>';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

async function adminRecipients(): Promise<string[]> {
  const setting = await prisma.setting.findUnique({ where: { key: 'admin_alert_emails' } });
  const raw = setting?.value || process.env.ADMIN_NOTIFICATION_EMAILS || '';
  return raw.split(',').map((e) => e.trim()).filter((e) => /.+@.+\..+/.test(e));
}

async function send(bookingId: string, template: string, to: string[], subject: string, html: string) {
  if (!resend || to.length === 0) return;
  try {
    const result = await resend.emails.send({ from: FROM, to, subject, html });
    const failed = Boolean(result.error);
    await prisma.notificationLog.createMany({
      data: to.map((recipient) => ({
        channel: 'email',
        recipient,
        template,
        status: failed ? 'failed' : 'sent',
        payload: failed ? { error: String(result.error?.message) } : { id: result.data?.id },
        booking_id: bookingId,
      })),
    });
  } catch (error) {
    logger.error({ error, template }, 'Failed to send email notification');
  }
}

/** Emails the team and the customer about a new booking. Never throws. */
export async function notifyNewBooking(bookingId: string) {
  if (!resend) return;
  try {
    const b = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, model: true, area: true, services: { include: { service: true } } },
    });
    if (!b) return;

    const date = b.slot_date.toISOString().slice(0, 10);
    const services = b.services.map((s) => escapeHtml(s.service.name_ar)).join('، ');
    const total = Number(b.estimated_total).toLocaleString('en-US');
    const rows = [
      ['رقم الحجز', b.booking_number],
      ['العميل', `${escapeHtml(b.customer.name)} — ${b.customer.phone}`],
      ['الجهاز', escapeHtml(b.model.name)],
      ['الخدمات', services],
      ['المنطقة', escapeHtml(b.area.name_ar)],
      ['العنوان', escapeHtml(b.address)],
      ['الموعد', `${date} — ${escapeHtml(b.slot_label_snapshot)}`],
      ['الإجمالي التقديري', `${total} ج.م`],
      ...(b.notes ? [['ملاحظات العميل', escapeHtml(b.notes)]] : []),
    ];
    const table = `<table dir="rtl" style="border-collapse:collapse;font-family:Tahoma,Arial,sans-serif;font-size:14px">${rows
      .map(([k, v]) => `<tr><td style="padding:6px 12px;color:#64748b">${k}</td><td style="padding:6px 12px;font-weight:bold">${v}</td></tr>`)
      .join('')}</table>`;

    await send(b.id, 'admin_new_booking', await adminRecipients(), `حجز جديد ${b.booking_number} — ${b.model.name}`, `<div dir="rtl"><h2>حجز جديد على FocusFix</h2>${table}</div>`);

    if (b.customer.email) {
      await send(
        b.id,
        'customer_booking_received',
        [b.customer.email],
        `تم استلام حجزك ${b.booking_number} — FocusFix`,
        `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif"><h2>أهلاً ${escapeHtml(b.customer.name)}،</h2><p>تم استلام طلب الصيانة بنجاح وسيتواصل معك فريق FocusFix لتأكيد الموعد.</p>${table}<p>يمكنك متابعة حالة الحجز من صفحة تتبع الطلب برقم الحجز ورقم هاتفك.</p></div>`
      );
    }
  } catch (error) {
    logger.error({ error, bookingId }, 'notifyNewBooking failed');
  }
}
