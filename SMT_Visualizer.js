    const brokerInput = document.getElementById('brokerInput');
    const kernelInput = document.getElementById('kernelInput');
    const svg = document.getElementById('svg');
    const canvasWrap = document.querySelector('.canvas-wrap');
    const legend = document.getElementById('legend');
    const errorBox = document.getElementById('errorBox');
    const machineTitle = document.getElementById('machineTitle');
    const machineMeta = document.getElementById('machineMeta');
    const viewport = document.getElementById('viewport');
    const edgeTooltip = document.getElementById('edgeTooltip');
    const exportBtn = document.getElementById('exportBtn');
    const resetLayoutBtn = document.getElementById('resetLayoutBtn');
    const editModeBtn = document.getElementById('editModeBtn');
    const editWarning = document.getElementById('editWarning');
    const editToolbar = document.getElementById('editToolbar');
    const addStateBtn = document.getElementById('addStateBtn');
    const rollbackBtn = document.getElementById('rollbackBtn');
    const showSelfLoops = document.getElementById('showSelfLoops');
    const showOutputs = document.getElementById('showOutputs');
    const showEventNames = document.getElementById('showEventNames');
    const showTransactions = document.getElementById('showTransactions');
    const showReachableCascade = document.getElementById('showReachableCascade');
    const showUnused = document.getElementById('showUnused');
    const spacingRange = document.getElementById('spacingRange');
    const spacingValue = document.getElementById('spacingValue');
    const brokerFileBtn = document.getElementById('brokerFileBtn');
    const brokerEditBtn = document.getElementById('brokerEditBtn');
    const brokerFileInput = document.getElementById('brokerFileInput');
    const brokerStatus = document.getElementById('brokerStatus');
    const kernelFileBtn = document.getElementById('kernelFileBtn');
    const kernelEditBtn = document.getElementById('kernelEditBtn');
    const kernelFileInput = document.getElementById('kernelFileInput');
    const kernelStatus = document.getElementById('kernelStatus');
    const summaryPanel = document.getElementById('summaryPanel');
    const summaryTitle = document.getElementById('summaryTitle');
    const summarySub = document.getElementById('summarySub');
    const summaryBody = document.getElementById('summaryBody');
    const summaryClose = document.getElementById('summaryClose');
    const editPanel = document.getElementById('editPanel');
    const editTitle = document.getElementById('editTitle');
    const editSub = document.getElementById('editSub');
    const editBody = document.getElementById('editBody');
    const editClose = document.getElementById('editClose');
    const editDialog = document.querySelector('.edit-dialog');
    const editHead = document.querySelector('.edit-head');
    const confirmPanel = document.getElementById('confirmPanel');
    const confirmTitle = document.getElementById('confirmTitle');
    const confirmText = document.getElementById('confirmText');
    const confirmCancelBtn = document.getElementById('confirmCancelBtn');
    const confirmAcceptBtn = document.getElementById('confirmAcceptBtn');
    const brokerWindow = document.getElementById('brokerWindow');
    const kernelWindow = document.getElementById('kernelWindow');
    const brokerEditor = document.getElementById('brokerEditor');
    const kernelEditor = document.getElementById('kernelEditor');
    const brokerWindowClose = document.getElementById('brokerWindowClose');
    const kernelWindowClose = document.getElementById('kernelWindowClose');

    const NS = 'http://www.w3.org/2000/svg';
    const SVG_FONT_STACK = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif';
    const BOX_W = 208;
    const BOX_H = 72;
    const PADDING_X = 110;
    const PADDING_Y = 90;
    const COL_GAP = 190;
    const ROW_GAP = 120;
    const LABEL_MAX_WIDTH = 190;
    const LABEL_LINE_HEIGHT = 14;
    const LABEL_MAX_LINES = 2;
    const LABEL_STACK_GAP = 8;
    const LABEL_SOURCE_OFFSET = 18;
    const CHEVRON_SPACING = 34;
    const CHEVRON_SIZE = 7;

    let graph = null;
    let dragged = null;
    let draggedLabelKey = null;
    let draggedLabelStart = null;
    let dragOffset = {x: 0, y: 0};
    let dragPointer = null;
    let dragFramePending = false;
    let dragMoved = false;
    let svgDragHandlersBound = false;
    let spacingScale = Number(spacingRange.value || 100) / 100;
    let legendCollapsed = false;
    let autoRenderTimer = null;
    let editMode = false;
    let brokerFileHandle = null;
    let kernelFileHandle = null;
    let editHistory = [];
    let lastParsedBroker = null;
    let lastParsedKernel = null;
    let pendingTransitionStartId = null;
    let pendingTransitionPointer = null;
    let confirmResolver = null;
    let editDialogOffset = { x: 0, y: 0 };
    let editDialogDrag = null;
    const xmlWindowState = {
      broker: { element: null, editor: null, offset: { x: 0, y: 0 }, drag: null },
      kernel: { element: null, editor: null, offset: { x: 0, y: 0 }, drag: null }
    };

    xmlWindowState.broker.element = brokerWindow;
    xmlWindowState.broker.editor = brokerEditor;
    xmlWindowState.kernel.element = kernelWindow;
    xmlWindowState.kernel.editor = kernelEditor;

    function escapeHtml(str='') {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function hashText(value = '') {
      let hash = 5381;
      for (let i = 0; i < value.length; i++) hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
      return (hash >>> 0).toString(36);
    }

    function buildLayoutCacheKey(broker) {
      const brokerKey = broker?.fsmId || broker?.id || broker?.name || hashText(brokerInput.value.trim());
      return `smt-layout:${brokerKey}`;
    }

    function restoreLayoutFromSession(model) {
      try {
        const raw = sessionStorage.getItem(model.layoutCacheKey);
        if (!raw) return false;
        const cached = JSON.parse(raw);
        let restored = 0;

        for (const [id, pos] of Object.entries(cached.states || {})) {
          const state = model.statesMap.get(id);
          if (!state) continue;
          if (typeof pos.x === 'number') state.x = pos.x;
          if (typeof pos.y === 'number') state.y = pos.y;
          restored++;
        }

        model.labelOffsets = new Map(Object.entries(cached.labelOffsets || {}));
        return restored > 0;
      } catch {
        return false;
      }
    }

    function saveLayoutToSession() {
      if (!graph?.layoutCacheKey) return;
      try {
        const states = {};
        graph.statesMap.forEach((state, id) => {
          states[id] = { x: state.x, y: state.y };
        });

        const labelOffsets = {};
        graph.labelOffsets?.forEach((value, key) => {
          labelOffsets[key] = value;
        });

        sessionStorage.setItem(graph.layoutCacheKey, JSON.stringify({ states, labelOffsets }));
      } catch {
      }
    }

    function showError(message) {
      errorBox.textContent = message;
      errorBox.style.display = 'block';
    }

    function getXmlPair(kind) {
      return kind === 'broker'
        ? { source: brokerInput, editor: brokerEditor, window: brokerWindow }
        : { source: kernelInput, editor: kernelEditor, window: kernelWindow };
    }

    function setXmlText(kind, value, from = 'both') {
      const pair = getXmlPair(kind);
      if (from === 'both' || from === 'source') pair.source.value = value;
      if (from === 'both' || from === 'editor') pair.editor.value = value;
      const compact = String(value || '').trim();
      const lines = compact ? compact.split(/\r?\n/).length : 0;
      const chars = compact.length;
      const status = kind === 'broker' ? brokerStatus : kernelStatus;
      if (status) {
        status.textContent = compact
          ? `${lines} righe caricate - ${chars.toLocaleString('it-IT')} caratteri`
          : 'Nessun contenuto caricato.';
      }
    }

    function openXmlWindow(kind) {
      const pair = getXmlPair(kind);
      const sourceValue = pair.source.value;
      const editorValue = pair.editor.value;
      const nextValue = sourceValue || editorValue || '';
      pair.source.value = nextValue;
      pair.editor.value = nextValue;
      pair.window.classList.add('open');
      pair.window.style.transform = `translate(${xmlWindowState[kind].offset.x}px, ${xmlWindowState[kind].offset.y}px)`;
      pair.editor.focus();
    }

    function closeXmlWindow(kind) {
      getXmlPair(kind).window.classList.remove('open');
    }

    function clampXmlWindowOffset(kind, nextX, nextY) {
      const state = xmlWindowState[kind];
      const win = state.element;
      const rect = win.getBoundingClientRect();
      const maxX = Math.max(0, window.innerWidth - rect.width - 24);
      const maxY = Math.max(0, window.innerHeight - rect.height - 24);
      return {
        x: Math.max(-win.offsetLeft + 12, Math.min(maxX - win.offsetLeft, nextX)),
        y: Math.max(-win.offsetTop + 12, Math.min(maxY - win.offsetTop, nextY))
      };
    }

    function clearLayoutCache(cacheKey) {
      if (!cacheKey) return;
      try {
        sessionStorage.removeItem(cacheKey);
      } catch {
      }
    }

    function getNodePalette(state) {
      const isFinal = !!state?.final;
      const isUnreachable = !state?.reachable;
      return {
        isFinal,
        isUnreachable,
        fill: isUnreachable ? '#f3f4f6' : (isFinal ? '#fff1f0' : '#eef4ff'),
        stroke: isUnreachable ? '#9ca3af' : (isFinal ? '#d92d20' : '#2f6fda'),
        innerStroke: isUnreachable ? '#9ca3af' : (isFinal ? '#d92d20' : '#2f6fda')
      };
    }

    function applyNodeVisualState(nodeEl, state, override = null) {
      if (!nodeEl || !state) return;
      const shell = nodeEl.querySelector('.node-shell');
      const inner = nodeEl.querySelector('.node-inner-ring');
      const palette = override || getNodePalette(state);
      shell?.setAttribute('fill', palette.fill);
      shell?.setAttribute('stroke', palette.stroke);
      shell?.setAttribute('stroke-dasharray', palette.isUnreachable ? '8 6' : 'none');
      inner?.setAttribute('stroke', palette.innerStroke);
    }

    function updateEditModeUI() {
      editModeBtn.classList.toggle('active', editMode);
      editWarning.classList.toggle('active', editMode);
      editToolbar.classList.toggle('active', editMode);
      canvasWrap.classList.toggle('edit-active', editMode);
      rollbackBtn.disabled = editHistory.length === 0;
      rollbackBtn.style.opacity = editHistory.length === 0 ? '0.5' : '1';
      rollbackBtn.style.cursor = editHistory.length === 0 ? 'not-allowed' : 'pointer';
    }

    function cancelPendingTransition() {
      pendingTransitionStartId = null;
      pendingTransitionPointer = null;
      svg.querySelector('#pendingTransitionLayer')?.remove();
    }

    function startPendingTransition(stateId) {
      pendingTransitionStartId = stateId;
      pendingTransitionPointer = null;
      drawPendingTransition();
    }

    function drawPendingTransition() {
      svg.querySelector('#pendingTransitionLayer')?.remove();
      if (!editMode || !pendingTransitionStartId || !graph || !pendingTransitionPointer) return;
      const from = graph.statesMap.get(pendingTransitionStartId);
      if (!from) return;
      const startSide = chooseAnchorForPoint(from, pendingTransitionPointer);
      const start = sidePoint(from, startSide);
      const end = pendingTransitionPointer;
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const bend = Math.max(36, Math.min(120, Math.abs(dx) * 0.28 + Math.abs(dy) * 0.18));
      let c1;
      let c2;

      if (startSide === 'right') {
        c1 = { x: start.x + bend, y: start.y };
        c2 = { x: end.x - Math.max(24, bend * 0.6), y: end.y };
      } else if (startSide === 'left') {
        c1 = { x: start.x - bend, y: start.y };
        c2 = { x: end.x + Math.max(24, bend * 0.6), y: end.y };
      } else if (startSide === 'bottom') {
        c1 = { x: start.x, y: start.y + bend };
        c2 = { x: end.x, y: end.y - Math.max(24, bend * 0.6) };
      } else {
        c1 = { x: start.x, y: start.y - bend };
        c2 = { x: end.x, y: end.y + Math.max(24, bend * 0.6) };
      }

      const layer = createSvg('g', { id: 'pendingTransitionLayer' });
      createSvg('path', {
        d: `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
        fill: 'none',
        stroke: '#f59e0b',
        'stroke-width': 2.2,
        'stroke-dasharray': '8 6',
        'marker-end': 'url(#arrow)'
      }, layer);
    }

    function renderIconPath(parent, pathData, attrs = {}) {
      return createSvg('path', {
        d: pathData,
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': 1.7,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        ...attrs
      }, parent);
    }

    function escapeXml(str = '') {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    }

    function cloneBroker(broker) {
      return {
        id: broker.id || '',
        name: broker.name || '',
        fsmId: broker.fsmId || '',
        states: broker.states.map(state => ({ ...state })),
        inputEvents: broker.inputEvents.map(event => ({ ...event })),
        outputs: broker.outputs.map(output => ({ ...output }))
      };
    }

    function cloneKernel(kernel) {
      return {
        id: kernel.id || '',
        name: kernel.name || '',
        version: kernel.version || '',
        states: kernel.states.map(state => ({ ...state })),
        transitions: kernel.transitions.map(transition => ({ ...transition }))
      };
    }

    function snapshotCurrentXml() {
      return {
        brokerText: brokerInput.value,
        kernelText: kernelInput.value
      };
    }

    function pushEditHistory() {
      const snapshot = snapshotCurrentXml();
      const previous = editHistory[editHistory.length - 1];
      if (previous && previous.brokerText === snapshot.brokerText && previous.kernelText === snapshot.kernelText) return;
      editHistory.push(snapshot);
      if (editHistory.length > 20) editHistory = editHistory.slice(-20);
      updateEditModeUI();
    }

    function findStateDefinition(id) {
      if (!id) return null;
      const brokerState = lastParsedBroker?.states?.find(state => state.id === id) || null;
      const kernelState = lastParsedKernel?.states?.find(state => state.id === id) || null;
      return brokerState || kernelState;
    }

    function getNextStateId(broker, kernel) {
      const ids = [...broker.states, ...kernel.states]
        .map(state => state.id)
        .filter(id => /^S\d+$/i.test(id))
        .map(id => Number(id.slice(1)))
        .filter(Number.isFinite);
      let next = ids.length ? Math.max(...ids) + 1 : 0;
      let candidate = `S${next}`;
      const used = new Set([...broker.states, ...kernel.states].map(state => state.id));
      while (used.has(candidate)) {
        next += 1;
        candidate = `S${next}`;
      }
      return candidate;
    }

    function getNextTransitionId(kernel) {
      const ids = kernel.transitions
        .map(transition => transition.id)
        .filter(id => /^T\d+$/i.test(id))
        .map(id => Number(id.slice(1)))
        .filter(Number.isFinite);
      let next = ids.length ? Math.max(...ids) + 1 : 0;
      let candidate = `T${next}`;
      const used = new Set(kernel.transitions.map(transition => transition.id));
      while (used.has(candidate)) {
        next += 1;
        candidate = `T${next}`;
      }
      return candidate;
    }

    function ensureKernelState(kernel, state) {
      const existing = kernel.states.find(item => item.id === state.id);
      if (existing) {
        existing.name = state.name;
        existing.initial = state.initial;
        existing.final = state.final;
        return;
      }
      kernel.states.push({
        id: state.id,
        name: state.name,
        initial: state.initial,
        final: state.final
      });
    }

    function serializeBroker(broker) {
      const stateLines = broker.states.map(state => {
        const attrs = [`id="${escapeXml(state.id)}"`];
        if (state.initial) attrs.push('initial="true"');
        if (state.final) attrs.push('final="true"');
        return `    <State ${attrs.join(' ')}>${escapeXml(state.name)}</State>`;
      }).join('\n');
      const eventLines = broker.inputEvents.map(event => {
        const attrs = [`id="${escapeXml(event.id)}"`];
        if (event.initial) attrs.push('initial="true"');
        return `    <InputEvent ${attrs.join(' ')}>${escapeXml(event.name)}</InputEvent>`;
      }).join('\n');
      const outputLines = broker.outputs.map(output => `    <OutputFunction id="${escapeXml(output.id)}">${escapeXml(output.name)}</OutputFunction>`).join('\n');
      const rootAttrs = [`id="${escapeXml(broker.id)}"`, `name="${escapeXml(broker.name)}"`];
      if (broker.fsmId) rootAttrs.push(`fsmId="${escapeXml(broker.fsmId)}"`);
      return `<BrokerStateMachine ${rootAttrs.join(' ')}>\n  <States>\n${stateLines}\n  </States>\n  <InputEvents>\n${eventLines}\n  </InputEvents>\n  <OutputFunctions>\n${outputLines}\n  </OutputFunctions>\n</BrokerStateMachine>`;
    }

    function serializeKernel(kernel) {
      const stateLines = kernel.states.map(state => {
        const attrs = [`id="${escapeXml(state.id)}"`];
        if (state.initial) attrs.push('initial="true"');
        if (state.final) attrs.push('final="true"');
        return `    <State ${attrs.join(' ')}>${escapeXml(state.name)}</State>`;
      }).join('\n');
      const transitionLines = kernel.transitions.map(transition => {
        return `    <Transaction id="${escapeXml(transition.id)}"><CurrentState>${escapeXml(transition.from)}</CurrentState><InputEvent>${escapeXml(transition.eventId)}</InputEvent><NextState>${escapeXml(transition.to)}</NextState><OutputFunction>${escapeXml(transition.outputId)}</OutputFunction></Transaction>`;
      }).join('\n');
      const rootAttrs = [`id="${escapeXml(kernel.id)}"`, `name="${escapeXml(kernel.name)}"`];
      if (kernel.version) rootAttrs.push(`version="${escapeXml(kernel.version)}"`);
      return `<StateMachine ${rootAttrs.join(' ')}>\n  <States>\n${stateLines}\n  </States>\n  <Transactions>\n${transitionLines}\n  </Transactions>\n</StateMachine>`;
    }

    async function writeTextToHandle(handle, text) {
      if (!handle?.createWritable) return;
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
    }

    async function persistXmlToFiles() {
      await Promise.all([
        writeTextToHandle(brokerFileHandle, brokerInput.value),
        writeTextToHandle(kernelFileHandle, kernelInput.value)
      ]);
    }

    async function applyEditableMutation(mutator, options = {}) {
      const brokerText = brokerInput.value.trim();
      const kernelText = kernelInput.value.trim();
      if (!brokerText || !kernelText) throw new Error('Carica prima Broker XML e Kernel XML');

      const broker = cloneBroker(parseBroker(xmlFromString(brokerText)));
      const kernel = cloneKernel(parseKernel(xmlFromString(kernelText)));
      const previousNodePositions = graph ? [...graph.statesMap.values()].map(state => ({ id: state.id, x: state.x, y: state.y })) : [];

      pushEditHistory();
      await mutator(broker, kernel);

      setXmlText('broker', serializeBroker(broker));
      setXmlText('kernel', serializeKernel(kernel));

      if (!options.skipPersist) await persistXmlToFiles();
      renderAll();
      if (graph && previousNodePositions.length) {
        previousNodePositions.forEach(pos => {
          const state = graph.statesMap.get(pos.id);
          if (!state) return;
          state.x = pos.x;
          state.y = pos.y;
        });
        rerenderPreservingPositions();
        saveLayoutToSession();
      }
      updateEditModeUI();
    }

    function xmlFromString(text) {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      const err = doc.querySelector('parsererror');
      if (err) throw new Error('XML non valido: ' + err.textContent.trim().slice(0, 180));
      return doc;
    }

    function textOf(node, sel) {
      return node.querySelector(sel)?.textContent?.trim() || '';
    }

    function parseBroker(doc) {
      const root = doc.querySelector('BrokerStateMachine');
      if (!root) throw new Error('BrokerStateMachine non trovato');

      const states = [...root.querySelectorAll(':scope > States > State')].map(s => ({
        id: s.getAttribute('id'),
        name: s.textContent.trim(),
        initial: s.getAttribute('initial') === 'true',
        final: s.getAttribute('final') === 'true'
      }));

      const inputEvents = [...root.querySelectorAll(':scope > InputEvents > InputEvent')].map(e => ({
        id: e.getAttribute('id'),
        name: e.textContent.trim(),
        initial: e.getAttribute('initial') === 'true'
      }));

      const outputs = [...root.querySelectorAll(':scope > OutputFunctions > OutputFunction')].map(o => ({
        id: o.getAttribute('id'),
        name: o.textContent.trim()
      }));

      return {
        id: root.getAttribute('id') || '',
        name: root.getAttribute('name') || '',
        fsmId: root.getAttribute('fsmId') || '',
        states,
        inputEvents,
        outputs
      };
    }

    function parseKernel(doc) {
      const root = doc.querySelector('StateMachine');
      if (!root) throw new Error('StateMachine non trovato');

      const states = [...root.querySelectorAll(':scope > States > State')].map(s => ({
        id: s.getAttribute('id'),
        name: s.textContent.trim(),
        initial: s.getAttribute('initial') === 'true',
        final: s.getAttribute('final') === 'true'
      }));

      const transitions = [...root.querySelectorAll(':scope > Transactions > Transaction')].map(t => ({
        id: t.getAttribute('id') || '',
        from: textOf(t, 'CurrentState'),
        eventId: textOf(t, 'InputEvent'),
        to: textOf(t, 'NextState'),
        outputId: textOf(t, 'OutputFunction')
      }));

      return {
        id: root.getAttribute('id') || '',
        name: root.getAttribute('name') || '',
        version: root.getAttribute('version') || '',
        states,
        transitions
      };
    }

    function buildModel(broker, kernel) {
      const eventMap = new Map();
      for (const ev of broker.inputEvents) {
        if (!eventMap.has(ev.id)) eventMap.set(ev.id, []);
        eventMap.get(ev.id).push(ev.name);
      }

      const outputMap = new Map(broker.outputs.map(o => [o.id, o.name]));

      const statesMap = new Map();
      kernel.states.forEach(s => {
        statesMap.set(s.id, {
          id: s.id,
          name: s.name,
          initial: s.initial,
          final: s.final,
          x: 0,
          y: 0,
          layer: 0,
          reachable: false
        });
      });
      broker.states.forEach(s => {
        const existing = statesMap.get(s.id);
        statesMap.set(s.id, {
          ...(existing || {
            id: s.id,
            x: 0,
            y: 0,
            layer: 0,
            reachable: false
          }),
          name: s.name,
          initial: s.initial || existing?.initial || false,
          final: s.final || existing?.final || false
        });
      });

      const initial = [...statesMap.values()].find(s => s.initial) || [...statesMap.values()][0];
      if (!initial) throw new Error('Nessuno stato trovato');

      const edges = kernel.transitions.map(t => ({
        ...t,
        eventNames: eventMap.get(t.eventId) || [t.eventId],
        outputName: outputMap.get(t.outputId) || t.outputId
      }));

      const outgoing = new Map([...statesMap.keys()].map(k => [k, []]));
      const incoming = new Map([...statesMap.keys()].map(k => [k, []]));
      for (const e of edges) {
        if (!outgoing.has(e.from)) outgoing.set(e.from, []);
        if (!incoming.has(e.to)) incoming.set(e.to, []);
        outgoing.get(e.from).push(e);
        incoming.get(e.to).push(e);
      }

      const q = [initial.id];
      const dist = new Map([[initial.id, 0]]);
      statesMap.get(initial.id).reachable = true;
      while (q.length) {
        const cur = q.shift();
        for (const e of outgoing.get(cur) || []) {
          const next = e.to;
          statesMap.get(next) && (statesMap.get(next).reachable = true);
          if (e.from !== e.to && !dist.has(next)) {
            dist.set(next, dist.get(cur) + 1);
            q.push(next);
          }
        }
      }

      for (const s of statesMap.values()) {
        s.layer = dist.has(s.id) ? dist.get(s.id) : Math.max(1, ...dist.values()) + 1;
      }

      return { broker, kernel, statesMap, edges, eventMap, outputMap, outgoing, incoming, initial, labelOffsets: new Map() };
    }

    function groupByLayer(model) {
      const layers = new Map();
      const visibleStates = [...model.statesMap.values()].filter(s => showUnused.checked || s.reachable);

      for (const s of visibleStates) {
        if (!layers.has(s.layer)) layers.set(s.layer, []);
        layers.get(s.layer).push(s);
      }

      for (const [layer, list] of layers) {
        list.sort((a, b) => {
          const score = s => {
            if (s.final) return 100;
            if (/Sospeso/i.test(s.name)) return 60;
            if (/Accodato/i.test(s.name)) return 40;
            if (!s.reachable) return 80;
            return 10;
          };
          return score(a) - score(b) || a.name.localeCompare(b.name);
        });
      }
      return layers;
    }

    function getColGap() {
      return Math.round(COL_GAP * spacingScale);
    }

    function getRowGap() {
      return Math.round(ROW_GAP * spacingScale);
    }

    function updateSpacingLabel() {
      spacingValue.textContent = `${Math.round(spacingScale * 100)}%`;
    }

    function rescaleCurrentLayout(model, previousScale, nextScale) {
      if (!model || !Number.isFinite(previousScale) || !Number.isFinite(nextScale) || previousScale <= 0) return;
      const ratio = nextScale / previousScale;
      if (!Number.isFinite(ratio) || Math.abs(ratio - 1) < 0.001) return;

      model.statesMap.forEach(state => {
        state.x = PADDING_X + (state.x - PADDING_X) * ratio;
        state.y = PADDING_Y + (state.y - PADDING_Y) * ratio;
      });

      model.labelOffsets?.forEach(offset => {
        offset.dx *= ratio;
        offset.dy *= ratio;
      });
    }

    function applyAutoLayout(model) {
      const layers = groupByLayer(model);
      const allLayers = [...layers.keys()].sort((a,b) => a-b);
      const colGap = getColGap();
      const rowGap = getRowGap();

      let maxRows = 1;
      for (const l of allLayers) maxRows = Math.max(maxRows, layers.get(l).length);

      for (const layer of allLayers) {
        const list = layers.get(layer);
        const x = PADDING_X + layer * (BOX_W + colGap);
        const totalHeight = list.length * BOX_H + (list.length - 1) * rowGap;
        const startY = PADDING_Y + Math.max(0, (maxRows * (BOX_H + rowGap) - rowGap - totalHeight) / 2);
        list.forEach((s, idx) => {
          s.x = x;
          s.y = startY + idx * (BOX_H + rowGap);
        });
      }
    }

    function rectOf(s) {
      return { x: s.x, y: s.y, w: BOX_W, h: BOX_H };
    }

    function centerOf(s) {
      return { x: s.x + BOX_W/2, y: s.y + BOX_H/2 };
    }

    function sidePoint(s, side) {
      const r = rectOf(s);
      if (side === 'left') return { x: r.x, y: r.y + r.h/2 };
      if (side === 'right') return { x: r.x + r.w, y: r.y + r.h/2 };
      if (side === 'top') return { x: r.x + r.w/2, y: r.y };
      return { x: r.x + r.w/2, y: r.y + r.h };
    }

    function chooseAnchors(a, b) {
      const ac = centerOf(a), bc = centerOf(b);
      const dx = bc.x - ac.x, dy = bc.y - ac.y;
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? ['right','left'] : ['left','right'];
      return dy >= 0 ? ['bottom','top'] : ['top','bottom'];
    }

    function chooseAnchorForPoint(node, point) {
      const center = centerOf(node);
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'right' : 'left';
      return dy >= 0 ? 'bottom' : 'top';
    }

    function edgeKey(e) {
      return `${e.from}__${e.to}`;
    }

    function mergeEdges(edges) {
      const map = new Map();
      for (const e of edges) {
        const key = edgeKey(e);
        if (!map.has(key)) map.set(key, { ...e, all: [e] });
        else map.get(key).all.push(e);
      }
      return [...map.values()].map(group => ({
        ...group,
        label: group.all.map(x => {
          const ev = `${x.eventId}${x.eventNames?.length ? ' / ' + x.eventNames.join(' | ') : ''}`;
          return showOutputs.checked ? `${ev} · ${x.outputId}` : ev;
        }).join('\n')
      }));
    }

    function edgeLine(edge) {
      const names = showEventNames.checked && edge.eventNames?.length ? ` / ${edge.eventNames.join(' | ')}` : '';
      const output = showOutputs.checked ? ` - ${edge.outputId}` : '';
      return `${edge.eventId}${names}${output}`;
    }

    function buildDisplayEdge(base, all) {
      const uniqueLines = [...new Set(all.map(edgeLine))];
      const compactLines = uniqueLines.slice(0, LABEL_MAX_LINES);
      if (uniqueLines.length > LABEL_MAX_LINES) compactLines.push(`+${uniqueLines.length - LABEL_MAX_LINES} altri`);
      return {
        ...base,
        all,
        domKey: `${base.from}__${base.to}__${uniqueLines.join('|')}`,
        label: uniqueLines.join('\n'),
        compactLabel: compactLines.join('\n'),
        transitionCount: all.length
      };
    }

    function createSvg(tag, attrs = {}, parent = svg) {
      const el = document.createElementNS(NS, tag);
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      parent.appendChild(el);
      return el;
    }

    function addDefs() {
      const defs = createSvg('defs');
      const marker = createSvg('marker', {
        id: 'arrow', markerWidth: 10, markerHeight: 10, refX: 8, refY: 5,
        orient: 'auto', markerUnits: 'strokeWidth'
      }, defs);
      createSvg('path', { d: 'M0,0 L10,5 L0,10 z', fill: '#394150' }, marker);

      const miniMarker = createSvg('marker', {
        id: 'arrowMini', markerWidth: 7, markerHeight: 7, refX: 5.5, refY: 3.5,
        orient: 'auto', markerUnits: 'strokeWidth'
      }, defs);
      createSvg('path', { d: 'M0,0 L7,3.5 L0,7 z', fill: '#394150' }, miniMarker);

      const shadow = createSvg('filter', { id: 'shadow', x: '-20%', y: '-20%', width: '150%', height: '170%' }, defs);
      createSvg('feDropShadow', { dx: '0', dy: '4', stdDeviation: '5', 'flood-color': '#6b7280', 'flood-opacity': '0.18' }, shadow);
    }

    function render(model) {
      svg.innerHTML = '';
      hideEdgeTooltip();
      addDefs();

      const visibleStates = [...model.statesMap.values()].filter(s => showUnused.checked || s.reachable);
      const visibleSet = new Set(visibleStates.map(s => s.id));
      const filteredEdges = model.edges.filter(e => visibleSet.has(e.from) && visibleSet.has(e.to));
      const displayEdges = mergeEdges(filteredEdges).map(group => buildDisplayEdge(group, group.all));

      let maxX = 1200, maxY = 700;
      for (const s of visibleStates) {
        maxX = Math.max(maxX, s.x + BOX_W + 200);
        maxY = Math.max(maxY, s.y + BOX_H + 220);
      }
      svg.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
      svg.setAttribute('width', maxX);
      svg.setAttribute('height', maxY);
      svg.setAttribute('font-family', SVG_FONT_STACK);

      const edgeLayer = createSvg('g', { id: 'edgeLayer' });
      const nodeLayer = createSvg('g', { id: 'nodeLayer' });
      const topLayer = createSvg('g', { id: 'topLayer' });
      const labelPlan = buildLabelPlan(model, displayEdges);

      const initial = model.initial;
      if (visibleSet.has(initial.id)) {
        const p = sidePoint(initial, 'left');
        createSvg('circle', { cx: p.x - 52, cy: p.y, r: 11, fill: '#111827' }, topLayer);
        createSvg('path', {
          d: `M ${p.x - 40} ${p.y} L ${p.x} ${p.y}`,
          stroke: '#111827', 'stroke-width': 3, fill: 'none', 'marker-end': 'url(#arrow)'
        }, topLayer);
      }

      let selfLoopIndex = new Map();

      for (const edge of displayEdges) {
        const from = model.statesMap.get(edge.from);
        const to = model.statesMap.get(edge.to);
        if (!from || !to) continue;

        if (from.id === to.id) {
          if (!showSelfLoops.checked) continue;
          const idx = selfLoopIndex.get(from.id) || 0;
          selfLoopIndex.set(from.id, idx + 1);
          drawSelfLoop(from, edge, idx, edgeLayer, topLayer, labelPlan);
        } else {
          drawEdge(from, to, edge, edgeLayer, topLayer, labelPlan);
        }
      }

      for (const s of visibleStates) drawNode(s, nodeLayer);
      drawPendingTransition();
      updateLegend(model, displayEdges);
    }

    function drawNode(s, layer) {
      const g = createSvg('g', { class: 'node', 'data-id': s.id, style: 'cursor: grab;' }, layer);
      const { isFinal, isUnreachable, fill, stroke } = getNodePalette(s);

      createSvg('rect', {
        class: 'node-shell',
        x: s.x, y: s.y, width: BOX_W, height: BOX_H, rx: 18, ry: 18,
        fill, stroke, 'stroke-width': 2.8, filter: 'url(#shadow)',
        'stroke-dasharray': isUnreachable ? '8 6' : 'none'
      }, g);

      if (isFinal && !isUnreachable) {
        createSvg('rect', {
          class: 'node-inner-ring',
          x: s.x + 7, y: s.y + 7, width: BOX_W - 14, height: BOX_H - 14, rx: 14, ry: 14,
          fill: 'none', stroke, 'stroke-width': 1.8
        }, g);
      }

      if (isFinal && isUnreachable) {
        createSvg('rect', {
          class: 'node-inner-ring',
          x: s.x + 7, y: s.y + 7, width: BOX_W - 14, height: BOX_H - 14, rx: 14, ry: 14,
          fill: 'none',
          stroke: '#9ca3af',
          'stroke-width': 1.8,
          'stroke-dasharray': '8 6'
        }, g);
      }

      const top = createSvg('text', {
        x: s.x + BOX_W/2, y: s.y + 28, 'text-anchor': 'middle', 'font-size': 18,
        'font-weight': 800, fill: isUnreachable ? '#4b5563' : '#111827', 'font-family': SVG_FONT_STACK
      }, g);
      top.textContent = s.id;

      const name = createSvg('text', {
        x: s.x + BOX_W/2, y: s.y + 49, 'text-anchor': 'middle', 'font-size': 15,
        fill: isUnreachable ? '#6b7280' : '#222', 'pointer-events': 'none', 'font-family': SVG_FONT_STACK
      }, g);
      name.textContent = s.name;

      if (!s.reachable) {
        createSvg('text', {
          x: s.x + BOX_W/2, y: s.y + 63, 'text-anchor': 'middle', 'font-size': 11,
          fill: '#6b7280', 'font-style': 'italic', 'font-family': SVG_FONT_STACK
        }, g).textContent = 'non raggiunto';
      }

      if (editMode) {
        drawNodeEditActions(g, s);
      }
    }

    function drawNodeEditActions(group, state) {
      const actions = createSvg('g', { class: 'node-action', 'pointer-events': 'all' }, group);
      const topActionY = state.y;
      const editX = state.x + BOX_W - 50;
      const deleteX = state.x + BOX_W - 24;
      const createX = state.x + BOX_W;
      const createY = state.y + BOX_H / 2;

      const makeButton = (x, fill, stroke, textColor, helper, onClick, iconRenderer, shape = 'square', y = topActionY) => {
        const g = createSvg('g', { style: 'cursor: pointer;' }, actions);
        g.style.color = textColor;
        if (shape === 'circle') {
          createSvg('circle', { cx: x, cy: y, r: 11, fill, stroke, 'stroke-width': 2.1 }, g);
        } else {
          createSvg('rect', {
            x: x - 11, y: y - 11, width: 22, height: 22, rx: 7, ry: 7,
            fill, stroke, 'stroke-width': 1.8
          }, g);
        }
        createSvg('title', {}, g).textContent = helper;
        iconRenderer(g, x, y);
        g.addEventListener('click', event => {
          event.stopPropagation();
          onClick();
        });
        g.addEventListener('pointerdown', event => {
          event.stopPropagation();
        });
      };

      if (!state.final) {
        makeButton(createX, '#ffffff', '#6b7280', '#6b7280', 'Crea Transazione', () => startPendingTransition(state.id), (button, x, cy) => {
          createSvg('line', {
            x1: x - 4.5, y1: cy, x2: x + 4.5, y2: cy,
            stroke: '#6b7280', 'stroke-width': 2.1, 'stroke-linecap': 'round', 'pointer-events': 'none'
          }, button);
          createSvg('line', {
            x1: x, y1: cy - 4.5, x2: x, y2: cy + 4.5,
            stroke: '#6b7280', 'stroke-width': 2.1, 'stroke-linecap': 'round', 'pointer-events': 'none'
          }, button);
        }, 'circle', createY);
      }
      makeButton(editX, '#fff7ed', '#f97316', '#c2410c', 'Modifica stato', () => openStateEditor(state.id), (button, x, cy) => {
        const text = createSvg('text', {
          x,
          y: cy + 3.2,
          'text-anchor': 'middle',
          'font-size': 10,
          'font-weight': 800,
          fill: '#c2410c',
          'font-family': SVG_FONT_STACK,
          'pointer-events': 'none'
        }, button);
        text.textContent = 'M';
      }, 'square', topActionY);
      makeButton(deleteX, '#fff1f0', '#f2b8b5', '#b42318', 'Cancella stato', () => deleteStateById(state.id), (button, x, cy) => {
        const text = createSvg('text', {
          x,
          y: cy + 3.2,
          'text-anchor': 'middle',
          'font-size': 10,
          'font-weight': 800,
          fill: '#b42318',
          'font-family': SVG_FONT_STACK,
          'pointer-events': 'none'
        }, button);
        text.textContent = 'X';
      }, 'square', topActionY);
    }

    function buildLabelPlan(model, displayEdges) {
      const groups = new Map();
      const cursors = new Map();

      for (const edge of displayEdges) {
        const from = model.statesMap.get(edge.from);
        const to = model.statesMap.get(edge.to);
        if (!from || !to) continue;

        const side = from.id === to.id ? 'top' : chooseAnchors(from, to)[0];
        const key = `${from.id}|${side}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
      }

      return { groups, cursors };
    }

    function getLabelSlot(labelPlan, fromId, side) {
      const key = `${fromId}|${side}`;
      const index = labelPlan.cursors.get(key) || 0;
      labelPlan.cursors.set(key, index + 1);
      const total = labelPlan.groups.get(key)?.length || 1;
      return { index, total, key };
    }

    function drawEdge(from, to, edge, edgeLayer, labelLayer, labelPlan) {
      const [sa, ta] = chooseAnchors(from, to);
      const p1 = sidePoint(from, sa);
      const p2 = sidePoint(to, ta);
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const bend = Math.max(36, Math.min(110, Math.abs(dx) * 0.35 + Math.abs(dy) * 0.12));

      let c1, c2;
      if (sa === 'right' || sa === 'left') {
        c1 = { x: p1.x + (sa === 'right' ? bend : -bend), y: p1.y };
        c2 = { x: p2.x + (ta === 'left' ? -bend : bend), y: p2.y };
      } else {
        c1 = { x: p1.x, y: p1.y + (sa === 'bottom' ? bend : -bend) };
        c2 = { x: p2.x, y: p2.y + (ta === 'top' ? -bend : bend) };
      }

      const d = `M ${p1.x} ${p1.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
      drawDirectionalEdge(d, '#394150', 2.1, edgeLayer, false, from.id, edge.domKey);

      const lx = (p1.x + p2.x + c1.x + c2.x) / 4;
      const ly = (p1.y + p2.y + c1.y + c2.y) / 4 - 8;
      const biasY = Math.abs(dy) > Math.abs(dx) ? (dy >= 0 ? 16 : -16) : (dy >= 0 ? -10 : 10);
      if (showTransactions.checked) {
        const slot = getLabelSlot(labelPlan, from.id, sa);
        drawLabel(edge, lx, ly + biasY, labelLayer, sa, p1, slot);
      }
    }

    function drawSelfLoop(node, edge, index, edgeLayer, labelLayer, labelPlan) {
      const p = sidePoint(node, 'top');
      const spread = 30 + index * 18;
      const startX = p.x - 42;
      const endX = p.x + 42;
      const y = p.y;
      const ctrlY = y - 70 - spread;
      const d = `M ${startX} ${y} C ${startX} ${ctrlY}, ${endX} ${ctrlY}, ${endX} ${y}`;
      drawDirectionalEdge(d, '#6b7280', 2, edgeLayer, true, node.id, edge.domKey);
      if (showTransactions.checked) {
        const slot = getLabelSlot(labelPlan, node.id, 'top');
        drawLabel(edge, p.x - 40, ctrlY - 10, labelLayer, 'top', p, slot);
      }
    }

    function drawDirectionalEdge(d, color, width, layer, isLoop = false, fromId = '', domKey = '') {
      const edgeGroup = createSvg('g', {
        class: 'edge-group',
        'data-edge-from': fromId
      }, layer);
      edgeGroup.setAttribute('data-edge-key', domKey);

      createSvg('path', {
        d, fill: 'none', stroke: color, 'stroke-width': width, 'marker-end': 'url(#arrow)'
      }, edgeGroup).setAttribute('data-edge-role', 'main');

      drawEdgeChevrons(d, color, edgeGroup, isLoop);
    }

    function drawEdgeChevrons(d, color, layer, isLoop = false) {
      const probe = createSvg('path', {
        d,
        fill: 'none',
        stroke: 'none',
        'pointer-events': 'none'
      }, layer);

      const totalLength = probe.getTotalLength();
      const spacing = isLoop ? CHEVRON_SPACING + 4 : CHEVRON_SPACING;
      const startOffset = isLoop ? 24 : 28;
      const endOffset = 20;

      for (let pos = startOffset; pos < totalLength - endOffset; pos += spacing) {
        const p = probe.getPointAtLength(pos);
        const prev = probe.getPointAtLength(Math.max(0, pos - 0.1));
        const next = probe.getPointAtLength(Math.min(totalLength, pos + 0.1));
        const angle = Math.atan2(next.y - prev.y, next.x - prev.x);
        drawChevron(p.x, p.y, angle, color, layer);
      }

      probe.remove();
    }

    function drawChevron(x, y, angle, color, layer) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const backX = x - cos * CHEVRON_SIZE;
      const backY = y - sin * CHEVRON_SIZE;
      const normalX = -sin;
      const normalY = cos;
      const wing = CHEVRON_SIZE * 0.72;

      const d = [
        `M ${backX + normalX * wing} ${backY + normalY * wing}`,
        `L ${x} ${y}`,
        `L ${backX - normalX * wing} ${backY - normalY * wing}`
      ].join(' ');

      createSvg('path', {
        d,
        fill: 'none',
        stroke: color,
        'stroke-width': 1.8,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        opacity: '0.9'
      }, layer).setAttribute('data-edge-role', 'chevron');
    }

    function drawLabel(edge, x, y, layer, side, anchorPoint, slot) {
      const lines = String(edge.compactLabel || edge.label).split('\n').slice(0, LABEL_MAX_LINES + 1);
      const maxLen = Math.max(...lines.map(l => l.length), 8);
      const width = Math.min(Math.max(74, maxLen * 6.4), LABEL_MAX_WIDTH);
      const height = lines.length * LABEL_LINE_HEIGHT + 10;
      const baseBox = resolveStackedLabelBox(x, y, width, height, side, anchorPoint, slot);
      const storedOffset = graph?.labelOffsets?.get(edge.domKey);
      const effectiveOffset = storedOffset && storedOffset.side === side
        ? storedOffset
        : { dx: 0, dy: 0, side };
      if (graph?.labelOffsets && (!storedOffset || storedOffset.side !== side)) {
        graph.labelOffsets.set(edge.domKey, effectiveOffset);
      }
      const box = {
        ...baseBox,
        x: baseBox.x + effectiveOffset.dx,
        y: baseBox.y + effectiveOffset.dy
      };

      const g = createSvg('g', {
        class: 'edge-label',
        'data-edge-from': edge.from,
        style: 'cursor: default;'
      }, layer);
      g.setAttribute('data-edge-key', edge.domKey);
      g.setAttribute('data-edge-from-id', edge.from);
      g.setAttribute('data-edge-to-id', edge.to);
      g.setAttribute('data-base-x', String(baseBox.x));
      g.setAttribute('data-base-y', String(baseBox.y));
      createSvg('rect', {
        x: box.x, y: box.y, width: box.width, height: box.height,
        rx: 9, ry: 9, fill: 'rgba(255,255,255,0.72)', stroke: '#dbe4f2'
      }, g);
      lines.forEach((line, idx) => {
        const isMore = idx === lines.length - 1 && /^\+\d+ altri$/.test(line);
        const t = createSvg('text', {
          x: box.x + 8,
          y: box.y + 16 + idx * LABEL_LINE_HEIGHT,
          'font-size': 11,
          'font-weight': isMore ? 700 : 500,
          fill: isMore ? '#2f6fda' : '#1f2937',
          'font-family': SVG_FONT_STACK
        }, g);
        t.textContent = line;
      });

      g.addEventListener('pointerenter', evt => {
        if (dragged) return;
        updateEdgeFocus(edge);
        showEdgeTooltip(edge, evt);
      });
      g.addEventListener('pointermove', evt => showEdgeTooltip(edge, evt));
      g.addEventListener('pointerleave', () => {
        hideEdgeTooltip();
        if (dragged) return;
        resetNodeFocus();
      });

      if (editMode) {
        drawEdgeEditActions(g, edge, box);
        g.style.cursor = 'pointer';
        g.addEventListener('click', event => {
          if (dragMoved || draggedLabelKey) return;
          event.stopPropagation();
          openTransitionEditor(edge);
        });
      }
    }

    function drawEdgeEditActions(group, edge, box) {
      const actions = createSvg('g', { class: 'edge-action', 'pointer-events': 'all' }, group);
      const top = box.y - 8;
      const left = box.x + box.width - 38;
      const items = [
        { x: left, fill: '#fff7ed', stroke: '#fdba74', color: '#c2410c', onClick: () => openTransitionEditor(edge), icon: 'edit' },
        { x: left + 18, fill: '#fff1f0', stroke: '#f2b8b5', color: '#b42318', onClick: () => deleteTransitionGroup(edge), icon: 'delete' }
      ];

      items.forEach(item => {
        const button = createSvg('g', { style: 'cursor: pointer;' }, actions);
        button.style.color = item.color;
        createSvg('circle', { cx: item.x, cy: top, r: 8.5, fill: item.fill, stroke: item.stroke, 'stroke-width': 1.1 }, button);
        createSvg('title', {}, button).textContent = item.icon === 'edit' ? 'Modifica transizioni' : 'Cancella transizioni';
        if (item.icon === 'edit') {
          renderIconPath(button, `M ${item.x - 2.5} ${top + 2.5} L ${item.x + 2.5} ${top - 2.5}`);
          renderIconPath(button, `M ${item.x + 1} ${top - 4} L ${item.x + 3.8} ${top - 1.2}`);
          renderIconPath(button, `M ${item.x - 4} ${top + 4} L ${item.x - 1.6} ${top + 4}`);
        } else {
          const text = createSvg('text', {
            x: item.x,
            y: top + 3,
            'text-anchor': 'middle',
            'font-size': 9,
            'font-weight': 800,
            fill: item.color,
            'font-family': SVG_FONT_STACK,
            'pointer-events': 'none'
          }, button);
          text.textContent = 'X';
        }
        button.addEventListener('click', event => {
          event.stopPropagation();
          item.onClick();
        });
        button.addEventListener('pointerdown', event => {
          event.stopPropagation();
        });
      });
    }

    function resolveStackedLabelBox(x, y, width, height, side, anchorPoint, slot) {
      const centerOffset = slot.index - (slot.total - 1) / 2;

      if (side === 'right') {
        return {
          x: anchorPoint.x + LABEL_SOURCE_OFFSET,
          y: anchorPoint.y - height / 2 + centerOffset * (height + LABEL_STACK_GAP),
          width,
          height
        };
      }

      if (side === 'left') {
        return {
          x: anchorPoint.x - width - LABEL_SOURCE_OFFSET,
          y: anchorPoint.y - height / 2 + centerOffset * (height + LABEL_STACK_GAP),
          width,
          height
        };
      }

      if (side === 'bottom') {
        return {
          x: anchorPoint.x - width / 2 + centerOffset * (width + LABEL_STACK_GAP),
          y: anchorPoint.y + LABEL_SOURCE_OFFSET,
          width,
          height
        };
      }

      return {
        x: anchorPoint.x - width / 2 + centerOffset * (width + LABEL_STACK_GAP),
        y: anchorPoint.y - height - LABEL_SOURCE_OFFSET,
        width,
        height
      };
    }

    function showEdgeTooltip(edge, evt) {
      const details = edge.label.split('\n');
      const header = edge.transitionCount > 1 ? `${edge.transitionCount} transizioni raggruppate` : 'Transizione';
      const fromState = graph?.statesMap?.get(edge.from);
      const toState = graph?.statesMap?.get(edge.to);
      const fromLabel = fromState?.name || edge.from;
      const toLabel = toState?.name || edge.to;
      const route = `${fromLabel} > ${toLabel}`;
      const outputLegend = showOutputs.checked ? buildEdgeOutputLegend(edge) : '';
      edgeTooltip.innerHTML = `<b>${escapeHtml(header)}</b>${details.map(line => escapeHtml(line)).join('<br>')}${outputLegend}<br><br><b>${escapeHtml(route)}</b>`;
      edgeTooltip.style.display = 'block';

      const viewportRect = viewport.getBoundingClientRect();
      const tooltipRect = edgeTooltip.getBoundingClientRect();
      const left = Math.min(viewportRect.width - tooltipRect.width - 12, Math.max(12, evt.clientX - viewportRect.left + 16));
      const top = Math.min(viewportRect.height - tooltipRect.height - 12, Math.max(12, evt.clientY - viewportRect.top + 16));
      edgeTooltip.style.left = `${left}px`;
      edgeTooltip.style.top = `${top}px`;
    }

    function buildEdgeOutputLegend(edge) {
      const outputs = new Map();
      for (const item of edge.all || [edge]) {
        if (!item.outputId) continue;
        if (!outputs.has(item.outputId)) {
          outputs.set(item.outputId, item.outputName || item.outputId);
        }
      }

      if (!outputs.size) return '';
      return `<br><br>${[...outputs.entries()].map(([id, name]) => `<b>${escapeHtml(id)} = ${escapeHtml(name)}</b>`).join('<br>')}`;
    }

    function hideEdgeTooltip() {
      edgeTooltip.style.display = 'none';
    }

    function updateLegendCollapsedState() {
      legend.classList.toggle('collapsed', legendCollapsed);
      const toggle = document.getElementById('legendToggle');
      if (toggle) toggle.textContent = legendCollapsed ? 'mostra' : 'nascondi';
    }

    function closeNodeSummary() {
      summaryPanel.classList.remove('open');
      summaryTitle.textContent = 'Riepilogo nodo';
      summarySub.textContent = '';
      summaryBody.innerHTML = '';
    }

    function buildSummaryEventLabel(edge) {
      return `${escapeHtml(edge.eventId)}${showEventNames.checked && edge.eventNames?.length ? ` / ${escapeHtml(edge.eventNames.join(' | '))}` : ''}`;
    }

    function buildSummaryOutputLabel(edge) {
      if (!showOutputs.checked || !edge.outputId) return '';
      const outputName = edge.outputName || edge.outputId;
      return `${escapeHtml(outputName)} (${escapeHtml(edge.outputId)})`;
    }

    function groupEdgesByTarget(edges) {
      const groups = new Map();
      for (const edge of edges) {
        const key = edge.to;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(edge);
      }
      return [...groups.entries()]
        .map(([targetId, items]) => ({ targetId, items }))
        .sort((a, b) => {
          const aLoop = a.items.some(item => item.from === item.to);
          const bLoop = b.items.some(item => item.from === item.to);
          if (aLoop !== bLoop) return aLoop ? -1 : 1;
          return a.targetId.localeCompare(b.targetId);
        });
    }

    function getSummaryTone(targetId, items = []) {
      const target = graph?.statesMap?.get(targetId);
      if (target?.final) return 'red';
      if (items.some(edge => edge.from === edge.to)) return 'green';
      return 'blue';
    }

    function countReachableTargets(startId) {
      if (!graph?.statesMap?.has(startId)) return 0;

      const visited = new Set([startId]);
      const queue = [startId];

      while (queue.length) {
        const current = queue.shift();
        for (const edge of graph.outgoing.get(current) || []) {
          if (visited.has(edge.to)) continue;
          visited.add(edge.to);
          queue.push(edge.to);
        }
      }

      return Math.max(0, visited.size - 1);
    }

    function buildSummaryMiniGraph(node, directEdges) {
      if (!directEdges.length) return `<div class="summary-empty">Nessuna transizione diretta in uscita.</div>`;
      const grouped = groupEdgesByTarget(directEdges);
      const loopGroups = grouped.filter(group => group.targetId === node.id);
      const outwardGroups = grouped.filter(group => group.targetId !== node.id);

      const boxW = 190;
      const boxH = 56;
      const startX = 40;
      const loopExtraTop = loopGroups.length ? 90 + (loopGroups.length - 1) * 48 : 0;
      const sourceY = loopExtraTop + 26 + ((Math.max(outwardGroups.length, 1) - 1) * 96 + boxH) / 2 - boxH / 2;
      const targetX = 398;
      const width = 670;
      const height = Math.max(260, loopExtraTop + Math.max(outwardGroups.length, 1) * 96 + 60);

      const nodeRect = (x, y, label, tone = 'blue') => {
        const fill = tone === 'green' ? '#eaf9ee' : tone === 'red' ? '#fff1f0' : '#eef4ff';
        const stroke = tone === 'green' ? '#16a34a' : tone === 'red' ? '#d92d20' : '#2f6fda';
        return `
          <rect x="${x}" y="${y}" width="${boxW}" height="${boxH}" rx="14" ry="14" fill="${fill}" stroke="${stroke}" stroke-width="2.4"></rect>
          <text x="${x + boxW / 2}" y="${y + 24}" text-anchor="middle" font-size="14" font-weight="800" fill="#0f172a" font-family="${SVG_FONT_STACK}">${escapeHtml(label.id)}</text>
          <text x="${x + boxW / 2}" y="${y + 42}" text-anchor="middle" font-size="12" fill="#334155" font-family="${SVG_FONT_STACK}">${escapeHtml(label.name)}</text>
        `;
      };

      const edgeBox = (x, y, items, tone = 'blue', orientation = 'vertical') => {
        const fill = tone === 'green' ? 'rgba(234, 249, 238, 0.92)' : tone === 'red' ? 'rgba(255, 241, 240, 0.92)' : 'rgba(238, 244, 255, 0.92)';
        const stroke = tone === 'green' ? '#16a34a' : tone === 'red' ? '#d92d20' : '#2f6fda';
        const lines = items.map(edge => escapeHtml(edge.eventId));
        const lineHeight = 12;
        const maxLen = Math.max(...lines.map(line => line.length), 4);
        const horizontalRows = [];
        if (orientation === 'horizontal') {
          for (let i = 0; i < lines.length; i += 6) horizontalRows.push(lines.slice(i, i + 6));
        }
        const boxWidth = orientation === 'horizontal'
          ? Math.max(62, Math.max(...horizontalRows.map(row => row.length), 1) * 34 + 10)
          : Math.max(54, Math.min(86, maxLen * 5.4 + 12));
        const boxHeight = orientation === 'horizontal'
          ? 10 + horizontalRows.length * 12
          : 8 + lines.length * 12;
        return `
          <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="10" ry="10" fill="#ffffff" fill-opacity="0.98" stroke="none" filter="url(#miniBoxShadow)"></rect>
          <rect x="${x}" y="${y}" width="${boxWidth}" height="${boxHeight}" rx="10" ry="10" fill="${fill}" stroke="${stroke}" stroke-width="1.5"></rect>
          ${orientation === 'horizontal'
            ? horizontalRows.map((row, rowIdx) => row.map((line, idx) => `<text x="${x + 20 + idx * 34}" y="${y + 14 + rowIdx * 12}" text-anchor="middle" font-size="9" font-weight="700" fill="#1e293b" font-family="${SVG_FONT_STACK}">${line}</text>`).join('')).join('')
            : lines.map((line, idx) => `<text x="${x + boxWidth / 2}" y="${y + 12 + idx * 12}" text-anchor="middle" font-size="9" font-weight="700" fill="#1e293b" font-family="${SVG_FONT_STACK}">${line}</text>`).join('')}
        `;
      };

      const sourceNode = nodeRect(startX, sourceY, { id: node.id, name: node.name }, 'green');
      const targetNodes = outwardGroups.map(({ targetId, items }, idx) => {
        const target = graph.statesMap.get(targetId);
        const y = loopExtraTop + 24 + idx * 96;
        return nodeRect(targetX, y, { id: target?.id || targetId, name: target?.name || targetId }, getSummaryTone(targetId, items));
      }).join('');

      const loopPaths = loopGroups.map(({ targetId, items }, idx) => {
        const spread = idx * 42;
        const topY = sourceY - 42 - spread;
        const leftX = startX + 28;
        const rightX = startX + boxW - 28;
        const ctrlY = topY - 38;
        const tone = getSummaryTone(targetId, items);
        const stroke = tone === 'red' ? '#d92d20' : '#16a34a';
        return `
          <path d="M ${leftX} ${sourceY} C ${leftX} ${ctrlY}, ${rightX} ${ctrlY}, ${rightX} ${sourceY}" fill="none" stroke="${stroke}" stroke-width="2" marker-end="url(${tone === 'red' ? '#miniArrowRed' : '#miniArrowGreen'})"></path>
        `;
      }).join('');

      const outwardPaths = outwardGroups.map(({ targetId }, idx) => {
        const y = loopExtraTop + 24 + idx * 96;
        const pathY = y + boxH / 2;
        return `
          <path d="M ${startX + boxW} ${sourceY + boxH / 2} C 280 ${sourceY + boxH / 2}, 300 ${pathY}, ${targetX} ${pathY}" fill="none" stroke="#475569" stroke-width="2" marker-end="url(#miniArrow)"></path>
        `;
      }).join('');

      const loopBoxes = loopGroups.map(({ targetId, items }, idx) => {
        const spread = idx * 42;
        const topY = sourceY - 42 - spread;
        const loopRowWidth = Math.min(items.length, 6);
        const loopBoxWidth = Math.max(62, loopRowWidth * 34 + 10);
        return edgeBox(startX + boxW / 2 - loopBoxWidth / 2, topY - 18, items, getSummaryTone(targetId, items), 'horizontal');
      }).join('');

      const outwardBoxes = outwardGroups.map(({ targetId, items }, idx) => {
        const y = loopExtraTop + 24 + idx * 96;
        const pathY = y + boxH / 2;
        const boxHeight = 8 + items.length * 12;
        const boxY = pathY - boxHeight / 2;
        const maxLen = Math.max(...items.map(edge => edge.eventId.length), 4);
        const boxWidth = Math.max(54, Math.min(86, maxLen * 5.4 + 12));
        const boxX = targetX - boxWidth - 18;
        return edgeBox(boxX, boxY, items, getSummaryTone(targetId, items));
      }).join('');

      return `
        <div class="summary-graph">
          <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="miniArrow" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#475569"></path>
              </marker>
              <marker id="miniArrowGreen" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#16a34a"></path>
              </marker>
              <marker id="miniArrowRed" markerWidth="8" markerHeight="8" refX="6.5" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="#d92d20"></path>
              </marker>
              <filter id="miniBoxShadow" x="-20%" y="-30%" width="150%" height="180%">
                <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-color="#94a3b8" flood-opacity="0.28"></feDropShadow>
              </filter>
            </defs>
            <g class="mini-path-layer">
              ${loopPaths}
              ${outwardPaths}
            </g>
            <g class="mini-node-layer">
              ${sourceNode}
              ${targetNodes}
            </g>
            <g class="mini-label-layer">
              ${loopBoxes}
              ${outwardBoxes}
            </g>
          </svg>
        </div>
      `;
    }

    function buildSummaryCards(directEdges) {
      if (!directEdges.length) return `<div class="summary-empty">Nessuna transizione diretta in uscita.</div>`;
      const grouped = groupEdgesByTarget(directEdges);

      return `<div class="summary-cards">${grouped.map(({ targetId, items }) => {
        const target = graph.statesMap.get(targetId);
        const tone = getSummaryTone(targetId, items);
        const toneClass = tone === 'red' ? 'final' : tone === 'green' ? 'loop' : 'branch';
        const pairs = items.map(edge => {
          const output = buildSummaryOutputLabel(edge);
          return `<p><b>Evento:</b> ${buildSummaryEventLabel(edge)}${output ? `<br><b>Output:</b> ${output}` : ''}</p>`;
        }).join('');
        return `
          <div class="summary-card ${toneClass}">
            <h5>${escapeHtml(target?.name || targetId)} <span class="note">(${escapeHtml(target?.id || targetId)})</span></h5>
            ${pairs}
          </div>
        `;
      }).join('')}</div>`;
    }

    function openNodeSummary(nodeId) {
      const node = graph?.statesMap?.get(nodeId);
      if (!node) return;

      const directEdges = graph.outgoing.get(nodeId) || [];
      const uniqueReachableCount = countReachableTargets(nodeId);

      summaryTitle.textContent = `${node.name} (${node.id})`;
      summarySub.textContent = `${directEdges.length} transizioni dirette - ${uniqueReachableCount} nodi raggiungibili`;

      summaryBody.innerHTML = `
        <div class="summary-section">
          <h4>Mini grafo primo livello</h4>
          ${buildSummaryMiniGraph(node, directEdges)}
        </div>
        <div class="summary-section">
          <h4>Dettaglio transazioni da ${escapeHtml(node.name)}</h4>
          ${buildSummaryCards(directEdges)}
        </div>
      `;

      summaryPanel.classList.add('open');
    }

    async function exportGraphAsPng() {
      if (!graph) return;

      hideEdgeTooltip();
      resetNodeFocus();

      const serializer = new XMLSerializer();
      const source = serializer.serializeToString(svg);
      const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      try {
        const image = new Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = url;
        });

        const width = Number(svg.getAttribute('width')) || svg.viewBox.baseVal.width || svg.clientWidth || 1200;
        const height = Number(svg.getAttribute('height')) || svg.viewBox.baseVal.height || svg.clientHeight || 700;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas 2D context non disponibile');
        const pattern = document.createElement('canvas');
        pattern.width = 24;
        pattern.height = 24;
        const pctx = pattern.getContext('2d');
        if (!pctx) throw new Error('Pattern canvas non disponibile');
        pctx.fillStyle = '#fbfcff';
        pctx.fillRect(0, 0, 24, 24);
        pctx.fillStyle = '#e8ecf5';
        pctx.beginPath();
        pctx.arc(1, 1, 1, 0, Math.PI * 2);
        pctx.fill();

        ctx.fillStyle = ctx.createPattern(pattern, 'repeat');
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        const link = document.createElement('a');
        const safeName = (machineTitle.textContent || 'smt-visualizer')
          .trim()
          .replace(/[\\/:*?"<>|]+/g, '-')
          .replace(/\s+/g, '_');
        link.href = canvas.toDataURL('image/png');
        link.download = `${safeName || 'smt-visualizer'}.png`;
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
    }

    function updateLegend(model, displayEdges) {
      const finals = [...model.statesMap.values()].filter(s => s.final).map(s => `<code>${escapeHtml(s.id)}</code> ${escapeHtml(s.name)}`).join(', ');
      const duplicateEvents = [...model.eventMap.entries()].filter(([, names]) => names.length > 1)
        .map(([id, names]) => `<li><code>${escapeHtml(id)}</code>: ${escapeHtml(names.join(' / '))}</li>`).join('');

      legend.innerHTML = `
        <div class="legend-header">
          <h3>Legenda</h3>
          <button type="button" class="legend-toggle" id="legendToggle">${legendCollapsed ? 'mostra' : 'nascondi'}</button>
        </div>
        <div class="legend-body">
          <div><b>Stati finali:</b> ${finals || 'nessuno'}</div>
          <div style="margin-top:8px"><b>Output:</b></div>
          <ul style="margin:6px 0 8px 18px; padding:0;">
            ${[...model.outputMap.entries()].map(([id, name]) => `<li><code>${escapeHtml(id)}</code> = ${escapeHtml(name)}</li>`).join('')}
          </ul>
          ${duplicateEvents ? `<div><b>Input event con stesso ID:</b></div><ul style="margin:6px 0 8px 18px; padding:0;">${duplicateEvents}</ul>` : ''}
          <div class="note">Stati: ${model.statesMap.size} - transizioni: ${model.kernel.transitions.length} - archi mostrati: ${displayEdges.length}</div>
          <div class="note" style="margin-top:6px">Le etichette degli archi sono compattate automaticamente; passa il mouse sopra un box per vedere tutto il dettaglio.</div>
        </div>
      `;
      document.getElementById('legendToggle')?.addEventListener('click', () => {
        legendCollapsed = !legendCollapsed;
        updateLegendCollapsedState();
      });
      updateLegendCollapsedState();

      machineTitle.textContent = `${model.kernel.id || model.broker.id || 'FSM'} - ${model.kernel.name || model.broker.name || ''}`;
      machineMeta.textContent = `Versione kernel: ${model.kernel.version || 'n/d'} - Stato iniziale: ${model.initial.id} - Drag&drop attivo`;
    }

    function rerenderGraph() {
      if (!graph) return;
      render(graph);
      attachDragHandlers();
    }

    function rerenderPreservingPositions() {
      rerenderGraph();
    }

    function clearGraphView() {
      graph = null;
      lastParsedBroker = null;
      lastParsedKernel = null;
      cancelPendingTransition();
      svg.innerHTML = '';
      legend.innerHTML = '';
      hideEdgeTooltip();
      closeNodeSummary();
      closeEditPanel();
      errorBox.style.display = 'none';
      machineTitle.textContent = 'Nessuna macchina caricata';
      machineMeta.textContent = 'Incolla i due XML o apri i file corrispondenti.';
      updateEditModeUI();
    }

    function scheduleAutoRender(immediate = false) {
      if (autoRenderTimer) {
        clearTimeout(autoRenderTimer);
        autoRenderTimer = null;
      }

      const brokerText = brokerInput.value.trim();
      const kernelText = kernelInput.value.trim();
      if (!brokerText || !kernelText) {
        clearGraphView();
        return;
      }

      const run = () => {
        autoRenderTimer = null;
        renderAll();
      };

      if (immediate) run();
      else autoRenderTimer = setTimeout(run, 350);
    }

    async function loadXmlFileIntoInput(file, textarea) {
      if (!file || !textarea) return;
      const text = await file.text();
      textarea.value = text;
      if (textarea === brokerInput) brokerEditor.value = text;
      if (textarea === kernelInput) kernelEditor.value = text;
    }

    async function openXmlWithPicker(kind) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        excludeAcceptAllOption: false,
        types: [{
          description: 'XML',
          accept: {
            'text/xml': ['.xml'],
            'text/plain': ['.txt']
          }
        }]
      });
      const file = await handle.getFile();
      const text = await file.text();
      if (kind === 'broker') {
        brokerFileHandle = handle;
        setXmlText('broker', text, 'source');
      } else {
        kernelFileHandle = handle;
        setXmlText('kernel', text, 'source');
      }
    }

    function closeEditPanel() {
      editPanel.classList.remove('open');
      editTitle.textContent = 'Modalita modifica';
      editSub.textContent = '';
      editBody.innerHTML = '';
      editDialogOffset = { x: 0, y: 0 };
      editDialog.style.transform = '';
    }

    function closeConfirmPanel(result = false) {
      confirmPanel.classList.remove('open');
      if (confirmResolver) {
        confirmResolver(result);
        confirmResolver = null;
      }
    }

    function askDeleteConfirmation(text) {
      confirmTitle.textContent = 'Conferma cancellazione';
      confirmText.textContent = text;
      confirmPanel.classList.add('open');
      return new Promise(resolve => {
        confirmResolver = resolve;
      });
    }

    function openEditPanel(title, subtitle, html) {
      editTitle.textContent = title;
      editSub.textContent = subtitle || '';
      editBody.innerHTML = html;
      editDialog.style.transform = `translate(${editDialogOffset.x}px, ${editDialogOffset.y}px)`;
      editPanel.classList.add('open');
    }

    function clampEditDialogOffset(nextX, nextY) {
      const panelRect = editPanel.getBoundingClientRect();
      const dialogRect = editDialog.getBoundingClientRect();
      const maxX = Math.max(0, panelRect.width / 2 - dialogRect.width / 2 - 20);
      const maxY = Math.max(0, panelRect.height / 2 - dialogRect.height / 2 - 20);
      return {
        x: Math.max(-maxX, Math.min(maxX, nextX)),
        y: Math.max(-maxY, Math.min(maxY, nextY))
      };
    }

    function transitionEditorFields(prefix, values = {}, stateOptions = '', eventOptions = '', outputOptions = '', lockNodes = false) {
      const transitionId = values.id || '';
      const from = values.from || '';
      const to = values.to || '';
      const eventId = values.eventId || '';
      const eventName = values.eventName || '';
      const outputId = values.outputId || '';
      const outputName = values.outputName || '';
      const knownEvent = (lastParsedBroker?.inputEvents || []).some(event => event.id === eventId);
      const knownOutput = (lastParsedBroker?.outputs || []).some(output => output.id === outputId);
      const selectedEventMode = knownEvent ? eventId : '__new__';
      const selectedOutputMode = knownOutput ? outputId : '__new__';
      return `
        <div class="edit-structure">
          <div class="edit-field">
            <label for="${prefix}Id">ID transizione</label>
            <input id="${prefix}Id" name="${prefix}Id" value="${escapeHtml(transitionId)}" />
          </div>
          <div class="edit-row-2">
            <div class="edit-field">
              <label for="${prefix}From">Stato sorgente</label>
              ${lockNodes
                ? `<input id="${prefix}From" name="${prefix}From" value="${escapeHtml(from)}" readonly />`
                : `<select id="${prefix}From" name="${prefix}From">${stateOptions.replace(`value="${escapeHtml(from)}"`, `value="${escapeHtml(from)}" selected`)}</select>`}
            </div>
            <div class="edit-field">
              <label for="${prefix}To">Stato destinazione</label>
              ${lockNodes
                ? `<input id="${prefix}To" name="${prefix}To" value="${escapeHtml(to)}" readonly />`
                : `<select id="${prefix}To" name="${prefix}To">${stateOptions.replace(`value="${escapeHtml(to)}"`, `value="${escapeHtml(to)}" selected`)}</select>`}
            </div>
          </div>

          <hr class="edit-section-divider" />
          <div class="edit-section-title">Input Event</div>
          <div class="edit-field">
            <label for="${prefix}EventId">Input event ID</label>
            <select id="${prefix}EventId" name="${prefix}EventId" data-mode="event">
              ${eventOptions.replace(`value="${escapeHtml(selectedEventMode)}"`, `value="${escapeHtml(selectedEventMode)}" selected`)}
              <option value="__new__" ${selectedEventMode === '__new__' ? 'selected' : ''}>Nuovo input event...</option>
            </select>
          </div>
          <div class="edit-field">
            <label for="${prefix}EventName">Input event nome</label>
            <input id="${prefix}EventName" name="${prefix}EventName" value="${escapeHtml(eventName)}" placeholder="Nome input event" ${knownEvent ? 'readonly' : ''} />
          </div>
          <div class="edit-field">
            <label for="${prefix}EventIdCustom">Nuovo input event ID</label>
            <input id="${prefix}EventIdCustom" name="${prefix}EventIdCustom" value="${knownEvent ? '' : escapeHtml(eventId)}" placeholder="Compila solo per nuovo input event" ${knownEvent ? 'disabled' : ''} />
          </div>

          <hr class="edit-section-divider" />
          <div class="edit-section-title">Output</div>
          <div class="edit-field">
            <label for="${prefix}OutputId">Output ID</label>
            <select id="${prefix}OutputId" name="${prefix}OutputId" data-mode="output">
              ${outputOptions.replace(`value="${escapeHtml(selectedOutputMode)}"`, `value="${escapeHtml(selectedOutputMode)}" selected`)}
              <option value="__new__" ${selectedOutputMode === '__new__' ? 'selected' : ''}>Nuovo output...</option>
            </select>
          </div>
          <div class="edit-field">
            <label for="${prefix}OutputName">Output nome</label>
            <input id="${prefix}OutputName" name="${prefix}OutputName" value="${escapeHtml(outputName)}" placeholder="Nome output" ${knownOutput ? 'readonly' : ''} />
          </div>
          <div class="edit-field">
            <label for="${prefix}OutputIdCustom">Nuovo output ID</label>
            <input id="${prefix}OutputIdCustom" name="${prefix}OutputIdCustom" value="${knownOutput ? '' : escapeHtml(outputId)}" placeholder="Compila solo per nuovo output" ${knownOutput ? 'disabled' : ''} />
          </div>
        </div>
      `;
    }

    function stateOptionsMarkup() {
      const states = lastParsedBroker?.states?.length ? lastParsedBroker.states : (lastParsedKernel?.states || []);
      return states
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map(state => `<option value="${escapeHtml(state.id)}">${escapeHtml(state.id)} - ${escapeHtml(state.name)}</option>`)
        .join('');
    }

    function eventOptionsMarkup() {
      return (lastParsedBroker?.inputEvents || [])
        .map(event => `<option value="${escapeHtml(event.id)}">${escapeHtml(event.id)} - ${escapeHtml(event.name)}</option>`)
        .join('');
    }

    function outputOptionsMarkup() {
      return (lastParsedBroker?.outputs || [])
        .map(output => `<option value="${escapeHtml(output.id)}">${escapeHtml(output.id)} - ${escapeHtml(output.name)}</option>`)
        .join('');
    }

    function brokerEventNameById(id) {
      return (lastParsedBroker?.inputEvents || []).find(event => event.id === id)?.name || '';
    }

    function brokerOutputNameById(id) {
      return (lastParsedBroker?.outputs || []).find(output => output.id === id)?.name || '';
    }

    function syncStateReferences(broker, kernel, oldId, nextState) {
      const brokerState = broker.states.find(state => state.id === oldId);
      if (brokerState) {
        brokerState.id = nextState.id;
        brokerState.name = nextState.name;
        brokerState.initial = nextState.initial;
        brokerState.final = nextState.final;
      }

      const kernelState = kernel.states.find(state => state.id === oldId);
      if (kernelState) {
        kernelState.id = nextState.id;
        kernelState.name = nextState.name;
        kernelState.initial = nextState.initial;
        kernelState.final = nextState.final;
      }

      kernel.transitions.forEach(transition => {
        if (transition.from === oldId) transition.from = nextState.id;
        if (transition.to === oldId) transition.to = nextState.id;
      });
    }

    function upsertEventAndOutput(broker, transition, payload) {
      const eventId = payload.eventId.trim();
      const eventName = payload.eventName.trim();
      const outputId = payload.outputId.trim();
      const outputName = payload.outputName.trim();

      transition.eventId = eventId;
      transition.outputId = outputId;

      const matchingEvent = broker.inputEvents.find(event => event.id === eventId && event.name === eventName);
      if (!matchingEvent && eventId && eventName) {
        broker.inputEvents.push({ id: eventId, name: eventName, initial: false });
      } else if (!matchingEvent && eventId && !eventName && !broker.inputEvents.some(event => event.id === eventId)) {
        broker.inputEvents.push({ id: eventId, name: eventId, initial: false });
      }

      const output = broker.outputs.find(item => item.id === outputId);
      if (output) {
        if (outputName) output.name = outputName;
      } else if (outputId) {
        broker.outputs.push({ id: outputId, name: outputName || outputId });
      }
    }

    function bindTransitionRowBehavior(container) {
      container.querySelectorAll('[data-mode="event"]').forEach(select => {
        const prefix = select.name.replace('EventId', '');
        const nameInput = container.querySelector(`[name="${prefix}EventName"]`);
        const customIdInput = container.querySelector(`[name="${prefix}EventIdCustom"]`);
        const sync = () => {
          if (select.value === '__new__') {
            customIdInput.disabled = false;
            nameInput.readOnly = false;
            nameInput.setAttribute('aria-readonly', 'false');
            if (!customIdInput.value) customIdInput.value = '';
            if (!nameInput.value || nameInput.value === brokerEventNameById(select.dataset.prevValue || '')) nameInput.value = '';
          } else {
            customIdInput.disabled = true;
            customIdInput.value = '';
            nameInput.readOnly = true;
            nameInput.setAttribute('aria-readonly', 'true');
            nameInput.value = brokerEventNameById(select.value) || select.value;
          }
          select.dataset.prevValue = select.value;
        };
        select.addEventListener('change', sync);
        sync();
      });

      container.querySelectorAll('[data-mode="output"]').forEach(select => {
        const prefix = select.name.replace('OutputId', '');
        const nameInput = container.querySelector(`[name="${prefix}OutputName"]`);
        const customIdInput = container.querySelector(`[name="${prefix}OutputIdCustom"]`);
        const sync = () => {
          if (select.value === '__new__') {
            customIdInput.disabled = false;
            nameInput.readOnly = false;
            nameInput.setAttribute('aria-readonly', 'false');
            if (!customIdInput.value) customIdInput.value = '';
            if (!nameInput.value || nameInput.value === brokerOutputNameById(select.dataset.prevValue || '')) nameInput.value = '';
          } else {
            customIdInput.disabled = true;
            customIdInput.value = '';
            nameInput.readOnly = true;
            nameInput.setAttribute('aria-readonly', 'true');
            nameInput.value = brokerOutputNameById(select.value) || select.value;
          }
          select.dataset.prevValue = select.value;
        };
        select.addEventListener('change', sync);
        sync();
      });
    }

    function openStateEditor(stateId = '') {
      const source = findStateDefinition(stateId) || {};
      const outgoingCount = stateId ? ((lastParsedKernel?.transitions || []).filter(transition => transition.from === stateId).length) : 0;
      openEditPanel(
        stateId ? 'Modifica stato' : 'Aggiungi stato',
        stateId ? 'Aggiorna ID, nome e flag del nodo selezionato.' : 'Crea un nuovo stato e aggiungilo a broker e kernel.',
        `
          <form id="stateEditForm">
            <div class="edit-grid">
              <div class="edit-field">
                <label for="stateIdInput">ID stato</label>
                <input id="stateIdInput" name="stateId" value="${escapeHtml(source.id || getNextStateId(lastParsedBroker || { states: [] }, lastParsedKernel || { states: [] }))}" />
              </div>
              <div class="edit-field">
                <label for="stateNameInput">Nome stato</label>
                <input id="stateNameInput" name="stateName" value="${escapeHtml(source.name || '')}" />
              </div>
              <label class="edit-field checkbox"><input type="checkbox" name="stateInitial" ${source.initial ? 'checked' : ''} /> iniziale</label>
              <label class="edit-field checkbox"><input type="checkbox" name="stateFinal" ${source.final ? 'checked' : ''} /> finale</label>
            </div>
            <div class="edit-inline-warning" id="stateFinalWarning">
              Settare come stato finale cancellerà tutte le transazioni da questo nodo.
            </div>
            <div class="edit-actions">
              <button type="button" class="secondary" id="stateCancelBtn">Annulla</button>
              <button type="submit">${stateId ? 'Salva modifiche' : 'Aggiungi stato'}</button>
            </div>
          </form>
        `
      );

      document.getElementById('stateCancelBtn')?.addEventListener('click', closeEditPanel);
      const stateFinalCheckbox = document.querySelector('#stateEditForm [name="stateFinal"]');
      const stateFinalWarning = document.getElementById('stateFinalWarning');
      const syncFinalWarning = () => {
        const shouldShow = !!(outgoingCount && stateFinalCheckbox?.checked);
        stateFinalWarning?.classList.toggle('active', shouldShow);
      };
      stateFinalCheckbox?.addEventListener('change', syncFinalWarning);
      syncFinalWarning();
      document.getElementById('stateEditForm')?.addEventListener('submit', async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const oldId = stateId || '';
        const nextState = {
          id: String(form.get('stateId') || '').trim(),
          name: String(form.get('stateName') || '').trim(),
          initial: form.get('stateInitial') === 'on',
          final: form.get('stateFinal') === 'on'
        };
        if (!nextState.id || !nextState.name) {
          showError('ID e nome stato sono obbligatori');
          return;
        }

        try {
          await applyEditableMutation(async (broker, kernel) => {
            const duplicate = [...broker.states, ...kernel.states].some(state => state.id === nextState.id && state.id !== oldId);
            if (duplicate) throw new Error(`Esiste gia uno stato con ID ${nextState.id}`);

            broker.states.forEach(state => { if (nextState.initial) state.initial = false; });
            kernel.states.forEach(state => { if (nextState.initial) state.initial = false; });

            if (oldId) {
              syncStateReferences(broker, kernel, oldId, nextState);
            } else {
              broker.states.push({ ...nextState });
              ensureKernelState(kernel, nextState);
            }

            if (nextState.final) {
              kernel.transitions = kernel.transitions.filter(transition => transition.from !== nextState.id);
            }
          });
          closeEditPanel();
        } catch (err) {
          showError(`Modifica stato fallita: ${err.message || err}`);
        }
      });
    }

    async function deleteStateById(stateId) {
      if (!stateId) return;
      const accepted = await askDeleteConfirmation(`Questa operazione cancellerà lo stato ${stateId} da tutta la macchina, incluse tutte le transizioni collegate. Vuoi continuare?`);
      if (!accepted) return;
      applyEditableMutation(async (broker, kernel) => {
        broker.states = broker.states.filter(state => state.id !== stateId);
        kernel.states = kernel.states.filter(state => state.id !== stateId);
        kernel.transitions = kernel.transitions.filter(transition => transition.from !== stateId && transition.to !== stateId);
      }).catch(err => {
        showError(`Cancellazione stato fallita: ${err.message || err}`);
      });
    }

    function groupedTransitionsForEdge(edge) {
      return (lastParsedKernel?.transitions || []).filter(transition => transition.from === edge.from && transition.to === edge.to);
    }

    function openTransitionEditor(edge = null, options = {}) {
      const presetFrom = options.from || edge?.from || '';
      const presetTo = options.to || edge?.to || '';
      const lockNodes = Boolean(options.lockNodes);
      const stateOptions = stateOptionsMarkup();
      const eventOptions = eventOptionsMarkup();
      const outputOptions = outputOptionsMarkup();
      const transitions = edge
        ? groupedTransitionsForEdge(edge).map(transition => ({
            ...transition,
            eventName: (lastParsedBroker?.inputEvents || []).find(item => item.id === transition.eventId)?.name || transition.eventId,
            outputName: (lastParsedBroker?.outputs || []).find(item => item.id === transition.outputId)?.name || transition.outputId
          }))
        : [{
            id: getNextTransitionId(lastParsedKernel || { transitions: [] }),
            from: presetFrom || graph?.initial?.id || lastParsedKernel?.states?.[0]?.id || '',
            to: presetTo || presetFrom || graph?.initial?.id || lastParsedKernel?.states?.[0]?.id || '',
            eventId: (lastParsedBroker?.inputEvents || [])[0]?.id || '',
            eventName: (lastParsedBroker?.inputEvents || [])[0]?.name || '',
            outputId: (lastParsedBroker?.outputs || [])[0]?.id || '',
            outputName: (lastParsedBroker?.outputs || [])[0]?.name || ''
          }];

      openEditPanel(
        edge ? 'Modifica transizioni' : 'Aggiungi transizione',
        edge ? `Connessione ${edge.from} -> ${edge.to}` : (lockNodes ? `Nuova transizione ${presetFrom} -> ${presetTo}` : 'Crea una nuova transizione scegliendo stato, evento e output.'),
        `
          <div class="edit-list" id="transitionList">
            ${transitions.map((transition, index) => `
              <div class="edit-card" data-transition-index="${index}">
                <div class="edit-card-header">
                  <h4 class="edit-card-title">Transizione ${escapeHtml(transition.id || `#${index + 1}`)}</h4>
                  <div class="edit-card-actions">
                    <button type="button" class="edit-mini-btn danger" data-transition-remove="${index}">Rimuovi</button>
                  </div>
                </div>
                ${transitionEditorFields(`tr${index}`, transition, stateOptions, eventOptions, outputOptions, lockNodes)}
              </div>
            `).join('')}
          </div>
          <div class="edit-actions">
            <button type="button" class="secondary" id="transitionAddRowBtn">Aggiungi riga</button>
            <button type="button" class="secondary" id="transitionCancelBtn">Annulla</button>
            <button type="button" id="transitionSaveBtn">${edge ? 'Salva gruppo' : 'Crea transizione'}</button>
          </div>
        `
      );

      const list = document.getElementById('transitionList');
      const renderRows = rows => {
        list.innerHTML = rows.length ? rows.map((transition, index) => `
          <div class="edit-card" data-transition-index="${index}">
            <div class="edit-card-header">
              <h4 class="edit-card-title">Transizione ${escapeHtml(transition.id || `#${index + 1}`)}</h4>
              <div class="edit-card-actions">
                <button type="button" class="edit-mini-btn danger" data-transition-remove="${index}">Rimuovi</button>
              </div>
            </div>
            ${transitionEditorFields(`tr${index}`, transition, stateOptions, eventOptions, outputOptions, lockNodes)}
          </div>
        `).join('') : '<div class="edit-empty">Nessuna transizione nel gruppo.</div>';

        list.querySelectorAll('[data-transition-remove]').forEach(button => {
          button.addEventListener('click', () => {
            const currentRows = syncRowsFromDom();
            rows.splice(0, rows.length, ...currentRows);
            rows.splice(Number(button.getAttribute('data-transition-remove')), 1);
            renderRows(rows);
          });
        });
        bindTransitionRowBehavior(list);
      };

      const rows = transitions.map(transition => ({ ...transition }));
      const syncRowsFromDom = () => {
        const cards = [...list.querySelectorAll('.edit-card')];
        return cards.map((card, index) => {
          const prefix = `tr${index}`;
          const read = suffix => String(card.querySelector(`[name="${prefix}${suffix}"]`)?.value || '').trim();
          const eventSelectValue = read('EventId');
          const outputSelectValue = read('OutputId');
          return {
            id: read('Id'),
            from: read('From'),
            to: read('To'),
            eventId: eventSelectValue === '__new__' ? read('EventIdCustom') : eventSelectValue,
            eventName: read('EventName'),
            outputId: outputSelectValue === '__new__' ? read('OutputIdCustom') : outputSelectValue,
            outputName: read('OutputName')
          };
        });
      };
      renderRows(rows);

      document.getElementById('transitionAddRowBtn')?.addEventListener('click', () => {
        const currentRows = syncRowsFromDom();
        rows.splice(0, rows.length, ...currentRows);
        rows.push({
          id: getNextTransitionId(lastParsedKernel || { transitions: [] }),
          from: presetFrom || edge?.from || graph?.initial?.id || '',
          to: presetTo || edge?.to || graph?.initial?.id || '',
          eventId: (lastParsedBroker?.inputEvents || [])[0]?.id || '',
          eventName: (lastParsedBroker?.inputEvents || [])[0]?.name || '',
          outputId: (lastParsedBroker?.outputs || [])[0]?.id || '',
          outputName: (lastParsedBroker?.outputs || [])[0]?.name || ''
        });
        renderRows(rows);
      });

      document.getElementById('transitionCancelBtn')?.addEventListener('click', closeEditPanel);
      document.getElementById('transitionSaveBtn')?.addEventListener('click', async () => {
        try {
          const nextRows = syncRowsFromDom().filter(item => item.id || item.from || item.to || item.eventId || item.outputId);

          if (!nextRows.length) {
            if (!edge) throw new Error('Inserisci almeno una transizione');
          }

          await applyEditableMutation(async (broker, kernel) => {
            const stateIds = new Set([...broker.states, ...kernel.states].map(state => state.id));
            nextRows.forEach(row => {
              if (!row.id || !row.from || !row.to || !row.eventId || !row.outputId) {
                throw new Error('Ogni transizione richiede ID, stato sorgente, stato destinazione, input event e output');
              }
              if (!stateIds.has(row.from) || !stateIds.has(row.to)) {
                throw new Error('La transizione fa riferimento a uno stato inesistente');
              }
            });

            if (edge) {
              kernel.transitions = kernel.transitions.filter(transition => !(transition.from === edge.from && transition.to === edge.to));
            }

            nextRows.forEach(row => {
              upsertEventAndOutput(broker, row, row);
              kernel.transitions.push({
                id: row.id,
                from: row.from,
                to: row.to,
                eventId: row.eventId,
                outputId: row.outputId
              });
            });
          });
          closeEditPanel();
        } catch (err) {
          showError(`Modifica transizioni fallita: ${err.message || err}`);
        }
      });
    }

    async function deleteTransitionGroup(edge) {
      if (!edge) return;
      const accepted = await askDeleteConfirmation(`Questa operazione cancellerà la transizione ${edge.from} -> ${edge.to} da tutta la macchina, comprese tutte le varianti raggruppate su quel collegamento. Vuoi continuare?`);
      if (!accepted) return;
      applyEditableMutation(async (broker, kernel) => {
        kernel.transitions = kernel.transitions.filter(transition => !(transition.from === edge.from && transition.to === edge.to));
      }).catch(err => {
        showError(`Cancellazione transizioni fallita: ${err.message || err}`);
      });
    }

    function collectReachabilityLevels(startId) {
      const levels = new Map();
      if (!graph || !startId) return levels;

      const visited = new Set([startId]);
      const queue = [{ id: startId, depth: 0 }];

      while (queue.length) {
        const current = queue.shift();
        for (const edge of graph.outgoing.get(current.id) || []) {
          if (edge.to === startId || visited.has(edge.to)) continue;
          visited.add(edge.to);
          const depth = current.depth + 1;
          levels.set(edge.to, depth);
          queue.push({ id: edge.to, depth });
        }
      }

      return levels;
    }

    function updateNodeFocus(startId) {
      const draggingId = dragged?.id || null;
      const levels = collectReachabilityLevels(startId);
      svg.querySelectorAll('.node').forEach(nodeEl => {
        const id = nodeEl.getAttribute('data-id');
        const level = id === startId ? 0 : (levels.has(id) ? levels.get(id) : null);
        let opacity = 0.2;
        if (id === startId) {
          opacity = 1;
        } else if (levels.has(id)) {
          const depth = levels.get(id);
          opacity = showReachableCascade.checked
            ? Math.max(0.2, 1 - depth * 0.12)
            : (depth === 1 ? 0.8 : 0.2);
        }
        nodeEl.style.opacity = String(opacity);

        const state = graph?.statesMap?.get(id);
        if (!state) return;
        if (id === startId) {
          const activeFill = id === draggingId ? '#fef3c7' : '#eaf9ee';
          const activeStroke = id === draggingId ? '#d97706' : '#16a34a';
          applyNodeVisualState(nodeEl, state, {
            isFinal: !!state.final,
            isUnreachable: !state.reachable,
            fill: activeFill,
            stroke: activeStroke,
            innerStroke: activeStroke
          });
        }

        if (showReachableCascade.checked && level !== null) {
          setNodeLevelBadge(nodeEl, level, id === startId);
        } else {
          clearNodeLevelBadge(nodeEl);
        }
      });

      svg.querySelectorAll('.edge-group, .edge-label').forEach(edgeEl => {
        if (!showTransactions.checked && edgeEl.classList.contains('edge-label')) return;
        const fromId = edgeEl.getAttribute('data-edge-from');
        edgeEl.style.opacity = fromId === startId ? '1' : '0.2';
      });
    }

    function updateEdgeFocus(edge) {
      svg.querySelectorAll('.node').forEach(nodeEl => {
        const id = nodeEl.getAttribute('data-id');
        nodeEl.style.opacity = (id === edge.from || id === edge.to) ? '1' : '0.2';
        clearNodeLevelBadge(nodeEl);

        const state = graph?.statesMap?.get(id);
        if (!state) return;
        if (id === edge.from || id === edge.to) {
          applyNodeVisualState(nodeEl, state, {
            isFinal: !!state.final,
            isUnreachable: !state.reachable,
            fill: '#eaf9ee',
            stroke: '#16a34a',
            innerStroke: '#16a34a'
          });
        } else {
          applyNodeVisualState(nodeEl, state);
        }
      });

      svg.querySelectorAll('.edge-group, .edge-label').forEach(edgeEl => {
        if (!showTransactions.checked && edgeEl.classList.contains('edge-label')) return;
        const domKey = edgeEl.getAttribute('data-edge-key');
        edgeEl.style.opacity = domKey === edge.domKey ? '1' : '0.2';
      });
    }

    function resetNodeFocus() {
      svg.querySelectorAll('.node').forEach(nodeEl => {
        nodeEl.style.opacity = '1';
        clearNodeLevelBadge(nodeEl);
        const id = nodeEl.getAttribute('data-id');
        const state = graph?.statesMap?.get(id);
        if (!state) return;
        applyNodeVisualState(nodeEl, state);
      });
      svg.querySelectorAll('.edge-group, .edge-label').forEach(edgeEl => {
        if (!showTransactions.checked && edgeEl.classList.contains('edge-label')) return;
        edgeEl.style.opacity = '1';
      });
    }

    function setNodeLevelBadge(nodeEl, level, isRoot = false) {
      let badge = nodeEl.querySelector('.level-badge');
      if (!badge) {
        badge = createSvg('text', {
          class: 'level-badge',
          'text-anchor': 'end',
          'font-size': 11,
          'font-weight': 800,
          'font-family': SVG_FONT_STACK,
          'pointer-events': 'none'
        }, nodeEl);
      }

      const id = nodeEl.getAttribute('data-id');
      const state = graph?.statesMap?.get(id);
      if (!state) return;

      badge.setAttribute('x', state.x + BOX_W - 12);
      badge.setAttribute('y', state.y + 18);
      badge.setAttribute('fill', isRoot ? '#15803d' : '#374151');
      badge.textContent = String(level);
    }

    function clearNodeLevelBadge(nodeEl) {
      nodeEl.querySelector('.level-badge')?.remove();
    }

    function scheduleDragRender() {
      if (dragFramePending) return;
      dragFramePending = true;

      requestAnimationFrame(() => {
        dragFramePending = false;
        if (!dragged || !dragPointer) return;

        const pt = clientToSvg(dragPointer.x, dragPointer.y);
        const nextX = Math.max(20, pt.x - dragOffset.x);
        const nextY = Math.max(20, pt.y - dragOffset.y);

        if (Math.abs(nextX - dragged.x) < 0.5 && Math.abs(nextY - dragged.y) < 0.5) return;

        dragged.x = nextX;
        dragged.y = nextY;
        dragMoved = true;
        rerenderPreservingPositions();
        updateNodeFocus(dragged.id);
      });
    }

    function bindSvgDragHandlers() {
      if (svgDragHandlersBound) return;
      svgDragHandlersBound = true;

      svg.addEventListener('pointermove', e => {
        if (draggedLabelKey && draggedLabelStart && graph?.labelOffsets) {
          const pt = clientToSvg(e.clientX, e.clientY);
          graph.labelOffsets.set(draggedLabelKey, {
            dx: draggedLabelStart.dx + (pt.x - draggedLabelStart.x),
            dy: draggedLabelStart.dy + (pt.y - draggedLabelStart.y),
            side: draggedLabelStart.side
          });
          rerenderPreservingPositions();
          return;
        }

        if (editMode && pendingTransitionStartId) {
          pendingTransitionPointer = clientToSvg(e.clientX, e.clientY);
          drawPendingTransition();
        }

        if (!dragged) return;
        dragPointer = { x: e.clientX, y: e.clientY };
        scheduleDragRender();
      });

      svg.addEventListener('pointerup', () => {
        const shouldPersist = !!dragged || !!draggedLabelKey;
        dragged = null;
        draggedLabelKey = null;
        draggedLabelStart = null;
        dragPointer = null;
        resetNodeFocus();
        if (shouldPersist) saveLayoutToSession();
      });

      svg.addEventListener('pointerleave', () => {
        const shouldPersist = !!dragged || !!draggedLabelKey;
        dragged = null;
        draggedLabelKey = null;
        draggedLabelStart = null;
        dragPointer = null;
        resetNodeFocus();
        if (shouldPersist) saveLayoutToSession();
      });
    }

    function attachDragHandlers() {
      bindSvgDragHandlers();
      const nodes = svg.querySelectorAll('.node');
      const labels = svg.querySelectorAll('.edge-label');
      nodes.forEach(node => {
        node.addEventListener('pointerdown', e => {
          if (e.target?.closest?.('.node-action')) return;
          const id = node.getAttribute('data-id');
          const s = graph.statesMap.get(id);
          if (!s) return;
          dragged = s;
          dragMoved = false;
          dragPointer = { x: e.clientX, y: e.clientY };
          node.setPointerCapture(e.pointerId);
          const pt = clientToSvg(e.clientX, e.clientY);
          dragOffset.x = pt.x - s.x;
          dragOffset.y = pt.y - s.y;
          node.style.cursor = 'grabbing';
          updateNodeFocus(s.id);
        });

        node.addEventListener('pointerenter', () => {
          if (dragged) return;
          updateNodeFocus(node.getAttribute('data-id'));
        });

        node.addEventListener('pointerleave', () => {
          if (dragged) return;
          resetNodeFocus();
        });

        node.addEventListener('click', () => {
          if (dragged || dragMoved) {
            dragMoved = false;
            return;
          }
          const nodeId = node.getAttribute('data-id');
          if (editMode && pendingTransitionStartId) {
            openTransitionEditor(null, { from: pendingTransitionStartId, to: nodeId, lockNodes: true });
            cancelPendingTransition();
          } else if (editMode) {
            openStateEditor(nodeId);
          }
          else openNodeSummary(nodeId);
        });
      });

      labels.forEach(label => {
        label.addEventListener('pointerdown', e => {
          if (e.target?.closest?.('.edge-action')) return;
          const key = label.getAttribute('data-edge-key');
          if (!key || !graph?.labelOffsets) return;
          draggedLabelKey = key;
          const current = graph.labelOffsets.get(key) || { dx: 0, dy: 0, side: '' };
          const pt = clientToSvg(e.clientX, e.clientY);
          draggedLabelStart = { x: pt.x, y: pt.y, dx: current.dx, dy: current.dy, side: current.side };
          label.setPointerCapture(e.pointerId);
          e.stopPropagation();
          e.preventDefault();
        });
      });
    }

    function clientToSvg(clientX, clientY) {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      return point.matrixTransform(svg.getScreenCTM().inverse());
    }

    function renderAll() {
      try {
        errorBox.style.display = 'none';
        const brokerDoc = xmlFromString(brokerInput.value.trim());
        const kernelDoc = xmlFromString(kernelInput.value.trim());
        const broker = parseBroker(brokerDoc);
        const kernel = parseKernel(kernelDoc);
        lastParsedBroker = cloneBroker(broker);
        lastParsedKernel = cloneKernel(kernel);
        graph = buildModel(broker, kernel);
        if (pendingTransitionStartId && !graph.statesMap.has(pendingTransitionStartId)) cancelPendingTransition();
        graph.layoutCacheKey = buildLayoutCacheKey(broker);
        closeNodeSummary();
        if (!restoreLayoutFromSession(graph)) applyAutoLayout(graph);
        rerenderGraph();
        saveLayoutToSession();
        updateEditModeUI();
      } catch (err) {
        showError(err.message);
      }
    }

    function bootstrapDefaultMachine() {
      setXmlText('broker', demoBroker);
      setXmlText('kernel', demoKernel);
      renderAll();
    }

    [showSelfLoops, showOutputs, showEventNames, showTransactions, showReachableCascade, showUnused].forEach(el => el.addEventListener('change', () => rerenderPreservingPositions()));
    spacingRange.addEventListener('input', () => {
      const previousScale = spacingScale;
      spacingScale = Number(spacingRange.value || 100) / 100;
      updateSpacingLabel();
      if (!graph) return;
      rescaleCurrentLayout(graph, previousScale, spacingScale);
      rerenderGraph();
      saveLayoutToSession();
    });
    exportBtn.addEventListener('click', () => {
      exportGraphAsPng().catch(err => {
        showError(`Export PNG fallito: ${err.message || err}`);
      });
    });
    resetLayoutBtn.addEventListener('click', () => {
      if (!graph) return;
      clearLayoutCache(graph.layoutCacheKey);
      graph.labelOffsets = new Map();
      applyAutoLayout(graph);
      rerenderGraph();
      saveLayoutToSession();
    });
    editModeBtn.addEventListener('click', () => {
      editMode = !editMode;
      if (!editMode) cancelPendingTransition();
      closeEditPanel();
      rerenderPreservingPositions();
      updateEditModeUI();
    });
    addStateBtn.addEventListener('click', () => openStateEditor());
    rollbackBtn.addEventListener('click', async () => {
      const snapshot = editHistory.pop();
      updateEditModeUI();
      if (!snapshot) return;
      setXmlText('broker', snapshot.brokerText);
      setXmlText('kernel', snapshot.kernelText);
      try {
        await persistXmlToFiles();
      } catch (err) {
        showError(`Rollback salvato solo in pagina: ${err.message || err}`);
      }
      renderAll();
    });
    brokerFileBtn.addEventListener('click', async () => {
      try {
        if (window.showOpenFilePicker) {
          await openXmlWithPicker('broker');
          scheduleAutoRender(true);
          return;
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          showError(`Lettura Broker XML fallita: ${err.message || err}`);
        }
        return;
      }
      brokerFileInput.click();
    });
    kernelFileBtn.addEventListener('click', async () => {
      try {
        if (window.showOpenFilePicker) {
          await openXmlWithPicker('kernel');
          scheduleAutoRender(true);
          return;
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          showError(`Lettura Kernel XML fallita: ${err.message || err}`);
        }
        return;
      }
      kernelFileInput.click();
    });
    brokerEditBtn.addEventListener('click', () => openXmlWindow('broker'));
    kernelEditBtn.addEventListener('click', () => openXmlWindow('kernel'));
    brokerWindowClose.addEventListener('click', () => closeXmlWindow('broker'));
    kernelWindowClose.addEventListener('click', () => closeXmlWindow('kernel'));
    brokerFileInput.addEventListener('change', async () => {
      const file = brokerFileInput.files?.[0];
      if (!file) return;
      try {
        brokerFileHandle = null;
        await loadXmlFileIntoInput(file, brokerInput);
        scheduleAutoRender(true);
      } catch (err) {
        showError(`Lettura Broker XML fallita: ${err.message || err}`);
      } finally {
        brokerFileInput.value = '';
      }
    });
    kernelFileInput.addEventListener('change', async () => {
      const file = kernelFileInput.files?.[0];
      if (!file) return;
      try {
        kernelFileHandle = null;
        await loadXmlFileIntoInput(file, kernelInput);
        scheduleAutoRender(true);
      } catch (err) {
        showError(`Lettura Kernel XML fallita: ${err.message || err}`);
      } finally {
        kernelFileInput.value = '';
      }
    });
    brokerInput.addEventListener('input', () => {
      if (brokerEditor.value !== brokerInput.value) brokerEditor.value = brokerInput.value;
      setXmlText('broker', brokerInput.value);
      scheduleAutoRender(false);
    });
    kernelInput.addEventListener('input', () => {
      if (kernelEditor.value !== kernelInput.value) kernelEditor.value = kernelInput.value;
      setXmlText('kernel', kernelInput.value);
      scheduleAutoRender(false);
    });
    brokerEditor.addEventListener('input', () => {
      setXmlText('broker', brokerEditor.value);
      scheduleAutoRender(false);
    });
    kernelEditor.addEventListener('input', () => {
      setXmlText('kernel', kernelEditor.value);
      scheduleAutoRender(false);
    });
    summaryClose.addEventListener('click', closeNodeSummary);
    editClose.addEventListener('click', closeEditPanel);
    editHead.addEventListener('pointerdown', e => {
      if (e.target.closest('button, input, select, textarea, label')) return;
      editDialogDrag = {
        startX: e.clientX,
        startY: e.clientY,
        offsetX: editDialogOffset.x,
        offsetY: editDialogOffset.y
      };
      editHead.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    editHead.addEventListener('pointermove', e => {
      if (!editDialogDrag) return;
      const next = clampEditDialogOffset(
        editDialogDrag.offsetX + (e.clientX - editDialogDrag.startX),
        editDialogDrag.offsetY + (e.clientY - editDialogDrag.startY)
      );
      editDialogOffset = next;
      editDialog.style.transform = `translate(${next.x}px, ${next.y}px)`;
    });
    editHead.addEventListener('pointerup', () => {
      editDialogDrag = null;
    });
    editHead.addEventListener('pointercancel', () => {
      editDialogDrag = null;
    });
    confirmCancelBtn.addEventListener('click', () => closeConfirmPanel(false));
    confirmAcceptBtn.addEventListener('click', () => closeConfirmPanel(true));
    document.querySelectorAll('.xml-window-head').forEach(handle => {
      handle.addEventListener('pointerdown', e => {
        if (e.target.closest('button, input, select, textarea, label')) return;
        const kind = handle.getAttribute('data-drag-handle');
        const state = xmlWindowState[kind];
        state.drag = {
          startX: e.clientX,
          startY: e.clientY,
          offsetX: state.offset.x,
          offsetY: state.offset.y
        };
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
      handle.addEventListener('pointermove', e => {
        const kind = handle.getAttribute('data-drag-handle');
        const state = xmlWindowState[kind];
        if (!state.drag) return;
        const next = clampXmlWindowOffset(
          kind,
          state.drag.offsetX + (e.clientX - state.drag.startX),
          state.drag.offsetY + (e.clientY - state.drag.startY)
        );
        state.offset = next;
        state.element.style.transform = `translate(${next.x}px, ${next.y}px)`;
      });
      handle.addEventListener('pointerup', () => {
        const kind = handle.getAttribute('data-drag-handle');
        xmlWindowState[kind].drag = null;
      });
      handle.addEventListener('pointercancel', () => {
        const kind = handle.getAttribute('data-drag-handle');
        xmlWindowState[kind].drag = null;
      });
    });
    summaryPanel.addEventListener('click', e => {
      if (e.target === summaryPanel) closeNodeSummary();
    });
    editPanel.addEventListener('click', e => {
      if (e.target === editPanel) closeEditPanel();
    });
    confirmPanel.addEventListener('click', e => {
      if (e.target === confirmPanel) closeConfirmPanel(false);
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && summaryPanel.classList.contains('open')) closeNodeSummary();
      if (e.key === 'Escape' && editPanel.classList.contains('open')) closeEditPanel();
      if (e.key === 'Escape' && confirmPanel.classList.contains('open')) closeConfirmPanel(false);
      if (e.key === 'Escape' && pendingTransitionStartId) cancelPendingTransition();
    });
    updateSpacingLabel();
    updateEditModeUI();

    const demoBroker = `<BrokerStateMachine id="FC_ATT_VAR_MIGFTTC_DIS" name="ATT CES VAR BTS VULA NGA" fsmId="FC_ATT_VAR_MIGFTTC_DIS">
  <States>
    <State id="Si" initial="true">RichiestaRicevuta</State>
    <State id="S0">RichiestaInviata</State>
    <State id="S1">Acquisito</State>
    <State id="S2" final="true">EspletatoOK</State>
    <State id="S3">Accodato</State>
    <State id="S4">Delivery</State>
    <State id="S5">SospesoOLO</State>
    <State id="S7">SospesoTI</State>
    <State id="S8" final="true">Bocciato</State>
    <State id="S9" final="true">Annullato</State>
    <State id="S20" final="true">Cancellato</State>
  </States>
  <InputEvents>
    <InputEvent id="Ei" initial="true">RICHIESTA_RICEVUTA</InputEvent>
    <InputEvent id="E0">RICHIESTA_INVIATA</InputEvent>
    <InputEvent id="E1">AQ</InputEvent>
    <InputEvent id="E3">KA</InputEvent>
    <InputEvent id="E3">NP</InputEvent>
    <InputEvent id="E4">CO</InputEvent>
    <InputEvent id="E4">FS</InputEvent>
    <InputEvent id="E4">NL</InputEvent>
    <InputEvent id="E4">AC</InputEvent>
    <InputEvent id="E11">CANCELLAZIONE_ACCODAMENTO</InputEvent>
    <InputEvent id="E6">SP</InputEvent>
    <InputEvent id="E8">SC</InputEvent>
    <InputEvent id="E10">OK</InputEvent>
    <InputEvent id="E24">KO</InputEvent>
    <InputEvent id="E26">ANNULLAMENTO_DA_SOM</InputEvent>
    <InputEvent id="E28">DESOSPENSIONE_DA_SOM</InputEvent>
    <InputEvent id="E29">OD</InputEvent>
    <InputEvent id="E30">RS</InputEvent>
    <InputEvent id="E32">ACCETTAZIONE_OPERE_SPECIALI</InputEvent>
    <InputEvent id="E33">RDA_DA_SOM</InputEvent>
    <InputEvent id="E34">RICHIESTA_PREVENTIVO_OPERE_SPECIALI</InputEvent>
    <InputEvent id="E37">SU</InputEvent>
    <InputEvent id="E38">RA</InputEvent>
    <InputEvent id="E39">OR</InputEvent>
    <InputEvent id="E40">RR</InputEvent>
    <InputEvent id="E55">CANCELLAZIONE_INVIO_NOTIFICA</InputEvent>
  </InputEvents>
  <OutputFunctions>
    <OutputFunction id="O0">NotificaInterna</OutputFunction>
    <OutputFunction id="O1">CreaFCReqeust</OutputFunction>
  </OutputFunctions>
</BrokerStateMachine>`;

    const demoKernel = `<StateMachine id="FC_ATT_VAR_MIGFTTC_DIS" name="ATT CES VAR BTS VULA NGA" version="1.2">
  <States>
    <State id="Si" initial="true">RichiestaRicevuta</State>
    <State id="S0">RichiestaInviata</State>
    <State id="S1">Acquisito</State>
    <State id="S2" final="true">EspletatoOK</State>
    <State id="S3">Accodato</State>
    <State id="S4">Delivery</State>
    <State id="S5">SospesoOLO</State>
    <State id="S7">SospesoTI</State>
    <State id="S8" final="true">Bocciato</State>
    <State id="S9" final="true">Annullato</State>
    <State id="S20" final="true">Cancellato</State>
  </States>
  <Transactions>
    <Transaction id="T0"><CurrentState>Si</CurrentState><InputEvent>Ei</InputEvent><NextState>Si</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T1"><CurrentState>Si</CurrentState><InputEvent>E0</InputEvent><NextState>S0</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T2"><CurrentState>S0</CurrentState><InputEvent>E1</InputEvent><NextState>S1</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T3"><CurrentState>S0</CurrentState><InputEvent>E24</InputEvent><NextState>S8</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T4"><CurrentState>S1</CurrentState><InputEvent>E4</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T5"><CurrentState>S1</CurrentState><InputEvent>E24</InputEvent><NextState>S8</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T6"><CurrentState>S3</CurrentState><InputEvent>E37</InputEvent><NextState>S3</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T7"><CurrentState>S3</CurrentState><InputEvent>E4</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T8"><CurrentState>S3</CurrentState><InputEvent>E11</InputEvent><NextState>S3</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T9"><CurrentState>S4</CurrentState><InputEvent>E3</InputEvent><NextState>S3</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T10"><CurrentState>S4</CurrentState><InputEvent>E33</InputEvent><NextState>S4</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T11"><CurrentState>S4</CurrentState><InputEvent>E37</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T12"><CurrentState>S4</CurrentState><InputEvent>E39</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T13"><CurrentState>S4</CurrentState><InputEvent>E40</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T14"><CurrentState>S4</CurrentState><InputEvent>E8</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T15"><CurrentState>S4</CurrentState><InputEvent>E6</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T16"><CurrentState>S4</CurrentState><InputEvent>E24</InputEvent><NextState>S8</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T17"><CurrentState>S4</CurrentState><InputEvent>E10</InputEvent><NextState>S2</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T18"><CurrentState>S5</CurrentState><InputEvent>E4</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T19"><CurrentState>S5</CurrentState><InputEvent>E29</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T20"><CurrentState>S5</CurrentState><InputEvent>E26</InputEvent><NextState>S5</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T21"><CurrentState>S5</CurrentState><InputEvent>E28</InputEvent><NextState>S5</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T22"><CurrentState>S5</CurrentState><InputEvent>E30</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T23"><CurrentState>S5</CurrentState><InputEvent>E32</InputEvent><NextState>S5</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T24"><CurrentState>S5</CurrentState><InputEvent>E33</InputEvent><NextState>S5</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T25"><CurrentState>S5</CurrentState><InputEvent>E37</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T26"><CurrentState>S5</CurrentState><InputEvent>E38</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T27"><CurrentState>S5</CurrentState><InputEvent>E39</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T28"><CurrentState>S5</CurrentState><InputEvent>E40</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T29"><CurrentState>S5</CurrentState><InputEvent>E24</InputEvent><NextState>S8</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T30"><CurrentState>S7</CurrentState><InputEvent>E4</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T31"><CurrentState>S7</CurrentState><InputEvent>E29</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T32"><CurrentState>S7</CurrentState><InputEvent>E26</InputEvent><NextState>S7</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T33"><CurrentState>S7</CurrentState><InputEvent>E28</InputEvent><NextState>S7</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T34"><CurrentState>S7</CurrentState><InputEvent>E30</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T35"><CurrentState>S7</CurrentState><InputEvent>E32</InputEvent><NextState>S7</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T36"><CurrentState>S7</CurrentState><InputEvent>E33</InputEvent><NextState>S7</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T37"><CurrentState>S7</CurrentState><InputEvent>E37</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T38"><CurrentState>S7</CurrentState><InputEvent>E38</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T39"><CurrentState>S7</CurrentState><InputEvent>E39</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T40"><CurrentState>S7</CurrentState><InputEvent>E40</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T41"><CurrentState>S7</CurrentState><InputEvent>E24</InputEvent><NextState>S8</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T42"><CurrentState>S3</CurrentState><InputEvent>E24</InputEvent><NextState>S8</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T43"><CurrentState>Si</CurrentState><InputEvent>E55</InputEvent><NextState>S20</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T44"><CurrentState>S5</CurrentState><InputEvent>E34</InputEvent><NextState>S5</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T45"><CurrentState>S5</CurrentState><InputEvent>E8</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T46"><CurrentState>S7</CurrentState><InputEvent>E34</InputEvent><NextState>S7</NextState><OutputFunction>O1</OutputFunction></Transaction>
    <Transaction id="T47"><CurrentState>S7</CurrentState><InputEvent>E8</InputEvent><NextState>S5</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T48"><CurrentState>S1</CurrentState><InputEvent>E10</InputEvent><NextState>S2</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T49"><CurrentState>S5</CurrentState><InputEvent>E6</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T50"><CurrentState>S5</CurrentState><InputEvent>E3</InputEvent><NextState>S3</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T51"><CurrentState>S7</CurrentState><InputEvent>E3</InputEvent><NextState>S3</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T52"><CurrentState>S1</CurrentState><InputEvent>E3</InputEvent><NextState>S3</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T53"><CurrentState>S7</CurrentState><InputEvent>E6</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T54"><CurrentState>S3</CurrentState><InputEvent>E3</InputEvent><NextState>S3</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T55"><CurrentState>S5</CurrentState><InputEvent>E10</InputEvent><NextState>S2</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T56"><CurrentState>S7</CurrentState><InputEvent>E10</InputEvent><NextState>S2</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T57"><CurrentState>S4</CurrentState><InputEvent>E4</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T58"><CurrentState>S1</CurrentState><InputEvent>E6</InputEvent><NextState>S7</NextState><OutputFunction>O0</OutputFunction></Transaction>
    <Transaction id="T59"><CurrentState>S0</CurrentState><InputEvent>E4</InputEvent><NextState>S4</NextState><OutputFunction>O0</OutputFunction></Transaction>
  </Transactions>
</StateMachine>`;

    bootstrapDefaultMachine();
