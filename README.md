# FocusFix API (`focusfix-api`)

الـ Backend REST API المركزي لمنصة **FocusFix** — بنمط Modular Monolith لخدمة الموقع العام (`focusfix-web`) ولوحة التحكم الإدارية (`focusfix-admin`).

- **الرابط والدومين:** [https://api.focusfix.net](https://api.focusfix.net)
- **التقنيات المستخدمة:**
  - Node.js 20+ (LTS) & Express
  - TypeScript (Strict Mode)
  - PostgreSQL 16 + Prisma ORM
  - Redis + BullMQ (Background Jobs: Email & Outbox)
  - Zod (Input validation & OpenAPI schema)
  - Pino (Structured Logging)
  - Helmet & CORS whitelist

## الوحدات البرمجية (Modules)
- `auth`: إدارة الجلسات، التوكنات، وصلاحيات الأدمن.
- `catalog`: أنواع الأجهزة والموديلات والخدمات.
- `pricing`: مصفوفة الأسعار، الخصومات، والضمان لكل خدمة.
- `areas`: مناطق التغطية ورسوم الانتقال والمواعيد (Slots & Exceptions).
- `bookings`: خوارزمية الحجز من 4 خطوات، التحقق من السعة داخل Transaction، وتوليد كود الحجز `FM-YYYY-XXXXX`.
- `contact`: رسائل التواصل وطلبات الأسعار للموديلات والمناطق غير المدرجة.
- `blog`: إدارة المقالات ومراجعاتها ومحتوى الـ CMS.
- `settings`: إعدادات المنصة، أرقام الهواتف، وأكواد التحليلات.
- `admin`: إحصائيات KPIs، عدادات التنبيهات (Badges Polling)، وسجل التدقيق.

## أوامر التشغيل

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
pnpm dev
```
