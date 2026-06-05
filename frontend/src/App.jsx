import { useState, useEffect } from 'react'
import { Mic, MicOff, RefreshCw, Sun, Moon } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDropZone } from '@/components/FileDropZone'
import { VoiceGallery } from '@/components/VoiceGallery'
import { VoiceParams } from '@/components/VoiceParams'
import { WaveformPlayer } from '@/components/WaveformPlayer'
import { HistoryList } from '@/components/HistoryList'

import {
  fetchVoices, uploadAndConvert, rerender,
  fetchHistory, deleteConversion, deleteAll,
  startRecording, stopRecording,
} from '@/lib/api'
import { ensureConnected } from '@/lib/signalr'
import { cn } from '@/lib/utils'

// ── Theme ─────────────────────────────────────────────────────────────────────

function useTheme() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved ? saved === 'dark' : true   // dark by default
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
      {/* Background glows */}
      <div className="hero-glow" />
      <div className="hero-glow-orange" />

      {/* Particles */}
      {PARTICLES.map(p => (
        <div
          key={p.id}
          className="particle"
          style={{
            left: p.left,
            top: p.top,
            width:  `${p.size}px`,
            height: `${p.size}px`,
            animationDelay:    p.delay,
            animationDuration: p.dur,
            opacity: p.opacity,
          }}
        />
      ))}

      {/* Theme toggle */}
      <button
        onClick={onToggleTheme}
        className="absolute top-4 right-4 z-20 p-2 rounded-full border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
        title={dark ? 'Светлая тема' : 'Тёмная тема'}
      >
        {dark
          ? <Sun  className="h-4 w-4 text-slate-300" />
          : <Moon className="h-4 w-4 text-slate-600" />
        }
      </button>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center py-10 px-6">

        {/* Headphone + rotating rings */}
        <div className="hero-rings mb-6">
          <div className="ring ring-1" />
          <div className="ring ring-2" />
          <div className="ring ring-3" />

          {/* SVG headphone */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <svg viewBox="0 0 200 175" width="82" height="72">
              <defs>
                <linearGradient id="hpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%"   stopColor="#06b6d4" />
                  <stop offset="100%" stopColor="#0ea5e9" />
                </linearGradient>
                <filter id="gf" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {/* Headband */}
              <path
                d="M 28 98 Q 100 18 172 98"
                fill="none" stroke="url(#hpGrad)" strokeWidth="10"
                strokeLinecap="round" filter="url(#gf)"
              />
              {/* Left cup outer */}
              <rect x="5" y="87" width="26" height="52" rx="10"
                fill="#06b6d4" fillOpacity="0.12"
                stroke="url(#hpGrad)" strokeWidth="3.5"
                filter="url(#gf)"
              />
              {/* Left cup inner */}
              <rect x="12" y="96" width="12" height="34" rx="5"
                fill="#06b6d4" fillOpacity="0.4"
              />
              {/* Right cup outer */}
              <rect x="169" y="87" width="26" height="52" rx="10"
                fill="#06b6d4" fillOpacity="0.12"
                stroke="url(#hpGrad)" strokeWidth="3.5"
                filter="url(#gf)"
              />
              {/* Right cup inner */}
              <rect x="176" y="96" width="12" height="34" rx="5"
                fill="#06b6d4" fillOpacity="0.4"
              />
            </svg>
          </div>
        </div>

        <h1 className="hero-title">Voice Converter</h1>
        <p className="hero-subtitle mt-2">RVC ONNX · Spectral Morph · Real-time F0</p>
      </div>
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS = { voiceId: null, voiceType: 'male', age: 35, timbre: 'medium' }

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [dark, setDark] = useTheme()

  const [voices, setVoices] = useState([])
  const [params, setParams] = useState(DEFAULT_PARAMS)

  const [file,       setFile]       = useState(null)
  const [inputUrl,   setInputUrl]   = useState(null)
  const [outputUrl,  setOutputUrl]  = useState(null)
  const [outputFile, setOutputFile] = useState(null)
  const [sessionId,  setSessionId]  = useState(null)

  const [status,   setStatus]   = useState('idle')
  const [progress, setProgress] = useState(0)
  const [stage,    setStage]    = useState('')
  const [error,    setError]    = useState(null)

  const [convertFlash, setConvertFlash] = useState(null)

  const [recording,     setRecording]     = useState(false)
  const [history,       setHistory]       = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => { fetchVoices().then(setVoices).catch(() => {}) }, [])

  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoaded(true))
  }, [])

  // ── SignalR ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let conn
    ensureConnected().then(c => {
      conn = c
      c.on('ProgressUpdated', (_sid, pct, stg) => {
        setProgress(pct)
        setStage(stg)
      })
      c.on('ConversionCompleted', (_sid, outFile) => {
        setOutputFile(outFile)
        setOutputUrl(`/api/audio/output/${encodeURIComponent(outFile)}`)
        setStatus('done')
        setProgress(100)
        setStage('Готово')
        setConvertFlash('success')
        setTimeout(() => setConvertFlash(null), 1000)
        fetchHistory().then(setHistory).catch(() => {})
      })
      c.on('ConversionFailed', (_sid, err) => {
        setError(err)
        setStatus('error')
        setConvertFlash('error')
        setTimeout(() => setConvertFlash(null), 1000)
      })
    }).catch(() => {})
    return () => {
      conn?.off?.('ProgressUpdated')
      conn?.off?.('ConversionCompleted')
      conn?.off?.('ConversionFailed')
    }
  }, [])

  useEffect(() => {
    if (!sessionId) return
    ensureConnected().then(c => c.invoke('JoinSession', sessionId)).catch(() => {})
    return () => {
      ensureConnected().then(c => c.invoke('LeaveSession', sessionId)).catch(() => {})
    }
  }, [sessionId])

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function reset() {
    setFile(null); setInputUrl(null); setOutputUrl(null); setOutputFile(null)
    setSessionId(null); setStatus('idle'); setProgress(0); setStage(''); setError(null)
  }

  function handleFile(f) {
    reset()
    setFile(f)
    setInputUrl(URL.createObjectURL(f))
  }

  function handleVoiceSelect(voice) {
    setParams({
      voiceId:   voice.voiceId,
      voiceType: voice.gender,
      age:       voice.defaultAge,
      timbre:    voice.defaultTimbre,
    })
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function handleConvert() {
    if (!file) return
    setStatus('converting'); setProgress(0); setStage('Загрузка...')
    setError(null); setOutputUrl(null); setOutputFile(null)
    try {
      const data = await uploadAndConvert(file, params)
      setSessionId(data.sessionId)
    } catch (e) {
      setError(e.message); setStatus('error')
      setConvertFlash('error')
      setTimeout(() => setConvertFlash(null), 1000)
    }
  }

  async function handleRerender() {
    if (!sessionId) return
    setStatus('converting'); setProgress(0); setStage('Повторный рендер...')
    setError(null); setOutputUrl(null); setOutputFile(null)
    try {
      await rerender(sessionId, params)
    } catch (e) {
      setError(e.message); setStatus('error')
    }
  }

  async function handleRecord() {
    if (recording) {
      setRecording(false)
      try {
        const data = await stopRecording({
          voiceId: params.voiceId, voiceType: params.voiceType,
          age: params.age, timbre: params.timbre,
        })
        setSessionId(data.sessionId)
        setInputUrl(`/api/audio/input/${encodeURIComponent(data.inputFile)}`)
        setFile({ name: data.inputFile })
        setStatus('converting'); setProgress(0); setStage('Запись обрабатывается...')
      } catch (e) { setError(e.message); setStatus('error') }
    } else {
      try {
        reset()
        const data = await startRecording()
        setSessionId(data.sessionId)
        setRecording(true)
      } catch (e) { setError(e.message) }
    }
  }

  // ── History ─────────────────────────────────────────────────────────────────

  function handleSelectHistory(item) {
    setSessionId(item.sessionId)
    setParams({
      voiceId: item.voiceId ?? null, voiceType: item.voiceType,
      age: item.age, timbre: item.timbre,
    })
    setFile({ name: item.inputFile })
    setInputUrl(item.inputPath ? `/api/audio/input/${encodeURIComponent(item.inputFile)}` : null)
    if (item.outputFile) {
      setOutputFile(item.outputFile)
      setOutputUrl(`/api/audio/output/${encodeURIComponent(item.outputFile)}`)
    }
    setStatus(item.outputFile ? 'done' : 'idle')
    setError(null)
  }

  async function handleDelete(id) {
    await deleteConversion(id).catch(() => {})
    setHistory(h => h.filter(x => x.id !== id))
  }

  async function handleDeleteAll() {
    await deleteAll().catch(() => {})
    setHistory([])
    reset()
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const busy          = status === 'converting' || recording
  const selectedVoice = voices.find(v => v.voiceId === params.voiceId)
  const ageMin        = selectedVoice?.ageMin ?? 5
  const ageMax        = selectedVoice?.ageMax ?? 80

  const convertBtnClass = cn(
    'w-full font-semibold transition-all duration-200',
    convertFlash === 'success' && 'bg-emerald-500 hover:bg-emerald-500 border-emerald-500',
    convertFlash === 'error'   && 'bg-red-600    hover:bg-red-600    border-red-600',
    !convertFlash && !busy && params.voiceId && file &&
      'shadow-[0_0_18px_hsl(189_94%_43%/0.35)] hover:shadow-[0_0_28px_hsl(189_94%_43%/0.5)]',
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 transition-colors duration-300">
      <div className="mx-auto max-w-5xl space-y-5">

        {/* Hero */}
        <HeroSection dark={dark} onToggleTheme={() => setDark(d => !d)} />

        {/* Voice Gallery */}
        <Card className="dark:border-white/5 dark:bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base dark:text-white/90">
              Выберите голос
              {params.voiceId && (
                <span className="ml-2 text-sm font-normal text-muted-foreground animate-fade-in-up">
                  · {selectedVoice?.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VoiceGallery
              voices={voices}
              selectedId={params.voiceId}
              onSelect={handleVoiceSelect}
              disabled={busy}
            />
          </CardContent>
        </Card>

        {/* Two-column */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_300px]">

          {/* Left */}
          <div className="space-y-4">

            <Card className="dark:border-white/5">
              <CardHeader>
                <CardTitle className="text-base dark:text-white/90">Исходное аудио</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <FileDropZone
                  onFile={handleFile}
                  disabled={busy}
                  hasFile={!!file}
                />
                <Button
                  variant={recording ? 'destructive' : 'outline'}
                  onClick={handleRecord}
                  disabled={status === 'converting'}
                  className={cn(
                    'w-full gap-2',
                    recording && 'animate-pulse',
                    !recording && 'dark:border-white/10 dark:hover:border-[hsl(var(--neon-cyan)/0.5)]',
                  )}
                >
                  {recording
                    ? <><MicOff className="h-4 w-4" />Остановить запись</>
                    : <><Mic    className="h-4 w-4" />Записать с микрофона</>
                  }
                </Button>
                {file && (
                  <p className="text-xs text-muted-foreground truncate animate-fade-in-up">
                    {file.name}
                  </p>
                )}
                {inputUrl && <WaveformPlayer url={inputUrl} label="Оригинал" />}
              </CardContent>
            </Card>

            {/* Progress */}
            {status === 'converting' && (
              <Card className="animate-scale-in dark:border-[hsl(var(--neon-cyan)/0.2)]">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground animate-fade-in-up" key={stage}>
                      {stage || 'Обработка...'}
                    </span>
                    <span className="font-medium tabular-nums text-[hsl(var(--neon-cyan))]">
                      {progress}%
                    </span>
                  </div>
                  <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full progress-shimmer transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
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
                    label="Конвертированный голос"
                    downloadName={outputFile ?? 'output.wav'}
                  />
                </CardContent>
              </Card>
            )}

          </div>

          {/* Right */}
          <div className="space-y-4">

            <Card className="dark:border-white/5">
              <CardHeader>
                <CardTitle className="text-base dark:text-white/90">Параметры</CardTitle>
              </CardHeader>
              <CardContent>
                <VoiceParams
                  params={params}
                  onChange={setParams}
                  disabled={busy}
                  ageMin={ageMin}
                  ageMax={ageMax}
                />
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button
                className={convertBtnClass}
                onClick={handleConvert}
                disabled={!file || busy || !params.voiceId}
              >
                {status === 'converting'
                  ? <><span className="spinner mr-2" />Конвертирую...</>
                  : 'Конвертировать'
                }
              </Button>

              {!params.voiceId && !busy && (
                <p className="text-xs text-center text-muted-foreground animate-fade-in-up">
                  Выберите голос выше
                </p>
              )}

              {sessionId && (status === 'done' || status === 'error') && (
                <Button
                  variant="outline"
                  className="w-full gap-2 dark:border-white/10"
                  onClick={handleRerender}
                  disabled={busy}
                >
                  <RefreshCw className="h-4 w-4" />
                  Рендер с новыми параметрами
                </Button>
              )}
            </div>

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
