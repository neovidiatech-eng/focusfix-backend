/**
 * Starter catalog: every iPhone / iPad / Apple Watch model, the common repair
 * services, and Unsplash photos for each (free licence, https://unsplash.com/license).
 *
 * Safe to run on a live database (`npm run seed:catalog`):
 * - never overwrites a name, image, description or price the admin already set
 * - new model/service combinations start as "on_request" (price after inspection)
 *   until the admin enters a price in the price matrix
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Device photos are cropped square (h = w); service photos keep their landscape ratio
const u = (id: string, w = 600, square = true) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=75&w=${w}${square ? `&h=${w}` : ''}`;

const PHOTO = {
  iphone17: u('1771860886801-52d8400be525'),
  iphone17Pro: u('1759588071781-2c3ba9128497'),
  iphone16Pro: u('1726587912121-ea21fcc57ff8'),
  iphone16: u('1758186473516-c78525d63ceb'),
  iphone15Pro: u('1760708551271-05d0bc471590'),
  iphone15: u('1693822845595-862bacc31cf9'),
  iphone14Pro: u('1776093667194-7aef7f8809b1'),
  iphone14: u('1695973056909-67189edc1c9e'),
  iphone13Pro: u('1592750475338-74b7b21085ab'),
  iphone13: u('1776093667182-90fdd25fa138'),
  iphone12: u('1616410011236-7a42121dd981'),
  iphone11: u('1591337676887-a217a6970a8a'),
  iphoneX: u('1512941937669-90a1b58e7e9c'),
  ipadPro: u('1544244015-0df4b3ffc6b0'),
  ipadAir: u('1561154464-82e9adf32764'),
  ipad: u('1759820941220-fed6a1010146'),
  watch: u('1546868871-7041f2a55e12'),
  watchModel: u('1624096104992-9b4fa3a279dd'),
};

const TYPES = [
  { slug: 'iphone', image: PHOTO.iphone16Pro },
  { slug: 'ipad', image: PHOTO.ipadPro },
  { slug: 'apple-watch', image: PHOTO.watch },
];

const SERVICES = [
  { slug: 'screen', name_ar: 'تغيير شاشة أصلية', name_en: 'Screen Replacement', minutes: 30, image: u('1746005718004-1f992c399428', 1200, false), desc: 'شاشة مكسورة أو فيها خطوط أو اللمس مش مظبوط؟ بنركب شاشة أصلية ونظبط True Tone قدامك.' },
  { slug: 'battery', name_ar: 'تغيير بطارية أصلية', name_en: 'Battery Replacement', minutes: 25, image: u('1746005514011-ea00280f3b6e', 1200, false), desc: 'البطارية بتفصل بسرعة أو صحتها تحت 80%؟ بطارية أصلية جديدة والجهاز يكمل يومه.' },
  { slug: 'back-glass', name_ar: 'تغيير ظهر ليزر', name_en: 'Laser Back Glass', minutes: 45, image: u('1706972612625-d5be9a7aadd8', 1200, false), desc: 'ظهر مكسور؟ بنغيره بالليزر من غير ما نفك الجهاز كله، ويرجع شكله زي الجديد.' },
  { slug: 'camera', name_ar: 'تغيير الكاميرا الخلفية', name_en: 'Rear Camera Replacement', minutes: 40, image: u('1761435922542-f25f1c5fee5a', 1200, false), desc: 'الكاميرا مهزوزة أو مش بتفوكس أو عدستها مكسورة؟ بنغيرها بكاميرا أصلية.' },
  { slug: 'charging-port', name_ar: 'تصليح مدخل الشحن', name_en: 'Charging Port Repair', minutes: 40, image: u('1763962749726-e4ce2497879e', 1200, false), desc: 'الشاحن مش بيمسك أو بيشحن على مزاجه؟ بننضف أو نغير مدخل الشحن.' },
  { slug: 'speaker', name_ar: 'تصليح السماعة والمايك', name_en: 'Speaker & Mic Repair', minutes: 35, image: u('1764526606987-c9b7b32fc185', 1200, false), desc: 'الصوت واطي أو مش مسموع في المكالمات؟ بنصلح السماعة أو المايك.' },
  { slug: 'face-id', name_ar: 'تصليح Face ID', name_en: 'Face ID Repair', minutes: 60, image: u('1677161842229-0b8324c1e461', 1200, false), desc: 'Face ID وقف أو بيطلع رسالة خطأ؟ بنفحصه ونقولك الحل قبل أي تكلفة.' },
  { slug: 'water-damage', name_ar: 'فحص وصيانة دخول مياه', name_en: 'Water Damage Repair', minutes: 60, image: u('1765220066469-54d4efe41ca5', 1200, false), desc: 'الموبايل وقع في مية؟ اقفله فوراً وما تشحنوش، والفني يفحصه وينضف اللوحة.' },
];

type ModelSeed = { name: string; series: string; year: number; image: string };

const IPHONES: ModelSeed[] = [
  ...[['iPhone 17 Pro Max', PHOTO.iphone17], ['iPhone 17 Pro', PHOTO.iphone17Pro], ['iPhone Air', PHOTO.iphone17Pro], ['iPhone 17', PHOTO.iphone17]].map(([n, i]) => ({ name: n, series: 'iPhone 17 Series', year: 2025, image: i })),
  ...[['iPhone 16 Pro Max', PHOTO.iphone16Pro], ['iPhone 16 Pro', PHOTO.iphone16Pro], ['iPhone 16 Plus', PHOTO.iphone16], ['iPhone 16', PHOTO.iphone16]].map(([n, i]) => ({ name: n, series: 'iPhone 16 Series', year: 2024, image: i })),
  ...[['iPhone 15 Pro Max', PHOTO.iphone15Pro], ['iPhone 15 Pro', PHOTO.iphone15Pro], ['iPhone 15 Plus', PHOTO.iphone15], ['iPhone 15', PHOTO.iphone15]].map(([n, i]) => ({ name: n, series: 'iPhone 15 Series', year: 2023, image: i })),
  ...[['iPhone 14 Pro Max', PHOTO.iphone14Pro], ['iPhone 14 Pro', PHOTO.iphone14Pro], ['iPhone 14 Plus', PHOTO.iphone14], ['iPhone 14', PHOTO.iphone14]].map(([n, i]) => ({ name: n, series: 'iPhone 14 Series', year: 2022, image: i })),
  ...[['iPhone 13 Pro Max', PHOTO.iphone13Pro], ['iPhone 13 Pro', PHOTO.iphone13Pro], ['iPhone 13 mini', PHOTO.iphone13], ['iPhone 13', PHOTO.iphone13]].map(([n, i]) => ({ name: n, series: 'iPhone 13 Series', year: 2021, image: i })),
  ...['iPhone 12 Pro Max', 'iPhone 12 Pro', 'iPhone 12 mini', 'iPhone 12'].map((n) => ({ name: n, series: 'iPhone 12 Series', year: 2020, image: PHOTO.iphone12 })),
  ...[['iPhone 11 Pro Max', PHOTO.iphone13Pro], ['iPhone 11 Pro', PHOTO.iphone13Pro], ['iPhone 11', PHOTO.iphone11]].map(([n, i]) => ({ name: n, series: 'iPhone 11 Series', year: 2019, image: i })),
  ...['iPhone XS Max', 'iPhone XS', 'iPhone XR', 'iPhone X'].map((n) => ({ name: n, series: 'iPhone X Series', year: 2018, image: PHOTO.iphoneX })),
];

const IPADS: ModelSeed[] = [
  ...['iPad Pro 13 (M4)', 'iPad Pro 11 (M4)', 'iPad Pro 12.9 (6th gen)', 'iPad Pro 12.9 (5th gen)', 'iPad Pro 12.9 (4th gen)', 'iPad Pro 11 (4th gen)', 'iPad Pro 11 (3rd gen)', 'iPad Pro 11 (2nd gen)'].map((n) => ({ name: n, series: 'iPad Pro', year: 2022, image: PHOTO.ipadPro })),
  ...['iPad Air 13 (M2)', 'iPad Air 11 (M2)', 'iPad Air 5', 'iPad Air 4', 'iPad Air 3'].map((n) => ({ name: n, series: 'iPad Air', year: 2022, image: PHOTO.ipadAir })),
  ...['iPad mini 7', 'iPad mini 6'].map((n) => ({ name: n, series: 'iPad mini', year: 2021, image: PHOTO.ipad })),
  ...['iPad 10', 'iPad 9', 'iPad 8', 'iPad 7'].map((n) => ({ name: n, series: 'iPad', year: 2021, image: PHOTO.ipad })),
];

const WATCHES: ModelSeed[] = [
  ...['Apple Watch Ultra 2', 'Apple Watch Ultra'].map((n) => ({ name: n, series: 'Apple Watch Ultra', year: 2023, image: PHOTO.watchModel })),
  ...['Series 10 46mm', 'Series 10 42mm', 'Series 9 45mm', 'Series 9 41mm', 'Series 8 45mm', 'Series 8 41mm', 'Series 7 45mm', 'Series 7 41mm'].map((n) => ({ name: `Apple Watch ${n}`, series: 'Apple Watch Series 7–10', year: 2022, image: PHOTO.watchModel })),
  ...['SE 44mm', 'SE 40mm', 'Series 6 44mm', 'Series 6 40mm', 'Series 5 44mm', 'Series 5 40mm', 'Series 4 44mm', 'Series 4 40mm'].map((n) => ({ name: `Apple Watch ${n}`, series: 'Apple Watch SE & Series 4–6', year: 2020, image: PHOTO.watch })),
];

// Which services each device type offers (cells start "on_request")
const SERVICES_BY_TYPE: Record<string, string[]> = {
  iphone: ['screen', 'battery', 'back-glass', 'camera', 'charging-port', 'speaker', 'face-id', 'water-damage'],
  ipad: ['screen', 'battery', 'charging-port', 'water-damage'],
  'apple-watch': ['screen', 'battery'],
};

const slugify = (s: string) => s.toLowerCase().replace(/[()]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function seedCatalog(prisma: PrismaClient) {
  let created = { models: 0, services: 0, prices: 0, images: 0 };

  for (const t of TYPES) {
    const type = await prisma.deviceType.findUnique({ where: { slug: t.slug } });
    if (type && !type.image_url) {
      await prisma.deviceType.update({ where: { id: type.id }, data: { image_url: t.image } });
      created.images++;
    }
  }

  const services: Record<string, string> = {};
  for (const [i, s] of SERVICES.entries()) {
    const existing = await prisma.service.findUnique({ where: { slug: s.slug } });
    if (existing) {
      await prisma.service.update({
        where: { id: existing.id },
        data: {
          ...(existing.image_url ? {} : { image_url: s.image }),
          ...(existing.description_ar ? {} : { description_ar: s.desc }),
        },
      });
      services[s.slug] = existing.id;
    } else {
      const svc = await prisma.service.create({
        data: { slug: s.slug, name_ar: s.name_ar, name_en: s.name_en, estimated_minutes: s.minutes, order: i + 1, image_url: s.image, description_ar: s.desc },
      });
      services[s.slug] = svc.id;
      created.services++;
    }
  }

  const groups: Array<[string, ModelSeed[]]> = [['iphone', IPHONES], ['ipad', IPADS], ['apple-watch', WATCHES]];
  for (const [typeSlug, list] of groups) {
    const type = await prisma.deviceType.findUnique({ where: { slug: typeSlug } });
    if (!type) continue;
    for (const [order, m] of list.entries()) {
      const slug = slugify(m.name);
      const existing = await prisma.deviceModel.findUnique({ where: { slug } });
      const model = existing
        ? await prisma.deviceModel.update({
            where: { id: existing.id },
            data: { order, ...(existing.image_url ? {} : { image_url: m.image }) },
          })
        : await prisma.deviceModel.create({
            data: { type_id: type.id, name: m.name, slug, series_ar: m.series, series_en: m.series, release_year: m.year, order, image_url: m.image },
          });
      if (!existing) created.models++;
      if (!existing?.image_url) created.images++;

      for (const svcSlug of SERVICES_BY_TYPE[typeSlug] || []) {
        const serviceId = services[svcSlug];
        if (!serviceId) continue;
        const has = await prisma.price.findUnique({ where: { model_id_service_id: { model_id: model.id, service_id: serviceId } } });
        if (has) continue;
        await prisma.price.create({ data: { model_id: model.id, service_id: serviceId, status: 'on_request', price: null } });
        created.prices++;
      }
    }
  }
  // The seed writes straight to the DB, so tell the site to refresh its cached pages.
  // Inline (not src/lib/revalidate) because the production image ships prisma/ and dist/ only.
  if (process.env.REVALIDATE_SECRET) {
    await fetch(`${process.env.WEB_URL || 'https://focusfix-public.vercel.app'}/api/revalidate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': process.env.REVALIDATE_SECRET },
      body: JSON.stringify({ tags: ['catalog', 'prices', 'services'], paths: ['/', '/book', '/prices', '/services'] }),
    }).catch(() => {});
  }
  return created;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedCatalog(prisma)
    .then((r) => console.log('Catalog seeded:', r))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
