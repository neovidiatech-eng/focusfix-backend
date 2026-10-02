import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding FocusFix database...');

  // 1. Super Admin User
  const passwordHash = await bcrypt.hash('Admin@FocusFix2026', 12);
  await prisma.user.upsert({
    where: { email: 'admin@focusfix.net' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@focusfix.net',
      password_hash: passwordHash,
      role: 'super_admin',
    },
  });

  // 2. Settings
  const settings = [
    { key: 'phone', value: '+201009911934' },
    { key: 'whatsapp', value: '201009911934' },
    { key: 'domain', value: 'https://focusfix.net' },
    { key: 'admin_domain', value: 'https://admin.focusfix.net' },
    { key: 'api_domain', value: 'https://api.focusfix.net' },
    { key: 'brand_name', value: 'FocusFix' },
    { key: 'admin_alert_emails', value: 'admin@focusfix.net' },
    { key: 'working_hours_mode', value: '12h' }, // 24h, 12h, 8h, or custom
    { key: 'working_hours_start', value: '10:00' },
    { key: 'working_hours_end', value: '18:00' },
    { key: 'working_days', value: '0,1,2,3,4' }, // Sunday - Thursday
    { key: 'slot_capacity', value: '3' },
  ];

  for (const s of settings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: s,
    });
  }

  // 3. Device Types
  const iphoneType = await prisma.deviceType.upsert({
    where: { slug: 'iphone' },
    update: {},
    create: {
      slug: 'iphone',
      name_ar: 'آيفون',
      name_en: 'iPhone',
      order: 1,
      seo_h1_ar: 'أسعار صيانة آيفون في القاهرة والجيزة — خدمة منزلية',
      intro_ar: 'صيانة فورية لجميع موديلات iPhone في منزلك مع ضمان معتمد.',
    },
  });

  const ipadType = await prisma.deviceType.upsert({
    where: { slug: 'ipad' },
    update: {},
    create: {
      slug: 'ipad',
      name_ar: 'آيباد',
      name_en: 'iPad',
      order: 2,
    },
  });

  const watchType = await prisma.deviceType.upsert({
    where: { slug: 'apple-watch' },
    update: {},
    create: {
      slug: 'apple-watch',
      name_ar: 'ساعة آبل',
      name_en: 'Apple Watch',
      order: 3,
    },
  });

  // 4. Services
  const screenService = await prisma.service.upsert({
    where: { slug: 'screen' },
    update: {},
    create: {
      slug: 'screen',
      name_ar: 'تغيير شاشة أصلية',
      name_en: 'Screen Replacement',
      estimated_minutes: 30,
      default_warranty_days: 180,
      order: 1,
    },
  });

  const batteryService = await prisma.service.upsert({
    where: { slug: 'battery' },
    update: {},
    create: {
      slug: 'battery',
      name_ar: 'تغيير بطارية أصلية',
      name_en: 'Battery Replacement',
      estimated_minutes: 25,
      default_warranty_days: 180,
      order: 2,
    },
  });

  const backService = await prisma.service.upsert({
    where: { slug: 'back-glass' },
    update: {},
    create: {
      slug: 'back-glass',
      name_ar: 'تغيير ظهر ليزر',
      name_en: 'Laser Back Glass',
      estimated_minutes: 45,
      default_warranty_days: 180,
      order: 3,
    },
  });

  // 5. Models (iPhone 16 / 15 / 14 / 13)
  const modelsData = [
    { name: 'iPhone 16 Pro Max', slug: 'iphone-16-pro-max', series: 'iPhone 16 Series', year: 2024 },
    { name: 'iPhone 16 Pro', slug: 'iphone-16-pro', series: 'iPhone 16 Series', year: 2024 },
    { name: 'iPhone 15 Pro Max', slug: 'iphone-15-pro-max', series: 'iPhone 15 Series', year: 2023 },
    { name: 'iPhone 15 Pro', slug: 'iphone-15-pro', series: 'iPhone 15 Series', year: 2023 },
    { name: 'iPhone 14 Pro Max', slug: 'iphone-14-pro-max', series: 'iPhone 14 Series', year: 2022 },
    { name: 'iPhone 13', slug: 'iphone-13', series: 'iPhone 13 Series', year: 2021 },
  ];

  for (const m of modelsData) {
    const model = await prisma.deviceModel.upsert({
      where: { slug: m.slug },
      update: {},
      create: {
        type_id: iphoneType.id,
        name: m.name,
        slug: m.slug,
        series_ar: m.series,
        release_year: m.year,
      },
    });

    // Prices for Screen & Battery
    await prisma.price.upsert({
      where: {
        model_id_service_id: { model_id: model.id, service_id: screenService.id },
      },
      update: {},
      create: {
        model_id: model.id,
        service_id: screenService.id,
        price: 9500,
        warranty_days: 180,
        status: 'available',
      },
    });

    await prisma.price.upsert({
      where: {
        model_id_service_id: { model_id: model.id, service_id: batteryService.id },
      },
      update: {},
      create: {
        model_id: model.id,
        service_id: batteryService.id,
        price: 2800,
        warranty_days: 180,
        status: 'available',
      },
    });
  }

  // 6. Areas & Transport Fees
  const areas = [
    { name_ar: 'المعادي', name_en: 'Maadi', slug: 'maadi', city_ar: 'القاهرة', fee: 0 },
    { name_ar: 'مدينة نصر', name_en: 'Nasr City', slug: 'nasr-city', city_ar: 'القاهرة', fee: 0 },
    { name_ar: 'مصر الجديدة', name_en: 'Heliopolis', slug: 'heliopolis', city_ar: 'القاهرة', fee: 0 },
    { name_ar: 'التجمع الخامس', name_en: 'New Cairo', slug: 'new-cairo', city_ar: 'القاهرة', fee: 0 },
    { name_ar: 'الدقي والمهندسين', name_en: 'Dokki', slug: 'dokki', city_ar: 'الجيزة', fee: 0 },
    { name_ar: '6 أكتوبر', name_en: '6th of October', slug: '6-october', city_ar: 'الجيزة', fee: 0 },
    { name_ar: 'الشيخ زايد', name_en: 'Sheikh Zayed', slug: 'sheikh-zayed', city_ar: 'الجيزة', fee: 0 },
  ];

  for (const a of areas) {
    const area = await prisma.area.upsert({
      where: { slug: a.slug },
      update: { transport_fee: a.fee },
      create: {
        name_ar: a.name_ar,
        name_en: a.name_en,
        slug: a.slug,
        city_ar: a.city_ar,
        transport_fee: a.fee,
      },
    });

    // Seed Slots (Morning, Afternoon, Evening)
    const slotTimes = [
      { start: '10:00', end: '13:00' },
      { start: '13:00', end: '16:00' },
      { start: '16:00', end: '19:00' },
    ];

    for (let day = 0; day <= 6; day++) {
      for (const st of slotTimes) {
        await prisma.timeSlot.create({
          data: {
            area_id: area.id,
            day_of_week: day,
            start_time: st.start,
            end_time: st.end,
            max_bookings: 3,
          },
        }).catch(() => {});
      }
    }
  }

  // 7. Seed Settings (including Top Announcement Bar)
  const defaultSettings = [
    { key: 'phone', value: '+201009911934' },
    { key: 'whatsapp', value: '201009911934' },
    { key: 'working_hours_mode', value: '12h' },
    { key: 'working_hours_start', value: '10:00' },
    { key: 'working_hours_end', value: '18:00' },
    { key: 'slot_capacity', value: '3' },
    { key: 'banner_enabled', value: 'true' },
    { key: 'banner_text', value: 'خصم حصري 15% على صيانة أجهزة آيفون اليوم + فحص فوري وقطع غيار أصلية بضمان عام كامل' },
    { key: 'banner_badge', value: 'خدمة الطوارئ متوفرة الآن 24/7' },
    { key: 'banner_link', value: '/book' },
    { key: 'banner_bg_color', value: 'amber' },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: { value: s.value },
      create: { key: s.key, value: s.value },
    });
  }

  console.log('✅ FocusFix Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
