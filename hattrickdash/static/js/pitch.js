/* pitch.js - Canvas-Renderer für das Spielfeld + Spielerkarten.
   Koordinaten: x/y in 0..100 (intern), werden auf Canvas-Größe skaliert.
   Heimansicht: Tor links (x=0 = eigenes Tor), Angriff rechts (x=100).

   Features:
   - DPI-Aware (scharf auf HiDPI-Displays)
   - Schöneres Spielfeld (Strafraum, 6er-Raum, Anstoßpunkt, Elfmeterpunkte,
     Eckfähnchen-Bögen, Tore mit Netz)
   - Angedeutetes Stadion / Tribüne drumherum
   - Spielerkarten mit Schatten, klarer Position-Indikator
*/

window.HHPitch = (function () {

  function ratingColor(r) {
    if (r == null) return '#888';
    if (r < 5)   return '#cc4444';
    if (r < 6.5) return '#ddaa22';
    if (r < 8)   return '#44aa44';
    return '#4488cc';
  }

  function positionColor(role) {
    if (!role) return '#888';
    const r = role.toLowerCase();
    if (r === 'keeper')                                       return '#cc4444';
    if (r.includes('cb'))                                     return '#4466cc';
    if (r === 'rb' || r === 'lb' || r.includes('wb'))         return '#4499aa';
    if (r === 'rw' || r === 'lw')                             return '#44aa66';
    if (r.includes('cm') || r.includes('im'))                 return '#ddaa44';
    if (r.includes('cf'))                                     return '#44aacc';
    return '#888';
  }

  function slotPosLabel(role) {
    if (!role) return '?';
    const r = role.toLowerCase();
    if (r === 'keeper') return 'G';
    if (r.includes('cb')) return 'DC';
    if (r === 'rb' || r === 'lb' || r.includes('wb')) return 'DW';
    if (r === 'rw' || r === 'lw') return 'W';
    if (r.includes('cm') || r.includes('im')) return 'M';
    if (r.includes('cf')) return 'F';
    return '?';
  }

  // ----- DPI-Aware-Setup: Canvas auf das tatsächliche Display-DPI skalieren
  function setupHiDPI(canvas) {
    const rect = canvas.getBoundingClientRect();
    const cssW = rect.width  || canvas.clientWidth  || 1000;
    const cssH = rect.height || canvas.clientHeight || 700;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    canvas.width  = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext('2d');
    // Wichtig: Reset transform, dann scale - sonst akkumuliert sich beim Re-Render
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    // Smoothing für Texte
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    return { ctx, w: cssW, h: cssH, dpr };
  }

  // ============================================================ Render
  function render(canvas, lineup, opts = {}) {
    if (!canvas) return;
    const setup = setupHiDPI(canvas);
    // Wenn Container noch keine Größe hat (Layout läuft noch), warte 1 Frame
    if (setup.w < 50 || setup.h < 50) {
      requestAnimationFrame(() => render(canvas, lineup, opts));
      return;
    }
    const { ctx, w, h } = setup;

    // Hintergrund komplett löschen
    ctx.clearRect(0, 0, w, h);

    drawStadium(ctx, w, h);
    drawPitch(ctx, w, h);

    if (!lineup || !lineup.length) return;

    canvas._slots = [];
    canvas._dimensions = { w, h };

    // Karten-Größe relativ zur Canvas-Breite
    const cardW = Math.max(95, Math.min(155, w * 0.135));
    const cardH = Math.max(34, cardW * 0.36);

    for (const slot of lineup) {
      const px = (slot.y / 100) * (w - cardW) + cardW / 2;
      const py = (1 - slot.x / 100) * (h - cardH) + cardH / 2;

      drawCard(ctx, px, py, cardW, cardH, slot, opts);
      canvas._slots.push({
        slot, x: px - cardW / 2, y: py - cardH / 2, w: cardW, h: cardH,
      });
    }
  }

  // ============================================================ Stadion
  function drawStadium(ctx, w, h) {
    // Dunkle Hintergrund-Schicht (außerhalb des Rasens)
    ctx.fillStyle = '#1a1f2e';
    ctx.fillRect(0, 0, w, h);

    // Tribünen-Trapez links/rechts/oben/unten
    // Wir simulieren: 4 Trapeze mit Lichteffekt + Sitz-Reihen-Andeutung
    const margin = Math.min(w, h) * 0.06;
    const innerL = margin;
    const innerR = w - margin;
    const innerT = margin;
    const innerB = h - margin;

    // Tribünen-Hintergrund mit Gradient (innen heller, außen dunkler)
    const drawStand = (x1, y1, x2, y2, x3, y3, x4, y4, gradFromY, gradToY) => {
      const grad = ctx.createLinearGradient(0, gradFromY, 0, gradToY);
      grad.addColorStop(0, '#1a1f2e');
      grad.addColorStop(0.5, '#2a3346');
      grad.addColorStop(1, '#1a1f2e');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.closePath();
      ctx.fill();
    };

    // Oben
    drawStand(0, 0, w, 0, innerR, innerT, innerL, innerT, 0, innerT);
    // Unten
    drawStand(innerL, innerB, innerR, innerB, w, h, 0, h, innerB, h);
    // Links
    drawStand(0, 0, innerL, innerT, innerL, innerB, 0, h, 0, h);
    // Rechts
    drawStand(innerR, innerT, w, 0, w, h, innerR, innerB, 0, h);

    // Sitz-Reihen-Andeutung: feine horizontale/vertikale Linien
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    // Oben/Unten: vertikale Linien
    for (let x = 10; x < w - 10; x += 6) {
      ctx.beginPath();
      ctx.moveTo(x, 0); ctx.lineTo(x + (innerL - 0) * (innerL / w), innerT);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, h); ctx.lineTo(x - (innerL - 0) * (innerL / w), innerB);
      ctx.stroke();
    }

    // Lichtschein an den Tribünen-Innenkanten (Beleuchtung)
    const innerGrad = ctx.createLinearGradient(0, innerT - 8, 0, innerT);
    innerGrad.addColorStop(0, 'rgba(255,255,255,0)');
    innerGrad.addColorStop(1, 'rgba(255,255,255,0.08)');
    ctx.fillStyle = innerGrad;
    ctx.fillRect(innerL, innerT - 8, innerR - innerL, 8);

    const innerGrad2 = ctx.createLinearGradient(0, innerB, 0, innerB + 8);
    innerGrad2.addColorStop(0, 'rgba(255,255,255,0.08)');
    innerGrad2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = innerGrad2;
    ctx.fillRect(innerL, innerB, innerR - innerL, 8);
  }

  // ============================================================ Pitch (Rasen)
  function drawPitch(ctx, w, h) {
    const margin = Math.min(w, h) * 0.06;
    const px = margin;
    const py = margin;
    const pw = w - 2 * margin;
    const ph = h - 2 * margin;

    // Rasen-Streifen (vertikal, da Spielfeld liegt)
    const stripeCount = 14;
    const stripeW = pw / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
      const dark = i % 2 === 0;
      ctx.fillStyle = dark ? '#3d6c33' : '#467b3a';
      ctx.fillRect(px + i * stripeW, py, stripeW + 1, ph);
    }

    // Subtiler Vignette-Effekt (außen leicht dunkler)
    const vGrad = ctx.createRadialGradient(
      w / 2, h / 2, Math.min(pw, ph) * 0.2,
      w / 2, h / 2, Math.max(pw, ph) * 0.6
    );
    vGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vGrad.addColorStop(1, 'rgba(0,0,0,0.25)');
    ctx.fillStyle = vGrad;
    ctx.fillRect(px, py, pw, ph);

    // Linien (alle weiß mit leichtem Glow)
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1.5, w / 600);
    ctx.lineCap = 'round';

    // Außenlinie
    ctx.strokeRect(px, py, pw, ph);

    // Mittellinie (vertikal, Spielfeld liegt)
    ctx.beginPath();
    ctx.moveTo(px + pw / 2, py);
    ctx.lineTo(px + pw / 2, py + ph);
    ctx.stroke();

    // Mittelkreis
    const centerX = px + pw / 2;
    const centerY = py + ph / 2;
    const centerR = Math.min(pw, ph) * 0.13;
    ctx.beginPath();
    ctx.arc(centerX, centerY, centerR, 0, Math.PI * 2);
    ctx.stroke();
    // Anstoßpunkt
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.max(2, w / 280), 0, Math.PI * 2);
    ctx.fill();

    // Strafraum-Boxen (16er + 5er) - links
    drawPenaltyArea(ctx, px, py, pw, ph, true);   // links (eigenes Tor)
    drawPenaltyArea(ctx, px, py, pw, ph, false);  // rechts (gegnerisches Tor)

    // Tore (mit Netz) - links + rechts
    drawGoal(ctx, px, py, ph, true);
    drawGoal(ctx, px + pw, py, ph, false);

    // Eckfähnchen-Bögen (4 Ecken)
    const cornerR = Math.min(pw, ph) * 0.018;
    drawCornerArc(ctx, px,         py,        cornerR, 0,             Math.PI / 2);
    drawCornerArc(ctx, px + pw,    py,        cornerR, Math.PI / 2,   Math.PI);
    drawCornerArc(ctx, px + pw,    py + ph,   cornerR, Math.PI,       Math.PI * 1.5);
    drawCornerArc(ctx, px,         py + ph,   cornerR, Math.PI * 1.5, Math.PI * 2);
  }

  function drawPenaltyArea(ctx, px, py, pw, ph, leftSide) {
    // 16er-Raum (Strafraum)
    const boxW = pw * 0.16;
    const boxH = ph * 0.55;
    const bx = leftSide ? px : px + pw - boxW;
    const by = py + (ph - boxH) / 2;
    ctx.strokeRect(bx, by, boxW, boxH);

    // 5er-Raum (Torraum)
    const smallW = boxW * 0.4;
    const smallH = boxH * 0.45;
    const sx = leftSide ? px : px + pw - smallW;
    const sy = py + (ph - smallH) / 2;
    ctx.strokeRect(sx, sy, smallW, smallH);

    // Elfmeterpunkt
    const dotX = leftSide ? px + boxW * 0.65 : px + pw - boxW * 0.65;
    const dotY = py + ph / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(dotX, dotY, Math.max(2, pw / 320), 0, Math.PI * 2);
    ctx.fill();

    // Strafraum-Bogen (penalty arc) - nur der Teil außerhalb der Box
    ctx.beginPath();
    if (leftSide) {
      ctx.arc(dotX, dotY, boxH * 0.3, -Math.PI / 2.5, Math.PI / 2.5);
    } else {
      ctx.arc(dotX, dotY, boxH * 0.3, Math.PI - Math.PI / 2.5, Math.PI + Math.PI / 2.5);
    }
    ctx.stroke();
  }

  function drawGoal(ctx, px, py, ph, leftSide) {
    // Tor steht außerhalb des Rasens, deutet das echte Tor an
    const goalH = ph * 0.18;
    const goalW = Math.max(8, ph * 0.025);
    const gy = py + (ph - goalH) / 2;
    const gx = leftSide ? px - goalW : px;

    // Tor-Pfosten + Querbalken
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(2, goalW * 0.25);
    ctx.strokeRect(gx, gy, goalW, goalH);

    // Netz: feine Karos
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    const netStep = Math.max(3, goalH / 12);
    for (let yy = gy + netStep; yy < gy + goalH; yy += netStep) {
      ctx.beginPath();
      ctx.moveTo(gx, yy); ctx.lineTo(gx + goalW, yy);
      ctx.stroke();
    }
    for (let xx = gx + netStep / 2; xx < gx + goalW; xx += netStep / 2) {
      ctx.beginPath();
      ctx.moveTo(xx, gy); ctx.lineTo(xx, gy + goalH);
      ctx.stroke();
    }
  }

  function drawCornerArc(ctx, cx, cy, r, startAngle, endAngle) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.stroke();
  }

  // ============================================================ Spielerkarte
  function drawCard(ctx, cx, cy, cw, ch, slot, opts) {
    const r = slot.rating_estimate ?? slot.player_rating ?? null;
    const posColor = positionColor(slot.role);
    const x = cx - cw / 2;
    const y = cy - ch / 2;
    const radius = Math.min(7, ch * 0.25);

    // Schatten unter der Karte
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = posColor;
    roundRect(ctx, x, y, cw, ch, radius);
    ctx.fill();
    ctx.restore();

    // Innerer Verlauf (oben heller, unten dunkler)
    const grad = ctx.createLinearGradient(0, y, 0, y + ch);
    grad.addColorStop(0, 'rgba(255,255,255,0.18)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.fillStyle = grad;
    roundRect(ctx, x, y, cw, ch, radius);
    ctx.fill();

    // Position-Badge links (kleines Quadrat mit Position-Code)
    const padLeft = Math.max(3, ch * 0.15);
    const badgeSize = ch * 0.6;
    const badgeY = y + (ch - badgeSize) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    roundRect(ctx, x + padLeft, badgeY, badgeSize, badgeSize, badgeSize * 0.18);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'white';
    ctx.font = `700 ${Math.round(ch * 0.34)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(slotPosLabel(slot.role),
                 x + padLeft + badgeSize / 2,
                 badgeY + badgeSize / 2 + 1);

    // Rating-Pill rechts oben
    const rText = r != null ? r.toFixed(2) : '–';
    const rPillW = Math.max(34, ch * 1.05);
    const rPillH = ch * 0.42;
    const rPillX = x + cw - rPillW - padLeft;
    const rPillY = y + ch * 0.1;
    ctx.fillStyle = ratingColor(r);
    roundRect(ctx, rPillX, rPillY, rPillW, rPillH, rPillH / 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, rPillX, rPillY, rPillW, rPillH, rPillH / 2);
    ctx.stroke();
    ctx.fillStyle = 'white';
    ctx.font = `700 ${Math.round(rPillH * 0.66)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rText, rPillX + rPillW / 2, rPillY + rPillH / 2 + 0.5);

    // Spielername (zwischen Position-Badge und Rating-Pill)
    const nameX = x + padLeft + badgeSize + 6;
    const nameMaxW = rPillX - nameX - 4;
    ctx.fillStyle = 'white';
    ctx.font = `600 ${Math.round(ch * 0.32)}px -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let name = slot.player?.name || slot.role || '';
    name = fitText(ctx, name, nameMaxW);
    ctx.fillText(name, nameX, y + ch * 0.42);

    // Status-Icons unter dem Namen
    const iconY = y + ch * 0.78;
    let iconX = nameX;
    ctx.font = `${Math.round(ch * 0.28)}px sans-serif`;
    if (slot.player?.is_injured) {
      ctx.fillStyle = '#ffbbbb';
      ctx.fillText('✕', iconX, iconY);
      iconX += ch * 0.35;
    }
    if (slot.player?.specialty) {
      ctx.fillStyle = '#ffe066';
      ctx.fillText('⚡', iconX, iconY);
      iconX += ch * 0.35;
    }
    if (slot.player?.is_suspended) {
      ctx.fillStyle = '#ff9999';
      ctx.fillText('🔴', iconX, iconY);
    }
  }

  function fitText(ctx, text, maxW) {
    if (!text) return '';
    if (ctx.measureText(text).width <= maxW) return text;
    // Wenn zu lang: Vorname → erstes Initial, Nachname behalten
    const parts = String(text).trim().split(/\s+/);
    if (parts.length > 1) {
      const compact = parts[0][0] + '. ' + parts.slice(1).join(' ');
      if (ctx.measureText(compact).width <= maxW) return compact;
      // Nur Nachname
      const last = parts[parts.length - 1];
      if (ctx.measureText(last).width <= maxW) return last;
    }
    // Kürzen mit Ellipse
    let cut = text;
    while (cut.length > 1 && ctx.measureText(cut + '…').width > maxW) {
      cut = cut.slice(0, -1);
    }
    return cut + '…';
  }

  // ============================================================ Helpers
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function attachClick(canvas, onPlayerClick) {
    canvas.addEventListener('click', (e) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const dim = canvas._dimensions || { w: rect.width, h: rect.height };
      const x = (e.clientX - rect.left) * (dim.w / rect.width);
      const y = (e.clientY - rect.top) * (dim.h / rect.height);
      for (const s of (canvas._slots || [])) {
        if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
          onPlayerClick && onPlayerClick(s.slot);
          break;
        }
      }
    });
  }

  // Bei Window-Resize: Canvas neu rendern, sonst wird's verzerrt
  let _resizeListener = null;
  function attachResizeRedraw(canvas, lineupRef) {
    if (_resizeListener) {
      window.removeEventListener('resize', _resizeListener);
    }
    _resizeListener = () => {
      if (typeof lineupRef === 'function') {
        render(canvas, lineupRef());
      }
    };
    window.addEventListener('resize', _resizeListener);
  }

  return { render, attachClick, attachResizeRedraw, ratingColor, positionColor };
})();
