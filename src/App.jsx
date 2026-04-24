import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const INITIAL_MESSAGES = [
  {
    id: 1,
    text: "Hi there! I'm Gentaroo AI, your intelligent assistant. How can I help you today?",
    sender: 'bot',
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

function parseKnowledge(text) {
  const entries = [];
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let currentQ = null;
  for (const line of lines) {
    if (line.startsWith('Q:')) {
      currentQ = line.slice(2).trim().toLowerCase();
    } else if (line.startsWith('A:') && currentQ) {
      entries.push({ question: currentQ, answer: line.slice(2).trim() });
      currentQ = null;
    }
  }
  return entries;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

const STOP_WORDS = new Set(['the', 'is', 'are', 'was', 'were', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'do', 'does', 'can', 'you', 'me', 'my', 'i', 'it', 'this', 'that', 'how', 'what', 'when', 'where', 'who', 'why']);

function getKeywords(text) {
  return normalize(text).split(/\s+/).filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

function searchKnowledge(knowledge, query) {
  if (!knowledge.length) return null;
  const q = normalize(query);
  const qWords = getKeywords(query);

  let bestMatch = null;
  let bestScore = 0;

  for (const entry of knowledge) {
    const eq = entry.question;
    const eqWords = getKeywords(eq);
    let score = 0;

    // Exact full match
    if (eq === q) score += 30;
    // Query is contained in question
    else if (eq.includes(q)) score += 15;
    // Question is contained in query
    else if (q.includes(eq)) score += 12;

    // Keyword overlap
    for (const word of qWords) {
      if (eqWords.includes(word)) {
        score += 4;
      } else {
        // Partial / stem match
        for (const ew of eqWords) {
          if (ew.startsWith(word) || word.startsWith(ew)) {
            score += 2;
            break;
          }
        }
      }
    }

    // Bonus: every question word found in query
    const coverage = eqWords.filter((w) => qWords.includes(w)).length / (eqWords.length || 1);
    score += coverage * 5;

    // Normalize to avoid bias toward very long questions
    const finalScore = score > 0 ? score / Math.sqrt(Math.max(eqWords.length, 1)) : 0;

    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestMatch = entry;
    }
  }

  return bestScore >= 2 ? bestMatch.answer : null;
}

function getFallback(input) {
  const t = input.toLowerCase();
  if (/\b(hi|hello|hey|greet|good (morning|afternoon|evening))\b/.test(t))
    return "Hello! Welcome to Gentaroo AI. I'm here to help you with any questions about our platform. What would you like to know?";
  if (/\b(bye|goodbye|see you|take care|quit)\b/.test(t))
    return "Goodbye! Feel free to come back anytime. Have a wonderful day!";
  if (/\b(thank|thanks|thx|appreciate)\b/.test(t))
    return "You're welcome! Is there anything else I can help you with?";
  if (/\b(price|cost|plan|pricing|paid|free|subscription|billing|charge)\b/.test(t))
    return "We offer flexible pricing plans — Basic (free), Pro, and Enterprise. Contact our sales team for a custom quote tailored to your needs.";
  if (/\b(help|support|assist|issue|problem|trouble)\b/.test(t))
    return "I'm here to help! You can reach our support team via email, live chat, or by submitting a ticket on our website. We're available 24/7.";
  if (/\b(security|secure|safe|privacy|private|encrypt|data)\b/.test(t))
    return "Your data is fully encrypted and never shared with third parties. Gentaroo AI complies with all major data protection regulations.";
  if (/\b(language|multilingual|spanish|french|german|hindi)\b/.test(t))
    return "Gentaroo AI supports English, Spanish, French, German, and Hindi. More languages are being added regularly.";
  if (/\b(integrat|connect|crm|whatsapp|platform|embed)\b/.test(t))
    return "Gentaroo AI integrates with popular platforms like websites, CRM systems, WhatsApp, and more. Contact us for the full list.";
  if (/\b(cancel|refund|stop|end)\b/.test(t))
    return "You can cancel your subscription anytime from your account settings with no cancellation fees. Your account stays active until the end of the billing period.";
  if (/\b(start|sign up|signup|register|begin|onboard)\b/.test(t))
    return "Getting started is easy! Sign up on our website, choose a plan, and your chatbot will be live within minutes — no coding required.";
  return "I'm not sure about that specific question. Could you rephrase it, or ask about our pricing, features, security, languages, or how to get started? I'm happy to help!";
}

function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [knowledge, setKnowledge] = useState([]);
  const messageListRef = useRef(null);

  useEffect(() => {
    fetch('/knowledge.txt')
      .then((res) => res.text())
      .then((text) => setKnowledge(parseKnowledge(text)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) setIsOpen(true);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const getBotResponse = (input) => {
    const fromKnowledge = searchKnowledge(knowledge, input);
    if (fromKnowledge) return fromKnowledge;
    return getFallback(input);
  };

  const handleSend = () => {
    if (!inputText.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputText,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const captured = inputText;
    setMessages((prev) => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const botResponse = {
        id: Date.now() + 1,
        text: getBotResponse(captured),
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botResponse]);
      setIsTyping(false);
    }, 900);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <>
      <div className="hero-section">
        <motion.img
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1 }}
          src="/hero.png"
          alt="Gentaroo AI Logo"
          className="hero-logo"
        />
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
        >
          Gentaroo AI
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
        >
          Your intelligent companion for seamless support.
        </motion.p>
        <motion.p
          className="scroll-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 1, 0.5, 1] }}
          transition={{ delay: 1.5, duration: 2, repeat: Infinity, repeatDelay: 2 }}
        >
          ↓ Scroll down — chat opens automatically
        </motion.p>
      </div>

      <div className="content-section">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          How can we help you?
        </motion.h2>
        <div className="feature-grid">
          {[
            { icon: '💬', title: 'Smart Conversations', desc: 'AI-powered responses based on your knowledge base.' },
            { icon: '⚡', title: 'Instant Answers', desc: 'No waiting — get accurate answers in seconds.' },
            { icon: '🔒', title: 'Secure & Private', desc: 'Your data is encrypted and never shared.' },
            { icon: '🌐', title: 'Multi-language', desc: 'Support in English, Spanish, French, German, and Hindi.' },
          ].map((f) => (
            <motion.div
              key={f.title}
              className="feature-card"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <button
        className={`chat-toggle-btn ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Toggle chat"
      >
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="chat-container"
          >
            <header className="chat-header">
              <div className="bot-avatar">
                <img src="/bot-avatar.png" alt="Bot" />
              </div>
              <div className="header-info">
                <h2>Gentaroo AI</h2>
                <p>
                  <span className="online-dot"></span>Online | Customer Support
                </p>
              </div>
              <div className="close-btn" onClick={() => setIsOpen(false)}>
                <X size={20} />
              </div>
            </header>

            <div className="message-list" ref={messageListRef}>
              <AnimatePresence>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`message ${msg.sender}-message`}
                  >
                    <div className="message-content">{msg.text}</div>
                    <span className="message-time">{msg.time}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="typing-indicator"
                >
                  <div className="dot"></div>
                  <div className="dot"></div>
                  <div className="dot"></div>
                </motion.div>
              )}
            </div>

            <div className="input-area">
              <button className="icon-btn">
                <Paperclip size={20} />
              </button>
              <input
                type="text"
                className="message-input"
                placeholder="Type your message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="send-button" onClick={handleSend}>
                <Send size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default App;
