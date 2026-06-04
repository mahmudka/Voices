import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download } from 'lucide-react'
import { cn } from '@/lib/utils'

function isDark() {
  return document.documentElement.classList.contains('dark')
}

export function WaveformPlayer({ url, label, downloadName }) {
  const containerRef = useRef(null)
  const wsRef        = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [ready,   setReady]   = useState(false)

  useEffect(() => {
    if (!url || !containerRef.current) return

    wsRef.current?.destroy()
    setReady(false)
    setPlaying(false)

    const dark = isDark()
    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     dark ? '#475569' : '#cbd5e1',
      progressColor: dark ? '#e2e8f0' : '#1e293b',
      cursorColor:   dark ? '#94a3b8' : '#64748b',
      height:        56,
      barWidth:      2,
      barGap:        1.5,
      barRadius:     2,
      normalize:     true,
    })

    ws.load(url).catch(() => {})
    ws.on('ready',  () => setReady(true))
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
    <div className="space-y-2 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className="flex gap-1.5">
          <Button
            size="icon"
            variant="outline"
            onClick={togglePlay}
            disabled={!ready}
            className={cn(
              'transition-all duration-150',
              playing && 'border-primary bg-primary/10 text-primary',
            )}
          >
            {playing
              ? <Pause className="h-4 w-4" />
              : <Play  className="h-4 w-4" />
            }
          </Button>
          {downloadName && (
            <Button size="icon" variant="outline" onClick={handleDownload} disabled={!ready}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={containerRef}
        className={cn(
          'rounded-lg border bg-muted/20 px-2 py-1',
          !ready && 'animate-pulse',
        )}
      />
    </div>
  )
}
