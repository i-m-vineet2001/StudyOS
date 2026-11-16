import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

function getAiClient(): GoogleGenAI {
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
app.get("/health", (_req, res) => {
  res.status(200).send("StudyOS is alive");
});

  app.post('/api/ai/ask', async (req, res) => {
    try {
      const { question, subjectName, topicName, mode } = req.body as {
        question?: string;
        subjectName?: string;
        topicName?: string;
        mode?: string;
      };

      const cleanQuestion = (question || '').trim();
      if (!cleanQuestion) {
        res.status(400).json({ error: 'Please enter a word, concept, or question.' });
        return;
      }

      const ai = getAiClient();

      const contextLine = [
        subjectName ? `Subject: ${subjectName}` : null,
        topicName ? `Topic: ${topicName}` : null,
        mode ? `Focus: ${mode}` : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const systemInstruction = [
        'You are StudyOS AI, a concise, accurate study tutor helping a student prepare for competitive exams (including Banking exams).',
        'Keep responses clear, structured, and easy to revise quickly.',
        'If the user asks about an English vocabulary word or phrase, include: 1) Clear Meaning, 2) Part of Speech, 3) Synonyms & Antonyms, and 4) An exam-relevant example sentence.',
        'If the user asks about Quantitative Aptitude, Reasoning, or Banking Awareness, provide crisp steps, key formulas/shortcuts, or concise bullet points.',
        'Avoid unnecessary filler or markdown clutter.',
      ].join(' ');

      const prompt = contextLine
        ? `Context (${contextLine})\n\nStudent question: ${cleanQuestion}`
        : cleanQuestion;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const answer = (response.text || '').trim();
      if (!answer) {
        res.status(502).json({ error: 'No response generated. Please try again.' });
        return;
      }

      res.json({ answer });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Unable to reach AI study assistant.';
      const status =
        message.includes('API_KEY_INVALID') || message.includes('GEMINI_API_KEY') ? 400 : 500;
      res.status(status).json({ error: message });
    }
  });

  if (!isProd) {
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
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudyOS server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
