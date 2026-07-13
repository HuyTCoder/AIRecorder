import { useState, useEffect, useRef } from 'react'

interface UseAudioPlayerReturn {
  isPlaying: boolean
  currentTime: number
  duration: number
  speed: number
  volume: number
  error: string | null
  play: () => void
  pause: () => void
  seek: (ratio: number) => void
  changeSpeed: (rate: number) => void
  changeVolume: (level: number) => void
}

export function useAudioPlayer(
  audioUrl: string | undefined,
  externalDuration: number = 0
): UseAudioPlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState<number>(1)
  const [volume, setVolume] = useState<number>(1)
  const [error, setError] = useState<string | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)

  useEffect(() => {
    if (!audioUrl) {
      setIsPlaying(false)
      setCurrentTime(0)
      setDuration(0)
      setError(null)
      return
    }

    const audio = new Audio(audioUrl)
    audio.crossOrigin = 'anonymous'
    audioRef.current = audio
    audio.playbackRate = 1
    audio.preload = 'metadata'
    setError(null)

    // Setup Web Audio API for 200% volume support
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (AudioContextClass) {
        const ctx = new AudioContextClass()
        const source = ctx.createMediaElementSource(audio)
        const gainNode = ctx.createGain()
        gainNode.gain.value = volume
        source.connect(gainNode)
        gainNode.connect(ctx.destination)

        audioCtxRef.current = ctx
        gainNodeRef.current = gainNode
      }
    } catch (e) {
      console.warn('Could not initialize AudioContext for amplification', e)
    }

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration || 0)
    const onPlay = () => setIsPlaying(true)
    const onPlaying = () => setIsPlaying(true)
    const onPause = () => setIsPlaying(false)
    const onEnded = () => setIsPlaying(false)
    const onError = (e: Event) => {
      const target = e.target as HTMLAudioElement
      const err = target.error
      const msg = err ? `Audio error: code=${err.code} (${err.message})` : 'Audio playback failed'
      console.error(msg, e)
      setIsPlaying(false)
      setError(msg)
    }
    const onWaiting = () => setIsPlaying(false)
    const onCanPlay = () => setError(null)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('playing', onPlaying)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    audio.addEventListener('waiting', onWaiting)
    audio.addEventListener('canplay', onCanPlay)

    return () => {
      audio.pause()
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('playing', onPlaying)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
      audio.removeEventListener('waiting', onWaiting)
      audio.removeEventListener('canplay', onCanPlay)

      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(console.error)
      }

      audioRef.current = null
      audioCtxRef.current = null
      gainNodeRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl])

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume
    } else if (audioRef.current) {
      // Fallback if AudioContext failed
      audioRef.current.volume = Math.min(1, volume)
    }
  }, [volume])

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = speed
    }
  }, [speed])

  // Real-time smooth play position tracker (60fps) to prevent laggy highlights
  useEffect(() => {
    if (!isPlaying || !audioRef.current) return

    let animationFrameId: number
    const updateRealTime = () => {
      if (audioRef.current) {
        setCurrentTime(audioRef.current.currentTime)
      }
      animationFrameId = requestAnimationFrame(updateRealTime)
    }

    animationFrameId = requestAnimationFrame(updateRealTime)
    return () => cancelAnimationFrame(animationFrameId)
  }, [isPlaying])

  const play = () => {
    if (!audioRef.current) return

    // AudioContext requires user interaction to resume
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }

    const audio = audioRef.current
    setError(null)
    audio.play().catch((err) => {
      console.error('Audio play failed:', err)
      setError(err?.message || 'Unknown playback error')
    })
  }

  const pause = () => {
    audioRef.current?.pause()
  }

  const seek = (seconds: number) => {
    const totalDuration = duration || externalDuration
    if (!audioRef.current || !totalDuration) return
    const time = Math.max(0, Math.min(totalDuration, seconds))
    audioRef.current.currentTime = time
    setCurrentTime(time)
  }

  const changeSpeed = (rate: number) => {
    setSpeed(rate)
  }

  const changeVolume = (level: number) => {
    const nextVolume = Math.max(0, Math.min(2, level)) // Allow up to 200%
    setVolume(nextVolume)
  }

  return {
    isPlaying,
    currentTime,
    duration,
    speed,
    volume,
    error,
    play,
    pause,
    seek,
    changeSpeed,
    changeVolume
  }
}
