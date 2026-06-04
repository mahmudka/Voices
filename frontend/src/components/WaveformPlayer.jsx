import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download } from 'lucide-react'

export function WaveformPlayer({ url, label, downloadName }) {
  const containerRef = useRef(null)
  const wsRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!url || !containerRef.current) return

    wsRef.current?.destroy()
    setReady(false)
    setPlaying(false)

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: '#94a3b8',
      progressColor: '#0f172a',
      height: 64,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    })

    ws.load(url)
    ws.on('ready', () => setReady(true))
    ws.on('finish', () => setPlaying(false))
    wsRef.current = ws

    return () => ws.destroy()
  }, [url])

  function togglePlay() {
    if (!wsRef.current || !ready) return
    wsRef.current.playPause()
    setPlaying(p => !p)
  }

  function handleDownload() {
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName ?? 'audio.wav'
    a.click()
  }

  if (!url) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-2">
          <Button size="icon" variant="outline" onClick={togglePlay} disabled={!ready}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          {downloadName && (
            <Button size="icon" variant="outline" onClick={handleDownload} disabled={!ready}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div ref={containerRef} className="rounded-md border bg-muted/30 px-2 py-1" />
    </div>
  )
}
