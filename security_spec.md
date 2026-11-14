# Security Specification — Meridian Studio Firestore

## 1. Data Invariants
1. Every document in `/users/{userId}` can only be read, created, updated, or deleted by the verified Firebase user whose `request.auth.uid == userId`.
2. Every document in `/creations/{creationId}`, `/places/{placeDocId}`, and `/gameScores/{scoreId}` must store `ownerId == request.auth.uid` on creation and preserve `ownerId` immutably on update.
3. All document IDs (`userId`, `creationId`, `placeDocId`, `scoreId`) must match `^[a-zA-Z0-9_\-]+$` and be <= 128 characters.
4. All timestamp fields (`createdAt`, `updatedAt`) must equal `request.time` on create/update, and `createdAt` is immutable on update.
5. All strings have strict `.size()` upper bounds matching `firebase-blueprint.json` (`title <= 160`, `content <= 8000`, `note <= 500`, `address <= 300`).
6. No unauthenticated or unverified-email writes (`request.auth.token.email_verified == true` required).

## 2. Dirty Dozen Adversarial Payloads
1. Unauthenticated read/list on `/users/uid1`. -> PERMISSION_DENIED
2. Cross-user get on `/users/otherUid` while signed in as `uid1`. -> PERMISSION_DENIED
3. Unverified email write on `/creations/c1` (`email_verified: false`). -> PERMISSION_DENIED
4. Identity spoofing: create `/creations/c1` with `ownerId: "victimUid"` as `uid1`. -> PERMISSION_DENIED
5. Shadow field injection: create `/creations/c1` with extra key `isAdmin: true`. -> PERMISSION_DENIED
6. ID poisoning: create `/creations/bad$id` with invalid characters. -> PERMISSION_DENIED
7. Resource exhaustion: create `/creations/c1` with `content` > 8000 chars. -> PERMISSION_DENIED
8. Client timestamp forgery: create `/creations/c1` with `createdAt` != `request.time`. -> PERMISSION_DENIED
9. Immutable field mutation: update `/creations/c1` changing `ownerId` or `createdAt`. -> PERMISSION_DENIED
10. Blanket list scraping: list `/creations` without `ownerId == request.auth.uid` filter. -> PERMISSION_DENIED
11. Negative/invalid score injection: create `/gameScores/s1` with `score: -50` or string score. -> PERMISSION_DENIED
12. Cross-user delete on `/places/p1` owned by `victimUid`. -> PERMISSION_DENIED
