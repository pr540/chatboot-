import Anthropic from '@anthropic-ai/sdk';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let knowledgeBase = '';
try {
  knowledgeBase = fs.readFileSync(path.join(__dirname, 'public/knowledge.txt'), 'utf-8');
} catch {
  console.warn('knowledge.txt not found — continuing without it');
}

const SYSTEM_PROMPT = `You are Gentaroo AI, a helpful customer support assistant for Gentaroo AI platform.

Use the following knowledge base to answer questions accurately:

${knowledgeBase}

Guidelines:
- Answer questions based on the knowledge base above when relevant.
- For questions not covered in the knowledge base, answer helpfully from general knowledge.
- Keep responses concise, friendly, and professional.
- Do not mention that you are Claude or made by Anthropic — you are Gentaroo AI.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    const messages = history
      .filter((m) => m.sender !== 'bot' || history.indexOf(m) !== 0)
      .slice(-20)
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      }));

    messages.push({ role: 'user', content: message });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages,
    });

    res.json({ response: response.content[0]?.text || "Sorry, I couldn't process that." });
  } catch (err) {
    console.error('Chat error:', err.message);
    if (err.message && err.message.includes('API key')) {
      res.status(500).json({ response: "⚠️ No API key configured. Please add ANTHROPIC_API_KEY to your .env file and restart the server." });
    } else {
      res.status(500).json({ response: "I'm having trouble responding right now. Please try again." });
    }
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
