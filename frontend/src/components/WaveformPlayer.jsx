import { useEffect, useRef, useState } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { Button } from '@/components/ui/button'
import { Play, Pause, Download, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

const NEON_CYAN   = '#06b6d4'
const NEON_BRIGHT = '#22d3ee'

function isDark() {
  return document.documentElement.classList.contains('dark')
}

export function WaveformPlayer({ url, label, downloadName }) {
  const containerRef = useRef(null)
  const wsRef        = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [ready,   setReady]   = useState(false)
  const [error,   setError]   = useState(false)

  useEffect(() => {
    if (!url || !containerRef.current) return

    let active = true

    const prev = wsRef.current
    wsRef.current = null
    prev?.destroy()

    setReady(false)
    setPlaying(false)
    setError(false)

    const dark = isDark()
    const ws = WaveSurfer.create({
      container:     containerRef.current,
      waveColor:     dark ? '#1e3a4a' : '#cbd5e1',
      progressColor: dark ? NEON_CYAN : '#1e293b',
      cursorColor:   dark ? NEON_BRIGHT : '#64748b',
      height:        56,
      barWidth:      2,
      barGap:        1.5,
      barRadius:     2,
      normalize:     true,
    })

    ws.load(url).catch(() => { if (active) setError(true) })
    ws.on('ready',  ()  => { if (active) setReady(true) })
    ws.on('finish', ()  => { if (active) setPlaying(false) })
    ws.on('error',  (e) => { if (active) { console.error('WaveSurfer error', url, e); setError(true); setReady(false) } })
    wsRef.current = ws

    return () => {
      active = false
      wsRef.current = null
      ws.destroy()
    }
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
              playing && [
                'border-[hsl(var(--neon-cyan))]',
                'bg-[hsl(var(--neon-cyan)/0.12)]',
                'text-[hsl(var(--neon-cyan))]',
                'shadow-[0_0_10px_hsl(var(--neon-cyan)/0.35)]',
              ],
            )}
          >
            {playing
              ? <Pause className="h-4 w-4" />
              : <Play  className="h-4 w-4" />
            }
          </Button>
          {downloadName && (
            <Button size="icon" variant="outline" onClick={handleDownload} disabled={!ready}
              className="dark:border-white/10">
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
          <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
          <span className="text-xs text-destructive">Файл не найден или повреждён</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={cn(
            'rounded-lg border bg-muted/10 px-2 py-1 transition-all duration-300',
            !ready && 'animate-pulse',
            playing && 'waveform-playing',
          )}
        />
      )}
    </div>
  )
}
