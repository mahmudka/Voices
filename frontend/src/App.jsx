import { useState, useEffect, useCallback } from 'react'
import { Mic, MicOff, RefreshCw, Moon, Sun } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
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
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark') ||
    localStorage.getItem('theme') === 'dark'
  )
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])
  return [dark, setDark]
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

  const [status,   setStatus]   = useState('idle')      // idle | converting | done | error
  const [progress, setProgress] = useState(0)
  const [stage,    setStage]    = useState('')
  const [error,    setError]    = useState(null)

  // btn flash: null | 'success' | 'error'
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

  const convertLabel = status === 'converting' ? 'Конвертирую...' : 'Конвертировать'
  const convertVariant =
    convertFlash === 'success' ? 'success' :
    convertFlash === 'error'   ? 'destructive' :
    'default'

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 transition-colors duration-300">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Voice Converter</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Конвертация голоса · Spectral Morph + RVC ONNX
            </p>
          </div>

          <Button
            size="icon"
            variant="outline"
            onClick={() => setDark(d => !d)}
            className="mt-1 shrink-0"
            title={dark ? 'Светлая тема' : 'Тёмная тема'}
          >
            {dark
              ? <Sun  className="h-4 w-4" />
              : <Moon className="h-4 w-4" />
            }
          </Button>
        </div>

        {/* Voice Gallery */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
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
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_300px]">

          {/* Left */}
          <div className="space-y-4">

            <Card>
              <CardHeader><CardTitle className="text-base">Исходное аудио</CardTitle></CardHeader>
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
                  className="w-full"
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
              <Card className="animate-scale-in">
                <CardContent className="pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span
                      className="text-muted-foreground animate-fade-in-up"
                      key={stage}
                    >
                      {stage || 'Обработка...'}
                    </span>
                    <span className="font-medium tabular-nums">{progress}%</span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
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
              <Card className="animate-scale-in">
                <CardHeader><CardTitle className="text-base">Результат</CardTitle></CardHeader>
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

            <Card>
              <CardHeader><CardTitle className="text-base">Параметры</CardTitle></CardHeader>
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
                className="w-full"
                variant={convertVariant}
                onClick={handleConvert}
                disabled={!file || busy || !params.voiceId}
              >
                {status === 'converting'
                  ? <><span className="spinner" />{convertLabel}</>
                  : convertLabel
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
                  className="w-full"
                  onClick={handleRerender}
                  disabled={busy}
                >
                  <RefreshCw className="h-4 w-4" />
                  Рендер с новыми параметрами
                </Button>
              )}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">История</CardTitle></CardHeader>
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
