import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, MessageSquare, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './App.css';

const INITIAL_MESSAGES = [
  {
    id: 1,
    text: "Hi there! I'm iHeal Digital AI, your companion for a healthier lifestyle. How can I help you today?",
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

    if (eq === q) score += 30;
    else if (eq.includes(q)) score += 15;
    else if (q.includes(eq)) score += 12;

    for (const word of qWords) {
      if (eqWords.includes(word)) {
        score += 4;
      } else {
        for (const ew of eqWords) {
          if (ew.startsWith(word) || word.startsWith(ew)) {
            score += 2;
            break;
          }
        }
      }
    }

    const coverage = eqWords.filter((w) => qWords.includes(w)).length / (eqWords.length || 1);
    score += coverage * 5;
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
    return "Hello! Welcome to iHeal Digital. I'm here to help you with any questions about our lifestyle platform. What would you like to know?";
  if (/\b(bye|goodbye|see you|take care|quit)\b/.test(t))
    return "Goodbye! Feel free to come back anytime to discuss your health goals. Have a wonderful day!";
  if (/\b(thank|thanks|thx|appreciate)\b/.test(t))
    return "You're welcome! Is there anything else I can help you with regarding your wellness journey?";
  if (/\b(help|support|assist|issue|problem|trouble)\b/.test(t))
    return "I'm here to help! You can reach the iHeal team at support@iheal.digital or call us at +91-8096510313.";
  return "I'm not sure about that specific question. Could you rephrase it, or ask about our services, mission, HIPAA compliance, or how to contact us?";
}

function App() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Open by default
  const [showGreeting, setShowGreeting] = useState(false);
  const [knowledge, setKnowledge] = useState([]);
  const messageListRef = useRef(null);

  const SUGGESTED_QUESTIONS = [
    "What is iHeal?",
    "How to join as expert?",
    "Is it HIPAA compliant?",
    "Contact support"
  ];

  useEffect(() => {
    fetch('/knowledge.txt')
      .then((res) => res.text())
      .then((text) => setKnowledge(parseKnowledge(text)))
      .catch(() => {});
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

  const handleSend = async (overrideText) => {
    const text = overrideText || inputText;
    if (!text.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: text,
      sender: 'user',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const currentHistory = [...messages, userMessage];
    setMessages(currentHistory);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history: currentHistory }),
      });

      if (response.ok) {
        const data = await response.json();
        const botResponse = {
          id: Date.now() + 1,
          text: data.response,
          sender: 'bot',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, botResponse]);
      } else {
        throw new Error('Backend error');
      }
    } catch (err) {
      const botResponse = {
        id: Date.now() + 1,
        text: getBotResponse(text),
        sender: 'bot',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botResponse]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  return (
    <div className="widget-wrapper">
      <div className="chat-launcher">
        <AnimatePresence>
          {showGreeting && !isOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.8 }}
              className="greeting-popup"
              onClick={() => setIsOpen(true)}
            >
              Have a question? I'm here to help! 👋
              <div className="popup-arrow"></div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          className={`chat-toggle-btn ${isOpen ? 'active' : ''}`}
          onClick={() => {
            setIsOpen((prev) => !prev);
            setShowGreeting(false);
          }}
          aria-label="Toggle chat"
        >
          {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 100, scale: 0.8 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="chat-container widget-mode"
          >
            <header className="chat-header">
              <div className="bot-avatar">
                <img src="/bot-avatar.png" alt="Bot" />
              </div>
              <div className="header-info">
                <h2>iHeal AI</h2>
                <p>
                  <span className="online-dot"></span>Online | Wellness Assistant
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

            <div className="suggestion-container">
              {messages.length < 3 && SUGGESTED_QUESTIONS.map((q) => (
                <button key={q} className="suggestion-chip" onClick={() => handleSend(q)}>
                  {q}
                </button>
              ))}
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
              <button className="send-button" onClick={() => handleSend()}>
                <Send size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
