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

## أوامر التشغيل المحلية (Local)

```bash
pnpm install
cp .env.example .env
pnpm prisma:generate
pnpm prisma:migrate
pnpm seed
pnpm dev
```

## التشغيل باستخدام Docker & Docker Compose

### 1. بيئة الإنتاج / التشغيل الكامل (Production / Full Stack)
```bash
# إنشاء ملف البيئة
cp .env.example .env

# بناء وتشغيل الحاويات بالخلفية
docker compose up -d --build

# متابعة السجلات (Logs)
docker compose logs -f api
```

### 2. بيئة التطوير مع التحديث التلقائي (Development with Hot Reload)
```bash
docker compose -f docker-compose.dev.yml up --build
```

---

## أتمتة الـ CI/CD (GitHub Actions)

تم إعداد مسارات عمل تلقائية داخل مجلد `.github/workflows/`:

1. **`ci.yml`**:
   - يتم تشغيله تلقائياً عند أي Push أو Pull Request على الفروع الأساسية (`main`, `staging`, `dev`).
   - يقوم بفحص الأنواع (Typecheck)، والتحقق من بناء TypeScript، وتوليد Prisma Client، واختبار بناء الـ Docker Image.

2. **`deploy.yml`**:
   - يتم تشغيله تلقائياً عند الدمج في فرع `main` أو `staging` (أو يدوياً عبر `workflow_dispatch`).
   - يقوم ببناء الصورة ونشرها على GitHub Container Registry (`ghcr.io`).
   - يتصل بالسيرفر عبر SSH لتحديث الحاويات وإعادة تشغيلها بسلاسة عبر `docker compose`.

### أسرار الـ GitHub المطلوبة (Repository Secrets):
- `SSH_HOST`: عنوان IP الخاص بالسيرفر.
- `SSH_USER`: اسم مستخدم السيرفر (مثل `root` أو `ubuntu`).
- `SSH_PRIVATE_KEY`: المفتاح الخاص للاتصال بالسيرفر (SSH Private Key).
- `SSH_PORT`: منفذ الـ SSH (افتراضي: `22`).
- `DEPLOY_PATH`: مسار المشروع على السيرفر (افتراضي: `/var/www/focusfix-api`).
- `ENV_FILE` *(اختياري ولكن يُفضّل)*: محتوى ملف `.env` الكامل للإنتاج ليتم نسخه وتحديثه على السيرفر تلقائياً.



