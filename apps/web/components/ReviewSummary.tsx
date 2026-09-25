'use client';

import { motion } from 'framer-motion';
import type { ReviewData } from './quest-map.types';

export default function ReviewSummary({ data, onContinue, onRetry }: { data: ReviewData; onContinue: () => void; onRetry: () => void }) {
  const uniqueCorrect = data.correct.filter((item, index, list) => list.findIndex(entry => entry.question === item.question) === index);
  const uniqueMistakes = data.mistakes.filter((item, index, list) => list.findIndex(entry => entry.question === item.question) === index);
  const total = uniqueCorrect.length || uniqueMistakes.length;
  const score = Math.max(0, total - uniqueMistakes.filter(item => !uniqueCorrect.some(correct => correct.question === item.question)).length);
  return (
    <div className="review-backdrop" role="dialog" aria-modal="true" aria-label="World review summary">
      <motion.section initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}>
        <div className="review-hero"><span>WORLD CLEARED</span><h2>{data.title}</h2><p>You restored {score} of {total || 1} knowledge runes.</p><div><i style={{ width: `${total ? (score / total) * 100 : 100}%` }} /></div></div>
        <div className="review-content">
          <article className="known"><header><span>✓</span><div><b>What you know</b><small>Concepts secured on this journey</small></div></header>
            {uniqueCorrect.length ? <ul>{uniqueCorrect.map(item => <li key={item.question}><strong>{item.concept}</strong><span>{item.question}</span></li>)}</ul> : <p>Your mastered concepts will appear here after the next run.</p>}
          </article>
          <article className="review"><header><span>!</span><div><b>What you should review</b><small>Use these clues to sharpen your next attempt</small></div></header>
            {uniqueMistakes.length ? <ul>{uniqueMistakes.map(item => <li key={`${item.question}-${item.answer}`}><strong>{item.concept}</strong><span>{item.question}</span><em>Review: {item.correct_answer}</em></li>)}</ul> : <p>No missed concepts—an immaculate expedition.</p>}
          </article>
          <footer><button className="retry" onClick={onRetry}>↻ Retry World</button><button className="continue" onClick={onContinue}>Continue Journey →</button></footer>
        </div>
      </motion.section>
      <style jsx global>{`
        .review-backdrop{position:fixed;inset:0;z-index:110;display:grid;place-items:center;padding:24px;background:rgba(39,27,20,.72);backdrop-filter:blur(6px)}.review-backdrop>section{width:min(790px,100%);max-height:92vh;overflow:auto;border:2px solid #725336;border-radius:24px;background:#fffaf0;box-shadow:0 28px 80px rgba(24,15,9,.5)}
        .review-hero{padding:28px;background:linear-gradient(135deg,#2c3029,#171914);color:white}.review-hero>span{color:#e7b953;font-size:10px;font-weight:900;letter-spacing:.18em}.review-hero h2{margin-top:7px;font:700 27px/1.2 Georgia,serif}.review-hero p{margin-top:7px;color:#d5d5c9;font-size:12px}.review-hero>div{height:9px;margin-top:18px;overflow:hidden;border-radius:999px;background:#41463e}.review-hero i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#d7a63e,#69b46c)}
        .review-content{padding:25px}.review-content article+article{margin-top:24px}.review-content header{display:flex;align-items:center;gap:11px}.review-content header>span{display:grid;place-items:center;width:31px;height:31px;border-radius:50%;background:#dff1df;color:#287348;font-weight:900}.review-content .review header>span{background:#fff0df;color:#a25a2a}.review-content b{display:block;font-size:14px}.review-content small{display:block;margin-top:2px;color:#8b7760;font-size:10px}.review-content ul{margin:12px 0 0 42px;padding:0;list-style:none}.review-content li{display:grid;gap:3px;padding:10px 0;border-bottom:1px solid #eadfc9}.review-content li strong{color:#73502d;font-size:10px;text-transform:uppercase;letter-spacing:.06em}.review-content li span{font-size:12px;line-height:1.4}.review-content li em{color:#9c533e;font-size:10px;font-style:normal}.review-content article>p{margin:12px 0 0 42px;color:#7f6a52;font-size:12px}
        .review-backdrop footer{display:flex;justify-content:flex-end;gap:10px;margin-top:28px;padding-top:18px;border-top:1px solid #ded1b9}.review-backdrop footer button{min-height:42px;padding:0 17px;border-radius:10px;font-weight:800}.retry{border:1px solid #ad9878;background:#fffaf0;color:#604830}.continue{border:0;background:#327d51;color:white;box-shadow:0 4px 0 #225c3b}
        @media(max-width:600px){.review-backdrop{padding:0}.review-backdrop>section{align-self:end;max-height:95vh;border-radius:22px 22px 0 0}.review-hero,.review-content{padding:20px}.review-backdrop footer{flex-direction:column-reverse}.review-backdrop footer button{width:100%}}
      `}</style>
    </div>
  );
}
