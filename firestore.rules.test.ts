// Phase 0 Security Rules Adversarial Test Suite Specification
// Verifies the Dirty Dozen payloads against firestore.rules expectations.

export interface AdversarialCase {
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const dirtyDozenCases: AdversarialCase[] = [
  {
    name: '1. Unauthenticated read on /users/u1',
    operation: 'get',
    path: 'users/u1',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '2. Cross-user read on /users/u2',
    operation: 'get',
    path: 'users/u2',
    auth: { uid: 'u1', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '3. Unverified email create on /creations/c1',
    operation: 'create',
    path: 'creations/c1',
    auth: { uid: 'u1', email_verified: false },
    payload: { id: 'c1', ownerId: 'u1', kind: 'research', title: 'Test', content: 'Body', modelUsed: 'gemini-4-hydrogen' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '4. Identity spoofing ownerId mismatch',
    operation: 'create',
    path: 'creations/c1',
    auth: { uid: 'u1', email_verified: true },
    payload: { id: 'c1', ownerId: 'u2', kind: 'research', title: 'Spoof', content: 'Body', modelUsed: 'gemini-4-hydrogen' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '5. Shadow field injection on /creations/c1',
    operation: 'create',
    path: 'creations/c1',
    auth: { uid: 'u1', email_verified: true },
    payload: { id: 'c1', ownerId: 'u1', kind: 'research', title: 'Test', content: 'Body', modelUsed: 'gemini-4-hydrogen', isAdmin: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '6. Invalid document ID poisoning',
    operation: 'create',
    path: 'creations/bad$id',
    auth: { uid: 'u1', email_verified: true },
    payload: { id: 'bad$id', ownerId: 'u1', kind: 'research', title: 'Test', content: 'Body', modelUsed: 'gemini-4-hydrogen' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '7. Oversized content resource exhaustion',
    operation: 'create',
    path: 'creations/c2',
    auth: { uid: 'u1', email_verified: true },
    payload: { id: 'c2', ownerId: 'u1', kind: 'research', title: 'Test', content: 'x'.repeat(8001), modelUsed: 'gemini-4-hydrogen' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '8. Forged timestamp not equal to request.time',
    operation: 'create',
    path: 'places/p1',
    auth: { uid: 'u1', email_verified: true },
    payload: { id: 'p1', ownerId: 'u1', placeId: 'ChIJ123', name: 'HQ', address: '123 Main', lat: 37.7, lng: -122.4, createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '9. Immutable ownerId mutation on update',
    operation: 'update',
    path: 'creations/c1',
    auth: { uid: 'u1', email_verified: true },
    payload: { ownerId: 'u2' },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '10. Unscoped list query across /creations',
    operation: 'list',
    path: 'creations',
    auth: { uid: 'u1', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '11. Negative score injection on /gameScores/s1',
    operation: 'create',
    path: 'gameScores/s1',
    auth: { uid: 'u1', email_verified: true },
    payload: { id: 's1', ownerId: 'u1', playerName: 'Pilot', score: -10, wave: 1 },
    expected: 'PERMISSION_DENIED',
  },
  {
    name: '12. Cross-user delete on /places/p1',
    operation: 'delete',
    path: 'places/p1',
    auth: { uid: 'u2', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
