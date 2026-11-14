import React, { useEffect, useState } from 'react';
import { Trash2, MapPin, Trophy, FileText, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  subscribeUserCreations,
  subscribeUserPlaces,
  subscribeUserScores,
  deleteCreation,
  deletePinnedPlace,
} from '../lib/firebase';
import type { GameScore, SavedCreation, SavedPlace } from '../types/studio';

export function LibraryWorkspace() {
  const { user, authReady, signInWithGoogle } = useAuth();
  const [creations, setCreations] = useState<SavedCreation[]>([]);
  const [places, setPlaces] = useState<SavedPlace[]>([]);
  const [scores, setScores] = useState<GameScore[]>([]);
  const [filterKind, setFilterKind] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authReady || !user) {
      setCreations([]);
      setPlaces([]);
      setScores([]);
      return;
    }

    const unsubCreations = subscribeUserCreations(user.uid, setCreations, (err) =>
      setError(err instanceof Error ? err.message : 'Failed to load creations.')
    );
    const unsubPlaces = subscribeUserPlaces(user.uid, setPlaces, (err) =>
      setError(err instanceof Error ? err.message : 'Failed to load pinned places.')
    );
    const unsubScores = subscribeUserScores(user.uid, setScores, (err) =>
      setError(err instanceof Error ? err.message : 'Failed to load game scores.')
    );

    return () => {
      unsubCreations();
      unsubPlaces();
      unsubScores();
    };
  }, [authReady, user]);

  if (!user) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center max-w-lg mx-auto my-8">
        <h2 className="text-lg font-semibold text-slate-900">Sign in to access your Library</h2>
        <p className="text-sm text-slate-600 mt-2">
          Your saved research notes, transcripts, pinned Google Maps locations, and Orbital Relay scores are stored securely per account in Cloud Firestore.
        </p>
        <button
          type="button"
          onClick={signInWithGoogle}
          className="mt-5 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 inline-flex items-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          Sign in with Google
        </button>
      </div>
    );
  }

  const filteredCreations =
    filterKind === 'all' ? creations : creations.filter((c) => c.kind === filterKind);

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          {error}
        </div>
      )}

      {/* Saved Creations */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Saved Notes, Transcripts & Prompts
            </h2>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {[
              { id: 'all', label: 'All' },
              { id: 'research', label: 'Research' },
              { id: 'transcript', label: 'Transcripts' },
              { id: 'image_prompt', label: 'Images' },
              { id: 'video_prompt', label: 'Video' },
              { id: 'music_prompt', label: 'Music' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterKind(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  filterKind === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filteredCreations.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No saved items yet. Save outputs from Assistant or Media Lab to persist them here.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredCreations.map((item) => (
              <div key={item.id} className="p-5 flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-slate-700">
                      {item.kind.replace('_', ' ')}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-[11px]">{item.modelUsed}</span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{item.title}</h3>
                  <p className="text-xs text-slate-600 whitespace-pre-wrap line-clamp-3">
                    {item.content}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteCreation(item.id)}
                  title="Delete entry"
                  className="p-2 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saved Places */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Pinned Map Places</h2>
          </div>

          {places.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No pinned locations yet. Search and save a location in Geo Explorer.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {places.map((p) => (
                <div key={p.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs text-slate-600 mt-0.5">{p.address}</div>
                    <div className="text-[11px] font-mono text-slate-500 tabular-nums mt-1">
                      {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletePinnedPlace(p.id)}
                    title="Remove pin"
                    className="p-2 text-slate-400 hover:text-red-600 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Orbital Relay High Scores */}
        <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-slate-600" />
            <h2 className="text-base font-semibold text-slate-900">Orbital Relay High Scores</h2>
          </div>

          {scores.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Play a round in Arcade Lab to record your high scores here.
            </div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Pilot</th>
                  <th className="py-2.5 px-4 font-medium text-right">Wave</th>
                  <th className="py-2.5 px-4 font-medium text-right">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scores.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{s.playerName}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {s.wave}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {s.score.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
