import { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Sun, Moon, FileAudio } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { VoiceGallery } from '@/components/VoiceGallery'
import { WaveformPlayer } from '@/components/WaveformPlayer'
import { HistoryList } from '@/components/HistoryList'

import {
  fetchVoices, generate,
  fetchHistory, deleteConversion, deleteAll,
  startRecording, stopRecording,
} from '@/lib/api'
import { ensureConnected } from '@/lib/signalr'
import { cn } from '@/lib/utils'

// ── Theme ─────────────────────────────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, setDark]
}

// ── Hero ──────────────────────────────────────────────────────────────────────

const PARTICLES = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left:  `${4 + (i * 4.3) % 90}%`,
  top:   `${8 + (i * 7.1) % 78}%`,
  size:  1 + (i % 3) * 0.7,
  delay: `${(i * 0.37) % 3.5}s`,
  dur:   `${3 + (i % 4) * 0.8}s`,
  opacity: 0.15 + (i % 4) * 0.05,
}))

function HeroSection({ dark, onToggleTheme }) {
  return (
    <div className="hero-section">
      <div className="hero-glow" />
      <div className="hero-glow-orange" />

      {PARTICLES.map(p => (
        <div key={p.id} className="particle" style={{
          left: p.left, top: p.top,
          width: `${p.size}px`, height: `${p.size}px`,
          animationDelay: p.delay, animationDuration: p.dur, opacity: p.opacity,
        }} />
      ))}

      <button
        onClick={onToggleTheme}
        className="absolute top-4 right-4 z-20 p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
      >
        {dark ? <Sun className="h-4 w-4 text-slate-300" /> : <Moon className="h-4 w-4 text-slate-600" />}
      </button>

      <div className="relative z-10 flex flex-col items-center py-10 px-6">
        <div className="hero-rings mb-6">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 200 175" width="82" height="72">
              <defs>
                <linearGradient id="hpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
                <filter id="gf" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              <path d="M 28 98 Q 100 18 172 98" fill="none" stroke="url(#hpGrad)" strokeWidth="10"
                    strokeLinecap="round" filter="url(#gf)" />
              <rect x="5"   y="87" width="26" height="52" rx="10"
                    fill="#06b6d4" fillOpacity="0.12" stroke="url(#hpGrad)" strokeWidth="3.5" filter="url(#gf)" />
              <rect x="12"  y="96" width="12" height="34" rx="5" fill="#06b6d4" fillOpacity="0.4" />
              <rect x="169" y="87" width="26" height="52" rx="10"
                    fill="#06b6d4" fillOpacity="0.12" stroke="url(#hpGrad)" strokeWidth="3.5" filter="url(#gf)" />
              <rect x="176" y="96" width="12" height="34" rx="5" fill="#06b6d4" fillOpacity="0.4" />
            </svg>
          </div>
        </div>
        <h1 className="hero-title">Voice Converter</h1>
        <p className="hero-subtitle mt-2">Edge TTS · Prosody Transfer · WORLD Vocoder</p>
      </div>
    </div>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useTheme()

  const [voices,     setVoices]     = useState([])
  const [voiceId,    setVoiceId]    = useState('ru-RU-DmitryNeural')
  const [text,       setText]       = useState('')

  // Reference audio state
  const [refFile,    setRefFile]    = useState(null)
  const [refUrl,     setRefUrl]     = useState(null)
  const [recording,  setRecording]  = useState(false)

  // Output state
  const [outputUrl,  setOutputUrl]  = useState(null)
  const [outputFile, setOutputFile] = useState(null)
  const [sessionId,  setSessionId]  = useState(null)

  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState(0)
  const [stage,    setStage]    = useState('')
  const [error,    setError]    = useState(null)
  const [flash,    setFlash]    = useState(null)   // null | 'success' | 'error'

  const [history,       setHistory]       = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => { fetchVoices().then(setVoices).catch(() => {}) }, [])
  useEffect(() => {
    fetchHistory().then(setHistory).catch(() => {}).finally(() => setHistoryLoaded(true))
  }, [])

  // ── SignalR ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let conn
    ensureConnected().then(c => {
      conn = c
      c.on('ProgressUpdated', (_sid, pct, stg) => { setProgress(pct); setStage(stg) })
      c.on('ConversionCompleted', (_sid, outFile) => {
        setOutputFile(outFile)
        setOutputUrl(`/api/audio/output/${encodeURIComponent(outFile)}`)
        setStatus('done'); setProgress(100); setStage('Готово')
        setFlash('success'); setTimeout(() => setFlash(null), 1200)
        fetchHistory().then(setHistory).catch(() => {})
      })
      c.on('ConversionFailed', (_sid, err) => {
        setError(err); setStatus('error')
        setFlash('error'); setTimeout(() => setFlash(null), 1200)
      })
    }).catch(() => {})
    return () => { conn?.off?.('ProgressUpdated'); conn?.off?.('ConversionCompleted'); conn?.off?.('ConversionFailed') }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    ensureConnected().then(c => c.invoke('JoinSession', sessionId)).catch(() => {})
    return () => { ensureConnected().then(c => c.invoke('LeaveSession', sessionId)).catch(() => {}) }
  }, [sessionId])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function resetOutput() {
    setOutputUrl(null); setOutputFile(null)
    setSessionId(null); setStatus('idle')
    setProgress(0); setStage(''); setError(null)
  }

  function setRef(file, url) {
    setRefFile(file); setRefUrl(url)
  }

  function handleRefFile(e) {
    const f = e.target.files?.[0]
    if (f) { setRef(f, URL.createObjectURL(f)); e.target.value = '' }
  }

  // ── Record reference ─────────────────────────────────────────────────────────

  async function handleRecord() {
    if (recording) {
      setRecording(false)
      try {
        const data = await stopRecording()
        const url  = `/api/audio/input/${encodeURIComponent(data.inputFile)}`
        setRef({ name: data.inputFile, _path: data.refPath }, url)
      } catch (e) { setError(e.message) }
    } else {
      try {
        await startRecording()
        setRecording(true)
        setRef(null, null)
      } catch (e) { setError(e.message) }
    }
  }

  // ── Generate ─────────────────────────────────────────────────────────────────

  async function handleGenerate() {
    if (!text.trim() || !voiceId) return
    resetOutput()
    setStatus('converting'); setProgress(5); setStage('Отправка...')
    try {
      // If refFile has _path (recorded), pass it as a plain path not file blob
      const fileToSend = refFile && !refFile._path ? refFile : null
      const data = await generate(text, voiceId, fileToSend)
      setSessionId(data.sessionId)
    } catch (e) {
      setError(e.message); setStatus('error')
      setFlash('error'); setTimeout(() => setFlash(null), 1200)
    }
  }

  // ── History ─────────────────────────────────────────────────────────────────

  function handleSelectHistory(item) {
    setSessionId(item.sessionId)
    setVoiceId(item.voiceId ?? voiceId)
    setText(item.inputText ?? '')
    setOutputFile(item.outputFile ?? null)
    setOutputUrl(item.outputFile ? `/api/audio/output/${encodeURIComponent(item.outputFile)}` : null)
    setStatus(item.outputFile ? 'done' : 'idle')
    setError(null)
  }

  async function handleDelete(id) {
    await deleteConversion(id).catch(() => {})
    setHistory(h => h.filter(x => x.id !== id))
  }

  async function handleDeleteAll() {
    await deleteAll().catch(() => {})
    setHistory([]); resetOutput()
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const busy       = status === 'converting' || recording
  const canGenerate = text.trim().length > 0 && !!voiceId && !busy

  const genBtnClass = cn(
    'w-full font-semibold transition-all duration-200',
    flash === 'success' && 'bg-emerald-500 hover:bg-emerald-500 border-emerald-500',
    flash === 'error'   && 'bg-red-600    hover:bg-red-600    border-red-600',
    !flash && canGenerate &&
      'shadow-[0_0_18px_hsl(189_94%_43%/0.35)] hover:shadow-[0_0_28px_hsl(189_94%_43%/0.5)]',
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 transition-colors duration-300">
      <div className="mx-auto max-w-5xl space-y-5">

        <HeroSection dark={dark} onToggleTheme={() => setDark(d => !d)} />

        {/* Voice selector */}
        <Card className="dark:border-white/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base dark:text-white/90">
              Голос
              {voiceId && (
                <span className="ml-2 text-sm font-normal text-muted-foreground animate-fade-in-up">
                  · {voices.find(v => v.voiceId === voiceId)?.name ?? voiceId}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VoiceGallery
              voices={voices}
              selectedId={voiceId}
              onSelect={v => setVoiceId(v.voiceId)}
              disabled={busy}
            />
          </CardContent>
        </Card>

        {/* Two-column */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_300px]">

          {/* Left — Text + Reference */}
          <div className="space-y-4">

            {/* Text input */}
            <Card className="dark:border-white/5">
              <CardHeader>
                <CardTitle className="text-base dark:text-white/90">Текст для озвучки</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea
                  value={text}
                  onChange={e => setText(e.target.value)}
                  disabled={busy}
                  placeholder="Введите или вставьте текст на любом языке..."
                  rows={6}
                  className={cn(
                    'w-full resize-y rounded-lg border bg-transparent px-3 py-2.5 text-sm',
                    'placeholder:text-muted-foreground outline-none',
                    'focus:ring-1 focus:ring-[hsl(var(--neon-cyan))] focus:border-[hsl(var(--neon-cyan)/0.6)]',
                    'transition-all duration-200',
                    'dark:border-white/10 dark:bg-white/3',
                    busy && 'opacity-50 cursor-not-allowed',
                  )}
                />
                <p className="mt-1 text-xs text-muted-foreground text-right">
                  {text.length} символов
                </p>
              </CardContent>
            </Card>

            {/* Reference audio (optional) */}
            <Card className="dark:border-white/5">
              <CardHeader>
                <CardTitle className="text-base dark:text-white/90">
                  Референс интонации
                  <span className="ml-2 text-xs font-normal text-muted-foreground">(необязательно)</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Запишите или загрузите себя, читающего этот текст. Ваша интонация будет перенесена на синтезированный голос.
                </p>

                <div className="flex gap-2">
                  <Button
                    variant={recording ? 'destructive' : 'outline'}
                    onClick={handleRecord}
                    disabled={status === 'converting'}
                    className={cn('flex-1 gap-2', recording && 'animate-pulse', 'dark:border-white/10')}
                  >
                    {recording
                      ? <><MicOff className="h-4 w-4" />Остановить</>
                      : <><Mic    className="h-4 w-4" />Записать</>
                    }
                  </Button>

                  <label className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm',
                    'cursor-pointer transition-colors dark:border-white/10',
                    'hover:bg-muted/40 hover:border-[hsl(var(--neon-cyan)/0.4)]',
                    busy && 'pointer-events-none opacity-50',
                  )}>
                    <FileAudio className="h-4 w-4" />
                    Загрузить WAV
                    <input type="file" accept=".wav,audio/wav" className="hidden" onChange={handleRefFile} />
                  </label>
                </div>

                {refFile && (
                  <p className="text-xs text-[hsl(var(--neon-cyan))] truncate animate-fade-in-up">
                    {refFile.name}
                  </p>
                )}
                {refUrl && <WaveformPlayer url={refUrl} label="Референс" />}
              </CardContent>
            </Card>

            {/* Progress */}
            {status === 'converting' && (
              <Card className="animate-scale-in dark:border-[hsl(var(--neon-cyan)/0.2)]">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground animate-fade-in-up" key={stage}>
                      {stage || 'Генерация...'}
                    </span>
                    <span className="font-medium tabular-nums text-[hsl(var(--neon-cyan))]">{progress}%</span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full progress-shimmer transition-all duration-500"
                         style={{ width: `${progress}%` }} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {status === 'error' && error && (
              <Card className="border-destructive/50 animate-scale-in">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {/* Output */}
            {outputUrl && (
              <Card className="animate-scale-in dark:border-[hsl(var(--neon-cyan)/0.25)]">
                <CardHeader>
                  <CardTitle className="text-base dark:text-white/90">Результат</CardTitle>
                </CardHeader>
                <CardContent>
                  <WaveformPlayer
                    url={outputUrl}
                    label="Сгенерированный голос"
                    downloadName={outputFile ?? 'output.wav'}
                  />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right — Generate + History */}
          <div className="space-y-4">

            <Button
              className={genBtnClass}
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {status === 'converting'
                ? <><span className="spinner mr-2" />Генерирую...</>
                : 'Сгенерировать'
              }
            </Button>

            {!text.trim() && (
              <p className="text-xs text-center text-muted-foreground animate-fade-in-up">
                Введите текст выше
              </p>
            )}

            <Card className="dark:border-white/5">
              <CardHeader>
                <CardTitle className="text-base dark:text-white/90">История</CardTitle>
              </CardHeader>
              <CardContent>
                {historyLoaded
                  ? <HistoryList
                      items={history}
                      onDelete={handleDelete}
                      onDeleteAll={handleDeleteAll}
                      onSelect={handleSelectHistory}
                    />
                  : <p className="text-sm text-muted-foreground">Загрузка...</p>
                }
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
