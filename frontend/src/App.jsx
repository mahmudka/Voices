import { useState, useEffect } from 'react'
import { Mic, MicOff, RefreshCw } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { FileDropZone } from '@/components/FileDropZone'
import { VoiceParams } from '@/components/VoiceParams'
import { WaveformPlayer } from '@/components/WaveformPlayer'
import { HistoryList } from '@/components/HistoryList'

import {
  uploadAndConvert, rerender, fetchHistory,
  deleteConversion, deleteAll,
  startRecording, stopRecording,
} from '@/lib/api'
import { ensureConnected } from '@/lib/signalr'

const DEFAULT_PARAMS = { voiceType: 'male', age: 30, timbre: 'medium' }

export default function App() {
  const [params, setParams] = useState(DEFAULT_PARAMS)
  const [file, setFile] = useState(null)
  const [inputUrl, setInputUrl] = useState(null)
  const [outputUrl, setOutputUrl] = useState(null)
  const [outputFile, setOutputFile] = useState(null)
  const [sessionId, setSessionId] = useState(null)

  const [status, setStatus] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [error, setError] = useState(null)

  const [recording, setRecording] = useState(false)
  const [history, setHistory] = useState([])
  const [historyLoaded, setHistoryLoaded] = useState(false)

  useEffect(() => {
    fetchHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setHistoryLoaded(true))
  }, [])

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
        fetchHistory().then(setHistory).catch(() => {})
      })
      c.on('ConversionFailed', (_sid, err) => {
        setError(err)
        setStatus('error')
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

  function reset() {
    setFile(null)
    setInputUrl(null)
    setOutputUrl(null)
    setOutputFile(null)
    setSessionId(null)
    setStatus('idle')
    setProgress(0)
    setStage('')
    setError(null)
  }

  function handleFile(f) {
    reset()
    setFile(f)
    setInputUrl(URL.createObjectURL(f))
  }

  async function handleConvert() {
    if (!file) return
    setStatus('converting')
    setProgress(0)
    setStage('Загрузка...')
    setError(null)
    setOutputUrl(null)
    setOutputFile(null)
    try {
      const data = await uploadAndConvert(file, params)
      setSessionId(data.sessionId)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  async function handleRerender() {
    if (!sessionId) return
    setStatus('converting')
    setProgress(0)
    setStage('Повторный рендер...')
    setError(null)
    setOutputUrl(null)
    setOutputFile(null)
    try {
      await rerender(sessionId, params)
    } catch (e) {
      setError(e.message)
      setStatus('error')
    }
  }

  async function handleRecord() {
    if (recording) {
      setRecording(false)
      try {
        const data = await stopRecording({
          voiceType: params.voiceType,
          age: params.age,
          timbre: params.timbre,
        })
        setSessionId(data.sessionId)
        setInputUrl(`/api/audio/input/${encodeURIComponent(data.inputFile)}`)
        setFile({ name: data.inputFile })
        setStatus('converting')
        setProgress(0)
        setStage('Запись обрабатывается...')
      } catch (e) {
        setError(e.message)
        setStatus('error')
      }
    } else {
      try {
        reset()
        const data = await startRecording()
        setSessionId(data.sessionId)
        setRecording(true)
      } catch (e) {
        setError(e.message)
      }
    }
  }

  function handleSelectHistory(item) {
    setSessionId(item.sessionId)
    setParams({ voiceType: item.voiceType, age: item.age, timbre: item.timbre })
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

  const busy = status === 'converting' || recording

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Voice Converter</h1>
          <p className="text-sm text-muted-foreground mt-1">Конвертация тембра и пола голоса · WORLD вокодер</p>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_300px]">

          {/* Left */}
          <div className="space-y-4">

            <Card>
              <CardHeader><CardTitle className="text-base">Исходное аудио</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <FileDropZone onFile={handleFile} disabled={busy} />
                <Button
                  variant={recording ? 'destructive' : 'outline'}
                  onClick={handleRecord}
                  disabled={status === 'converting'}
                  className="w-full"
                >
                  {recording ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                  {recording ? 'Остановить запись' : 'Записать с микрофона (Shure MV7i)'}
                </Button>
                {file && (
                  <p className="text-xs text-muted-foreground truncate">{file.name}</p>
                )}
                {inputUrl && <WaveformPlayer url={inputUrl} label="Оригинал" />}
              </CardContent>
            </Card>

            {status === 'converting' && (
              <Card>
                <CardContent className="pt-6 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{stage || 'Обработка...'}</span>
                    <span className="font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} />
                </CardContent>
              </Card>
            )}

            {status === 'error' && error && (
              <Card className="border-destructive/50">
                <CardContent className="pt-6">
                  <p className="text-sm text-destructive">{error}</p>
                </CardContent>
              </Card>
            )}

            {outputUrl && (
              <Card>
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
                <VoiceParams params={params} onChange={setParams} disabled={busy} />
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Button className="w-full" onClick={handleConvert} disabled={!file || busy}>
                {status === 'converting' ? 'Конвертирую...' : 'Конвертировать'}
              </Button>
              {sessionId && (status === 'done' || status === 'error') && (
                <Button variant="outline" className="w-full" onClick={handleRerender} disabled={busy}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Рендер с новыми параметрами
                </Button>
              )}
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">История</CardTitle></CardHeader>
              <CardContent>
                {historyLoaded
                  ? <HistoryList items={history} onDelete={handleDelete} onDeleteAll={handleDeleteAll} onSelect={handleSelectHistory} />
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
