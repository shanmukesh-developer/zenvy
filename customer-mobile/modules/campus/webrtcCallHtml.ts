/** Inline WebRTC engine loaded in a WebView (secure-context baseUrl). */
export const WEBRTC_CALL_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no" />
  <style>
    html,body{margin:0;padding:0;width:100%;height:100%;background:#0F172A;overflow:hidden;font-family:-apple-system,system-ui,sans-serif;}
    #remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0F172A;}
    #local{position:absolute;right:12px;top:12px;width:108px;height:152px;border-radius:14px;object-fit:cover;background:#1e293b;z-index:2;transform:scaleX(-1);border:2px solid rgba(255,255,255,.2);}
    #status{position:absolute;left:0;right:0;bottom:18px;text-align:center;color:#94A3B8;font-size:13px;font-weight:600;z-index:3;}
  </style>
</head>
<body>
  <video id="remote" autoplay playsinline></video>
  <video id="local" autoplay playsinline muted></video>
  <div id="status">Starting camera & mic…</div>
  <script>
    const ICE = { iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]};
    let pc = null, localStream = null, pendingIce = [], mediaPromise = null, tracksAdded = false, pendingOffer = null;

    function post(msg) {
      try {
        if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg));
      } catch (e) {}
    }
    function setStatus(t) { document.getElementById('status').textContent = t; }

    async function ensurePc() {
      if (pc) { attachLocalTracks(); return pc; }
      pc = new RTCPeerConnection(ICE);
      pc.onicecandidate = function (e) {
        if (e.candidate) post({ type: 'ice', candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate });
      };
      pc.onconnectionstatechange = function () {
        post({ type: 'state', state: pc.connectionState });
        if (pc.connectionState === 'connected') setStatus('');
        if (pc.connectionState === 'failed') post({ type: 'error', message: 'Peer connection failed' });
        if (pc.connectionState === 'connecting') setStatus('Connecting…');
      };
      pc.ontrack = function (e) {
        document.getElementById('remote').srcObject = e.streams[0];
        setStatus('');
      };
      attachLocalTracks();
      return pc;
    }

    function attachLocalTracks() {
      if (!pc || !localStream || tracksAdded) return;
      tracksAdded = true;
      localStream.getTracks().forEach(function (t) { try { pc.addTrack(t, localStream); } catch (e) {} });
    }

    // Wait for camera/mic before negotiating so the SDP always carries our tracks.
    async function waitForMedia() {
      if (mediaPromise) { try { await mediaPromise; } catch (e) {} }
    }

    async function flushIce() {
      if (!pc || !pc.remoteDescription) return;
      while (pendingIce.length) {
        try { await pc.addIceCandidate(new RTCIceCandidate(pendingIce.shift())); } catch (e) {}
      }
    }

    async function start(opts) {
      try {
        var wantVideo = !!opts.video;
        document.getElementById('local').style.display = wantVideo ? 'block' : 'none';
        mediaPromise = navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: wantVideo ? { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 } } : false
        });
        localStream = await mediaPromise;
        document.getElementById('local').srcObject = localStream;
        await ensurePc();
        setStatus(opts.role === 'offer' ? 'Calling…' : 'Connecting…');
        if (opts.role === 'offer') {
          await createOffer();
        } else if (pendingOffer) {
          var queued = pendingOffer; pendingOffer = null;
          await applyRemoteOffer(queued);
        }
        post({ type: 'ready' });
      } catch (err) {
        post({ type: 'error', message: String(err && err.message ? err.message : err) });
      }
    }

    async function createOffer() {
      await waitForMedia();
      await ensurePc();
      var offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
      await pc.setLocalDescription(offer);
      post({ type: 'offer', sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
    }

    async function applyRemoteOffer(sdp) {
      // Offer arrived before 'start': answer it once camera/mic are ready (see start()).
      if (!mediaPromise) { pendingOffer = sdp; return; }
      try {
        await waitForMedia();
        await ensurePc();
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIce();
        var answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        post({ type: 'answer', sdp: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      } catch (err) {
        post({ type: 'error', message: String(err && err.message ? err.message : err) });
      }
    }

    async function applyRemoteAnswer(sdp) {
      try {
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        await flushIce();
      } catch (err) {
        post({ type: 'error', message: String(err && err.message ? err.message : err) });
      }
    }

    async function addIce(candidate) {
      if (!candidate) return;
      if (!pc || !pc.remoteDescription) { pendingIce.push(candidate); return; }
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
    }

    function hangup() {
      try { if (localStream) localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      try { if (pc) pc.close(); } catch (e) {}
      pc = null; localStream = null; pendingIce = []; mediaPromise = null; tracksAdded = false; pendingOffer = null;
    }

    window.__fromRN = function (msg) {
      var data = typeof msg === 'string' ? JSON.parse(msg) : msg;
      if (!data) return;
      if (data.cmd === 'start') start(data);
      else if (data.cmd === 'create-offer') createOffer().catch(function (err) { post({ type: 'error', message: String(err && err.message ? err.message : err) }); });
      else if (data.cmd === 'remote-offer') applyRemoteOffer(data.sdp);
      else if (data.cmd === 'remote-answer') applyRemoteAnswer(data.sdp);
      else if (data.cmd === 'ice') addIce(data.candidate);
      else if (data.cmd === 'mute' && localStream) localStream.getAudioTracks().forEach(function (t) { t.enabled = !data.muted; });
      else if (data.cmd === 'video' && localStream) localStream.getVideoTracks().forEach(function (t) { t.enabled = !!data.on; });
      else if (data.cmd === 'hangup') hangup();
    };
  </script>
</body>
</html>`;
