import { prisma } from '../../lib/prisma';
import { triggerRevalidation } from '../../lib/revalidate';

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
    banner_enabled: 'true',
    banner_text: 'خصم حصري 15% على صيانة أجهزة آيفون اليوم + فحص فوري وقطع غيار أصلية بضمان عام كامل',
    banner_text_en: 'Exclusive 15% OFF iPhone repairs today + instant inspection & genuine parts with 1-Year warranty',
    banner_badge: 'خدمة الطوارئ متوفرة الآن 24/7',
    banner_badge_en: 'Emergency 24/7 Service Available',
    banner_link: '/book',
    banner_bg_color: 'from-amber-500 via-amber-400 to-amber-500',
  };

  async getPublicSettings(): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany();
    const settingsMap = { ...this.defaultSettings };
    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });
    return settingsMap;
  }

  async getAllSettings() {
    return prisma.setting.findMany();
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
