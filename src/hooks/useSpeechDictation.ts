"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function speechErrorMessage(error: string) {
  if (error === "not-allowed" || error === "service-not-allowed") {
    return "Microphone access was blocked. Allow it in your browser’s site settings and try again.";
  }
  if (error === "audio-capture") {
    return "No working microphone was found.";
  }
  if (error === "network") {
    return "Speech recognition lost its connection. Try again.";
  }
  if (error === "no-speech") {
    return "No speech was detected. Press the mic and try again.";
  }
  return "Speech input stopped unexpectedly. Try again.";
}

export function useSpeechDictation({
  value,
  onChange,
  disabled = false,
  maxLength = 6_000,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const browserWindow = window as SpeechRecognitionWindow;
    setSupported(Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    const browserWindow = window as SpeechRecognitionWindow;
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setError("Speech input is not supported by this browser. Use Chrome, Edge, or Safari.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Microphone input requires a secure HTTPS connection.");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    const baseDraft = valueRef.current.trimEnd();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-AU";
    recognition.onstart = () => {
      setError("");
      setListening(true);
    };
    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript?.trim() ?? "";
        if (!transcript) continue;
        if (result.isFinal) {
          finalTranscript += `${finalTranscript ? " " : ""}${transcript}`;
        } else {
          interimTranscript += `${interimTranscript ? " " : ""}${transcript}`;
        }
      }
      const spokenText = [finalTranscript, interimTranscript].filter(Boolean).join(" ").trim();
      const separator = baseDraft && spokenText ? " " : "";
      onChangeRef.current(`${baseDraft}${separator}${spokenText}`.slice(0, maxLength));
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") setError(speechErrorMessage(event.error));
      setListening(false);
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setListening(false);
      setError("The microphone could not be started. Try again.");
    }
  }, [disabled, maxLength]);

  const toggle = useCallback(() => {
    if (listening) {
      stop();
    } else {
      start();
    }
  }, [listening, start, stop]);

  useEffect(() => {
    if (disabled && listening) recognitionRef.current?.stop();
  }, [disabled, listening]);

  return {
    supported,
    listening,
    error,
    clearError: () => setError(""),
    start,
    stop,
    toggle,
  };
}
