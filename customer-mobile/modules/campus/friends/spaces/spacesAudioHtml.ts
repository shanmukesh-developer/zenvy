/**
 * Audio-only multi-peer WebRTC engine for Friends > Spaces, loaded in a hidden WebView
 * (same secure-context approach as the campus call engine, webrtcCallHtml.ts).
 *
 * - One RTCPeerConnection per peer userId. Who connects to whom, and in which direction, is decided
 *   by the server (space:peer_connect); this page never opens a connection on its own.
 * - Speaker → listener: speaker sends only. Speaker ↔ speaker: both ways. Listeners never send audio
 *   and never touch the microphone.
 * - Opus is capped at mono ~32 kbps (SDP maxaveragebitrate + sender maxBitrate), so a speaker
 *   uploading to 40 listeners stays around 1.3 Mbps.
 * - ICE servers come from the server's join ack (free STUN, TURN only when configured).
 * - Nothing is recorded: no MediaRecorder, no upload path. Audio only plays through the speaker.
 *
 * Commands (RN → page, window.__fromRN): start{iceServers, role, muted}, role{role, muted},
 *   connect{peer, initiator, direction}, close{peer}, signal{peer, payload}, mute{muted}, hangup.
 * Messages (page → RN): ready, signal{peer, payload}, peer_state{peer, state}, mic{ok, error?},
 *   speaking{ids}, error{message}.
 */
export const SPACES_AUDIO_HTML = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<style>html,body{margin:0;padding:0;background:#0E0D12;overflow:hidden}</style>
</head>
<body>
<script>
(function () {
  var cfg = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
  var role = 'listener';
  var muted = true;
  var localStream = null;
  var micPromise = null;
  var peers = {}; // peer -> { pc, direction, initiator, pendingIce:[], audio, analyser }
  var actx = null;
  var levelTimer = null;
  var lastSpeaking = '';
  var MAX_BITRATE = 32000;

  function post(msg) {
    try { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
  }
  function errMsg(e) { return String(e && e.message ? e.message : e); }
  function speaking(r) { return r === 'host' || r === 'cohost' || r === 'speaker'; }

  // ── Microphone (speakers only) ─────────────────────────────────────────────
  function ensureMic() {
    if (localStream) return Promise.resolve(localStream);
    if (micPromise) return micPromise;
    micPromise = navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      video: false
    }).then(function (s) {
      localStream = s;
      applyMute();
      attachAnalyser('me', s);
      attachMicAll();
      post({ type: 'mic', ok: true });
      return s;
    }).catch(function (e) {
      micPromise = null;
      post({ type: 'mic', ok: false, error: errMsg(e) });
      throw e;
    });
    return micPromise;
  }
  function stopMic() {
    Object.keys(peers).forEach(function (k) {
      try { peers[k].pc.getSenders().forEach(function (snd) { if (snd.track) snd.replaceTrack(null).catch(function () {}); }); } catch (e) {}
    });
    if (localStream) { try { localStream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} }
    localStream = null;
    micPromise = null;
    detachAnalyser('me');
  }
  function applyMute() {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(function (t) { t.enabled = !muted; });
  }

  // ── SDP: mono Opus ~32 kbps ─────────────────────────────────────────────────
  function capOpus(sdp) {
    try {
      var m = sdp.match(/a=rtpmap:(\\d+) opus\\/48000[^\\r\\n]*/i);
      if (!m) return sdp;
      var pt = m[1];
      var re = new RegExp('a=fmtp:' + pt + ' ([^\\r\\n]*)');
      var extra = { maxaveragebitrate: String(MAX_BITRATE), stereo: '0', 'sprop-stereo': '0', useinbandfec: '1' };
      if (re.test(sdp)) {
        return sdp.replace(re, function (_all, params) {
          var kv = {};
          params.split(';').forEach(function (p) { var i = p.indexOf('='); if (i > 0) kv[p.slice(0, i).trim()] = p.slice(i + 1).trim(); });
          for (var k in extra) kv[k] = extra[k];
          return 'a=fmtp:' + pt + ' ' + Object.keys(kv).map(function (k) { return k + '=' + kv[k]; }).join(';');
        });
      }
      return sdp.replace(m[0], m[0] + '\\r\\na=fmtp:' + pt + ' maxaveragebitrate=' + MAX_BITRATE + ';stereo=0;sprop-stereo=0;useinbandfec=1');
    } catch (e) { return sdp; }
  }
  function capSenders(pc) {
    try {
      pc.getSenders().forEach(function (s) {
        if (!s.track || !s.getParameters || !s.setParameters) return;
        var p = s.getParameters();
        if (!p.encodings || !p.encodings.length) p.encodings = [{}];
        p.encodings[0].maxBitrate = MAX_BITRATE;
        s.setParameters(p).catch(function () {});
      });
    } catch (e) {}
  }

  // ── Speaking levels (for the "is talking" ring) ────────────────────────────
  function ctx() {
    if (!actx) {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      try { actx = new C(); } catch (e) { return null; }
    }
    if (actx.state === 'suspended') { try { actx.resume(); } catch (e) {} }
    return actx;
  }
  var analysers = {};
  function attachAnalyser(key, stream) {
    detachAnalyser(key);
    var c = ctx();
    if (!c) return;
    try {
      var src = c.createMediaStreamSource(stream);
      var an = c.createAnalyser();
      an.fftSize = 512;
      src.connect(an);
      analysers[key] = { src: src, an: an, buf: new Uint8Array(an.fftSize) };
      startLevels();
    } catch (e) {}
  }
  function detachAnalyser(key) {
    var a = analysers[key];
    if (!a) return;
    try { a.src.disconnect(); } catch (e) {}
    delete analysers[key];
  }
  function startLevels() {
    if (levelTimer) return;
    levelTimer = setInterval(function () {
      var ids = [];
      for (var k in analysers) {
        var a = analysers[k];
        try {
          a.an.getByteTimeDomainData(a.buf);
          var sum = 0;
          for (var i = 0; i < a.buf.length; i++) { var v = (a.buf[i] - 128) / 128; sum += v * v; }
          var rms = Math.sqrt(sum / a.buf.length);
          if (rms > 0.035 && !(k === 'me' && muted)) ids.push(k);
        } catch (e) {}
      }
      ids.sort();
      var key = ids.join(',');
      if (key !== lastSpeaking) { lastSpeaking = key; post({ type: 'speaking', ids: ids }); }
    }, 250);
  }

  // ── Peers ──────────────────────────────────────────────────────────────────
  function closePeer(peer) {
    var p = peers[peer];
    if (!p) return;
    delete peers[peer];
    try { p.pc.onicecandidate = null; p.pc.ontrack = null; p.pc.onconnectionstatechange = null; p.pc.close(); } catch (e) {}
    if (p.audio) { try { p.audio.srcObject = null; p.audio.remove(); } catch (e) {} }
    detachAnalyser(peer);
    post({ type: 'peer_state', peer: peer, state: 'closed' });
  }

  function makePeer(peer, direction, initiator) {
    closePeer(peer);
    var pc = new RTCPeerConnection({ iceServers: cfg.iceServers, bundlePolicy: 'max-bundle' });
    var p = { pc: pc, direction: direction, initiator: initiator, pendingIce: [], audio: null };
    peers[peer] = p;
    pc.onicecandidate = function (e) {
      if (!e.candidate || peers[peer] !== p) return;
      var c = e.candidate.toJSON ? e.candidate.toJSON() : e.candidate;
      post({ type: 'signal', peer: peer, payload: { type: 'ice', candidate: { candidate: c.candidate || '', sdpMid: c.sdpMid == null ? null : String(c.sdpMid), sdpMLineIndex: typeof c.sdpMLineIndex === 'number' ? c.sdpMLineIndex : null } } });
    };
    pc.ontrack = function (e) {
      if (peers[peer] !== p) return;
      var stream = (e.streams && e.streams[0]) || new MediaStream([e.track]);
      if (!p.audio) {
        p.audio = document.createElement('audio');
        p.audio.autoplay = true;
        p.audio.setAttribute('playsinline', '');
        document.body.appendChild(p.audio);
      }
      p.audio.srcObject = stream;
      var play = p.audio.play();
      if (play && play.catch) play.catch(function () {});
      attachAnalyser(peer, stream);
    };
    var report = function () {
      if (peers[peer] !== p) return;
      var s = pc.connectionState || pc.iceConnectionState;
      post({ type: 'peer_state', peer: peer, state: s });
    };
    pc.onconnectionstatechange = report;
    pc.oniceconnectionstatechange = function () { if (!pc.connectionState) report(); };
    post({ type: 'peer_state', peer: peer, state: 'connecting' });
    return p;
  }

  function sends(direction) { return direction === 'sendonly' || direction === 'sendrecv'; }
  function isAudio(tr) { return !tr.receiver || !tr.receiver.track || tr.receiver.track.kind === 'audio'; }

  // Put the microphone on every connection that should carry my voice. The transceivers are
  // negotiated with a send direction even before the mic is ready, so this needs no renegotiation.
  function attachMic(p) {
    if (!localStream || !sends(p.direction)) return;
    var t = localStream.getAudioTracks()[0];
    if (!t) return;
    p.pc.getTransceivers().forEach(function (tr) {
      if (!isAudio(tr) || !tr.sender || tr.sender.track === t) return;
      tr.sender.replaceTrack(t).then(function () { capSenders(p.pc); }).catch(function () {});
    });
  }
  function attachMicAll() { Object.keys(peers).forEach(function (k) { attachMic(peers[k]); }); }

  function connect(peer, initiator, direction) {
    var p = makePeer(peer, direction, initiator);
    // Never wait for the microphone: a slow permission prompt or a refused mic must not stop
    // this person from hearing the room. The track is attached as soon as it exists.
    if (sends(direction)) ensureMic().catch(function () {});
    if (!initiator) return; // the answering side sets up its transceiver from the offer (onOffer)
    try {
      var t = localStream && localStream.getAudioTracks()[0];
      if (t) p.pc.addTransceiver(t, { direction: direction, streams: [localStream] });
      else p.pc.addTransceiver('audio', { direction: direction });
    } catch (e) {
      post({ type: 'error', peer: peer, message: errMsg(e) });
      return;
    }
    p.pc.createOffer().then(function (offer) {
      if (peers[peer] !== p) return;
      var desc = { type: offer.type, sdp: capOpus(offer.sdp) };
      return p.pc.setLocalDescription(desc).then(function () {
        attachMic(p);
        capSenders(p.pc);
        post({ type: 'signal', peer: peer, payload: { type: 'offer', sdp: p.pc.localDescription.sdp } });
      });
    }).catch(function (e) { post({ type: 'error', peer: peer, message: errMsg(e) }); });
  }

  function flushIce(p) {
    var list = p.pendingIce; p.pendingIce = [];
    list.forEach(function (c) { p.pc.addIceCandidate(new RTCIceCandidate(c)).catch(function () {}); });
  }

  function onOffer(peer, sdp) {
    var p = peers[peer];
    if (!p) p = makePeer(peer, speaking(role) ? 'sendrecv' : 'recvonly', false);
    var wantSend = sends(p.direction);
    if (wantSend) ensureMic().catch(function () {});
    p.pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: sdp })).then(function () {
      if (peers[peer] !== p) return;
      var t = wantSend && localStream ? localStream.getAudioTracks()[0] : null;
      p.pc.getTransceivers().forEach(function (tr) {
        if (!isAudio(tr)) return;
        try { tr.direction = wantSend ? (p.direction === 'sendonly' ? 'sendonly' : 'sendrecv') : 'recvonly'; } catch (e) {}
        if (t && tr.sender) tr.sender.replaceTrack(t).catch(function () {});
      });
      flushIce(p);
      return p.pc.createAnswer();
    }).then(function (answer) {
      if (!answer || peers[peer] !== p) return;
      var desc = { type: answer.type, sdp: capOpus(answer.sdp) };
      return p.pc.setLocalDescription(desc).then(function () {
        attachMic(p);
        capSenders(p.pc);
        post({ type: 'signal', peer: peer, payload: { type: 'answer', sdp: p.pc.localDescription.sdp } });
      });
    }).catch(function (e) { post({ type: 'error', peer: peer, message: errMsg(e) }); });
  }

  function onAnswer(peer, sdp) {
    var p = peers[peer];
    if (!p) return;
    p.pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: sdp }))
      .then(function () { flushIce(p); capSenders(p.pc); })
      .catch(function (e) { post({ type: 'error', peer: peer, message: errMsg(e) }); });
  }

  function onIce(peer, cand) {
    var p = peers[peer];
    if (!p || !cand) return;
    if (!p.pc.remoteDescription) { p.pendingIce.push(cand); return; }
    p.pc.addIceCandidate(new RTCIceCandidate(cand)).catch(function () {});
  }

  function hangup() {
    Object.keys(peers).forEach(closePeer);
    stopMic();
    if (levelTimer) { clearInterval(levelTimer); levelTimer = null; }
    lastSpeaking = '';
    analysers = {};
    if (actx) { try { actx.close(); } catch (e) {} actx = null; }
  }

  window.__fromRN = function (msg) {
    var d = typeof msg === 'string' ? JSON.parse(msg) : msg;
    if (!d || !d.cmd) return;
    try {
      if (d.cmd === 'start') {
        if (Array.isArray(d.iceServers) && d.iceServers.length) cfg.iceServers = d.iceServers;
        role = d.role || 'listener';
        muted = d.muted !== false;
        if (speaking(role)) ensureMic().catch(function () {});
        ctx();
      } else if (d.cmd === 'ice_servers') {
        if (Array.isArray(d.iceServers) && d.iceServers.length) cfg.iceServers = d.iceServers;
      } else if (d.cmd === 'role') {
        role = d.role || 'listener';
        if (typeof d.muted === 'boolean') muted = d.muted;
        if (speaking(role)) ensureMic().catch(function () {}); else stopMic();
        applyMute();
      } else if (d.cmd === 'connect') {
        connect(String(d.peer), !!d.initiator, d.direction || 'recvonly');
      } else if (d.cmd === 'close') {
        closePeer(String(d.peer));
      } else if (d.cmd === 'signal') {
        var pl = d.payload || {};
        if (pl.type === 'offer') onOffer(String(d.peer), pl.sdp);
        else if (pl.type === 'answer') onAnswer(String(d.peer), pl.sdp);
        else if (pl.type === 'ice') onIce(String(d.peer), pl.candidate);
      } else if (d.cmd === 'mute') {
        muted = !!d.muted;
        applyMute();
      } else if (d.cmd === 'resume') {
        ctx();
        Object.keys(peers).forEach(function (k) { var a = peers[k].audio; if (a) { var pr = a.play(); if (pr && pr.catch) pr.catch(function () {}); } });
      } else if (d.cmd === 'hangup') {
        hangup();
      }
    } catch (e) {
      post({ type: 'error', message: errMsg(e) });
    }
  };
  post({ type: 'ready' });
})();
</script>
</body>
</html>`;
