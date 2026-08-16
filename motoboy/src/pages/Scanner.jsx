import React, { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'

export default function Scanner({
  onDetect,
  busy,
  error,
  hintIdle = 'Aponte para o QR da comanda',
  hintBusy = 'Buscando pedido...',
  manualPlaceholder = 'Ou digite o codigo da comanda',
  manualButtonLabel = 'Buscar',
}) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)
  const lastCodeRef = useRef('')
  const [cameraError, setCameraError] = useState('')
  const [manualCode, setManualCode] = useState('')

  const stopCamera = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const tick = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      frameRef.current = requestAnimationFrame(tick)
      return
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const result = jsQR(imageData.data, imageData.width, imageData.height)

    if (result?.data && result.data !== lastCodeRef.current) {
      lastCodeRef.current = result.data
      onDetect(result.data)
    }

    frameRef.current = requestAnimationFrame(tick)
  }, [onDetect])

  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        frameRef.current = requestAnimationFrame(tick)
      } catch {
        setCameraError('Nao foi possivel acessar a camera. Digite o codigo manualmente abaixo.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [stopCamera, tick])

  useEffect(() => {
    if (!busy) lastCodeRef.current = ''
  }, [busy])

  const handleManualSubmit = (event) => {
    event.preventDefault()
    const code = manualCode.trim()
    if (!code) return
    onDetect(code)
    setManualCode('')
  }

  return (
    <div>
      <div className="scan-view">
        <video ref={videoRef} muted playsInline />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!cameraError && <div className="scan-frame" />}
        <div className="scan-hint">
          {cameraError ? 'Camera indisponivel' : busy ? hintBusy : hintIdle}
        </div>
      </div>

      {error && (
        <div className="notice notice-danger" style={{ marginTop: 12 }}>
          {error}
        </div>
      )}

      <form className="manual-scan" style={{ marginTop: 14 }} onSubmit={handleManualSubmit}>
        <input
          type="text"
          placeholder={manualPlaceholder}
          value={manualCode}
          onChange={(event) => setManualCode(event.target.value)}
        />
        <button className="btn btn-light" type="submit" disabled={busy}>
          {manualButtonLabel}
        </button>
      </form>
    </div>
  )
}
