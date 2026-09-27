# apps/mobile

Customer mobile app (iOS + Android). **Not scaffolded yet.**

Planned stack: Flutter (Dart), `nfc_manager` for NFC (NTAG 424 DNA SUN reads).
Sign-in via Google, Facebook, Apple only.

To scaffold (later), from the repo root:

```bash
flutter create --org com.dvote --project-name dvote_mobile apps/mobile
```

The typed Dart API client is generated from the backend's OpenAPI spec.
