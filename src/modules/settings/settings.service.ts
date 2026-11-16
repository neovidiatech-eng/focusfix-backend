import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';
import { HttpError } from '../../lib/errors';

// Custom tracking code injected into every page of the site (like WordPress "Insert Headers and Footers")
export const CODE_KEYS = { head: 'code_head', body: 'code_body_open', footer: 'code_footer' } as const;
const CODE_MAX_LENGTH = 50_000;

// The Google Tag Manager container the site shipped with, now editable from the dashboard
const DEFAULT_CODE_HEAD = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-5VTRPS8J');</script>
<!-- End Google Tag Manager -->`;
const DEFAULT_CODE_BODY = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-5VTRPS8J"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

export class SettingsService {
  private defaultSettings: Record<string, string> = {
    phone: '+201009911934',
    whatsapp: '201009911934',
    domain: 'https://focusfix.net',
    supportEmail: 'support@focusfix.net',
    brandName: 'FocusFix',
    working_hours_mode: '12h',
    working_hours_start: '10:00',
    working_hours_end: '18:00',
    slot_capacity: '3',
    booking_days_ahead: '7',
    banner_enabled: 'true',
    banner_text: 'خصم حصري 15% على صيانة أجهزة آيفون اليوم + فحص فوري وقطع غيار أصلية بضمان عام كامل',
    banner_text_en: 'Exclusive 15% OFF iPhone repairs today + instant inspection & genuine parts with 1-Year warranty',
    banner_badge: 'خدمة الطوارئ متوفرة الآن 24/7',
    banner_badge_en: 'Emergency 24/7 Service Available',
    banner_link: '/book',
    banner_bg_color: 'from-amber-500 via-amber-400 to-amber-500',
    [CODE_KEYS.head]: DEFAULT_CODE_HEAD,
    [CODE_KEYS.body]: DEFAULT_CODE_BODY,
    [CODE_KEYS.footer]: '',
  };

  // Staff-only settings that must never reach the public website
  private privateKeys = new Set(['admin_alert_emails']);

  async getPublicSettings(): Promise<Record<string, string>> {
    const settings = (await prisma.setting.findMany()).filter((s) => !this.privateKeys.has(s.key));
    const settingsMap = { ...this.defaultSettings };
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return settingsMap;
  }

  async getAllSettings() {
    return prisma.setting.findMany();
  }

  async getCodes() {
    const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(CODE_KEYS) } } });
    const value = (key: string) => rows.find((r) => r.key === key)?.value ?? this.defaultSettings[key];
    return { head: value(CODE_KEYS.head), body: value(CODE_KEYS.body), footer: value(CODE_KEYS.footer) };
  }

  async updateCodes(data: { head?: unknown; body?: unknown; footer?: unknown }, user?: { id: string }, ip?: string) {
    const entries = (Object.keys(CODE_KEYS) as Array<keyof typeof CODE_KEYS>)
      .filter((k) => data[k] !== undefined)
      .map((k) => {
        if (typeof data[k] !== 'string') throw new HttpError(400, 'الكود لازم يكون نص');
        if ((data[k] as string).length > CODE_MAX_LENGTH) throw new HttpError(400, `الكود أطول من ${CODE_MAX_LENGTH.toLocaleString('en-US')} حرف`);
        return { key: CODE_KEYS[k], value: (data[k] as string).trim() };
      });
    for (const { key, value } of entries) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    await prisma.auditLog.create({
      data: { action: 'tracking_codes_update', details: `Updated ${entries.map((e) => e.key).join(', ')}`, user_id: user?.id, ip_address: ip },
    });
    triggerRevalidation(['settings'], ['/']).catch(() => {});
    return this.getCodes();
  }

  async bulkUpdateSettings(settings: Array<{ key: string; value: string }>) {
    for (const item of settings) {
      await prisma.setting.upsert({
        where: { key: item.key },
        update: { value: String(item.value) },
        create: { key: item.key, value: String(item.value) },
      });
    }

    triggerRevalidation(['settings']).catch(() => {});
    return { success: true, count: settings.length };
  }
}

export const settingsService = new SettingsService();
