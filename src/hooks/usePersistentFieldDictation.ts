"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionErrorEventLike = Event & { error: string };

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
    return "Microphone access was blocked. Allow it in your browser's site settings and try again.";
  }
  if (error === "audio-capture") return "No working microphone was found.";
  if (error === "network") return "Speech recognition lost its connection. Try again.";
  return "Speech input stopped unexpectedly. Try again.";
}

export function usePersistentFieldDictation<Field extends string>({
  initialField,
  onTranscript,
  disabled = false,
}: {
  initialField: Field;
  onTranscript: (field: Field, transcript: string) => void;
  disabled?: boolean;
}) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [listening, setListening] = useState(false);
  const [activeField, setActiveField] = useState<Field>(initialField);
  const [error, setError] = useState("");
  const activeFieldRef = useRef<Field>(initialField);
  const enabledRef = useRef(false);
  const disabledRef = useRef(disabled);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRecognitionRef = useRef<() => void>(() => undefined);
  const onTranscriptRef = useRef(onTranscript);

  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);

  const clearRestartTimer = useCallback(() => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  }, []);

  const stop = useCallback(() => {
    enabledRef.current = false;
    setEnabled(false);
    clearRestartTimer();
    const recognition = recognitionRef.current;
    recognitionRef.current = null;
    recognition?.stop();
    setListening(false);
  }, [clearRestartTimer]);

  const startRecognition = useCallback(() => {
    if (!enabledRef.current || disabledRef.current || recognitionRef.current) return;
    const browserWindow = window as SpeechRecognitionWindow;
    const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
    if (!Recognition) {
      enabledRef.current = false;
      setEnabled(false);
      setError("Speech input is not supported by this browser. Use Chrome, Edge, or Safari.");
      return;
    }
    if (!window.isSecureContext) {
      enabledRef.current = false;
      setEnabled(false);
      setError("Microphone input requires a secure HTTPS connection.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = navigator.language || "en-AU";
    recognition.onstart = () => {
      setError("");
      setListening(true);
    };
    recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (!result?.isFinal) continue;
        const transcript = result[0]?.transcript?.trim() ?? "";
        if (transcript) onTranscriptRef.current(activeFieldRef.current, transcript);
      }
    };
    recognition.onerror = (event) => {
      recognitionRef.current = null;
      setListening(false);
      if (event.error === "aborted" || event.error === "no-speech") return;
      setError(speechErrorMessage(event.error));
      if (event.error === "not-allowed" || event.error === "service-not-allowed" || event.error === "audio-capture") {
        enabledRef.current = false;
        setEnabled(false);
      }
    };
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      setListening(false);
      clearRestartTimer();
      if (enabledRef.current && !disabledRef.current) {
        restartTimerRef.current = setTimeout(() => startRecognitionRef.current(), 180);
      }
    };
    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      enabledRef.current = false;
      setEnabled(false);
      setListening(false);
      setError("The microphone could not be started. Try again.");
    }
  }, [clearRestartTimer]);

  useEffect(() => {
    startRecognitionRef.current = startRecognition;
  }, [startRecognition]);

  const start = useCallback(() => {
    if (disabledRef.current) return;
    enabledRef.current = true;
    setEnabled(true);
    setError("");
    startRecognitionRef.current();
  }, []);

  const activate = useCallback((field: Field, startIfNeeded = false) => {
    activeFieldRef.current = field;
    setActiveField(field);
    if (startIfNeeded && !enabledRef.current && !disabledRef.current) {
      enabledRef.current = true;
      setEnabled(true);
      setError("");
      queueMicrotask(() => startRecognitionRef.current());
    }
  }, []);

  const toggle = useCallback(() => {
    if (enabledRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    const browserWindow = window as SpeechRecognitionWindow;
    setSupported(Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition));
    return () => {
      enabledRef.current = false;
      clearRestartTimer();
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, [clearRestartTimer]);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  return {
    supported,
    enabled,
    listening,
    activeField,
    error,
    activate,
    start,
    stop,
    toggle,
    clearError: () => setError(""),
  };
}
