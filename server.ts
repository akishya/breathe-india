import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseGeminiError(err: unknown): { status: number; message: string; isPaidModelError: boolean } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes('resource_exhausted') || lower.includes('429') || lower.includes('quota')) {
    return {
      status: 429,
      message:
        'Quota reached or paid API key required for this model. Select a billing-enabled key in Settings > Secrets to unlock high-capacity and paid media models.',
      isPaidModelError: true,
    };
  }
  if (lower.includes('permission_denied') || lower.includes('403') || lower.includes('api_key_invalid')) {
    return {
      status: 403,
      message: 'API key missing permission for this model. Verify your GEMINI_API_KEY in Settings > Secrets.',
      isPaidModelError: true,
    };
  }
  if (lower.includes('not_found') || lower.includes('404')) {
    return {
      status: 404,
      message: 'Requested model was not found or is unavailable for the current API key.',
      isPaidModelError: false,
    };
  }
  return {
    status: 500,
    message: raw || 'An unexpected server error occurred.',
    isPaidModelError: false,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Public client configuration (never exposes server-side GEMINI_API_KEY)
  app.get('/api/config', (_req, res) => {
    res.json({
      mapsApiKey: process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '',
    });
  });

  // Live atmospheric & CPCB NAQI lookup for any coordinate in India
  const pointCache = new Map<string, { expires: number; data: Record<string, unknown> }>();

  const computeServerIndiaAqi = (pm25: number, pm10: number, no2: number, o3: number) => {
    const sub = (val: number, bps: [number, number, number, number][]) => {
      for (const [cLow, cHigh, iLow, iHigh] of bps) {
        if (val <= cHigh) {
          return Math.round(((iHigh - iLow) / (cHigh - cLow)) * (val - cLow) + iLow);
        }
      }
      return 450;
    };
    const s25 = sub(pm25, [[0,30,0,50],[30,60,51,100],[60,90,101,200],[90,120,201,300],[120,250,301,400],[250,500,401,500]]);
    const s10 = sub(pm10, [[0,50,0,50],[50,100,51,100],[100,250,101,200],[250,350,201,300],[350,430,301,400],[430,800,401,500]]);
    const sNo2 = sub(no2, [[0,40,0,50],[40,80,51,100],[80,180,101,200],[180,280,201,300],[280,400,301,400],[400,800,401,500]]);
    const sO3 = sub(o3, [[0,50,0,50],[50,100,51,100],[100,168,101,200],[168,208,201,300],[208,748,301,400],[748,1200,401,500]]);
    return Math.max(12, Math.min(500, Math.max(s25, s10, sNo2, sO3)));
  };

  async function fetchLivePointMetrics(lat: number, lng: number) {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
    const cached = pointCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone&hourly=pm2_5,pm10&forecast_days=1&timezone=Asia%2FKolkata`;
      const wxUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=Asia%2FKolkata`;

      const [aqRes, wxRes] = await Promise.all([
        fetch(aqUrl, { signal: controller.signal }),
        fetch(wxUrl, { signal: controller.signal }),
      ]);
      if (!aqRes.ok) throw new Error(`Air Quality HTTP ${aqRes.status}`);
      const aq = (await aqRes.json()) as Record<string, any>;
      const wx = wxRes.ok ? ((await wxRes.json()) as Record<string, any>) : {};

      const cur = aq.current || {};
      const pm25 = Math.max(2, Number(cur.pm2_5 ?? 24));
      const pm10 = Math.max(5, Number(cur.pm10 ?? pm25 * 1.8));
      const no2 = Math.max(2, Number(cur.nitrogen_dioxide ?? 18));
      const so2 = Math.max(1, Number(cur.sulphur_dioxide ?? 6));
      const co = Number(((Number(cur.carbon_monoxide ?? 450)) / 1000).toFixed(2));
      const o3 = Math.max(5, Number(cur.ozone ?? 30));

      const hourlyPm25Raw: number[] = Array.isArray(aq.hourly?.pm2_5) ? aq.hourly.pm2_5 : [];
      const hourlyPm10Raw: number[] = Array.isArray(aq.hourly?.pm10) ? aq.hourly.pm10 : [];
      const sampleIndices = [0, 3, 6, 9, 12, 15, 18, 21, 23];
      const hourlyPm25 = sampleIndices.map((idx) =>
        Math.round((hourlyPm25Raw[idx] ?? pm25) * 10) / 10
      );
      const hourlyPm10 = sampleIndices.map((idx) =>
        Math.round((hourlyPm10Raw[idx] ?? pm10) * 10) / 10
      );

      const aqi = computeServerIndiaAqi(pm25, pm10, no2, o3);
      const wxCur = wx.current || {};
      const payload = {
        aqi,
        pm25: Math.round(pm25 * 10) / 10,
        pm10: Math.round(pm10 * 10) / 10,
        no2: Math.round(no2 * 10) / 10,
        so2: Math.round(so2 * 10) / 10,
        co,
        o3: Math.round(o3 * 10) / 10,
        windKmh: Math.round(Number(wxCur.wind_speed_10m ?? 7.5) * 10) / 10,
        tempC: Math.round(Number(wxCur.temperature_2m ?? 24)),
        humidityPct: Math.round(Number(wxCur.relative_humidity_2m ?? 65)),
        hourlyPm25,
        hourlyPm10,
        dominant: pm25 * 2 >= pm10 ? 'PM2.5' : 'PM10',
        fetchedAt: new Date().toISOString(),
      };
      pointCache.set(key, { expires: Date.now() + 10 * 60 * 1000, data: payload });
      return payload;
    } finally {
      clearTimeout(timer);
    }
  }

  app.get('/api/air-quality/point', async (req, res) => {
    try {
      const lat = Number(req.query.lat);
      const lng = Number(req.query.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({ error: 'Valid lat and lng query parameters are required.' });
      }
      const data = await fetchLivePointMetrics(lat, lng);
      res.json(data);
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Unable to fetch live air quality telemetry.',
      });
    }
  });

  app.post('/api/air-quality/batch', async (req, res) => {
    try {
      const coords = Array.isArray(req.body?.points) ? req.body.points.slice(0, 20) : [];
      const results = await Promise.all(
        coords.map(async (pt: { code?: string; lat?: number; lng?: number }) => {
          if (typeof pt.lat !== 'number' || typeof pt.lng !== 'number') return null;
          try {
            const metrics = await fetchLivePointMetrics(pt.lat, pt.lng);
            return { code: pt.code, ...metrics };
          } catch {
            return null;
          }
        })
      );
      res.json({ stations: results.filter(Boolean) });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Batch fetch failed.' });
    }
  });

  // Multi-turn Chatbot + Search Grounding + Maps Grounding
  app.post('/api/chat', async (req, res) => {
    try {
      const {
        messages = [],
        model = 'gemini-4-hydrogen',
        systemInstruction = 'You are Breathe India AI Air Explainer, a precise environmental health and CPCB AQI specialist.',
        groundingMode = 'none',
        userLocation = null,
        latLng = null,
      } = req.body ?? {};

      const locationCoords = userLocation || latLng;

      const allowedModels = new Set([
        'gemini-4-hydrogen',
        'gemini-3.1-flash-lite',
        'gemini-4-argon',
        'gemini-4-carbon',
      ]);

      const activeModel =
        groundingMode === 'search' || groundingMode === 'maps'
          ? 'gemini-4-hydrogen'
          : allowedModels.has(model)
            ? model
            : 'gemini-4-hydrogen';

      const contents = (Array.isArray(messages) ? messages : []).map(
        (m: { role: string; text: string }) => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(m.text ?? '') }],
        })
      );

      if (contents.length === 0) {
        return res.status(400).json({ error: 'At least one message is required.' });
      }

      const ai = getAiClient();
      const buildConfig = (targetModel: string, mode: string) => {
        const cfg: Record<string, unknown> = {
          systemInstruction,
        };
        if (targetModel === 'gemini-4-hydrogen') {
          cfg.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }
        if (mode === 'search') {
          cfg.tools = [{ googleSearch: {} }];
        } else if (mode === 'maps') {
          cfg.tools = [{ googleMaps: {} }];
          if (
            locationCoords &&
            typeof locationCoords.lat === 'number' &&
            typeof locationCoords.lng === 'number'
          ) {
            cfg.toolConfig = {
              retrievalConfig: {
                latLng: {
                  latitude: locationCoords.lat,
                  longitude: locationCoords.lng,
                },
              },
            };
          }
        }
        return cfg;
      };

      const callWithTimeout = async <T>(promise: Promise<T>, ms = 18000): Promise<T> => {
        let timer: NodeJS.Timeout | undefined;
        try {
          return await Promise.race([
            promise,
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(() => reject(new Error('Model request timed out.')), ms);
            }),
          ]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      };

      let response;
      let finalModel = activeModel;
      let groundingNote: string | undefined;

      try {
        response = await callWithTimeout(
          ai.models.generateContent({
            model: activeModel,
            contents,
            config: buildConfig(activeModel, groundingMode),
          }),
          18000
        );
      } catch (primaryErr) {
        const isExplicitPaid =
          groundingMode === 'none' &&
          (activeModel === 'gemini-4-argon' || activeModel === 'gemini-4-carbon');
        if (isExplicitPaid) {
          throw primaryErr;
        }

        // Fallback chain for default Hydrogen / Search / Maps when free-tier quota or timeout occurs
        try {
          if (groundingMode !== 'none' && activeModel === 'gemini-4-hydrogen') {
            finalModel = 'gemini-4-hydrogen';
            groundingNote =
              'Live grounding quota reached; answered using live CPCB telemetry & atmospheric knowledge.';
            response = await callWithTimeout(
              ai.models.generateContent({
                model: 'gemini-4-hydrogen',
                contents,
                config: buildConfig('gemini-4-hydrogen', 'none'),
              }),
              15000
            );
          } else {
            throw primaryErr;
          }
        } catch {
          finalModel = 'gemini-3.1-flash-lite';
          groundingNote =
            groundingMode !== 'none'
              ? 'Live grounding quota reached; answered via Gemini 3.1 Flash-Lite with live CPCB telemetry.'
              : 'Switched to Gemini 3.1 Flash-Lite for fast response.';
          response = await callWithTimeout(
            ai.models.generateContent({
              model: 'gemini-3.1-flash-lite',
              contents,
              config: buildConfig('gemini-3.1-flash-lite', 'none'),
            }),
            15000
          );
        }
      }

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources: Array<{
        type: 'web' | 'maps';
        title: string;
        uri: string;
        reviewSnippets?: string[];
      }> = [];

      for (const chunk of chunks as Array<Record<string, any>>) {
        if (chunk.web?.uri) {
          sources.push({
            type: 'web',
            title: chunk.web.title || chunk.web.uri,
            uri: chunk.web.uri,
          });
        } else if (chunk.maps?.uri) {
          const snippets: string[] = [];
          if (Array.isArray(chunk.maps.placeAnswerSources?.reviewSnippets)) {
            for (const s of chunk.maps.placeAnswerSources.reviewSnippets) {
              if (s?.content) snippets.push(String(s.content));
              else if (typeof s === 'string') snippets.push(s);
            }
          }
          sources.push({
            type: 'maps',
            title: chunk.maps.title || 'Google Maps Place',
            uri: chunk.maps.uri,
            reviewSnippets: snippets,
          });
        }
      }

      res.json({
        text: response.text ?? '',
        modelUsed: finalModel,
        sources,
        groundingNote,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.status).json({ error: parsed.message, isPaidModelError: parsed.isPaidModelError });
    }
  });

  // Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/audio/transcribe', async (req, res) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', prompt = 'Transcribe this audio accurately.' } = req.body ?? {};
      if (!audioBase64 || typeof audioBase64 !== 'string') {
        return res.status(400).json({ error: 'Audio data is required.' });
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            { text: prompt },
          ],
        },
      });

      res.json({
        text: response.text ?? '',
        modelUsed: 'gemini-3.5-transcribe',
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.status).json({ error: parsed.message, isPaidModelError: parsed.isPaidModelError });
    }
  });

  // Image Generation & Editing (gemini-nano-banana-2.1)
  app.post('/api/images/generate', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '1:1',
        imageSize = '1K',
        sourceImageBase64,
        sourceMimeType = 'image/png',
        useImageSearch = false,
      } = req.body ?? {};

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Prompt is required.' });
      }

      const ai = getAiClient();
      const parts: Array<Record<string, unknown>> = [];
      if (sourceImageBase64 && typeof sourceImageBase64 === 'string') {
        parts.push({
          inlineData: {
            data: sourceImageBase64,
            mimeType: sourceMimeType,
          },
        });
      }
      parts.push({ text: prompt });

      const config: Record<string, unknown> = {
        imageConfig: {
          aspectRatio,
          imageSize,
        },
      };

      if (useImageSearch) {
        config.tools = [
          {
            googleSearch: {
              searchTypes: {
                webSearch: {},
                imageSearch: {},
              },
            },
          },
        ];
      }

      const response = await ai.models.generateContent({
        model: 'gemini-nano-banana-2.1',
        contents: { parts },
        config,
      });

      let imageUrl: string | null = null;
      let caption = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          caption += part.text;
        }
      }

      if (!imageUrl) {
        return res.status(502).json({ error: caption || 'No image was returned by the model.' });
      }

      res.json({
        imageUrl,
        caption,
        modelUsed: 'gemini-nano-banana-2.1',
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.status).json({ error: parsed.message, isPaidModelError: parsed.isPaidModelError });
    }
  });

  // Music Generation (lyria-3-clip-preview / lyria-3-pro-preview)
  app.post('/api/music/generate', async (req, res) => {
    try {
      const {
        prompt,
        model = 'lyria-3-clip-preview',
        imageBase64,
        imageMimeType = 'image/jpeg',
      } = req.body ?? {};

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Music prompt is required.' });
      }

      const activeModel = model === 'lyria-3-pro-preview' ? 'lyria-3-pro-preview' : 'lyria-3-clip-preview';
      const ai = getAiClient();

      const contents =
        imageBase64 && typeof imageBase64 === 'string'
          ? {
              parts: [
                { text: prompt },
                { inlineData: { data: imageBase64, mimeType: imageMimeType } },
              ],
            }
          : prompt;

      const stream = await ai.models.generateContentStream({
        model: activeModel,
        contents,
      });

      const audioChunks: Buffer[] = [];
      let lyrics = '';
      let mimeType = 'audio/mpeg';

      for await (const chunk of stream) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (audioChunks.length === 0 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
          }
          if (part.text) {
            lyrics += part.text;
          }
        }
      }

      if (audioChunks.length === 0) {
        return res.status(502).json({ error: 'No audio data was returned by Lyria.' });
      }

      const audioBase64 = Buffer.concat(audioChunks).toString('base64');
      res.json({
        audioDataUrl: `data:${mimeType};base64,${audioBase64}`,
        lyrics: lyrics.trim(),
        modelUsed: activeModel,
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.status).json({ error: parsed.message, isPaidModelError: parsed.isPaidModelError });
    }
  });

  // Video Generation & Image Animation (gemini-omni-1.2-flash via Interactions API)
  app.post('/api/video/generate', async (req, res) => {
    try {
      const {
        prompt,
        aspectRatio = '16:9',
        duration = '6s',
        imageBase64,
        imageMimeType = 'image/png',
      } = req.body ?? {};

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Video prompt is required.' });
      }

      const safeAspect = aspectRatio === '9:16' ? '9:16' : '16:9';
      const ai = getAiClient();

      const input =
        imageBase64 && typeof imageBase64 === 'string'
          ? [
              {
                type: 'image' as const,
                mime_type: imageMimeType,
                data: imageBase64,
              },
              {
                type: 'text' as const,
                text: prompt,
              },
            ]
          : prompt;

      const interaction = await ai.interactions.create(
        {
          model: 'gemini-omni-1.2-flash',
          input,
          background: false,
          store: false,
          stream: false,
          response_format: {
            type: 'video',
            aspect_ratio: safeAspect,
            duration,
            resolution: '720p',
          },
        },
        { timeout: 300000 }
      );

      const videoPart = interaction.output_video;
      if (!videoPart || (!videoPart.data && !videoPart.uri)) {
        return res.status(502).json({ error: 'No video output returned by Omni Flash.' });
      }

      const mime = videoPart.mime_type || 'video/mp4';
      const videoUrl = videoPart.data
        ? `data:${mime};base64,${videoPart.data}`
        : videoPart.uri;

      res.json({
        videoUrl,
        aspectRatio: safeAspect,
        modelUsed: 'gemini-omni-1.2-flash',
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      res.status(parsed.status).json({ error: parsed.message, isPaidModelError: parsed.isPaidModelError });
    }
  });

  const server = http.createServer(app);

  // Live API WebSocket bridge (/live) using gemini-3.8-live
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on('connection', async (clientWs: WebSocket) => {
    let session: Awaited<ReturnType<GoogleGenAI['live']['connect']>> | null = null;
    try {
      const ai = getAiClient();
      session = await ai.live.connect({
        model: 'gemini-3.8-live',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' },
            },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          systemInstruction:
            'You are Meridian Voice, a responsive and concise creative studio collaborator.',
        },
        callbacks: {
          onopen: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'connected' }));
            }
          },
          onmessage: (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            const content = message.serverContent;
            if (content?.inputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ inputTranscript: content.inputTranscription.text })
              );
            }
            if (content?.outputTranscription?.text) {
              clientWs.send(
                JSON.stringify({ outputTranscript: content.outputTranscription.text })
              );
            }
            for (const part of content?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) {
                clientWs.send(JSON.stringify({ audio: part.inlineData.data }));
              }
            }
            if (content?.interrupted) {
              clientWs.send(JSON.stringify({ interrupted: true }));
            }
            if (content?.turnComplete) {
              clientWs.send(JSON.stringify({ turnComplete: true }));
            }
          },
          onerror: (err: unknown) => {
            if (clientWs.readyState === WebSocket.OPEN) {
              const parsed = parseGeminiError(err);
              clientWs.send(JSON.stringify({ error: parsed.message }));
            }
          },
          onclose: () => {
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ status: 'closed' }));
            }
          },
        },
      });
    } catch (err) {
      const parsed = parseGeminiError(err);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ error: parsed.message }));
        clientWs.close();
      }
      return;
    }

    clientWs.on('message', (raw) => {
      if (!session) return;
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.audio) {
          session.sendRealtimeInput({
            audio: { data: msg.audio, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.text) {
          session.sendRealtimeInput({
            text: String(msg.text),
          });
        }
      } catch {
        // Ignore malformed frames
      }
    });

    clientWs.on('close', () => {
      try {
        session?.close();
      } catch {
        // Ignore close errors
      }
      session = null;
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Meridian Studio server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Meridian Studio server:', err);
  process.exit(1);
});
