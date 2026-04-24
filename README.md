# GridMaster ⚡

Elektrik Mühendisliği Hesap Platformu

## Kurulum

```bash
npm install
npm run dev
```

## Build (Web Sitesi)

```bash
npm run build
```
`dist/` klasörünü sunucuna at, bitti.

## Modüller

### OG (Orta Gerilim - 34.5 kV)
- **OG Gerilim Düşümü** — Radyal hat analizi, back-sweep yük hesabı
- **OG Kısa Devre** — TEİAŞ CSV yükleme, min/yaz/kış senaryo, manuel giriş
- **Trafo Hesapları** — 25-2500 kVA seçim tablosu, OG sigorta, AG CB, kablo

### AG (Alçak Gerilim - 0.4 kV)
- **AG Gerilim Düşümü** — Basit ve ağ (çoklu hat) hesabı, 380V/400V/220V
- **AG Kısa Devre** — Trafo sekonder bara ve hat sonu I₃k/I₁k hesabı ← **YENİ**

## Proje Yapısı

```
src/
├── data/           # Kablo, trafo ve TEİAŞ veritabanları
├── calculators/    # Saf hesaplama fonksiyonları (UI bağımsız)
├── components/     # Paylaşılan componentler (Sidebar, Icons)
└── modules/        # Her modülün UI'ı
```

## Flutter Entegrasyonu

Calculators klasöründeki hesap mantığı UI'dan tamamen bağımsız.
İleride bir backend API'ye taşımak veya Dart'a port etmek çok kolay.
