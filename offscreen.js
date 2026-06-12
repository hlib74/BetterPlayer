const SPATIALIZER_WET_GAIN = 0.3;
const SPATIALIZER_DRY_GAIN = 0.8;
let currentStream = null;
let currentEq = null;
let currentCapturedTabId = null;
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'start-capture') {
        const { tabId, streamId, bands, isMono, isSpatial } = msg;
        cleanupCapture();
        navigator.mediaDevices.getUserMedia({
            audio: {
                mandatory: {
                    chromeMediaSource: 'tab',
                    chromeMediaSourceId: streamId
                }
            },
            video: false
        }).then(stream => {
            currentStream = stream;
            currentCapturedTabId = tabId;
            setupAudioGraph(stream, bands, isMono, isSpatial);
            stream.getAudioTracks().forEach(track => {
                track.onended = () => {
                    if (currentStream === stream) {
                        cleanupCapture();
                    }
                };
            });
            sendResponse({ success: true });
        }).catch(err => {
            console.error('Error capturing stream:', err);
            sendResponse({ success: false, error: err.message });
        });
        return true;
    } else if (msg.type === 'update-eq') {
        const { bands, isMono, isSpatial } = msg;
        if (currentEq) {
            applyEqSettings(bands, isMono, isSpatial);
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, error: 'No active EQ session' });
        }
    } else if (msg.type === 'get-eq-state') {
        if (currentEq && currentCapturedTabId === msg.tabId) {
            const bands = currentEq.filters.map(f => f.gain.value);
            sendResponse({ success: true, bands, isMono: currentEq.isMono, isSpatial: currentEq.isSpatial });
        } else {
            sendResponse({ success: false });
        }
    }
});
function cleanupCapture() {
    if (currentEq) {
        if (currentEq.ctx) {
            try {
                currentEq.ctx.close();
            } catch (e) {}
        }
        currentEq.filters = null;
        currentEq.merger = null;
        currentEq.lastNodeBeforeDest = null;
        currentEq.spatializer = null;
        currentEq.ctx = null;
        currentEq = null;
    }
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }
    currentCapturedTabId = null;
}
function setupAudioGraph(stream, eqBands, mono, spatial) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const filters = [];
        let prevNode = source;
        freqs.forEach(freq => {
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.41; 
            filter.gain.value = 0;
            prevNode.connect(filter);
            prevNode = filter;
            filters.push(filter);
        });
        const merger = audioCtx.createChannelMerger(2);
        currentEq = {
            ctx: audioCtx,
            filters: filters,
            merger: merger,
            lastNodeBeforeDest: prevNode,
            isMono: false,
            isSpatial: false,
            spatializer: null
        };
        currentEq.lastNodeBeforeDest.connect(audioCtx.destination);
        applyEqSettings(eqBands, mono, spatial);
    } catch (e) {
        console.error('Error setting up audio graph:', e);
    }
}
function applyEqSettings(eqBands, mono, spatial) {
    if (currentEq && currentEq.filters) {
        const eq = currentEq;
        const filters = eq.filters;
        for (let i = 0; i < eqBands.length; i++) {
            if (filters[i]) {
                filters[i].gain.value = eqBands[i];
            }
        }
        let needsRoutingUpdate = false;
        if (mono !== undefined && mono !== eq.isMono) {
            eq.isMono = mono;
            needsRoutingUpdate = true;
        }
        if (spatial !== undefined && spatial !== eq.isSpatial) {
            eq.isSpatial = spatial;
            needsRoutingUpdate = true;
            if (spatial && !eq.spatializer) {
                const ctx = eq.ctx;
                const convolver = ctx.createConvolver();
                const length = ctx.sampleRate * 1.5;
                const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
                const left = impulse.getChannelData(0);
                const right = impulse.getChannelData(1);
                let seedL = 12345;
                let seedR = 67890;
                for (let i = 0; i < length; i++) {
                    seedL = (seedL * 1664525 + 1013904223) % 4294967296;
                    seedR = (seedR * 1664525 + 1013904223) % 4294967296;
                    const rndL = seedL / 4294967296;
                    const rndR = seedR / 4294967296;
                    const decay = Math.exp(-i / (ctx.sampleRate * 0.3));
                    left[i] = (rndL * 2 - 1) * decay;
                    right[i] = (rndR * 2 - 1) * decay;
                }
                convolver.buffer = impulse;
                const wet = ctx.createGain();
                wet.gain.value = SPATIALIZER_WET_GAIN;
                const dry = ctx.createGain();
                dry.gain.value = SPATIALIZER_DRY_GAIN;
                const out = ctx.createGain();
                convolver.connect(wet);
                wet.connect(out);
                dry.connect(out);
                eq.spatializer = { convolver, wet, dry, out };
            }
        }
        if (needsRoutingUpdate) {
            eq.lastNodeBeforeDest.disconnect();
            if (eq.merger) eq.merger.disconnect();
            if (eq.spatializer) {
                eq.spatializer.out.disconnect();
            }
            let currentNode = eq.lastNodeBeforeDest;
            if (eq.isSpatial) {
                currentNode.connect(eq.spatializer.convolver);
                currentNode.connect(eq.spatializer.dry);
                currentNode = eq.spatializer.out;
            }
            if (eq.isMono) {
                currentNode.connect(eq.merger, 0, 0);
                currentNode.connect(eq.merger, 0, 1);
                currentNode = eq.merger;
            }
            currentNode.connect(eq.ctx.destination);
        }
        if (eq.ctx.state === 'suspended') {
            eq.ctx.resume();
        }
    }
}
