"use client";

import { ArrowClockwise, Checks, PaperPlaneRight, ShieldCheck } from "@phosphor-icons/react";
import { Fragment, useEffect, useRef, useState } from "react";
import type { OutMessage } from "@/lib/types";

type Bubble = { from: "bot" | "me"; msg: OutMessage; at: string };

/** Renders the bot's *bold* and _note_ markup plus bare links. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_|https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^\*[^*]+\*$/.test(p)) return <b key={i}>{p.slice(1, -1)}</b>;
        if (/^_[^_]+_$/.test(p))
          return (
            <span key={i} className="sim-note">
              {p.slice(1, -1)}
            </span>
          );
        if (/^https?:\/\//.test(p))
          return (
            <a key={i} href={p} target="_blank" rel="noreferrer">
              {p.replace(/^https?:\/\//, "")}
            </a>
          );
        return p;
      })}
    </>
  );
}

const now = () => new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

function newSession() {
  const id = crypto.randomUUID();
  localStorage.setItem("saathi-session", id);
  return id;
}

export default function ChatSimulator() {
  const [session, setSession] = useState<string>();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const end = useRef<HTMLDivElement>(null);
  const greeted = useRef<string>(undefined);

  useEffect(() => {
    setSession(localStorage.getItem("saathi-session") ?? newSession());
  }, []);

  useEffect(() => {
    // Ref guard: StrictMode runs effects twice in dev.
    if (session && greeted.current !== session) {
      greeted.current = session;
      void send("hi", undefined, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [bubbles, busy]);

  async function send(text: string, optionId?: string, echo = true) {
    if (!session || busy) return;
    setError(undefined);
    if (echo) setBubbles((b) => [...b, { from: "me", msg: { text }, at: now() }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session, text, optionId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { replies: OutMessage[] };
      setBubbles((b) => [...b, ...data.replies.map((msg) => ({ from: "bot" as const, msg, at: now() }))]);
    } catch {
      setError("Could not reach Scheme Saathi. Check that the server is running, then try again.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setBubbles([]);
    setError(undefined);
    setSession(newSession());
  }

  return (
    <div className="sim">
      <header className="sim-head">
        <span className="chat-avatar" aria-hidden>
          SS
        </span>
        <div className="sim-who">
          <b>Scheme Saathi</b>
          <span>{busy ? "typing…" : "bot"}</span>
        </div>
        <button className="sim-reset" onClick={reset}>
          <ArrowClockwise size={16} weight="bold" aria-hidden /> New chat
        </button>
      </header>

      <div className="sim-body" aria-live="polite">
        <div className="chat-pill">
          <ShieldCheck size={14} weight="fill" aria-hidden /> Never asks for Aadhaar, PAN or bank numbers
        </div>
        {bubbles.length === 0 && !error && (
          <div className="sim-skeleton" aria-label="Loading conversation">
            <span />
            <span />
            <span />
          </div>
        )}
        {bubbles.map((b, i) => {
          // Only the newest set of buttons is tappable, like a real chat.
          const live = !bubbles.slice(i + 1).some((x) => x.from === "me" || x.msg.options);
          return (
            <Fragment key={i}>
              <div className={`sim-msg ${b.from}`}>
                <div className="sim-text">
                  <Rich text={b.msg.text} />
                  {/* Floated inside the text so short messages still reserve room for it */}
                  <span className="sim-meta">
                    {b.at}
                    {b.from === "me" && <Checks size={14} weight="bold" className="chat-ticks" aria-hidden />}
                  </span>
                </div>
              </div>
              {b.msg.options && live && (
                // Telegram style inline keyboard under the bot's message
                <div className={`sim-keyboard ${b.msg.options.length > 3 ? "cols-2" : ""}`} role="group" aria-label="Reply options">
                  {b.msg.options.map((o) => (
                    <button key={o.id} disabled={busy} onClick={() => send(o.label, o.id)}>
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </Fragment>
          );
        })}
        {busy && bubbles.length > 0 && (
          <div className="sim-msg bot chat-typing" aria-label="Scheme Saathi is typing">
            <i />
            <i />
            <i />
          </div>
        )}
        {error && (
          <div className="sim-error" role="alert">
            {error}
          </div>
        )}
        <div ref={end} />
      </div>

      <form
        className="sim-compose"
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          void send(input.trim());
          setInput("");
        }}
      >
        <label className="sr-only" htmlFor="sim-input">
          Message
        </label>
        <input
          id="sim-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message"
          autoComplete="off"
        />
        <button aria-label="Send" disabled={busy || !input.trim()}>
          <PaperPlaneRight size={20} weight="fill" aria-hidden />
        </button>
      </form>
    </div>
  );
}
