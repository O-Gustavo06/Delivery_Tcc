import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeStops } from '../lib/stops.js'
import {
  CENTRO_PADRAO,
  EMPRESA,
  MAPS_KEY,
  loadGoogleMaps,
  onMapsAuthFailure,
} from '../utils/googleMaps.js'
import {
  computeRoute,
  formatDistance,
  formatDuration,
  hasCoords,
  navigationUrl,
} from '../utils/routes.js'

const ROUTE_COLOR = '#2563eb'

function distanceMeters(a, b) {
  const radians = (degrees) => (degrees * Math.PI) / 180
  const lat1 = radians(a.lat)
  const lat2 = radians(b.lat)
  const deltaLat = lat2 - lat1
  const deltaLng = radians(b.lng - a.lng)
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2

  return 6371000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

function ensureMeMarker(gmaps, map, markerRef, position) {
  if (!markerRef.current) {
    markerRef.current = new gmaps.Marker({
      map,
      position,
      title: 'Voce esta aqui',
      zIndex: 999,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        scale: 8,
        fillColor: ROUTE_COLOR,
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 3,
      },
    })
  } else {
    markerRef.current.setPosition(position)
  }
}

export default function Mapa({ rota, loading }) {
  const canvasRef = useRef(null)
  const mapRef = useRef(null)
  const gmapsRef = useRef(null) // namespace google.maps
  const meMarkerRef = useRef(null)
  const routeLayersRef = useRef([]) // polyline + marcadores das paradas
  const positionRef = useRef(null)
  const routedPositionRef = useRef(null)
  const routedAtRef = useRef(0)

  const [mapStatus, setMapStatus] = useState(MAPS_KEY ? 'loading' : 'no-key') // loading | ready | no-key | error
  const [mapError, setMapError] = useState('')
  const [geoState, setGeoState] = useState('pending') // pending | granted | denied | unavailable
  const [routeInfo, setRouteInfo] = useState(null)
  const [routeError, setRouteError] = useState('')
  const [routing, setRouting] = useState(false)
  const [nonce, setNonce] = useState(0) // incrementa pra forcar recalculo da rota

  const stops = useMemo(
    () =>
      normalizeStops(rota).filter((s) => s.statusEntrega !== 'ENTREGUE' && s.statusEntrega !== 'CANCELADA'),
    [rota],
  )
  // Muda so quando a lista/ordem/destinos mudam - evita recalcular (e cobrar) a toa.
  const stopsKey = useMemo(
    () => stops.map((s) => `${s.idEntrega}:${s.lat ?? ''},${s.lng ?? ''}:${s.endereco}`).join('|'),
    [stops],
  )

  const clearRouteLayers = useCallback(() => {
    routeLayersRef.current.forEach((layer) => layer.setMap(null))
    routeLayersRef.current = []
  }, [])

  // 1) Carrega o Google Maps e cria o mapa.
  useEffect(() => {
    if (!MAPS_KEY) return undefined
    let cancelled = false

    const offAuth = onMapsAuthFailure(() => {
      if (cancelled) return
      setMapStatus('error')
      setMapError(
        'O Google recusou a chave. Confira: Maps JavaScript API habilitada, faturamento ativo e se o endereco desta pagina esta nas restricoes de referrer da chave.',
      )
    })

    ;(async () => {
      try {
        const gmaps = await loadGoogleMaps()
        if (cancelled || !canvasRef.current) return

        gmapsRef.current = gmaps
        mapRef.current = new gmaps.Map(canvasRef.current, {
          center: positionRef.current || CENTRO_PADRAO,
          zoom: positionRef.current ? 16 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: 'greedy',
          clickableIcons: false,
        })
        setMapStatus('ready')
      } catch (err) {
        if (cancelled) return
        setMapStatus('error')
        setMapError(err?.message || 'Nao foi possivel carregar o mapa.')
      }
    })()

    return () => {
      cancelled = true
      offAuth()
      clearRouteLayers()
      meMarkerRef.current?.setMap(null)
      meMarkerRef.current = null
      mapRef.current = null
    }
  }, [clearRouteLayers])

  // 2) GPS do motoboy: bolinha azul no mapa. O navegador so libera em HTTPS ou localhost.
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGeoState('unavailable')
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const position = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        positionRef.current = position
        setGeoState('granted')

        const gmaps = gmapsRef.current
        const map = mapRef.current
        if (gmaps && map) {
          ensureMeMarker(gmaps, map, meMarkerRef, position)
          const bounds = map.getBounds()
          if (!bounds?.contains(position)) map.panTo(position)
        }

        if (
          stops.length > 0 &&
          routedPositionRef.current &&
          Date.now() - routedAtRef.current >= 60000 &&
          distanceMeters(routedPositionRef.current, position) >= 100
        ) {
          setNonce((value) => value + 1)
        }
      },
      (err) => setGeoState(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [stops.length])

  // Quando o mapa fica pronto depois do 1o GPS, cria a bolinha e centraliza.
  useEffect(() => {
    if (mapStatus !== 'ready' || !positionRef.current) return
    ensureMeMarker(gmapsRef.current, mapRef.current, meMarkerRef, positionRef.current)
  }, [mapStatus, geoState])

  // Sem pedidos: so mostra o mapa centralizado no motoboy (ou na loja).
  useEffect(() => {
    if (mapStatus !== 'ready' || stops.length > 0 || !mapRef.current) return
    const target = positionRef.current || CENTRO_PADRAO
    mapRef.current.panTo(target)
    mapRef.current.setZoom(positionRef.current ? 16 : 13)
  }, [mapStatus, stops.length, geoState])

  // 3) Com pedidos: calcula e desenha a rota automaticamente.
  useEffect(() => {
    if (mapStatus !== 'ready') return undefined

    clearRouteLayers()
    setRouteError('')

    if (stops.length === 0) {
      setRouteInfo(null)
      return undefined
    }
    // Espera o 1o fix do GPS (ou a resposta de "negado") antes de escolher a origem.
    if (geoState === 'pending') return undefined

    let cancelled = false
    ;(async () => {
      setRouting(true)
      try {
        // Sem GPS, usa a loja como origem quando configurada; senao a 1a parada.
        const origin = positionRef.current || EMPRESA
        const result = await computeRoute(origin, stops)
        if (cancelled) return
        if (positionRef.current) {
          routedPositionRef.current = { ...positionRef.current }
          routedAtRef.current = Date.now()
        }

        const gmaps = gmapsRef.current
        const map = mapRef.current
        if (!gmaps || !map) return
        if (!result) {
          // 1 parada e sem GPS/loja: nao ha trecho pra tracar, so mostra o ponto.
          setRouteInfo(null)
          setRouteError('Ligue o GPS pra tracar a rota ate a parada.')
          const only = stops.filter(hasCoords)
          if (only.length) {
            const bounds = new gmaps.LatLngBounds()
            routeLayersRef.current = only.map((stop) => {
              const position = { lat: Number(stop.lat), lng: Number(stop.lng) }
              bounds.extend(position)
              return new gmaps.Marker({
                map,
                position,
                label: { text: String(stop.ordem), color: '#ffffff', fontWeight: '700' },
              })
            })
            map.fitBounds(bounds, 80)
            if (only.length === 1) map.setZoom(16)
          }
          return
        }

        const path = gmaps.geometry.encoding.decodePath(result.encodedPolyline)
        const polyline = new gmaps.Polyline({
          map,
          path,
          strokeColor: ROUTE_COLOR,
          strokeOpacity: 0.9,
          strokeWeight: 5,
        })
        const layers = [polyline]

        // Marcadores numerados na ordem de visita.
        const stopLegOffset = result.originIsStop ? -1 : 0 // leg[i + offset] termina na parada i
        stops.forEach((stop, index) => {
          const leg = result.legs[index + stopLegOffset]
          const position = hasCoords(stop)
            ? { lat: Number(stop.lat), lng: Number(stop.lng) }
            : leg?.end || (result.originIsStop && index === 0 ? path[0] : null)
          if (!position) return
          layers.push(
            new gmaps.Marker({
              map,
              position,
              title: `Parada ${stop.ordem}`,
              label: { text: String(stop.ordem), color: '#ffffff', fontWeight: '700' },
            }),
          )
        })
        routeLayersRef.current = layers

        const bounds = new gmaps.LatLngBounds()
        path.forEach((point) => bounds.extend(point))
        if (positionRef.current) bounds.extend(positionRef.current)
        map.fitBounds(bounds, 48)

        setRouteInfo({
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          nextLeg: result.legs[0] || null,
          semOrigem: result.originIsStop,
        })
      } catch (err) {
        if (!cancelled) {
          setRouteInfo(null)
          setRouteError(err?.message || 'Nao foi possivel calcular a rota.')
        }
      } finally {
        if (!cancelled) setRouting(false)
      }
    })()

    return () => {
      cancelled = true
    }
    // geoState entra pra disparar quando o 1o GPS chega; stopsKey quando a rota muda.
  }, [mapStatus, stopsKey, geoState === 'pending', nonce, clearRouteLayers]) // eslint-disable-line react-hooks/exhaustive-deps

  const recenter = () => {
    const map = mapRef.current
    if (!map || !positionRef.current) return
    map.panTo(positionRef.current)
    map.setZoom(16)
  }

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoState('unavailable')
      return
    }

    setGeoState('pending')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        positionRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setGeoState('granted')
        const gmaps = gmapsRef.current
        const map = mapRef.current
        if (gmaps && map) {
          ensureMeMarker(gmaps, map, meMarkerRef, positionRef.current)
          map.panTo(positionRef.current)
          map.setZoom(16)
        }
      },
      (err) => setGeoState(err.code === 1 ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    )
  }

  const nextStop = stops[0]

  return (
    <div className="mapa-page">
      <div className="mapa-box">
        <div ref={canvasRef} className="mapa-canvas" />

        {mapStatus === 'loading' && <div className="mapa-overlay">Carregando mapa...</div>}

        {mapStatus === 'no-key' && (
          <div className="mapa-overlay">
            <strong>Chave do Google Maps nao configurada</strong>
            <span>
              Crie o arquivo <code>motoboy/.env.local</code> com <code>VITE_GOOGLE_MAPS_API_KEY=sua_chave</code> e
              reinicie o <code>npm run dev</code>.
            </span>
          </div>
        )}

        {mapStatus === 'error' && (
          <div className="mapa-overlay">
            <strong>Nao foi possivel mostrar o mapa</strong>
            <span>{mapError}</span>
          </div>
        )}

        {mapStatus === 'ready' && geoState === 'granted' && (
          <button type="button" className="mapa-fab" onClick={recenter} aria-label="Centralizar em mim" title="Centralizar em mim">
            ◎
          </button>
        )}
      </div>

      {geoState === 'denied' && (
        <div className="notice notice-warning" role="status">
          <span>Localizacao bloqueada. Libere a permissao de localizacao nas configuracoes do navegador e tente novamente.</span>
          <button type="button" className="btn btn-light" onClick={requestLocation}>
            Tentar novamente
          </button>
        </div>
      )}
      {geoState === 'unavailable' && (
        <div className="notice notice-warning" role="status">
          <span>Nao consegui sua localizacao. O GPS precisa estar ativo e o acesso deve ser por HTTPS ou localhost.</span>
          <button type="button" className="btn btn-light" onClick={requestLocation}>
            Tentar novamente
          </button>
        </div>
      )}
      {geoState === 'pending' && (
        <div className="notice notice-warning" role="status">
          Aguardando permissao e localizacao do dispositivo...
        </div>
      )}

      {loading && stops.length === 0 && <div className="empty">Carregando rota...</div>}

      {!loading && stops.length === 0 && mapStatus === 'ready' && (
        <div className="mapa-card mapa-card-empty">
          <strong>Sem entregas no momento</strong>
          <span>Quando um pedido for atribuido a voce, a rota aparece aqui automaticamente.</span>
        </div>
      )}

      {stops.length > 0 && (
        <div className="mapa-card">
          {routing && <span className="mapa-muted">Calculando rota...</span>}

          {!routing && routeInfo && (
            <div className="mapa-summary">
              <div>
                <span className="mapa-muted">Percurso total</span>
                <strong>
                  {formatDistance(routeInfo.distanceMeters)} · {formatDuration(routeInfo.durationSeconds)}
                </strong>
              </div>
              <div>
                <span className="mapa-muted">{stops.length} {stops.length === 1 ? 'parada' : 'paradas'}</span>
                {routeInfo.nextLeg && !routeInfo.semOrigem && (
                  <strong>
                    1ª em {formatDuration(routeInfo.nextLeg.durationSeconds)}
                  </strong>
                )}
              </div>
            </div>
          )}

          {!routing && routeInfo?.semOrigem && (
            <span className="mapa-muted">Sem GPS: a rota parte da 1ª parada.</span>
          )}

          {routeError && <div className="notice notice-danger" role="alert">{routeError}</div>}

          {nextStop && (
            <div className="mapa-next">
              <span className="mapa-muted">Proxima parada</span>
              <strong>
                #{nextStop.numero} · {nextStop.endereco}
              </strong>
            </div>
          )}

          <div className="mapa-actions">
            <button type="button" className="btn btn-light" disabled={routing} onClick={() => setNonce((n) => n + 1)}>
              Recalcular daqui
            </button>
            {nextStop && (
              <a className="btn btn-primary" href={navigationUrl(nextStop)} target="_blank" rel="noreferrer">
                Navegar (Google Maps)
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
