import React, { useEffect, useState } from 'react';
import {
  Bookmark,
  Download,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { saveCreation } from '../../lib/firebase';
import {
  getCpcbTier,
  type PortalLang,
  type StationTelemetry,
} from '../../data/indiaStations';

async function fileToBase64(
  file: File
): Promise<{ base64: string; mimeType: string; dataUrl: string }> {
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
    reader.onerror = () => reject(new Error('Failed to read uploaded image file.'));
    reader.readAsDataURL(file);
  });
}

export function VisualBulletinStudioView({
  stations,
  focusedStation,
  lang,
}: {
  stations: StationTelemetry[];
  focusedStation: StationTelemetry;
  lang: PortalLang;
}) {
  const { user } = useAuth();
  const [cityCode, setCityCode] = useState(focusedStation.code);
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [imageSize, setImageSize] = useState('1K');
  const [useImageSearch, setUseImageSearch] = useState(false);
  const [sourceImage, setSourceImage] = useState<{
    base64: string;
    mimeType: string;
    dataUrl: string;
  } | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setCityCode(focusedStation.code);
  }, [focusedStation.code]);

  const activeStation =
    stations.find((s) => s.code === cityCode) || focusedStation;
  const activeTier = getCpcbTier(activeStation.aqi);

  const presetPrompts = [
    {
      label: `CPCB Advisory Poster (${activeStation.city})`,
      text: `Clean Swiss-style municipal public health advisory poster for ${activeStation.city} (${activeStation.locality}), CPCB AQI ${activeStation.aqi} (${activeTier}), displaying N95 respirator guidance and indoor HEPA filtration icon, deep navy and emerald civic color palette, crisp layout.`,
    },
    {
      label: `Clean-Air Transformation (${activeStation.city})`,
      text: `Architectural visualization of a solar-powered HEPA smog tower and lush native Indian green corridor boulevard in ${activeStation.city}, crisp blue morning sky, pedestrian walkways, photorealistic editorial photography.`,
    },
    {
      label: 'Air-Purified School Corridor Concept',
      text: `Bright modern Indian primary school courtyard with living bamboo bio-walls, real-time digital AQI LED display reading 34 Good, sunlight filtering through clean air, architectural photography.`,
    },
  ];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          aspectRatio,
          imageSize,
          sourceImageBase64: sourceImage?.base64,
          sourceMimeType: sourceImage?.mimeType,
          useImageSearch,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Image generation failed.');
      }
      setResultUrl(data.imageUrl);
      setCaption(data.caption || '');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to generate image.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReuseOutputForEdit = () => {
    if (!resultUrl || !resultUrl.startsWith('data:')) return;
    const commaIdx = resultUrl.indexOf(',');
    if (commaIdx < 0) return;
    const header = resultUrl.slice(5, commaIdx);
    const mimeType = header.split(';')[0] || 'image/png';
    const base64 = resultUrl.slice(commaIdx + 1);
    setSourceImage({ base64, mimeType, dataUrl: resultUrl });
    setPrompt(
      `Transform atmospheric haze in this scene into crystal-clear blue Himalayan sky after 80% PM2.5 reduction.`
    );
  };

  const handleSaveVisualPrompt = async () => {
    if (!user || !prompt.trim()) return;
    await saveCreation({
      ownerId: user.uid,
      kind: 'image_prompt',
      title: `Visual Poster: ${activeStation.city} (AQI ${activeStation.aqi})`,
      content: `${prompt.trim()}\nAspect Ratio: ${aspectRatio} · Mode: ${
        sourceImage ? 'Image Edit' : 'Text-to-Image'
      }`,
      modelUsed: 'gemini-nano-banana-2.1',
    });
    setNotice('Visual prompt saved to Cloud Watchlist.');
    setTimeout(() => setNotice(null), 2600);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 pt-4 pb-12 space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#005d42] font-bold">
            <Wand2 className="w-4 h-4" />
            <span>Civic Visual Studio · gemini-nano-banana-2.1</span>
          </div>
          <h1 className="text-2xl font-bold text-[#0b1c30] mt-0.5">
            {lang === 'hi'
              ? 'नागरिक वायु पोस्टर और दृश्य संपादक स्टूडियो'
              : 'Civic Air Bulletin & Image Transformation Studio'}
          </h1>
          <p className="text-xs text-[#3e4943] mt-0.5">
            Create public-health AQI advisory posters from text, or upload a street/skyline photo to visualize clean-air transformations.
          </p>
        </div>

        <select
          value={activeStation.code}
          onChange={(e) => setCityCode(e.target.value)}
          className="bg-white border border-[#bdc9c1] rounded-lg px-3 py-2 text-xs font-semibold text-[#0b1c30]"
        >
          {stations.map((s) => (
            <option key={s.code} value={s.code}>
              Target City: {s.city} (AQI {s.aqi})
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={(e) => void handleGenerate(e)}
          className="lg:col-span-5 bg-white rounded-xl border border-[#bdc9c1]/50 p-6 space-y-4"
        >
          <div className="space-y-2">
            <span className="text-xs font-bold text-[#0b1c30]">
              Quick Civic Templates ({activeStation.city})
            </span>
            <div className="flex flex-col gap-1.5">
              {presetPrompts.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setPrompt(p.text)}
                  className="text-left px-3 py-2 rounded-lg bg-[#eff4ff] hover:bg-[#dce9ff] text-xs font-semibold text-[#0b1c30] transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="visualPromptBox"
              className="block text-xs font-bold text-[#0b1c30]"
            >
              {sourceImage
                ? 'Edit Instruction for Uploaded Photo'
                : 'Image Generation Prompt'}
            </label>
            <textarea
              id="visualPromptBox"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                sourceImage
                  ? 'Describe how to edit the uploaded photo (e.g. remove smog haze, add clear blue sky and solar smog tower)...'
                  : 'Describe an air-quality advisory poster, urban clean-air corridor, or infographic...'
              }
              className="w-full bg-[#eff4ff] border border-[#bdc9c1]/60 rounded-lg p-3 text-xs text-[#0b1c30] focus:outline-none focus:border-[#005d42]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-[#0b1c30] space-y-1">
              <span>Aspect Ratio</span>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full bg-[#eff4ff] border border-[#bdc9c1]/60 rounded-lg px-2.5 py-2 text-xs text-[#0b1c30]"
              >
                <option value="16:9">16:9 Bulletin Banner</option>
                <option value="1:1">1:1 Social Card</option>
                <option value="3:4">3:4 Civic Poster</option>
                <option value="9:16">9:16 Mobile Alert</option>
              </select>
            </label>

            <label className="text-xs font-semibold text-[#0b1c30] space-y-1">
              <span>Resolution</span>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                className="w-full bg-[#eff4ff] border border-[#bdc9c1]/60 rounded-lg px-2.5 py-2 text-xs text-[#0b1c30]"
              >
                <option value="1K">1K Standard</option>
                <option value="2K">2K Print Ready</option>
              </select>
            </label>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#0b1c30]">
                Source Photo (Optional for Image Editing)
              </span>
              {sourceImage && (
                <button
                  type="button"
                  onClick={() => setSourceImage(null)}
                  className="text-xs text-[#ba1a1a] hover:underline inline-flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Clear Photo
                </button>
              )}
            </div>
            {sourceImage ? (
              <img
                src={sourceImage.dataUrl}
                alt="Uploaded source photo for editing"
                className="w-full h-36 object-cover rounded-lg border border-[#bdc9c1]"
              />
            ) : (
              <label className="flex items-center justify-center gap-2 border border-dashed border-[#bdc9c1] rounded-lg py-4 px-3 text-xs text-[#3e4943] hover:bg-[#eff4ff] cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-[#006398]" />
                <span>Upload street or skyline photo to edit</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSourceImage(await fileToBase64(file));
                    }
                  }}
                />
              </label>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-[#3e4943] cursor-pointer">
            <input
              type="checkbox"
              checked={useImageSearch}
              onChange={(e) => setUseImageSearch(e.target.checked)}
              className="accent-[#005d42]"
            />
            <span>Ground visual details with Google Image Search</span>
          </label>

          {error && (
            <div className="p-3 rounded-lg bg-[#ffdad6] text-[#93000a] text-xs leading-relaxed">
              {error}
            </div>
          )}

          {notice && (
            <div className="p-2.5 rounded-lg bg-[#97f5cc] text-[#002115] text-xs font-semibold">
              {notice}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={loading || !prompt.trim()}
              className="flex-1 px-4 py-2.5 bg-[#005d42] hover:bg-[#047857] text-white text-xs font-semibold rounded-lg disabled:opacity-50 inline-flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {loading
                  ? 'Rendering via Nano Banana 2.1...'
                  : sourceImage
                    ? 'Edit Photo'
                    : 'Generate Poster'}
              </span>
            </button>

            {user && (
              <button
                type="button"
                disabled={!prompt.trim()}
                onClick={() => void handleSaveVisualPrompt()}
                className="px-3.5 py-2.5 border border-[#bdc9c1] rounded-lg text-xs font-semibold text-[#0b1c30] hover:bg-[#eff4ff] disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                <Bookmark className="w-3.5 h-3.5 text-[#006398]" />
                Save
              </button>
            )}
          </div>
        </form>

        {/* Right Canvas Preview */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#bdc9c1]/50 p-6 min-h-[500px] flex flex-col justify-between">
          {resultUrl ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[#3e4943]">
                  Nano Banana 2.1 Output · {aspectRatio} · {imageSize}
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReuseOutputForEdit}
                    className="text-xs font-semibold text-[#005d42] hover:underline inline-flex items-center gap-1"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    Send to Edit Mode
                  </button>
                  <a
                    href={resultUrl}
                    download={`breathe-india-${activeStation.code.toLowerCase()}.png`}
                    className="text-xs font-semibold text-[#006398] hover:underline inline-flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download PNG
                  </a>
                </div>
              </div>

              <img
                src={resultUrl}
                alt={`Generated Breathe India visual for ${activeStation.city}`}
                className="w-full max-h-[460px] object-contain rounded-lg border border-[#bdc9c1]/50 bg-[#eff4ff]"
              />

              {caption && (
                <p className="text-xs text-[#3e4943] leading-relaxed">{caption}</p>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-16">
              <ImageIcon className="w-10 h-10 text-[#6e7a73] mb-3" />
              <h2 className="text-base font-bold text-[#0b1c30]">
                Generate Public Health & Clean-Air Visuals
              </h2>
              <p className="text-xs text-[#3e4943] mt-1 max-w-md leading-relaxed">
                Pick a pre-filled template for {activeStation.city} or upload an existing photo to edit atmospheric visibility using{' '}
                <code className="font-mono font-semibold">gemini-nano-banana-2.1</code>.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
