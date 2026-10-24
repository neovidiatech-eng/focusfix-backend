# FocusFix Backend API

RESTful API backend for FocusFix mobile maintenance & repair platform.
Built with Node.js, Express, TypeScript, and Prisma ORM with PostgreSQL.

## المميزات والمعمارية
- بنية قائمة على الوحدات المنفصلة (Feature-Based Architecture).
- طبقة تحكم (Controllers) وطبقة خدمات (Services) منفصلة لكل وحدة.
- توثيق OpenAPI / Swagger تلقائي.
- دعم التحقق من المدخلات باستخدام Zod.
- أمان متقدم (Rate Limiting, Helmet, Secure CORS, JWT with Refresh Tokens).
- سجل تدقيق مالي وإداري (Audit Logging) لكل تغيير في الأسعار والحجوزات.

## الوحدات البرمجية الأساسية (Modules)
- `auth`: تسجيل الدخول، إصدار الرموز الأمنية (JWT & Refresh Token)، وإدارة الجلسات.
- `bookings`: دورة حياة الحجز كاملة (إنشاء، جدول مواعيد، استعلام، وتتبع الحجز).
- `pricing`: مصفوفة الأسعار، خصومات، فترات الضمان، وسجل تعديل الأسعار.
- `catalog`: تصنيف الأجهزة، الموديلات المدعومة، والخدمات المتاحة.
- `areas`: المناطق المغطاة، رسوم الانتقال، ونوافذ المواعيد المتاحة.
- `contact`: استقبال رسائل الدعم ونماذج طلب تسعير مخصص.
- `blog`: نظام مدونة ومقالات متكامل يدعم الـ SEO، التصنيفات، الوسوم، والمؤلفين.
- `settings`: إعدادات المنصة، أرقام الهواتف، وأكواد التحليلات.
- `admin`: إحصائيات KPIs، عدادات التنبيهات (Badges Polling)، وسجل التدقيق.

## أوامر التشغيل المحلية (Local)

```bash
npm install
cp .env.example .env
docker compose up -d
npx prisma generate
npx prisma db push
npm run seed
npm run dev
```

The local API runs on `http://localhost:4000` and uses PostgreSQL on port `5432` and Redis on port `6379`.

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
