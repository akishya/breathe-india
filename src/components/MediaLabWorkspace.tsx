import React, { useState } from 'react';
import { Image as ImageIcon, Film, Music, Upload, Download, Bookmark, Sparkles, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { saveCreation } from '../lib/firebase';

type MediaTab = 'images' | 'video' | 'music';

async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : '';
      resolve({
        base64,
        mimeType: file.type || 'image/png',
        dataUrl,
      });
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function MediaLabWorkspace() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<MediaTab>('images');
  const [notice, setNotice] = useState<string | null>(null);

  // Image Studio (gemini-nano-banana-2.1)
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgAspect, setImgAspect] = useState('16:9');
  const [imgSize, setImgSize] = useState('1K');
  const [imgUseSearch, setImgUseSearch] = useState(false);
  const [imgSource, setImgSource] = useState<{ base64: string; mimeType: string; dataUrl: string } | null>(null);
  const [imgResultUrl, setImgResultUrl] = useState<string | null>(null);
  const [imgCaption, setImgCaption] = useState('');
  const [imgLoading, setImgLoading] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);

  // Video Studio (gemini-omni-1.2-flash via Interactions API)
  const [vidPrompt, setVidPrompt] = useState('');
  const [vidAspect, setVidAspect] = useState<'16:9' | '9:16'>('16:9');
  const [vidDuration, setVidDuration] = useState('6s');
  const [vidSource, setVidSource] = useState<{ base64: string; mimeType: string; dataUrl: string } | null>(null);
  const [vidResultUrl, setVidResultUrl] = useState<string | null>(null);
  const [vidLoading, setVidLoading] = useState(false);
  const [vidError, setVidError] = useState<string | null>(null);

  // Music Studio (lyria-3-clip-preview / lyria-3-pro-preview)
  const [musPrompt, setMusPrompt] = useState('');
  const [musModel, setMusModel] = useState<'lyria-3-clip-preview' | 'lyria-3-pro-preview'>('lyria-3-clip-preview');
  const [musSourceImg, setMusSourceImg] = useState<{ base64: string; mimeType: string; dataUrl: string } | null>(null);
  const [musAudioUrl, setMusAudioUrl] = useState<string | null>(null);
  const [musLyrics, setMusLyrics] = useState('');
  const [musLoading, setMusLoading] = useState(false);
  const [musError, setMusError] = useState<string | null>(null);

  const handleSavePrompt = async (
    kind: 'image_prompt' | 'video_prompt' | 'music_prompt',
    prompt: string,
    modelUsed: string
  ) => {
    if (!user) {
      setNotice('Sign in with Google to save prompts to your Firestore Library.');
      return;
    }
    try {
      await saveCreation({
        ownerId: user.uid,
        kind,
        title: prompt.slice(0, 64),
        content: prompt,
        modelUsed,
      });
      setNotice('Prompt saved to Library.');
      setTimeout(() => setNotice(null), 3000);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Failed to save prompt.');
    }
  };

  const handleGenerateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imgPrompt.trim() || imgLoading) return;
    setImgLoading(true);
    setImgError(null);
    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: imgPrompt.trim(),
          aspectRatio: imgAspect,
          imageSize: imgSize,
          sourceImageBase64: imgSource?.base64,
          sourceMimeType: imgSource?.mimeType,
          useImageSearch: imgUseSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image generation failed.');
      setImgResultUrl(data.imageUrl);
      setImgCaption(data.caption || '');
    } catch (err) {
      setImgError(err instanceof Error ? err.message : 'Image generation failed.');
    } finally {
      setImgLoading(false);
    }
  };

  const handleGenerateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vidPrompt.trim() || vidLoading) return;
    setVidLoading(true);
    setVidError(null);
    try {
      const res = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: vidPrompt.trim(),
          aspectRatio: vidAspect,
          duration: vidDuration,
          imageBase64: vidSource?.base64,
          imageMimeType: vidSource?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Video generation failed.');
      setVidResultUrl(data.videoUrl);
    } catch (err) {
      setVidError(err instanceof Error ? err.message : 'Video generation failed.');
    } finally {
      setVidLoading(false);
    }
  };

  const handleGenerateMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musPrompt.trim() || musLoading) return;
    setMusLoading(true);
    setMusError(null);
    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: musPrompt.trim(),
          model: musModel,
          imageBase64: musSourceImg?.base64,
          imageMimeType: musSourceImg?.mimeType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Music generation failed.');
      setMusAudioUrl(data.audioDataUrl);
      setMusLyrics(data.lyrics || '');
    } catch (err) {
      setMusError(err instanceof Error ? err.message : 'Music generation failed.');
    } finally {
      setMusLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'images'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" />
            Images · Nano Banana 2.1
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('video')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'video'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Video & Animation · Omni Flash
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('music')}
            className={`px-4 py-2 text-xs font-medium rounded-md transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'music'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            Music · Lyria 3
          </button>
        </div>

        {notice && <span className="text-xs text-slate-600 font-medium">{notice}</span>}
      </div>

      {/* IMAGES TAB */}
      {activeTab === 'images' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleGenerateImage}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Create & Edit Images</h2>
              <p className="text-xs text-slate-500 mt-1">
                Generate from text or upload an image to edit · gemini-nano-banana-2.1
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Prompt</label>
              <textarea
                rows={4}
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                placeholder="Describe the scene to generate, or describe the edit to apply to your uploaded image..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-700 space-y-1.5">
                <span>Aspect Ratio</span>
                <select
                  value={imgAspect}
                  onChange={(e) => setImgAspect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                >
                  <option value="1:1">1:1 Square</option>
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                  <option value="4:3">4:3 Standard</option>
                  <option value="3:4">3:4 Editorial</option>
                </select>
              </label>

              <label className="text-xs font-medium text-slate-700 space-y-1.5">
                <span>Resolution</span>
                <select
                  value={imgSize}
                  onChange={(e) => setImgSize(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                >
                  <option value="1K">1K Standard</option>
                  <option value="2K">2K High-Res</option>
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Source Image (Optional for editing)
                </span>
                {imgSource && (
                  <button
                    type="button"
                    onClick={() => setImgSource(null)}
                    className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              {imgSource ? (
                <img
                  src={imgSource.dataUrl}
                  alt="Source image for editing"
                  className="w-full h-36 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg py-4 px-3 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload image to edit</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setImgSource(await fileToBase64(f));
                    }}
                  />
                </label>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={imgUseSearch}
                onChange={(e) => setImgUseSearch(e.target.checked)}
                className="rounded border-slate-300"
              />
              <span>Ground generation with Google Image Search</span>
            </label>

            {imgError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                {imgError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={imgLoading || !imgPrompt.trim()}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {imgLoading ? 'Generating...' : imgSource ? 'Edit Image' : 'Generate Image'}
              </button>
              <button
                type="button"
                disabled={!imgPrompt.trim()}
                onClick={() => handleSavePrompt('image_prompt', imgPrompt, 'gemini-nano-banana-2.1')}
                className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between min-h-[460px]">
            {imgResultUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Output · {imgAspect} · {imgSize}
                  </span>
                  <a
                    href={imgResultUrl}
                    download="meridian-image.png"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </a>
                </div>
                <img
                  src={imgResultUrl}
                  alt="Generated studio output"
                  className="w-full max-h-[420px] object-contain rounded-lg border border-slate-200 bg-slate-50"
                />
                {imgCaption && <p className="text-xs text-slate-600">{imgCaption}</p>}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <ImageIcon className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-800">No image generated yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Enter a prompt on the left to create a new visual or upload an existing photo to apply edits with Nano Banana 2.1.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIDEO TAB */}
      {activeTab === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleGenerateVideo}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Video Generation & Image Animation
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Text-to-video or animate an uploaded photo · gemini-omni-1.2-flash
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Motion Prompt</label>
              <textarea
                rows={4}
                value={vidPrompt}
                onChange={(e) => setVidPrompt(e.target.value)}
                placeholder="Describe the scene or how the uploaded photo should animate..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-700 space-y-1.5">
                <span>Aspect Ratio</span>
                <select
                  value={vidAspect}
                  onChange={(e) => setVidAspect(e.target.value as '16:9' | '9:16')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                >
                  <option value="16:9">16:9 Landscape</option>
                  <option value="9:16">9:16 Portrait</option>
                </select>
              </label>

              <label className="text-xs font-medium text-slate-700 space-y-1.5">
                <span>Duration</span>
                <select
                  value={vidDuration}
                  onChange={(e) => setVidDuration(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
                >
                  <option value="5s">5 seconds</option>
                  <option value="6s">6 seconds</option>
                  <option value="10s">10 seconds</option>
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Starting Frame Photo (Optional)
                </span>
                {vidSource && (
                  <button
                    type="button"
                    onClick={() => setVidSource(null)}
                    className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              {vidSource ? (
                <img
                  src={vidSource.dataUrl}
                  alt="Starting frame for video animation"
                  className="w-full h-36 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg py-4 px-3 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Upload photo to animate</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setVidSource(await fileToBase64(f));
                    }}
                  />
                </label>
              )}
            </div>

            {vidError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                {vidError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={vidLoading || !vidPrompt.trim()}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Film className="w-4 h-4" />
                {vidLoading ? 'Rendering Video...' : vidSource ? 'Animate Photo' : 'Generate Video'}
              </button>
              <button
                type="button"
                disabled={!vidPrompt.trim()}
                onClick={() => handleSavePrompt('video_prompt', vidPrompt, 'gemini-omni-1.2-flash')}
                className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between min-h-[460px]">
            {vidResultUrl ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Rendered MP4 · {vidAspect} · {vidDuration}
                  </span>
                  <a
                    href={vidResultUrl}
                    download="meridian-video.mp4"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download MP4
                  </a>
                </div>
                <video
                  src={vidResultUrl}
                  controls
                  autoPlay
                  loop
                  className="w-full max-h-[420px] rounded-lg border border-slate-200 bg-slate-950"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <Film className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-800">No video rendered yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Generate a 16:9 landscape or 9:16 portrait clip from text, or upload a photo to animate it via Omni Flash.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MUSIC TAB */}
      {activeTab === 'music' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleGenerateMusic}
            className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
          >
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Music Composition</h2>
              <p className="text-xs text-slate-500 mt-1">
                Compose clips or full tracks · lyria-3-clip-preview / lyria-3-pro-preview
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Musical Direction</label>
              <textarea
                rows={4}
                value={musPrompt}
                onChange={(e) => setMusPrompt(e.target.value)}
                placeholder="Describe genre, instrumentation, tempo, mood, or lyrical theme..."
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              />
            </div>

            <label className="block text-xs font-medium text-slate-700 space-y-1.5">
              <span>Track Length Model</span>
              <select
                value={musModel}
                onChange={(e) =>
                  setMusModel(e.target.value as 'lyria-3-clip-preview' | 'lyria-3-pro-preview')
                }
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-900"
              >
                <option value="lyria-3-clip-preview">Lyria 3 Clip (Up to 30s)</option>
                <option value="lyria-3-pro-preview">Lyria 3 Pro (Full-length track)</option>
              </select>
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">
                  Inspiration Image (Optional)
                </span>
                {musSourceImg && (
                  <button
                    type="button"
                    onClick={() => setMusSourceImg(null)}
                    className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                )}
              </div>
              {musSourceImg ? (
                <img
                  src={musSourceImg.dataUrl}
                  alt="Musical inspiration reference"
                  className="w-full h-32 object-cover rounded-lg border border-slate-200"
                />
              ) : (
                <label className="flex items-center justify-center gap-2 border border-dashed border-slate-300 rounded-lg py-3.5 px-3 text-xs text-slate-600 hover:bg-slate-50 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  <span>Attach visual inspiration</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (f) setMusSourceImg(await fileToBase64(f));
                    }}
                  />
                </label>
              )}
            </div>

            {musError && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                {musError}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={musLoading || !musPrompt.trim()}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Music className="w-4 h-4" />
                {musLoading ? 'Composing...' : 'Compose Music'}
              </button>
              <button
                type="button"
                disabled={!musPrompt.trim()}
                onClick={() => handleSavePrompt('music_prompt', musPrompt, musModel)}
                className="px-3.5 py-2.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Bookmark className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          </form>

          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between min-h-[460px]">
            {musAudioUrl ? (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">
                    Master Audio · {musModel}
                  </span>
                  <a
                    href={musAudioUrl}
                    download="meridian-track.mp3"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Audio
                  </a>
                </div>
                <audio src={musAudioUrl} controls className="w-full" />
                {musLyrics && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-[280px] overflow-y-auto">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Generated Lyrics & Notes
                    </div>
                    <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {musLyrics}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                <Music className="w-10 h-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-800">No track composed yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-sm">
                  Describe a sonic palette on the left to generate a 30-second clip or full-length track with Lyria 3.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
