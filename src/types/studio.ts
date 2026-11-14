export type WorkspaceTab =
  | 'assistant'
  | 'media'
  | 'studio3d'
  | 'maps'
  | 'arcade'
  | 'library';

export type ChatModel =
  | 'gemini-4-hydrogen'
  | 'gemini-3.1-flash-lite'
  | 'gemini-4-argon'
  | 'gemini-4-carbon';

export type GroundingMode = 'none' | 'search' | 'maps';

export interface GroundingSource {
  type: 'web' | 'maps';
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  sources?: GroundingSource[];
  groundingNote?: string;
  timestamp: number;
}

export type CreationKind =
  | 'research'
  | 'transcript'
  | 'image_prompt'
  | 'video_prompt'
  | 'music_prompt'
  | 'scene_preset';

export interface SavedCreation {
  id: string;
  ownerId: string;
  kind: CreationKind;
  title: string;
  content: string;
  modelUsed: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SavedPlace {
  id: string;
  ownerId: string;
  placeId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  note?: string;
  createdAt?: unknown;
}

export interface GameScore {
  id: string;
  ownerId: string;
  playerName: string;
  score: number;
  wave: number;
  createdAt?: unknown;
}
