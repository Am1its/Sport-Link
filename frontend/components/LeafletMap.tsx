import React, { useRef, useEffect } from 'react';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

export type LeafletMarker = {
  placeId: string;
  lat: number;
  lng: number;
  color: string;
  icon: string;
  isGame: boolean;
  isJoined: boolean;
  clusterCount?: number;
};

type Props = {
  region: { latitude: number; longitude: number };
  markers: LeafletMarker[];
  userLocation: { latitude: number; longitude: number } | null;
  recenterTrigger: number;
  panTarget: { latitude: number; longitude: number } | null;
  clusterZoomTarget?: { latitude: number; longitude: number } | null;
  onMarkerPress: (placeId: string) => void;
  onMapPress: (lat: number, lng: number) => void;
  onZoom?: (latDelta: number, center: { lat: number; lng: number }) => void;
};

const buildHtml = (lat: number, lng: number) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.4.47/css/materialdesignicons.min.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; padding: 0; background: #e8e0d8; }
  .pin { display:flex; align-items:center; justify-content:center; border-radius:50%; box-shadow:0 2px 6px rgba(0,0,0,0.5); }
  .pin-game { width:34px; height:34px; background:#1C1C1E; border:2.5px solid #fff; }
  .pin-cluster { width:40px; height:40px; background:#1C1C1E; }
  .pin-court { width:26px; height:26px; background:rgba(255,255,255,0.92); border:1.5px solid #ccc; }
  .pin i { font-size:18px; line-height:1; }
  .pin-court i { font-size:15px; }
  .cluster-count { color:#0FEA95; font-size:13px; font-weight:900; font-family:-apple-system,system-ui,sans-serif; line-height:1; }
  .userdot { width:16px; height:16px; border-radius:50%; background:#2C82FF; border:3px solid #fff; box-shadow:0 0 0 4px rgba(40,130,255,0.3); }
  .offline { position:absolute; top:50%; left:0; right:0; transform:translateY(-50%); text-align:center; color:#8E8E93; font-family:-apple-system,system-ui,sans-serif; font-size:15px; z-index:500; pointer-events:none; }
</style>
</head>
<body>
<div id="map"></div>
<div id="offline" class="offline" style="display:none">Map needs an internet connection</div>
<script>
  function post(obj){ if(window.ReactNativeWebView){ window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } }

  if (typeof L === 'undefined') {
    document.getElementById('offline').style.display = 'block';
  } else {
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([${lat}, ${lng}], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    var markerLayer = L.layerGroup().addTo(map);
    var userLayer = L.layerGroup().addTo(map);

    map.on('click', function(e){ post({ type:'mapclick', lat:e.latlng.lat, lng:e.latlng.lng }); });

    function reportZoom(){
      var b = map.getBounds();
      var c = map.getCenter();
      post({ type:'zoom', latDelta: b.getNorth()-b.getSouth(), lat: c.lat, lng: c.lng });
    }
    map.on('zoomend moveend', reportZoom);

    window.setMarkers = function(json){
      var data = JSON.parse(json);
      markerLayer.clearLayers();
      data.forEach(function(m){
        if(m.lat==null||m.lng==null||isNaN(m.lat)||isNaN(m.lng)) return;
        var html, size;
        if(m.isGame && m.clusterCount && m.clusterCount > 1){
          var accent = m.color;
          html = '<div class="pin pin-cluster" style="border:2.5px solid '+accent+'"><span class="cluster-count">'+m.clusterCount+'</span></div>';
          size = 40;
        } else {
          var cls = m.isGame ? 'pin pin-game' : 'pin pin-court';
          var accent = m.isGame && m.isJoined ? '#0FEA95' : m.color;
          html = '<div class="'+cls+'" style="border-color:'+accent+'"><i class="mdi mdi-'+m.icon+'" style="color:'+accent+'"></i></div>';
          size = m.isGame ? 34 : 26;
        }
        var icon = L.divIcon({ html: html, className: '', iconSize: [size,size], iconAnchor: [size/2,size/2] });
        var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(markerLayer);
        marker.on('click', function(ev){ L.DomEvent.stopPropagation(ev); post({ type:'marker', placeId: m.placeId }); });
      });
    };

    window.setView = function(la, ln){ map.setView([la, ln], 15, { animate: true }); };

    window.zoomToCluster = function(la, ln){ map.setView([la, ln], map.getZoom()+2, { animate: true }); };

    window.setUser = function(la, ln){
      userLayer.clearLayers();
      if(la==null||ln==null||isNaN(la)||isNaN(ln)) return;
      var icon = L.divIcon({ html:'<div class="userdot"></div>', className:'', iconSize:[16,16], iconAnchor:[8,8] });
      L.marker([la,ln], { icon: icon, interactive:false }).addTo(userLayer);
    };

    post({ type:'ready' });
    reportZoom();
  }
</script>
</body>
</html>`;

export default function LeafletMap({
  region, markers, userLocation, recenterTrigger, panTarget, clusterZoomTarget,
  onMarkerPress, onMapPress, onZoom,
}: Props) {
  const webRef = useRef<WebView>(null);
  const readyRef = useRef(false);

  const injectMarkers = () => {
    const json = JSON.stringify(markers);
    webRef.current?.injectJavaScript(`window.setMarkers && window.setMarkers(${JSON.stringify(json)}); true;`);
  };
  const injectUser = () => {
    if (!userLocation) return;
    webRef.current?.injectJavaScript(`window.setUser && window.setUser(${userLocation.latitude}, ${userLocation.longitude}); true;`);
  };

  useEffect(() => { if (readyRef.current) injectMarkers(); }, [markers]);
  useEffect(() => { if (readyRef.current) injectUser(); }, [userLocation]);
  useEffect(() => {
    if (readyRef.current && userLocation) {
      webRef.current?.injectJavaScript(`window.setView && window.setView(${userLocation.latitude}, ${userLocation.longitude}); true;`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recenterTrigger]);
  useEffect(() => {
    if (readyRef.current && panTarget) {
      webRef.current?.injectJavaScript(`window.setView && window.setView(${panTarget.latitude}, ${panTarget.longitude}); true;`);
    }
  }, [panTarget]);
  useEffect(() => {
    if (readyRef.current && clusterZoomTarget) {
      webRef.current?.injectJavaScript(`window.zoomToCluster && window.zoomToCluster(${clusterZoomTarget.latitude}, ${clusterZoomTarget.longitude}); true;`);
    }
  }, [clusterZoomTarget]);

  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') { readyRef.current = true; injectMarkers(); injectUser(); }
      else if (msg.type === 'marker') onMarkerPress(msg.placeId);
      else if (msg.type === 'mapclick') onMapPress(msg.lat, msg.lng);
      else if (msg.type === 'zoom' && onZoom) onZoom(msg.latDelta, { lat: msg.lat, lng: msg.lng });
    } catch {}
  };

  return (
    <WebView
      ref={webRef}
      originWhitelist={['*']}
      source={{ html: buildHtml(region.latitude, region.longitude) }}
      style={{ flex: 1, backgroundColor: '#e8e0d8' }}
      onMessage={onMessage}
      javaScriptEnabled
      domStorageEnabled
    />
  );
}
